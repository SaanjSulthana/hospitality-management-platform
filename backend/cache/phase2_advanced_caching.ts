// 🏗️ PHASE 2: ADVANCED CACHING STRATEGIES (Month 1)
// Target: Handle 100K-500K organizations
// Implementation: Month 1

// ✅ FIX 1: Multi-Tier Caching System
export class MultiTierCacheManager {
  private l1Cache: Map<string, CacheEntry> = new Map(); // Local cache
  private l2Cache: Map<string, CacheEntry> = new Map(); // Distributed cache
  private cacheWarming: CacheWarmer;
  private cacheStats = {
    l1Hits: 0,
    l1Misses: 0,
    l2Hits: 0,
    l2Misses: 0,
    cacheWarms: 0,
    invalidations: 0
  };

  constructor() {
    this.cacheWarming = new CacheWarmer(this);
  }

  async get(key: string): Promise<any> {
    // L1: Check local cache
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && !this.isExpired(l1Entry)) {
      this.cacheStats.l1Hits++;
      return l1Entry.data;
    }

    // L2: Check distributed cache
    const l2Entry = this.l2Cache.get(key);
    if (l2Entry && !this.isExpired(l2Entry)) {
      this.cacheStats.l2Hits++;
      // Promote to L1
      this.l1Cache.set(key, l2Entry);
      return l2Entry.data;
    }

    this.cacheStats.l1Misses++;
    this.cacheStats.l2Misses++;
    return null;
  }

  async set(key: string, data: any, ttl: number = 300000): Promise<void> {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl
    };

    // Set in both caches
    this.l1Cache.set(key, entry);
    this.l2Cache.set(key, entry);
  }

  async invalidate(key: string): Promise<void> {
    this.l1Cache.delete(key);
    this.l2Cache.delete(key);
    this.cacheStats.invalidations++;
  }

  async warmCache(): Promise<void> {
    await this.cacheWarming.warmCache();
    this.cacheStats.cacheWarms++;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  getStats() {
    const l1HitRate = this.cacheStats.l1Hits / (this.cacheStats.l1Hits + this.cacheStats.l1Misses);
    const l2HitRate = this.cacheStats.l2Hits / (this.cacheStats.l2Hits + this.cacheStats.l2Misses);
    
    return {
      ...this.cacheStats,
      l1HitRate,
      l2HitRate,
      l1Size: this.l1Cache.size,
      l2Size: this.l2Cache.size
    };
  }
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

// ✅ FIX 2: Cache Warming System
export class CacheWarmer {
  private cacheManager: MultiTierCacheManager;
  private hotKeys: string[] = [];
  private warmingInterval: number = 300000; // 5 minutes

  constructor(cacheManager: MultiTierCacheManager) {
    this.cacheManager = cacheManager;
    this.startWarming();
  }

  private startWarming() {
    setInterval(() => {
      this.warmCache();
    }, this.warmingInterval);
  }

  async warmCache(): Promise<void> {
    console.log('[CacheWarmer] Starting cache warming...');
    
    try {
      // Get hot keys from analytics
      const hotKeys = await this.getHotKeys();
      
      for (const key of hotKeys) {
        try {
          const data = await this.fetchFromSource(key);
          if (data) {
            await this.cacheManager.set(key, data);
          }
        } catch (error) {
          console.error(`[CacheWarmer] Failed to warm cache for key ${key}:`, error);
        }
      }
      
      console.log(`[CacheWarmer] Cache warming completed for ${hotKeys.length} keys`);
    } catch (error) {
      console.error('[CacheWarmer] Cache warming failed:', error);
    }
  }

  private async getHotKeys(): Promise<string[]> {
    // In production, this would analyze access patterns
    // For now, return common report keys
    return [
      'daily_report:1:1:2024-01-15',
      'daily_report:1:2:2024-01-15',
      'monthly_report:1:1:2024-01',
      'monthly_report:1:2:2024-01'
    ];
  }

  private async fetchFromSource(key: string): Promise<any> {
    // Simulate fetching from source
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ key, data: 'cached_data', timestamp: Date.now() });
      }, 100);
    });
  }
}

// ✅ FIX 3: Intelligent Cache Invalidation
export class IntelligentCacheInvalidator {
  private invalidationQueue: InvalidationItem[] = [];
  private processing = false;
  private batchSize = 100;
  private intervalMs = 1000; // 1 second

  constructor() {
    this.startProcessing();
  }

  private startProcessing() {
    setInterval(() => {
      if (this.invalidationQueue.length > 0 && !this.processing) {
        this.processInvalidations();
      }
    }, this.intervalMs);
  }

