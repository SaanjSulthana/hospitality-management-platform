import { APIError } from "encore.dev/api";

export interface ErrorContext {
  operation: string;
  userId?: string;
  orgId?: string;
  query?: string;
  table?: string;
  [key: string]: any;
}

export interface DetailedErrorResponse {
  error: string;
  details: {
    query?: string;
    error_type: string;
    table?: string;
    missing_column?: string;
    constraint?: string;
    suggestion: string;
    retry_count?: number;
  };
  timestamp: string;
}

export type DatabaseErrorType = 
  | 'connection_timeout'
  | 'column_does_not_exist'
  | 'constraint_violation'
  | 'query_execution_error'
  | 'permission_denied'
  | 'table_does_not_exist'
  | 'unknown_error';

/**
 * Categorize database errors based on error message patterns
 */
export function categorizeDatabaseError(error: Error): DatabaseErrorType {
  const message = error.message.toLowerCase();
  
  if (message.includes('connection timeout') || 
      message.includes('connection refused') ||
      message.includes('connection reset') ||
      message.includes('timeout')) {
    return 'connection_timeout';
  }
  
  if (message.includes('column') && message.includes('does not exist')) {
    return 'column_does_not_exist';
  }
  
  if (message.includes('table') && message.includes('does not exist')) {
    return 'table_does_not_exist';
  }
  
  if (message.includes('violates') && message.includes('constraint')) {
    return 'constraint_violation';
  }
  
  if (message.includes('syntax error') || 
      message.includes('parse error') ||
      message.includes('invalid input syntax')) {
    return 'query_execution_error';
  }
  
  if (message.includes('permission denied') ||
      message.includes('access denied') ||
      message.includes('insufficient privilege')) {
    return 'permission_denied';
  }
  
  return 'unknown_error';
}

/**
 * Extract missing column name from error message
 */
export function extractMissingColumn(error: Error): string | null {
  const message = error.message;
  const match = message.match(/column "([^"]+)" of relation/);
  return match ? match[1] : null;
}

/**
 * Extract constraint name from error message
 */
export function extractConstraintName(error: Error): string | null {
  const message = error.message;
  const match = message.match(/constraint "([^"]+)"/);
  return match ? match[1] : null;
}

/**
 * Generate actionable error suggestions based on error type
 */
export function generateErrorSuggestion(errorType: DatabaseErrorType, table?: string, missingColumn?: string, constraint?: string): string {
  switch (errorType) {
    case 'column_does_not_exist':
      return `Run POST /finance/fix-schema to add missing column "${missingColumn}" to ${table} table`;
    
    case 'table_does_not_exist':
      return `Table "${table}" does not exist. Run database initialization or check table name.`;
    
    case 'constraint_violation':
      if (constraint?.includes('foreign key')) {
        return `Foreign key constraint violation. Verify referenced records exist in related tables.`;
      }
      return `Constraint violation in ${constraint}. Check data integrity and constraint rules.`;
    
    case 'connection_timeout':
      return 'Check database server status and network connectivity. Retry the operation.';
    
    case 'permission_denied':
      return 'Check user permissions and database access rights. Contact administrator if needed.';
    
    case 'query_execution_error':
      return 'Query syntax error. Check query structure and parameter values.';
    
    default:
      return 'Contact system administrator for assistance with this database error.';
  }
}

/**
 * Create standardized error response with detailed information
 */
export function createDetailedErrorResponse(
  error: Error, 
  context: ErrorContext
): DetailedErrorResponse {
  const errorType = categorizeDatabaseError(error);
  const missingColumn = extractMissingColumn(error);
  const constraint = extractConstraintName(error);
  
  const suggestion = generateErrorSuggestion(errorType, context.table, missingColumn, constraint);
  
  const response: DetailedErrorResponse = {
    error: getErrorTitle(errorType),
    details: {
      error_type: errorType,
      suggestion
    },
    timestamp: new Date().toISOString()
  };
  
  // Add context-specific details
  if (context.query) {
    response.details.query = context.query;
  }
  
  if (context.table) {
    response.details.table = context.table;
  }
  
  if (missingColumn) {
    response.details.missing_column = missingColumn;
  }
  
  if (constraint) {
    response.details.constraint = constraint;
  }
  
  return response;
}

