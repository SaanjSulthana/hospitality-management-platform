/**
 * Encore Cache Backend
 * 
 * Distributed cache implementation using Encore's managed cache service.
 * Suitable for L2 cache tier in production environments.
 * 
 * Features:
 * - Zero infrastructure management
 * - Automatic scaling
 * - Built-in eviction policies (LRU/LFU)
 * - Cross-instance cache sharing
 * 
 * Note: Currently using a stub implementation until encore.dev/storage/cache
 * is available in the Encore runtime version.
 */

import { CacheBackend, CacheStats } from './types';

// Encore cache module - will be available in future versions
// import { cache } from "encore.dev/storage/cache";

// Temporary in-memory implementation until Encore cache API is available
class EncoreCacheStub {
  private cache = new Map<string, { value: any; expiresAt: number }>();
  
  async get(key: string): Promise<any> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }
  
  async set(key: string, value: any, options?: { ttl?: string }): Promise<void> {
    const ttlMs = this.parseTTL(options?.ttl || '5m');
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }
  
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }
  
  private parseTTL(ttl: string): number {
    const match = ttl.match(/^(\d+)(ms|s|m|h|d)$/);
    if (!match) return 5 * 60 * 1000; // Default 5 minutes
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'ms': return value;
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 5 * 60 * 1000;
    }
  }
}

export class EncoreCacheClient implements CacheBackend {
  private cluster: EncoreCacheStub;
  private defaultTTL: string;
  
  constructor(config: {
    clusterName?: string;
    maxEntries?: number;
    defaultTTL?: string;
    evictionPolicy?: 'AllKeysLRU' | 'AllKeysLFU' | 'VolatileLRU';
  } = {}) {
    const {
      clusterName = 'distributed_cache',
      maxEntries = 1000000, // 1M entries for 1M orgs
      defaultTTL = '5m',
      evictionPolicy = 'AllKeysLRU'
    } = config;
    
    this.defaultTTL = defaultTTL;
    
    // Initialize Encore cache cluster with configuration
    // Note: Using stub implementation until encore.dev/storage/cache is available
    this.cluster = new EncoreCacheStub();
    
    console.log(`[EncoreCache] ⚠️ Using stub implementation (encore.dev/storage/cache not yet available)`);
    console.log(`[EncoreCache] Initialized cluster "${clusterName}"`, {
      maxEntries,
      defaultTTL,
      evictionPolicy
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cluster.get(key);
      return value as T | null;
    } catch (error) {
      console.error(`[EncoreCache] Error getting key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    try {
      let ttl = this.defaultTTL;
      
      // Convert milliseconds to Encore's TTL format (e.g., "5m", "2h")
      if (ttlMs !== undefined) {
        ttl = this.convertMsToTTL(ttlMs);
      }
      
      await this.cluster.set(key, value, { ttl });
    } catch (error) {
      console.error(`[EncoreCache] Error setting key ${key}:`, error);
      // Don't throw - cache failures should not break the application
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.cluster.delete(key);
    } catch (error) {
      console.error(`[EncoreCache] Error deleting key ${key}:`, error);
    }
  }

  async clearAll(): Promise<void> {
    // Encore cache doesn't support clearAll directly
    // This would require tracking all keys or using a generation/version approach
    console.warn('[EncoreCache] clearAll() not supported - use version-based invalidation instead');
  }

  async clearByPrefix(prefix: string): Promise<void> {
    // Encore cache doesn't support prefix scanning/deletion
    // This is by design - rely on version-based invalidation at application level
    console.warn(`[EncoreCache] clearByPrefix("${prefix}") not supported - use version-based invalidation instead`);
  }

  async getStats(): Promise<CacheStats> {
    try {
      // Encore cache doesn't expose detailed stats via API
      // Return basic health status
      return {
        type: 'encore',
        available: true,
        timestamp: new Date().toISOString(),
        metadata: {
          clusterInitialized: true,
          defaultTTL: this.defaultTTL
        }
      };
    } catch (error) {
      return {
        type: 'encore',
        available: false,
        timestamp: new Date().toISOString(),
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Convert milliseconds to Encore TTL format
   * Examples: 1000ms -> "1s", 60000ms -> "1m", 3600000ms -> "1h"
   */
  private convertMsToTTL(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${Math.floor(ms / 1000)}s`;
    } else if (ms < 3600000) {
      return `${Math.floor(ms / 60000)}m`;
    } else if (ms < 86400000) {
      return `${Math.floor(ms / 3600000)}h`;
    } else {
      return `${Math.floor(ms / 86400000)}d`;
    }
  }
}

