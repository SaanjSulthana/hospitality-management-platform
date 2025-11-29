/**
 * Cache Backend Interface
 * 
 * Unified interface for all cache implementations (Memory, Redis, Encore Cache)
 * to support pluggable, tiered caching architecture for 1M+ organizations.
 */

export interface CacheBackend {
  /**
   * Retrieve a value from the cache
   * @param key Cache key
   * @returns Cached value or null if not found/expired
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Store a value in the cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttlMs Optional TTL in milliseconds (overrides default)
   */
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;

  /**
   * Delete a specific key from the cache
   * @param key Cache key to delete
   */
  delete(key: string): Promise<void>;

  /**
   * Clear all entries from the cache
   * WARNING: Use with caution in production
   */
  clearAll(): Promise<void>;

  /**
   * Clear all keys matching a prefix
   * NOTE: May be a no-op for backends that don't support prefix operations (e.g., Encore Cache)
   * @param prefix Key prefix to match
   */
  clearByPrefix(prefix: string): Promise<void>;

  /**
   * Get cache statistics and health information
   */
  getStats(): Promise<CacheStats>;
}

export interface CacheStats {
  /** Backend type identifier */
  type: 'memory' | 'redis' | 'encore' | 'tiered';
  
  /** Whether the backend is available and healthy */
  available: boolean;
  
  /** Number of entries (if known) */
  entries?: number;
  
  /** Backend-specific additional info */
  metadata?: Record<string, any>;
  
  /** Timestamp of stats collection */
  timestamp?: string;
}

export interface CacheEntry<T> {
  data: T;
  version: string;
  cacheVersion?: number; // For global version-based invalidation
  cachedAt: number;
  expiresAt: number;
}

/**
 * Cache hit/miss tracking for observability
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  lastHitTier?: string;
  latencyP50?: number;
  latencyP95?: number;
}

