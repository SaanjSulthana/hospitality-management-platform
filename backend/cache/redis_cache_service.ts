// Redis cache service with support for both in-memory and external Redis
// Automatically switches based on REDIS_HOST environment variable

interface CacheEntry<T> {
  data: T;
  version: string;
  cachedAt: number;
  expiresAt: number;
}

// External Redis client interface (will be initialized lazily)
let redisClient: any = null;
let redisAvailable = false;

// Initialize external Redis if configured
async function initRedis(): Promise<boolean> {
  if (redisClient !== null) {
    return redisAvailable;
  }

  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT || '6379';
  const redisPassword = process.env.REDIS_PASSWORD;
  const redisUseTLS = process.env.REDIS_USE_TLS === 'true';

  if (!redisHost) {
    console.log('[RedisCache] No REDIS_HOST configured, using in-memory cache');
    redisAvailable = false;
    redisClient = null;
    return false;
  }

  try {
    // Dynamically import ioredis (install with: npm install ioredis)
    const Redis = (await import('ioredis')).default;
    
    redisClient = new Redis({
      host: redisHost,
      port: parseInt(redisPort),
      password: redisPassword,
      tls: redisUseTLS ? {} : undefined,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    await redisClient.connect();
    redisAvailable = true;
    console.log(`[RedisCache] ✅ Connected to external Redis at ${redisHost}:${redisPort}`);
    return true;
  } catch (error) {
    console.error('[RedisCache] ❌ Failed to connect to external Redis:', error);
    console.log('[RedisCache] Falling back to in-memory cache');
    redisClient = null;
    redisAvailable = false;
    return false;
  }
}

class SimpleCache<T> {
  private memoryCache = new Map<string, CacheEntry<T>>();
  private defaultTTL: number;
  private initialized = false;

  constructor(defaultTTL: number = 2 * 60 * 1000) { // 2 minutes default
    this.defaultTTL = defaultTTL;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initRedis();
      this.initialized = true;
    }
  }

  async get(key: string): Promise<T | null> {
    await this.ensureInitialized();

    // Try external Redis first if available
    if (redisAvailable && redisClient) {
      try {
        const data = await redisClient.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          return parsed.data;
        }
        return null;
      } catch (error) {
        console.error(`[RedisCache] Error getting from Redis, falling back to memory:`, error);
        // Fall through to memory cache
      }
    }

    // Fall back to in-memory cache
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  async set(key: string, data: T, ttl?: string): Promise<void> {
    await this.ensureInitialized();
    
    const ttlMs = this.parseTTL(ttl) || this.defaultTTL;
    const entry = {
      data,
      version: "v1",
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttlMs
    };

    // Set in external Redis if available
    if (redisAvailable && redisClient) {
      try {
        const ttlSeconds = Math.floor(ttlMs / 1000);
        await redisClient.setex(key, ttlSeconds, JSON.stringify(entry));
        return;
      } catch (error) {
        console.error(`[RedisCache] Error setting in Redis, falling back to memory:`, error);
        // Fall through to memory cache
      }
    }

    // Fall back to in-memory cache
    this.memoryCache.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    await this.ensureInitialized();

    // Delete from external Redis if available
    if (redisAvailable && redisClient) {
      try {
        await redisClient.del(key);
      } catch (error) {
        console.error(`[RedisCache] Error deleting from Redis:`, error);
      }
    }

    // Also delete from memory cache
    this.memoryCache.delete(key);
  }

  async getStats(): Promise<{
    type: 'redis' | 'memory';
    available: boolean;
    memoryEntries: number;
    redisInfo?: any;
  }> {
    await this.ensureInitialized();

    const stats: any = {
      type: redisAvailable ? 'redis' : 'memory',
      available: redisAvailable,
      memoryEntries: this.memoryCache.size,
    };

    if (redisAvailable && redisClient) {
      try {
        const info = await redisClient.info('memory');
        const dbsize = await redisClient.dbsize();
        stats.redisInfo = {
          connected: true,
          keys: dbsize,
          info: info,
        };
      } catch (error) {
        stats.redisInfo = {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return stats;
  }

  async clearAll(): Promise<void> {
    await this.ensureInitialized();
    this.memoryCache.clear();

    if (redisAvailable && redisClient) {
      try {
        const keys: string[] = await redisClient.keys('*');
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } catch (error) {
        console.error('[RedisCache] Error clearing Redis cache:', error);
      }
    }
  }

  async clearByPrefix(prefix: string): Promise<void> {
    await this.ensureInitialized();

    for (const key of Array.from(this.memoryCache.keys())) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }

    if (redisAvailable && redisClient) {
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
        }
      } catch (error) {
        console.error(`[RedisCache] Error clearing keys with prefix ${prefix}:`, error);
      }
    }
  }

  private parseTTL(ttl?: string): number {
    if (!ttl) return this.defaultTTL;
    
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return this.defaultTTL;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return this.defaultTTL;
    }
  }
}

// Define cache instances for different data types
export const reportsCache = new SimpleCache<any>(2 * 60 * 1000); // 2 minutes
export const balanceCache = new SimpleCache<any>(5 * 60 * 1000); // 5 minutes
export const summaryCache = new SimpleCache<any>(10 * 60 * 1000); // 10 minutes

interface ReportCacheData {
  data: any;
  version: string;
  cachedAt: number;
}

interface BalanceCacheData {
  openingBalance: number;
  closingBalance: number;
  transactions: number;
  version: string;
}

interface SummaryCacheData {
  summary: any;
  period: string;
  version: string;
}
