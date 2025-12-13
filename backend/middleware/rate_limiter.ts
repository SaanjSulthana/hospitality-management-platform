/**
 * Token Bucket Rate Limiter
 * 
 * Implements rate limiting per the A-grade networking plan:
 * 
 * | Endpoint Type          | Per User    | Per Org      |
 * |------------------------|-------------|--------------|
 * | Write (POST/PUT/PATCH) | 100 req/min | 500 req/min  |
 * | Read (after CDN miss)  | 300 req/min | -            |
 * | Realtime subscriptions | 10 streams  | 1000 streams |
 * | Signed URL generation  | 50 req/min  | 500 req/min  |
 * 
 * Response: 429 Too Many Requests with Retry-After header
 * 
 * @see docs/NETWORKING_AND_REALTIME_IMPROVEMENTS.md Rate Limiting section
 */

/**
 * Token bucket implementation for smooth rate limiting
 * 
 * Allows bursts up to bucket capacity while enforcing average rate.
 */
interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number; // tokens per second
}

/**
 * Rate limit configuration per limit type
 */
export interface RateLimitConfig {
  /** Maximum tokens (burst capacity) */
  capacity: number;
  
  /** Tokens added per second */
  refillRate: number;
  
  /** Window duration in milliseconds (for sliding window fallback) */
  windowMs: number;
  
  /** Whether this limit applies per-user or per-org */
  scope: 'user' | 'org';
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  // Write endpoints: 100 req/min per user, 500 req/min per org
  WRITE_USER: {
    capacity: 20,          // Burst of 20
    refillRate: 100 / 60,  // ~1.67 tokens/sec = 100/min
    windowMs: 60_000,
    scope: 'user' as const,
  },
  WRITE_ORG: {
    capacity: 100,         // Burst of 100
    refillRate: 500 / 60,  // ~8.33 tokens/sec = 500/min
    windowMs: 60_000,
    scope: 'org' as const,
  },
  
  // Read endpoints (after CDN miss): 300 req/min per user
  READ_USER: {
    capacity: 60,          // Burst of 60
    refillRate: 300 / 60,  // 5 tokens/sec = 300/min
    windowMs: 60_000,
    scope: 'user' as const,
  },
  
  // Realtime subscriptions: 10 per user, 1000 per org
  REALTIME_USER: {
    capacity: 10,
    refillRate: 0.017,     // ~1 per minute recovery
    windowMs: 60_000,
    scope: 'user' as const,
  },
  REALTIME_ORG: {
    capacity: 1000,
    refillRate: 1,         // 1 per second recovery
    windowMs: 60_000,
    scope: 'org' as const,
  },
  
  // Signed URL generation: 50 req/min per user, 500 per org
  SIGNED_URL_USER: {
    capacity: 10,
    refillRate: 50 / 60,
    windowMs: 60_000,
    scope: 'user' as const,
  },
  SIGNED_URL_ORG: {
    capacity: 100,
    refillRate: 500 / 60,
    windowMs: 60_000,
    scope: 'org' as const,
  },
} as const;

export type RateLimitType = keyof typeof RATE_LIMITS;

/**
 * In-memory storage for rate limit buckets
 * 
 * Key format: {type}:{scope_id}
 * Example: "WRITE_USER:123" or "WRITE_ORG:456"
 */
const buckets = new Map<string, TokenBucket>();

/**
 * Cleanup interval for expired buckets (5 minutes)
 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const BUCKET_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes of inactivity

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start cleanup timer
 */
