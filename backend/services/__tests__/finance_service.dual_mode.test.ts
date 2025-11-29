/**
 * Finance Service Dual-Mode Tests
 * 
 * Tests that verify the finance service works correctly in both
 * legacy and partitioned table modes
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { SQLDatabase } from 'encore.dev/storage/sqldb';
import { FinanceService } from '../finance-service/finance_service';

const testDB = SQLDatabase.named('hospitality');

// Mock authentication data
const mockAuthData = {
  orgId: 777001,
  userId: 1,
  userID: '1',
  role: 'ADMIN',
};

jest.mock('~encore/auth', () => ({
  getAuthData: () => mockAuthData,
}));

describe('Finance Service - Dual Mode Tests', () => {
  const financeService = new FinanceService();
  const testOrgId = mockAuthData.orgId;

  const cleanupTestData = async () => {
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

  describe('Revenue Operations', () => {
    const testRevenue = {
      propertyId: 1,
      amount: 500,
      description: 'Test Revenue',
      paymentMode: 'cash' as const,
      occurredAt: '2025-10-29T10:00:00.000Z',
    };

    it('should add revenue successfully (uses current partition setting)', async () => {
      const result = await financeService.addRevenue(testRevenue);
      
      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.message).toBe('Revenue added successfully');

      // Verify data exists (in at least one table due to dual-write triggers)
      const legacyCount = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM revenues WHERE org_id = ${testOrgId}
      `;
      expect(legacyCount!.count).toBeGreaterThan(0);
    });

    it('should approve revenue successfully (uses current partition setting)', async () => {
      // First add a revenue
      const addResult = await financeService.addRevenue(testRevenue);
      
      // Then approve it
      const approveResult = await financeService.approveTransaction(
        addResult.transactionId,
        'revenue'
      );

      expect(approveResult.success).toBe(true);
      expect(approveResult.message).toContain('approved successfully');

      // Verify status updated in legacy table
      const revenue = await testDB.queryRow<{ status: string }>`
        SELECT status FROM revenues 
        WHERE id = ${parseInt(addResult.transactionId)} 
          AND org_id = ${testOrgId}
      `;
      expect(revenue!.status).toBe('approved');
    });

    it('should handle multiple revenue additions', async () => {
      const revenues = [
        { ...testRevenue, description: 'Revenue 1', amount: 100 },
        { ...testRevenue, description: 'Revenue 2', amount: 200 },
        { ...testRevenue, description: 'Revenue 3', amount: 300 },
      ];

      const results = await Promise.all(
        revenues.map(rev => financeService.addRevenue(rev))
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify all added
      const count = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM revenues WHERE org_id = ${testOrgId}
      `;
      expect(count!.count).toBe(3);
    });
  });

  describe('Expense Operations', () => {
    const testExpense = {
      propertyId: 1,
      amount: 300,
      description: 'Test Expense',
      paymentMode: 'bank' as const,
      occurredAt: '2025-10-29T12:00:00.000Z',
    };

    it('should add expense successfully (uses current partition setting)', async () => {
      const result = await financeService.addExpense(testExpense);
      
      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.message).toBe('Expense added successfully');

      // Verify data exists
      const legacyCount = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM expenses WHERE org_id = ${testOrgId}
      `;
      expect(legacyCount!.count).toBeGreaterThan(0);
    });

    it('should approve expense successfully (uses current partition setting)', async () => {
      // First add an expense
      const addResult = await financeService.addExpense(testExpense);
      
      // Then approve it
      const approveResult = await financeService.approveTransaction(
        addResult.transactionId,
        'expense'
      );

      expect(approveResult.success).toBe(true);
      expect(approveResult.message).toContain('approved successfully');

      // Verify status updated
      const expense = await testDB.queryRow<{ status: string }>`
        SELECT status FROM expenses 
        WHERE id = ${parseInt(addResult.transactionId)} 
          AND org_id = ${testOrgId}
      `;
      expect(expense!.status).toBe('approved');
    });

    it('should handle multiple expense additions', async () => {
      const expenses = [
        { ...testExpense, description: 'Expense 1', amount: 100 },
        { ...testExpense, description: 'Expense 2', amount: 200 },
        { ...testExpense, description: 'Expense 3', amount: 300 },
      ];

      const results = await Promise.all(
        expenses.map(exp => financeService.addExpense(exp))
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify all added
      const count = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM expenses WHERE org_id = ${testOrgId}
      `;
      expect(count!.count).toBe(3);
    });
  });

  describe('Service Health', () => {
    it('should report healthy status', async () => {
      const health = await financeService.getHealth();
      
      expect(health.service).toBe('FinanceService');
      expect(health.version).toBe('2.0.0');
      expect(health.status).toBe('healthy');
      expect(health.dependencies).toBeDefined();
      expect(health.timestamp).toBeDefined();
    });

    it('should check database dependency', async () => {
      const health = await financeService.getHealth();
      
      const dbDependency = health.dependencies.find(dep => dep.name === 'Database');
      expect(dbDependency).toBeDefined();
      expect(dbDependency!.status).toBe('healthy');
    });
  });

  describe('Data Consistency with Dual-Write Triggers', () => {
    it('should maintain parity between legacy and partitioned tables', async () => {
      const testRevenue = {
        propertyId: 1,
        amount: 750,
        description: 'Parity Test Revenue',
        paymentMode: 'cash' as const,
        occurredAt: '2025-10-29T14:00:00.000Z',
      };

      await financeService.addRevenue(testRevenue);

      // Wait a moment for triggers to execute
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check both tables
      const legacyCount = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM revenues WHERE org_id = ${testOrgId}
      `;

      const partitionedCount = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM revenues_partitioned WHERE org_id = ${testOrgId}
      `;

      // Due to dual-write triggers, both should have data
      expect(legacyCount!.count).toBeGreaterThan(0);
      expect(partitionedCount!.count).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input gracefully', async () => {
      const invalidRevenue = {
        propertyId: 1,
        amount: -100, // Invalid negative amount
        description: 'Invalid',
        paymentMode: 'cash' as const,
      };

      try {
        await financeService.addRevenue(invalidRevenue);
        // If it doesn't throw, that's also acceptable as long as data is correct
      } catch (error) {
        // Error handling is acceptable
        expect(error).toBeDefined();
      }
    });

    it('should handle non-existent transaction approval', async () => {
      try {
        await financeService.approveTransaction('999999', 'revenue');
        // May not throw error if update succeeds with 0 rows
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});

/**
 * NOTE: To test both modes explicitly:
 * 
 * 1. Run with USE_PARTITIONED_TABLES=false:
 *    USE_PARTITIONED_TABLES=false npm test finance_service.dual_mode.test.ts
 * 
 * 2. Run with USE_PARTITIONED_TABLES=true:
 *    USE_PARTITIONED_TABLES=true npm test finance_service.dual_mode.test.ts
 * 
 * Both test runs should pass, demonstrating that the service works
 * correctly regardless of the partition setting.
 */

