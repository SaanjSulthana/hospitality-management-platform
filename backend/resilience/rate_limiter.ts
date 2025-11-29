// Rate Limiter - Phase 3 Advanced Scaling
// Target: Distributed rate limiting for production reliability (1M+ organizations)

// Rate Limiter Interfaces
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: any) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Skip counting successful requests
  skipFailedRequests?: boolean; // Skip counting failed requests
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface RateLimitStats {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  averageRequestsPerSecond: number;
  peakRequestsPerSecond: number;
  currentActiveWindows: number;
}

// Rate Limiter Class
export class RateLimiter {
  private name: string;
  private config: RateLimitConfig;
  private windows: Map<string, { count: number; resetTime: number }> = new Map();
  private stats = {
    totalRequests: 0,
    allowedRequests: 0,
    blockedRequests: 0,
    averageRequestsPerSecond: 0,
    peakRequestsPerSecond: 0,
    currentActiveWindows: 0
  };
  private requestHistory: number[] = [];
  private startTime = Date.now();

  constructor(name: string, config: RateLimitConfig) {
    this.name = name;
    this.config = config;
    console.log(`[RateLimiter:${name}] Initialized with config:`, config);
    
    // Cleanup expired windows every minute
    setInterval(() => this.cleanupExpiredWindows(), 60000);
  }

  // Check Rate Limit
  checkRateLimit(key: string): RateLimitInfo {
    this.stats.totalRequests++;
    this.recordRequest();

    const now = Date.now();
    const windowKey = this.getWindowKey(key, now);
    const window = this.windows.get(windowKey);

    if (!window) {
      // Create new window
      this.windows.set(windowKey, {
        count: 1,
        resetTime: now + this.config.windowMs
      });
      this.stats.allowedRequests++;
      this.updateActiveWindows();
      
      return {
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs
      };
    }

    if (window.count >= this.config.maxRequests) {
      // Rate limit exceeded
      this.stats.blockedRequests++;
      
      return {
        limit: this.config.maxRequests,
        remaining: 0,
        resetTime: window.resetTime,
        retryAfter: Math.ceil((window.resetTime - now) / 1000)
      };
    }

    // Increment count
    window.count++;
    this.stats.allowedRequests++;
    
    return {
      limit: this.config.maxRequests,
      remaining: this.config.maxRequests - window.count,
      resetTime: window.resetTime
    };
  }

  // Check Rate Limit with Custom Key
  checkRateLimitWithKey(req: any): RateLimitInfo {
    const key = this.config.keyGenerator ? this.config.keyGenerator(req) : this.getDefaultKey(req);
    return this.checkRateLimit(key);
  }

  // Get Window Key
  private getWindowKey(key: string, timestamp: number): string {
    const windowStart = Math.floor(timestamp / this.config.windowMs) * this.config.windowMs;
    return `${key}:${windowStart}`;
  }

  // Get Default Key
  private getDefaultKey(req: any): string {
    // Default key generation based on IP and user
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const userId = req.user?.id || req.auth?.userId || 'anonymous';
    return `${ip}:${userId}`;
  }

  // Record Request
  private recordRequest(): void {
    const now = Date.now();
    this.requestHistory.push(now);
    
    // Keep only last 60 seconds of history
    const cutoff = now - 60000;
    this.requestHistory = this.requestHistory.filter(time => time > cutoff);
    
    // Update statistics
    this.updateStats();
  }

  // Update Statistics
  private updateStats(): void {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    // Calculate requests per second
    const recentRequests = this.requestHistory.filter(time => time > oneSecondAgo);
    const currentRPS = recentRequests.length;
    
    this.stats.averageRequestsPerSecond = this.requestHistory.length / 60; // Average over last minute
    this.stats.peakRequestsPerSecond = Math.max(this.stats.peakRequestsPerSecond, currentRPS);
  }

  // Update Active Windows
  private updateActiveWindows(): void {
    this.stats.currentActiveWindows = this.windows.size;
  }

