/**
 * Partition Trigger Tests
 * 
 * Tests for verifying trigger upserts and dual-write parity between
 * legacy and partitioned tables for:
 * - daily_cash_balances / daily_cash_balances_partitioned
 * - revenues / revenues_partitioned
 * - expenses / expenses_partitioned
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { SQLDatabase } from 'encore.dev/storage/sqldb';

// Database instance
const testDB = SQLDatabase.named('hospitality');

describe('Partition Trigger Tests', () => {
  
  /**
   * Helper function to clean up test data
   */
  const cleanupTestData = async (orgId: number) => {
    await testDB.exec`DELETE FROM daily_cash_balances WHERE org_id = ${orgId}`;
    await testDB.exec`DELETE FROM daily_cash_balances_partitioned WHERE org_id = ${orgId}`;
    await testDB.exec`DELETE FROM revenues WHERE org_id = ${orgId}`;
    await testDB.exec`DELETE FROM revenues_partitioned WHERE org_id = ${orgId}`;
    await testDB.exec`DELETE FROM expenses WHERE org_id = ${orgId}`;
    await testDB.exec`DELETE FROM expenses_partitioned WHERE org_id = ${orgId}`;
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

  describe('Daily Cash Balances Trigger - Insert', () => {
    const testOrgId = 999001;
    const testPropertyId = 1;
    const testDate = '2025-10-29';

    beforeEach(async () => {
      await cleanupTestData(testOrgId);
    });

    afterAll(async () => {
      await cleanupTestData(testOrgId);
    });

    it('should sync insert from legacy to partitioned table', async () => {
      // Insert into legacy table
      await testDB.exec`
        INSERT INTO daily_cash_balances (
          org_id, property_id, balance_date,
          opening_balance_cents, cash_received_cents, bank_received_cents,
          cash_expenses_cents, bank_expenses_cents, closing_balance_cents,
          created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, ${testDate},
          10000, 5000, 3000,
          2000, 1000, 15000,
          1, NOW(), NOW()
        )
      `;

      // Verify data exists in partitioned table
      const partitionedRow = await testDB.queryRow<{
        org_id: number;
        property_id: number;
        opening_balance_cents: number;
        closing_balance_cents: number;
      }>`
        SELECT org_id, property_id, opening_balance_cents, closing_balance_cents
        FROM daily_cash_balances_partitioned
        WHERE org_id = ${testOrgId}
          AND property_id = ${testPropertyId}
          AND balance_date = ${testDate}
      `;

      expect(partitionedRow).toBeDefined();
      expect(partitionedRow!.org_id).toBe(testOrgId);
      expect(partitionedRow!.property_id).toBe(testPropertyId);
      expect(partitionedRow!.opening_balance_cents).toBe(10000);
      expect(partitionedRow!.closing_balance_cents).toBe(15000);
    });

    it('should handle upsert on duplicate insert (ON CONFLICT)', async () => {
      // First insert
      await testDB.exec`
        INSERT INTO daily_cash_balances (
          org_id, property_id, balance_date,
          opening_balance_cents, closing_balance_cents,
          created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, ${testDate},
          10000, 15000,
          1, NOW(), NOW()
        )
      `;

      // Second insert with same unique key - should trigger UPDATE
      await testDB.exec`
        INSERT INTO daily_cash_balances (
          org_id, property_id, balance_date,
          opening_balance_cents, closing_balance_cents,
          created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, ${testDate},
          20000, 25000,
          1, NOW(), NOW()
        )
        ON CONFLICT (org_id, property_id, balance_date)
        DO UPDATE SET
          opening_balance_cents = EXCLUDED.opening_balance_cents,
          closing_balance_cents = EXCLUDED.closing_balance_cents,
          updated_at = EXCLUDED.updated_at
      `;

      // Verify only one row exists with updated values
      const rows = await testDB.queryAll<{
        org_id: number;
        opening_balance_cents: number;
        closing_balance_cents: number;
      }>`
        SELECT org_id, opening_balance_cents, closing_balance_cents
        FROM daily_cash_balances_partitioned
        WHERE org_id = ${testOrgId}
          AND property_id = ${testPropertyId}
          AND balance_date = ${testDate}
      `;

      expect(rows).toHaveLength(1);
      expect(rows[0].opening_balance_cents).toBe(20000);
      expect(rows[0].closing_balance_cents).toBe(25000);
    });

    it('should sync update from legacy to partitioned table', async () => {
      // Insert initial data
      await testDB.exec`
        INSERT INTO daily_cash_balances (
          org_id, property_id, balance_date,
          opening_balance_cents, closing_balance_cents,
          created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, ${testDate},
          10000, 15000,
          1, NOW(), NOW()
        )
      `;

      // Update legacy table
      await testDB.exec`
        UPDATE daily_cash_balances
        SET closing_balance_cents = 20000,
            updated_at = NOW()
        WHERE org_id = ${testOrgId}
          AND property_id = ${testPropertyId}
          AND balance_date = ${testDate}
      `;

      // Verify update in partitioned table
      const partitionedRow = await testDB.queryRow<{
        closing_balance_cents: number;
      }>`
        SELECT closing_balance_cents
        FROM daily_cash_balances_partitioned
        WHERE org_id = ${testOrgId}
          AND property_id = ${testPropertyId}
          AND balance_date = ${testDate}
      `;

      expect(partitionedRow!.closing_balance_cents).toBe(20000);
    });
  });

  describe('Revenues Trigger - Insert and Update', () => {
    const testOrgId = 999002;
    const testPropertyId = 1;
    const testOccurredAt = '2025-10-29 10:00:00';

    beforeEach(async () => {
      await cleanupTestData(testOrgId);
    });

    afterAll(async () => {
      await cleanupTestData(testOrgId);
    });

    it('should sync insert from legacy to partitioned revenues table', async () => {
      // Insert into legacy table
      await testDB.exec`
        INSERT INTO revenues (
          org_id, property_id, amount_cents, occurred_at,
          description, category, payment_method, status,
          created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, 50000, ${testOccurredAt},
          'Test Revenue', 'room', 'cash', 'pending',
          1, NOW(), NOW()
        )
      `;

      // Verify data exists in partitioned table
      const partitionedRow = await testDB.queryRow<{
        org_id: number;
        amount_cents: number;
        description: string;
        status: string;
      }>`
        SELECT org_id, amount_cents, description, status
        FROM revenues_partitioned
        WHERE org_id = ${testOrgId}
          AND property_id = ${testPropertyId}
      `;

      expect(partitionedRow).toBeDefined();
      expect(partitionedRow!.org_id).toBe(testOrgId);
      expect(partitionedRow!.amount_cents).toBe(50000);
      expect(partitionedRow!.description).toBe('Test Revenue');
      expect(partitionedRow!.status).toBe('pending');
    });

    it('should handle duplicate insert with ON CONFLICT for revenues', async () => {
      // First insert
      const insertResult1 = await testDB.queryRow<{ id: number }>`
        INSERT INTO revenues (
          org_id, property_id, amount_cents, occurred_at,
          description, status, created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, 50000, ${testOccurredAt},
          'Original Revenue', 'pending', 1, NOW(), NOW()
        )
        RETURNING id
      `;

      const revenueId = insertResult1!.id;

      // Attempt update via INSERT ON CONFLICT (if supported)
      await testDB.exec`
        INSERT INTO revenues (
          id, org_id, property_id, amount_cents, occurred_at,
          description, status, created_by_user_id, created_at, updated_at
        ) VALUES (
          ${revenueId}, ${testOrgId}, ${testPropertyId}, 60000, ${testOccurredAt},
          'Updated Revenue', 'approved', 1, NOW(), NOW()
        )
        ON CONFLICT (id, occurred_at)
        DO UPDATE SET
          amount_cents = EXCLUDED.amount_cents,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at
      `;

      // Verify only one row exists in partitioned table with updated values
      const rows = await testDB.queryAll<{
        amount_cents: number;
        description: string;
        status: string;
      }>`
        SELECT amount_cents, description, status
        FROM revenues_partitioned
        WHERE org_id = ${testOrgId}
          AND property_id = ${testPropertyId}
      `;

      expect(rows).toHaveLength(1);
      expect(rows[0].amount_cents).toBe(60000);
      expect(rows[0].description).toBe('Updated Revenue');
      expect(rows[0].status).toBe('approved');
    });

    it('should sync update from legacy to partitioned revenues table', async () => {
      // Insert initial data
      const insertResult = await testDB.queryRow<{ id: number }>`
        INSERT INTO revenues (
          org_id, property_id, amount_cents, occurred_at,
          description, status, created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, 50000, ${testOccurredAt},
          'Test Revenue', 'pending', 1, NOW(), NOW()
        )
        RETURNING id
      `;

      const revenueId = insertResult!.id;

      // Update legacy table
      await testDB.exec`
        UPDATE revenues
        SET status = 'approved',
            amount_cents = 55000,
            updated_at = NOW()
        WHERE id = ${revenueId}
      `;

      // Verify update in partitioned table
      const partitionedRow = await testDB.queryRow<{
        status: string;
        amount_cents: number;
      }>`
        SELECT status, amount_cents
        FROM revenues_partitioned
        WHERE org_id = ${testOrgId}
          AND property_id = ${testPropertyId}
      `;

      expect(partitionedRow!.status).toBe('approved');
      expect(partitionedRow!.amount_cents).toBe(55000);
    });
  });

  describe('Expenses Trigger - Insert and Update', () => {
    const testOrgId = 999003;
    const testPropertyId = 1;
    const testOccurredAt = '2025-10-29 11:00:00';

    beforeEach(async () => {
      await cleanupTestData(testOrgId);
    });

    afterAll(async () => {
      await cleanupTestData(testOrgId);
    });

    it('should sync insert from legacy to partitioned expenses table', async () => {
      // Insert into legacy table
      await testDB.exec`
        INSERT INTO expenses (
          org_id, property_id, amount_cents, occurred_at,
          description, category, payment_method, vendor_name, status,
          created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, 30000, ${testOccurredAt},
          'Test Expense', 'utilities', 'bank', 'Test Vendor', 'pending',
          1, NOW(), NOW()
        )
      `;

      // Verify data exists in partitioned table
      const partitionedRow = await testDB.queryRow<{
        org_id: number;
        amount_cents: number;
        description: string;
        vendor_name: string;
        status: string;
      }>`
        SELECT org_id, amount_cents, description, vendor_name, status
        FROM expenses_partitioned
        WHERE org_id = ${testOrgId}
          AND property_id = ${testPropertyId}
      `;

      expect(partitionedRow).toBeDefined();
      expect(partitionedRow!.org_id).toBe(testOrgId);
      expect(partitionedRow!.amount_cents).toBe(30000);
      expect(partitionedRow!.description).toBe('Test Expense');
      expect(partitionedRow!.vendor_name).toBe('Test Vendor');
      expect(partitionedRow!.status).toBe('pending');
    });

    it('should handle duplicate insert with ON CONFLICT for expenses', async () => {
      // First insert
      const insertResult1 = await testDB.queryRow<{ id: number }>`
        INSERT INTO expenses (
          org_id, property_id, amount_cents, occurred_at,
          description, status, created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, 30000, ${testOccurredAt},
          'Original Expense', 'pending', 1, NOW(), NOW()
        )
        RETURNING id
      `;

      const expenseId = insertResult1!.id;

      // Attempt update via INSERT ON CONFLICT
      await testDB.exec`
        INSERT INTO expenses (
          id, org_id, property_id, amount_cents, occurred_at,
          description, status, created_by_user_id, created_at, updated_at
        ) VALUES (
          ${expenseId}, ${testOrgId}, ${testPropertyId}, 35000, ${testOccurredAt},
          'Updated Expense', 'approved', 1, NOW(), NOW()
        )
        ON CONFLICT (id, occurred_at)
        DO UPDATE SET
          amount_cents = EXCLUDED.amount_cents,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at
      `;

      // Verify only one row exists in partitioned table with updated values
      const rows = await testDB.queryAll<{
        amount_cents: number;
        description: string;
        status: string;
      }>`
        SELECT amount_cents, description, status
        FROM expenses_partitioned
        WHERE org_id = ${testOrgId}
          AND property_id = ${testPropertyId}
      `;

      expect(rows).toHaveLength(1);
      expect(rows[0].amount_cents).toBe(35000);
      expect(rows[0].description).toBe('Updated Expense');
      expect(rows[0].status).toBe('approved');
    });

    it('should sync update from legacy to partitioned expenses table', async () => {
      // Insert initial data
      const insertResult = await testDB.queryRow<{ id: number }>`
        INSERT INTO expenses (
          org_id, property_id, amount_cents, occurred_at,
          description, status, created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, 30000, ${testOccurredAt},
          'Test Expense', 'pending', 1, NOW(), NOW()
        )
        RETURNING id
      `;

      const expenseId = insertResult!.id;

      // Update legacy table
      await testDB.exec`
        UPDATE expenses
        SET status = 'approved',
            amount_cents = 32000,
            updated_at = NOW()
        WHERE id = ${expenseId}
      `;

      // Verify update in partitioned table
      const partitionedRow = await testDB.queryRow<{
        status: string;
        amount_cents: number;
      }>`
        SELECT status, amount_cents
        FROM expenses_partitioned
        WHERE org_id = ${testOrgId}
          AND property_id = ${testPropertyId}
      `;

      expect(partitionedRow!.status).toBe('approved');
      expect(partitionedRow!.amount_cents).toBe(32000);
    });
  });

  describe('Dual-Write Parity Verification', () => {
    const testOrgId = 999004;
    const testPropertyId = 1;

    afterAll(async () => {
      await cleanupTestData(testOrgId);
    });

    it('should maintain row count parity between legacy and partitioned tables', async () => {
      // Clean up first
      await cleanupTestData(testOrgId);

      // Insert multiple records
      const recordCount = 10;
      
      for (let i = 0; i < recordCount; i++) {
        await testDB.exec`
          INSERT INTO daily_cash_balances (
            org_id, property_id, balance_date,
            opening_balance_cents, closing_balance_cents,
            created_by_user_id, created_at, updated_at
          ) VALUES (
            ${testOrgId}, ${testPropertyId}, ${`2025-10-${i + 1}`},
            ${10000 + i * 1000}, ${15000 + i * 1000},
            1, NOW(), NOW()
          )
        `;
      }

      // Verify counts match
      const legacyCount = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM daily_cash_balances
        WHERE org_id = ${testOrgId}
      `;

      const partitionedCount = await testDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM daily_cash_balances_partitioned
        WHERE org_id = ${testOrgId}
      `;

      expect(legacyCount!.count).toBe(recordCount);
      expect(partitionedCount!.count).toBe(recordCount);
      expect(legacyCount!.count).toBe(partitionedCount!.count);
    });

    it('should maintain data integrity across multiple operations', async () => {
      await cleanupTestData(testOrgId);

      // Perform mixed operations
      // 1. Insert
      await testDB.exec`
        INSERT INTO revenues (
          org_id, property_id, amount_cents, occurred_at,
          description, status, created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, 10000, '2025-10-29 12:00:00',
          'Revenue 1', 'pending', 1, NOW(), NOW()
        )
      `;

      // 2. Another insert
      await testDB.exec`
        INSERT INTO revenues (
          org_id, property_id, amount_cents, occurred_at,
          description, status, created_by_user_id, created_at, updated_at
        ) VALUES (
          ${testOrgId}, ${testPropertyId}, 20000, '2025-10-29 13:00:00',
          'Revenue 2', 'pending', 1, NOW(), NOW()
        )
      `;

      // 3. Update one record
      await testDB.exec`
        UPDATE revenues
        SET status = 'approved'
        WHERE org_id = ${testOrgId}
          AND description = 'Revenue 1'
      `;

      // Verify both tables have same data
      const legacyRows = await testDB.queryAll<{
        amount_cents: number;
        description: string;
        status: string;
      }>`
        SELECT amount_cents, description, status
        FROM revenues
        WHERE org_id = ${testOrgId}
        ORDER BY occurred_at
      `;

      const partitionedRows = await testDB.queryAll<{
        amount_cents: number;
        description: string;
        status: string;
      }>`
        SELECT amount_cents, description, status
        FROM revenues_partitioned
        WHERE org_id = ${testOrgId}
        ORDER BY occurred_at
      `;

      expect(legacyRows).toHaveLength(2);
      expect(partitionedRows).toHaveLength(2);
      
      // Verify first row
      expect(legacyRows[0].amount_cents).toBe(partitionedRows[0].amount_cents);
      expect(legacyRows[0].description).toBe(partitionedRows[0].description);
      expect(legacyRows[0].status).toBe('approved');
      expect(partitionedRows[0].status).toBe('approved');
      
      // Verify second row
      expect(legacyRows[1].amount_cents).toBe(partitionedRows[1].amount_cents);
      expect(legacyRows[1].description).toBe(partitionedRows[1].description);
      expect(legacyRows[1].status).toBe('pending');
      expect(partitionedRows[1].status).toBe('pending');
    });
  });
});

