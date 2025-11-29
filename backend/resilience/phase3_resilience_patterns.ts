// 🚀 PHASE 3: RESILIENCE PATTERNS (Month 2)
// Target: Handle 1M+ organizations
// Implementation: Month 2

// ✅ FIX 1: Circuit Breaker Implementation
export class CircuitBreaker {
  private name: string;
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private threshold = 5;
  private timeout = 60000; // 1 minute
  private halfOpenMaxCalls = 3;
  private halfOpenCalls = 0;

  constructor(name: string, threshold: number = 5, timeout: number = 60000) {
    this.name = name;
    this.threshold = threshold;
    this.timeout = timeout;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
        this.halfOpenCalls = 0;
        console.log(`[CircuitBreaker] ${this.name} transitioning to half-open`);
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenCalls >= this.halfOpenMaxCalls) {
        throw new Error(`Circuit breaker ${this.name} is HALF_OPEN with max calls reached`);
      }
      this.halfOpenCalls++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    this.halfOpenCalls = 0;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      console.warn(`[CircuitBreaker] ${this.name} opened due to ${this.failures} failures`);
    }
  }

  getState(): any {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      threshold: this.threshold,
      timeout: this.timeout,
      halfOpenCalls: this.halfOpenCalls
    };
  }

  reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    this.halfOpenCalls = 0;
    this.lastFailureTime = 0;
  }
}

// ✅ FIX 2: Retry with Exponential Backoff
export class RetryWithBackoff {
  private maxAttempts: number;
  private initialDelay: number;
  private maxDelay: number;
  private multiplier: number;
  private jitter: boolean;

  constructor(
    maxAttempts: number = 5,
    initialDelay: number = 1000,
    maxDelay: number = 30000,
    multiplier: number = 2,
    jitter: boolean = true
  ) {
    this.maxAttempts = maxAttempts;
    this.initialDelay = initialDelay;
    this.maxDelay = maxDelay;
    this.multiplier = multiplier;
    this.jitter = jitter;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.maxAttempts) {
          throw lastError;
        }
        
