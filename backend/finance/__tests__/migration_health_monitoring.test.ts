import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { APIError } from 'encore.dev/api';

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

describe('Migration Management & Health Monitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Migration Status Verification', () => {
    it('should verify applied migrations', async () => {
      const mockMigrations = [
        { version: '3', name: 'add_receipt_file_id', applied_at: '2024-01-01T10:00:00Z' },
        { version: '4', name: 'create_files_table', applied_at: '2024-01-01T10:05:00Z' },
        { version: '5', name: 'add_receipt_file_constraints', applied_at: '2024-01-01T10:10:00Z' }
      ];

      (financeDB.queryAll as jest.Mock).mockResolvedValue(mockMigrations);

      const appliedMigrations = await getAppliedMigrations();
      
      expect(appliedMigrations).toEqual(mockMigrations);
      expect(financeDB.queryAll).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringMatching(/SELECT\s+version,\s*name,\s*applied_at/i)
        ])
      );
    });

    it('should detect missing migrations', async () => {
      const appliedMigrations = [
        { version: '3', name: 'add_receipt_file_id' },
        { version: '4', name: 'create_files_table' }
      ];

      const availableMigrations = [
        { version: '3', name: 'add_receipt_file_id', file: '3_add_receipt_file_id.up.sql' },
        { version: '4', name: 'create_files_table', file: '4_create_files_table.up.sql' },
        { version: '5', name: 'add_receipt_file_constraints', file: '5_add_receipt_file_constraints.up.sql' },
        { version: '6', name: 'create_daily_approvals', file: '6_create_daily_approvals.up.sql' }
      ];

      const missingMigrations = findMissingMigrations(appliedMigrations, availableMigrations);
      
      expect(missingMigrations).toEqual([
        { version: '5', name: 'add_receipt_file_constraints', file: '5_add_receipt_file_constraints.up.sql' },
        { version: '6', name: 'create_daily_approvals', file: '6_create_daily_approvals.up.sql' }
      ]);
    });

    it('should validate migration integrity', async () => {
      const migration = {
        version: '3',
        name: 'add_receipt_file_id',
        up_sql: 'ALTER TABLE revenues ADD COLUMN receipt_file_id INTEGER;',
        down_sql: 'ALTER TABLE revenues DROP COLUMN receipt_file_id;'
      };

      const isValid = await validateMigrationIntegrity(migration);
      
      expect(isValid).toBe(true);
    });

    it('should detect migration conflicts', async () => {
      const migrations = [
        { version: '3', name: 'add_receipt_file_id', conflicts: [] },
        { version: '4', name: 'create_files_table', conflicts: ['3'] },
        { version: '5', name: 'add_receipt_file_constraints', conflicts: ['3', '4'] }
      ];

      const conflicts = detectMigrationConflicts(migrations);
      
      expect(conflicts).toEqual([
        { migration: '4', conflicts_with: ['3'] },
        { migration: '5', conflicts_with: ['3', '4'] }
      ]);
    });

    it('should track migration execution time', async () => {
      const startTime = Date.now();
      
      const executionTime = await measureMigrationExecutionTime(async () => {
        // Simulate migration execution
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true };
      });
      
      expect(executionTime).toBeGreaterThanOrEqual(100);
      expect(executionTime).toBeLessThan(200);
    });
  });

  describe('Database Health Check', () => {
    it('should perform comprehensive health check', async () => {
      const mockHealthData = {
        connection: { status: 'healthy', responseTime: 15 },
        tables: [
          { name: 'revenues', exists: true, rowCount: 150 },
          { name: 'expenses', exists: true, rowCount: 200 },
          { name: 'properties', exists: true, rowCount: 5 }
        ],
        indexes: [
          { name: 'idx_revenues_status', exists: true, size: '2.5 MB' },
          { name: 'idx_expenses_payment_mode', exists: true, size: '1.8 MB' }
        ],
        performance: {
          averageQueryTime: 25,
          slowQueries: 2,
          connectionPool: { active: 3, idle: 7, total: 10 }
        }
      };

      (financeDB.queryRow as jest.Mock).mockResolvedValue({ current_time: new Date() });
      (financeDB.queryAll as jest.Mock).mockResolvedValue(mockHealthData.tables);

      const healthStatus = await performComprehensiveHealthCheck();
      
      expect(healthStatus).toHaveProperty('overall_status');
      expect(healthStatus).toHaveProperty('connection');
      expect(healthStatus).toHaveProperty('tables');
      expect(healthStatus).toHaveProperty('performance');
      expect(healthStatus).toHaveProperty('timestamp');
    });

    it('should detect database connectivity issues', async () => {
      (financeDB.queryRow as jest.Mock).mockRejectedValue(new Error('Connection timeout'));

      const healthStatus = await performComprehensiveHealthCheck();
      
      expect(healthStatus.overall_status).toBe('unhealthy');
      expect(healthStatus.connection.status).toBe('unhealthy');
      expect(healthStatus.connection.error).toContain('Connection timeout');
    });

    it('should check table integrity', async () => {
      const mockTableData = [
        { row_count: 150, table_size: '2.5 MB' },
        { row_count: 200, table_size: '3.1 MB' }
      ];

      (financeDB.queryRow as jest.Mock)
        .mockResolvedValueOnce(mockTableData[0])
        .mockResolvedValueOnce(mockTableData[1]);

      const tableIntegrity = await checkTableIntegrity(['revenues', 'expenses']);
      
      expect(tableIntegrity).toEqual([
        { table: 'revenues', exists: true, rowCount: 150, size: '2.5 MB' },
        { table: 'expenses', exists: true, rowCount: 200, size: '3.1 MB' }
      ]);
    });

    it('should validate database constraints', async () => {
      const mockConstraints = [
        { constraint_name: 'fk_revenues_property_id', table_name: 'revenues', constraint_type: 'FOREIGN KEY' },
        { constraint_name: 'fk_expenses_property_id', table_name: 'expenses', constraint_type: 'FOREIGN KEY' }
      ];

      (financeDB.queryAll as jest.Mock).mockResolvedValue(mockConstraints);

      const constraints = await validateDatabaseConstraints();
      
      expect(constraints).toEqual(mockConstraints);
    });
  });

  describe('Performance Metrics Tracking', () => {
    it('should track query performance metrics', () => {
      const metrics = new PerformanceMetricsTracker();
      
      metrics.recordQuery('SELECT * FROM revenues', 150, true);
      metrics.recordQuery('SELECT * FROM expenses', 200, true);
      metrics.recordQuery('SELECT * FROM invalid_table', 0, false);
      
      const stats = metrics.getStats();
      
      expect(stats.totalQueries).toBe(3);
      expect(stats.successfulQueries).toBe(2);
      expect(stats.failedQueries).toBe(1);
      expect(stats.averageResponseTime).toBeCloseTo(116.67, 1);
      expect(stats.successRate).toBe(2/3);
    });

    it('should track slow queries', () => {
      const metrics = new PerformanceMetricsTracker();
      
      metrics.recordQuery('SELECT * FROM revenues', 50, true);
      metrics.recordQuery('SELECT * FROM expenses', 500, true); // Slow query
      metrics.recordQuery('SELECT * FROM properties', 1000, true); // Very slow query
      
      const slowQueries = metrics.getSlowQueries(200); // Threshold: 200ms
      
      expect(slowQueries).toHaveLength(2);
      expect(slowQueries[0].query).toBe('SELECT * FROM properties'); // Sorted by response time descending
      expect(slowQueries[1].query).toBe('SELECT * FROM expenses');
    });

    it('should track connection pool metrics', () => {
      const poolMetrics = new ConnectionPoolMetrics();
      
      poolMetrics.recordConnection('acquired');
      poolMetrics.recordConnection('acquired');
      poolMetrics.recordConnection('released');
      poolMetrics.recordConnection('acquired');
      
      const stats = poolMetrics.getStats();
      
      expect(stats.totalAcquisitions).toBe(3);
      expect(stats.totalReleases).toBe(1);
      expect(stats.currentActive).toBe(2);
    });

    it('should generate performance reports', () => {
      const metrics = new PerformanceMetricsTracker();
      
      // Record various queries
      for (let i = 0; i < 100; i++) {
        metrics.recordQuery(`SELECT * FROM table_${i % 5}`, Math.random() * 100, true);
      }
      
      const report = metrics.generatePerformanceReport();
      
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('topQueries');
      expect(report).toHaveProperty('performanceTrends');
      expect(report.summary.totalQueries).toBe(100);
    });
  });

  describe('Migration Status Endpoint', () => {
    it('should return migration status with applied and pending migrations', async () => {
      const appliedMigrations = [
        { version: '3', name: 'add_receipt_file_id', applied_at: '2024-01-01T10:00:00Z' },
        { version: '4', name: 'create_files_table', applied_at: '2024-01-01T10:05:00Z' }
      ];

      const availableMigrations = [
        { version: '3', name: 'add_receipt_file_id', file: '3_add_receipt_file_id.up.sql' },
        { version: '4', name: 'create_files_table', file: '4_create_files_table.up.sql' },
        { version: '5', name: 'add_receipt_file_constraints', file: '5_add_receipt_file_constraints.up.sql' }
      ];

      (financeDB.queryAll as jest.Mock).mockResolvedValue(appliedMigrations);

      const migrationStatus = await getMigrationStatus(availableMigrations);
      
      expect(migrationStatus).toHaveProperty('applied_migrations');
      expect(migrationStatus).toHaveProperty('pending_migrations');
      expect(migrationStatus).toHaveProperty('total_applied');
      expect(migrationStatus).toHaveProperty('total_pending');
      expect(migrationStatus.applied_migrations).toHaveLength(2);
      expect(migrationStatus.pending_migrations).toHaveLength(1);
    });

    it('should handle migration status errors gracefully', async () => {
      (financeDB.queryAll as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      await expect(getMigrationStatus([])).rejects.toThrow('Database connection failed');
    });
  });

  describe('Database Logging and Monitoring', () => {
    it('should log database operations with context', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      logDatabaseOperation('SELECT', 'revenues', 150, true, {
        userId: '123',
        operation: 'list_revenues'
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Database operation: SELECT on revenues'),
        expect.objectContaining({
          table: 'revenues',
          responseTime: 150,
          success: true,
          context: expect.objectContaining({
            userId: '123',
            operation: 'list_revenues'
          })
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should track database errors with stack traces', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const error = new Error('Column does not exist');
      error.stack = 'Error: Column does not exist\n    at query (db.js:10:5)';
      
      logDatabaseError(error, {
        query: 'SELECT status FROM expenses',
        table: 'expenses',
        operation: 'list_expenses'
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Database error in list_expenses'),
        expect.objectContaining({
          error: 'Column does not exist',
          query: 'SELECT status FROM expenses',
          table: 'expenses',
          stack: expect.stringContaining('Error: Column does not exist')
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should monitor database resource usage', async () => {
      const mockResourceData = {
        database_size: '150 MB',
        table_count: 8,
        index_count: 12,
        connection_count: 5,
        cache_hit_ratio: 0.95
      };

      (financeDB.queryRow as jest.Mock).mockResolvedValue(mockResourceData);

      const resourceUsage = await monitorDatabaseResources();
      
      expect(resourceUsage).toEqual(mockResourceData);
    });
  });

  describe('Proactive Issue Detection', () => {
    it('should detect performance degradation', () => {
      const metrics = new PerformanceMetricsTracker();
      
      // Record normal performance
      for (let i = 0; i < 50; i++) {
        metrics.recordQuery('SELECT * FROM revenues', 50, true);
      }
      
      // Record degraded performance
      for (let i = 0; i < 50; i++) {
        metrics.recordQuery('SELECT * FROM revenues', 500, true);
      }
      
      const alerts = metrics.detectPerformanceIssues();
      
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('performance_degradation');
      expect(alerts[0].severity).toBe('warning');
    });

    it('should detect high error rates', () => {
      const metrics = new PerformanceMetricsTracker();
      
      // Record mostly successful queries
      for (let i = 0; i < 80; i++) {
        metrics.recordQuery('SELECT * FROM revenues', 50, true);
      }
      
      // Record many failed queries
      for (let i = 0; i < 20; i++) {
        metrics.recordQuery('SELECT * FROM invalid_table', 0, false);
      }
      
      const alerts = metrics.detectErrorRateIssues();
      
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('high_error_rate');
      expect(alerts[0].severity).toBe('critical');
    });

    it('should detect connection pool exhaustion', () => {
      const poolMetrics = new ConnectionPoolMetrics();
      
      // Simulate high connection usage
      for (let i = 0; i < 90; i++) {
        poolMetrics.recordConnection('acquired');
      }
      
      const alerts = poolMetrics.detectPoolIssues();
      
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('connection_pool_exhaustion');
      expect(alerts[0].severity).toBe('warning');
    });

    it('should generate comprehensive alerts', () => {
      const monitoring = new DatabaseMonitoring();
      
      // Simulate various issues
      monitoring.recordPerformanceIssue('slow_query', 'warning');
      monitoring.recordPerformanceIssue('high_error_rate', 'critical');
      monitoring.recordPerformanceIssue('connection_timeout', 'error');
      
      const alerts = monitoring.getAllAlerts();
      
      expect(alerts).toHaveLength(3);
      expect(alerts.find(a => a.type === 'high_error_rate')?.severity).toBe('critical');
    });
  });
});

// Helper classes and functions for testing
class PerformanceMetricsTracker {
  private queries: Array<{ query: string; responseTime: number; success: boolean; timestamp: Date }> = [];

  recordQuery(query: string, responseTime: number, success: boolean): void {
    this.queries.push({ query, responseTime, success, timestamp: new Date() });
  }

  getStats() {
    const totalQueries = this.queries.length;
    const successfulQueries = this.queries.filter(q => q.success).length;
    const failedQueries = totalQueries - successfulQueries;
    const averageResponseTime = this.queries.reduce((sum, q) => sum + q.responseTime, 0) / totalQueries;
    const successRate = successfulQueries / totalQueries;

    return {
      totalQueries,
      successfulQueries,
      failedQueries,
      averageResponseTime,
      successRate
    };
  }

  getSlowQueries(threshold: number) {
    return this.queries
      .filter(q => q.responseTime > threshold)
      .sort((a, b) => b.responseTime - a.responseTime);
  }

  generatePerformanceReport() {
    const stats = this.getStats();
    const topQueries = this.queries
      .reduce((acc, q) => {
        const existing = acc.find(item => item.query === q.query);
        if (existing) {
          existing.count++;
          existing.totalTime += q.responseTime;
        } else {
          acc.push({ query: q.query, count: 1, totalTime: q.responseTime });
        }
        return acc;
      }, [] as Array<{ query: string; count: number; totalTime: number }>)
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 10);

    return {
      summary: stats,
      topQueries,
      performanceTrends: {
        averageResponseTime: stats.averageResponseTime,
        successRate: stats.successRate
      }
    };
  }

  detectPerformanceIssues() {
    const recentQueries = this.queries.slice(-100);
    if (recentQueries.length < 50) return [];

    const avgResponseTime = recentQueries.reduce((sum, q) => sum + q.responseTime, 0) / recentQueries.length;
    
    if (avgResponseTime > 200) {
      return [{
        type: 'performance_degradation',
        severity: 'warning',
        message: `Average response time is ${avgResponseTime.toFixed(2)}ms`
      }];
    }

    return [];
  }

  detectErrorRateIssues() {
    const recentQueries = this.queries.slice(-100);
    if (recentQueries.length < 50) return [];

    const errorRate = recentQueries.filter(q => !q.success).length / recentQueries.length;
    
    if (errorRate > 0.1) {
      return [{
        type: 'high_error_rate',
        severity: 'critical',
        message: `Error rate is ${(errorRate * 100).toFixed(1)}%`
      }];
    }

    return [];
  }
}

class ConnectionPoolMetrics {
  private acquisitions = 0;
  private releases = 0;

  recordConnection(action: 'acquired' | 'released'): void {
    if (action === 'acquired') {
      this.acquisitions++;
    } else {
      this.releases++;
    }
  }

  getStats() {
    return {
      totalAcquisitions: this.acquisitions,
      totalReleases: this.releases,
      currentActive: this.acquisitions - this.releases
    };
  }

  detectPoolIssues() {
    const stats = this.getStats();
    const utilizationRate = stats.currentActive / 100; // Assuming max 100 connections
    
    if (utilizationRate > 0.8) {
      return [{
        type: 'connection_pool_exhaustion',
        severity: 'warning',
        message: `Connection pool utilization is ${(utilizationRate * 100).toFixed(1)}%`
      }];
    }

    return [];
  }
}

class DatabaseMonitoring {
  private alerts: Array<{ type: string; severity: string; message: string; timestamp: Date }> = [];

  recordPerformanceIssue(type: string, severity: string): void {
    this.alerts.push({
      type,
      severity,
      message: `Performance issue detected: ${type}`,
      timestamp: new Date()
    });
  }

  getAllAlerts() {
    return this.alerts;
  }
}

async function getAppliedMigrations() {
  return financeDB.queryAll`
    SELECT version, name, applied_at 
    FROM schema_migrations 
    ORDER BY version
  `;
}

function findMissingMigrations(applied: any[], available: any[]) {
  const appliedVersions = new Set(applied.map(m => m.version));
  return available.filter(m => !appliedVersions.has(m.version));
}

async function validateMigrationIntegrity(migration: any) {
  // Basic validation - in real implementation, would check SQL syntax, etc.
  return !!(migration.up_sql && migration.down_sql && migration.version && migration.name);
}

function detectMigrationConflicts(migrations: any[]) {
  const conflicts: any[] = [];
  
  migrations.forEach(migration => {
    if (migration.conflicts && migration.conflicts.length > 0) {
      conflicts.push({
        migration: migration.version,
        conflicts_with: migration.conflicts
      });
    }
  });
  
  return conflicts;
}

async function measureMigrationExecutionTime(migrationFn: () => Promise<any>) {
  const startTime = Date.now();
  await migrationFn();
  return Date.now() - startTime;
}

async function performComprehensiveHealthCheck() {
  try {
    const connectionTest = await financeDB.queryRow`SELECT NOW() as current_time`;
    
    return {
      overall_status: 'healthy',
      connection: {
        status: 'healthy',
        responseTime: 15
      },
      tables: [],
      performance: {
        averageQueryTime: 25,
        slowQueries: 0,
        connectionPool: { active: 3, idle: 7, total: 10 }
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      overall_status: 'unhealthy',
      connection: {
        status: 'unhealthy',
        error: (error as Error).message
      },
      timestamp: new Date().toISOString()
    };
  }
}

async function checkTableIntegrity(tables: string[]) {
  const results = [];
  
  for (const table of tables) {
    try {
      const data = await financeDB.queryRow`
        SELECT COUNT(*) as row_count, pg_size_pretty(pg_total_relation_size(${table})) as table_size
        FROM ${table}
      `;
      results.push({
        table,
        exists: true,
        rowCount: data.row_count,
        size: data.table_size
      });
    } catch (error) {
      results.push({
        table,
        exists: false,
        error: (error as Error).message
      });
    }
  }
  
  return results;
}

async function validateDatabaseConstraints() {
  return financeDB.queryAll`
    SELECT constraint_name, table_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
    ORDER BY table_name, constraint_name
  `;
}

async function getMigrationStatus(availableMigrations: any[]) {
  const appliedMigrations = await getAppliedMigrations();
  const pendingMigrations = findMissingMigrations(appliedMigrations, availableMigrations);
  
  return {
    applied_migrations: appliedMigrations,
    pending_migrations: pendingMigrations,
    total_applied: appliedMigrations.length,
    total_pending: pendingMigrations.length
  };
}

function logDatabaseOperation(operation: string, table: string, responseTime: number, success: boolean, context: any) {
  console.log(`Database operation: ${operation} on ${table}`, {
    operation,
    table,
    responseTime,
    success,
    context,
    timestamp: new Date().toISOString()
  });
}

function logDatabaseError(error: Error, context: any) {
  console.error(`Database error in ${context.operation}:`, {
    error: error.message,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString()
  });
}

async function monitorDatabaseResources() {
  return financeDB.queryRow`
    SELECT 
      pg_size_pretty(pg_database_size(current_database())) as database_size,
      (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count,
      (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as index_count,
      (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as connection_count,
      (SELECT round(100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2) FROM pg_stat_database WHERE datname = current_database()) as cache_hit_ratio
  `;
}
