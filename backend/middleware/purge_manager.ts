/**
 * CDN Purge Manager
 * 
 * Implements purge storm mitigation:
 * - Debounce purge requests per Surrogate-Key family (1-2s)
 * - Queue-and-batch purges with rate limit awareness
 * - Drop duplicates in the same window
 * - Monitor purge queue depth and CDN API error rates
 * 
 * Supports Cloudflare and Fastly APIs.
 * 
 * @see docs/NETWORKING_AND_REALTIME_IMPROVEMENTS.md Purge Storm Mitigation
 */

/**
 * CDN provider configuration
 */
export type CDNProvider = 'cloudflare' | 'fastly' | 'cloudfront' | 'mock';

export interface CDNConfig {
  provider: CDNProvider;
  
  // Cloudflare
  cloudflareZoneId?: string;
  cloudflareApiToken?: string;
  
  // Fastly
  fastlyServiceId?: string;
  fastlyApiToken?: string;
  
  // CloudFront
  cloudfrontDistributionId?: string;
  awsRegion?: string;
  
  // Rate limits
  maxPurgesPerSecond?: number;
  maxPurgesPerBatch?: number;
  
  // Debounce
  debounceMs?: number;
}

/**
 * Purge request
 */
interface PurgeRequest {
  /** Surrogate keys to purge */
  keys: string[];
  
  /** URL prefixes to purge (fallback) */
  prefixes?: string[];
  
  /** Timestamp queued */
  queuedAt: number;
  
  /** Source of the purge request */
  source: string;
  
  /** Priority (higher = sooner) */
  priority: number;
}

/**
 * Purge result
 */
export interface PurgeResult {
  success: boolean;
  keysProcessed: number;
  duration: number;
  provider: CDNProvider;
  error?: string;
  rateLimited?: boolean;
}

/**
 * Purge statistics
 */
export interface PurgeStats {
  totalPurges: number;
  successfulPurges: number;
  failedPurges: number;
  rateLimitedPurges: number;
  avgLatencyMs: number;
  queueDepth: number;
  debouncedCount: number;
  batchedCount: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<Pick<CDNConfig, 
  'maxPurgesPerSecond' | 'maxPurgesPerBatch' | 'debounceMs'>> = {
  maxPurgesPerSecond: 50,      // Most CDNs allow ~1000/min
  maxPurgesPerBatch: 30,       // Cloudflare allows 30 tags per request
  debounceMs: 1500,            // 1.5 second debounce window
};

/**
 * Purge Manager class
 */
class PurgeManager {
  private config: CDNConfig;
  private queue: Map<string, PurgeRequest> = new Map();
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private stats: PurgeStats = {
    totalPurges: 0,
    successfulPurges: 0,
    failedPurges: 0,
    rateLimitedPurges: 0,
    avgLatencyMs: 0,
    queueDepth: 0,
    debouncedCount: 0,
    batchedCount: 0,
  };
  
  // Rate limiting state
  private lastPurgeTime = 0;
  private purgesThisSecond = 0;
  
  // Processing state
  private isProcessing = false;
  private processTimer: ReturnType<typeof setInterval> | null = null;
  
  constructor(config: CDNConfig) {
    this.config = config;
    this.startProcessor();
  }
  
  /**
   * Start the background processor
   */
  private startProcessor(): void {
    if (this.processTimer) return;
    
    this.processTimer = setInterval(() => {
      this.processQueue();
    }, 100); // Check queue every 100ms
    
    if (this.processTimer.unref) {
      this.processTimer.unref();
    }
  }
  
