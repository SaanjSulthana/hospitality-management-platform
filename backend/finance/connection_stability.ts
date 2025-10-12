import { APIError } from "encore.dev/api";

export interface ConnectionHealthStatus {
  isHealthy: boolean;
  responseTime?: number;
  error?: string;
  lastChecked: Date;
}

export interface ConnectionMetrics {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  averageResponseTime: number;
  successRate: number;
  minResponseTime: number;
  maxResponseTime: number;
  errorRate: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  exponentialBackoff: boolean;
  maxDelayMs?: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  timeoutMs: number;
  resetTimeoutMs: number;
}

export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  retryCount?: number;
}

/**
 * Connection stability manager for database operations
 */
export class ConnectionStabilityManager {
  private metrics: ConnectionMetricsTracker;
  private circuitBreaker: CircuitBreaker;
  private defaultRetryConfig: RetryConfig;

  constructor(
    circuitBreakerConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      timeoutMs: 30000,
      resetTimeoutMs: 60000
    },
    retryConfig: RetryConfig = {
      maxRetries: 3,
      baseDelayMs: 1000,
      exponentialBackoff: true,
      maxDelayMs: 10000
    }
  ) {
    this.metrics = new ConnectionMetricsTracker();
    this.circuitBreaker = new CircuitBreaker(circuitBreakerConfig);
    this.defaultRetryConfig = retryConfig;
  }

  /**
   * Execute database operation with connection stability features
   */
  async executeWithStability<T>(
    operation: () => Promise<T>,
    operationName: string,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.defaultRetryConfig, ...retryConfig };
    
    return this.circuitBreaker.execute(async () => {
      return this.executeWithRetry(operation, operationName, config);
    });
  }

  /**
   * Execute operation with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    config: RetryConfig
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      const startTime = Date.now();
      
      try {
        const result = await operation();
        const responseTime = Date.now() - startTime;
        
        this.metrics.recordAttempt(true, responseTime);
        this.logConnectionAttempt(operationName, true, responseTime, 'Operation successful');
        
        return result;
      } catch (error) {
        const responseTime = Date.now() - startTime;
        lastError = error as Error;
        
        this.metrics.recordAttempt(false, responseTime);
        this.logConnectionAttempt(operationName, false, responseTime, lastError.message);
        
        if (!this.isRetryableError(lastError) || attempt === config.maxRetries) {
          break;
        }
        
        const delay = this.calculateDelay(attempt, config);
        console.log(`Retrying ${operationName} in ${delay}ms (attempt ${attempt + 1}/${config.maxRetries})`);
        
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  /**
   * Check database connection health
   */
  async checkConnectionHealth(healthCheckQuery: () => Promise<any>): Promise<ConnectionHealthStatus> {
    const startTime = Date.now();
    
    try {
      await healthCheckQuery();
      const responseTime = Date.now() - startTime;
      
      this.metrics.recordAttempt(true, responseTime);
      
      return {
        isHealthy: true,
        responseTime,
        lastChecked: new Date()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.metrics.recordAttempt(false, responseTime);
      
      return {
        isHealthy: false,
        error: (error as Error).message,
        lastChecked: new Date()
      };
    }
  }

  /**
   * Execute operation with timeout
   */
  async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<{ success: boolean; data?: T; error?: string; timeout?: boolean; responseTime?: number }> {
    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
        )
      ]);
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        data: result,
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const isTimeout = (error as Error).message === 'Operation timeout';
      
      return {
        success: false,
        error: (error as Error).message,
        timeout: isTimeout,
        responseTime
      };
    }
  }

  /**
   * Execute operation with fallback data
   */
  async executeWithFallback<T>(
    operation: () => Promise<T>,
    fallbackData: T,
    operationName: string
  ): Promise<{ data: T; fromCache: boolean; error?: string }> {
    try {
      const result = await this.executeWithStability(operation, operationName);
      return { data: result, fromCache: false };
    } catch (error) {
      console.warn(`Using fallback data for ${operationName}:`, (error as Error).message);
      return {
        data: fallbackData,
        fromCache: true,
        error: (error as Error).message
      };
    }
  }

  /**
   * Execute database transaction with stability features
   */
  async executeTransaction<T>(
    transactionMethods: {
      begin: () => Promise<any>;
      commit: (tx: any) => Promise<void>;
      rollback: (tx: any) => Promise<void>;
    },
    operation: (tx: any) => Promise<T>,
    operationName: string
  ): Promise<TransactionResult<T>> {
    return this.executeWithStability(async () => {
      let tx: any;
      
      try {
        tx = await transactionMethods.begin();
        const result = await operation(tx);
        await transactionMethods.commit(tx);
        
        return { success: true, data: result };
      } catch (error) {
        if (tx) {
          try {
            await transactionMethods.rollback(tx);
          } catch (rollbackError) {
            console.error('Transaction rollback failed:', rollbackError);
          }
        }
        
        throw error;
      }
    }, operationName);
  }

  /**
   * Get connection metrics
   */
  getMetrics(): ConnectionMetrics {
    return this.metrics.getMetrics();
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): { state: string; failures: number; lastFailureTime?: Date } {
    return this.circuitBreaker.getStatus();
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Check if system should alert on connection issues
   */
  shouldAlert(errorRateThreshold: number = 0.8): boolean {
    const metrics = this.getMetrics();
    return metrics.errorRate > errorRateThreshold;
  }

  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('connection timeout') ||
           message.includes('connection refused') ||
           message.includes('connection reset') ||
           message.includes('connection lost') ||
           message.includes('temporary failure') ||
           message.includes('network error');
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelayMs;
    
    if (config.exponentialBackoff) {
      delay = delay * Math.pow(2, attempt);
    }
    
    if (config.maxDelayMs && delay > config.maxDelayMs) {
      delay = config.maxDelayMs;
    }
    
    return delay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private logConnectionAttempt(
    operation: string,
    success: boolean,
    responseTime: number,
    message: string
  ): void {
    console.log(`Connection attempt: ${operation}`, {
      success,
      responseTime,
      message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Circuit breaker implementation for connection stability
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime?: Date;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.lastFailureTime && 
          Date.now() - this.lastFailureTime.getTime() > this.config.resetTimeoutMs) {
        this.state = 'half-open';
        console.log('Circuit breaker: transitioning to half-open state');
      } else {
        throw new APIError('unavailable', 'Circuit breaker is open - too many failures');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = undefined;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
      console.warn(`Circuit breaker: opened after ${this.failures} failures`);
    }
  }

  getStatus(): { state: string; failures: number; lastFailureTime?: Date } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }

  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = undefined;
    console.log('Circuit breaker: reset');
  }
}

