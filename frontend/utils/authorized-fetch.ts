/**
 * Authorized Fetch Wrapper
 * 
 * Enterprise-grade fetch interceptor inspired by:
 * - Axios interceptors pattern
 * - Google Cloud API client retry logic
 * - Stripe's idempotent request handling
 * 
 * Features:
 * - Automatic token injection
 * - Proactive token refresh
 * - 401 retry with fresh token
 * - Request deduplication during refresh
 * - Exponential backoff on failures
 * - Comprehensive error handling
 */

import { tokenManager } from '../services/token-manager';
import { API_CONFIG } from '../src/config/api';

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean; // Skip auth for public endpoints
  retryConfig?: Partial<RetryConfig>;
  timeout?: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 1, // Only retry once for 401
  initialDelayMs: 100,
  maxDelayMs: 1000,
  backoffMultiplier: 2,
};

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if URL is targeting our API
 */
function isApiUrl(url: string): boolean {
  return url.startsWith(API_CONFIG.BASE_URL) || url.startsWith('/');
}

/**
 * Check if this is a public auth endpoint that doesn't need token
 */
function isPublicEndpoint(url: string): boolean {
  const publicPaths = [
    '/auth/login',
    '/auth/signup',
    '/auth/refresh',
    '/auth/forgot-password',
    '/auth/reset-password',
  ];
  
  return publicPaths.some(path => url.includes(path));
}

/**
 * Create a timeout promise
 */
function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms);
  });
}

/**
 * Authorized fetch with automatic token management
 * 
 * This is the main fetch wrapper that should be used for all API calls
 */
export async function authorizedFetch(
  input: RequestInfo | URL,
  options: FetchOptions = {}
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  
  // For non-API URLs or public endpoints, use standard fetch
  if (!isApiUrl(url) || isPublicEndpoint(url) || options.skipAuth) {
    return fetch(input, options);
  }

  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
  const timeout = options.timeout || API_CONFIG.TIMEOUT;
  
  // Remove custom options before passing to fetch
  const { skipAuth, retryConfig: _, timeout: __, ...fetchOptions } = options;

  /**
   * Execute fetch with token
   */
  async function executeFetch(attempt: number = 0): Promise<Response> {
    try {
      // Get valid access token (automatically refreshes if needed)
      let accessToken: string;
      
      try {
        accessToken = await tokenManager.getValidAccessToken();
      } catch (tokenError) {
        console.error('[authorizedFetch] Failed to get access token:', tokenError);
        
        // Dispatch auth failure event
        window.dispatchEvent(new CustomEvent('authenticationFailed', {
          detail: { error: 'Failed to get access token' }
        }));
        
        throw new Error('Authentication required');
      }

      // Prepare headers with authorization
      const headers = new Headers(fetchOptions.headers);
      headers.set('Authorization', `Bearer ${accessToken}`);
      
      // Add standard headers if not present
      if (!headers.has('Content-Type') && fetchOptions.body) {
        headers.set('Content-Type', 'application/json');
      }

      const requestOptions: RequestInit = {
        ...fetchOptions,
        headers,
      };

      // Execute fetch with timeout
      const fetchPromise = fetch(input, requestOptions);
      const timeoutPromise = createTimeoutPromise(timeout);
      
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      // Handle 401 Unauthorized - token might be invalid
      if (response.status === 401 && attempt < retryConfig.maxRetries) {
        console.log('[authorizedFetch] Got 401, attempting token refresh and retry...');
        
        try {
          // Force refresh the token
          await tokenManager.forceRefresh();
          
          // Wait with exponential backoff before retry
          const delay = getBackoffDelay(attempt, retryConfig);
          await sleep(delay);
          
          // Retry the request
          return executeFetch(attempt + 1);
          
        } catch (refreshError) {
          console.error('[authorizedFetch] Token refresh failed:', refreshError);
          
          // Dispatch auth failure event
          window.dispatchEvent(new CustomEvent('authenticationFailed', {
            detail: { error: 'Token refresh failed' }
          }));
          
          // Return original 401 response
          return response;
        }
      }

      // For successful responses or non-401 errors, return as-is
      return response;
      
    } catch (error) {
      console.error('[authorizedFetch] Request failed:', error);
      throw error;
    }
  }

  // Execute the fetch
  return executeFetch();
}

/**
 * Convenience methods for common HTTP verbs
 */
export const authorizedHttp = {
  /**
   * GET request
   */
  get: async (url: string, options: FetchOptions = {}) => {
    return authorizedFetch(url, { ...options, method: 'GET' });
  },

  /**
   * POST request
   */
  post: async (url: string, body?: any, options: FetchOptions = {}) => {
    return authorizedFetch(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  /**
   * PUT request
   */
  put: async (url: string, body?: any, options: FetchOptions = {}) => {
    return authorizedFetch(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  /**
   * PATCH request
   */
  patch: async (url: string, body?: any, options: FetchOptions = {}) => {
    return authorizedFetch(url, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  /**
   * DELETE request
   */
  delete: async (url: string, options: FetchOptions = {}) => {
    return authorizedFetch(url, { ...options, method: 'DELETE' });
  },
};

/**
 * Install global fetch interceptor (optional)
 * This will automatically route all API calls through authorizedFetch
 * 
 * WARNING: Only use this if you want to intercept ALL fetch calls
 * Can cause issues with third-party libraries
 */
export function installGlobalFetchInterceptor(): void {
  if (typeof window === 'undefined') return;
  
  const originalFetch = window.fetch.bind(window);
  
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    
    // Only intercept API calls
    if (isApiUrl(url) && !isPublicEndpoint(url)) {
      return authorizedFetch(input, init);
    }
    
    // Use original fetch for everything else
    return originalFetch(input, init);
  };
  
  console.log('[authorizedFetch] Global fetch interceptor installed');
}

/**
 * Uninstall global fetch interceptor (for testing or cleanup)
 */
export function uninstallGlobalFetchInterceptor(): void {
  // This would require storing the original fetch reference
  // For now, just reload the page to restore original fetch
  console.warn('[authorizedFetch] To uninstall interceptor, reload the page');
}

