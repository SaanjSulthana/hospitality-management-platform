/**
 * Redis Cache Backend
 * 
 * External Redis cache implementation with automatic fallback to memory.
 * Suitable for L3 cache tier for heavy workloads or when Encore Cache needs supplementing.
 */

import { CacheBackend, CacheStats, CacheEntry } from './types';

// External Redis client interface (will be initialized lazily)
let redisClient: any = null;
let redisAvailable = false;
let redisInitialized = false; // FIX: Track if init has run to avoid log spam

/**
 * Initialize external Redis if configured
 */
async function initRedis(config: {
  host?: string;
  port: number;
  password?: string;
  useTLS: boolean;
  maxRetries: number;
  connectTimeout: number;
}): Promise<boolean> {
  // FIX: Check if already initialized to prevent repeated log messages
  if (redisInitialized) {
    return redisAvailable;
  }
  redisInitialized = true;

  const { host, port, password, useTLS, maxRetries, connectTimeout } = config;

  if (!host) {
    console.log('[RedisCache] No REDIS_HOST configured');
    redisAvailable = false;
    redisClient = null;
    return false;
  }

  try {
    // Dynamically import ioredis
    const Redis = (await import('ioredis')).default;
    
    redisClient = new Redis({
      host,
      port,
      password,
      tls: useTLS ? {} : undefined,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: maxRetries,
      enableOfflineQueue: false,
      lazyConnect: true,
      connectTimeout,
    });

    await redisClient.connect();
    redisAvailable = true;
    console.log(`[RedisCache] ✅ Connected to external Redis at ${host}:${port}`);
    return true;
  } catch (error) {
    console.error('[RedisCache] ❌ Failed to connect to external Redis:', error);
    console.log('[RedisCache] Redis cache will be unavailable');
    redisClient = null;
    redisAvailable = false;
    return false;
  }
}

export class RedisCacheClient implements CacheBackend {
  private defaultTTL: number;
  private initialized = false;
  private config: {
    host?: string;
    port: number;
    password?: string;
    useTLS: boolean;
    maxRetries: number;
    connectTimeout: number;
  };

  constructor(config: {
    host?: string;
    port?: number;
    password?: string;
    useTLS?: boolean;
    maxRetries?: number;
    connectTimeout?: number;
    defaultTTL?: number;
  } = {}) {
    this.config = {
      host: config.host,
      port: config.port || 6379,
      password: config.password,
      useTLS: config.useTLS || false,
      maxRetries: config.maxRetries || 3,
      connectTimeout: config.connectTimeout || 5000,
    };
    this.defaultTTL = config.defaultTTL || 2 * 60 * 1000; // 2 minutes
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initRedis(this.config);
      this.initialized = true;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    await this.ensureInitialized();

    if (!redisAvailable || !redisClient) {
      return null;
    }

    try {
      const data = await redisClient.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        return parsed.data;
      }
      return null;
    } catch (error) {
      console.error(`[RedisCache] Error getting key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    await this.ensureInitialized();

    if (!redisAvailable || !redisClient) {
      return; // Silently skip if Redis unavailable
    }

    try {
      const ttl = ttlMs ?? this.defaultTTL;
      const entry: CacheEntry<T> = {
        data: value,
        version: "v1",
        cachedAt: Date.now(),
        expiresAt: Date.now() + ttl
      };

      const ttlSeconds = Math.floor(ttl / 1000);
      await redisClient.setex(key, ttlSeconds, JSON.stringify(entry));
    } catch (error) {
      console.error(`[RedisCache] Error setting key ${key}:`, error);
    }
  }

  async delete(key: string): Promise<void> {
    await this.ensureInitialized();

    if (!redisAvailable || !redisClient) {
      return;
    }

    try {
      await redisClient.del(key);
    } catch (error) {
      console.error(`[RedisCache] Error deleting key ${key}:`, error);
    }
  }

  async clearAll(): Promise<void> {
    await this.ensureInitialized();

    if (!redisAvailable || !redisClient) {
      return;
    }

    try {
      await redisClient.flushdb();
      console.log('[RedisCache] ⚠️ Cleared all Redis cache (flushdb)');
    } catch (error) {
      console.error('[RedisCache] Error clearing cache:', error);
    }
  }

  async clearByPrefix(prefix: string): Promise<void> {
    await this.ensureInitialized();

    if (!redisAvailable || !redisClient) {
      return;
    }

    try {
      const stream = redisClient.scanStream({ match: `${prefix}*` });
      const keys: string[] = await new Promise((resolve, reject) => {
        const collected: string[] = [];
        stream.on('data', (resultKeys: string[]) => {
          if (Array.isArray(resultKeys) && resultKeys.length > 0) {
            collected.push(...resultKeys);
          }
        });
        stream.on('end', () => resolve(collected));
        stream.on('error', (err: unknown) => reject(err));
      });

      if (keys.length > 0) {
        await redisClient.del(...keys);
        console.log(`[RedisCache] Cleared ${keys.length} keys with prefix "${prefix}"`);
      }
    } catch (error) {
      console.error(`[RedisCache] Error clearing prefix ${prefix}:`, error);
    }
  }

  async getStats(): Promise<CacheStats> {
    await this.ensureInitialized();

    if (!redisAvailable || !redisClient) {
      return {
        type: 'redis',
        available: false,
        timestamp: new Date().toISOString(),
        metadata: {
          error: 'Redis not configured or unavailable'
        }
      };
    }

    try {
      const info = await redisClient.info('memory');
      const dbsize = await redisClient.dbsize();
      
      return {
        type: 'redis',
        available: true,
        entries: dbsize,
        timestamp: new Date().toISOString(),
        metadata: {
          connected: true,
          host: this.config.host,
          port: this.config.port,
          memoryInfo: info
        }
      };
    } catch (error) {
      return {
        type: 'redis',
        available: false,
        timestamp: new Date().toISOString(),
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}