  async invalidate(orgId: number, propertyId: number, dates: string[], reason: string) {
    this.invalidationQueue.push({
      orgId,
      propertyId,
      dates,
      reason,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9)
    });
  }

  private async processInvalidations() {
    if (this.processing) return;
    this.processing = true;

    try {
      const batch = this.invalidationQueue.splice(0, this.batchSize);
      if (batch.length === 0) return;

      console.log(`[IntelligentCacheInvalidator] Processing ${batch.length} invalidations`);

      // Group by org/property for efficient invalidation
      const grouped = this.groupByOrgProperty(batch);
      
      for (const [key, items] of grouped.entries()) {
        try {
          await this.batchInvalidate(items);
        } catch (error) {
          console.error('Cache invalidation failed:', error);
          // Retry failed items
          this.invalidationQueue.push(...items);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private groupByOrgProperty(batch: InvalidationItem[]): Map<string, InvalidationItem[]> {
    const grouped = new Map<string, InvalidationItem[]>();
    
    for (const item of batch) {
      const key = `${item.orgId}:${item.propertyId}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    }
    
    return grouped;
  }

  private async batchInvalidate(items: InvalidationItem[]) {
    if (items.length === 0) return;

    const { orgId, propertyId } = items[0];
    const allDates = new Set<string>();
    const reasons = new Set<string>();
    
    // Collect all unique dates and reasons
    for (const item of items) {
      item.dates.forEach(date => allDates.add(date));
      reasons.add(item.reason);
    }

    console.log(`[IntelligentCacheInvalidator] Batch invalidating ${allDates.size} dates for org ${orgId}, property ${propertyId}, reasons: ${Array.from(reasons).join(', ')}`);
    
    // Simulate cache invalidation
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  getStats() {
    return {
      queueSize: this.invalidationQueue.length,
      processing: this.processing,
      batchSize: this.batchSize,
      intervalMs: this.intervalMs
    };
  }
}

interface InvalidationItem {
  id: string;
  orgId: number;
  propertyId: number;
  dates: string[];
  reason: string;
  timestamp: number;
}

export const intelligentCacheInvalidator = new IntelligentCacheInvalidator();

// ✅ FIX 4: Cache Performance Analytics
export class CachePerformanceAnalytics {
  private analytics = {
    accessPatterns: new Map<string, AccessPattern>(),
    hitRates: new Map<string, number>(),
    missRates: new Map<string, number>(),
    invalidationPatterns: new Map<string, InvalidationPattern>(),
    performanceMetrics: new Map<string, PerformanceMetric>()
  };

  recordAccess(key: string, hit: boolean, responseTime: number) {
    const pattern = this.analytics.accessPatterns.get(key) || {
      key,
      totalAccesses: 0,
      hits: 0,
      misses: 0,
      avgResponseTime: 0,
      lastAccessed: new Date()
    };

    pattern.totalAccesses++;
    if (hit) {
      pattern.hits++;
    } else {
      pattern.misses++;
    }
    
    pattern.avgResponseTime = (pattern.avgResponseTime + responseTime) / 2;
    pattern.lastAccessed = new Date();
    
    this.analytics.accessPatterns.set(key, pattern);
  }

  recordInvalidation(key: string, reason: string) {
    const pattern = this.analytics.invalidationPatterns.get(key) || {
      key,
      totalInvalidations: 0,
      reasons: new Map<string, number>(),
      lastInvalidated: new Date()
    };

    pattern.totalInvalidations++;
    const reasonCount = pattern.reasons.get(reason) || 0;
    pattern.reasons.set(reason, reasonCount + 1);
    pattern.lastInvalidated = new Date();
    
    this.analytics.invalidationPatterns.set(key, pattern);
  }

  recordPerformance(key: string, metric: string, value: number) {
    const performance = this.analytics.performanceMetrics.get(key) || {
      key,
      metrics: new Map<string, number>(),
      lastUpdated: new Date()
    };

    performance.metrics.set(metric, value);
    performance.lastUpdated = new Date();
    
    this.analytics.performanceMetrics.set(key, performance);
  }

  getAccessPatterns(): AccessPattern[] {
    return Array.from(this.analytics.accessPatterns.values());
  }

  getInvalidationPatterns(): InvalidationPattern[] {
    return Array.from(this.analytics.invalidationPatterns.values());
  }

  getPerformanceMetrics(): PerformanceMetric[] {
    return Array.from(this.analytics.performanceMetrics.values());
  }

  getHotKeys(limit: number = 10): string[] {
    const patterns = Array.from(this.analytics.accessPatterns.values());
    return patterns
      .sort((a, b) => b.totalAccesses - a.totalAccesses)
      .slice(0, limit)
      .map(pattern => pattern.key);
  }

  getColdKeys(limit: number = 10): string[] {
    const patterns = Array.from(this.analytics.accessPatterns.values());
    return patterns
      .sort((a, b) => a.totalAccesses - b.totalAccesses)
      .slice(0, limit)
      .map(pattern => pattern.key);
  }

  getAnalyticsSummary() {
    const totalAccesses = Array.from(this.analytics.accessPatterns.values())
      .reduce((sum, pattern) => sum + pattern.totalAccesses, 0);
    
    const totalHits = Array.from(this.analytics.accessPatterns.values())
      .reduce((sum, pattern) => sum + pattern.hits, 0);
    
    const totalMisses = Array.from(this.analytics.accessPatterns.values())
      .reduce((sum, pattern) => sum + pattern.misses, 0);
    
    return {
      totalAccesses,
      totalHits,
      totalMisses,
      overallHitRate: totalHits / (totalHits + totalMisses),
      uniqueKeys: this.analytics.accessPatterns.size,
      avgResponseTime: Array.from(this.analytics.accessPatterns.values())
        .reduce((sum, pattern) => sum + pattern.avgResponseTime, 0) / this.analytics.accessPatterns.size
    };
  }
}

interface AccessPattern {
  key: string;
  totalAccesses: number;
  hits: number;
  misses: number;
  avgResponseTime: number;
  lastAccessed: Date;
}

interface InvalidationPattern {
  key: string;
  totalInvalidations: number;
  reasons: Map<string, number>;
  lastInvalidated: Date;
}

interface PerformanceMetric {
  key: string;
  metrics: Map<string, number>;
  lastUpdated: Date;
}

export const cachePerformanceAnalytics = new CachePerformanceAnalytics();

// ✅ FIX 5: Cache Health Monitoring
export class CacheHealthMonitor {
  private healthMetrics = {
    cacheSize: 0,
    hitRate: 0,
    missRate: 0,
    avgResponseTime: 0,
    errorRate: 0,
    invalidationRate: 0,
    lastHealthCheck: new Date()
  };

  private alerts = {
    lowHitRate: false,
    highErrorRate: false,
    highResponseTime: false,
    cacheSizeWarning: false
  };

  updateHealthMetrics(metrics: any) {
    this.healthMetrics = {
      ...this.healthMetrics,
      ...metrics,
      lastHealthCheck: new Date()
    };
    
    this.checkAlerts();
  }

  private checkAlerts() {
    // Check hit rate
    if (this.healthMetrics.hitRate < 0.7) { // 70% hit rate
      if (!this.alerts.lowHitRate) {
        console.warn('[CacheHealthMonitor] Low cache hit rate detected:', this.healthMetrics.hitRate);
        this.alerts.lowHitRate = true;
      }
    } else {
      this.alerts.lowHitRate = false;
    }

    // Check error rate
    if (this.healthMetrics.errorRate > 0.05) { // 5% error rate
      if (!this.alerts.highErrorRate) {
        console.warn('[CacheHealthMonitor] High error rate detected:', this.healthMetrics.errorRate);
        this.alerts.highErrorRate = true;
      }
    } else {
      this.alerts.highErrorRate = false;
    }

    // Check response time
    if (this.healthMetrics.avgResponseTime > 1000) { // 1 second
      if (!this.alerts.highResponseTime) {
        console.warn('[CacheHealthMonitor] High response time detected:', this.healthMetrics.avgResponseTime);
        this.alerts.highResponseTime = true;
      }
    } else {
      this.alerts.highResponseTime = false;
    }

    // Check cache size
    if (this.healthMetrics.cacheSize > 10000) { // 10K entries
      if (!this.alerts.cacheSizeWarning) {
        console.warn('[CacheHealthMonitor] Large cache size detected:', this.healthMetrics.cacheSize);
        this.alerts.cacheSizeWarning = true;
      }
    } else {
      this.alerts.cacheSizeWarning = false;
    }
  }

  getHealthStatus() {
    return {
      ...this.healthMetrics,
      alerts: { ...this.alerts },
      isHealthy: !Object.values(this.alerts).some(alert => alert)
    };
  }

  getRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.alerts.lowHitRate) {
      recommendations.push('Consider increasing cache TTL or improving cache key strategy');
    }
    
    if (this.alerts.highErrorRate) {
      recommendations.push('Investigate cache invalidation errors and improve error handling');
    }
    
    if (this.alerts.highResponseTime) {
      recommendations.push('Consider optimizing cache queries or increasing cache capacity');
    }
    
    if (this.alerts.cacheSizeWarning) {
      recommendations.push('Consider implementing cache eviction policies or increasing cache capacity');
    }
    
    return recommendations;
  }
}

export const cacheHealthMonitor = new CacheHealthMonitor();
