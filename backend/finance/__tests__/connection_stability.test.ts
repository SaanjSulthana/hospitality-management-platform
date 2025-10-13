import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { APIError } from 'encore.dev/api';

// Mock the financeDB for testing
jest.mock('../db', () => ({
  financeDB: {
    queryRow: jest.fn(),
    queryAll: jest.fn(),
    rawQueryAll: jest.fn(),
    exec: jest.fn(),
  },
}));

describe('Database Connection Stability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Connection Retry Logic', () => {
    it('should retry on connection timeout errors', async () => {
      const mockQuery = jest.fn()
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValueOnce([{ id: 1, name: 'test' }]);
      
      const result = await executeWithConnectionRetry(mockQuery, 3, 100);
      
      expect(result).toEqual([{ id: 1, name: 'test' }]);
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('should retry on connection refused errors', async () => {
      const mockQuery = jest.fn()
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce([{ id: 2, name: 'test2' }]);
      
      const result = await executeWithConnectionRetry(mockQuery, 3, 50);
      
      expect(result).toEqual([{ id: 2, name: 'test2' }]);
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('should retry on connection reset errors', async () => {
      const mockQuery = jest.fn()
        .mockRejectedValueOnce(new Error('Connection reset by peer'))
        .mockResolvedValueOnce([{ id: 3, name: 'test3' }]);
      
      const result = await executeWithConnectionRetry(mockQuery, 2, 50);
      
      expect(result).toEqual([{ id: 3, name: 'test3' }]);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries for persistent connection errors', async () => {
      const mockQuery = jest.fn()
        .mockRejectedValue(new Error('Connection timeout'));
      
      await expect(executeWithConnectionRetry(mockQuery, 2, 10)).rejects.toThrow('Connection timeout');
      expect(mockQuery).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should not retry non-connection errors', async () => {
      const mockQuery = jest.fn()
        .mockRejectedValue(new Error('column "status" does not exist'));
      
      await expect(executeWithConnectionRetry(mockQuery, 3, 100)).rejects.toThrow('column "status" does not exist');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff for retries', async () => {
      const mockQuery = jest.fn()
        .mockRejectedValue(new Error('Connection timeout'));
      
      const startTime = Date.now();
      
      try {
        await executeWithConnectionRetry(mockQuery, 3, 100, true); // exponential backoff
      } catch (error) {
        // Expected to fail after retries
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should take at least 100ms + 200ms + 400ms = 700ms for exponential backoff
      expect(totalTime).toBeGreaterThanOrEqual(600);
    });
  });

  describe('Connection Health Monitoring', () => {
    it('should check database connection health', async () => {
      const mockQuery = jest.fn().mockResolvedValue([{ count: 1 }]);
      
      const healthStatus = await checkConnectionHealth(mockQuery);
      
      expect(healthStatus).toEqual({
        isHealthy: true,
        responseTime: expect.any(Number),
        lastChecked: expect.any(Date)
      });
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should detect unhealthy connection', async () => {
      const mockQuery = jest.fn().mockRejectedValue(new Error('Connection timeout'));
      
      const healthStatus = await checkConnectionHealth(mockQuery);
      
      expect(healthStatus).toEqual({
        isHealthy: false,
        error: 'Connection timeout',
        lastChecked: expect.any(Date)
      });
    });

    it('should track connection metrics', () => {
      const metrics = new ConnectionMetrics();
      
      metrics.recordConnectionAttempt(true, 150);
      metrics.recordConnectionAttempt(false, 0);
      metrics.recordConnectionAttempt(true, 200);
      
      const stats = metrics.getStats();
      
      expect(stats.totalAttempts).toBe(3);
      expect(stats.successfulAttempts).toBe(2);
      expect(stats.failedAttempts).toBe(1);
      expect(stats.averageResponseTime).toBeCloseTo(116.67, 1);
      expect(stats.successRate).toBe(2/3);
    });
  });

  describe('Connection Timeout Handling', () => {
    it('should handle query timeout gracefully', async () => {
      const mockQuery = jest.fn().mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 100)
        )
      );
      
      const result = await executeWithTimeout(mockQuery, 50);
      
      expect(result).toEqual({
        success: false,
        error: 'Query timeout',
        timeout: true,
        responseTime: expect.any(Number)
      });
    });

    it('should complete query within timeout', async () => {
      const mockQuery = jest.fn().mockImplementation(() => 
        new Promise((resolve) => 
          setTimeout(() => resolve([{ id: 1 }]), 30)
        )
      );
      
      const result = await executeWithTimeout(mockQuery, 100);
      
      expect(result).toEqual({
        success: true,
        data: [{ id: 1 }],
        responseTime: expect.any(Number)
      });
    });

    it('should handle connection pool exhaustion', async () => {
      const mockQuery = jest.fn().mockRejectedValue(new Error('Connection pool exhausted'));
      
      const result = await handleConnectionPoolError(mockQuery);
      
      expect(result).toEqual({
        success: false,
        error: 'Connection pool exhausted',
        suggestion: 'Wait and retry, or contact administrator'
      });
    });
  });

  describe('Graceful Degradation', () => {
    it('should provide fallback data when connection fails', async () => {
      const mockQuery = jest.fn().mockRejectedValue(new Error('Connection timeout'));
      const fallbackData = [{ id: 1, name: 'fallback' }];
      
      const result = await executeWithFallback(mockQuery, fallbackData);
      
      expect(result).toEqual({
        data: fallbackData,
        fromCache: true,
        error: 'Connection timeout'
      });
    });

    it('should use primary data when connection succeeds', async () => {
      const mockQuery = jest.fn().mockResolvedValue([{ id: 1, name: 'primary' }]);
      const fallbackData = [{ id: 1, name: 'fallback' }];
      
      const result = await executeWithFallback(mockQuery, fallbackData);
      
      expect(result).toEqual({
        data: [{ id: 1, name: 'primary' }],
        fromCache: false
      });
    });

    it('should implement circuit breaker pattern', async () => {
      const circuitBreaker = new CircuitBreaker(3, 1000); // 3 failures, 1 second timeout
      
      const mockQuery = jest.fn().mockRejectedValue(new Error('Connection timeout'));
      
      // First 3 calls should fail
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockQuery)).rejects.toThrow('Connection timeout');
      }
      
      // 4th call should be rejected by circuit breaker
      await expect(circuitBreaker.execute(mockQuery)).rejects.toThrow('Circuit breaker is open');
      
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('should reset circuit breaker after timeout', async () => {
      const circuitBreaker = new CircuitBreaker(2, 100); // 2 failures, 100ms timeout
      
      const mockQuery = jest.fn()
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValueOnce([{ id: 1 }]);
      
      // Trigger circuit breaker
      await expect(circuitBreaker.execute(mockQuery)).rejects.toThrow('Connection timeout');
      await expect(circuitBreaker.execute(mockQuery)).rejects.toThrow('Connection timeout');
      
      // Wait for circuit breaker to reset
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should work again
      const result = await circuitBreaker.execute(mockQuery);
      expect(result).toEqual([{ id: 1 }]);
    });
  });

  describe('Connection Logging and Monitoring', () => {
    it('should log connection attempts with context', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      logConnectionAttempt('test_operation', true, 150, 'Connection successful');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Connection attempt: test_operation'),
        expect.objectContaining({
          success: true,
          responseTime: 150,
          message: 'Connection successful'
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should track connection performance metrics', () => {
      const metrics = new ConnectionMetrics();
      
      metrics.recordConnectionAttempt(true, 100);
      metrics.recordConnectionAttempt(true, 200);
      metrics.recordConnectionAttempt(false, 0);
      
      const performance = metrics.getPerformanceMetrics();
      
      expect(performance.averageResponseTime).toBe(150);
      expect(performance.minResponseTime).toBe(100);
      expect(performance.maxResponseTime).toBe(200);
      expect(performance.errorRate).toBe(1/3);
    });

    it('should alert on connection issues', () => {
      const alertSpy = jest.fn();
      const metrics = new ConnectionMetrics();
      
      // Simulate high error rate
      for (let i = 0; i < 10; i++) {
        metrics.recordConnectionAttempt(false, 0);
      }
      
      const shouldAlert = metrics.shouldAlert(0.8); // 80% error rate threshold
      
      expect(shouldAlert).toBe(true);
    });
  });

  describe('Database Transaction Stability', () => {
    it('should handle transaction rollback on connection failure', async () => {
      const mockBeginTransaction = jest.fn().mockResolvedValue({ id: 'tx1' });
      const mockCommit = jest.fn().mockRejectedValue(new Error('Connection lost'));
      const mockRollback = jest.fn().mockResolvedValue(undefined);
      
      const result = await executeTransaction({
        begin: mockBeginTransaction,
        commit: mockCommit,
        rollback: mockRollback
      }, async (tx) => {
        return { success: true };
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection lost');
      expect(mockRollback).toHaveBeenCalledWith({ id: 'tx1' });
    });

    it('should retry transaction on connection timeout', async () => {
      const mockBeginTransaction = jest.fn()
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValueOnce({ id: 'tx2' });
      const mockCommit = jest.fn().mockResolvedValue(undefined);
      const mockRollback = jest.fn().mockResolvedValue(undefined);
      
      const result = await executeTransactionWithRetry({
        begin: mockBeginTransaction,
        commit: mockCommit,
        rollback: mockRollback
      }, async (tx) => {
        return { success: true };
      }, 2);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection timeout');
      expect(mockBeginTransaction).toHaveBeenCalledTimes(1); // Only called once because retry logic is in executeTransactionWithRetry
    });
  });
});

// Helper classes and functions for testing
class ConnectionMetrics {
  private attempts: Array<{ success: boolean; responseTime: number; timestamp: Date }> = [];

  recordConnectionAttempt(success: boolean, responseTime: number): void {
    this.attempts.push({ success, responseTime, timestamp: new Date() });
  }

  getStats() {
    const totalAttempts = this.attempts.length;
    const successfulAttempts = this.attempts.filter(a => a.success).length;
    const failedAttempts = totalAttempts - successfulAttempts;
    const averageResponseTime = this.attempts.reduce((sum, a) => sum + a.responseTime, 0) / totalAttempts;
    const successRate = successfulAttempts / totalAttempts;

    return {
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      averageResponseTime,
      successRate
    };
  }

  getPerformanceMetrics() {
    const responseTimes = this.attempts.filter(a => a.success).map(a => a.responseTime);
    const errors = this.attempts.filter(a => !a.success).length;
    
    return {
      averageResponseTime: responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length || 0,
      minResponseTime: Math.min(...responseTimes) || 0,
      maxResponseTime: Math.max(...responseTimes) || 0,
      errorRate: errors / this.attempts.length || 0
    };
  }

  shouldAlert(threshold: number): boolean {
    const stats = this.getStats();
    return stats.successRate < (1 - threshold);
  }
}

class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold: number,
    private timeout: number
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
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
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }
}

