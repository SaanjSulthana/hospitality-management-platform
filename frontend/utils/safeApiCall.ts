/**
 * Safe API call utility with retry logic and comprehensive error handling
 */

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

interface SafeApiCallOptions extends RetryOptions {
  timeout?: number;
}

/**
 * Executes an API call with retry logic and comprehensive error handling
 */
export async function safeApiCall<T>(
  apiCall: () => Promise<T>,
  options: SafeApiCallOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 8000,
    timeout = 30000
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Add timeout to the API call
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeout);
      });

      const result = await Promise.race([apiCall(), timeoutPromise]);
      
      // Validate the result
      if (result === null || result === undefined) {
        throw new Error('API returned null or undefined');
      }

      return result;
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain errors
      if (isNonRetryableError(error)) {
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      
      console.warn(`API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // If we get here, all retries failed
  throw new Error(`API call failed after ${maxRetries + 1} attempts. Last error: ${lastError?.message}`);
}

/**
 * Determines if an error should not be retried
 */
function isNonRetryableError(error: any): boolean {
  // Don't retry on authentication errors
  if (error?.status === 401 || error?.status === 403) {
    return true;
  }

  // Don't retry on client errors (4xx)
  if (error?.status >= 400 && error?.status < 500) {
    return true;
  }

  // Don't retry on validation errors
  if (error?.message?.includes('validation') || error?.message?.includes('invalid')) {
    return true;
  }

  return false;
}

/**
 * Safe data access with null checks and default values
 */
export function safeDataAccess<T>(
  data: any,
  path: string,
  defaultValue: T
): T {
  try {
    const keys = path.split('.');
    let current = data;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return defaultValue;
      }
      current = current[key];
    }

    return current !== null && current !== undefined ? current : defaultValue;
  } catch (error) {
    console.warn(`Safe data access failed for path "${path}":`, error);
    return defaultValue;
  }
}

/**
 * Validates API response structure
 */
export function validateApiResponse(response: any, requiredFields: string[]): boolean {
  if (!response || typeof response !== 'object') {
    return false;
  }

  for (const field of requiredFields) {
    if (!(field in response)) {
      console.warn(`Missing required field: ${field}`);
      return false;
    }
  }

  return true;
}

/**
 * Creates a safe API call wrapper for React Query
 */
export function createSafeQueryFn<T>(
  apiCall: () => Promise<T>,
  options: SafeApiCallOptions = {}
) {
  return async (): Promise<T> => {
    return safeApiCall(apiCall, options);
  };
}
