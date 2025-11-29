/**
 * Cache Configuration
 * 
 * Centralized configuration for tiered cache system supporting:
 * - L1: Memory (process-local)
 * - L2: Encore Cache (managed distributed cache)
 * - L3: Redis (optional for heavy workloads)
 */

export type CacheBackendType = 'memory' | 'redis' | 'encore' | 'hybrid';
export type CacheTieringMode = 'L1' | 'L1L2' | 'L1L2L3';

export interface CacheConfig {
  // Backend selection
  backend: CacheBackendType;
  tiering: CacheTieringMode;
  
  // Memory cache settings
  memoryMaxEntries: number;
  memoryDefaultTTL: number; // milliseconds
  
  // Encore cache settings
  encoreMaxEntries: number;
  encoreDefaultTTL: string; // e.g., "5m"
  encoreEvictionPolicy: 'AllKeysLRU' | 'AllKeysLFU' | 'VolatileLRU';
  
  // Redis settings
  redisHost?: string;
  redisPort: number;
  redisPassword?: string;
  redisUseTLS: boolean;
  redisMaxRetries: number;
  redisConnectTimeout: number;
  
  // Defensive invalidation (adds ±1 day to invalidation ranges)
  defensiveInvalidation: boolean;
  
  // Observability
  metricsEnabled: boolean;
}

/**
 * Load cache configuration from environment variables
 */
export function loadCacheConfig(): CacheConfig {
  const backend = (process.env.CACHE_BACKEND || 'memory') as CacheBackendType;
  const tiering = (process.env.CACHE_TIERING || getDefaultTiering()) as CacheTieringMode;
  
  return {
    backend,
    tiering,
    
    // Memory settings
    memoryMaxEntries: parseInt(process.env.CACHE_MEMORY_MAX_ENTRIES || '10000'),
    memoryDefaultTTL: parseInt(process.env.CACHE_MEMORY_DEFAULT_TTL || '120000'), // 2 minutes
    
    // Encore cache settings
    encoreMaxEntries: parseInt(process.env.CACHE_ENCORE_MAX_ENTRIES || '1000000'), // 1M for 1M orgs
    encoreDefaultTTL: process.env.CACHE_ENCORE_DEFAULT_TTL || '5m',
    encoreEvictionPolicy: (process.env.CACHE_ENCORE_EVICTION || 'AllKeysLRU') as any,
    
    // Redis settings
    redisHost: process.env.REDIS_HOST,
    redisPort: parseInt(process.env.REDIS_PORT || '6379'),
    redisPassword: process.env.REDIS_PASSWORD,
    redisUseTLS: process.env.REDIS_USE_TLS === 'true',
    redisMaxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
    redisConnectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '5000'),
    
    // Defensive invalidation
    defensiveInvalidation: process.env.CACHE_DEFENSIVE_INVALIDATION === 'true',
    
    // Observability
    metricsEnabled: process.env.CACHE_METRICS_ENABLED !== 'false', // enabled by default
  };
}

/**
 * Get default tiering mode based on environment
 */
function getDefaultTiering(): CacheTieringMode {
  const env = process.env.NODE_ENV || 'development';
  
  // Note: L2 (Encore Cache) uses stub until encore.dev/storage/cache API is available
  // For production distribution, use L1L2L3 with Redis as L3
  
  switch (env) {
    case 'development':
    case 'test':
      return 'L1'; // Memory only for dev/test
    case 'staging':
      return 'L1'; // Memory only (L2 stub not yet useful)
    case 'production':
      return 'L1'; // Memory only (add L3 Redis if distribution needed)
    default:
      return 'L1';
  }
}

/**
 * Validate cache configuration
 */
export function validateCacheConfig(config: CacheConfig): string[] {
  const errors: string[] = [];
  
  if (config.tiering.includes('L3') && !config.redisHost) {
    errors.push('L3 tiering (Redis) enabled but REDIS_HOST not configured');
  }
  
  if (config.memoryMaxEntries < 100) {
    errors.push('CACHE_MEMORY_MAX_ENTRIES too low (minimum 100)');
  }
  
  if (config.encoreMaxEntries < 1000) {
    errors.push('CACHE_ENCORE_MAX_ENTRIES too low (minimum 1000)');
  }
  
  return errors;
}

/**
 * Global cache configuration instance
 */
export const cacheConfig = loadCacheConfig();

/**
 * Log cache configuration on startup
 */
export function logCacheConfig(): void {
  const errors = validateCacheConfig(cacheConfig);
  
  if (errors.length > 0) {
    console.error('[CacheConfig] ❌ Configuration errors:', errors);
  }
  
  console.log('[CacheConfig] ✅ Cache system initialized', {
    backend: cacheConfig.backend,
    tiering: cacheConfig.tiering,
    memoryMaxEntries: cacheConfig.memoryMaxEntries,
    encoreMaxEntries: cacheConfig.encoreMaxEntries,
    redisEnabled: !!cacheConfig.redisHost,
    defensiveInvalidation: cacheConfig.defensiveInvalidation,
  });
}

