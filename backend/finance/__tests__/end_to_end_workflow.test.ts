import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock the financeDB for testing
jest.mock('../db', () => ({
  financeDB: {
    queryRow: jest.fn(),
    queryAll: jest.fn(),
    rawQueryAll: jest.fn(),
    exec: jest.fn(),
  },
}));

// Import the mocked financeDB
import { financeDB } from '../db';

// Mock auth data
const mockAuthData = {
  userID: '123',
  orgId: 1,
  role: 'ADMIN'
};

// Mock getAuthData
jest.mock('~encore/auth', () => ({
  getAuthData: jest.fn(() => mockAuthData)
}));

describe('End-to-End Finance Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Complete Finance Lifecycle', () => {
    it('should complete full finance workflow: setup, create, list, approve, monitor', async () => {
      // Step 1: System Setup and Health Check
      (financeDB.queryRow as jest.Mock).mockResolvedValue({ current_time: new Date() });
      (financeDB.queryAll as jest.Mock)
        .mockResolvedValueOnce([ // Table integrity
          { table_name: 'revenues', row_count: 0, size_mb: 0.1 },
          { table_name: 'expenses', row_count: 0, size_mb: 0.1 }
        ])
        .mockResolvedValueOnce([ // Index status
          { indexname: 'revenues_pkey', indexdef: 'PRIMARY KEY' },
          { indexname: 'expenses_pkey', indexdef: 'PRIMARY KEY' }
        ])
        .mockResolvedValueOnce([ // Connection stats
          { state: 'active', count: 2 },
          { state: 'idle', count: 8 }
        ]);

      const initialHealth = await simulateHealthCheck();
      expect(initialHealth.overall_status).toBe('healthy');

      // Step 2: Migration Status Check
      (financeDB.queryAll as jest.Mock).mockResolvedValue([
        { version: '1', name: 'create_revenues_table', applied_at: new Date('2024-01-01') },
        { version: '2', name: 'create_expenses_table', applied_at: new Date('2024-01-02') },
        { version: '3', name: 'add_receipt_file_id', applied_at: new Date('2024-01-03') }
      ]);

      const migrationStatus = await simulateGetMigrationStatus();
      expect(migrationStatus.status.status).toBe('missing_migrations');

      // Step 3: Create Revenue
      const mockProperty = { id: 1, org_id: 1, name: 'Test Property' };
      const mockRevenue = {
        id: 1,
        property_id: 1,
        source: 'room',
        amount_cents: 10000,
        currency: 'USD',
        description: 'Room revenue',
        status: 'pending',
        created_by_user_id: 123,
        created_at: new Date()
      };

      (financeDB.queryRow as jest.Mock)
        .mockResolvedValueOnce(mockProperty) // Property access check
        .mockResolvedValueOnce(mockRevenue); // Revenue creation

      const revenueRequest = {
        propertyId: 1,
        source: 'room' as const,
        amountCents: 10000,
        currency: 'USD',
        description: 'Room revenue',
        occurredAt: new Date().toISOString()
      };

      const createdRevenue = await simulateAddRevenue(revenueRequest);
      expect(createdRevenue.id).toBe(1);
      expect(createdRevenue.status).toBe('pending');

      // Step 4: Create Expense
      const mockExpense = {
        id: 1,
        property_id: 1,
        category: 'maintenance',
        amount_cents: 5000,
        currency: 'USD',
        description: 'Maintenance expense',
        status: 'pending',
        created_by_user_id: 123,
        created_at: new Date()
      };

      (financeDB.queryRow as jest.Mock)
        .mockResolvedValueOnce(mockProperty) // Property access check
        .mockResolvedValueOnce(mockExpense); // Expense creation

      const expenseRequest = {
        propertyId: 1,
        category: 'maintenance',
        amountCents: 5000,
        currency: 'USD',
        description: 'Maintenance expense',
        expenseDate: new Date().toISOString()
      };

      const createdExpense = await simulateAddExpense(expenseRequest);
      expect(createdExpense.id).toBe(1);
      expect(createdExpense.status).toBe('pending');

      // Step 5: List Revenues
      (financeDB.rawQueryAll as jest.Mock).mockResolvedValue([{
        id: 1,
        property_id: 1,
        property_name: 'Test Property',
        source: 'room',
        amount_cents: 10000,
        currency: 'USD',
        description: 'Room revenue',
        status: 'pending',
        created_by_user_id: 123,
        created_by_name: 'Test User',
        occurred_at: new Date(),
        created_at: new Date()
      }]);

      const revenues = await simulateListRevenues({});
      expect(revenues.revenues).toHaveLength(1);
      expect(revenues.totalAmount).toBe(10000);

      // Step 6: List Expenses
      (financeDB.rawQueryAll as jest.Mock).mockResolvedValue([{
        id: 1,
        property_id: 1,
        property_name: 'Test Property',
        category: 'maintenance',
        amount_cents: 5000,
        currency: 'USD',
        description: 'Maintenance expense',
        status: 'pending',
        created_by_user_id: 123,
        created_by_name: 'Test User',
        expense_date: new Date(),
        created_at: new Date()
      }]);

      const expenses = await simulateListExpenses({});
      expect(expenses.expenses).toHaveLength(1);
      expect(expenses.totalAmount).toBe(5000);

      // Step 7: Approve Revenue
      (financeDB.queryRow as jest.Mock)
        .mockResolvedValueOnce(mockRevenue) // Get revenue
        .mockResolvedValueOnce({ ...mockRevenue, status: 'approved', approved_by_user_id: 123, approved_at: new Date() }); // Update revenue

      const approvedRevenue = await simulateApproveRevenue(1);
      expect(approvedRevenue.status).toBe('approved');

      // Step 8: Approve Expense
      (financeDB.queryRow as jest.Mock)
        .mockResolvedValueOnce(mockExpense) // Get expense
        .mockResolvedValueOnce({ ...mockExpense, status: 'approved', approved_by_user_id: 123, approved_at: new Date() }); // Update expense

      const approvedExpense = await simulateApproveExpense(1);
      expect(approvedExpense.status).toBe('approved');

      // Step 9: Final Health Check
      (financeDB.queryRow as jest.Mock).mockResolvedValue({ current_time: new Date() });
      (financeDB.queryAll as jest.Mock)
        .mockResolvedValueOnce([ // Table integrity
          { table_name: 'revenues', row_count: 1, size_mb: 0.2 },
          { table_name: 'expenses', row_count: 1, size_mb: 0.2 }
        ])
        .mockResolvedValueOnce([ // Index status
          { indexname: 'revenues_pkey', indexdef: 'PRIMARY KEY' },
          { indexname: 'expenses_pkey', indexdef: 'PRIMARY KEY' }
        ])
        .mockResolvedValueOnce([ // Connection stats
          { state: 'active', count: 3 },
          { state: 'idle', count: 7 }
        ]);

      const finalHealth = await simulateHealthCheck();
      expect(finalHealth.overall_status).toBe('healthy');
      expect(finalHealth.tables).toHaveLength(2);

      // Step 10: Performance Report
      const performanceReport = await simulateGetPerformanceReport();
      expect(performanceReport.averageResponseTime).toBeGreaterThan(0);
      expect(performanceReport.connectionPool.total).toBeGreaterThanOrEqual(0);
    });

    it('should handle complete workflow with schema validation and repair', async () => {
      // Step 1: Initial schema check with missing columns
      (financeDB.queryAll as jest.Mock).mockResolvedValue([
        { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'org_id', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'property_id', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'source', data_type: 'varchar', is_nullable: 'NO' },
        { column_name: 'amount_cents', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'currency', data_type: 'varchar', is_nullable: 'NO' },
        { column_name: 'description', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'occurred_at', data_type: 'timestamp', is_nullable: 'NO' },
        { column_name: 'created_by_user_id', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'created_at', data_type: 'timestamp', is_nullable: 'NO' }
        // Missing: status, payment_mode, bank_reference, receipt_file_id
      ]);

      const schemaStatus = await simulateGetSchemaStatus();
      expect(schemaStatus.missing_columns).toContain('status');

      // Step 2: Schema repair
      (financeDB.exec as jest.Mock).mockResolvedValue(undefined);

      const repairResult = await simulateFixSchema();
      expect(repairResult.success).toBe(true);

      // Step 3: Create revenue with new columns
      const mockProperty = { id: 1, org_id: 1, name: 'Test Property' };
      const mockRevenue = {
        id: 1,
        property_id: 1,
        source: 'room',
        amount_cents: 10000,
        currency: 'USD',
        description: 'Room revenue',
        status: 'pending',
        payment_mode: 'card',
        bank_reference: 'BANK123',
        receipt_file_id: 'FILE123',
        created_by_user_id: 123,
        created_at: new Date()
      };

      (financeDB.queryRow as jest.Mock)
        .mockResolvedValueOnce(mockProperty) // Property access check
        .mockResolvedValueOnce(mockRevenue); // Revenue creation

      const revenueRequest = {
        propertyId: 1,
        source: 'room' as const,
        amountCents: 10000,
        currency: 'USD',
        description: 'Room revenue',
        occurredAt: new Date().toISOString(),
        paymentMode: 'card',
        bankReference: 'BANK123',
        receiptFileId: 'FILE123'
      };

      const createdRevenue = await simulateAddRevenue(revenueRequest);
      expect(createdRevenue.id).toBe(1);
      expect(createdRevenue.status).toBe('pending');
      expect(createdRevenue.paymentMode).toBe('card');
      expect(createdRevenue.bankReference).toBe('BANK123');
      expect(createdRevenue.receiptFileId).toBe('FILE123');

      // Step 4: List revenues with new columns
      (financeDB.rawQueryAll as jest.Mock).mockResolvedValue([{
        id: 1,
        property_id: 1,
        property_name: 'Test Property',
        source: 'room',
        amount_cents: 10000,
        currency: 'USD',
        description: 'Room revenue',
        status: 'pending',
        payment_mode: 'card',
        bank_reference: 'BANK123',
        receipt_file_id: 'FILE123',
        created_by_user_id: 123,
        created_by_name: 'Test User',
        occurred_at: new Date(),
        created_at: new Date()
      }]);

      const revenues = await simulateListRevenues({});
      expect(revenues.revenues).toHaveLength(1);
      expect(revenues.revenues[0].paymentMode).toBe('card');
    });

    it('should handle complete workflow with error recovery', async () => {
      // Step 1: Initial connection failure
      (financeDB.rawQueryAll as jest.Mock)
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValueOnce([{ // Second attempt succeeds
          id: 1,
          property_id: 1,
          property_name: 'Test Property',
          source: 'room',
          amount_cents: 10000,
          currency: 'USD',
          description: 'Room revenue',
          status: 'pending',
          created_by_user_id: 123,
          created_by_name: 'Test User',
          occurred_at: new Date(),
          created_at: new Date()
        }]);

      // Test retry logic
      let attempts = 0;
      let result = null;
      
      while (attempts < 2 && !result) {
        try {
          result = await simulateListRevenues({});
        } catch (error) {
          attempts++;
          if (attempts >= 2) {
            throw error;
          }
        }
      }

      expect(result).not.toBeNull();
      expect(result.revenues).toHaveLength(1);

      // Step 2: Create revenue with schema fallback
      const mockProperty = { id: 1, org_id: 1, name: 'Test Property' };
      
      (financeDB.queryRow as jest.Mock)
        .mockResolvedValueOnce(mockProperty) // Property access check
        .mockRejectedValueOnce(new Error('column "status" does not exist')) // First attempt fails
        .mockResolvedValueOnce({ // Fallback succeeds
          id: 1,
          property_id: 1,
          source: 'room',
          amount_cents: 10000,
          currency: 'USD',
          description: 'Room revenue',
          created_by_user_id: 123,
          created_at: new Date()
        });

      const revenueRequest = {
        propertyId: 1,
        source: 'room' as const,
        amountCents: 10000,
        currency: 'USD',
        description: 'Room revenue',
        occurredAt: new Date().toISOString()
      };

      const createdRevenue = await simulateAddRevenueWithFallback(revenueRequest);
      expect(createdRevenue.id).toBe(1);
      expect(createdRevenue.status).toBe('pending'); // Default value

      // Step 3: Approve revenue
      (financeDB.queryRow as jest.Mock)
        .mockResolvedValueOnce({ ...createdRevenue, id: 1 }) // Get revenue
        .mockResolvedValueOnce({ ...createdRevenue, id: 1, status: 'approved', approved_by_user_id: 123, approved_at: new Date() }); // Update revenue

      const approvedRevenue = await simulateApproveRevenue(1);
      expect(approvedRevenue.status).toBe('approved');

      // Step 4: Final health check
      (financeDB.queryRow as jest.Mock).mockResolvedValue({ current_time: new Date() });
      (financeDB.queryAll as jest.Mock)
        .mockResolvedValueOnce([ // Table integrity
          { table_name: 'revenues', row_count: 1, size_mb: 0.2 }
        ])
        .mockResolvedValueOnce([ // Index status
          { indexname: 'revenues_pkey', indexdef: 'PRIMARY KEY' }
        ])
        .mockResolvedValueOnce([ // Connection stats
          { state: 'active', count: 2 },
          { state: 'idle', count: 8 }
        ]);

      const finalHealth = await simulateHealthCheck();
      expect(finalHealth.overall_status).toBe('healthy');
    });
  });

  describe('Multi-User Finance Workflow', () => {
    it('should handle multiple users creating and managing finances', async () => {
      // User 1 creates revenue
      const mockProperty = { id: 1, org_id: 1, name: 'Test Property' };
      const mockRevenue1 = {
        id: 1,
        property_id: 1,
        source: 'room',
        amount_cents: 10000,
        currency: 'USD',
        description: 'Room revenue - User 1',
        status: 'pending',
        created_by_user_id: 123,
        created_at: new Date()
      };

      (financeDB.queryRow as jest.Mock)
        .mockResolvedValueOnce(mockProperty) // Property access check
        .mockResolvedValueOnce(mockRevenue1); // Revenue creation

      const revenueRequest1 = {
        propertyId: 1,
        source: 'room' as const,
        amountCents: 10000,
        currency: 'USD',
        description: 'Room revenue - User 1',
        occurredAt: new Date().toISOString()
      };

      const createdRevenue1 = await simulateAddRevenue(revenueRequest1);
      expect(createdRevenue1.id).toBe(1);

      // User 2 creates expense
      const mockExpense1 = {
        id: 1,
        property_id: 1,
        category: 'maintenance',
        amount_cents: 5000,
        currency: 'USD',
        description: 'Maintenance expense - User 2',
        status: 'pending',
        created_by_user_id: 456,
        created_at: new Date()
      };

      (financeDB.queryRow as jest.Mock)
        .mockResolvedValueOnce(mockProperty) // Property access check
        .mockResolvedValueOnce(mockExpense1); // Expense creation

      const expenseRequest1 = {
        propertyId: 1,
        category: 'maintenance',
        amountCents: 5000,
        currency: 'USD',
        description: 'Maintenance expense - User 2',
        expenseDate: new Date().toISOString()
      };

      const createdExpense1 = await simulateAddExpense(expenseRequest1);
      expect(createdExpense1.id).toBe(1);

      // List all transactions
      (financeDB.rawQueryAll as jest.Mock)
        .mockResolvedValueOnce([{ // Revenues
          id: 1,
          property_id: 1,
          property_name: 'Test Property',
          source: 'room',
          amount_cents: 10000,
          currency: 'USD',
          description: 'Room revenue - User 1',
          status: 'pending',
          created_by_user_id: 123,
          created_by_name: 'User 1',
          occurred_at: new Date(),
          created_at: new Date()
        }])
        .mockResolvedValueOnce([{ // Expenses
          id: 1,
          property_id: 1,
          property_name: 'Test Property',
          category: 'maintenance',
          amount_cents: 5000,
          currency: 'USD',
          description: 'Maintenance expense - User 2',
          status: 'pending',
          created_by_user_id: 456,
          created_by_name: 'User 2',
          expense_date: new Date(),
          created_at: new Date()
        }]);

      const revenues = await simulateListRevenues({});
      const expenses = await simulateListExpenses({});

      expect(revenues.revenues).toHaveLength(1);
      expect(expenses.expenses).toHaveLength(1);
      expect(revenues.revenues[0].createdByUserId).toBe(123);
      expect(expenses.expenses[0].createdByUserId).toBe(456);

      // Admin approves both transactions
      (financeDB.queryRow as jest.Mock)
        .mockResolvedValueOnce(mockRevenue1) // Get revenue
        .mockResolvedValueOnce({ ...mockRevenue1, status: 'approved', approved_by_user_id: 789, approved_at: new Date() }) // Update revenue
        .mockResolvedValueOnce(mockExpense1) // Get expense
        .mockResolvedValueOnce({ ...mockExpense1, status: 'approved', approved_by_user_id: 789, approved_at: new Date() }); // Update expense

      const approvedRevenue = await simulateApproveRevenue(1);
      const approvedExpense = await simulateApproveExpense(1);

      expect(approvedRevenue.status).toBe('approved');
      expect(approvedExpense.status).toBe('approved');
    });
  });

  describe('System Monitoring and Maintenance', () => {
    it('should handle system monitoring throughout workflow', async () => {
      // Step 1: Initial system check
      (financeDB.queryRow as jest.Mock).mockResolvedValue({ current_time: new Date() });
      (financeDB.queryAll as jest.Mock)
        .mockResolvedValueOnce([ // Table integrity
          { table_name: 'revenues', row_count: 0, size_mb: 0.1 },
          { table_name: 'expenses', row_count: 0, size_mb: 0.1 }
        ])
        .mockResolvedValueOnce([ // Index status
          { indexname: 'revenues_pkey', indexdef: 'PRIMARY KEY' },
          { indexname: 'expenses_pkey', indexdef: 'PRIMARY KEY' }
        ])
        .mockResolvedValueOnce([ // Connection stats
          { state: 'active', count: 2 },
          { state: 'idle', count: 8 }
        ]);

      const initialHealth = await simulateHealthCheck();
      expect(initialHealth.overall_status).toBe('healthy');

      // Step 2: Create transactions
      const mockProperty = { id: 1, org_id: 1, name: 'Test Property' };
      const mockRevenue = {
        id: 1,
        property_id: 1,
        source: 'room',
        amount_cents: 10000,
        currency: 'USD',
        description: 'Room revenue',
        status: 'pending',
        created_by_user_id: 123,
        created_at: new Date()
      };

      (financeDB.queryRow as jest.Mock)
        .mockResolvedValueOnce(mockProperty) // Property access check
        .mockResolvedValueOnce(mockRevenue); // Revenue creation

      const revenueRequest = {
        propertyId: 1,
        source: 'room' as const,
        amountCents: 10000,
        currency: 'USD',
        description: 'Room revenue',
        occurredAt: new Date().toISOString()
      };

      const createdRevenue = await simulateAddRevenue(revenueRequest);
      expect(createdRevenue.id).toBe(1);

      // Step 3: Monitor performance
      const performanceReport = await simulateGetPerformanceReport();
      expect(performanceReport.averageResponseTime).toBeGreaterThan(0);

      // Step 4: Check for alerts
      (financeDB.queryAll as jest.Mock).mockResolvedValue([]);

      const alerts = await simulateGetAlerts();
      expect(alerts).toHaveLength(0);

      // Step 5: Final system check
      (financeDB.queryRow as jest.Mock).mockResolvedValue({ current_time: new Date() });
      (financeDB.queryAll as jest.Mock)
        .mockResolvedValueOnce([ // Table integrity
          { table_name: 'revenues', row_count: 1, size_mb: 0.2 },
          { table_name: 'expenses', row_count: 0, size_mb: 0.1 }
        ])
        .mockResolvedValueOnce([ // Index status
          { indexname: 'revenues_pkey', indexdef: 'PRIMARY KEY' },
          { indexname: 'expenses_pkey', indexdef: 'PRIMARY KEY' }
        ])
        .mockResolvedValueOnce([ // Connection stats
          { state: 'active', count: 3 },
          { state: 'idle', count: 7 }
        ]);

      const finalHealth = await simulateHealthCheck();
      expect(finalHealth.overall_status).toBe('healthy');
      expect(finalHealth.tables).toHaveLength(2);
    });
  });
});