  // Cleanup Expired Windows
  private cleanupExpiredWindows(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, window] of this.windows) {
      if (window.resetTime <= now) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this.windows.delete(key);
    }
    
    this.updateActiveWindows();
    
    if (expiredKeys.length > 0) {
      console.log(`[RateLimiter:${this.name}] Cleaned up ${expiredKeys.length} expired windows`);
    }
  }

  // Get Rate Limit Info for Key
  getRateLimitInfo(key: string): RateLimitInfo | null {
    const now = Date.now();
    const windowKey = this.getWindowKey(key, now);
    const window = this.windows.get(windowKey);
    
    if (!window) {
      return {
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs
      };
    }
    
    return {
      limit: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - window.count),
      resetTime: window.resetTime
    };
  }

  // Get Statistics
  getStats(): RateLimitStats {
    return {
      totalRequests: this.stats.totalRequests,
      allowedRequests: this.stats.allowedRequests,
      blockedRequests: this.stats.blockedRequests,
      averageRequestsPerSecond: this.stats.averageRequestsPerSecond,
      peakRequestsPerSecond: this.stats.peakRequestsPerSecond,
      currentActiveWindows: this.stats.currentActiveWindows
    };
  }

  // Reset Statistics
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      averageRequestsPerSecond: 0,
      peakRequestsPerSecond: 0,
      currentActiveWindows: 0
    };
    this.requestHistory = [];
    this.windows.clear();
    console.log(`[RateLimiter:${this.name}] Statistics reset`);
  }

  // Update Configuration
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
    console.log(`[RateLimiter:${this.name}] Configuration updated:`, this.config);
  }

  // Get Active Windows
  getActiveWindows(): Map<string, { count: number; resetTime: number }> {
    return new Map(this.windows);
  }

  // Clear All Windows
  clearAllWindows(): void {
    this.windows.clear();
    this.updateActiveWindows();
    console.log(`[RateLimiter:${this.name}] All windows cleared`);
  }
}

// Rate Limiter Manager
export class RateLimiterManager {
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private defaultConfig: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  };

  // Create Rate Limiter
  createRateLimiter(name: string, config?: Partial<RateLimitConfig>): RateLimiter {
    const finalConfig = { ...this.defaultConfig, ...config };
    const rateLimiter = new RateLimiter(name, finalConfig);
    this.rateLimiters.set(name, rateLimiter);
    return rateLimiter;
  }

  // Get Rate Limiter
  getRateLimiter(name: string): RateLimiter | undefined {
    return this.rateLimiters.get(name);
  }

  // Get All Rate Limiters
  getAllRateLimiters(): Map<string, RateLimiter> {
    return new Map(this.rateLimiters);
  }

  // Get All Statistics
  getAllStats(): { [name: string]: RateLimitStats } {
    const stats: { [name: string]: RateLimitStats } = {};
    for (const [name, limiter] of this.rateLimiters) {
      stats[name] = limiter.getStats();
    }
    return stats;
  }

  // Reset All Statistics
  resetAllStats(): void {
    for (const limiter of this.rateLimiters.values()) {
      limiter.resetStats();
    }
    console.log('[RateLimiterManager] All statistics reset');
  }

  // Get Health Status
  getHealthStatus(): {
    healthy: number;
    unhealthy: number;
    total: number;
    details: { [name: string]: { blockedRate: number; peakRPS: number } };
  } {
    let healthy = 0;
    let unhealthy = 0;
    const details: { [name: string]: { blockedRate: number; peakRPS: number } } = {};

    for (const [name, limiter] of this.rateLimiters) {
      const stats = limiter.getStats();
      const blockedRate = stats.totalRequests > 0 ? stats.blockedRequests / stats.totalRequests : 0;
      
      details[name] = {
        blockedRate,
        peakRPS: stats.peakRequestsPerSecond
      };
      
      // Consider unhealthy if blocked rate > 10% or peak RPS > 1000
      if (blockedRate > 0.1 || stats.peakRequestsPerSecond > 1000) {
        unhealthy++;
      } else {
        healthy++;
      }
    }

    return {
      healthy,
      unhealthy,
      total: this.rateLimiters.size,
      details
    };
  }
}

// Global rate limiter manager
export const rateLimiterManager = new RateLimiterManager();

// Pre-configured rate limiters for common services
export const financeRateLimiter = rateLimiterManager.createRateLimiter('finance', {
  windowMs: 60000, // 1 minute
  maxRequests: 1000, // 1000 requests per minute
  keyGenerator: (req) => `finance:${req.user?.id || req.ip}`
});

export const reportsRateLimiter = rateLimiterManager.createRateLimiter('reports', {
  windowMs: 60000, // 1 minute
  maxRequests: 500, // 500 requests per minute
  keyGenerator: (req) => `reports:${req.user?.id || req.ip}`
});

export const cacheRateLimiter = rateLimiterManager.createRateLimiter('cache', {
  windowMs: 60000, // 1 minute
  maxRequests: 2000, // 2000 requests per minute
  keyGenerator: (req) => `cache:${req.user?.id || req.ip}`
});

export const eventsRateLimiter = rateLimiterManager.createRateLimiter('events', {
  windowMs: 60000, // 1 minute
  maxRequests: 1500, // 1500 requests per minute
  keyGenerator: (req) => `events:${req.user?.id || req.ip}`
});

// Utility function for easy rate limiting
export function withRateLimit(
  req: any,
  limiterName: string = 'default',
  config?: Partial<RateLimitConfig>
): RateLimitInfo {
  let limiter = rateLimiterManager.getRateLimiter(limiterName);
  
  if (!limiter) {
    limiter = rateLimiterManager.createRateLimiter(limiterName, config);
  }
  
  return limiter.checkRateLimitWithKey(req);
}
