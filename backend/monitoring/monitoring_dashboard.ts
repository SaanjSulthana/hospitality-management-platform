import { api } from "encore.dev/api";
import { replicaManager } from "../database/replica_manager";
import { reportsCache, balanceCache, summaryCache } from "../cache/redis_cache_service";
import { asyncCacheInvalidator } from "../cache/async_invalidator";
import { metricsCollector } from "./metrics_collector";
import { alertingSystem } from "./alerting_system";
import { v1Path } from "../shared/http";

// Comprehensive system health dashboard
export interface SystemHealthDashboard {
  timestamp: string;
  overallStatus: 'healthy' | 'degraded' | 'critical';
  components: {
    cache: {
      status: 'healthy' | 'degraded' | 'down';
      backend: 'redis' | 'memory';
      details: any;
    };
    database: {
      status: 'healthy' | 'degraded' | 'down';
      replicas: any;
      connections: any;
    };
    partitions: {
      status: 'healthy' | 'disabled';
      enabled: boolean;
      count: number;
    };
    invalidation: {
      status: 'healthy' | 'warning' | 'critical';
      queueSize: number;
      stats: any;
    };
  };
  alerts: {
    active: number;
    critical: number;
    warning: number;
  };
  metrics: {
    cache: any;
    database: any;
    partitions: any;
  };
}

async function getSystemHealthDashboardHandler(): Promise<SystemHealthDashboard> {
    try {
      // Collect all system data
      const [
        cacheStats,
        replicaHealth,
        replicaLag,
        connectionStats,
        invalidationStats,
        aggregatedMetrics,
        alertStats,
      ] = await Promise.all([
        Promise.all([
          reportsCache.getStats(),
          balanceCache.getStats(),
          summaryCache.getStats(),
        ]),
        replicaManager.hasReadReplicas() ? replicaManager.checkReplicaHealth() : Promise.resolve(new Map()),
        replicaManager.hasReadReplicas() ? replicaManager.getReplicaLag() : Promise.resolve(new Map()),
        replicaManager.getConnectionPoolStats(),
        asyncCacheInvalidator.getDetailedStats(),
        metricsCollector.getAllMetrics(),
        alertingSystem.getAlertStats(),
      ]);

      // Determine cache status
      const cacheBackend = cacheStats[0].type;
      const cacheAvailable = cacheStats[0].available;
      const cacheStatus = cacheAvailable ? 'healthy' : 'degraded';

      // Determine database status
      const replicaHealthy = Array.from(replicaHealth.values()).filter(h => h).length;
      const replicaTotal = replicaHealth.size;
      const databaseStatus = 
        replicaTotal === 0 ? 'healthy' : // No replicas configured
        replicaHealthy === replicaTotal ? 'healthy' :
        replicaHealthy > 0 ? 'degraded' : 'down';

      // Determine partition status
      const partitionsEnabled = process.env.USE_PARTITIONED_TABLES === 'true';
      const partitionStatus = partitionsEnabled ? 'healthy' : 'disabled';

      // Determine invalidation status
      const queueSize = invalidationStats.queueSize;
      const invalidationStatus = 
        queueSize < 1000 ? 'healthy' :
        queueSize < 5000 ? 'warning' : 'critical';

      // Determine overall status
      const componentStatuses = [cacheStatus, databaseStatus, partitionStatus, invalidationStatus];
      const overallStatus = 
        componentStatuses.includes('critical') || componentStatuses.includes('down') ? 'critical' :
        componentStatuses.includes('degraded') || componentStatuses.includes('warning') ? 'degraded' :
        'healthy';

      return {
        timestamp: new Date().toISOString(),
        overallStatus,
        components: {
          cache: {
            status: cacheStatus,
            backend: cacheBackend,
            details: {
              reports: cacheStats[0],
              balance: cacheStats[1],
              summary: cacheStats[2],
            },
          },
          database: {
            status: databaseStatus,
            replicas: {
              enabled: replicaManager.hasReadReplicas(),
              total: replicaTotal,
              healthy: replicaHealthy,
              lag: Object.fromEntries(replicaLag),
            },
            connections: connectionStats,
          },
          partitions: {
            status: partitionStatus,
            enabled: partitionsEnabled,
            count: aggregatedMetrics['partition.count']?.value || 0,
          },
          invalidation: {
            status: invalidationStatus,
            queueSize: queueSize,
            stats: invalidationStats,
          },
        },
        alerts: {
          active: alertStats.active,
          critical: alertStats.critical,
          warning: alertStats.warning,
        },
        metrics: {
          cache: {
            entries: {
              reports: aggregatedMetrics['cache.reports.entries']?.value || 0,
              balance: aggregatedMetrics['cache.balance.entries']?.value || 0,
              summary: aggregatedMetrics['cache.summary.entries']?.value || 0,
            },
            redis: {
              connected: (aggregatedMetrics['cache.redis.connected']?.value || 0) === 1,
              keys: aggregatedMetrics['cache.redis.keys']?.value || 0,
            },
          },
          database: {
            primary: {
              connections: {
                total: aggregatedMetrics['db.primary.connections.total']?.value || 0,
                active: aggregatedMetrics['db.primary.connections.active']?.value || 0,
                idle: aggregatedMetrics['db.primary.connections.idle']?.value || 0,
              },
            },
            replicas: {
              count: aggregatedMetrics['replica.total.count']?.value || 0,
              healthy: aggregatedMetrics['replica.healthy.count']?.value || 0,
              maxLag: aggregatedMetrics['replica.lag.max']?.value || 0,
            },
          },
          partitions: {
            enabled: (aggregatedMetrics['partition.enabled']?.value || 0) === 1,
            count: aggregatedMetrics['partition.count']?.value || 0,
          },
        },
      };
    } catch (error) {
      console.error('[MonitoringDashboard] Error generating dashboard:', error);
      
      return {
        timestamp: new Date().toISOString(),
        overallStatus: 'critical',
        components: {
          cache: { status: 'down', backend: 'memory', details: {} },
          database: { status: 'down', replicas: {}, connections: {} },
          partitions: { status: 'disabled', enabled: false, count: 0 },
          invalidation: { status: 'critical', queueSize: 0, stats: {} },
        },
        alerts: { active: 0, critical: 0, warning: 0 },
        metrics: { cache: {}, database: {}, partitions: {} },
      };
    }
  }

