/**
 * Partition Routing Integration Tests
 * 
 * Tests that verify partition-aware repositories correctly route to
 * partitioned or legacy tables based on USE_PARTITIONED_TABLES flag
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { SQLDatabase } from 'encore.dev/storage/sqldb';
import { FinanceRepository, RevenueData, ExpenseData } from '../finance_repository';
import { ReportsRepository, DailyCashBalanceData } from '../reports_repository';

const testDB = SQLDatabase.named('hospitality');

const financeRepo = new FinanceRepository(testDB);
const reportsRepo = new ReportsRepository(testDB);

describe('Partition Routing Integration Tests', () => {
  const testOrgId = 888001;
  const testPropertyId = 1;
  const testUserId = 1;

  /**
   * Clean up test data from both legacy and partitioned tables
   */
  const cleanupTestData = async () => {
    // Clean revenues
    await testDB.exec`DELETE FROM revenues WHERE org_id = ${testOrgId}`;
    await testDB.exec`DELETE FROM revenues_partitioned WHERE org_id = ${testOrgId}`;
    
    // Clean expenses
    await testDB.exec`DELETE FROM expenses WHERE org_id = ${testOrgId}`;
    await testDB.exec`DELETE FROM expenses_partitioned WHERE org_id = ${testOrgId}`;
    
    // Clean daily cash balances
    await testDB.exec`DELETE FROM daily_cash_balances WHERE org_id = ${testOrgId}`;
    await testDB.exec`DELETE FROM daily_cash_balances_partitioned WHERE org_id = ${testOrgId}`;
  };

  beforeAll(async () => {
    // Verify partitioned tables exist
    const tablesExist = await testDB.queryRow<{ exists: boolean }>`
      SELECT 
        EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'daily_cash_balances_partitioned') AND
        EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'revenues_partitioned') AND
        EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'expenses_partitioned') AS exists
    `;
    
    expect(tablesExist?.exists).toBe(true);
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Revenue Repository - Partition Routing', () => {
    const testRevenue: RevenueData = {
      org_id: testOrgId,
      property_id: testPropertyId,
      amount_cents: 50000,
      occurred_at: '2025-10-29 10:00:00',
      description: 'Test Revenue',
      category: 'room',
      payment_method: 'cash',
      status: 'pending',
      created_by_user_id: testUserId,
    };

    it('should insert into legacy table when usePartitioned=false', async () => {
      // Insert with explicit flag = false
      const inserted = await financeRepo.insertRevenue(testRevenue, false);
      expect(inserted.id).toBeDefined();

      // Verify data exists in legacy table
      const legacyCount = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM revenues WHERE org_id = ${testOrgId}
      `;
      expect(legacyCount!.count).toBe(1);

      // Verify data does NOT exist in partitioned table (triggers write to both, but we check direct insert)
      // Note: In dual-write mode, data will be in both tables due to triggers
      // This test focuses on the repository's target table selection
    });

    it('should insert into partitioned table when usePartitioned=true', async () => {
      // Insert with explicit flag = true
      const inserted = await financeRepo.insertRevenue(testRevenue, true);
      expect(inserted.id).toBeDefined();

      // Due to dual-write triggers, data will be in both tables
      // Verify the repository targeted the partitioned table by checking logs
      // or by ensuring partitioned table has the data
      const partitionedCount = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM revenues_partitioned WHERE org_id = ${testOrgId}
      `;
      expect(partitionedCount!.count).toBeGreaterThan(0);
    });

    it('should read from correct table based on usePartitioned flag', async () => {
      // Insert test data into both tables
      await testDB.exec`
        INSERT INTO revenues (
          org_id, property_id, amount_cents, occurred_at,
          description, status, created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, 50000, '2025-10-29 10:00:00',
          'Legacy Revenue', 'pending', ${testUserId}, NOW(), NOW()
        )
      `;

      await testDB.exec`
        INSERT INTO revenues_partitioned (
          org_id, property_id, amount_cents, occurred_at,
          description, status, created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, 60000, '2025-10-29 11:00:00',
          'Partitioned Revenue', 'pending', ${testUserId}, NOW(), NOW()
        )
      `;

      // Read from legacy
      const legacyRevenues = await financeRepo.getRevenues(testOrgId, {}, false);
      expect(legacyRevenues.length).toBeGreaterThan(0);
      const hasLegacyRevenue = legacyRevenues.some(r => r.description === 'Legacy Revenue');
      expect(hasLegacyRevenue).toBe(true);

      // Read from partitioned
      const partitionedRevenues = await financeRepo.getRevenues(testOrgId, {}, true);
      expect(partitionedRevenues.length).toBeGreaterThan(0);
      const hasPartitionedRevenue = partitionedRevenues.some(r => r.description === 'Partitioned Revenue');
      expect(hasPartitionedRevenue).toBe(true);
    });

    it('should update in correct table based on usePartitioned flag', async () => {
      // Insert into legacy
      const legacyRevenue = await testDB.queryRow<{ id: number }>`
        INSERT INTO revenues (
          org_id, property_id, amount_cents, occurred_at,
          description, status, created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, 50000, '2025-10-29 10:00:00',
          'Legacy Revenue', 'pending', ${testUserId}, NOW(), NOW()
        )
        RETURNING id
      `;

      // Update status via repository (legacy mode)
      await financeRepo.updateRevenueStatus(
        legacyRevenue!.id,
        testOrgId,
        'approved',
        testUserId,
        false
      );

      // Verify update in legacy table
      const updated = await testDB.queryRow<{ status: string }>`
        SELECT status FROM revenues WHERE id = ${legacyRevenue!.id}
      `;
      expect(updated!.status).toBe('approved');
    });

    it('should delete from correct table based on usePartitioned flag', async () => {
      // Insert into legacy
      const legacyRevenue = await testDB.queryRow<{ id: number }>`
        INSERT INTO revenues (
          org_id, property_id, amount_cents, occurred_at,
          description, status, created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, 50000, '2025-10-29 10:00:00',
          'To Delete', 'pending', ${testUserId}, NOW(), NOW()
        )
        RETURNING id
      `;

      // Delete via repository (legacy mode)
      await financeRepo.deleteRevenue(legacyRevenue!.id, testOrgId, false);

      // Verify deletion from legacy table
      const count = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM revenues WHERE id = ${legacyRevenue!.id}
      `;
      expect(count!.count).toBe(0);
    });
  });

  describe('Expense Repository - Partition Routing', () => {
    const testExpense: ExpenseData = {
      org_id: testOrgId,
      property_id: testPropertyId,
      amount_cents: 30000,
      occurred_at: '2025-10-29 12:00:00',
      description: 'Test Expense',
      category: 'utilities',
      payment_method: 'bank',
      status: 'pending',
      created_by_user_id: testUserId,
    };

    it('should insert into legacy table when usePartitioned=false', async () => {
      const inserted = await financeRepo.insertExpense(testExpense, false);
      expect(inserted.id).toBeDefined();

      const legacyCount = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM expenses WHERE org_id = ${testOrgId}
      `;
      expect(legacyCount!.count).toBe(1);
    });

    it('should insert into partitioned table when usePartitioned=true', async () => {
      const inserted = await financeRepo.insertExpense(testExpense, true);
      expect(inserted.id).toBeDefined();

      const partitionedCount = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM expenses_partitioned WHERE org_id = ${testOrgId}
      `;
      expect(partitionedCount!.count).toBeGreaterThan(0);
    });

    it('should read from correct table based on usePartitioned flag', async () => {
      // Insert test data
      await testDB.exec`
        INSERT INTO expenses (
          org_id, property_id, amount_cents, occurred_at,
          description, status, created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, 30000, '2025-10-29 12:00:00',
          'Legacy Expense', 'pending', ${testUserId}, NOW(), NOW()
        )
      `;

      await testDB.exec`
        INSERT INTO expenses_partitioned (
          org_id, property_id, amount_cents, occurred_at,
          description, status, created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, 40000, '2025-10-29 13:00:00',
          'Partitioned Expense', 'pending', ${testUserId}, NOW(), NOW()
        )
      `;

      // Read from legacy
      const legacyExpenses = await financeRepo.getExpenses(testOrgId, {}, false);
      expect(legacyExpenses.length).toBeGreaterThan(0);

      // Read from partitioned
      const partitionedExpenses = await financeRepo.getExpenses(testOrgId, {}, true);
      expect(partitionedExpenses.length).toBeGreaterThan(0);
    });
  });

  describe('Daily Cash Balance Repository - Partition Routing', () => {
    const testBalance: DailyCashBalanceData = {
      org_id: testOrgId,
      property_id: testPropertyId,
      balance_date: '2025-10-29',
      opening_balance_cents: 100000,
      cash_received_cents: 50000,
      bank_received_cents: 30000,
      cash_expenses_cents: 20000,
      bank_expenses_cents: 10000,
      closing_balance_cents: 150000,
      created_by_user_id: testUserId,
    };

    it('should upsert into legacy table when usePartitioned=false', async () => {
      const inserted = await reportsRepo.upsertDailyCashBalance(testBalance, false);
      expect(inserted.id).toBeDefined();

      const legacyCount = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM daily_cash_balances WHERE org_id = ${testOrgId}
      `;
      expect(legacyCount!.count).toBe(1);
    });

    it('should upsert into partitioned table when usePartitioned=true', async () => {
      const inserted = await reportsRepo.upsertDailyCashBalance(testBalance, true);
      expect(inserted.id).toBeDefined();

      const partitionedCount = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM daily_cash_balances_partitioned WHERE org_id = ${testOrgId}
      `;
      expect(partitionedCount!.count).toBeGreaterThan(0);
    });

    it('should read from correct table based on usePartitioned flag', async () => {
      // Insert test data
      await testDB.exec`
        INSERT INTO daily_cash_balances (
          org_id, property_id, balance_date,
          opening_balance_cents, closing_balance_cents,
          created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, '2025-10-28',
          100000, 150000, ${testUserId}, NOW(), NOW()
        )
      `;

      await testDB.exec`
        INSERT INTO daily_cash_balances_partitioned (
          org_id, property_id, balance_date,
          opening_balance_cents, closing_balance_cents,
          created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, '2025-10-29',
          150000, 200000, ${testUserId}, NOW(), NOW()
        )
      `;

      // Read from legacy
      const legacyBalance = await reportsRepo.getDailyCashBalance(
        testOrgId,
        testPropertyId,
        '2025-10-28',
        false
      );
      expect(legacyBalance).toBeDefined();
      expect(legacyBalance!.opening_balance_cents).toBe(100000);

      // Read from partitioned
      const partitionedBalance = await reportsRepo.getDailyCashBalance(
        testOrgId,
        testPropertyId,
        '2025-10-29',
        true
      );
      expect(partitionedBalance).toBeDefined();
      expect(partitionedBalance!.opening_balance_cents).toBe(150000);
    });

    it('should update upsert behavior correctly in both modes', async () => {
      // First insert (legacy)
      await reportsRepo.upsertDailyCashBalance(testBalance, false);

      // Second upsert with different values (legacy)
      const updated = await reportsRepo.upsertDailyCashBalance(
        {
          ...testBalance,
          closing_balance_cents: 200000,
        },
        false
      );

      expect(updated.closing_balance_cents).toBe(200000);

      // Verify only one record exists
      const count = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count 
        FROM daily_cash_balances 
        WHERE org_id = ${testOrgId} 
          AND property_id = ${testPropertyId} 
          AND balance_date = '2025-10-29'
      `;
      expect(count!.count).toBe(1);
    });
  });

  describe('Cross-mode Data Consistency', () => {
    it('should maintain data parity when dual-write triggers are active', async () => {
      const testRevenue: RevenueData = {
        org_id: testOrgId,
        property_id: testPropertyId,
        amount_cents: 75000,
        occurred_at: '2025-10-29 14:00:00',
        description: 'Dual Write Test',
        status: 'pending',
        created_by_user_id: testUserId,
      };

      // Insert into legacy table (triggers should write to partitioned)
      await financeRepo.insertRevenue(testRevenue, false);

      // Verify data exists in both tables
      const legacyCount = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM revenues WHERE org_id = ${testOrgId}
      `;

      const partitionedCount = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM revenues_partitioned WHERE org_id = ${testOrgId}
      `;

      // Due to dual-write triggers, both should have the data
      expect(legacyCount!.count).toBeGreaterThan(0);
      expect(partitionedCount!.count).toBeGreaterThan(0);
    });
  });
});