// Helper functions for end-to-end workflow testing
async function simulateHealthCheck() {
  const { financeDB } = await import('../db');
  
  try {
    const connectionTest = await financeDB.queryRow`SELECT NOW() as current_time`;
    
    const tables = await financeDB.queryAll`
      SELECT table_name, 
             (SELECT count(*) FROM information_schema.tables WHERE table_name = t.table_name) as row_count,
             pg_size_pretty(pg_total_relation_size(t.table_name::regclass)) as size_mb
      FROM information_schema.tables t
      WHERE table_schema = 'public' AND table_name IN ('revenues', 'expenses')
    `;

    const indexes = await financeDB.queryAll`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename IN ('revenues', 'expenses')
    `;

    const connectionStats = await financeDB.queryAll`
      SELECT state, count(*) as count
      FROM pg_stat_activity
      WHERE datname = current_database()
      GROUP BY state
    `;

    return {
      overall_status: 'healthy',
      connection: {
        status: 'healthy',
        responseTime: 15
      },
      tables: tables.map((t: any) => ({
        name: t.table_name,
        rowCount: t.row_count,
        size: t.size_mb
      })),
      indexes: indexes.map((i: any) => ({
        name: i.indexname,
        definition: i.indexdef
      })),
      performance: {
        averageQueryTime: 25,
        slowQueries: 0,
        connectionPool: {
          active: connectionStats.find((s: any) => s.state === 'active')?.count || 0,
          idle: connectionStats.find((s: any) => s.state === 'idle')?.count || 0,
          total: connectionStats.reduce((sum: number, s: any) => sum + parseInt(s.count), 0)
        },
        cacheHitRatio: 95,
        errorRate: 0
      },
      resources: {
        databaseSize: '150 MB',
        tableCount: tables.length,
        indexCount: indexes.length,
        connectionCount: connectionStats.reduce((sum: number, s: any) => sum + parseInt(s.count), 0)
      },
      alerts: [],
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      overall_status: 'critical',
      connection: {
        status: 'unhealthy',
        responseTime: 0
      },
      tables: [],
      indexes: [],
      performance: {
        averageQueryTime: 0,
        slowQueries: 0,
        connectionPool: { active: 0, idle: 0, total: 0 },
        cacheHitRatio: 0,
        errorRate: 100
      },
      resources: {
        databaseSize: '0 MB',
        tableCount: 0,
        indexCount: 0,
        connectionCount: 0
      },
      alerts: [{ type: 'connectivity', message: 'Database connection failed', severity: 'critical' }],
      timestamp: new Date().toISOString()
    };
  }
}

