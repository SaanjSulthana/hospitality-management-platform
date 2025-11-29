/**
 * Tiered Cache Implementation
 * 
 * Orchestrates multiple cache tiers (L1/L2/L3) with:
 * - Read-through: try tiers in order, backfill lower tiers on hit
 * - Write-through: write to all configured tiers (best effort)
 * - Delete: propagate to all tiers
 * 
 * Typical configuration:
 * - L1: Memory (fast, process-local)
 * - L2: Encore Cache (distributed, managed)
 * - L3: Redis (optional, for heavy workloads)
 */

import { CacheBackend, CacheStats, CacheMetrics } from './backends/types';

export class TieredCache implements CacheBackend {
  private tiers: Array<{ name: string; backend: CacheBackend }>;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    errors: 0,
  };

  constructor(tiers: Array<{ name: string; backend: CacheBackend }>) {
    if (tiers.length === 0) {
      throw new Error('TieredCache requires at least one tier');
    }
    this.tiers = tiers;
    
    console.log(`[TieredCache] ✅ Initialized with ${tiers.length} tier(s):`, 
      tiers.map(t => t.name).join(' → ')
    );
  }

  /**
   * Get value from cache, trying tiers in order
   * Backfills lower tiers when found in higher tier
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    for (let i = 0; i < this.tiers.length; i++) {
      const tier = this.tiers[i];
      
      try {
        const value = await tier.backend.get<T>(key);
        
        if (value !== null) {
          // Cache hit
          this.metrics.hits++;
          this.metrics.lastHitTier = tier.name;
          
          const latency = Date.now() - startTime;
          this.updateLatency(latency);
          
          // Backfill lower tiers (async, don't wait)
          if (i > 0) {
            this.backfillLowerTiers(key, value, i).catch(err => {
              console.error(`[TieredCache] Backfill error for key ${key}:`, err);
            });
          }
          
          return value;
        }
      } catch (error) {
        this.metrics.errors++;
        console.error(`[TieredCache] Error reading from ${tier.name} for key ${key}:`, error);
        // Continue to next tier
      }
    }
    
    // Cache miss - not found in any tier
    this.metrics.misses++;
    return null;
  }

  /**
   * Set value in all configured tiers (best effort)
   */
  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const promises = this.tiers.map(tier =>
      tier.backend.set(key, value, ttlMs).catch(err => {
        this.metrics.errors++;
        console.error(`[TieredCache] Error writing to ${tier.name} for key ${key}:`, err);
      })
    );
    
    // Wait for all writes (best effort)
    await Promise.allSettled(promises);
  }

  /**
   * Delete key from all tiers
   */
  async delete(key: string): Promise<void> {
    const promises = this.tiers.map(tier =>
      tier.backend.delete(key).catch(err => {
        this.metrics.errors++;
        console.error(`[TieredCache] Error deleting from ${tier.name} for key ${key}:`, err);
      })
    );
    
    await Promise.allSettled(promises);
  }

  /**
   * Clear all tiers
   */
  async clearAll(): Promise<void> {
    const promises = this.tiers.map(tier =>
      tier.backend.clearAll().catch(err => {
        console.error(`[TieredCache] Error clearing ${tier.name}:`, err);
      })
    );
    
    await Promise.allSettled(promises);
    console.log('[TieredCache] ⚠️ Cleared all cache tiers');
  }

  /**
   * Clear by prefix in all tiers
   */
  async clearByPrefix(prefix: string): Promise<void> {
    const promises = this.tiers.map(tier =>
      tier.backend.clearByPrefix(prefix).catch(err => {
        console.error(`[TieredCache] Error clearing prefix in ${tier.name}:`, err);
      })
    );
    
    await Promise.allSettled(promises);
  }

  /**
   * Get combined stats from all tiers
   */
  async getStats(): Promise<CacheStats> {
    try {
      const tierStats = await Promise.all(
        this.tiers.map(async (tier) => {
          try {
            const stats = await tier.backend.getStats();
            return { name: tier.name, ...stats };
          } catch (error) {
            return {
              name: tier.name,
              type: 'unknown' as any,
              available: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        })
      );

      const totalEntries = tierStats.reduce((sum, stat) => sum + (stat.entries || 0), 0);
      const allAvailable = tierStats.every(stat => stat.available);

      return {
        type: 'tiered',
        available: allAvailable,
        entries: totalEntries,
        timestamp: new Date().toISOString(),
        metadata: {
          tiers: tierStats,
          metrics: this.metrics
        }
      };
    } catch (error) {
      return {
        type: 'tiered',
        available: false,
        timestamp: new Date().toISOString(),
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
    };
  }

  /**
   * Backfill lower tiers with cached value
   * @private
   */
  private async backfillLowerTiers<T>(key: string, value: T, foundAtTier: number): Promise<void> {
    // Write to all tiers below the one where we found the value
    const backfillPromises = [];
    
    for (let i = 0; i < foundAtTier; i++) {
      const tier = this.tiers[i];
      backfillPromises.push(
        tier.backend.set(key, value).catch(err => {
          console.error(`[TieredCache] Backfill to ${tier.name} failed for key ${key}:`, err);
        })
      );
    }
    
    await Promise.allSettled(backfillPromises);
  }

  /**
   * Update latency percentiles
   * @private
   */
  private updateLatency(latency: number): void {
    // Simple moving average for p50/p95 (can be enhanced with proper histogram)
    if (!this.metrics.latencyP50) {
      this.metrics.latencyP50 = latency;
      this.metrics.latencyP95 = latency;
    } else {
      // Exponential moving average
      const alpha = 0.1;
      this.metrics.latencyP50 = alpha * latency + (1 - alpha) * this.metrics.latencyP50;
      this.metrics.latencyP95 = Math.max(latency, this.metrics.latencyP95 * 0.99);
    }
  }
}

