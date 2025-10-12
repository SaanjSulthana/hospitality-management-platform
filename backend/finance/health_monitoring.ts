import { financeDB } from './db';
import { APIError } from 'encore.dev/api';
import { executeQueryWithStability, getConnectionMetrics } from './connection_stability';

export interface HealthStatus {
  overall_status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  connection: {
    status: 'healthy' | 'unhealthy';
    responseTime?: number;
    error?: string;
  };
  tables: TableHealth[];
  indexes: IndexHealth[];
  performance: PerformanceMetrics;
  resources: ResourceUsage;
  alerts: Alert[];
}

export interface TableHealth {
  name: string;
  exists: boolean;
  rowCount?: number;
  size?: string;
  lastAnalyzed?: Date;
  error?: string;
}

export interface IndexHealth {
  name: string;
  table: string;
  exists: boolean;
  size?: string;
  usage?: number;
  error?: string;
}

export interface PerformanceMetrics {
  averageQueryTime: number;
  slowQueries: number;
  connectionPool: {
    active: number;
    idle: number;
    total: number;
  };
  cacheHitRatio: number;
  errorRate: number;
}

export interface ResourceUsage {
  databaseSize: string;
  tableCount: number;
  indexCount: number;
  connectionCount: number;
  memoryUsage?: string;
  diskUsage?: string;
}

export interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  resolved?: boolean;
  metadata?: any;
}

export interface PerformanceReport {
  summary: {
    totalQueries: number;
    averageResponseTime: number;
    successRate: number;
    errorRate: number;
  };
  topQueries: Array<{
    query: string;
    count: number;
    averageTime: number;
    totalTime: number;
  }>;
  performanceTrends: {
    responseTimeTrend: number[];
    errorRateTrend: number[];
    throughputTrend: number[];
  };
  recommendations: string[];
}

/**
 * Health monitoring and performance tracking system
 */
