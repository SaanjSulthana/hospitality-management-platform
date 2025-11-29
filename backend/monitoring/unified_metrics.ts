// Unified Metrics - Centralized monitoring dashboard for all system metrics
// Target: Single endpoint for monitoring partitions, cache, replicas, and overall health

import { api } from "encore.dev/api";
import { v1Path } from "../shared/http";

export interface UnifiedMetrics {
  system: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    timestamp: string;
  };
  partitions: {
    enabled: boolean;
    synced: boolean;
    switchoverReady: boolean;
    tables: {
      name: string;
      rowCountDelta: number;
      status: string;
    }[];
  };
  cache: {
    type: 'redis' | 'memory';
    available: boolean;
    hitRate: number;
    totalEntries: number;
    invalidationsPerSecond: number;
  };
  database: {
    replicasEnabled: boolean;
    replicaCount: number;
    maxReplicaLag: number;
    avgReplicaLag: number;
    connectionPoolUtilization: number;
  };
  alerts: {
    critical: number;
    warning: number;
    info: number;
    recentAlerts: {
      level: 'critical' | 'warning' | 'info';
      source: string;
      message: string;
      timestamp: string;
    }[];
  };
}

export interface MetricsAlert {
  id: string;
  level: 'critical' | 'warning' | 'info';
  source: 'partition' | 'cache' | 'replica' | 'system';
  message: string;
  value?: number;
  threshold?: number;
  timestamp: string;
  acknowledged: boolean;
}

// Alert history storage (in production, use Redis or database)
const alertHistory: MetricsAlert[] = [];
const MAX_ALERT_HISTORY = 100;