  /**
   * Stop the background processor
   */
  public stop(): void {
    if (this.processTimer) {
      clearInterval(this.processTimer);
      this.processTimer = null;
    }
    
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
  
  /**
   * Get key family for debouncing
   * 
   * Groups related keys to debounce together:
   * - "finance:summary:property:123" → "finance:summary:property:123"
   * - "finance:expenses:property:123" → "finance:expenses:property:123"
   * - "org:123" → "org:123"
   */
  private getKeyFamily(key: string): string {
    // Already a family key if it contains colon
    return key;
  }
  
  /**
   * Queue a purge request with debouncing
   */
  public queuePurge(
    keys: string[],
    source: string = 'unknown',
    priority: number = 0
  ): void {
    const now = Date.now();
    const debounceMs = this.config.debounceMs ?? DEFAULT_CONFIG.debounceMs;
    
    for (const key of keys) {
      const family = this.getKeyFamily(key);
      
      // Check if we already have a pending purge for this family
      const existingTimer = this.debounceTimers.get(family);
      
      if (existingTimer) {
        // Debounce: reset timer and merge keys
        clearTimeout(existingTimer);
        this.stats.debouncedCount++;
        
        const existing = this.queue.get(family);
        if (existing && !existing.keys.includes(key)) {
          existing.keys.push(key);
          existing.priority = Math.max(existing.priority, priority);
        }
      } else {
        // New purge request
        this.queue.set(family, {
          keys: [key],
          queuedAt: now,
          source,
          priority,
        });
      }
      
      // Set/reset debounce timer
      const timer = setTimeout(() => {
        this.debounceTimers.delete(family);
        // Mark as ready for processing
        const request = this.queue.get(family);
        if (request) {
          request.queuedAt = Date.now() - debounceMs; // Mark as ready
        }
      }, debounceMs);
      
      this.debounceTimers.set(family, timer);
    }
    
    this.stats.queueDepth = this.queue.size;
  }
  
  /**
   * Queue a coarse purge (for bulk operations)
   * 
   * During bulk ingest/import, prefer coarse keys to reduce purge volume
   */
  public queueCoarsePurge(
    orgId: number,
    propertyId?: number,
    source: string = 'bulk'
  ): void {
    const keys: string[] = [];
    
    if (propertyId) {
      // Property-level purge
      keys.push(`property:${propertyId}`);
      keys.push(`finance:summary:property:${propertyId}`);
      keys.push(`finance:expenses:property:${propertyId}`);
      keys.push(`finance:revenues:property:${propertyId}`);
      keys.push(`reports:daily:property:${propertyId}`);
    } else {
      // Org-level purge (nuclear option)
      keys.push(`org:${orgId}`);
    }
    
    this.queuePurge(keys, source, 10); // Higher priority
  }
  
  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (this.queue.size === 0) return;
    
    this.isProcessing = true;
    
    try {
      const now = Date.now();
      const debounceMs = this.config.debounceMs ?? DEFAULT_CONFIG.debounceMs;
      const maxPerSecond = this.config.maxPurgesPerSecond ?? DEFAULT_CONFIG.maxPurgesPerSecond;
      const maxPerBatch = this.config.maxPurgesPerBatch ?? DEFAULT_CONFIG.maxPurgesPerBatch;
      
      // Reset rate limit counter every second
      if (now - this.lastPurgeTime >= 1000) {
        this.purgesThisSecond = 0;
        this.lastPurgeTime = now;
      }
      
      // Check rate limit
      if (this.purgesThisSecond >= maxPerSecond) {
        return;
      }
      
      // Find ready requests (debounce expired)
      const readyRequests: Array<[string, PurgeRequest]> = [];
      
      for (const [family, request] of this.queue.entries()) {
        // Only process if debounce timer has fired (queuedAt + debounceMs < now)
        if (now - request.queuedAt >= debounceMs) {
          readyRequests.push([family, request]);
        }
      }
      
      if (readyRequests.length === 0) return;
      
      // Sort by priority (descending)
      readyRequests.sort((a, b) => b[1].priority - a[1].priority);
      
      // Batch keys for this purge
      const keysToProcess: string[] = [];
      const familiesToRemove: string[] = [];
      
      for (const [family, request] of readyRequests) {
        if (keysToProcess.length + request.keys.length > maxPerBatch) {
          break;
        }
        
        keysToProcess.push(...request.keys);
        familiesToRemove.push(family);
        this.stats.batchedCount++;
      }
      
      if (keysToProcess.length === 0) return;
      
      // Remove from queue
      for (const family of familiesToRemove) {
        this.queue.delete(family);
      }
      
      // Execute purge
      const result = await this.executePurge(keysToProcess);
      
      // Update stats
      this.stats.totalPurges++;
      this.purgesThisSecond++;
      
      if (result.success) {
        this.stats.successfulPurges++;
      } else if (result.rateLimited) {
        this.stats.rateLimitedPurges++;
        // Re-queue on rate limit
        for (const family of familiesToRemove) {
          const request = readyRequests.find(r => r[0] === family)?.[1];
          if (request) {
            this.queue.set(family, {
              ...request,
              queuedAt: now + 5000, // Retry after 5s
            });
          }
        }
      } else {
        this.stats.failedPurges++;
      }
      
      // Update average latency
      this.stats.avgLatencyMs = (
        this.stats.avgLatencyMs * (this.stats.totalPurges - 1) + result.duration
      ) / this.stats.totalPurges;
      
      this.stats.queueDepth = this.queue.size;
      
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Execute a purge request against the CDN
   */
  private async executePurge(keys: string[]): Promise<PurgeResult> {
    const startTime = Date.now();
    
    try {
      switch (this.config.provider) {
        case 'cloudflare':
          return await this.purgeCloudflare(keys, startTime);
          
        case 'fastly':
          return await this.purgeFastly(keys, startTime);
          
        case 'cloudfront':
          return await this.purgeCloudfront(keys, startTime);
          
        case 'mock':
        default:
          // Mock purge for testing
          return {
            success: true,
            keysProcessed: keys.length,
            duration: Date.now() - startTime,
            provider: 'mock',
          };
      }
    } catch (error) {
      return {
        success: false,
        keysProcessed: 0,
        duration: Date.now() - startTime,
        provider: this.config.provider,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Purge via Cloudflare API
   */
  private async purgeCloudflare(keys: string[], startTime: number): Promise<PurgeResult> {
    const { cloudflareZoneId, cloudflareApiToken } = this.config;
    
    if (!cloudflareZoneId || !cloudflareApiToken) {
      return {
        success: false,
        keysProcessed: 0,
        duration: Date.now() - startTime,
        provider: 'cloudflare',
        error: 'Cloudflare configuration missing',
      };
    }
    
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${cloudflareZoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cloudflareApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tags: keys }),
      }
    );
    
    const duration = Date.now() - startTime;
    
    if (response.status === 429) {
      return {
        success: false,
        keysProcessed: 0,
        duration,
        provider: 'cloudflare',
        rateLimited: true,
        error: 'Rate limited by Cloudflare',
      };
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        keysProcessed: 0,
        duration,
        provider: 'cloudflare',
        error: `Cloudflare API error: ${response.status} ${errorText}`,
      };
    }
    
    return {
      success: true,
      keysProcessed: keys.length,
      duration,
      provider: 'cloudflare',
    };
  }
  
  /**
   * Purge via Fastly API
   */
  private async purgeFastly(keys: string[], startTime: number): Promise<PurgeResult> {
    const { fastlyServiceId, fastlyApiToken } = this.config;
    
    if (!fastlyServiceId || !fastlyApiToken) {
      return {
        success: false,
        keysProcessed: 0,
        duration: Date.now() - startTime,
        provider: 'fastly',
        error: 'Fastly configuration missing',
      };
    }
    
    // Fastly supports purging by surrogate key
    const response = await fetch(
      `https://api.fastly.com/service/${fastlyServiceId}/purge`,
      {
        method: 'POST',
        headers: {
          'Fastly-Key': fastlyApiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ surrogate_keys: keys }),
      }
    );
    
    const duration = Date.now() - startTime;
    
    if (response.status === 429) {
      return {
        success: false,
        keysProcessed: 0,
        duration,
        provider: 'fastly',
        rateLimited: true,
        error: 'Rate limited by Fastly',
      };
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        keysProcessed: 0,
        duration,
        provider: 'fastly',
        error: `Fastly API error: ${response.status} ${errorText}`,
      };
    }
    