export const getSystemHealthDashboard = api(
  { expose: true, method: "GET", path: "/monitoring/dashboard" },
  getSystemHealthDashboardHandler
);

export const getSystemHealthDashboardV1 = api(
  { expose: true, method: "GET", path: "/v1/system/monitoring/dashboard" },
  getSystemHealthDashboardHandler
);

// Simplified health check for load balancers
async function healthCheckSimpleHandler(): Promise<{
    status: 'ok' | 'degraded' | 'error';
    timestamp: string;
  }> {
    try {
      const dashboard = await getSystemHealthDashboard();
      
      return {
        status: dashboard.overallStatus === 'healthy' ? 'ok' :
                dashboard.overallStatus === 'degraded' ? 'degraded' : 'error',
        timestamp: dashboard.timestamp,
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
      };
    }
  }

export const healthCheckSimple = api(
  { expose: true, method: "GET", path: "/health" },
  healthCheckSimpleHandler
);

export const healthCheckSimpleV1 = api(
  { expose: true, method: "GET", path: "/v1/system/health" },
  healthCheckSimpleHandler
);

// Readiness check (for Kubernetes/orchestration)
async function readinessCheckHandler(): Promise<{
    ready: boolean;
    timestamp: string;
    checks: Record<string, boolean>;
  }> {
    const checks: Record<string, boolean> = {
      cache: false,
      database: false,
      metrics: false,
    };

    try {
      // Check cache
      const cacheStats = await reportsCache.getStats();
      checks.cache = true;

      // Check database
      const connectionStats = await replicaManager.getConnectionPoolStats();
      checks.database = connectionStats.primary !== undefined;

      // Check metrics
      checks.metrics = metricsCollector.getAllMetrics() !== null;

      const ready = Object.values(checks).every(c => c);

      return {
        ready,
        timestamp: new Date().toISOString(),
        checks,
      };
    } catch (error) {
      return {
        ready: false,
        timestamp: new Date().toISOString(),
        checks,
      };
    }
  }

export const readinessCheck = api(
  { expose: true, method: "GET", path: "/ready" },
  readinessCheckHandler
);

export const readinessCheckV1 = api(
  { expose: true, method: "GET", path: "/v1/system/ready" },
  readinessCheckHandler
);

// Liveness check (for Kubernetes/orchestration)
async function livenessCheckHandler(): Promise<{
    alive: boolean;
    timestamp: string;
  }> {
    // Simple check - if this endpoint responds, the service is alive
    return {
      alive: true,
      timestamp: new Date().toISOString(),
    };
  }

export const livenessCheck = api(
  { expose: true, method: "GET", path: "/live" },
  livenessCheckHandler
);

export const livenessCheckV1 = api(
  { expose: true, method: "GET", path: "/v1/system/live" },
  livenessCheckHandler
);