/**
 * Get appropriate error title based on error type
 */
function getErrorTitle(errorType: DatabaseErrorType): string {
  switch (errorType) {
    case 'connection_timeout':
      return 'Database connection failed';
    case 'column_does_not_exist':
    case 'table_does_not_exist':
      return 'Database schema error';
    case 'constraint_violation':
      return 'Database constraint violation';
    case 'query_execution_error':
      return 'Database query execution failed';
    case 'permission_denied':
      return 'Database access denied';
    default:
      return 'Database error';
  }
}

/**
 * Convert database errors to appropriate APIError instances
 */
export function convertToAPIError(error: Error, context: ErrorContext): APIError {
  if (error instanceof APIError) {
    return error;
  }
  
  const errorType = categorizeDatabaseError(error);
  const errorMessage = `Database error in ${context.operation}: ${error.message}`;
  
  switch (errorType) {
    case 'permission_denied':
      return APIError.permissionDenied(errorMessage);
    
    case 'connection_timeout':
      return APIError.unavailable(errorMessage);
    
    case 'column_does_not_exist':
    case 'table_does_not_exist':
      return APIError.failedPrecondition(errorMessage);
    
    case 'constraint_violation':
      return APIError.invalidArgument(errorMessage);
    
    case 'query_execution_error':
      return APIError.invalidArgument(errorMessage);
    
    default:
      return APIError.internal(errorMessage);
  }
}

/**
 * Log database errors with proper context
 */
export function logDatabaseError(error: Error, context: ErrorContext): void {
  const errorType = categorizeDatabaseError(error);
  const errorResponse = createDetailedErrorResponse(error, context);
  
  console.error(`Database error in ${context.operation}:`, {
    errorType,
    message: error.message,
    stack: error.stack,
    context,
    errorResponse
  });
  
  // Track error metrics (in a real implementation, this would send to monitoring system)
  trackErrorMetrics(errorType, context.operation);
}

/**
 * Track error metrics for monitoring
 */
function trackErrorMetrics(errorType: DatabaseErrorType, operation: string): void {
  // In a real implementation, this would send metrics to a monitoring system
  console.log(`Error metric: ${errorType} in ${operation} at ${new Date().toISOString()}`);
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const errorType = categorizeDatabaseError(error);
  return errorType === 'connection_timeout';
}

/**
 * Execute operation with retry logic for connection errors
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry non-retryable errors
      if (!isRetryableError(lastError)) {
        throw error;
      }
      
      // Don't delay on the last attempt
      if (attempt < maxRetries) {
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError!;
}

/**
 * Generate fallback query by removing missing columns
 */
