// Cache Invalidation Metrics - Monitor cache invalidation performance and health
// Target: Track invalidation rates, queue sizes, and cache hit rates

import { api } from "encore.dev/api";

export interface CacheInvalidationMetrics {
  cacheType: 'redis' | 'memory';
  cacheAvailable: boolean;
  invalidationStats: {
    totalInvalidations: number;
    invalidationsPerSecond: number;
    averageInvalidationTime: number;
    failedInvalidations: number;
    queuedInvalidations: number;
  };
  cacheHitStats: {
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
    missRate: number;
  };
  cacheSize: {
    totalEntries: number;
    memoryUsageMB: number;
    redisKeys?: number;
  };
  performance: {
    avgGetTime: number;
    avgSetTime: number;
    avgDeleteTime: number;
  };
  alerts: {
    level: 'info' | 'warning' | 'critical';
    message: string;
  }[];
  timestamp: string;
}

export interface CacheKeyStats {
  keyPattern: string;
  count: number;
  avgTTL: number;
  totalSizeBytes?: number;
}

// In-memory stats tracking
class CacheInvalidationStatsTracker {
  private stats = {
    totalInvalidations: 0,
    failedInvalidations: 0,
    invalidationTimes: [] as number[],
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    getTimes: [] as number[],
    setTimes: [] as number[],
    deleteTimes: [] as number[],
    startTime: Date.now()
  };

  recordInvalidation(success: boolean, durationMs: number) {
    this.stats.totalInvalidations++;
    if (!success) this.stats.failedInvalidations++;
    this.stats.invalidationTimes.push(durationMs);
    
    // Keep only last 1000 timings
    if (this.stats.invalidationTimes.length > 1000) {
      this.stats.invalidationTimes.shift();
    }
  }

  recordCacheAccess(hit: boolean, durationMs: number) {
    this.stats.totalRequests++;
    if (hit) {
      this.stats.cacheHits++;
    } else {
      this.stats.cacheMisses++;
    }
    this.stats.getTimes.push(durationMs);
    
    if (this.stats.getTimes.length > 1000) {
      this.stats.getTimes.shift();
    }
  }

  recordSet(durationMs: number) {
    this.stats.setTimes.push(durationMs);
    if (this.stats.setTimes.length > 1000) {
      this.stats.setTimes.shift();
    }
  }

  recordDelete(durationMs: number) {
    this.stats.deleteTimes.push(durationMs);
    if (this.stats.deleteTimes.length > 1000) {
      this.stats.deleteTimes.shift();
    }
  }

  getStats() {
    const uptime = (Date.now() - this.stats.startTime) / 1000; // seconds
    const invalidationsPerSecond = this.stats.totalInvalidations / uptime;

    const avgInvalidationTime = this.stats.invalidationTimes.length > 0
      ? this.stats.invalidationTimes.reduce((a, b) => a + b, 0) / this.stats.invalidationTimes.length
      : 0;

    const avgGetTime = this.stats.getTimes.length > 0
      ? this.stats.getTimes.reduce((a, b) => a + b, 0) / this.stats.getTimes.length
      : 0;

    const avgSetTime = this.stats.setTimes.length > 0
      ? this.stats.setTimes.reduce((a, b) => a + b, 0) / this.stats.setTimes.length
      : 0;

    const avgDeleteTime = this.stats.deleteTimes.length > 0
      ? this.stats.deleteTimes.reduce((a, b) => a + b, 0) / this.stats.deleteTimes.length
      : 0;

    const hitRate = this.stats.totalRequests > 0
      ? (this.stats.cacheHits / this.stats.totalRequests) * 100
      : 0;

    const missRate = 100 - hitRate;

    return {
      totalInvalidations: this.stats.totalInvalidations,
      invalidationsPerSecond: Math.round(invalidationsPerSecond * 100) / 100,
      averageInvalidationTime: Math.round(avgInvalidationTime * 100) / 100,
      failedInvalidations: this.stats.failedInvalidations,
      totalRequests: this.stats.totalRequests,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      hitRate: Math.round(hitRate * 100) / 100,
      missRate: Math.round(missRate * 100) / 100,
      avgGetTime: Math.round(avgGetTime * 100) / 100,
      avgSetTime: Math.round(avgSetTime * 100) / 100,
      avgDeleteTime: Math.round(avgDeleteTime * 100) / 100
    };
  }

  reset() {
    this.stats = {
      totalInvalidations: 0,
      failedInvalidations: 0,
      invalidationTimes: [],
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      getTimes: [],
      setTimes: [],
      deleteTimes: [],
      startTime: Date.now()
    };
  }
}

export const cacheStatsTracker = new CacheInvalidationStatsTracker();