    return {
      success: true,
      keysProcessed: keys.length,
      duration,
      provider: 'fastly',
    };
  }
  
  /**
   * Purge via CloudFront API
   * 
   * Note: CloudFront uses path-based invalidation, not tags
   */
  private async purgeCloudfront(keys: string[], startTime: number): Promise<PurgeResult> {
    // CloudFront would require AWS SDK and path-based invalidation
    // This is a placeholder for the implementation
    return {
      success: false,
      keysProcessed: 0,
      duration: Date.now() - startTime,
      provider: 'cloudfront',
      error: 'CloudFront purge not implemented - requires AWS SDK',
    };
  }
  
  /**
   * Get current statistics
   */
  public getStats(): PurgeStats {
    return { ...this.stats };
  }
  
  /**
   * Get queue depth
   */
  public getQueueDepth(): number {
    return this.queue.size;
  }
  
  /**
   * Force process all pending purges (for testing/shutdown)
   */
  public async flushQueue(): Promise<PurgeResult[]> {
    const results: PurgeResult[] = [];
    
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    
    // Process all pending requests
    while (this.queue.size > 0) {
      const allKeys: string[] = [];
      
      for (const request of this.queue.values()) {
        allKeys.push(...request.keys);
      }
      
      this.queue.clear();
      
      if (allKeys.length > 0) {
        const result = await this.executePurge(allKeys);
        results.push(result);
      }
    }
    
    return results;
  }
  
  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      totalPurges: 0,
      successfulPurges: 0,
      failedPurges: 0,
      rateLimitedPurges: 0,
      avgLatencyMs: 0,
      queueDepth: 0,
      debouncedCount: 0,
      batchedCount: 0,
    };
  }
}