export function generateFallbackQuery(originalQuery: string, missingColumns: string[]): string {
  // For expenses table, return a simple fallback query
  if (originalQuery.includes('FROM expenses e')) {
    return `
      SELECT
        e.id, e.property_id, p.name as property_name, e.category, e.amount_cents, e.currency,
        e.description, e.receipt_url, e.expense_date,
        e.created_by_user_id, e.created_at,
        u.display_name as created_by_name
      FROM expenses e
      JOIN properties p ON e.property_id = p.id AND p.org_id = $1
      JOIN users u ON e.created_by_user_id = u.id AND u.org_id = $1
      WHERE e.org_id = $1
      ORDER BY e.expense_date DESC, e.created_at DESC
    `;
  }
  
  // For revenues table, return a simple fallback query
  if (originalQuery.includes('FROM revenues r')) {
    return `
      SELECT
        r.id, r.property_id, p.name as property_name, r.source, r.amount_cents, r.currency,
        r.description, r.receipt_url, r.occurred_at,
        r.created_by_user_id, r.created_at,
        u.display_name as created_by_name
      FROM revenues r
      JOIN properties p ON r.property_id = p.id AND p.org_id = $1
      JOIN users u ON r.created_by_user_id = u.id AND u.org_id = $1
      WHERE r.org_id = $1
      ORDER BY r.occurred_at DESC, r.created_at DESC
    `;
  }
  
  // For other queries, try to remove missing columns more carefully
  let fallbackQuery = originalQuery;
  
  missingColumns.forEach(column => {
    // Remove column from SELECT clause - be more specific
    const selectRegex = new RegExp(`\\b\\w+\\.${column}\\b\\s*,?`, 'gi');
    fallbackQuery = fallbackQuery.replace(selectRegex, '');
    
    // Remove COALESCE expressions with the column
    const coalesceRegex = new RegExp(`COALESCE\\(\\w+\\.${column}[^)]*\\)\\s*as\\s*\\w+\\s*,?`, 'gi');
    fallbackQuery = fallbackQuery.replace(coalesceRegex, '');
    
    // Remove column from WHERE clause
    const whereRegex = new RegExp(`\\b\\w+\\.${column}\\b\\s*[=<>!]+[^\\s,)]+`, 'gi');
    fallbackQuery = fallbackQuery.replace(whereRegex, '');
  });
  
  // Clean up extra commas and spaces
  fallbackQuery = fallbackQuery.replace(/,\s*,/g, ',');
  fallbackQuery = fallbackQuery.replace(/,\s*FROM/g, ' FROM');
  fallbackQuery = fallbackQuery.replace(/,\s*WHERE/g, ' WHERE');
  fallbackQuery = fallbackQuery.replace(/,\s*ORDER/g, ' ORDER');
  fallbackQuery = fallbackQuery.replace(/,\s*GROUP/g, ' GROUP');
  fallbackQuery = fallbackQuery.replace(/,\s*HAVING/g, ' HAVING');
  
  // Remove empty WHERE clauses
  fallbackQuery = fallbackQuery.replace(/WHERE\s+AND/gi, 'WHERE');
  fallbackQuery = fallbackQuery.replace(/WHERE\s+OR/gi, 'WHERE');
  fallbackQuery = fallbackQuery.replace(/WHERE\s*$/gi, '');
  
  return fallbackQuery;
}

/**
 * Handle database errors with comprehensive error handling
 */
export function handleDatabaseError(error: Error, context: ErrorContext): APIError {
  // Log the error with context
  logDatabaseError(error, context);
  
  // Create detailed error response
  const errorResponse = createDetailedErrorResponse(error, context);
  
  // Convert to APIError
  const apiError = convertToAPIError(error, context);
  
  // Add detailed error information to the APIError
  (apiError as any).details = errorResponse.details;
  
  return apiError;
}

/**
 * Enhanced error handler for finance operations
 */
export function handleFinanceError(error: Error, operation: string, additionalContext: Partial<ErrorContext> = {}): APIError {
  const context: ErrorContext = {
    operation,
    ...additionalContext
  };
  
  return handleDatabaseError(error, context);
}

/**
 * Check if error indicates missing schema elements
 */
export function isSchemaError(error: Error): boolean {
  const errorType = categorizeDatabaseError(error);
  return errorType === 'column_does_not_exist' || errorType === 'table_does_not_exist';
}

/**
 * Get schema fix suggestion for schema errors
 */
export function getSchemaFixSuggestion(error: Error): string {
  const errorType = categorizeDatabaseError(error);
  
  if (errorType === 'column_does_not_exist') {
    return 'Run POST /finance/fix-schema to add missing columns';
  }
  
  if (errorType === 'table_does_not_exist') {
    return 'Run database initialization to create missing tables';
  }
  
  return 'Check database schema and run appropriate migrations';
}
