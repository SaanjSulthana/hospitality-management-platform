/**
 * Memory Cache Backend
 * 
 * In-process memory cache implementation using Map.
 * Suitable for L1 cache tier in development and as fallback.
 */

import { CacheBackend, CacheStats, CacheEntry } from './types';

export class MemoryCacheClient implements CacheBackend {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL: number;
  private maxEntries: number;
  
  constructor(defaultTTL: number = 2 * 60 * 1000, maxEntries: number = 10000) {
    this.defaultTTL = defaultTTL;
    this.maxEntries = maxEntries;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    // Enforce max entries with simple LRU (delete oldest if at capacity)
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    const ttl = ttlMs ?? this.defaultTTL;
    const entry: CacheEntry<T> = {
      data: value,
      version: "v1",
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttl
    };
    
    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clearAll(): Promise<void> {
    this.cache.clear();
  }

  async clearByPrefix(prefix: string): Promise<void> {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  async getStats(): Promise<CacheStats> {
    // Clean expired entries before reporting stats
    let expiredCount = 0;
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        expiredCount++;
      }
    }
    
    return {
      type: 'memory',
      available: true,
      entries: this.cache.size,
      timestamp: new Date().toISOString(),
      metadata: {
        maxEntries: this.maxEntries,
        defaultTTL: this.defaultTTL,
        expiredCleanedUp: expiredCount
      }
    };
  }

  /**
   * Get the underlying Map for advanced operations (use with caution)
   */
  getCache(): Map<string, CacheEntry<any>> {
    return this.cache;
  }
}