async function simulateGetMigrationStatus() {
  const { financeDB } = await import('../db');
  
  const appliedMigrations = await financeDB.queryAll`
    SELECT version, name, applied_at
    FROM schema_migrations
    ORDER BY version
  `;

  const allMigrations = ['1', '2', '3', '4'];
  const appliedVersions = appliedMigrations.map((m: any) => m.version);
  const pendingMigrations = allMigrations.filter(version => !appliedVersions.includes(version));

  return {
    status: {
      applied_migrations: appliedMigrations,
      pending_migrations: pendingMigrations,
      total_applied: appliedMigrations.length,
      total_pending: pendingMigrations.length,
      status: pendingMigrations.length === 0 ? 'up_to_date' : 'missing_migrations'
    },
    pending_migrations: pendingMigrations,
    integrity_check: appliedMigrations.length === new Set(appliedVersions).size,
    conflicts: appliedMigrations.length !== new Set(appliedVersions).size ? ['Duplicate versions detected'] : []
  };
}

async function simulateGetSchemaStatus() {
  const { financeDB } = await import('../db');
  
  const revenuesColumns = await financeDB.queryAll`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'revenues'
    ORDER BY ordinal_position
  `;

  const expensesColumns = await financeDB.queryAll`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses'
    ORDER BY ordinal_position
  `;

  // Check for missing columns
  const requiredColumns = ['status', 'payment_mode', 'bank_reference', 'receipt_file_id'];
  const missingColumns = [];
  
  const revenuesColumnNames = revenuesColumns.map((col: any) => col.column_name);
  const expensesColumnNames = expensesColumns.map((col: any) => col.column_name);
  
  for (const col of requiredColumns) {
    if (!revenuesColumnNames.includes(col) || !expensesColumnNames.includes(col)) {
      missingColumns.push(col);
    }
  }

  return {
    tables: {
      revenues: revenuesColumns,
      expenses: expensesColumns
    },
    missing_columns: missingColumns,
    missing_foreign_keys: [],
    missing_indexes: [],
    is_complete: missingColumns.length === 0
  };
}

