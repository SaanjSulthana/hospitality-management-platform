import { api } from "encore.dev/api";
import { reportsCache, balanceCache, summaryCache } from "./redis_cache_service";
import { v1Path } from "../shared/http";

export interface CacheMonitoringResponse {
  status: string;
  timestamp: string;
  caches: {
    reports: {
      type: 'redis' | 'memory';
      available: boolean;
      memoryEntries: number;
      redisInfo?: any;
    };
    balance: {
      type: 'redis' | 'memory';
      available: boolean;
      memoryEntries: number;
      redisInfo?: any;
    };
    summary: {
      type: 'redis' | 'memory';
      available: boolean;
      memoryEntries: number;
      redisInfo?: any;
    };
  };
}

// Cache monitoring endpoint
async function getCacheStatusHandler(): Promise<CacheMonitoringResponse> {
    try {
      const [reportsStats, balanceStats, summaryStats] = await Promise.all([
        reportsCache.getStats(),
        balanceCache.getStats(),
        summaryCache.getStats(),
      ]);

      const allAvailable = reportsStats.available && balanceStats.available && summaryStats.available;

      return {
        status: allAvailable ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        caches: {
          reports: reportsStats,
          balance: balanceStats,
          summary: summaryStats,
        }
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        caches: {
          reports: {
            type: 'memory',
            available: false,
            memoryEntries: 0,
          },
          balance: {
            type: 'memory',
            available: false,
            memoryEntries: 0,
          },
          summary: {
            type: 'memory',
            available: false,
            memoryEntries: 0,
          },
        }
      };
    }
  }

export const getCacheStatus = api(
  { expose: true, method: "GET", path: "/cache/status" },
  getCacheStatusHandler
);

export const getCacheStatusV1 = api(
  { expose: true, method: "GET", path: "/v1/system/cache/status" },
  getCacheStatusHandler
);

// Cache health check - DISABLED: Using cache-service health endpoint instead
// Duplicate route causes Encore to panic. Use /cache/health from cache-service instead.
// export const cacheHealthCheck = api(
//   { expose: true, method: "GET", path: "/cache/health" },
//   async (): Promise<{
//     healthy: boolean;
//     timestamp: string;
//     backend: string;
//     message: string;
//   }> => {
//     try {
//       const reportsStats = await reportsCache.getStats();
//       
//       return {
//         healthy: true,
//         timestamp: new Date().toISOString(),
//         backend: reportsStats.type,
//         message: reportsStats.available 
//           ? `Cache is healthy using ${reportsStats.type} backend`
//           : `Cache is using fallback ${reportsStats.type} backend`
//       };
//     } catch (error) {
//       return {
//         healthy: false,
//         timestamp: new Date().toISOString(),
//         backend: 'unknown',
//         message: error instanceof Error ? error.message : 'Unknown cache error'
//       };
//     }
//   }
// );

