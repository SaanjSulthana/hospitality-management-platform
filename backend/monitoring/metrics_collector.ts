import { api } from "encore.dev/api";
import { replicaManager } from "../database/replica_manager";
import { reportsCache, balanceCache, summaryCache } from "../cache/redis_cache_service";
import { asyncCacheInvalidator } from "../cache/async_invalidator";
import { v1Path } from "../shared/http";

// Request interfaces for path parameters
interface GetMetricHistoryRequest {
  name: string;
}

// Metrics storage (in production, this would use a time-series database)
interface MetricPoint {
  timestamp: number;
  value: number;
}

class MetricsCollector {
  private metrics = new Map<string, MetricPoint[]>();
  private readonly maxDataPoints = 1000; // Keep last 1000 data points per metric

  recordMetric(name: string, value: number): void {
    const points = this.metrics.get(name) || [];
    points.push({
      timestamp: Date.now(),
      value,
    });

    // Keep only recent data points
    if (points.length > this.maxDataPoints) {
      points.shift();
    }

    this.metrics.set(name, points);
  }

  getMetric(name: string, windowMs: number = 60000): {
    current: number;
    min: number;
    max: number;
    avg: number;
    count: number;
  } | null {
    const points = this.metrics.get(name);
    if (!points || points.length === 0) return null;

    const cutoff = Date.now() - windowMs;
    const recentPoints = points.filter(p => p.timestamp >= cutoff);

    if (recentPoints.length === 0) return null;

    const values = recentPoints.map(p => p.value);
    return {
      current: values[values.length - 1],
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      count: values.length,
    };
  }

  getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [name, points] of this.metrics) {
      if (points.length > 0) {
        const latest = points[points.length - 1];
        result[name] = {
          value: latest.value,
          timestamp: latest.timestamp,
        };
      }
    }
    return result;
  }

  clearMetrics(): void {
    this.metrics.clear();
  }
}

const metricsCollector = new MetricsCollector();

// Start metrics collection
function startMetricsCollection() {
  const interval = parseInt(process.env.METRICS_COLLECTION_INTERVAL || '60000'); // 1 minute

  setInterval(async () => {
    try {
      // Collect cache metrics
      await collectCacheMetrics();

      // Collect replica metrics
      await collectReplicaMetrics();

      // Collect partition metrics
      await collectPartitionMetrics();

      // Collect invalidation metrics
      await collectInvalidationMetrics();
    } catch (error) {
      console.error('[MetricsCollector] Error collecting metrics:', error);
    }
  }, interval);

  console.log(`[MetricsCollector] ✅ Started metrics collection (interval: ${interval}ms)`);
}

async function collectCacheMetrics() {
  try {
    const [reportsStats, balanceStats, summaryStats] = await Promise.all([
      reportsCache.getStats(),
      balanceCache.getStats(),
      summaryCache.getStats(),
    ]);

    // Record cache availability
    metricsCollector.recordMetric('cache.reports.available', reportsStats.available ? 1 : 0);
    metricsCollector.recordMetric('cache.balance.available', balanceStats.available ? 1 : 0);
    metricsCollector.recordMetric('cache.summary.available', summaryStats.available ? 1 : 0);

    // Record cache entries
    metricsCollector.recordMetric('cache.reports.entries', reportsStats.memoryEntries);
    metricsCollector.recordMetric('cache.balance.entries', balanceStats.memoryEntries);
    metricsCollector.recordMetric('cache.summary.entries', summaryStats.memoryEntries);

    // Record Redis-specific metrics
    if (reportsStats.redisInfo?.connected) {
      metricsCollector.recordMetric('cache.redis.connected', 1);
      metricsCollector.recordMetric('cache.redis.keys', reportsStats.redisInfo.keys);
    } else {
      metricsCollector.recordMetric('cache.redis.connected', 0);
    }
  } catch (error) {
    console.error('[MetricsCollector] Error collecting cache metrics:', error);
  }
}

async function collectReplicaMetrics() {
  try {
    if (!replicaManager.hasReadReplicas()) {
      metricsCollector.recordMetric('replica.enabled', 0);
      return;
    }

    metricsCollector.recordMetric('replica.enabled', 1);

    const [healthStatus, lagStatus, connectionStats] = await Promise.all([
      replicaManager.checkReplicaHealth(),
      replicaManager.getReplicaLag(),
      replicaManager.getConnectionPoolStats(),
    ]);

    // Record replica health
    const healthyCount = Array.from(healthStatus.values()).filter(h => h).length;
    metricsCollector.recordMetric('replica.healthy.count', healthyCount);
    metricsCollector.recordMetric('replica.unhealthy.count', healthStatus.size - healthyCount);
    metricsCollector.recordMetric('replica.total.count', healthStatus.size);

    // Record replica lag
    for (const [name, lagSeconds] of lagStatus) {
      metricsCollector.recordMetric(`replica.lag.${name}`, lagSeconds);
    }

    // Record max lag
    const maxLag = Math.max(...Array.from(lagStatus.values()).filter(l => l >= 0));
    if (maxLag >= 0) {
      metricsCollector.recordMetric('replica.lag.max', maxLag);
    }

    // Record connection pool stats
    if (connectionStats.primary) {
      metricsCollector.recordMetric('db.primary.connections.total', connectionStats.primary.total_connections || 0);
      metricsCollector.recordMetric('db.primary.connections.active', connectionStats.primary.active_connections || 0);
      metricsCollector.recordMetric('db.primary.connections.idle', connectionStats.primary.idle_connections || 0);
    }
  } catch (error) {
    console.error('[MetricsCollector] Error collecting replica metrics:', error);
  }
}

