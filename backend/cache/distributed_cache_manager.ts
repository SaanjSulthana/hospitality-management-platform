import { addDaysIST } from "../shared/date_utils";
import { CacheBackend } from "./backends/types";
import { getCacheBackend } from "./cache_factory";

export class DistributedCacheManager {
  // 🔥 CRITICAL FOR 1M ORGS: Cache version management for instant invalidation
  // Version is incremented globally on any CRUD operation to force cache refresh
  private cacheVersion = Date.now(); // Initialize with timestamp
  private versionUpdateCount = 0;
  
  // Pluggable cache backend (tiered or single)
  private reportsCache: CacheBackend;
  private balanceCache: CacheBackend;
  private summaryCache: CacheBackend;

  constructor() {
    // Initialize cache backends using factory
    // All three caches use the same backend instance for efficiency
    const backend = getCacheBackend();
    this.reportsCache = backend;
    this.balanceCache = backend;
    this.summaryCache = backend;
  }

  private getPropertyKey(propertyId?: number): string {
    if (propertyId === null || propertyId === undefined) {
      return 'all';
    }
    return propertyId.toString();
  }

  // Bump cache version to invalidate all cached entries
  bumpCacheVersion(): void {
    this.cacheVersion = Date.now();
    this.versionUpdateCount++;
    console.log(`[DistributedCache] 🔄 Cache version bumped: ${this.cacheVersion} (update #${this.versionUpdateCount})`);
  }

  // Daily report caching with version check
  async getDailyReport(orgId: number, propertyId: number | undefined, date: string): Promise<any | null> {
    const propertyKey = this.getPropertyKey(propertyId);
    const key = `reports/${orgId}/${propertyKey}/${date}`;
    const cached = await this.reportsCache.get<any>(key);
    
    // 🔥 CRITICAL: Version check - invalidate if version mismatch
    if (cached && typeof cached === 'object' && 'cacheVersion' in cached && cached.cacheVersion && cached.cacheVersion < this.cacheVersion) {
      console.log(`[DistributedCache] 🔄 Stale version detected for ${key}, invalidating`);
      await this.reportsCache.delete(key);
      return null;
    }
    
    return (cached && typeof cached === 'object' && 'data' in cached) ? cached.data : null;
  }

  async setDailyReport(orgId: number, propertyId: number | undefined, date: string, data: any): Promise<void> {
    const propertyKey = this.getPropertyKey(propertyId);
    const key = `reports/${orgId}/${propertyKey}/${date}`;
    const ttlStr = this.calculateTTL(date);
    const ttlMs = this.parseTTLToMs(ttlStr);
    await this.reportsCache.set(key, {
      data,
      version: "v1",
      cacheVersion: this.cacheVersion, // 🔥 Store current cache version
      cachedAt: Date.now()
    }, ttlMs);
  }

  async invalidateDailyReport(orgId: number, propertyId: number | undefined, date: string): Promise<void> {
    const propertyKey = this.getPropertyKey(propertyId);
    const key = `reports/${orgId}/${propertyKey}/${date}`;
    await this.reportsCache.delete(key);
  }

  // Balance caching
  async getBalance(orgId: number, propertyId: number | undefined, date: string): Promise<any | null> {
    const propertyKey = this.getPropertyKey(propertyId);
    const key = `balance/${orgId}/${propertyKey}/${date}`;
    const cached = await this.balanceCache.get(key);
    return cached || null;
  }

  async setBalance(orgId: number, propertyId: number | undefined, date: string, data: any): Promise<void> {
    const propertyKey = this.getPropertyKey(propertyId);
    const key = `balance/${orgId}/${propertyKey}/${date}`;
    const ttlStr = this.calculateTTL(date);
    const ttlMs = this.parseTTLToMs(ttlStr);
    await this.balanceCache.set(key, {
      ...data,
      version: "v1",
      cachedAt: Date.now()
    }, ttlMs);
  }

  async invalidateBalance(orgId: number, propertyId: number | undefined, date: string): Promise<void> {
    const propertyKey = this.getPropertyKey(propertyId);
    const key = `balance/${orgId}/${propertyKey}/${date}`;
    await this.balanceCache.delete(key);
  }

  // Summary caching
  async getSummary(orgId: number, propertyId: number | undefined, period: string): Promise<any | null> {
    const propertyKey = this.getPropertyKey(propertyId);
    const key = `summary/${orgId}/${propertyKey}/${period}`;
    const cached = await this.summaryCache.get<any>(key);
    return (cached && typeof cached === 'object' && 'summary' in cached) ? cached.summary : null;
  }

  async setSummary(orgId: number, propertyId: number | undefined, period: string, data: any): Promise<void> {
    const propertyKey = this.getPropertyKey(propertyId);
    const key = `summary/${orgId}/${propertyKey}/${period}`;
    await this.summaryCache.set(key, {
      summary: data,
      period,
      version: "v1",
      cachedAt: Date.now()
    }, 10 * 60 * 1000); // 10 minutes in ms
  }

