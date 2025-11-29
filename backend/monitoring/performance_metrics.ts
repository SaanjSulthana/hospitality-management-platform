import { api } from "encore.dev/api";
import { distributedCache } from "../cache/distributed_cache_manager";
import { asyncCacheInvalidator } from "../cache/async_invalidator";
import { getCorrectionQueueStats } from "../reports/correction_queue";
import { databaseCircuitBreaker, cacheCircuitBreaker, pubsubCircuitBreaker } from "../shared/resilience/circuit_breaker";

interface PerformanceMetrics {
  cacheHitRate: number;
  avgQueryTime: number;
  pubsubLatency: number;
  correctionQueueSize: number;
  circuitBreakerStatus: Record<string, string>;
  cacheInvalidationStats: any;
  memoryUsage: number;
  activeConnections: number;
}

export const getPerformanceMetrics = api(
  { expose: true, method: "GET", path: "/monitoring/performance" },
  async (): Promise<PerformanceMetrics> => {
    try {
      // Collect metrics from various services
      const cacheStats = await distributedCache.getCacheStats();
      const invalidationStats = asyncCacheInvalidator.getDetailedStats();
      const correctionStats = await getCorrectionQueueStats();
      
      return {
        cacheHitRate: cacheStats.hitRate,
        avgQueryTime: 0, // Would be calculated from actual query metrics
        pubsubLatency: 0, // Would be calculated from actual pub/sub metrics
        correctionQueueSize: correctionStats.queueSize,
        circuitBreakerStatus: {
          database: databaseCircuitBreaker.getState(),
          cache: cacheCircuitBreaker.getState(),
          pubsub: pubsubCircuitBreaker.getState(),
        },
        cacheInvalidationStats: invalidationStats,
        memoryUsage: cacheStats.memoryUsage,
        activeConnections: 0, // Would be calculated from actual connection metrics
      };
    } catch (error) {
      console.error('[PerformanceMetrics] Error collecting metrics:', error);
      throw error;
    }
  }
);

// Health check endpoint
export const healthCheck = api(
  { expose: true, method: "GET", path: "/monitoring/health" },
  async (): Promise<{
    status: string;
    timestamp: string;
    services: Record<string, any>;
  }> => {
    const timestamp = new Date().toISOString();
    
    try {
      // Check cache health
      const cacheHealth = await distributedCache.getCacheStats();
      
      // Check invalidation queue health
      const invalidationHealth = await asyncCacheInvalidator.healthCheck();
      
      // Check circuit breakers
      const circuitBreakerHealth = {
        database: databaseCircuitBreaker.getState(),
        cache: cacheCircuitBreaker.getState(),
        pubsub: pubsubCircuitBreaker.getState(),
      };
      
      const allHealthy = Object.values(circuitBreakerHealth).every(state => state === 'CLOSED') &&
                         invalidationHealth.healthy;
      
      return {
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp,
        services: {
          cache: cacheHealth,
          invalidation: invalidationHealth,
          circuitBreakers: circuitBreakerHealth,
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp,
        services: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
);

// Detailed system metrics
export const getSystemMetrics = api(
  { expose: true, method: "GET", path: "/monitoring/system" },
  async (): Promise<{
    cache: any;
    invalidation: any;
    correction: any;
    circuitBreakers: any;
  }> => {
    try {
      const cacheStats = await distributedCache.getCacheStats();
      const invalidationStats = asyncCacheInvalidator.getDetailedStats();
      const correctionStats = await getCorrectionQueueStats();
      
      return {
        cache: cacheStats,
        invalidation: invalidationStats,
        correction: correctionStats,
        circuitBreakers: {
          database: databaseCircuitBreaker.getStats(),
          cache: cacheCircuitBreaker.getStats(),
          pubsub: pubsubCircuitBreaker.getStats(),
        }
      };
    } catch (error) {
      console.error('[SystemMetrics] Error collecting system metrics:', error);
      throw error;
    }
  }
);
