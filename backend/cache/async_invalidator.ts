// Async Cache Invalidation for Phase 2 Architecture Scaling
// Target: Optimize cache invalidation with async queues (100K-500K organizations)

import { distributedCache } from "./distributed_cache_manager";

interface InvalidationItem {
  orgId: number;
  propertyId?: number;
  dates: string[];
  timestamp: Date;
  priority: 'high' | 'medium' | 'low';
  retryCount: number;
  maxRetries: number;
}

interface InvalidationBatch {
  items: InvalidationItem[];
  batchId: string;
  createdAt: Date;
  processing: boolean;
}

export class AsyncCacheInvalidator {
  private invalidationQueue: InvalidationItem[] = [];
  private highPriorityQueue: InvalidationItem[] = [];
  private processingQueue: InvalidationItem[] = [];
  private batchSize = 100;
  private intervalMs = 100; // Reduced from 2 seconds to 100ms
  private highPriorityIntervalMs = 50; // High priority queue processes every 50ms
  private maxRetries = 3;
  private processing = false;
  private stats = {
    totalInvalidations: 0,
    successfulInvalidations: 0,
    failedInvalidations: 0,
    batchedInvalidations: 0,
    averageBatchSize: 0,
    averageProcessingTime: 0
  };

  constructor() {
    this.startProcessing();
  }