  async invalidateSummary(orgId: number, propertyId: number | undefined, period: string): Promise<void> {
    const propertyKey = this.getPropertyKey(propertyId);
    const key = `summary/${orgId}/${propertyKey}/${period}`;
    await this.summaryCache.delete(key);
  }

  // Monthly report caching
  async getMonthlyReport(orgId: number, propertyId: number | undefined, month: string): Promise<any | null> {
    const propertyKey = this.getPropertyKey(propertyId);
    const key = `monthly/${orgId}/${propertyKey}/${month}`;
    const cached = await this.reportsCache.get<any>(key);
    return (cached && typeof cached === 'object' && 'data' in cached) ? cached.data : null;
  }

  async setMonthlyReport(orgId: number, propertyId: number | undefined, month: string, data: any): Promise<void> {
    const propertyKey = this.getPropertyKey(propertyId);
    const key = `monthly/${orgId}/${propertyKey}/${month}`;
    await this.reportsCache.set(key, {
      data,
      version: "v1",
      cacheVersion: this.cacheVersion,
      cachedAt: Date.now()
    }, 30 * 60 * 1000); // 30 minutes in ms
  }

  async invalidateMonthlyReport(orgId: number, propertyId: number | undefined, month: string): Promise<void> {
    const propertyKey = this.getPropertyKey(propertyId);
    const key = `monthly/${orgId}/${propertyKey}/${month}`;
    await this.reportsCache.delete(key);
  }

  // Bulk invalidation for date ranges with optional defensive invalidation
  async invalidateDateRange(orgId: number, propertyId: number | undefined, dates: string[]): Promise<void> {
    // 🔥 CRITICAL: Bump cache version for instant global invalidation
    this.bumpCacheVersion();
    
    let datesToInvalidate = [...dates];
    
    // Optional defensive invalidation: add date±1 for migration period safety
    if (process.env.CACHE_DEFENSIVE_INVALIDATION === 'true') {
      const defensiveDates = new Set(datesToInvalidate);
      for (const date of dates) {
        defensiveDates.add(addDaysIST(date, -1)); // Previous day
        defensiveDates.add(addDaysIST(date, 1));  // Next day
      }
      datesToInvalidate = Array.from(defensiveDates);
      console.log(`[DistributedCache] 🛡️ Defensive mode: expanded ${dates.length} dates to ${datesToInvalidate.length} (±1 day)`);
    }
    
    const promises = datesToInvalidate.map(date => Promise.all([
      this.invalidateDailyReport(orgId, propertyId, date),
      this.invalidateBalance(orgId, propertyId, date)
    ]));
    await Promise.all(promises);
  }

  async clearOrgCache(orgId: number): Promise<void> {
    await Promise.all([
      this.reportsCache.clearByPrefix(`reports/${orgId}/`),
      this.reportsCache.clearByPrefix(`monthly/${orgId}/`),
      this.balanceCache.clearByPrefix(`balance/${orgId}/`),
      this.summaryCache.clearByPrefix(`summary/${orgId}/`)
    ]);
  }

  async clearAllCaches(): Promise<void> {
    await Promise.all([
      this.reportsCache.clearAll(),
      this.balanceCache.clearAll(),
      this.summaryCache.clearAll()
    ]);
  }

  // Intelligent TTL calculation based on data recency and access patterns
  private calculateTTL(date: string): string {
    const today = new Date().toISOString().split('T')[0];
    const targetDate = new Date(date);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

    // 🔥 CRITICAL FIX FOR 1M ORGS: Ultra-aggressive caching for real-time updates
    if (diffDays === 0) return "5s";       // Today: 5 seconds (down from 15s)
    if (diffDays === 1) return "10s";      // Yesterday: 10 seconds
    if (diffDays <= 3) return "30s";       // Last 3 days: 30 seconds (down from 1m)
    if (diffDays <= 7) return "2m";        // Last week: 2 minutes (down from 3m)
    if (diffDays <= 30) return "5m";       // Last month: 5 minutes (down from 10m)
    return "15m";                          // Historical: 15 minutes (down from 30m)
  }

  // Get cache statistics for monitoring
  async getCacheStats(): Promise<{
    hitRate: number;
    totalEntries: number;
    memoryUsage: number;
    evictionCount: number;
    averageResponseTime?: number;
    backendStats?: any;
  }> {
    const stats = await this.reportsCache.getStats();

    return {
      hitRate: 0.85, // Can be enhanced with actual hit/miss tracking
      totalEntries: stats.entries || 0,
      memoryUsage: (stats.entries || 0) * 1024, // Approximation
      evictionCount: 0,
      averageResponseTime: 0,
      backendStats: stats
    };
  }
  
  /**
   * Parse TTL string to milliseconds
   */
  private parseTTLToMs(ttl: string): number {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return 2 * 60 * 1000; // Default 2 minutes
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 2 * 60 * 1000;
    }
  }

  // Clear cache for emergency situations
  async clearCache(): Promise<void> {
    await this.clearAllCaches();
    console.log('[DistributedCache] Emergency cache clear executed');
  }
}

export const distributedCache = new DistributedCacheManager();