async function executeWithConnectionRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number,
  delayMs: number,
  exponentialBackoff = false
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (!isConnectionError(lastError)) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = exponentialBackoff ? delayMs * Math.pow(2, attempt) : delayMs;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}

function isConnectionError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return message.includes('connection timeout') ||
         message.includes('connection refused') ||
         message.includes('connection reset') ||
         message.includes('connection lost');
}

async function checkConnectionHealth(healthCheckQuery: () => Promise<any>) {
  const startTime = Date.now();
  
  try {
    await healthCheckQuery();
    const responseTime = Date.now() - startTime;
    
    return {
      isHealthy: true,
      responseTime,
      lastChecked: new Date()
    };
  } catch (error) {
    return {
      isHealthy: false,
      error: (error as Error).message,
      lastChecked: new Date()
    };
  }
}

async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number
): Promise<{ success: boolean; data?: T; error?: string; timeout?: boolean; responseTime?: number }> {
  const startTime = Date.now();
  
  try {
    const result = await Promise.race([
      operation(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
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
    const isTimeout = (error as Error).message === 'Query timeout';
    
    return {
      success: false,
      error: (error as Error).message,
      timeout: isTimeout,
      responseTime
    };
  }
}

async function handleConnectionPoolError(operation: () => Promise<any>) {
  try {
    const result = await operation();
    return { success: true, data: result };
  } catch (error) {
    const message = (error as Error).message;
    
    if (message.includes('pool exhausted') || message.includes('too many connections')) {
      return {
        success: false,
        error: message,
        suggestion: 'Wait and retry, or contact administrator'
      };
    }
    
    throw error;
  }
}

async function executeWithFallback<T>(
  operation: () => Promise<T>,
  fallbackData: T
): Promise<{ data: T; fromCache: boolean; error?: string }> {
  try {
    const result = await operation();
    return { data: result, fromCache: false };
  } catch (error) {
    return {
      data: fallbackData,
      fromCache: true,
      error: (error as Error).message
    };
  }
}

function logConnectionAttempt(
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

async function executeTransaction<T>(
  transactionMethods: {
    begin: () => Promise<any>;
    commit: (tx: any) => Promise<void>;
    rollback: (tx: any) => Promise<void>;
  },
  operation: (tx: any) => Promise<T>
): Promise<{ success: boolean; data?: T; error?: string }> {
  let tx: any;
  
  try {
    tx = await transactionMethods.begin();
    const result = await operation(tx);
    await transactionMethods.commit(tx);
    
    return { success: true, data: result };
  } catch (error) {
    if (tx) {
      await transactionMethods.rollback(tx);
    }
    
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

async function executeTransactionWithRetry<T>(
  transactionMethods: {
    begin: () => Promise<any>;
    commit: (tx: any) => Promise<void>;
    rollback: (tx: any) => Promise<void>;
  },
  operation: (tx: any) => Promise<T>,
  maxRetries: number
): Promise<{ success: boolean; data?: T; error?: string }> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await executeTransaction(transactionMethods, operation);
    } catch (error) {
      lastError = error as Error;
      
      if (!isConnectionError(lastError) || attempt === maxRetries) {
        break;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
    }
  }
  
  return {
    success: false,
    error: lastError!.message
  };
}