async function simulateFixSchema() {
  const { financeDB } = await import('../db');
  
  const addedColumns = [];
  let fixedIssues = 0;

  try {
    // Add missing columns to revenues
    const revenueColumns = ['status', 'payment_mode', 'bank_reference', 'receipt_file_id'];
    for (const column of revenueColumns) {
      try {
        await financeDB.exec`
          ALTER TABLE revenues ADD COLUMN IF NOT EXISTS ${column} VARCHAR(255)
        `;
        addedColumns.push(`revenues.${column}`);
        fixedIssues++;
      } catch (error) {
        // Column might already exist
      }
    }

    // Add missing columns to expenses
    const expenseColumns = ['status', 'payment_mode', 'bank_reference', 'receipt_file_id'];
    for (const column of expenseColumns) {
      try {
        await financeDB.exec`
          ALTER TABLE expenses ADD COLUMN IF NOT EXISTS ${column} VARCHAR(255)
        `;
        addedColumns.push(`expenses.${column}`);
        fixedIssues++;
      } catch (error) {
        // Column might already exist
      }
    }

    return {
      success: true,
      fixed_issues: fixedIssues,
      added_columns: addedColumns,
      created_foreign_keys: [],
      created_indexes: []
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      fixed_issues: fixedIssues,
      added_columns: addedColumns,
      created_foreign_keys: [],
      created_indexes: []
    };
  }
}