// Global instance
let purgeManager: PurgeManager | null = null;

/**
 * Initialize the purge manager
 */
export function initPurgeManager(config: CDNConfig): void {
  if (purgeManager) {
    purgeManager.stop();
  }
  purgeManager = new PurgeManager(config);
}

/**
 * Get the purge manager instance
 */
export function getPurgeManager(): PurgeManager {
  if (!purgeManager) {
    // Initialize with mock provider if not configured
    purgeManager = new PurgeManager({ provider: 'mock' });
  }
  return purgeManager;
}

/**
 * Queue a purge request (convenience function)
 */
export function queuePurge(
  keys: string[],
  source?: string,
  priority?: number
): void {
  getPurgeManager().queuePurge(keys, source, priority);
}

/**
 * Queue a coarse purge (convenience function)
 */
export function queueCoarsePurge(
  orgId: number,
  propertyId?: number,
  source?: string
): void {
  getPurgeManager().queueCoarsePurge(orgId, propertyId, source);
}

/**
 * Get purge statistics
 */
export function getPurgeStats(): PurgeStats {
  return getPurgeManager().getStats();
}

/**
 * Event-driven purge triggers
 * 
 * Usage:
 * ```typescript
 * import { triggerPurgeOnMutation } from './purge_manager';
 * 
 * // After expense creation
 * triggerPurgeOnMutation('finance', orgId, propertyId);
 * ```
 */
export function triggerPurgeOnMutation(
  entityType: 'finance' | 'reports' | 'properties' | 'users' | 'staff' | 'tasks' | 'guest',
  orgId: number,
  propertyId?: number,
  entityId?: string | number
): void {
  const keys: string[] = [];
  
  // Always add org and property keys
  keys.push(`org:${orgId}`);
  if (propertyId) {
    keys.push(`property:${propertyId}`);
  }
  
  // Entity-specific keys
  switch (entityType) {
    case 'finance':
      if (propertyId) {
        keys.push(`finance:summary:property:${propertyId}`);
        keys.push(`finance:expenses:property:${propertyId}`);
        keys.push(`finance:revenues:property:${propertyId}`);
      }
      break;
      
    case 'reports':
      if (propertyId) {
        keys.push(`reports:daily:property:${propertyId}`);
        keys.push(`reports:monthly:property:${propertyId}`);
      }
      break;
      
    case 'properties':
      keys.push(`properties:list:org:${orgId}`);
      if (entityId) {
        keys.push(`properties:detail:${entityId}`);
      }
      break;
      
    case 'users':
      keys.push(`users:list:org:${orgId}`);
      break;
      
    case 'staff':
      if (propertyId) {
        keys.push(`staff:list:property:${propertyId}`);
      }
      break;
      
    case 'tasks':
      if (propertyId) {
        keys.push(`tasks:list:property:${propertyId}`);
      }
      break;
      
    case 'guest':
      if (propertyId) {
        keys.push(`guest:list:property:${propertyId}`);
      }
      break;
  }
  
  queuePurge(keys, `mutation:${entityType}`);
}

// Export types and class
export { PurgeManager };
export type { CDNConfig, PurgeRequest };

