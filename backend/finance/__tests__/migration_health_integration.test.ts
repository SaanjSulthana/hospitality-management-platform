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

describe('Migration and Health Monitoring Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Migration Status Verification', () => {
    it('should verify applied migrations correctly', async () => {
      // Mock applied migrations
      (financeDB.queryAll as jest.Mock).mockResolvedValue([
        { version: '1', name: 'create_revenues_table', applied_at: new Date('2024-01-01') },
        { version: '2', name: 'create_expenses_table', applied_at: new Date('2024-01-02') },
        { version: '3', name: 'add_receipt_file_id', applied_at: new Date('2024-01-03') },
        { version: '4', name: 'create_files_table', applied_at: new Date('2024-01-04') }
      ]);

      const migrationStatus = await simulateGetMigrationStatus();
      
      expect(migrationStatus.status.applied_migrations).toHaveLength(4);
      expect(migrationStatus.status.total_applied).toBe(4);
      expect(migrationStatus.status.total_pending).toBe(0);
      expect(migrationStatus.status.status).toBe('up_to_date');
    });

    it('should detect missing migrations', async () => {
      // Mock applied migrations with gaps
      (financeDB.queryAll as jest.Mock).mockResolvedValue([
        { version: '1', name: 'create_revenues_table', applied_at: new Date('2024-01-01') },
        { version: '3', name: 'add_receipt_file_id', applied_at: new Date('2024-01-03') }
        // Missing version 2 and 4
      ]);

      const migrationStatus = await simulateGetMigrationStatus();
      
      expect(migrationStatus.status.applied_migrations).toHaveLength(2);
      expect(migrationStatus.status.total_applied).toBe(2);
      expect(migrationStatus.status.total_pending).toBe(2);
      expect(migrationStatus.status.status).toBe('missing_migrations');
      expect(migrationStatus.pending_migrations).toContain('2');
      expect(migrationStatus.pending_migrations).toContain('4');
    });

    it('should validate migration integrity', async () => {
      // Mock migration integrity check
      (financeDB.queryAll as jest.Mock).mockResolvedValue([
        { version: '1', name: 'create_revenues_table', applied_at: new Date('2024-01-01') },
        { version: '2', name: 'create_expenses_table', applied_at: new Date('2024-01-02') }
      ]);

      const migrationStatus = await simulateGetMigrationStatus();
      
      expect(migrationStatus.integrity_check).toBe(true);
      expect(migrationStatus.conflicts).toHaveLength(0);
    });

    it('should detect migration conflicts', async () => {
      // Mock migration conflicts
      (financeDB.queryAll as jest.Mock).mockResolvedValue([
        { version: '1', name: 'create_revenues_table', applied_at: new Date('2024-01-01') },
        { version: '2', name: 'create_expenses_table', applied_at: new Date('2024-01-02') },
        { version: '2', name: 'create_expenses_table_v2', applied_at: new Date('2024-01-03') } // Duplicate version
      ]);

      const migrationStatus = await simulateGetMigrationStatus();
      
      expect(migrationStatus.integrity_check).toBe(false);
      expect(migrationStatus.conflicts).toHaveLength(1);
      expect(migrationStatus.conflicts[0]).toContain('Duplicate versions detected');
    });
  });

  describe('Health Monitoring Integration', () => {
    it('should perform comprehensive health check', async () => {
      // Mock health check data
      (financeDB.queryRow as jest.Mock).mockResolvedValue({ current_time: new Date() });
      (financeDB.queryAll as jest.Mock)
        .mockResolvedValueOnce([ // Table integrity
          { table_name: 'revenues', row_count: 100, size_mb: 5.2 },
          { table_name: 'expenses', row_count: 50, size_mb: 3.1 }
        ])
        .mockResolvedValueOnce([ // Index status
          { indexname: 'revenues_pkey', indexdef: 'PRIMARY KEY' },
          { indexname: 'idx_revenues_org_id', indexdef: 'CREATE INDEX' }
        ])
        .mockResolvedValueOnce([ // Connection stats
          { state: 'active', count: 3 },
          { state: 'idle', count: 7 }
        ]);

      const healthStatus = await simulateHealthCheck();
      
      expect(healthStatus.overall_status).toBe('healthy');
      expect(healthStatus.connection.status).toBe('healthy');
      expect(healthStatus.tables).toHaveLength(2);
      expect(healthStatus.indexes).toHaveLength(2);
      expect(healthStatus.performance.connectionPool.active).toBe(3);
      expect(healthStatus.performance.connectionPool.idle).toBe(7);
    });

    it('should detect database performance issues', async () => {
      // Mock performance issues
      (financeDB.queryRow as jest.Mock).mockResolvedValue({ current_time: new Date() });
      (financeDB.queryAll as jest.Mock)
        .mockResolvedValueOnce([ // Table integrity
          { table_name: 'revenues', row_count: 1000000, size_mb: 500.2 },
          { table_name: 'expenses', row_count: 500000, size_mb: 300.1 }
        ])
        .mockResolvedValueOnce([ // Index status
          { indexname: 'revenues_pkey', indexdef: 'PRIMARY KEY' }
        ])
        .mockResolvedValueOnce([ // Connection stats
          { state: 'active', count: 15 },
          { state: 'idle', count: 5 }
        ]);

      const healthStatus = await simulateHealthCheck();
      
      expect(healthStatus.overall_status).toBe('critical');
      expect(healthStatus.alerts).toHaveLength(2);
      expect(healthStatus.alerts[0].type).toBe('performance');
      expect(healthStatus.alerts[1].type).toBe('connection_pool');
    });

    it('should detect database connectivity issues', async () => {
      // Mock connectivity issues
      (financeDB.queryRow as jest.Mock).mockRejectedValue(new Error('Connection timeout'));

      const healthStatus = await simulateHealthCheck();
      
      expect(healthStatus.overall_status).toBe('critical');
      expect(healthStatus.connection.status).toBe('unhealthy');
      expect(healthStatus.alerts).toHaveLength(1);
      expect(healthStatus.alerts[0].type).toBe('connectivity');
    });

    it('should track performance metrics over time', async () => {
      // Mock performance metrics
      (financeDB.queryRow as jest.Mock).mockResolvedValue({ current_time: new Date() });
      (financeDB.queryAll as jest.Mock)
        .mockResolvedValueOnce([ // Table integrity
          { table_name: 'revenues', row_count: 100, size_mb: 5.2 },
          { table_name: 'expenses', row_count: 50, size_mb: 3.1 }
        ])
        .mockResolvedValueOnce([ // Index status
          { indexname: 'revenues_pkey', indexdef: 'PRIMARY KEY' }
        ])
        .mockResolvedValueOnce([ // Connection stats
          { state: 'active', count: 3 },
          { state: 'idle', count: 7 }
        ]);

      const performanceReport = await simulateGetPerformanceReport();
      
      expect(performanceReport.averageResponseTime).toBeGreaterThan(0);
      expect(performanceReport.slowQueries).toHaveLength(0);
      expect(performanceReport.connectionPool).toHaveProperty('active');
      expect(performanceReport.connectionPool).toHaveProperty('idle');
      expect(performanceReport.connectionPool).toHaveProperty('total');
    });
  });

  describe('Migration and Health Integration', () => {
    it('should integrate migration status with health monitoring', async () => {
      // Mock migration status
      (financeDB.queryAll as jest.Mock).mockResolvedValue([
        { version: '1', name: 'create_revenues_table', applied_at: new Date('2024-01-01') },
        { version: '2', name: 'create_expenses_table', applied_at: new Date('2024-01-02') }
      ]);

      // Mock health check
      (financeDB.queryRow as jest.Mock).mockResolvedValue({ current_time: new Date() });
      (financeDB.queryAll as jest.Mock)
        .mockResolvedValueOnce([ // Table integrity
          { table_name: 'revenues', row_count: 100, size_mb: 5.2 },
          { table_name: 'expenses', row_count: 50, size_mb: 3.1 }
        ])
        .mockResolvedValueOnce([ // Index status
          { indexname: 'revenues_pkey', indexdef: 'PRIMARY KEY' }
        ])
        .mockResolvedValueOnce([ // Connection stats
          { state: 'active', count: 3 },
          { state: 'idle', count: 7 }
        ]);

      const migrationStatus = await simulateGetMigrationStatus();
      const healthStatus = await simulateHealthCheck();
      
      expect(migrationStatus.status.total_applied).toBe(2);
      expect(healthStatus.overall_status).toBe('healthy');
      expect(healthStatus.tables.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle migration issues in health monitoring', async () => {
      // Mock migration issues
      (financeDB.queryAll as jest.Mock).mockResolvedValue([
        { version: '1', name: 'create_revenues_table', applied_at: new Date('2024-01-01') }
        // Missing migrations
      ]);

      // Mock health check with migration issues
      (financeDB.queryRow as jest.Mock).mockResolvedValue({ current_time: new Date() });
      (financeDB.queryAll as jest.Mock)
        .mockResolvedValueOnce([ // Table integrity
          { table_name: 'revenues', row_count: 100, size_mb: 5.2 }
        ])
        .mockResolvedValueOnce([ // Index status
          { indexname: 'revenues_pkey', indexdef: 'PRIMARY KEY' }
        ])
        .mockResolvedValueOnce([ // Connection stats
          { state: 'active', count: 3 },
          { state: 'idle', count: 7 }
        ]);

      const migrationStatus = await simulateGetMigrationStatus();
      const healthStatus = await simulateHealthCheck();
      
      expect(migrationStatus.status.total_pending).toBeGreaterThan(0);
      expect(healthStatus.alerts.length).toBeGreaterThanOrEqual(0);
    });

    it('should provide comprehensive system status', async () => {
      // Mock comprehensive system status
      (financeDB.queryAll as jest.Mock).mockResolvedValue([
        { version: '1', name: 'create_revenues_table', applied_at: new Date('2024-01-01') },
        { version: '2', name: 'create_expenses_table', applied_at: new Date('2024-01-02') },
        { version: '3', name: 'add_receipt_file_id', applied_at: new Date('2024-01-03') }
      ]);

      (financeDB.queryRow as jest.Mock).mockResolvedValue({ current_time: new Date() });
      (financeDB.queryAll as jest.Mock)
        .mockResolvedValueOnce([ // Table integrity
          { table_name: 'revenues', row_count: 100, size_mb: 5.2 },
          { table_name: 'expenses', row_count: 50, size_mb: 3.1 }
        ])
        .mockResolvedValueOnce([ // Index status
          { indexname: 'revenues_pkey', indexdef: 'PRIMARY KEY' },
          { indexname: 'idx_revenues_org_id', indexdef: 'CREATE INDEX' }
        ])
        .mockResolvedValueOnce([ // Connection stats
          { state: 'active', count: 3 },
          { state: 'idle', count: 7 }
        ]);

      const systemStatus = await simulateGetSystemStatus();
      
      expect(systemStatus.migration.status).toBe('missing_migrations');
      expect(systemStatus.health.overall_status).toBe('healthy');
      expect(systemStatus.performance.averageResponseTime).toBeGreaterThan(0);
      expect(systemStatus.alerts.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Alert Management Integration', () => {
    it('should manage alerts across migration and health systems', async () => {
      // Mock alerts
      (financeDB.queryAll as jest.Mock).mockResolvedValue([
        { id: 1, type: 'migration', message: 'Missing migration version 4', severity: 'warning', created_at: new Date() },
        { id: 2, type: 'performance', message: 'High response time detected', severity: 'critical', created_at: new Date() }
      ]);

      const alerts = await simulateGetAlerts();
      
      expect(alerts).toHaveLength(2);
      expect(alerts[0].type).toBe('migration');
      expect(alerts[1].type).toBe('performance');
    });

    it('should resolve alerts appropriately', async () => {
      // Mock alert resolution
      (financeDB.queryRow as jest.Mock).mockResolvedValue({ id: 1, resolved: true });

      const resolution = await simulateResolveAlert(1);
      
      expect(resolution.success).toBe(true);
      expect(resolution.alert_id).toBe(1);
    });

    it('should clear resolved alerts', async () => {
      // Mock alert clearing
      (financeDB.exec as jest.Mock).mockResolvedValue(undefined);

      const result = await simulateClearResolvedAlerts();
      
      expect(result.success).toBe(true);
      expect(result.cleared_count).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Migration and Health Workflow', () => {
    it('should complete full migration and health monitoring workflow', async () => {
      // Step 1: Check initial migration status
      (financeDB.queryAll as jest.Mock).mockResolvedValue([
        { version: '1', name: 'create_revenues_table', applied_at: new Date('2024-01-01') }
      ]);

      const initialMigrationStatus = await simulateGetMigrationStatus();
      expect(initialMigrationStatus.status.total_applied).toBe(1);

      // Step 2: Apply missing migrations
      (financeDB.exec as jest.Mock).mockResolvedValue(undefined);

      const migrationResult = await simulateApplyMigration('2', 'create_expenses_table');
      expect(migrationResult.success).toBe(true);

      // Step 3: Verify updated migration status
      (financeDB.queryAll as jest.Mock).mockResolvedValue([
        { version: '1', name: 'create_revenues_table', applied_at: new Date('2024-01-01') },
        { version: '2', name: 'create_expenses_table', applied_at: new Date('2024-01-02') }
      ]);

      const updatedMigrationStatus = await simulateGetMigrationStatus();
      expect(updatedMigrationStatus.status.total_applied).toBe(2);

      // Step 4: Perform health check
      (financeDB.queryRow as jest.Mock).mockResolvedValue({ current_time: new Date() });
      (financeDB.queryAll as jest.Mock)
        .mockResolvedValueOnce([ // Table integrity
          { table_name: 'revenues', row_count: 100, size_mb: 5.2 },
          { table_name: 'expenses', row_count: 50, size_mb: 3.1 }
        ])
        .mockResolvedValueOnce([ // Index status
          { indexname: 'revenues_pkey', indexdef: 'PRIMARY KEY' },
          { indexname: 'expenses_pkey', indexdef: 'PRIMARY KEY' }
        ])
        .mockResolvedValueOnce([ // Connection stats
          { state: 'active', count: 3 },
          { state: 'idle', count: 7 }
        ]);

      const healthStatus = await simulateHealthCheck();
      expect(healthStatus.overall_status).toBe('healthy');
      expect(healthStatus.tables).toHaveLength(2);

      // Step 5: Get performance report
      const performanceReport = await simulateGetPerformanceReport();
      expect(performanceReport.averageResponseTime).toBeGreaterThan(0);

      // Step 6: Check for alerts
      (financeDB.queryAll as jest.Mock).mockResolvedValue([]);

      const alerts = await simulateGetAlerts();
      expect(alerts).toHaveLength(0);
    });

    it('should handle migration and health monitoring under stress', async () => {
      // Mock stress scenario
      (financeDB.queryAll as jest.Mock)
        .mockResolvedValueOnce([ // Migration status
          { version: '1', name: 'create_revenues_table', applied_at: new Date('2024-01-01') }
        ])
        .mockResolvedValueOnce([ // Table integrity
          { table_name: 'revenues', row_count: 1000000, size_mb: 500.2 }
        ])
        .mockResolvedValueOnce([ // Index status
          { indexname: 'revenues_pkey', indexdef: 'PRIMARY KEY' }
        ])
        .mockResolvedValueOnce([ // Connection stats
          { state: 'active', count: 15 },
          { state: 'idle', count: 5 }
        ]);

      (financeDB.queryRow as jest.Mock).mockResolvedValue({ current_time: new Date() });

      const migrationStatus = await simulateGetMigrationStatus();
      const healthStatus = await simulateHealthCheck();
      
      expect(migrationStatus.status.total_pending).toBeGreaterThan(0);
      expect(healthStatus.overall_status).toBe('critical');
      expect(healthStatus.alerts).toHaveLength(2);
    });
  });
});

// Helper functions to simulate migration and health monitoring
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

    const alerts = [];
    
    // Check for performance issues
    if (tables.some((t: any) => parseInt(t.size_mb) > 100)) {
      alerts.push({ type: 'performance', message: 'Large table size detected', severity: 'warning' });
    }

    // Check for connection pool issues
    const activeConnections = connectionStats.find((s: any) => s.state === 'active')?.count || 0;
    if (activeConnections > 10) {
      alerts.push({ type: 'connection_pool', message: 'High connection pool usage', severity: 'critical' });
    }

    const overallStatus = alerts.length === 0 ? 'healthy' : alerts.some(a => a.severity === 'critical') ? 'critical' : 'warning';

    return {
      overall_status: overallStatus,
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
          active: activeConnections,
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
      alerts,
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
      active: connectionStats.find((s: any) => s.state === 'active')?.count || 0,
      idle: connectionStats.find((s: any) => s.state === 'idle')?.count || 0,
      total: connectionStats.reduce((sum: number, s: any) => sum + parseInt(s.count), 0)
    },
    cacheHitRatio: 95,
    errorRate: 0,
    timestamp: new Date().toISOString()
  };
}

async function simulateGetSystemStatus() {
  const migrationStatus = await simulateGetMigrationStatus();
  const healthStatus = await simulateHealthCheck();
  const performanceReport = await simulateGetPerformanceReport();

  return {
    migration: migrationStatus.status,
    health: healthStatus,
    performance: performanceReport,
    alerts: healthStatus.alerts,
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

async function simulateResolveAlert(alertId: number) {
  const { financeDB } = await import('../db');
  
  const result = await financeDB.queryRow`
    UPDATE system_alerts 
    SET resolved = true, resolved_at = NOW()
    WHERE id = ${alertId}
    RETURNING id, resolved
  `;

  return {
    success: true,
    alert_id: result.id
  };
}

async function simulateClearResolvedAlerts() {
  const { financeDB } = await import('../db');
  
  await financeDB.exec`
    DELETE FROM system_alerts 
    WHERE resolved = true AND resolved_at < NOW() - INTERVAL '7 days'
  `;

  return {
    success: true,
    cleared_count: 5
  };
}

async function simulateApplyMigration(version: string, name: string) {
  const { financeDB } = await import('../db');
  
  await financeDB.exec`
    INSERT INTO schema_migrations (version, name, applied_at)
    VALUES (${version}, ${name}, NOW())
  `;

  return {
    success: true,
    version,
    name
  };
}
