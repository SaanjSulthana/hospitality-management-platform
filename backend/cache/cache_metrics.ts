import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";

interface CacheMetricsResponse {
  redis: { hits: number; misses: number; hitRate: number };
  invalidations: { total: number; lastHour: number };
  consistency: { checks: number; issues: number };
}

// Shared handler for getting cache metrics
async function getCacheMetricsHandler(): Promise<CacheMetricsResponse> {
  const authData = getAuthData();
  if (!authData) throw new Error("Authentication required");
  requireRole("ADMIN")(authData);

  // TODO: Implement actual metrics collection from Redis
  // For now, return placeholder data
  return {
    redis: {
      hits: 0, // Track via Redis INFO
      misses: 0,
      hitRate: 0
    },
    invalidations: {
      total: 0,
      lastHour: 0
    },
    consistency: {
      checks: 0,
      issues: 0
    }
  };
}

// LEGACY: Gets cache metrics (keep for backward compatibility)
export const getCacheMetrics = api<{}, CacheMetricsResponse>(
  { auth: true, expose: true, method: "GET", path: "/cache/metrics" },
  getCacheMetricsHandler
);

// V1: Gets cache metrics
export const getCacheMetricsV1 = api<{}, CacheMetricsResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/system/cache/metrics" },
  getCacheMetricsHandler
);
