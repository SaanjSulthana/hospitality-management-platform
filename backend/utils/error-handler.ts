import { APIError } from "encore.dev/api";
import log from "encore.dev/log";
import { getEnvironmentConfig, getEnvironmentErrorMessages } from "../config/environment";

/**
 * Error types for consistent error handling
 */
export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  CONFLICT_ERROR = 'CONFLICT_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  FILE_UPLOAD_ERROR = 'FILE_UPLOAD_ERROR',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Custom error class with additional context
 */
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly statusCode: number;
  public readonly context?: Record<string, any>;
  public readonly timestamp: string;
  public readonly requestId?: string;

  constructor(
    message: string,
    type: ErrorType,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    statusCode: number = 500,
    context?: Record<string, any>,
    requestId?: string
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.severity = severity;
    this.statusCode = statusCode;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.requestId = requestId;
  }
}

/**
 * Error handler class
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorMessages: Record<string, string>;

  private constructor() {
    this.errorMessages = getEnvironmentErrorMessages();
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle and log errors consistently
   */
  public handleError(error: Error, context?: Record<string, any>): APIError {
    const config = getEnvironmentConfig();
    
    // Log the error with appropriate level
    this.logError(error, context);
    
    // Convert to APIError for Encore.js
    if (error instanceof AppError) {
      return new APIError(
        this.getUserFriendlyMessage(error),
        error.type,
        error.statusCode,
        config.debug ? { 
          originalError: error.message,
          context: error.context,
          timestamp: error.timestamp,
          requestId: error.requestId,
        } : undefined
      );
    }
    
    // Handle standard errors
    if (error instanceof APIError) {
      return error;
    }
    
    // Handle unknown errors
    const appError = new AppError(
      error.message,
      ErrorType.INTERNAL_ERROR,
      ErrorSeverity.HIGH,
      500,
      context
    );
    
    return new APIError(
      this.getUserFriendlyMessage(appError),
      appError.type,
      appError.statusCode,
      config.debug ? { 
        originalError: error.message,
        context,
        timestamp: appError.timestamp,
      } : undefined
    );
  }

  /**
   * Log error with appropriate level based on severity
   */
  private logError(error: Error, context?: Record<string, any>): void {
    const logData = {
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    };

    if (error instanceof AppError) {
      switch (error.severity) {
        case ErrorSeverity.LOW:
          log.info('Low severity error', logData);
          break;
        case ErrorSeverity.MEDIUM:
          log.warn('Medium severity error', logData);
          break;
        case ErrorSeverity.HIGH:
          log.error('High severity error', logData);
          break;
        case ErrorSeverity.CRITICAL:
          log.error('CRITICAL ERROR', logData);
          break;
      }
    } else {
      log.error('Unhandled error', logData);
    }
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(error: AppError): string {
    const config = getEnvironmentConfig();
    
    // In development, show detailed error messages
    if (config.debug) {
      return error.message;
    }
    
    // In production, show user-friendly messages
    switch (error.type) {
      case ErrorType.VALIDATION_ERROR:
        return this.errorMessages.validationError;
      case ErrorType.AUTHENTICATION_ERROR:
        return this.errorMessages.authenticationError;
      case ErrorType.AUTHORIZATION_ERROR:
        return this.errorMessages.authorizationError;
      case ErrorType.DATABASE_ERROR:
        return this.errorMessages.databaseError;
      case ErrorType.INTERNAL_ERROR:
        return this.errorMessages.internalError;
      default:
        return this.errorMessages.internalError;
    }
  }

  /**
   * Create validation error
   */
  public createValidationError(message: string, context?: Record<string, any>): AppError {
    return new AppError(
      message,
      ErrorType.VALIDATION_ERROR,
      ErrorSeverity.LOW,
      400,
      context
    );
  }

  /**
   * Create authentication error
   */
  public createAuthenticationError(message: string = 'Authentication failed', context?: Record<string, any>): AppError {
    return new AppError(
      message,
      ErrorType.AUTHENTICATION_ERROR,
      ErrorSeverity.MEDIUM,
      401,
      context
    );
  }

  /**
   * Create authorization error
   */
  public createAuthorizationError(message: string = 'Access denied', context?: Record<string, any>): AppError {
    return new AppError(
      message,
      ErrorType.AUTHORIZATION_ERROR,
      ErrorSeverity.MEDIUM,
      403,
      context
    );
  }

  /**
   * Create not found error
   */
  public createNotFoundError(resource: string, context?: Record<string, any>): AppError {
    return new AppError(
      `${resource} not found`,
      ErrorType.NOT_FOUND_ERROR,
      ErrorSeverity.LOW,
      404,
      context
    );
  }

  /**
   * Create conflict error
   */
  public createConflictError(message: string, context?: Record<string, any>): AppError {
    return new AppError(
      message,
      ErrorType.CONFLICT_ERROR,
      ErrorSeverity.MEDIUM,
      409,
      context
    );
  }

  /**
   * Create database error
   */
  public createDatabaseError(message: string, context?: Record<string, any>): AppError {
    return new AppError(
      message,
      ErrorType.DATABASE_ERROR,
      ErrorSeverity.HIGH,
      500,
      context
    );
  }

  /**
   * Create file upload error
   */
  public createFileUploadError(message: string, context?: Record<string, any>): AppError {
    return new AppError(
      message,
      ErrorType.FILE_UPLOAD_ERROR,
      ErrorSeverity.MEDIUM,
      400,
      context
    );
  }

  /**
   * Create internal error
   */
  public createInternalError(message: string, context?: Record<string, any>): AppError {
    return new AppError(
      message,
      ErrorType.INTERNAL_ERROR,
      ErrorSeverity.HIGH,
      500,
      context
    );
  }
}