function ensureCleanupTimer(): void {
  if (cleanupTimer) return;
  
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    const expiryCutoff = now - BUCKET_EXPIRY_MS;
    
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.lastRefill < expiryCutoff) {
        buckets.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  
  // Don't prevent process exit
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

/**
 * Get or create a token bucket
 */
function getOrCreateBucket(
  key: string,
  config: RateLimitConfig
): TokenBucket {
  let bucket = buckets.get(key);
  
  if (!bucket) {
    bucket = {
      tokens: config.capacity,
      lastRefill: Date.now(),
      capacity: config.capacity,
      refillRate: config.refillRate,
    };
    buckets.set(key, bucket);
    ensureCleanupTimer();
  }
  
  return bucket;
}

/**
 * Refill tokens based on elapsed time
 */
function refillBucket(bucket: TokenBucket): void {
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 1000; // seconds
  
  const tokensToAdd = elapsed * bucket.refillRate;
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;
}

/**
 * Try to consume a token from the bucket
 * 
 * @returns true if token was consumed, false if rate limited
 */
function tryConsumeToken(bucket: TokenBucket): boolean {
  refillBucket(bucket);
  
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  
  return false;
}

/**
 * Calculate time until next token is available
 */
function getRetryAfterSeconds(bucket: TokenBucket): number {
  refillBucket(bucket);
  
  if (bucket.tokens >= 1) {
    return 0;
  }
  
  const tokensNeeded = 1 - bucket.tokens;
  const secondsNeeded = tokensNeeded / bucket.refillRate;
  
  // Add jitter (5-30s as per plan)
  const jitter = 5 + Math.random() * 25;
  
  return Math.ceil(secondsNeeded + jitter);
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  
  /** Remaining tokens (for headers) */
  remaining: number;
  
  /** Bucket capacity (for headers) */
  limit: number;
  
  /** When the bucket resets (Unix timestamp) */
  resetAt: number;
  
  /** Seconds to wait before retry (if rate limited) */
  retryAfter?: number;
  
  /** Which limit was hit (if rate limited) */
  limitType?: RateLimitType;
}

/**
 * Build bucket key
 */
function buildKey(type: RateLimitType, scopeId: number): string {
  return `${type}:${scopeId}`;
}

/**
 * Check rate limit for a single limit type
 */
export function checkRateLimit(
  type: RateLimitType,
  scopeId: number
): RateLimitResult {
  const config = RATE_LIMITS[type];
  const key = buildKey(type, scopeId);
  const bucket = getOrCreateBucket(key, config);
  
  const allowed = tryConsumeToken(bucket);
  
  return {
    allowed,
    remaining: Math.floor(bucket.tokens),
    limit: bucket.capacity,
    resetAt: Math.ceil(bucket.lastRefill / 1000 + bucket.capacity / bucket.refillRate),
    retryAfter: allowed ? undefined : getRetryAfterSeconds(bucket),
    limitType: allowed ? undefined : type,
  };
}

/**
 * Check multiple rate limits (returns first failure)
 */
export function checkRateLimits(
  checks: Array<{ type: RateLimitType; scopeId: number }>
): RateLimitResult {
  for (const { type, scopeId } of checks) {
    const result = checkRateLimit(type, scopeId);
    if (!result.allowed) {
      return result;
    }
  }
  
  // All passed - return last check result
  if (checks.length > 0) {
    const last = checks[checks.length - 1];
    return checkRateLimit(last.type, last.scopeId);
  }
  
  // No checks - allow by default
  return {
    allowed: true,
    remaining: 0,
    limit: 0,
    resetAt: Math.ceil(Date.now() / 1000),
  };
}

/**
 * Check rate limit for write operations
 * 
 * Checks both per-user and per-org limits
 */
export function checkWriteRateLimit(
  userId: number,
  orgId: number
): RateLimitResult {
  // Check user limit first (more restrictive)
  const userResult = checkRateLimit('WRITE_USER', userId);
  if (!userResult.allowed) {
    return userResult;
  }
  
  // Check org limit
  return checkRateLimit('WRITE_ORG', orgId);
}

/**
 * Check rate limit for read operations (after CDN miss)
 */
export function checkReadRateLimit(userId: number): RateLimitResult {
  return checkRateLimit('READ_USER', userId);
}

/**
 * Check rate limit for realtime subscriptions
 */
export function checkRealtimeRateLimit(
  userId: number,
  orgId: number
): RateLimitResult {
  const userResult = checkRateLimit('REALTIME_USER', userId);
  if (!userResult.allowed) {
    return userResult;
  }
  
  return checkRateLimit('REALTIME_ORG', orgId);
}

/**
 * Check rate limit for signed URL generation
 */
export function checkSignedUrlRateLimit(
  userId: number,
  orgId: number
): RateLimitResult {
  const userResult = checkRateLimit('SIGNED_URL_USER', userId);
  if (!userResult.allowed) {
    return userResult;
  }
  
  return checkRateLimit('SIGNED_URL_ORG', orgId);
}

/**
 * Generate rate limit response headers
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt),
  };
  
  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = String(result.retryAfter);
    headers['X-RateLimit-RetryAfter'] = String(result.retryAfter);
  }
  
  return headers;
}

/**
 * Create a 429 error response
 */
export function createRateLimitError(result: RateLimitResult): {
  code: string;
  message: string;
  details: {
    retryAfter: number;
    limitType: string;
    remaining: number;
  };
} {
  return {
    code: 'rate_limit_exceeded',
    message: `Rate limit exceeded. Please retry after ${result.retryAfter} seconds.`,
    details: {
      retryAfter: result.retryAfter ?? 30,
      limitType: result.limitType ?? 'unknown',
      remaining: result.remaining,
    },
  };
}

/**
 * Get current rate limit stats (for monitoring)
 */
export function getRateLimitStats(): {
  totalBuckets: number;
  bucketsByType: Record<string, number>;
  avgTokensRemaining: Record<string, number>;
} {
  const stats = {
    totalBuckets: buckets.size,
    bucketsByType: {} as Record<string, number>,
    avgTokensRemaining: {} as Record<string, number>,
  };
  
  const tokenSums: Record<string, { sum: number; count: number }> = {};
  
  for (const [key, bucket] of buckets.entries()) {
    const type = key.split(':')[0];
    
    stats.bucketsByType[type] = (stats.bucketsByType[type] || 0) + 1;
    
    if (!tokenSums[type]) {
      tokenSums[type] = { sum: 0, count: 0 };
    }
    tokenSums[type].sum += bucket.tokens;
    tokenSums[type].count += 1;
  }
  
  for (const [type, data] of Object.entries(tokenSums)) {
    stats.avgTokensRemaining[type] = data.count > 0 
      ? Math.round(data.sum / data.count * 100) / 100 
      : 0;
  }
  
  return stats;
}

/**
 * Reset all rate limits (for testing)
 */
export function resetAllRateLimits(): void {
  buckets.clear();
}

/**
 * Reset rate limit for a specific scope
 */
export function resetRateLimit(type: RateLimitType, scopeId: number): void {
  const key = buildKey(type, scopeId);
  buckets.delete(key);
}

/**
 * Manually set tokens for a bucket (for admin overrides)
 */
export function setRateLimitTokens(
  type: RateLimitType,
  scopeId: number,
  tokens: number
): void {
  const config = RATE_LIMITS[type];
  const key = buildKey(type, scopeId);
  const bucket = getOrCreateBucket(key, config);
  
  bucket.tokens = Math.min(tokens, bucket.capacity);
  bucket.lastRefill = Date.now();
}

/**
 * Middleware helper for rate limiting
 * 
 * Usage:
 * ```typescript
 * const rateLimitResult = enforceRateLimit(
 *   req.method === 'GET' ? 'read' : 'write',
 *   auth.userId,
 *   auth.orgId
 * );
 * 
 * if (!rateLimitResult.allowed) {
 *   throw new APIError({
 *     code: ErrCode.ResourceExhausted,
 *     message: rateLimitResult.error.message,
 *   });
 * }
 * ```
 */
export function enforceRateLimit(
  operationType: 'read' | 'write' | 'realtime' | 'signed_url',
  userId: number,
  orgId: number
): RateLimitResult & { error?: ReturnType<typeof createRateLimitError> } {
  let result: RateLimitResult;
  
  switch (operationType) {
    case 'write':
      result = checkWriteRateLimit(userId, orgId);
      break;
    case 'read':
      result = checkReadRateLimit(userId);
      break;
    case 'realtime':
      result = checkRealtimeRateLimit(userId, orgId);
      break;
    case 'signed_url':
      result = checkSignedUrlRateLimit(userId, orgId);
      break;
    default:
      result = checkReadRateLimit(userId);
  }
  
  if (!result.allowed) {
    return {
      ...result,
      error: createRateLimitError(result),
    };
  }
  
  return result;
}

// Export types
export type { RateLimitConfig, TokenBucket };

