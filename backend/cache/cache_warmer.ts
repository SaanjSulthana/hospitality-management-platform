import { api } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { distributedCache } from "./distributed_cache_manager";
import { reportsReadDB } from "../reports/db_read_replica";
import { enhancedBalanceCache } from "../reports/enhanced_balance_cache";

// Shared handler for warming cache for high-traffic organizations
async function warmHighTrafficCacheHandler(): Promise<void> {
  console.log('[CacheWarmer] Starting cache warming for high-traffic organizations');
  
  try {
    // Get top 1000 most active organizations
    const topOrgs = await reportsReadDB.queryAll`
      SELECT DISTINCT org_id, property_id
      FROM (
        SELECT org_id, property_id, COUNT(*) as activity_count
        FROM revenues
        WHERE occurred_at >= NOW() - INTERVAL '7 days'
        GROUP BY org_id, property_id
        ORDER BY activity_count DESC
        LIMIT 1000
      ) active_orgs
    `;
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    let warmedCount = 0;
    
    // Pre-warm cache for today and yesterday
    for (const org of topOrgs) {
      try {
        // Warm opening balance cache for today
        await enhancedBalanceCache.getOpeningBalanceWithValidation(
          org.property_id,
          today,
          org.org_id
        );
        
        // Warm yesterday's closing balance
        await enhancedBalanceCache.getClosingBalanceWithValidation(
          org.property_id,
          yesterdayStr,
          org.org_id
        );
        
        // Warm daily report cache for today
        await distributedCache.getDailyReport(
          org.org_id,
          org.property_id,
          today
        );
        
        warmedCount++;
        
        if (warmedCount % 100 === 0) {
          console.log(`[CacheWarmer] Warmed cache for ${warmedCount} organizations`);
        }
      } catch (error) {
        console.error(`[CacheWarmer] Error warming cache for org ${org.org_id}, property ${org.property_id}:`, error);
      }
    }
    
    console.log(`[CacheWarmer] Successfully warmed cache for ${warmedCount} high-traffic organizations`);
  } catch (error) {
    console.error('[CacheWarmer] Error during cache warming:', error);
  }
}

// LEGACY: Warm cache for high-traffic organizations (keep for backward compatibility)
export const warmHighTrafficCache = api(
  { expose: true, method: "POST", path: "/cache/warm-high-traffic" },
  warmHighTrafficCacheHandler
);

// V1: Warm cache for high-traffic organizations
export const warmHighTrafficCacheV1 = api(
  { expose: true, method: "POST", path: "/v1/system/cache/warm-high-traffic" },
  warmHighTrafficCacheHandler
);

// Warm cache for high-traffic organizations
const warmCache = new CronJob("warm-cache", {
  title: "Cache Warming for High-Traffic Orgs",
  schedule: "*/5 * * * *",  // Every 5 minutes
  endpoint: warmHighTrafficCache,
});

// Warm cache for specific organization (manual trigger)
const warmOrganizationCache = new CronJob("warm-org-cache", {
  title: "Cache Warming for Specific Organization",
  schedule: "0 */6 * * *",  // Every 6 hours
  endpoint: warmSpecificOrganizationCache,
});

// Shared handler for warming cache for specific organization
async function warmSpecificOrganizationCacheHandler(): Promise<void> {
  console.log('[CacheWarmer] Starting specific organization cache warming');
  
  try {
    // Get organizations that haven't been active recently but might need cache warming
    const inactiveOrgs = await reportsReadDB.queryAll`
      SELECT DISTINCT org_id, property_id
      FROM (
        SELECT org_id, property_id, MAX(occurred_at) as last_activity
        FROM revenues
        WHERE occurred_at >= NOW() - INTERVAL '30 days'
        GROUP BY org_id, property_id
        HAVING MAX(occurred_at) < NOW() - INTERVAL '1 day'
        ORDER BY last_activity DESC
        LIMIT 500
      ) inactive_orgs
    `;
    
    const today = new Date().toISOString().split('T')[0];
    let warmedCount = 0;
    
    for (const org of inactiveOrgs) {
      try {
        // Warm opening balance cache for today
        await enhancedBalanceCache.getOpeningBalanceWithValidation(
          org.property_id,
          today,
          org.org_id
        );
        
        warmedCount++;
        
        if (warmedCount % 50 === 0) {
          console.log(`[CacheWarmer] Warmed cache for ${warmedCount} inactive organizations`);
        }
      } catch (error) {
        console.error(`[CacheWarmer] Error warming cache for inactive org ${org.org_id}, property ${org.property_id}:`, error);
      }
    }
    
    console.log(`[CacheWarmer] Successfully warmed cache for ${warmedCount} inactive organizations`);
  } catch (error) {
    console.error('[CacheWarmer] Error during specific organization cache warming:', error);
  }
}

// LEGACY: Warm cache for specific organization (keep for backward compatibility)
export const warmSpecificOrganizationCache = api(
  { expose: true, method: "POST", path: "/cache/warm-specific-org" },
  warmSpecificOrganizationCacheHandler
);

// V1: Warm cache for specific organization
export const warmSpecificOrganizationCacheV1 = api(
  { expose: true, method: "POST", path: "/v1/system/cache/warm-specific-org" },
  warmSpecificOrganizationCacheHandler
);

// Get cache warming statistics
const getCacheWarmingStats = new CronJob("cache-warming-stats", {
  title: "Cache Warming Statistics",
  schedule: "0 */1 * * *",  // Every hour
  endpoint: collectCacheWarmingStats,
});

// Shared handler for collecting cache warming statistics
async function collectCacheWarmingStatsHandler(): Promise<void> {
  console.log('[CacheWarmer] Collecting cache warming statistics');
  
  try {
    const stats = await distributedCache.getCacheStats();
    
    console.log('[CacheWarmer] Cache Statistics:', {
      hitRate: stats.hitRate,
      totalEntries: stats.totalEntries,
      memoryUsage: stats.memoryUsage,
      evictionCount: stats.evictionCount,
      timestamp: new Date().toISOString()
    });
    
    // Log warning if hit rate is low
    if (stats.hitRate < 0.8) {
      console.warn('[CacheWarmer] Low cache hit rate detected:', stats.hitRate);
    }
    
    // Log warning if memory usage is high
    if (stats.memoryUsage > 0.9) {
      console.warn('[CacheWarmer] High memory usage detected:', stats.memoryUsage);
    }
  } catch (error) {
    console.error('[CacheWarmer] Error collecting cache warming statistics:', error);
  }
}

// LEGACY: Collect cache warming statistics (keep for backward compatibility)
export const collectCacheWarmingStats = api(
  { expose: true, method: "POST", path: "/cache/collect-stats" },
  collectCacheWarmingStatsHandler
);

// V1: Collect cache warming statistics
export const collectCacheWarmingStatsV1 = api(
  { expose: true, method: "POST", path: "/v1/system/cache/collect-stats" },
  collectCacheWarmingStatsHandler
);
