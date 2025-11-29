// Retry Handler - Phase 3 Advanced Scaling
// Target: Retry with exponential backoff for production reliability (1M+ organizations)

// Retry Handler Interfaces
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  multiplier: number;
  jitter: boolean;
  timeout: number; // milliseconds
}

export interface RetryStats {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  averageRetryTime: number;
  retryRate: number;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
  retries: number;
}

// Retry Handler Class
export class RetryHandler {
  private name: string;
  private config: RetryConfig;
  private stats = {
    totalRetries: 0,
    successfulRetries: 0,
    failedRetries: 0,
    averageRetryTime: 0,
    retryRate: 0
  };
  private retryTimes: number[] = [];

  constructor(name: string, config: RetryConfig) {
    this.name = name;
    this.config = config;
    console.log(`[RetryHandler:${name}] Initialized with config:`, config);
  }

  // Execute with Retry
  async execute<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let attempts = 0;
    let retries = 0;
    let lastError: Error;

    while (attempts < this.config.maxAttempts) {
      attempts++;
      
      try {
        const result = await this.executeWithTimeout(fn, this.config.timeout);
        
        // Success
        this.recordSuccess(Date.now() - startTime);
        
        return {
          success: true,
          result,
          attempts,
          totalTime: Date.now() - startTime,
          retries
        };
      } catch (error) {
        lastError = error as Error;
        
        // Check if we should retry
        if (attempts >= this.config.maxAttempts) {
          break;
        }

        // Calculate delay
        const delay = this.calculateDelay(attempts);
        console.log(`[RetryHandler:${this.name}] Attempt ${attempts} failed, retrying in ${delay}ms:`, error.message);
        
        // Wait before retry
        await this.sleep(delay);
        retries++;
      }
    }

    // All attempts failed
    this.recordFailure(Date.now() - startTime);
    
    return {
      success: false,
      error: lastError!,
      attempts,
      totalTime: Date.now() - startTime,
      retries
    };
  }

  // Execute with Timeout
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Retry handler ${this.name} timeout after ${timeout}ms`));
      }, timeout);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  // Calculate Delay
  private calculateDelay(attempt: number): number {
    let delay = this.config.initialDelay * Math.pow(this.config.multiplier, attempt - 1);
    
    // Cap at max delay
    delay = Math.min(delay, this.config.maxDelay);
    
    // Add jitter if enabled
    if (this.config.jitter) {
      const jitterRange = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterRange;
    }
    
    return Math.max(0, delay);
  }

  // Sleep
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Record Success
  private recordSuccess(totalTime: number): void {
    this.stats.successfulRetries++;
    this.retryTimes.push(totalTime);
    this.updateAverageRetryTime();
    this.updateRetryRate();
  }

  // Record Failure
  private recordFailure(totalTime: number): void {
    this.stats.failedRetries++;
    this.retryTimes.push(totalTime);
    this.updateAverageRetryTime();
    this.updateRetryRate();
  }

  // Update Average Retry Time
  private updateAverageRetryTime(): void {
    if (this.retryTimes.length > 0) {
      this.stats.averageRetryTime = this.retryTimes.reduce((a, b) => a + b, 0) / this.retryTimes.length;
    }
  }

  // Update Retry Rate
  private updateRetryRate(): void {
    const totalAttempts = this.stats.successfulRetries + this.stats.failedRetries;
    this.stats.retryRate = totalAttempts > 0 ? this.stats.totalRetries / totalAttempts : 0;
  }

  // Get Statistics
  getStats(): RetryStats {
    return {
      totalRetries: this.stats.totalRetries,
      successfulRetries: this.stats.successfulRetries,
      failedRetries: this.stats.failedRetries,
      averageRetryTime: this.stats.averageRetryTime,
      retryRate: this.stats.retryRate
    };
  }

  // Reset Statistics
  resetStats(): void {
    this.stats = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      averageRetryTime: 0,
      retryRate: 0
    };
    this.retryTimes = [];
    console.log(`[RetryHandler:${this.name}] Statistics reset`);
  }

  // Update Configuration
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
    console.log(`[RetryHandler:${this.name}] Configuration updated:`, this.config);
  }
}

// Retry Handler Manager
export class RetryHandlerManager {
  private retryHandlers: Map<string, RetryHandler> = new Map();
  private defaultConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    multiplier: 2,
    jitter: true,
    timeout: 10000 // 10 seconds
  };

  // Create Retry Handler
  createRetryHandler(name: string, config?: Partial<RetryConfig>): RetryHandler {
    const finalConfig = { ...this.defaultConfig, ...config };
    const retryHandler = new RetryHandler(name, finalConfig);
    this.retryHandlers.set(name, retryHandler);
    return retryHandler;
  }

  // Get Retry Handler
  getRetryHandler(name: string): RetryHandler | undefined {
    return this.retryHandlers.get(name);
  }

  // Get All Retry Handlers
  getAllRetryHandlers(): Map<string, RetryHandler> {
    return new Map(this.retryHandlers);
  }

  // Get All Statistics
  getAllStats(): { [name: string]: RetryStats } {
    const stats: { [name: string]: RetryStats } = {};
    for (const [name, handler] of this.retryHandlers) {
      stats[name] = handler.getStats();
    }
    return stats;
  }

  // Reset All Statistics
  resetAllStats(): void {
    for (const handler of this.retryHandlers.values()) {
      handler.resetStats();
    }
    console.log('[RetryHandlerManager] All statistics reset');
  }

  // Get Health Status
  getHealthStatus(): {
    healthy: number;
    unhealthy: number;
    total: number;
    details: { [name: string]: { retryRate: number; averageTime: number } };
  } {
    let healthy = 0;
    let unhealthy = 0;
    const details: { [name: string]: { retryRate: number; averageTime: number } } = {};

    for (const [name, handler] of this.retryHandlers) {
      const stats = handler.getStats();
      details[name] = {
        retryRate: stats.retryRate,
        averageTime: stats.averageRetryTime
      };
      
      // Consider unhealthy if retry rate > 50% or average time > 30 seconds
      if (stats.retryRate > 0.5 || stats.averageRetryTime > 30000) {
        unhealthy++;
      } else {
        healthy++;
      }
    }

    return {
      healthy,
      unhealthy,
      total: this.retryHandlers.size,
      details
    };
  }
}

// Global retry handler manager
export const retryHandlerManager = new RetryHandlerManager();

// Pre-configured retry handlers for common services
export const financeRetryHandler = retryHandlerManager.createRetryHandler('finance', {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  timeout: 5000
});

export const reportsRetryHandler = retryHandlerManager.createRetryHandler('reports', {
  maxAttempts: 5,
  initialDelay: 2000,
  maxDelay: 30000,
  timeout: 15000
});

export const cacheRetryHandler = retryHandlerManager.createRetryHandler('cache', {
  maxAttempts: 3,
  initialDelay: 500,
  maxDelay: 5000,
  timeout: 2000
});

export const eventsRetryHandler = retryHandlerManager.createRetryHandler('events', {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  timeout: 5000
});

// Utility function for easy retry execution
export async function withRetry<T>(
  fn: () => Promise<T>,
  handlerName: string = 'default',
  config?: Partial<RetryConfig>
): Promise<T> {
  let handler = retryHandlerManager.getRetryHandler(handlerName);
  
  if (!handler) {
    handler = retryHandlerManager.createRetryHandler(handlerName, config);
  }
  
  const result = await handler.execute(fn);
  
  if (!result.success) {
    throw result.error;
  }
  
  return result.result!;
}