async function collectPartitionMetrics() {
  try {
    const usePartitions = process.env.USE_PARTITIONED_TABLES === 'true';
    metricsCollector.recordMetric('partition.enabled', usePartitions ? 1 : 0);

    if (usePartitions) {
      // In a real implementation, you would query partition statistics
      // For now, we'll record placeholder metrics
      metricsCollector.recordMetric('partition.count', 24); // 24 months of partitions
      metricsCollector.recordMetric('partition.maintenance.running', 0);
    }
  } catch (error) {
    console.error('[MetricsCollector] Error collecting partition metrics:', error);
  }
}

async function collectInvalidationMetrics() {
  try {
    const stats = asyncCacheInvalidator.getDetailedStats();

    metricsCollector.recordMetric('cache.invalidation.queue.size', stats.queueSize);
    metricsCollector.recordMetric('cache.invalidation.processing', stats.processing ? 1 : 0);
    metricsCollector.recordMetric('cache.invalidation.total', stats.totalInvalidated);
    metricsCollector.recordMetric('cache.invalidation.failed', stats.failedInvalidations);
    metricsCollector.recordMetric('cache.invalidation.retry.count', stats.retries);
  } catch (error) {
    console.error('[MetricsCollector] Error collecting invalidation metrics:', error);
  }
}

// Initialize metrics collection on module load
startMetricsCollection();

// API Endpoints

export interface MetricsResponse {
  timestamp: string;
  metrics: Record<string, any>;
}

async function getAllMetricsHandler(): Promise<MetricsResponse> {
    return {
      timestamp: new Date().toISOString(),
      metrics: metricsCollector.getAllMetrics(),
    };
  }

export const getAllMetrics = api(
  { expose: true, method: "GET", path: "/metrics/all" },
  getAllMetricsHandler
);

export const getAllMetricsV1 = api(
  { expose: true, method: "GET", path: "/v1/system/metrics/all" },
  getAllMetricsHandler
);

async function getMetricHistoryHandler({ name }: GetMetricHistoryRequest): Promise<{
    name: string;
    timestamp: string;
    data: any;
  }> {
    const windowMs = 3600000; // Last hour
    const data = metricsCollector.getMetric(name, windowMs);

    return {
      name,
      timestamp: new Date().toISOString(),
      data: data || { message: 'No data available' },
    };
  }

export const getMetricHistory = api<GetMetricHistoryRequest, { name: string; timestamp: string; data: any }>(
  { expose: true, method: "GET", path: "/metrics/:name" },
  getMetricHistoryHandler
);

export const getMetricHistoryV1 = api<GetMetricHistoryRequest, { name: string; timestamp: string; data: any }>(
  { expose: true, method: "GET", path: "/v1/system/metrics/:name" },
  getMetricHistoryHandler
);

export interface AggregatedMetricsResponse {
  timestamp: string;
  cache: {
    available: boolean;
    backend: 'redis' | 'memory';
    totalEntries: number;
    invalidationQueue: number;
  };
  database: {
    replicasEnabled: boolean;
    replicaCount: number;
    healthyReplicas: number;
    maxReplicaLag: number;
    primaryConnections: {
      total: number;
      active: number;
      idle: number;
    };
  };
  partitions: {
    enabled: boolean;
    count: number;
  };
}

async function getAggregatedMetricsHandler(): Promise<AggregatedMetricsResponse> {
    const allMetrics = metricsCollector.getAllMetrics();

    return {
      timestamp: new Date().toISOString(),
      cache: {
        available: (allMetrics['cache.redis.connected']?.value || 0) === 1,
        backend: (allMetrics['cache.redis.connected']?.value || 0) === 1 ? 'redis' : 'memory',
        totalEntries: 
          (allMetrics['cache.reports.entries']?.value || 0) +
          (allMetrics['cache.balance.entries']?.value || 0) +
          (allMetrics['cache.summary.entries']?.value || 0),
        invalidationQueue: allMetrics['cache.invalidation.queue.size']?.value || 0,
      },
      database: {
        replicasEnabled: (allMetrics['replica.enabled']?.value || 0) === 1,
        replicaCount: allMetrics['replica.total.count']?.value || 0,
        healthyReplicas: allMetrics['replica.healthy.count']?.value || 0,
        maxReplicaLag: allMetrics['replica.lag.max']?.value || 0,
        primaryConnections: {
          total: allMetrics['db.primary.connections.total']?.value || 0,
          active: allMetrics['db.primary.connections.active']?.value || 0,
          idle: allMetrics['db.primary.connections.idle']?.value || 0,
        },
      },
      partitions: {
        enabled: (allMetrics['partition.enabled']?.value || 0) === 1,
        count: allMetrics['partition.count']?.value || 0,
      },
    };
  }

export const getAggregatedMetrics = api(
  { expose: true, method: "GET", path: "/metrics/aggregated" },
  getAggregatedMetricsHandler
);

export const getAggregatedMetricsV1 = api(
  { expose: true, method: "GET", path: "/v1/system/metrics/aggregated" },
  getAggregatedMetricsHandler
);

// Export metrics collector for internal use
export { metricsCollector };

