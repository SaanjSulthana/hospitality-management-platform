import { APIError } from "encore.dev/api";

enum CircuitState {
  CLOSED,
  OPEN,
  HALF_OPEN,
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: Date | null = null;
  private halfOpenRequests: number = 0;
  
  constructor(
    private name: string,
    private maxFailures: number = 5,
    private resetTimeout: number = 30000,  // 30 seconds
    private maxHalfOpenRequests: number = 3
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldTransitionToHalfOpen()) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenRequests = 0;
        console.log(`[CircuitBreaker:${this.name}] Transitioning to HALF_OPEN`);
      } else {
        throw new APIError("unavailable", `Circuit breaker ${this.name} is OPEN`);
      }
    }
    
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenRequests >= this.maxHalfOpenRequests) {
        throw new APIError("unavailable", `Circuit breaker ${this.name} is HALF_OPEN (max requests exceeded)`);
      }
      this.halfOpenRequests++;
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
  
  private shouldTransitionToHalfOpen(): boolean {
    if (!this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime.getTime() > this.resetTimeout;
  }
  
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.failures = 0;
      this.halfOpenRequests = 0;
      console.log(`[CircuitBreaker:${this.name}] Closed after successful recovery`);
    } else {
      this.failures = 0;
    }
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    
    if (this.failures >= this.maxFailures) {
      this.state = CircuitState.OPEN;
      console.error(`[CircuitBreaker:${this.name}] OPENED after ${this.failures} failures`);
    }
  }
  
  getState(): string {
    switch (this.state) {
      case CircuitState.CLOSED: return 'CLOSED';
      case CircuitState.OPEN: return 'OPEN';
      case CircuitState.HALF_OPEN: return 'HALF_OPEN';
      default: return 'UNKNOWN';
    }
  }
  
  getStats(): {
    state: string;
    failures: number;
    lastFailureTime: Date | null;
    halfOpenRequests: number;
  } {
    return {
      state: this.getState(),
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      halfOpenRequests: this.halfOpenRequests
    };
  }
  
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.lastFailureTime = null;
    this.halfOpenRequests = 0;
    console.log(`[CircuitBreaker:${this.name}] Reset to CLOSED state`);
  }
}

// Usage in reports service
export const databaseCircuitBreaker = new CircuitBreaker("database", 5, 30000);
export const cacheCircuitBreaker = new CircuitBreaker("cache", 3, 15000);
export const pubsubCircuitBreaker = new CircuitBreaker("pubsub", 3, 20000);

// Circuit breaker for external services
export const externalServiceCircuitBreaker = new CircuitBreaker("external", 2, 60000);