// Shared handler for getting cache invalidation metrics
async function getCacheInvalidationMetricsHandler(): Promise<CacheInvalidationMetrics> {
    const stats = cacheStatsTracker.getStats();
    
    // Try to get Redis stats
    let cacheType: 'redis' | 'memory' = 'memory';
    let cacheAvailable = true;
    let totalEntries = 0;
    let memoryUsageMB = 0;
    let redisKeys = undefined;

    try {
      // Import cache services dynamically
      const { reportsCache } = await import('../cache/redis_cache_service');
      const redisStats = await reportsCache.getStats();
      
      cacheType = redisStats.type;
      cacheAvailable = redisStats.available;
      totalEntries = redisStats.memoryEntries;
      
      if (redisStats.redisInfo && redisStats.redisInfo.connected) {
        redisKeys = redisStats.redisInfo.keys;
      }
      
      // Rough estimate of memory usage (in MB)
      memoryUsageMB = Math.round(totalEntries * 0.001); // Estimate 1KB per entry
    } catch (error) {
      console.warn('[CacheInvalidationMetrics] Could not get Redis stats:', error);
    }

    // Generate alerts based on metrics
    const alerts: { level: 'info' | 'warning' | 'critical'; message: string; }[] = [];

    // Alert: Low hit rate
    if (stats.hitRate < 50 && stats.totalRequests > 100) {
      alerts.push({
        level: 'warning',
        message: `Low cache hit rate: ${stats.hitRate}% (< 50%)`
      });
    }

    // Alert: High invalidation failure rate
    if (stats.totalInvalidations > 0) {
      const failureRate = (stats.failedInvalidations / stats.totalInvalidations) * 100;
      if (failureRate > 10) {
        alerts.push({
          level: 'critical',
          message: `High invalidation failure rate: ${failureRate.toFixed(1)}% (> 10%)`
        });
      }
    }

    // Alert: Redis unavailable
    if (!cacheAvailable) {
      alerts.push({
        level: 'critical',
        message: 'Redis cache is unavailable, using in-memory fallback'
      });
    }

    // Alert: Slow cache operations
    if (stats.avgGetTime > 100) {
      alerts.push({
        level: 'warning',
        message: `Slow cache GET operations: ${stats.avgGetTime}ms avg (> 100ms)`
      });
    }

    if (stats.avgSetTime > 100) {
      alerts.push({
        level: 'warning',
        message: `Slow cache SET operations: ${stats.avgSetTime}ms avg (> 100ms)`
      });
    }

    // Info: High hit rate
    if (stats.hitRate >= 80 && stats.totalRequests > 100) {
      alerts.push({
        level: 'info',
        message: `Excellent cache hit rate: ${stats.hitRate}%`
      });
    }

    return {
      cacheType,
      cacheAvailable,
      invalidationStats: {
        totalInvalidations: stats.totalInvalidations,
        invalidationsPerSecond: stats.invalidationsPerSecond,
        averageInvalidationTime: stats.averageInvalidationTime,
        failedInvalidations: stats.failedInvalidations,
        queuedInvalidations: 0 // Will be populated from async invalidator if available
      },
      cacheHitStats: {
        totalRequests: stats.totalRequests,
        cacheHits: stats.cacheHits,
        cacheMisses: stats.cacheMisses,
        hitRate: stats.hitRate,
        missRate: stats.missRate
      },
      cacheSize: {
        totalEntries,
        memoryUsageMB,
        redisKeys
      },
      performance: {
        avgGetTime: stats.avgGetTime,
        avgSetTime: stats.avgSetTime,
        avgDeleteTime: stats.avgDeleteTime
      },
      alerts,
      timestamp: new Date().toISOString()
    };
}

// Get cache invalidation metrics

// LEGACY: Gets cache invalidation metrics (keep for backward compatibility)
export const getCacheInvalidationMetrics = api<{}, CacheInvalidationMetrics>(
  { auth: false, expose: true, method: "GET", path: "/monitoring/cache/invalidation-metrics" },
  getCacheInvalidationMetricsHandler
);

// V1: Gets cache invalidation metrics
export const getCacheInvalidationMetricsV1 = api<{}, CacheInvalidationMetrics>(
  { auth: false, expose: true, method: "GET", path: "/v1/system/monitoring/cache/invalidation-metrics" },
  getCacheInvalidationMetricsHandler
);

// Shared handler for resetting cache metrics
async function resetCacheMetricsHandler(): Promise<{ success: boolean; message: string }> {
    cacheStatsTracker.reset();
    return {
      success: true,
      message: 'Cache metrics reset successfully'
    };
}

// Reset cache metrics (for testing or maintenance)

// LEGACY: Resets cache metrics (keep for backward compatibility)
export const resetCacheMetrics = api<{}, { success: boolean; message: string }>(
  { auth: true, expose: true, method: "POST", path: "/monitoring/cache/reset-metrics" },
  resetCacheMetricsHandler
);

// V1: Resets cache metrics
export const resetCacheMetricsV1 = api<{}, { success: boolean; message: string }>(
  { auth: true, expose: true, method: "POST", path: "/v1/system/monitoring/cache/reset-metrics" },
  resetCacheMetricsHandler
);

// Shared handler for getting cache key statistics
async function getCacheKeyStatsHandler(): Promise<{ patterns: CacheKeyStats[]; timestamp: string }> {
    // This is a simplified version - in production, you'd scan Redis keys
    const patterns: CacheKeyStats[] = [
      {
        keyPattern: 'daily:*',
        count: 0, // Would be populated from Redis SCAN
        avgTTL: 120 // seconds
      },
      {
        keyPattern: 'monthly:*',
        count: 0,
        avgTTL: 300
      },
      {
        keyPattern: 'summary:*',
        count: 0,
        avgTTL: 600
      }
    ];

    return {
      patterns,
      timestamp: new Date().toISOString()
    };
}

// Get cache key statistics

// LEGACY: Gets cache key statistics (keep for backward compatibility)
export const getCacheKeyStats = api<{}, { patterns: CacheKeyStats[]; timestamp: string }>(
  { auth: true, expose: true, method: "GET", path: "/monitoring/cache/key-stats" },
  getCacheKeyStatsHandler
);

// V1: Gets cache key statistics
export const getCacheKeyStatsV1 = api<{}, { patterns: CacheKeyStats[]; timestamp: string }>(
  { auth: true, expose: true, method: "GET", path: "/v1/system/monitoring/cache/key-stats" },
  getCacheKeyStatsHandler
);

console.log('[CacheInvalidationMetrics] ✅ Cache invalidation monitoring endpoints initialized');

