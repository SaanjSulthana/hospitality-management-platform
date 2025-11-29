// Cache Service - Phase 3 Advanced Scaling
// Target: Centralized cache microservice for 1M+ organizations

import { api, APIError } from "encore.dev/api";
import { distributedCache } from "../../cache/distributed_cache_manager";
import { asyncCacheInvalidator } from "../../cache/async_invalidator";
import { getCacheBackend } from "../../cache/cache_factory";
import { TieredCache } from "../../cache/tiered_cache";

// Cache Service Interfaces
export interface CacheServiceRequest {
  key: string;
  data: any;
  ttl?: number; // TTL in milliseconds
  priority?: 'high' | 'medium' | 'low';
}

export interface CacheServiceResponse {
  success: boolean;
  data?: any;
  cached: boolean;
  processingTime: number;
}

export interface CacheInvalidationRequest {
  orgId: number;
  propertyId?: number;
  dates: string[];
  priority?: 'high' | 'medium' | 'low';
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  invalidations: number;
  memoryUsage: number;
  averageResponseTime: number;
  redisStats?: {
    type: 'redis' | 'memory';
    available: boolean;
    memoryEntries: number;
    redisInfo?: any;
  };
}

// Cache Service Class
const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error('Unknown error');
  }
};

interface CacheHealthResponse {
  service: string;
  version: string;
  status: 'healthy' | 'unhealthy';
  dependencies: any[];
  timestamp: string;
  uptime: number;
  tierMetrics?: {
    hits: number;
    misses: number;
    errors: number;
    lastHitTier?: string;
    latencyP50?: number;
    latencyP95?: number;
  };
}

export class CacheService {
  private serviceName = 'CacheService';
  private version = '1.0.0';
  private dependencies: string[] = ['ReportsCache', 'AsyncInvalidator'];
  private readonly initializedAt = Date.now();

  constructor() {
    console.log(`[${this.serviceName}] Initialized v${this.version}`);
  }

  // Get from Cache
  async get(key: string): Promise<CacheServiceResponse> {
    const startTime = Date.now();

    try {
      // Parse cache key to extract orgId, propertyId, date, type
      const keyParts = key.split(':');
      if (keyParts.length < 4) {
        throw new Error('Invalid cache key format');
      }

      const [type, orgId, propertyId, date] = keyParts;
      const orgIdNum = parseInt(orgId, 10);
      const parsedPropertyId = parseInt(propertyId, 10);
      const propertyIdNum = propertyId === 'all' || propertyId === 'undefined' || propertyId === '' || Number.isNaN(parsedPropertyId)
        ? undefined
        : parsedPropertyId;

      let data: any = null;
      let cached = false;

      // Route to appropriate cache based on type
      switch (type) {
        case 'daily':
          data = await distributedCache.getDailyReport(orgIdNum, propertyIdNum, date);
          cached = data !== null;
          break;
        case 'monthly':
          data = await distributedCache.getMonthlyReport(orgIdNum, propertyIdNum, date);
          cached = data !== null;
          break;
        case 'summary':
          data = await distributedCache.getSummary(orgIdNum, propertyIdNum, date);
          cached = data !== null;
          break;
        default:
          throw new Error(`Unknown cache type: ${type}`);
      }

      const processingTime = Date.now() - startTime;
      console.log(`[${this.serviceName}] Cache ${cached ? 'hit' : 'miss'} for key: ${key} in ${processingTime}ms`);

      return {
        success: true,
        data,
        cached,
        processingTime
      };
    } catch (error) {
      const err = normalizeError(error);
      console.error(`[${this.serviceName}] Error getting from cache:`, err);
      throw APIError.internal(`Failed to get from cache: ${err.message}`);
    }
  }

