import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { distributedCache } from "../cache/distributed_cache_manager";

// Shared handler for getting cache metrics
async function getCacheMetricsHandler(): Promise<{ cacheSize: number; hitRate: number; missRate: number; timestamp: Date }> {
  const authData = getAuthData();
  if (!authData) throw APIError.unauthenticated("Authentication required");
  requireRole("ADMIN")(authData);
  
  return { 
    cacheSize: 0, // TODO: Implement cache stats
    hitRate: 0,
    missRate: 0,
    timestamp: new Date() 
  };
}

// Shared handler for clearing cache
async function clearCacheHandler(): Promise<{ success: boolean; timestamp: Date }> {
  const authData = getAuthData();
  if (!authData) throw APIError.unauthenticated("Authentication required");
  requireRole("ADMIN")(authData);
  
  // TODO: Implement org cache clearing
  console.log(`Clearing cache for org ${authData.orgId}`);
  return { success: true, timestamp: new Date() };
}

// LEGACY: Get cache metrics (keep for backward compatibility)
export const getCacheMetrics = api(
  { auth: true, expose: true, method: "GET", path: "/reports/cache/metrics" },
  getCacheMetricsHandler
);

// V1: Get cache metrics
export const getCacheMetricsV1 = api(
  { auth: true, expose: true, method: "GET", path: "/v1/reports/cache/metrics" },
  getCacheMetricsHandler
);

// LEGACY: Clear cache (keep for backward compatibility)
export const clearCache = api(
  { auth: true, expose: true, method: "POST", path: "/reports/cache/clear" },
  clearCacheHandler
);

// V1: Clear cache
export const clearCacheV1 = api(
  { auth: true, expose: true, method: "POST", path: "/v1/reports/cache/clear" },
  clearCacheHandler
);

