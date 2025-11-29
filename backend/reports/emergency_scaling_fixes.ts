// 🚨 EMERGENCY SCALING FIXES - PHASE 1
// Target: Handle 10K-50K organizations
// Implementation: Week 1

import { Subscription } from "encore.dev/pubsub";
import { financeEvents, FinanceEventPayload, realtimeUpdates } from "../finance/events";
import { distributedCache } from "../cache/distributed_cache_manager";

// ✅ DISABLED: Legacy subscriber - replaced by backend/reports/finance_events_subscriber.ts
// This subscriber duplicated the name "reports-finance-subscriber" causing conflicts
// and used `this.invalidateCacheAsync` which is undefined in Subscription handlers.
// Keeping the helper classes below for reference but not exporting the subscriber.

// Uncomment only if explicitly needed (set ENABLE_LEGACY_REPORTS_SUBSCRIBER=true):
// export const financeEventsSubscriber = new Subscription(...);

// ✅ FIX 2: Async Cache Invalidation System
class AsyncCacheInvalidator {
  private queue: InvalidationItem[] = [];
  private processing = false;
  private batchSize = 50;
  private intervalMs = 1000; // 1 second

  constructor() {
    // Start periodic processing
    setInterval(() => {
      if (this.queue.length > 0 && !this.processing) {
        this.processQueue();
      }
    }, this.intervalMs);
  }

