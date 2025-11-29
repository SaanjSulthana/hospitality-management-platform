// Circuit Breaker - Phase 3 Advanced Scaling
// Target: Circuit breaker implementation for production reliability (1M+ organizations)

// Circuit Breaker Interfaces
export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number; // milliseconds
  halfOpenMaxCalls: number;
  timeout: number; // milliseconds
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastFailureTime: number;
  successCount: number;
  totalCalls: number;
  failureRate: number;
}

export interface CircuitBreakerStats {
  name: string;
  state: string;
  totalCalls: number;
  successCalls: number;
  failureCalls: number;
  failureRate: number;
  averageResponseTime: number;
  lastFailureTime: Date;
  uptime: number;
}

// Circuit Breaker Class
export class CircuitBreaker {
  private name: string;
  private config: CircuitBreakerConfig;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  private totalCalls = 0;
  private responseTimes: number[] = [];
  private startTime = Date.now();

  constructor(name: string, config: CircuitBreakerConfig) {
    this.name = name;
    this.config = config;
    console.log(`[CircuitBreaker:${name}] Initialized with config:`, config);
  }

  // Execute with Circuit Breaker
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        console.log(`[CircuitBreaker:${this.name}] State changed to HALF_OPEN`);
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    // Check half-open state
    if (this.state === 'HALF_OPEN' && this.successCount >= this.config.halfOpenMaxCalls) {
      this.state = 'CLOSED';
      this.failures = 0;
      console.log(`[CircuitBreaker:${this.name}] State changed to CLOSED`);
    }

    const startTime = Date.now();
    
    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn, this.config.timeout);
      
      this.onSuccess();
      this.recordResponseTime(Date.now() - startTime);
      
      return result;
    } catch (error) {
      this.onFailure();
      this.recordResponseTime(Date.now() - startTime);
      
      console.error(`[CircuitBreaker:${this.name}] Execution failed:`, error);
      throw error;
    }
  }

  // Execute with Timeout
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Circuit breaker ${this.name} timeout after ${timeout}ms`));
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

  // Handle Success
  private onSuccess(): void {
    this.successCount++;
    
    if (this.state === 'HALF_OPEN') {
      if (this.successCount >= this.config.halfOpenMaxCalls) {
        this.state = 'CLOSED';
        this.failures = 0;
        console.log(`[CircuitBreaker:${this.name}] State changed to CLOSED after ${this.successCount} successes`);
      }
    }
  }

  // Handle Failure
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      console.log(`[CircuitBreaker:${this.name}] State changed to OPEN after failure in HALF_OPEN`);
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
      console.log(`[CircuitBreaker:${this.name}] State changed to OPEN after ${this.failures} failures`);
    }
  }

  // Record Response Time
  private recordResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);
    
    // Keep only last 100 response times
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
  }

  // Get Current State
  getState(): CircuitBreakerState {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount,
      totalCalls: this.totalCalls,
      failureRate: this.totalCalls > 0 ? (this.totalCalls - this.successCount) / this.totalCalls : 0
    };
  }

  // Get Statistics
  getStats(): CircuitBreakerStats {
    const successCalls = this.successCount;
    const failureCalls = this.totalCalls - this.successCount;
    const failureRate = this.totalCalls > 0 ? failureCalls / this.totalCalls : 0;
    const averageResponseTime = this.responseTimes.length > 0 
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length 
      : 0;
    const uptime = Date.now() - this.startTime;

    return {
      name: this.name,
      state: this.state,
      totalCalls: this.totalCalls,
      successCalls,
      failureCalls,
      failureRate,
      averageResponseTime,
      lastFailureTime: new Date(this.lastFailureTime),
      uptime
    };
  }

  // Reset Circuit Breaker
  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailureTime = 0;
    this.successCount = 0;
    this.totalCalls = 0;
    this.responseTimes = [];
    this.startTime = Date.now();
    console.log(`[CircuitBreaker:${this.name}] Reset`);
  }

  // Force Open
  forceOpen(): void {
    this.state = 'OPEN';
    this.lastFailureTime = Date.now();
    console.log(`[CircuitBreaker:${this.name}] Forced OPEN`);
  }

  // Force Close
  forceClose(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successCount = 0;
    console.log(`[CircuitBreaker:${this.name}] Forced CLOSED`);
  }

  // Is Circuit Open
  isOpen(): boolean {
    return this.state === 'OPEN';
  }

  // Is Circuit Closed
  isClosed(): boolean {
    return this.state === 'CLOSED';
  }

  // Is Circuit Half Open
  isHalfOpen(): boolean {
    return this.state === 'HALF_OPEN';
  }
}

// Circuit Breaker Manager
export class CircuitBreakerManager {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    halfOpenMaxCalls: 3,
    timeout: 30000 // 30 seconds
  };

  // Create Circuit Breaker
  createCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    const finalConfig = { ...this.defaultConfig, ...config };
    const circuitBreaker = new CircuitBreaker(name, finalConfig);
    this.circuitBreakers.set(name, circuitBreaker);
    return circuitBreaker;
  }

  // Get Circuit Breaker
  getCircuitBreaker(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  // Get All Circuit Breakers
  getAllCircuitBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.circuitBreakers);
  }

  // Get All Statistics
  getAllStats(): CircuitBreakerStats[] {
    return Array.from(this.circuitBreakers.values()).map(cb => cb.getStats());
  }

  // Reset All Circuit Breakers
  resetAll(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
    console.log('[CircuitBreakerManager] All circuit breakers reset');
  }

  // Get Health Status
  getHealthStatus(): {
    healthy: number;
    unhealthy: number;
    total: number;
    details: { [name: string]: string };
  } {
    let healthy = 0;
    let unhealthy = 0;
    const details: { [name: string]: string } = {};

    for (const [name, circuitBreaker] of this.circuitBreakers) {
      const state = circuitBreaker.getState();
      details[name] = state.state;
      
      if (state.state === 'CLOSED') {
        healthy++;
      } else {
        unhealthy++;
      }
    }

    return {
      healthy,
      unhealthy,
      total: this.circuitBreakers.size,
      details
    };
  }
}

// Global circuit breaker manager
export const circuitBreakerManager = new CircuitBreakerManager();

// Pre-configured circuit breakers for common services
export const financeCircuitBreaker = circuitBreakerManager.createCircuitBreaker('finance', {
  failureThreshold: 3,
  resetTimeout: 30000,
  timeout: 10000
});

export const reportsCircuitBreaker = circuitBreakerManager.createCircuitBreaker('reports', {
  failureThreshold: 5,
  resetTimeout: 60000,
  timeout: 15000
});

export const cacheCircuitBreaker = circuitBreakerManager.createCircuitBreaker('cache', {
  failureThreshold: 10,
  resetTimeout: 30000,
  timeout: 5000
});

export const eventsCircuitBreaker = circuitBreakerManager.createCircuitBreaker('events', {
  failureThreshold: 5,
  resetTimeout: 45000,
  timeout: 10000
});