/**
 * Connection metrics tracker
 */
class ConnectionMetricsTracker {
  private attempts: Array<{ success: boolean; responseTime: number; timestamp: Date }> = [];
  private readonly maxHistorySize = 1000; // Keep last 1000 attempts

  recordAttempt(success: boolean, responseTime: number): void {
    this.attempts.push({ success, responseTime, timestamp: new Date() });
    
    // Keep only recent history
    if (this.attempts.length > this.maxHistorySize) {
      this.attempts = this.attempts.slice(-this.maxHistorySize);
    }
  }

  getMetrics(): ConnectionMetrics {
    const totalAttempts = this.attempts.length;
    if (totalAttempts === 0) {
      return {
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        averageResponseTime: 0,
        successRate: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        errorRate: 0
      };
    }

    const successfulAttempts = this.attempts.filter(a => a.success).length;
    const failedAttempts = totalAttempts - successfulAttempts;
    const responseTimes = this.attempts.map(a => a.responseTime);
    const successfulResponseTimes = this.attempts.filter(a => a.success).map(a => a.responseTime);
    
    return {
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      averageResponseTime: responseTimes.reduce((sum, t) => sum + t, 0) / totalAttempts,
      successRate: successfulAttempts / totalAttempts,
      minResponseTime: successfulResponseTimes.length > 0 ? Math.min(...successfulResponseTimes) : 0,
      maxResponseTime: successfulResponseTimes.length > 0 ? Math.max(...successfulResponseTimes) : 0,
      errorRate: failedAttempts / totalAttempts
    };
  }

  getRecentMetrics(minutes: number = 5): ConnectionMetrics {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    const recentAttempts = this.attempts.filter(a => a.timestamp >= cutoffTime);
    
    if (recentAttempts.length === 0) {
      return this.getMetrics();
    }

    // Create temporary tracker for recent metrics
    const tempTracker = new ConnectionMetricsTracker();
    recentAttempts.forEach(a => tempTracker.recordAttempt(a.success, a.responseTime));
    
    return tempTracker.getMetrics();
  }
}

/**
 * Global connection stability manager instance
 */
export const connectionStability = new ConnectionStabilityManager();

/**
 * Utility functions for common connection stability operations
 */

/**
 * Execute database query with connection stability
 */
export async function executeQueryWithStability<T>(
  query: () => Promise<T>,
  operationName: string,
  retryConfig?: Partial<RetryConfig>
): Promise<T> {
  return connectionStability.executeWithStability(query, operationName, retryConfig);
}

/**
 * Execute database query with timeout
 */
export async function executeQueryWithTimeout<T>(
  query: () => Promise<T>,
  timeoutMs: number = 30000
): Promise<{ success: boolean; data?: T; error?: string; timeout?: boolean; responseTime?: number }> {
  return connectionStability.executeWithTimeout(query, timeoutMs);
}

/**
 * Execute database query with fallback
 */
export async function executeQueryWithFallback<T>(
  query: () => Promise<T>,
  fallbackData: T,
  operationName: string
): Promise<{ data: T; fromCache: boolean; error?: string }> {
  return connectionStability.executeWithFallback(query, fallbackData, operationName);
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(healthCheckQuery: () => Promise<any>): Promise<ConnectionHealthStatus> {
  return connectionStability.checkConnectionHealth(healthCheckQuery);
}

/**
 * Get connection metrics
 */
export function getConnectionMetrics(): ConnectionMetrics {
  return connectionStability.getMetrics();
}

/**
 * Get recent connection metrics
 */
export function getRecentConnectionMetrics(minutes: number = 5): ConnectionMetrics {
  return (connectionStability as any).metrics.getRecentMetrics(minutes);
}

/**
 * Check if system should alert
 */
export function shouldAlertOnConnectionIssues(errorRateThreshold: number = 0.8): boolean {
  return connectionStability.shouldAlert(errorRateThreshold);
}