  async invalidate(orgId: number, propertyId: number, dates: string[]) {
    this.queue.push({ orgId, propertyId, dates, timestamp: Date.now() });
    
    // Process immediately if queue is getting large
    if (this.queue.length >= this.batchSize) {
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      const batch = this.queue.splice(0, this.batchSize);
      if (batch.length === 0) return;

      console.log(`[AsyncCacheInvalidator] Processing batch of ${batch.length} invalidations`);

      // Group by org/property for efficient invalidation
      const grouped = this.groupByOrgProperty(batch);
      
      for (const [key, items] of grouped.entries()) {
        try {
          await this.batchInvalidate(items);
        } catch (error) {
          console.error('Cache invalidation failed:', error);
          // Retry failed items
          this.queue.push(...items);
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
    
    // Collect all unique dates
    for (const item of items) {
      item.dates.forEach(date => allDates.add(date));
    }

    // Batch invalidate all dates for this org/property
    try {
      reportsCache.invalidateByDates(orgId, propertyId, Array.from(allDates));
      console.log(`[AsyncCacheInvalidator] Invalidated ${allDates.size} dates for org ${orgId}, property ${propertyId}`);
    } catch (error) {
      console.error('[AsyncCacheInvalidator] Batch invalidation failed:', error);
      throw error;
    }
  }

  getStats() {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      batchSize: this.batchSize,
      intervalMs: this.intervalMs
    };
  }
}

interface InvalidationItem {
  orgId: number;
  propertyId: number;
  dates: string[];
  timestamp: number;
}

// Global async cache invalidator
export const asyncCacheInvalidator = new AsyncCacheInvalidator();

// ✅ FIX 3: Enhanced Cache Manager with Emergency Scaling
class EmergencyCacheManager {
  private dailyCache: Map<string, CacheEntry> = new Map();
  private monthlyCache: Map<string, CacheEntry> = new Map();
  private summaryCache: Map<string, CacheEntry> = new Map();
  
  // ✅ Emergency scaling configuration
  private maxEntries = 10000;  // ✅ 10x increase from 1000
  private defaultTtlMs = 2 * 60 * 1000; // ✅ 2min default (faster refresh)
  private activeDateTtlMs = 15 * 1000; // ✅ 15 seconds for current dates
  private historicalDateTtlMs = 2 * 60 * 1000; // ✅ 2 minutes for historical
  private invalidationBuffer: Map<string, number> = new Map();

  private getCacheKey(orgId: number, propertyId: number | undefined, date: string, type: string): string {
    return `${type}:${orgId}:${propertyId || 'all'}:${date}`;
  }

  private getTtlForDate(date: string): number {
    const today = new Date().toISOString().split('T')[0];
    const dateObj = new Date(date);
    const todayObj = new Date(today);
    const diffDays = Math.abs(dateObj.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24);
    
    // If date is today or within last 3 days, use shorter TTL
    return diffDays <= 3 ? this.activeDateTtlMs : this.historicalDateTtlMs;
  }

  private shouldInvalidate(key: string): boolean {
    const now = Date.now();
    const lastInvalidation = this.invalidationBuffer.get(key);
    
    // If no previous invalidation or more than 1 second has passed, allow invalidation
    if (!lastInvalidation || now - lastInvalidation > 1000) {
      this.invalidationBuffer.set(key, now);
      return true;
    }
    
    return false;
  }

  getDailyReport(orgId: number, propertyId: number | undefined, date: string): any | null {
    const key = this.getCacheKey(orgId, propertyId, date, 'daily');
    const entry = this.dailyCache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() - entry.lastUpdated.getTime() > entry.ttlMs || entry.orgId !== orgId) {
      this.dailyCache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  setDailyReport(orgId: number, propertyId: number | undefined, date: string, data: any): void {
    const key = this.getCacheKey(orgId, propertyId, date, 'daily');
    const ttlMs = this.getTtlForDate(date);
    
    // ✅ Emergency scaling: More aggressive cache eviction
    if (this.dailyCache.size >= this.maxEntries) {
      // Remove oldest 20% of entries
      const entriesToRemove = Math.floor(this.maxEntries * 0.2);
      const keys = Array.from(this.dailyCache.keys());
      for (let i = 0; i < entriesToRemove; i++) {
        this.dailyCache.delete(keys[i]);
      }
    }
    
    this.dailyCache.set(key, { data, lastUpdated: new Date(), orgId, propertyId, ttlMs });
    console.log(`[EmergencyCache] Set daily report cache for ${date} with TTL: ${ttlMs}ms`);
  }

  // ✅ FIX 4: Batch Cache Invalidation
  async invalidateByDates(orgId: number, propertyId: number, dates: string[]): Promise<void> {
    console.log(`[EmergencyCache] Batch invalidating cache for orgId: ${orgId}, propertyId: ${propertyId}, dates: ${dates.join(', ')}`);
    
    // Use async invalidator for non-blocking invalidation
    await asyncCacheInvalidator.invalidate(orgId, propertyId, dates);
  }

  getStats() {
    return {
      dailyCacheSize: this.dailyCache.size,
      monthlyCacheSize: this.monthlyCache.size,
      summaryCacheSize: this.summaryCache.size,
      maxEntries: this.maxEntries,
      defaultTtlMs: this.defaultTtlMs,
      activeDateTtlMs: this.activeDateTtlMs,
      historicalDateTtlMs: this.historicalDateTtlMs,
      invalidationBufferSize: this.invalidationBuffer.size
    };
  }
}

interface CacheEntry {
  data: any;
  lastUpdated: Date;
  orgId: number;
  propertyId?: number;
  ttlMs: number;
}

// ✅ FIX 5: Performance Monitoring for Reports
export class ReportsPerformanceMonitor {
  private metrics = {
    eventsProcessed: 0,
    cacheHits: 0,
    cacheMisses: 0,
    invalidations: 0,
    processingTime: 0,
    errors: 0
  };

  recordEventProcessed(processingTime: number) {
    this.metrics.eventsProcessed++;
    this.metrics.processingTime += processingTime;
  }

  recordCacheHit() {
    this.metrics.cacheHits++;
  }

  recordCacheMiss() {
    this.metrics.cacheMisses++;
  }

  recordInvalidation() {
    this.metrics.invalidations++;
  }

  recordError() {
    this.metrics.errors++;
  }

  getMetrics() {
    return {
      ...this.metrics,
      averageProcessingTime: this.metrics.processingTime / this.metrics.eventsProcessed,
      cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses),
      errorRate: this.metrics.errors / this.metrics.eventsProcessed
    };
  }

  // Alert if performance degrades
  checkAlerts() {
    const errorRate = this.metrics.errors / this.metrics.eventsProcessed;
    const cacheHitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses);
    const avgProcessingTime = this.metrics.processingTime / this.metrics.eventsProcessed;

    if (errorRate > 0.05) { // 5% error rate
      console.warn(`[ReportsPerformance] High error rate: ${(errorRate * 100).toFixed(2)}%`);
    }

    if (cacheHitRate < 0.7) { // 70% cache hit rate
      console.warn(`[ReportsPerformance] Low cache hit rate: ${(cacheHitRate * 100).toFixed(2)}%`);
    }

    if (avgProcessingTime > 1000) { // 1 second average processing time
      console.warn(`[ReportsPerformance] High processing time: ${avgProcessingTime.toFixed(2)}ms`);
    }
  }
}

export const reportsPerformanceMonitor = new ReportsPerformanceMonitor();

// ✅ FIX 6: Graceful Degradation for Reports
export class ReportsGracefulDegradation {
  private isOverloaded = false;
  private overloadThreshold = 0.8; // 80% capacity

  checkOverload(currentLoad: number, maxCapacity: number) {
    const loadRatio = currentLoad / maxCapacity;
    
    if (loadRatio > this.overloadThreshold) {
      this.isOverloaded = true;
      console.warn(`[ReportsGracefulDegradation] System overloaded: ${(loadRatio * 100).toFixed(2)}% capacity`);
      return true;
    }
    
    this.isOverloaded = false;
    return false;
  }

  shouldThrottle(): boolean {
    return this.isOverloaded;
  }

  getThrottleDelay(): number {
    return this.isOverloaded ? 500 : 0; // 500ms delay when overloaded
  }

  // Skip non-critical operations when overloaded
  shouldSkipNonCritical(): boolean {
    return this.isOverloaded;
  }
}

export const reportsGracefulDegradation = new ReportsGracefulDegradation();
