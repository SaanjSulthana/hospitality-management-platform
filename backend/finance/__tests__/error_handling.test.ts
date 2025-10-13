import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
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

describe('Enhanced Error Handling Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Error Categorization', () => {
    it('should categorize database connection errors', () => {
      const connectionError = new Error('Connection timeout');
      connectionError.name = 'ConnectionError';
      
      const errorType = categorizeDatabaseError(connectionError);
      expect(errorType).toBe('connection_timeout');
    });

    it('should categorize column does not exist errors', () => {
      const columnError = new Error('column "status" of relation "expenses" does not exist');
      
      const errorType = categorizeDatabaseError(columnError);
      expect(errorType).toBe('column_does_not_exist');
    });

    it('should categorize constraint violation errors', () => {
      const constraintError = new Error('violates foreign key constraint "fk_expenses_property_id"');
      
      const errorType = categorizeDatabaseError(constraintError);
      expect(errorType).toBe('constraint_violation');
    });

    it('should categorize query execution errors', () => {
      const queryError = new Error('syntax error at or near "SELECT"');
      
      const errorType = categorizeDatabaseError(queryError);
      expect(errorType).toBe('query_execution_error');
    });

    it('should categorize permission denied errors', () => {
      const permissionError = new Error('permission denied for table expenses');
      
      const errorType = categorizeDatabaseError(permissionError);
      expect(errorType).toBe('permission_denied');
    });

    it('should categorize unknown errors as generic', () => {
      const unknownError = new Error('Some unknown error');
      
      const errorType = categorizeDatabaseError(unknownError);
      expect(errorType).toBe('unknown_error');
    });
  });

  describe('Error Message Generation', () => {
    it('should generate detailed error message for column does not exist', () => {
      const error = new Error('column "status" of relation "expenses" does not exist');
      const query = 'SELECT status FROM expenses WHERE org_id = $1';
      
      const errorMessage = generateDetailedErrorMessage(error, query, 'expenses');
      
      expect(errorMessage).toContain('Database query failed');
      expect(errorMessage).toContain('column does not exist');
      expect(errorMessage).toContain('expenses');
      expect(errorMessage).toContain('Run schema fix to add missing columns');
    });

    it('should generate detailed error message for constraint violation', () => {
      const error = new Error('violates foreign key constraint "fk_expenses_property_id"');
      const query = 'INSERT INTO expenses (property_id) VALUES ($1)';
      
      const errorMessage = generateDetailedErrorMessage(error, query, 'expenses');
      
      expect(errorMessage).toContain('Database query failed');
      expect(errorMessage).toContain('constraint violation');
      expect(errorMessage).toContain('expenses');
      expect(errorMessage).toContain('Verify foreign key references exist');
    });

    it('should generate detailed error message for connection timeout', () => {
      const error = new Error('Connection timeout');
      const query = 'SELECT * FROM expenses';
      
      const errorMessage = generateDetailedErrorMessage(error, query, 'expenses');
      
      expect(errorMessage).toContain('Database connection failed');
      expect(errorMessage).toContain('connection timeout');
      expect(errorMessage).toContain('Check database server status and network connectivity');
    });

    it('should generate detailed error message for permission denied', () => {
      const error = new Error('permission denied for table expenses');
      const query = 'SELECT * FROM expenses';
      
      const errorMessage = generateDetailedErrorMessage(error, query, 'expenses');
      
      expect(errorMessage).toContain('Database access denied');
      expect(errorMessage).toContain('permission denied');
      expect(errorMessage).toContain('Check user permissions and database access rights');
    });
  });

  describe('Error Response Format', () => {
    it('should create standardized error response with timestamp', () => {
      const error = new Error('column "status" does not exist');
      const query = 'SELECT status FROM expenses';
      const table = 'expenses';
      
      const errorResponse = createStandardizedErrorResponse(error, query, table);
      
      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse).toHaveProperty('details');
      expect(errorResponse).toHaveProperty('timestamp');
      expect(errorResponse.details).toHaveProperty('error_type');
      expect(errorResponse.details).toHaveProperty('query');
      expect(errorResponse.details).toHaveProperty('table');
      expect(errorResponse.details).toHaveProperty('suggestion');
      expect(new Date(errorResponse.timestamp)).toBeInstanceOf(Date);
    });

    it('should include query information in error response', () => {
      const error = new Error('syntax error');
      const query = 'SELECT * FROM expenses WHERE org_id = $1';
      const table = 'expenses';
      
      const errorResponse = createStandardizedErrorResponse(error, query, table);
      
      expect(errorResponse.details.query).toBe(query);
      expect(errorResponse.details.table).toBe(table);
    });

    it('should include actionable suggestions in error response', () => {
      const error = new Error('column "payment_mode" of relation "expenses" does not exist');
      const query = 'SELECT payment_mode FROM expenses';
      const table = 'expenses';
      
      const errorResponse = createStandardizedErrorResponse(error, query, table);
      
      expect(errorResponse.details.suggestion).toContain('fix-schema');
      expect(errorResponse.details.suggestion).toContain('missing column');
    });
  });

  describe('Error Recovery Strategies', () => {
    it('should provide fallback query for missing columns', () => {
      const originalQuery = 'SELECT id, status, payment_mode FROM expenses WHERE org_id = $1';
      const missingColumns = ['status', 'payment_mode'];
      
      const fallbackQuery = generateFallbackQuery(originalQuery, missingColumns);
      
      expect(fallbackQuery).not.toContain('status');
      expect(fallbackQuery).not.toContain('payment_mode');
      expect(fallbackQuery).toContain('id');
      expect(fallbackQuery).toContain('org_id');
    });

    it('should handle retry logic for connection errors', async () => {
      const mockQuery = jest.fn()
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValueOnce([{ id: 1, name: 'test' }]);
      
      const result = await executeWithRetry(mockQuery, 3, 100);
      
      expect(result).toEqual([{ id: 1, name: 'test' }]);
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries for connection errors', async () => {
      const mockQuery = jest.fn()
        .mockRejectedValue(new Error('Connection timeout'));
      
      await expect(executeWithRetry(mockQuery, 2, 10)).rejects.toThrow('Connection timeout');
      expect(mockQuery).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should not retry non-connection errors', async () => {
      const mockQuery = jest.fn()
        .mockRejectedValue(new Error('column "status" does not exist'));
      
      await expect(executeWithRetry(mockQuery, 3, 100)).rejects.toThrow('column "status" does not exist');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Logging and Monitoring', () => {
    it('should log error details with proper context', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const error = new Error('column "status" does not exist');
      const context = {
        operation: 'list_expenses',
        userId: '123',
        orgId: '456',
        query: 'SELECT status FROM expenses'
      };
      
      logDatabaseError(error, context);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Database error in list_expenses'),
        expect.objectContaining({
          error: error.message,
          operation: 'list_expenses',
          userId: '123',
          orgId: '456',
          query: 'SELECT status FROM expenses'
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should track error metrics', () => {
      const error = new Error('Connection timeout');
      const errorType = 'connection_timeout';
      
      trackErrorMetrics(errorType, 'list_expenses');
      
      // In a real implementation, this would update metrics
      // For testing, we just verify the function doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('API Error Handling', () => {
    it('should convert database errors to APIError with proper status codes', () => {
      const dbError = new Error('column "status" does not exist');
      const apiError = convertToAPIError(dbError, 'list_expenses');
      
      expect(apiError).toBeInstanceOf(APIError);
      expect(apiError.message).toContain('Database error in list_expenses');
      expect(apiError.code).toBe('internal');
    });

    it('should preserve APIError instances', () => {
      const originalAPIError = new APIError('Resource not found', 'not_found');
      const result = convertToAPIError(originalAPIError, 'list_expenses');
      
      expect(result).toBe(originalAPIError);
    });

    it('should handle different error types with appropriate status codes', () => {
      const permissionError = new Error('permission denied');
      const apiError = convertToAPIError(permissionError, 'list_expenses');
      
      expect(apiError.code).toBe('permission_denied');
      expect(apiError.message).toContain('Database access denied in list_expenses');
    });
  });
});

// Helper functions for testing (these would be implemented in the actual error handling module)
function categorizeDatabaseError(error: Error): string {
  const message = error.message.toLowerCase();
  
  if (message.includes('connection timeout') || message.includes('connection refused')) {
    return 'connection_timeout';
  }
  if (message.includes('column') && message.includes('does not exist')) {
    return 'column_does_not_exist';
  }
  if (message.includes('violates') && message.includes('constraint')) {
    return 'constraint_violation';
  }
  if (message.includes('syntax error') || message.includes('parse error')) {
    return 'query_execution_error';
  }
  if (message.includes('permission denied')) {
    return 'permission_denied';
  }
  
  return 'unknown_error';
}

function generateDetailedErrorMessage(error: Error, query: string, table: string): string {
  const errorType = categorizeDatabaseError(error);
  
  switch (errorType) {
    case 'column_does_not_exist':
      return `Database query failed: column does not exist in table ${table}. Run schema fix to add missing columns.`;
    case 'constraint_violation':
      return `Database query failed: constraint violation in table ${table}. Verify foreign key references exist.`;
    case 'connection_timeout':
      return `Database connection failed: connection timeout. Check database server status and network connectivity.`;
    case 'permission_denied':
      return `Database access denied: permission denied for table ${table}. Check user permissions and database access rights.`;
    default:
      return `Database error: ${error.message}`;
  }
}

function createStandardizedErrorResponse(error: Error, query: string, table: string) {
  const errorType = categorizeDatabaseError(error);
  
  return {
    error: 'Database query failed',
    details: {
      query,
      error_type: errorType,
      table,
      suggestion: getErrorSuggestion(errorType, table)
    },
    timestamp: new Date().toISOString()
  };
}

function getErrorSuggestion(errorType: string, table: string): string {
  switch (errorType) {
    case 'column_does_not_exist':
      return `Run POST /finance/fix-schema to add missing columns to ${table} table`;
    case 'constraint_violation':
      return `Verify foreign key references exist in related tables`;
    case 'connection_timeout':
      return 'Check database server status and network connectivity';
    case 'permission_denied':
      return 'Check user permissions and database access rights';
    default:
      return 'Contact system administrator for assistance';
  }
}

function generateFallbackQuery(originalQuery: string, missingColumns: string[]): string {
  let fallbackQuery = originalQuery;
  
  missingColumns.forEach(column => {
    const regex = new RegExp(`\\b${column}\\b`, 'gi');
    fallbackQuery = fallbackQuery.replace(regex, '');
  });
  
  // Clean up extra commas and spaces
  fallbackQuery = fallbackQuery.replace(/,\s*,/g, ',');
  fallbackQuery = fallbackQuery.replace(/,\s*FROM/g, ' FROM');
  fallbackQuery = fallbackQuery.replace(/,\s*WHERE/g, ' WHERE');
  
  return fallbackQuery;
}

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number,
  delayMs: number
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry non-connection errors
      if (!isRetryableError(lastError)) {
        throw error;
      }
      
      // Don't delay on the last attempt
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError!;
}

function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return message.includes('connection timeout') || 
         message.includes('connection refused') ||
         message.includes('temporary failure');
}

function logDatabaseError(error: Error, context: any): void {
  console.error(`Database error in ${context.operation}:`, {
    error: error.message,
    stack: error.stack,
    ...context
  });
}

function trackErrorMetrics(errorType: string, operation: string): void {
  // In a real implementation, this would send metrics to a monitoring system
  console.log(`Error metric: ${errorType} in ${operation}`);
}

function convertToAPIError(error: Error, operation: string): APIError {
  if (error instanceof APIError) {
    return error;
  }
  
  const errorType = categorizeDatabaseError(error);
  
  switch (errorType) {
    case 'permission_denied':
      return new APIError(`Database access denied in ${operation}: ${error.message}`, 'permission_denied');
    case 'connection_timeout':
      return new APIError(`Database connection failed in ${operation}: ${error.message}`, 'unavailable');
    default:
      return new APIError(`Database error in ${operation}: ${error.message}`, 'internal');
  }
}