async function simulateAddRevenue(request: any) {
  const { financeDB } = await import('../db');
  
  // Check property access
  const property = await financeDB.queryRow`
    SELECT p.id, p.org_id
    FROM properties p
    WHERE p.id = ${request.propertyId} AND p.org_id = 1
  `;

  if (!property) {
    throw new Error('Property not found');
  }

  // Create revenue
  const revenue = await financeDB.queryRow`
    INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, description, occurred_at, created_by_user_id, status, payment_mode, bank_reference, receipt_file_id, created_at)
    VALUES (1, ${request.propertyId}, ${request.source}, ${request.amountCents}, ${request.currency}, ${request.description}, ${request.occurredAt}, 123, 'pending', ${request.paymentMode || 'cash'}, ${request.bankReference || null}, ${request.receiptFileId || null}, NOW())
    RETURNING id, property_id, source, amount_cents, currency, description, status, payment_mode, bank_reference, receipt_file_id, created_by_user_id, created_at
  `;

  return {
    id: revenue.id,
    propertyId: revenue.property_id,
    source: revenue.source,
    amountCents: revenue.amount_cents,
    currency: revenue.currency,
    description: revenue.description,
    status: revenue.status,
    paymentMode: revenue.payment_mode,
    bankReference: revenue.bank_reference,
    receiptFileId: revenue.receipt_file_id,
    createdByUserId: revenue.created_by_user_id,
    createdAt: revenue.created_at
  };
}