  // Add invalidation to async queue
  async addInvalidation(
    orgId: number, 
    propertyId: number | undefined, 
    dates: string[], 
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<void> {
    const item: InvalidationItem = {
      orgId,
      propertyId,
      dates,
      timestamp: new Date(),
      priority,
      retryCount: 0,
      maxRetries: this.maxRetries
    };

    // Add to appropriate queue based on priority
    if (priority === 'high') {
      this.highPriorityQueue.unshift(item); // High priority goes to front of high priority queue
    } else if (priority === 'medium') {
      this.invalidationQueue.unshift(item); // Medium priority goes to front of regular queue
    } else {
      this.invalidationQueue.push(item); // Low priority goes to back
    }

    this.stats.totalInvalidations++;
    console.log(`[AsyncCacheInvalidator] Added invalidation to queue: orgId=${orgId}, dates=${dates.join(',')}, priority=${priority}`);
  }

  // Start background processing
  private startProcessing(): void {
    // High priority queue processing (every 50ms)
    setInterval(async () => {
      if (this.highPriorityQueue.length > 0 && !this.processing) {
        await this.processHighPriorityBatch();
      }
    }, this.highPriorityIntervalMs);

    // Regular queue processing (every 100ms)
    setInterval(async () => {
      if (this.invalidationQueue.length > 0 && !this.processing) {
        await this.processBatch();
      }
    }, this.intervalMs);
  }

  // Process high priority batch of invalidations
  private async processHighPriorityBatch(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    const startTime = Date.now();
    const batch: InvalidationItem[] = [];

    try {
      // Get all high priority items (process immediately)
      const itemsToProcess = this.highPriorityQueue.length;
      
      for (let i = 0; i < itemsToProcess; i++) {
        const item = this.highPriorityQueue.shift();
        if (item) {
          batch.push(item);
        }
      }

      if (batch.length === 0) {
        this.processing = false;
        return;
      }

      console.log(`[AsyncCacheInvalidator] Processing HIGH PRIORITY batch of ${batch.length} invalidations`);

      // Process batch immediately
      await this.executeBatchInvalidation(batch);

      const processingTime = Date.now() - startTime;
      this.stats.batchedInvalidations++;
      this.stats.averageBatchSize = (this.stats.averageBatchSize + batch.length) / 2;
      this.stats.averageProcessingTime = (this.stats.averageProcessingTime + processingTime) / 2;

      console.log(`[AsyncCacheInvalidator] Successfully processed HIGH PRIORITY batch in ${processingTime}ms`);
    } catch (error) {
      console.error('[AsyncCacheInvalidator] High priority batch processing failed:', error);
      // Re-queue failed items
      this.requeueFailedItems(batch);
    } finally {
      this.processing = false;
    }
  }

  // Process batch of invalidations
  private async processBatch(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    const startTime = Date.now();
    const batch: InvalidationItem[] = [];

    try {
      // Get items for batch processing
      const itemsToProcess = Math.min(this.batchSize, this.invalidationQueue.length);
      
      for (let i = 0; i < itemsToProcess; i++) {
        const item = this.invalidationQueue.shift();
        if (item) {
          batch.push(item);
        }
      }

      if (batch.length === 0) {
        this.processing = false;
        return;
      }

      console.log(`[AsyncCacheInvalidator] Processing batch of ${batch.length} invalidations`);

      // Process batch
      await this.executeBatchInvalidation(batch);

      const processingTime = Date.now() - startTime;
      this.stats.batchedInvalidations++;
      this.stats.averageBatchSize = (this.stats.averageBatchSize + batch.length) / 2;
      this.stats.averageProcessingTime = (this.stats.averageProcessingTime + processingTime) / 2;

      console.log(`[AsyncCacheInvalidator] Successfully processed batch in ${processingTime}ms`);
    } catch (error) {
      console.error('[AsyncCacheInvalidator] Batch processing failed:', error);
      // Re-queue failed items
      this.requeueFailedItems(batch);
    } finally {
      this.processing = false;
    }
  }

  // Execute batch invalidation
  private async executeBatchInvalidation(batch: InvalidationItem[]): Promise<void> {
    const invalidationPromises = batch.map(item => this.executeInvalidation(item));
    
    const results = await Promise.allSettled(invalidationPromises);
    
    // Process results
    results.forEach((result, index) => {
      const item = batch[index];
      if (result.status === 'fulfilled') {
        this.stats.successfulInvalidations++;
        console.log(`[AsyncCacheInvalidator] Successfully invalidated cache for orgId=${item.orgId}`);
      } else {
        this.stats.failedInvalidations++;
        console.error(`[AsyncCacheInvalidator] Failed to invalidate cache for orgId=${item.orgId}:`, result.reason);
        
        // Re-queue for retry if not exceeded max retries
        if (item.retryCount < item.maxRetries) {
          item.retryCount++;
          this.invalidationQueue.push(item);
          console.log(`[AsyncCacheInvalidator] Re-queued item for retry ${item.retryCount}/${item.maxRetries}`);
        }
      }
    });
  }

  // Execute individual invalidation
  private async executeInvalidation(item: InvalidationItem): Promise<void> {
    try {
      // Invalidate both report and balance keys via the distributed cache manager
      await distributedCache.invalidateDateRange(
        item.orgId,
        item.propertyId,
        item.dates
      );
      
      console.log(`[AsyncCacheInvalidator] Cache invalidated for orgId=${item.orgId}, propertyId=${item.propertyId}, dates=${item.dates.join(',')}`);
    } catch (error) {
      console.error(`[AsyncCacheInvalidator] Cache invalidation failed for orgId=${item.orgId}:`, error);
      throw error;
    }
  }

  // Re-queue failed items
  private requeueFailedItems(batch: InvalidationItem[]): void {
    batch.forEach(item => {
      if (item.retryCount < item.maxRetries) {
        item.retryCount++;
        this.invalidationQueue.push(item);
        console.log(`[AsyncCacheInvalidator] Re-queued failed item for retry ${item.retryCount}/${item.maxRetries}`);
      } else {
        console.error(`[AsyncCacheInvalidator] Item exceeded max retries, dropping: orgId=${item.orgId}`);
      }
    });
  }

  // Process high priority invalidations immediately
  async processHighPriorityInvalidations(): Promise<void> {
    const highPriorityItems = this.invalidationQueue.filter(item => item.priority === 'high');
    
    if (highPriorityItems.length > 0) {
      console.log(`[AsyncCacheInvalidator] Processing ${highPriorityItems.length} high priority invalidations immediately`);
      
      // Remove high priority items from queue
      this.invalidationQueue = this.invalidationQueue.filter(item => item.priority !== 'high');
      
      // Process immediately
      await this.executeBatchInvalidation(highPriorityItems);
    }
  }

  // Get queue statistics
  getQueueStats(): any {
    return {
      queueSize: this.invalidationQueue.length,
      highPriorityQueueSize: this.highPriorityQueue.length,
      processingQueueSize: this.processingQueue.length,
      processing: this.processing,
      batchSize: this.batchSize,
      intervalMs: this.intervalMs,
      highPriorityIntervalMs: this.highPriorityIntervalMs,
      maxRetries: this.maxRetries,
      stats: { ...this.stats }
    };
  }

  // Get detailed statistics
  getDetailedStats(): any {
    const queueByPriority = {
      high: this.highPriorityQueue.length + this.invalidationQueue.filter(item => item.priority === 'high').length,
      medium: this.invalidationQueue.filter(item => item.priority === 'medium').length,
      low: this.invalidationQueue.filter(item => item.priority === 'low').length
    };

    const queueByRetryCount = {
      firstAttempt: this.invalidationQueue.filter(item => item.retryCount === 0).length,
      retry1: this.invalidationQueue.filter(item => item.retryCount === 1).length,
      retry2: this.invalidationQueue.filter(item => item.retryCount === 2).length,
      retry3: this.invalidationQueue.filter(item => item.retryCount >= 3).length
    };

    return {
      queue: {
        total: this.invalidationQueue.length + this.highPriorityQueue.length,
        regularQueue: this.invalidationQueue.length,
        highPriorityQueue: this.highPriorityQueue.length,
        byPriority: queueByPriority,
        byRetryCount: queueByRetryCount
      },
      processing: {
        active: this.processing,
        queueSize: this.processingQueue.length
      },
      performance: {
        batchSize: this.batchSize,
        intervalMs: this.intervalMs,
        maxRetries: this.maxRetries
      },
      statistics: { ...this.stats }
    };
  }

  // Clear queue (for testing or emergency)
  clearQueue(): void {
    console.log(`[AsyncCacheInvalidator] Clearing invalidation queues (${this.invalidationQueue.length} regular, ${this.highPriorityQueue.length} high priority items)`);
    this.invalidationQueue = [];
    this.highPriorityQueue = [];
    this.processingQueue = [];
  }

  // Update configuration
  updateConfig(config: {
    batchSize?: number;
    intervalMs?: number;
    maxRetries?: number;
  }): void {
    if (config.batchSize !== undefined) {
      this.batchSize = config.batchSize;
      console.log(`[AsyncCacheInvalidator] Updated batch size to ${config.batchSize}`);
    }
    
    if (config.intervalMs !== undefined) {
      this.intervalMs = config.intervalMs;
      console.log(`[AsyncCacheInvalidator] Updated interval to ${config.intervalMs}ms`);
    }
    
    if (config.maxRetries !== undefined) {
      this.maxRetries = config.maxRetries;
      console.log(`[AsyncCacheInvalidator] Updated max retries to ${config.maxRetries}`);
    }
  }

  // Health check
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    // Check if queue is too large
    const totalQueueSize = this.invalidationQueue.length + this.highPriorityQueue.length;
    if (totalQueueSize > 1000) {
      issues.push(`Queue size too large: ${totalQueueSize} (regular: ${this.invalidationQueue.length}, high priority: ${this.highPriorityQueue.length})`);
    }
    
    // Check if processing is stuck
    if (this.processing && this.processingQueue.length > 0) {
      const oldestItem = this.processingQueue[0];
      if (oldestItem && Date.now() - oldestItem.timestamp.getTime() > 30000) { // 30 seconds
        issues.push('Processing appears to be stuck');
      }
    }
    
    // Check failure rate
    const totalProcessed = this.stats.successfulInvalidations + this.stats.failedInvalidations;
    if (totalProcessed > 0) {
      const failureRate = this.stats.failedInvalidations / totalProcessed;
      if (failureRate > 0.1) { // 10% failure rate
        issues.push(`High failure rate: ${(failureRate * 100).toFixed(2)}%`);
      }
    }
    
    return {
      healthy: issues.length === 0,
      issues
    };
  }
}

// Global async cache invalidator instance
export const asyncCacheInvalidator = new AsyncCacheInvalidator();
