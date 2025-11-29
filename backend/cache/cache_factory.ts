/**
 * Cache Factory
 * 
 * Creates configured cache backend instances based on environment settings.
 * Supports single backend or tiered configurations.
 */

import { CacheBackend } from './backends/types';
import { MemoryCacheClient } from './backends/memory';
import { EncoreCacheClient } from './backends/encore';
import { RedisCacheClient } from './backends/redis';
import { TieredCache } from './tiered_cache';
import { cacheConfig, logCacheConfig } from './config';

let _cacheBackend: CacheBackend | null = null;

/**
 * Create cache backend based on configuration
 */
export function createCacheBackend(): CacheBackend {
  if (_cacheBackend) {
    return _cacheBackend;
  }

  // Log configuration on first creation
  logCacheConfig();

  const { tiering, backend } = cacheConfig;

  // Single backend mode
  if (tiering === 'L1') {
    _cacheBackend = createMemoryBackend();
    return _cacheBackend;
  }

  // Tiered mode
  const tiers: Array<{ name: string; backend: CacheBackend }> = [];

  // L1: Always include memory tier
  tiers.push({
    name: 'L1-Memory',
    backend: createMemoryBackend()
  });

  // L2: Encore Cache
  if (tiering === 'L1L2' || tiering === 'L1L2L3') {
    try {
      tiers.push({
        name: 'L2-Encore',
        backend: createEncoreBackend()
      });
    } catch (error) {
      console.error('[CacheFactory] Failed to create Encore backend:', error);
      console.log('[CacheFactory] Continuing with available tiers');
    }
  }

  // L3: Redis (optional)
  if (tiering === 'L1L2L3' && cacheConfig.redisHost) {
    try {
      tiers.push({
        name: 'L3-Redis',
        backend: createRedisBackend()
      });
    } catch (error) {
      console.error('[CacheFactory] Failed to create Redis backend:', error);
      console.log('[CacheFactory] Continuing with available tiers');
    }
  }

  _cacheBackend = new TieredCache(tiers);
  return _cacheBackend;
}

/**
 * Create memory cache backend
 */
function createMemoryBackend(): MemoryCacheClient {
  return new MemoryCacheClient(
    cacheConfig.memoryDefaultTTL,
    cacheConfig.memoryMaxEntries
  );
}

/**
 * Create Encore cache backend
 */
function createEncoreBackend(): EncoreCacheClient {
  return new EncoreCacheClient({
    clusterName: 'distributed_cache',
    maxEntries: cacheConfig.encoreMaxEntries,
    defaultTTL: cacheConfig.encoreDefaultTTL,
    evictionPolicy: cacheConfig.encoreEvictionPolicy
  });
}

/**
 * Create Redis cache backend
 */
function createRedisBackend(): RedisCacheClient {
  return new RedisCacheClient({
    host: cacheConfig.redisHost,
    port: cacheConfig.redisPort,
    password: cacheConfig.redisPassword,
    useTLS: cacheConfig.redisUseTLS,
    maxRetries: cacheConfig.redisMaxRetries,
    connectTimeout: cacheConfig.redisConnectTimeout,
    defaultTTL: cacheConfig.memoryDefaultTTL
  });
}

/**
 * Get the current cache backend instance
 */
export function getCacheBackend(): CacheBackend {
  if (!_cacheBackend) {
    return createCacheBackend();
  }
  return _cacheBackend;
}

/**
 * Reset cache backend (useful for testing)
 */
export function resetCacheBackend(): void {
  _cacheBackend = null;
}