        const delay = this.calculateDelay(attempt);
        console.log(`[RetryWithBackoff] Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
        
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  private calculateDelay(attempt: number): number {
    let delay = this.initialDelay * Math.pow(this.multiplier, attempt - 1);
    delay = Math.min(delay, this.maxDelay);
    
    if (this.jitter) {
      // Add jitter to prevent thundering herd
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ✅ FIX 3: Rate Limiting
export class RateLimiter {
  private requests = new Map<string, RequestInfo>();
  private limit: number;
  private windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  async checkLimit(key: string): Promise<boolean> {
    const now = Date.now();
    const requestInfo = this.requests.get(key) || {
      requests: [],
      lastReset: now
    };
    
    // Remove old requests outside the window
    requestInfo.requests = requestInfo.requests.filter(
      timestamp => now - timestamp < this.windowMs
    );
    
    // Check if limit is exceeded
    if (requestInfo.requests.length >= this.limit) {
      return false;
    }
    
    // Add current request
    requestInfo.requests.push(now);
    requestInfo.lastReset = now;
    this.requests.set(key, requestInfo);
    
    return true;
  }

  async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (!(await this.checkLimit(key))) {
      throw new Error(`Rate limit exceeded for key: ${key}`);
    }
    
    return await fn();
  }

  getStats(key: string): any {
    const requestInfo = this.requests.get(key);
    if (!requestInfo) {
      return { requests: 0, limit: this.limit, windowMs: this.windowMs };
    }
    
    return {
      requests: requestInfo.requests.length,
      limit: this.limit,
      windowMs: this.windowMs,
      lastReset: requestInfo.lastReset
    };
  }
}

interface RequestInfo {
  requests: number[];
  lastReset: number;
}

// ✅ FIX 4: Bulkhead Pattern
export class Bulkhead {
  private name: string;
  private maxConcurrency: number;
  private semaphore: number;
  private queue: QueueItem[] = [];
  private processing = false;

  constructor(name: string, maxConcurrency: number) {
    this.name = name;
    this.maxConcurrency = maxConcurrency;
    this.semaphore = maxConcurrency;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const item: QueueItem = {
        fn,
        resolve,
        reject,
        timestamp: Date.now()
      };
      
      this.queue.push(item);
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.semaphore <= 0 || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    while (this.semaphore > 0 && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;
      
      this.semaphore--;
      
      // Execute function asynchronously
      this.executeItem(item);
    }
    
    this.processing = false;
  }

  private async executeItem<T>(item: QueueItem<T>): Promise<void> {
    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      this.semaphore++;
      this.processQueue();
    }
  }

  getStats(): any {
    return {
      name: this.name,
      maxConcurrency: this.maxConcurrency,
      availableSlots: this.semaphore,
      queueSize: this.queue.length,
      processing: this.processing
    };
  }
}

interface QueueItem<T = any> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  timestamp: number;
}

// ✅ FIX 5: Timeout Pattern
export class Timeout {
  private timeoutMs: number;

  constructor(timeoutMs: number) {
    this.timeoutMs = timeoutMs;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
      
      fn()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }
}

// ✅ FIX 6: Resilience Monitor
export class ResilienceMonitor {
  private metrics = {
    circuitBreakerTrips: 0,
    retryAttempts: 0,
    rateLimitHits: 0,
    bulkheadRejections: 0,
    timeouts: 0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0
  };

  recordCircuitBreakerTrip() {
    this.metrics.circuitBreakerTrips++;
  }

  recordRetryAttempt() {
    this.metrics.retryAttempts++;
  }

  recordRateLimitHit() {
    this.metrics.rateLimitHits++;
  }

  recordBulkheadRejection() {
    this.metrics.bulkheadRejections++;
  }

  recordTimeout() {
    this.metrics.timeouts++;
  }

  recordRequest(success: boolean) {
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.successfulRequests / this.metrics.totalRequests,
      failureRate: this.metrics.failedRequests / this.metrics.totalRequests,
      circuitBreakerTripRate: this.metrics.circuitBreakerTrips / this.metrics.totalRequests,
      retryRate: this.metrics.retryAttempts / this.metrics.totalRequests,
      rateLimitHitRate: this.metrics.rateLimitHits / this.metrics.totalRequests,
      bulkheadRejectionRate: this.metrics.bulkheadRejections / this.metrics.totalRequests,
      timeoutRate: this.metrics.timeouts / this.metrics.totalRequests
    };
  }

  checkAlerts() {
    const successRate = this.metrics.successfulRequests / this.metrics.totalRequests;
    const circuitBreakerTripRate = this.metrics.circuitBreakerTrips / this.metrics.totalRequests;
    const retryRate = this.metrics.retryAttempts / this.metrics.totalRequests;
    
    if (successRate < 0.95) { // 95% success rate
      console.warn(`[ResilienceMonitor] Low success rate: ${(successRate * 100).toFixed(2)}%`);
    }
    
    if (circuitBreakerTripRate > 0.05) { // 5% circuit breaker trip rate
      console.warn(`[ResilienceMonitor] High circuit breaker trip rate: ${(circuitBreakerTripRate * 100).toFixed(2)}%`);
    }
    
    if (retryRate > 0.2) { // 20% retry rate
      console.warn(`[ResilienceMonitor] High retry rate: ${(retryRate * 100).toFixed(2)}%`);
    }
  }
}

export const resilienceMonitor = new ResilienceMonitor();

// ✅ FIX 7: Resilience Configuration
export class ResilienceConfiguration {
  private config = {
    circuitBreaker: {
      threshold: 5,
      timeout: 60000,
      halfOpenMaxCalls: 3
    },
    retry: {
      maxAttempts: 5,
      initialDelay: 1000,
      maxDelay: 30000,
      multiplier: 2,
      jitter: true
    },
    rateLimit: {
      limit: 100,
      windowMs: 60000
    },
    bulkhead: {
      maxConcurrency: 10
    },
    timeout: {
      timeoutMs: 30000
    }
  };

  getConfig() {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<typeof this.config>) {
    this.config = { ...this.config, ...newConfig };
  }

  getCircuitBreakerConfig() {
    return { ...this.config.circuitBreaker };
  }

  getRetryConfig() {
    return { ...this.config.retry };
  }

  getRateLimitConfig() {
    return { ...this.config.rateLimit };
  }

  getBulkheadConfig() {
    return { ...this.config.bulkhead };
  }

  getTimeoutConfig() {
    return { ...this.config.timeout };
  }
}

export const resilienceConfiguration = new ResilienceConfiguration();