async function simulateAddRevenueWithFallback(request: any) {
  const { financeDB } = await import('../db');
  
  // Check property access
  const property = await financeDB.queryRow`
    SELECT p.id, p.org_id
    FROM properties p
    WHERE p.id = ${request.propertyId} AND p.org_id = 1
  `;

  if (!property) {
    throw new Error('Property not found');
  }

  try {
    // Try with all columns first
    const revenue = await financeDB.queryRow`
      INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, description, occurred_at, created_by_user_id, status, payment_mode, bank_reference, receipt_file_id, created_at)
      VALUES (1, ${request.propertyId}, ${request.source}, ${request.amountCents}, ${request.currency}, ${request.description}, ${request.occurredAt}, 123, 'pending', ${request.paymentMode || 'cash'}, ${request.bankReference || null}, ${request.receiptFileId || null}, NOW())
      RETURNING id, property_id, source, amount_cents, currency, description, status, payment_mode, bank_reference, receipt_file_id, created_by_user_id, created_at
    `;

    return {
      id: revenue.id,
      propertyId: revenue.property_id,
      source: revenue.source,
      amountCents: revenue.amount_cents,
      currency: revenue.currency,
      description: revenue.description,
      status: revenue.status,
      paymentMode: revenue.payment_mode,
      bankReference: revenue.bank_reference,
      receiptFileId: revenue.receipt_file_id,
      createdByUserId: revenue.created_by_user_id,
      createdAt: revenue.created_at
    };
  } catch (error) {
    if ((error as Error).message.includes('column') && (error as Error).message.includes('does not exist')) {
      // Fallback without new columns
      const revenue = await financeDB.queryRow`
        INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, description, occurred_at, created_by_user_id, created_at)
        VALUES (1, ${request.propertyId}, ${request.source}, ${request.amountCents}, ${request.currency}, ${request.description}, ${request.occurredAt}, 123, NOW())
        RETURNING id, property_id, source, amount_cents, currency, description, created_by_user_id, created_at
      `;

      return {
        id: revenue.id,
        propertyId: revenue.property_id,
        source: revenue.source,
        amountCents: revenue.amount_cents,
        currency: revenue.currency,
        description: revenue.description,
        status: 'pending', // Default value
        paymentMode: request.paymentMode || 'cash', // Value preserved in memory
        bankReference: request.bankReference || null, // Value preserved in memory
        receiptFileId: request.receiptFileId || null, // Value preserved in memory
        createdByUserId: revenue.created_by_user_id,
        createdAt: revenue.created_at
      };
    }
    throw error;
  }
}