  // Set in Cache
  async set(request: CacheServiceRequest): Promise<CacheServiceResponse> {
    const startTime = Date.now();

    try {
      // Parse cache key to extract orgId, propertyId, date, type
      const keyParts = request.key.split(':');
      if (keyParts.length < 4) {
        throw new Error('Invalid cache key format');
      }

      const [type, orgId, propertyId, date] = keyParts;
      const orgIdNum = parseInt(orgId, 10);
      const parsedPropertyId = parseInt(propertyId, 10);
      const propertyIdNum = propertyId === 'all' || propertyId === 'undefined' || propertyId === '' || Number.isNaN(parsedPropertyId)
        ? undefined
        : parsedPropertyId;

      // Route to appropriate cache based on type
      switch (type) {
        case 'daily':
          await distributedCache.setDailyReport(orgIdNum, propertyIdNum, date, request.data);
          break;
        case 'monthly':
          await distributedCache.setMonthlyReport(orgIdNum, propertyIdNum, date, request.data);
          break;
        case 'summary':
          await distributedCache.setSummary(orgIdNum, propertyIdNum, date, request.data);
          break;
        default:
          throw new Error(`Unknown cache type: ${type}`);
      }

      const processingTime = Date.now() - startTime;
      console.log(`[${this.serviceName}] Cache set for key: ${request.key} in ${processingTime}ms`);

      return {
        success: true,
        data: request.data,
        cached: true,
        processingTime
      };
    } catch (error) {
      const err = normalizeError(error);
      console.error(`[${this.serviceName}] Error setting cache:`, err);
      throw APIError.internal(`Failed to set cache: ${err.message}`);
    }
  }

  // Invalidate Cache
  async invalidate(request: CacheInvalidationRequest): Promise<CacheServiceResponse> {
    const startTime = Date.now();

    try {
      // Use async cache invalidator for better performance
      await asyncCacheInvalidator.addInvalidation(
        request.orgId,
        request.propertyId,
        request.dates,
        request.priority || 'medium'
      );

      const processingTime = Date.now() - startTime;
      console.log(`[${this.serviceName}] Cache invalidation queued for orgId: ${request.orgId} in ${processingTime}ms`);

      return {
        success: true,
        data: { message: 'Invalidation queued successfully' },
        cached: false,
        processingTime
      };
    } catch (error) {
      const err = normalizeError(error);
      console.error(`[${this.serviceName}] Error invalidating cache:`, err);
      throw APIError.internal(`Failed to invalidate cache: ${err.message}`);
    }
  }

  // Clear Cache
  async clear(orgId?: number, propertyId?: number): Promise<CacheServiceResponse> {
    const startTime = Date.now();

    try {
      if (orgId) {
        // Clear cache for specific organization
        await distributedCache.clearOrgCache(orgId);
        console.log(`[${this.serviceName}] Cleared cache for orgId: ${orgId}`);
      } else {
        // Clear all cache
        await distributedCache.clearAllCaches();
        console.log(`[${this.serviceName}] Cleared all cache`);
      }

      const processingTime = Date.now() - startTime;
      return {
        success: true,
        data: { message: 'Cache cleared successfully' },
        cached: false,
        processingTime
      };
    } catch (error) {
      const err = normalizeError(error);
      console.error(`[${this.serviceName}] Error clearing cache:`, err);
      throw APIError.internal(`Failed to clear cache: ${err.message}`);
    }
  }

  // Get Cache Statistics
  async getStats(): Promise<CacheStats> {
    try {
      // Get Redis stats from all cache instances
      const [redisStatsReports, redisStatsBalance, redisStatsSummary] = await Promise.all([
        reportsCache.getStats(),
        balanceCache.getStats(),
        summaryCache.getStats()
      ]);

      const cacheStats = await distributedCache.getCacheStats();
      const invalidatorStats = asyncCacheInvalidator.getQueueStats();

      const combinedRedisEntries = redisStatsReports.memoryEntries + redisStatsBalance.memoryEntries + redisStatsSummary.memoryEntries;
      const combinedRedisStats = {
        type: redisStatsReports.type,
        available: redisStatsReports.available,
        memoryEntries: combinedRedisEntries,
        redisInfo: redisStatsReports.redisInfo
      };

      const hitRate = cacheStats.hitRate || 0;
      const missRate = Math.max(0, 1 - hitRate);
      const memoryUsage = cacheStats.memoryUsage || combinedRedisEntries * 1024;
      const invalidations = invalidatorStats?.stats?.totalInvalidations || 0;
      const averageResponseTime = cacheStats.averageResponseTime || 0;

      return {
        totalEntries: cacheStats.totalEntries || combinedRedisEntries,
        hitRate,
        missRate,
        invalidations,
        memoryUsage,
        averageResponseTime,
        redisStats: combinedRedisStats
      };
    } catch (error) {
      const err = normalizeError(error);
      console.error(`[${this.serviceName}] Error getting cache stats:`, err);
      throw APIError.internal(`Failed to get cache stats: ${err.message}`);
    }
  }