/**
 * Utility functions for common error scenarios
 */
export const errorUtils = {
  /**
   * Handle database errors
   */
  handleDatabaseError: (error: any, operation: string): AppError => {
    const handler = ErrorHandler.getInstance();
    
    // Check for common database error types
    if (error.code === '23505') { // Unique constraint violation
      return handler.createConflictError(
        `Duplicate entry: ${operation} already exists`,
        { operation, errorCode: error.code }
      );
    }
    
    if (error.code === '23503') { // Foreign key constraint violation
      return handler.createValidationError(
        `Invalid reference: ${operation} references non-existent data`,
        { operation, errorCode: error.code }
      );
    }
    
    if (error.code === '23502') { // Not null constraint violation
      return handler.createValidationError(
        `Missing required field: ${operation}`,
        { operation, errorCode: error.code }
      );
    }
    
    // Generic database error
    return handler.createDatabaseError(
      `Database error during ${operation}`,
      { operation, errorCode: error.code, errorMessage: error.message }
    );
  },

  /**
   * Handle file upload errors
   */
  handleFileUploadError: (error: any, filename: string): AppError => {
    const handler = ErrorHandler.getInstance();
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return handler.createFileUploadError(
        `File ${filename} is too large`,
        { filename, errorCode: error.code }
      );
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return handler.createFileUploadError(
        `Too many files uploaded`,
        { filename, errorCode: error.code }
      );
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return handler.createFileUploadError(
        `Unexpected file field: ${filename}`,
        { filename, errorCode: error.code }
      );
    }
    
    return handler.createFileUploadError(
      `File upload error for ${filename}`,
      { filename, errorMessage: error.message }
    );
  },

  /**
   * Handle validation errors
   */
  handleValidationError: (errors: Record<string, string[]>): AppError => {
    const handler = ErrorHandler.getInstance();
    const errorMessages = Object.entries(errors)
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
      .join('; ');
    
    return handler.createValidationError(
      `Validation failed: ${errorMessages}`,
      { validationErrors: errors }
    );
  },
};

/**
 * Global error handler instance
 */
export const errorHandler = ErrorHandler.getInstance();

/**
 * Async error wrapper for API endpoints
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw errorHandler.handleError(error as Error);
    }
  };
}