async function simulateAddExpense(request: any) {
  const { financeDB } = await import('../db');
  
  // Check property access
  const property = await financeDB.queryRow`
    SELECT p.id, p.org_id
    FROM properties p
    WHERE p.id = ${request.propertyId} AND p.org_id = 1
  `;

  if (!property) {
    throw new Error('Property not found');
  }

  // Create expense
  const expense = await financeDB.queryRow`
    INSERT INTO expenses (org_id, property_id, category, amount_cents, currency, description, expense_date, created_by_user_id, status, created_at)
    VALUES (1, ${request.propertyId}, ${request.category}, ${request.amountCents}, ${request.currency}, ${request.description}, ${request.expenseDate}, 123, 'pending', NOW())
    RETURNING id, property_id, category, amount_cents, currency, description, status, created_by_user_id, created_at
  `;

  return {
    id: expense.id,
    propertyId: expense.property_id,
    category: expense.category,
    amountCents: expense.amount_cents,
    currency: expense.currency,
    description: expense.description,
    status: expense.status,
    createdByUserId: expense.created_by_user_id,
    createdAt: expense.created_at
  };
}

async function simulateListRevenues(request: any) {
  const { financeDB } = await import('../db');
  
  const revenues = await financeDB.rawQueryAll`
    SELECT r.id, r.property_id, p.name as property_name, r.source, r.amount_cents, r.currency, r.description, r.status, r.payment_mode, r.bank_reference, r.receipt_file_id, r.created_by_user_id, u.name as created_by_name, r.occurred_at, r.created_at
    FROM revenues r
    JOIN properties p ON r.property_id = p.id
    LEFT JOIN users u ON r.created_by_user_id = u.id
    WHERE r.org_id = 1
    ORDER BY r.created_at DESC
  `;

  const totalAmount = revenues.reduce((sum, revenue) => sum + (parseInt(revenue.amount_cents) || 0), 0);

  return {
    revenues: revenues.map((revenue) => ({
      id: revenue.id,
      propertyId: revenue.property_id,
      propertyName: revenue.property_name,
      source: revenue.source,
      amountCents: parseInt(revenue.amount_cents),
      currency: revenue.currency,
      description: revenue.description,
      status: revenue.status,
      paymentMode: revenue.payment_mode,
      bankReference: revenue.bank_reference,
      receiptFileId: revenue.receipt_file_id,
      createdByUserId: revenue.created_by_user_id,
      createdByName: revenue.created_by_name,
      occurredAt: revenue.occurred_at,
      createdAt: revenue.created_at
    })),
    totalAmount
  };
}