  // Get Cache Health
  async getHealth(): Promise<CacheHealthResponse> {
    const dependencies = await this.checkDependencies();
    const healthy = dependencies.every(dep => dep.status === 'healthy' || dep.status === 'degraded');

    // Get tier metrics if using TieredCache
    let tierMetrics;
    try {
      const cacheBackend = getCacheBackend();
      if (cacheBackend instanceof TieredCache) {
        tierMetrics = cacheBackend.getMetrics();
      }
    } catch (error) {
      // Ignore - metrics are optional
    }

    return {
      service: this.serviceName,
      version: this.version,
      status: healthy ? 'healthy' : 'unhealthy',
      dependencies,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.initializedAt) / 1000),
      tierMetrics
    };
  }

  // Check Dependencies
  private async checkDependencies(): Promise<any[]> {
    const dependencies = [];

    // Check Cache Backend (tiered or single)
    try {
      const cacheBackend = getCacheBackend();
      const cacheStats = await cacheBackend.getStats();
      dependencies.push({
        name: 'CacheBackend',
        status: cacheStats.available ? 'healthy' : 'degraded',
        stats: cacheStats
      });
    } catch (error) {
      const err = normalizeError(error);
      dependencies.push({
        name: 'CacheBackend',
        status: 'unhealthy',
        error: err.message
      });
    }

    // Check Async Invalidator
    try {
      const invalidatorHealth = await asyncCacheInvalidator.healthCheck();
      dependencies.push({
        name: 'AsyncInvalidator',
        status: invalidatorHealth.healthy ? 'healthy' : 'unhealthy',
        health: invalidatorHealth
      });
    } catch (error) {
      const err = normalizeError(error);
      dependencies.push({
        name: 'AsyncInvalidator',
        status: 'unhealthy',
        error: err.message
      });
    }

    return dependencies;
  }
}

// Global cache service instance
export const cacheService = new CacheService();

// API Endpoints
export const getCache = api<{key: string}, CacheServiceResponse>(
  { auth: true, expose: true, method: "GET", path: "/cache/get" },
  async (req) => {
    return await cacheService.get(req.key);
  }
);

export const setCache = api<CacheServiceRequest, CacheServiceResponse>(
  { auth: true, expose: true, method: "POST", path: "/cache/set" },
  async (req) => {
    return await cacheService.set(req);
  }
);

export const invalidateCache = api<CacheInvalidationRequest, CacheServiceResponse>(
  { auth: true, expose: true, method: "POST", path: "/cache/invalidate" },
  async (req) => {
    return await cacheService.invalidate(req);
  }
);

export const clearCache = api<{orgId?: number, propertyId?: number}, CacheServiceResponse>(
  { auth: true, expose: true, method: "POST", path: "/cache/clear" },
  async (req) => {
    return await cacheService.clear(req.orgId, req.propertyId);
  }
);

export const getCacheStats = api<{}, CacheStats>(
  { auth: true, expose: true, method: "GET", path: "/cache/stats" },
  async () => {
    return await cacheService.getStats();
  }
);

export const getCacheHealth = api<{}, CacheHealthResponse>(
  { auth: false, expose: true, method: "GET", path: "/cache/health" },
  async () => {
    return await cacheService.getHealth();
  }
);