export class HealthMonitor {
  private alerts: Alert[] = [];
  private performanceHistory: Array<{
    timestamp: Date;
    metrics: PerformanceMetrics;
  }> = [];
  private readonly maxHistorySize = 1000;

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    try {
      // Test basic connection
      const connectionStart = Date.now();
      await executeQueryWithStability(
        () => financeDB.queryRow`SELECT NOW() as current_time`,
        'health_check_connection'
      );
      const connectionResponseTime = Date.now() - connectionStart;
      
      // Gather health information in parallel
      const [tables, indexes, performance, resources] = await Promise.all([
        this.checkTableHealth(),
        this.checkIndexHealth(),
        this.getPerformanceMetrics(),
        this.getResourceUsage()
      ]);
      
      // Determine overall status
      const overallStatus = this.determineOverallStatus({
        connection: { status: 'healthy', responseTime: connectionResponseTime },
        tables,
        indexes,
        performance,
        resources
      });
      
      // Generate alerts
      const alerts = this.generateAlerts({
        connection: { status: 'healthy', responseTime: connectionResponseTime },
        tables,
        indexes,
        performance,
        resources
      });
      
      const healthStatus: HealthStatus = {
        overall_status: overallStatus,
        timestamp,
        connection: {
          status: 'healthy',
          responseTime: connectionResponseTime
        },
        tables,
        indexes,
        performance,
        resources,
        alerts
      };
      
      // Store performance metrics
      this.recordPerformanceMetrics(performance);
      
      return healthStatus;
    } catch (error) {
      console.error('Health check failed:', error);
      
      return {
        overall_status: 'unhealthy',
        timestamp,
        connection: {
          status: 'unhealthy',
          error: (error as Error).message
        },
        tables: [],
        indexes: [],
        performance: {
          averageQueryTime: 0,
          slowQueries: 0,
          connectionPool: { active: 0, idle: 0, total: 0 },
          cacheHitRatio: 0,
          errorRate: 1
        },
        resources: {
          databaseSize: '0 MB',
          tableCount: 0,
          indexCount: 0,
          connectionCount: 0
        },
        alerts: [{
          id: 'health_check_failed',
          type: 'health_check_failure',
          severity: 'critical',
          message: `Health check failed: ${(error as Error).message}`,
          timestamp: new Date()
        }]
      };
    }
  }

  /**
   * Check table health
   */
  private async checkTableHealth(): Promise<TableHealth[]> {
    const tables = ['organizations', 'users', 'properties', 'revenues', 'expenses', 'files', 'daily_approvals', 'notifications'];
    const results: TableHealth[] = [];
    
    for (const tableName of tables) {
      try {
        const [exists, stats] = await Promise.all([
          executeQueryWithStability(
            () => financeDB.queryRow`
              SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = ${tableName}
              ) as exists
            `,
            `check_table_exists_${tableName}`
          ),
          executeQueryWithStability(
            () => financeDB.queryRow`
              SELECT 
                COUNT(*) as row_count,
                pg_size_pretty(pg_total_relation_size(${tableName})) as table_size,
                (SELECT last_analyze FROM pg_stat_user_tables WHERE relname = ${tableName}) as last_analyzed
            `,
            `get_table_stats_${tableName}`
          ).catch(() => null)
        ]);
        
        results.push({
          name: tableName,
          exists: exists?.exists || false,
          rowCount: stats?.row_count,
          size: stats?.table_size,
          lastAnalyzed: stats?.last_analyzed ? new Date(stats.last_analyzed) : undefined
        });
      } catch (error) {
        results.push({
          name: tableName,
          exists: false,
          error: (error as Error).message
        });
      }
    }
    
    return results;
  }

  /**
   * Check index health
   */
  private async checkIndexHealth(): Promise<IndexHealth[]> {
    try {
      const indexes = await executeQueryWithStability(
        () => financeDB.queryAll`
          SELECT 
            i.indexname as name,
            i.tablename as table,
            pg_size_pretty(pg_relation_size(i.indexname::regclass)) as size,
            s.idx_scan as usage
          FROM pg_indexes i
          LEFT JOIN pg_stat_user_indexes s ON i.indexname = s.indexrelname
          WHERE i.schemaname = 'public'
          ORDER BY i.tablename, i.indexname
        `,
        'check_index_health'
      );
      
      return indexes.map((idx: any) => ({
        name: idx.name,
        table: idx.table,
        exists: true,
        size: idx.size,
        usage: idx.usage || 0
      }));
    } catch (error) {
      console.error('Error checking index health:', error);
      return [];
    }
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      const [queryStats, connectionStats, cacheStats] = await Promise.all([
        executeQueryWithStability(
          () => financeDB.queryRow`
            SELECT 
              AVG(mean_exec_time) as avg_query_time,
              COUNT(*) FILTER (WHERE mean_exec_time > 1000) as slow_queries
            FROM pg_stat_statements
            WHERE query NOT LIKE '%pg_stat_statements%'
          `,
          'get_query_performance_stats'
        ).catch(() => ({ avg_query_time: 0, slow_queries: 0 })),
        
        executeQueryWithStability(
          () => financeDB.queryRow`
            SELECT 
              COUNT(*) FILTER (WHERE state = 'active') as active_connections,
              COUNT(*) FILTER (WHERE state = 'idle') as idle_connections,
              COUNT(*) as total_connections
            FROM pg_stat_activity
            WHERE datname = current_database()
          `,
          'get_connection_stats'
        ).catch(() => ({ active_connections: 0, idle_connections: 0, total_connections: 0 })),
        
        executeQueryWithStability(
          () => financeDB.queryRow`
            SELECT 
              round(100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2) as cache_hit_ratio
            FROM pg_stat_database 
            WHERE datname = current_database()
          `,
          'get_cache_stats'
        ).catch(() => ({ cache_hit_ratio: 0 }))
      ]);
      
      // Get connection metrics from connection stability system
      const connectionMetrics = getConnectionMetrics();
      
      return {
        averageQueryTime: queryStats.avg_query_time || 0,
        slowQueries: queryStats.slow_queries || 0,
        connectionPool: {
          active: connectionStats.active_connections || 0,
          idle: connectionStats.idle_connections || 0,
          total: connectionStats.total_connections || 0
        },
        cacheHitRatio: cacheStats.cache_hit_ratio || 0,
        errorRate: connectionMetrics.errorRate
      };
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return {
        averageQueryTime: 0,
        slowQueries: 0,
        connectionPool: { active: 0, idle: 0, total: 0 },
        cacheHitRatio: 0,
        errorRate: 0
      };
    }
  }

  /**
   * Get resource usage
   */
  private async getResourceUsage(): Promise<ResourceUsage> {
    try {
      const stats = await executeQueryWithStability(
        () => financeDB.queryRow`
          SELECT 
            pg_size_pretty(pg_database_size(current_database())) as database_size,
            (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count,
            (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as index_count,
            (SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database()) as connection_count
        `,
        'get_resource_usage'
      );
      
      return {
        databaseSize: stats.database_size || '0 MB',
        tableCount: stats.table_count || 0,
        indexCount: stats.index_count || 0,
        connectionCount: stats.connection_count || 0
      };
    } catch (error) {
      console.error('Error getting resource usage:', error);
      return {
        databaseSize: '0 MB',
        tableCount: 0,
        indexCount: 0,
        connectionCount: 0
      };
    }
  }

  /**
   * Determine overall health status
   */
  private determineOverallStatus(health: Partial<HealthStatus>): HealthStatus['overall_status'] {
    // Check for critical issues
    if (health.connection?.status === 'unhealthy') {
      return 'unhealthy';
    }
    
    // Check for degraded performance
    if (health.performance) {
      if (health.performance.errorRate > 0.1 || health.performance.averageQueryTime > 1000) {
        return 'degraded';
      }
    }
    
    // Check for missing critical tables
    if (health.tables) {
      const criticalTables = ['organizations', 'users', 'properties', 'revenues', 'expenses'];
      const missingCriticalTables = criticalTables.filter(tableName => 
        !health.tables?.find(t => t.name === tableName && t.exists)
      );
      
      if (missingCriticalTables.length > 0) {
        return 'unhealthy';
      }
    }
    
    return 'healthy';
  }

  /**
   * Generate alerts based on health status
   */
  private generateAlerts(health: Partial<HealthStatus>): Alert[] {
    const alerts: Alert[] = [];
    
    // Connection alerts
    if (health.connection?.status === 'unhealthy') {
      alerts.push({
        id: 'connection_unhealthy',
        type: 'connection_issue',
        severity: 'critical',
        message: `Database connection is unhealthy: ${health.connection.error}`,
        timestamp: new Date()
      });
    }
    
    // Performance alerts
    if (health.performance) {
      if (health.performance.errorRate > 0.1) {
        alerts.push({
          id: 'high_error_rate',
          type: 'performance_issue',
          severity: 'error',
          message: `High error rate detected: ${(health.performance.errorRate * 100).toFixed(1)}%`,
          timestamp: new Date(),
          metadata: { errorRate: health.performance.errorRate }
        });
      }
      
      if (health.performance.averageQueryTime > 1000) {
        alerts.push({
          id: 'slow_queries',
          type: 'performance_issue',
          severity: 'warning',
          message: `Slow queries detected: average response time ${health.performance.averageQueryTime.toFixed(0)}ms`,
          timestamp: new Date(),
          metadata: { averageQueryTime: health.performance.averageQueryTime }
        });
      }
      
      if (health.performance.cacheHitRatio < 0.9) {
        alerts.push({
          id: 'low_cache_hit_ratio',
          type: 'performance_issue',
          severity: 'warning',
          message: `Low cache hit ratio: ${health.performance.cacheHitRatio.toFixed(1)}%`,
          timestamp: new Date(),
          metadata: { cacheHitRatio: health.performance.cacheHitRatio }
        });
      }
    }
    
    // Table alerts
    if (health.tables) {
      const missingTables = health.tables.filter(t => !t.exists);
      if (missingTables.length > 0) {
        alerts.push({
          id: 'missing_tables',
          type: 'schema_issue',
          severity: 'error',
          message: `Missing tables detected: ${missingTables.map(t => t.name).join(', ')}`,
          timestamp: new Date(),
          metadata: { missingTables: missingTables.map(t => t.name) }
        });
      }
    }
    
    return alerts;
  }

  /**
   * Record performance metrics for trend analysis
   */
  private recordPerformanceMetrics(metrics: PerformanceMetrics): void {
    this.performanceHistory.push({
      timestamp: new Date(),
      metrics
    });
    
    // Keep only recent history
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory = this.performanceHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(hours: number = 24): Array<{
    timestamp: Date;
    metrics: PerformanceMetrics;
  }> {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.performanceHistory.filter(entry => entry.timestamp >= cutoffTime);
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(hours: number = 24): PerformanceReport {
    const trends = this.getPerformanceTrends(hours);
    
    if (trends.length === 0) {
      return {
        summary: {
          totalQueries: 0,
          averageResponseTime: 0,
          successRate: 0,
          errorRate: 0
        },
        topQueries: [],
        performanceTrends: {
          responseTimeTrend: [],
          errorRateTrend: [],
          throughputTrend: []
        },
        recommendations: ['Insufficient data for performance analysis']
      };
    }
    
    const summary = {
      totalQueries: trends.length,
      averageResponseTime: trends.reduce((sum, t) => sum + t.metrics.averageQueryTime, 0) / trends.length,
      successRate: trends.reduce((sum, t) => sum + (1 - t.metrics.errorRate), 0) / trends.length,
      errorRate: trends.reduce((sum, t) => sum + t.metrics.errorRate, 0) / trends.length
    };
    
    const performanceTrends = {
      responseTimeTrend: trends.map(t => t.metrics.averageQueryTime),
      errorRateTrend: trends.map(t => t.metrics.errorRate),
      throughputTrend: trends.map(t => t.metrics.connectionPool.total)
    };
    
    const recommendations = this.generateRecommendations(summary, performanceTrends);
    
    return {
      summary,
      topQueries: [], // Would be populated from query analysis
      performanceTrends,
      recommendations
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(summary: any, trends: any): string[] {
    const recommendations: string[] = [];
    
    if (summary.averageResponseTime > 500) {
      recommendations.push('Consider optimizing slow queries or adding indexes');
    }
    
    if (summary.errorRate > 0.05) {
      recommendations.push('Investigate and fix database errors');
    }
    
    if (trends.responseTimeTrend.length > 1) {
      const trend = trends.responseTimeTrend[trends.responseTimeTrend.length - 1] - trends.responseTimeTrend[0];
      if (trend > 100) {
        recommendations.push('Performance is degrading over time - investigate resource usage');
      }
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Database performance is within acceptable ranges');
    }
    
    return recommendations;
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): Alert[] {
    return this.alerts;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
    }
  }

  /**
   * Clear resolved alerts
   */
  clearResolvedAlerts(): void {
    this.alerts = this.alerts.filter(a => !a.resolved);
  }
}

/**
 * Global health monitor instance
 */
export const healthMonitor = new HealthMonitor();

/**
 * Utility functions for health monitoring
 */

/**
 * Perform comprehensive health check
 */
export async function performHealthCheck(): Promise<HealthStatus> {
  return healthMonitor.performHealthCheck();
}

/**
 * Get performance report
 */
export function getPerformanceReport(hours: number = 24): PerformanceReport {
  return healthMonitor.generatePerformanceReport(hours);
}

/**
 * Get all alerts
 */
export function getAllAlerts(): Alert[] {
  return healthMonitor.getAllAlerts();
}

/**
 * Resolve an alert
 */
export function resolveAlert(alertId: string): void {
  healthMonitor.resolveAlert(alertId);
}

/**
 * Clear resolved alerts
 */
export function clearResolvedAlerts(): void {
  healthMonitor.clearResolvedAlerts();
}