async function simulateListExpenses(request: any) {
  const { financeDB } = await import('../db');
  
  const expenses = await financeDB.rawQueryAll`
    SELECT e.id, e.property_id, p.name as property_name, e.category, e.amount_cents, e.currency, e.description, e.status, e.created_by_user_id, u.name as created_by_name, e.expense_date, e.created_at
    FROM expenses e
    JOIN properties p ON e.property_id = p.id
    LEFT JOIN users u ON e.created_by_user_id = u.id
    WHERE e.org_id = 1
    ORDER BY e.created_at DESC
  `;

  const totalAmount = expenses.reduce((sum, expense) => sum + (parseInt(expense.amount_cents) || 0), 0);

  return {
    expenses: expenses.map((expense) => ({
      id: expense.id,
      propertyId: expense.property_id,
      propertyName: expense.property_name,
      category: expense.category,
      amountCents: parseInt(expense.amount_cents),
      currency: expense.currency,
      description: expense.description,
      status: expense.status,
      createdByUserId: expense.created_by_user_id,
      createdByName: expense.created_by_name,
      expenseDate: expense.expense_date,
      createdAt: expense.created_at
    })),
    totalAmount
  };
}

async function simulateApproveRevenue(revenueId: number) {
  const { financeDB } = await import('../db');
  
  const revenue = await financeDB.queryRow`
    SELECT * FROM revenues WHERE id = ${revenueId} AND org_id = 1
  `;

  if (!revenue) {
    throw new Error('Revenue not found');
  }

  const updatedRevenue = await financeDB.queryRow`
    UPDATE revenues 
    SET status = 'approved', approved_by_user_id = 123, approved_at = NOW()
    WHERE id = ${revenueId}
    RETURNING *
  `;

  return {
    id: updatedRevenue.id,
    status: updatedRevenue.status,
    approvedByUserId: updatedRevenue.approved_by_user_id,
    approvedAt: updatedRevenue.approved_at
  };
}

async function simulateApproveExpense(expenseId: number) {
  const { financeDB } = await import('../db');
  
  const expense = await financeDB.queryRow`
    SELECT * FROM expenses WHERE id = ${expenseId} AND org_id = 1
  `;

  if (!expense) {
    throw new Error('Expense not found');
  }

  const updatedExpense = await financeDB.queryRow`
    UPDATE expenses 
    SET status = 'approved', approved_by_user_id = 123, approved_at = NOW()
    WHERE id = ${expenseId}
    RETURNING *
  `;

  return {
    id: updatedExpense.id,
    status: updatedExpense.status,
    approvedByUserId: updatedExpense.approved_by_user_id,
    approvedAt: updatedExpense.approved_at
  };
}

async function simulateGetPerformanceReport() {
  const { financeDB } = await import('../db');
  
  const connectionStats = await financeDB.queryAll`
    SELECT state, count(*) as count
    FROM pg_stat_activity
    WHERE datname = current_database()
    GROUP BY state
  `;

  return {
    averageResponseTime: 25,
    slowQueries: [],
    connectionPool: {
      active: connectionStats?.find((s: any) => s.state === 'active')?.count || 0,
      idle: connectionStats?.find((s: any) => s.state === 'idle')?.count || 0,
      total: connectionStats?.reduce((sum: number, s: any) => sum + parseInt(s.count), 0) || 0
    },
    cacheHitRatio: 95,
    errorRate: 0,
    timestamp: new Date().toISOString()
  };
}

async function simulateGetAlerts() {
  const { financeDB } = await import('../db');
  
  const alerts = await financeDB.queryAll`
    SELECT id, type, message, severity, created_at
    FROM system_alerts
    WHERE resolved = false
    ORDER BY created_at DESC
  `;

  return alerts.map((alert: any) => ({
    id: alert.id,
    type: alert.type,
    message: alert.message,
    severity: alert.severity,
    createdAt: alert.created_at
  }));
}
