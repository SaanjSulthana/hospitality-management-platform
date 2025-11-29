/**
 * Reports Service Dual-Mode Tests
 * 
 * Tests that verify the reports service works correctly in both
 * legacy and partitioned table modes
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { SQLDatabase } from 'encore.dev/storage/sqldb';
import { ReportsService } from '../reports-service/reports_service';

const testDB = SQLDatabase.named('hospitality');

// Mock authentication data
const mockAuthData = {
  orgId: 666001,
  userId: 1,
  userID: '1',
  role: 'ADMIN',
};

jest.mock('~encore/auth', () => ({
  getAuthData: () => mockAuthData,
}));

describe('Reports Service - Dual Mode Tests', () => {
  const reportsService = new ReportsService();
  const testOrgId = mockAuthData.orgId;
  const testPropertyId = 1;
  const testDate = '2025-10-29';

  const cleanupTestData = async () => {
    await testDB.exec`DELETE FROM daily_cash_balances WHERE org_id = ${testOrgId}`;
    await testDB.exec`DELETE FROM daily_cash_balances_partitioned WHERE org_id = ${testOrgId}`;
    await testDB.exec`DELETE FROM revenues WHERE org_id = ${testOrgId}`;
    await testDB.exec`DELETE FROM revenues_partitioned WHERE org_id = ${testOrgId}`;
    await testDB.exec`DELETE FROM expenses WHERE org_id = ${testOrgId}`;
    await testDB.exec`DELETE FROM expenses_partitioned WHERE org_id = ${testOrgId}`;
  };

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Daily Report Generation', () => {
    beforeEach(async () => {
      // Setup test data
      await testDB.exec`
        INSERT INTO daily_cash_balances (
          org_id, property_id, balance_date,
          opening_balance_cents, closing_balance_cents,
          created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, ${testDate},
          100000, 150000, ${mockAuthData.userId}, NOW(), NOW()
        )
      `;

      await testDB.exec`
        INSERT INTO revenues (
          org_id, property_id, amount_cents, occurred_at,
          description, status, created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, 50000, '${testDate} 10:00:00',
          'Test Revenue', 'approved', ${mockAuthData.userId}, NOW(), NOW()
        )
      `;

      await testDB.exec`
        INSERT INTO expenses (
          org_id, property_id, amount_cents, occurred_at,
          description, status, created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, 20000, '${testDate} 12:00:00',
          'Test Expense', 'approved', ${mockAuthData.userId}, NOW(), NOW()
        )
      `;

      // Wait for dual-write triggers
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should generate daily report successfully (uses current partition setting)', async () => {
      const request = {
        propertyId: testPropertyId,
        date: testDate,
      };

      const result = await reportsService.getDailyReport(request);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should return correct daily report data', async () => {
      const request = {
        propertyId: testPropertyId,
        date: testDate,
      };

      const result = await reportsService.getDailyReport(request);
      const data = result.data;
      
      expect(data.date).toBe(testDate);
      expect(data.propertyId).toBe(testPropertyId);
      expect(data.openingBalance).toBe(100000);
      expect(data.closingBalance).toBe(150000);
      expect(data.cashReceived).toBeGreaterThanOrEqual(0);
      expect(data.cashExpenses).toBeGreaterThanOrEqual(0);
    });

    it('should use cache on second request', async () => {
      const request = {
        propertyId: testPropertyId,
        date: testDate,
      };

      // First request (cache miss)
      const result1 = await reportsService.getDailyReport(request);
      expect(result1.cached).toBe(false);

      // Second request (cache hit)
      const result2 = await reportsService.getDailyReport(request);
      expect(result2.cached).toBe(true);
      expect(result2.processingTime).toBeLessThan(result1.processingTime);
    });

    it('should generate report without propertyId filter', async () => {
      const request = {
        date: testDate,
      };

      const result = await reportsService.getDailyReport(request);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('Monthly Report Generation', () => {
    beforeEach(async () => {
      // Setup test data for the month
      const dates = ['2025-10-01', '2025-10-15', '2025-10-29'];
      
      for (const date of dates) {
        await testDB.exec`
          INSERT INTO revenues (
            org_id, property_id, amount_cents, occurred_at,
            description, status, created_by_user_id, created_at, updated_at
          ) VALUES (
            ${testOrgId}, ${testPropertyId}, 50000, '${date} 10:00:00',
            'Revenue ${date}', 'approved', ${mockAuthData.userId}, NOW(), NOW()
          )
        `;
      }

      // Wait for dual-write triggers
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should generate monthly report successfully (uses current partition setting)', async () => {
      const request = {
        propertyId: testPropertyId,
        date: '2025-10-15', // Will extract month: 2025-10
      };

      const result = await reportsService.getMonthlyReport(request);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  describe('Service Health', () => {
    it('should report healthy status', async () => {
      const health = await reportsService.getHealth();
      
      expect(health.service).toBe('ReportsService');
      expect(health.version).toBe('2.0.0');
      expect(health.status).toBe('healthy');
      expect(health.dependencies).toBeDefined();
      expect(health.timestamp).toBeDefined();
    });

    it('should check all dependencies', async () => {
      const health = await reportsService.getHealth();
      
      const dbDependency = health.dependencies.find(dep => dep.name === 'Database');
      expect(dbDependency).toBeDefined();
      expect(dbDependency!.status).toBe('healthy');

      const cacheDependency = health.dependencies.find(dep => dep.name === 'CacheService');
      expect(cacheDependency).toBeDefined();
      expect(cacheDependency!.status).toBe('healthy');
    });
  });

  describe('Data Consistency with Dual-Write Triggers', () => {
    it('should maintain parity between legacy and partitioned tables', async () => {
      // Insert balance via legacy table
      await testDB.exec`
        INSERT INTO daily_cash_balances (
          org_id, property_id, balance_date,
          opening_balance_cents, closing_balance_cents,
          created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, '2025-10-30',
          200000, 250000, ${mockAuthData.userId}, NOW(), NOW()
        )
      `;

      // Wait for triggers
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check both tables
      const legacyCount = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count 
        FROM daily_cash_balances 
        WHERE org_id = ${testOrgId} AND balance_date = '2025-10-30'
      `;

      const partitionedCount = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count 
        FROM daily_cash_balances_partitioned 
        WHERE org_id = ${testOrgId} AND balance_date = '2025-10-30'
      `;

      // Due to dual-write triggers, both should have data
      expect(legacyCount!.count).toBeGreaterThan(0);
      expect(partitionedCount!.count).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing date gracefully', async () => {
      const request = {
        propertyId: testPropertyId,
        // No date provided
      };

      const result = await reportsService.getDailyReport(request);
      
      // Should default to today's date
      expect(result.success).toBe(true);
    });

    it('should handle non-existent property gracefully', async () => {
      const request = {
        propertyId: 999999,
        date: testDate,
      };

      const result = await reportsService.getDailyReport(request);
      
      // Should succeed but with empty/zero data
      expect(result.success).toBe(true);
      expect(result.data.openingBalance).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should complete daily report generation within acceptable time', async () => {
      const request = {
        propertyId: testPropertyId,
        date: testDate,
      };

      const startTime = Date.now();
      await reportsService.getDailyReport(request);
      const duration = Date.now() - startTime;
      
      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should show improved performance with caching', async () => {
      const request = {
        propertyId: testPropertyId,
        date: testDate,
      };

      const result1 = await reportsService.getDailyReport(request);
      const result2 = await reportsService.getDailyReport(request);
      
      // Cached result should be faster
      expect(result2.processingTime).toBeLessThanOrEqual(result1.processingTime);
    });
  });
});

/**
 * NOTE: To test both modes explicitly:
 * 
 * 1. Run with USE_PARTITIONED_TABLES=false:
 *    USE_PARTITIONED_TABLES=false npm test reports_service.dual_mode.test.ts
 * 
 * 2. Run with USE_PARTITIONED_TABLES=true:
 *    USE_PARTITIONED_TABLES=true npm test reports_service.dual_mode.test.ts
 * 
 * Both test runs should pass, demonstrating that the service works
 * correctly regardless of the partition setting.
 */