// Get unified metrics dashboard
async function getUnifiedMetricsHandler(): Promise<UnifiedMetrics> {
    const startTime = Date.now();

    // Fetch partition metrics
    let partitionMetrics: any = {
      enabled: false,
      synced: false,
      switchoverReady: false,
      tables: []
    };

    try {
      const { getPartitionMetrics } = await import('./partition_metrics');
      const partitionData = await getPartitionMetrics({});
      partitionMetrics = {
        enabled: partitionData.partitionedTablesEnabled,
        synced: partitionData.tables.every(t => t.lastSyncStatus === 'synced'),
        switchoverReady: partitionData.switchoverReadiness.ready,
        tables: partitionData.tables.map(t => ({
          name: t.name,
          rowCountDelta: t.rowCountDelta,
          status: t.lastSyncStatus
        }))
      };
    } catch (error) {
      console.error('[UnifiedMetrics] Error fetching partition metrics:', error);
    }

    // Fetch cache metrics
    let cacheMetrics: any = {
      type: 'memory',
      available: false,
      hitRate: 0,
      totalEntries: 0,
      invalidationsPerSecond: 0
    };

    try {
      const { getCacheInvalidationMetrics } = await import('./cache_invalidation_metrics');
      const cacheData = await getCacheInvalidationMetrics({});
      cacheMetrics = {
        type: cacheData.cacheType,
        available: cacheData.cacheAvailable,
        hitRate: cacheData.cacheHitStats.hitRate,
        totalEntries: cacheData.cacheSize.totalEntries,
        invalidationsPerSecond: cacheData.invalidationStats.invalidationsPerSecond
      };
    } catch (error) {
      console.error('[UnifiedMetrics] Error fetching cache metrics:', error);
    }

    // Fetch replica metrics
    let databaseMetrics: any = {
      replicasEnabled: false,
      replicaCount: 0,
      maxReplicaLag: 0,
      avgReplicaLag: 0,
      connectionPoolUtilization: 0
    };

    try {
      const { replicaHealthCheck, getReplicaLag, getConnectionPoolStats } = await import('../database/replica_monitoring');
      const [healthData, lagData, poolStats] = await Promise.all([
        replicaHealthCheck(),
        getReplicaLag(),
        getConnectionPoolStats()
      ]);

      const maxLag = lagData.replicas.length > 0
        ? Math.max(...lagData.replicas.map(r => r.lagSeconds))
        : 0;
      const avgLag = lagData.replicas.length > 0
        ? lagData.replicas.reduce((sum, replica) => sum + replica.lagSeconds, 0) / lagData.replicas.length
        : 0;

      databaseMetrics = {
        replicasEnabled: healthData.replicasEnabled,
        replicaCount: healthData.replicaCount,
        maxReplicaLag: maxLag,
        avgReplicaLag: avgLag,
        connectionPoolUtilization: 0 // TODO: Derive from poolStats when detailed metrics available
      };
    } catch (error) {
      console.error('[UnifiedMetrics] Error fetching database metrics:', error);
    }

    // Collect alerts from all sources
    const allAlerts: MetricsAlert[] = [];

    // Partition alerts
    if (partitionMetrics.enabled && !partitionMetrics.synced) {
      allAlerts.push({
        id: `partition-sync-${Date.now()}`,
        level: 'warning',
        source: 'partition',
        message: 'Partitioned tables are out of sync with legacy tables',
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    }

    // Cache alerts
    if (!cacheMetrics.available) {
      allAlerts.push({
        id: `cache-unavailable-${Date.now()}`,
        level: 'critical',
        source: 'cache',
        message: 'Redis cache is unavailable, using in-memory fallback',
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    }

    if (cacheMetrics.hitRate < 50) {
      allAlerts.push({
        id: `cache-low-hitrate-${Date.now()}`,
        level: 'warning',
        source: 'cache',
        message: `Low cache hit rate: ${cacheMetrics.hitRate}%`,
        value: cacheMetrics.hitRate,
        threshold: 50,
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    }

    // Replica alerts
    if (databaseMetrics.replicasEnabled && databaseMetrics.maxReplicaLag > 30) {
      allAlerts.push({
        id: `replica-lag-${Date.now()}`,
        level: 'critical',
        source: 'replica',
        message: `High replica lag: ${databaseMetrics.maxReplicaLag}s`,
        value: databaseMetrics.maxReplicaLag,
        threshold: 30,
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    }

    // Store alerts in history
    allAlerts.forEach(alert => {
      alertHistory.unshift(alert);
      if (alertHistory.length > MAX_ALERT_HISTORY) {
        alertHistory.pop();
      }
    });

    // Count alerts by level
    const criticalCount = allAlerts.filter(a => a.level === 'critical').length;
    const warningCount = allAlerts.filter(a => a.level === 'warning').length;
    const infoCount = allAlerts.filter(a => a.level === 'info').length;

    // Determine overall system status
    let systemStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (criticalCount > 0) {
      systemStatus = 'unhealthy';
    } else if (warningCount > 0) {
      systemStatus = 'degraded';
    }

    const processingTime = Date.now() - startTime;

    return {
      system: {
        status: systemStatus,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      },
      partitions: partitionMetrics,
      cache: cacheMetrics,
      database: databaseMetrics,
      alerts: {
        critical: criticalCount,
        warning: warningCount,
        info: infoCount,
        recentAlerts: allAlerts.slice(0, 10).map(a => ({
          level: a.level,
          source: a.source,
          message: a.message,
          timestamp: a.timestamp
        }))
      }
    };
  }

export const getUnifiedMetrics = api<{}, UnifiedMetrics>(
  { auth: false, expose: true, method: "GET", path: "/monitoring/unified/metrics" },
  getUnifiedMetricsHandler
);

export const getUnifiedMetricsV1 = api<{}, UnifiedMetrics>(
  { auth: false, expose: true, method: "GET", path: "/v1/system/monitoring/unified/metrics" },
  getUnifiedMetricsHandler
);

// Get alert history
// Get system health summary
async function getSystemHealthHandler(): Promise<{
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    name: string;
    passed: boolean;
    message: string;
  }[];
  timestamp: string;
}> {
    const checks = [];

    // Check partition sync
    try {
      const { getPartitionMetrics } = await import('./partition_metrics');
      const partitionData = await getPartitionMetrics({});
      const synced = partitionData.tables.every(t => t.lastSyncStatus === 'synced');
      checks.push({
        name: 'Partition Sync',
        passed: !partitionData.partitionedTablesEnabled || synced,
        message: synced ? 'All tables synced' : 'Some tables out of sync'
      });
    } catch (error) {
      checks.push({
        name: 'Partition Sync',
        passed: false,
        message: 'Failed to check partition sync'
      });
    }

    // Check cache availability
    try {
      const { getCacheInvalidationMetrics } = await import('./cache_invalidation_metrics');
      const cacheData = await getCacheInvalidationMetrics({});
      checks.push({
        name: 'Cache Availability',
        passed: cacheData.cacheAvailable,
        message: cacheData.cacheAvailable ? 'Cache is available' : 'Cache unavailable'
      });
    } catch (error) {
      checks.push({
        name: 'Cache Availability',
        passed: false,
        message: 'Failed to check cache'
      });
    }

    // Check replica health
    try {
      const { replicaHealthCheck } = await import('../database/replica_monitoring');
      const replicaData = await replicaHealthCheck();
      checks.push({
        name: 'Replica Health',
        passed: replicaData.healthy,
        message: replicaData.healthy ? 'All replicas healthy' : 'Some replicas unhealthy'
      });
    } catch (error) {
      checks.push({
        name: 'Replica Health',
        passed: true, // Pass if replicas not configured
        message: 'Replicas not configured or check failed'
      });
    }

    const allPassed = checks.every(c => c.passed);
    const criticalFailed = checks.filter(c => !c.passed && c.name.includes('Cache')).length > 0;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (criticalFailed) {
      status = 'unhealthy';
    } else if (!allPassed) {
      status = 'degraded';
    }

    return {
      healthy: allPassed,
      status,
      checks,
      timestamp: new Date().toISOString()
    };
  }

export const getSystemHealth = api<{}, {
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    name: string;
    passed: boolean;
    message: string;
  }[];
  timestamp: string;
}>(
  { auth: false, expose: true, method: "GET", path: "/monitoring/unified/health" },
  getSystemHealthHandler
);

export const getSystemHealthV1 = api<{}, {
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    name: string;
    passed: boolean;
    message: string;
  }[];
  timestamp: string;
}>(
  { auth: false, expose: true, method: "GET", path: "/v1/system/monitoring/unified/health" },
  getSystemHealthHandler
);

console.log('[UnifiedMetrics] ✅ Unified metrics and alerting endpoints initialized');

