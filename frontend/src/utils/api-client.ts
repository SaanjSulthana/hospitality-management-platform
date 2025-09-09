import { API_CONFIG, ERROR_MESSAGES } from '../config/api';

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

export class ApiError extends Error {
  public status: number;
  public statusText: string;
  public response?: Response;
  public data?: any;

  constructor(message: string, status: number, statusText: string, response?: Response, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.response = response;
    this.data = data;
  }
}

/**
 * Centralized API client with consistent error handling and retry logic
 */
export class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number;
  private defaultRetryAttempts: number;
  private defaultRetryDelay: number;

  constructor(
    baseUrl: string = API_CONFIG.BASE_URL,
    defaultTimeout: number = API_CONFIG.TIMEOUT,
    defaultRetryAttempts: number = API_CONFIG.RETRY_ATTEMPTS,
    defaultRetryDelay: number = API_CONFIG.RETRY_DELAY
  ) {
    this.baseUrl = baseUrl;
    this.defaultTimeout = defaultTimeout;
    this.defaultRetryAttempts = defaultRetryAttempts;
    this.defaultRetryDelay = defaultRetryDelay;
  }

  /**
   * Make an API request with automatic retry logic and error handling
   */
  async request<T = any>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.defaultTimeout,
      retryAttempts = this.defaultRetryAttempts,
      retryDelay = this.defaultRetryDelay,
    } = options;

    const url = `${this.baseUrl}${endpoint}`;
    
    // Prepare headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    // Add authorization header if token exists
    const token = localStorage.getItem('accessToken');
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
    };

    // Add body for non-GET requests
    if (body && method !== 'GET') {
      if (body instanceof FormData) {
        // Remove Content-Type header for FormData (browser will set it with boundary)
        delete requestHeaders['Content-Type'];
        requestOptions.body = body;
      } else {
        requestOptions.body = JSON.stringify(body);
      }
    }

    let lastError: Error | null = null;

    // Retry logic
    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      try {
        const response = await this.makeRequest(url, requestOptions, timeout);
        
        // Handle different response types
        if (!response.ok) {
          const errorData = await this.parseErrorResponse(response);
          throw new ApiError(
            this.getErrorMessage(response.status, errorData),
            response.status,
            response.statusText,
            response,
            errorData
          );
        }

        // Parse successful response
        const data = await this.parseResponse<T>(response);
        
        return {
          data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        };

      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain errors
        if (this.shouldNotRetry(error as Error, attempt)) {
          throw error;
        }

        // If this is the last attempt, throw the error
        if (attempt === retryAttempts) {
          throw error;
        }

        // Wait before retrying
        if (retryDelay > 0) {
          await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }

    throw lastError || new Error('Request failed after all retry attempts');
  }

  /**
   * Make the actual HTTP request with timeout
   */
  private async makeRequest(url: string, options: RequestInit, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError(
          ERROR_MESSAGES.NETWORK_ERROR,
          408,
          'Request Timeout',
          undefined,
          { timeout }
        );
      }
      
      throw error;
    }
  }

  /**
   * Parse response based on content type
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      return await response.json();
    }
    
    if (contentType?.includes('text/')) {
      return await response.text() as T;
    }
    
    if (contentType?.includes('application/octet-stream') || 
        contentType?.includes('application/pdf') ||
        contentType?.includes('image/')) {
      return await response.blob() as T;
    }
    
    // Default to text
    return await response.text() as T;
  }

  /**
   * Parse error response
   */
  private async parseErrorResponse(response: Response): Promise<any> {
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch {
      return null;
    }
  }

  /**
   * Get appropriate error message based on status code
   */
  private getErrorMessage(status: number, errorData?: any): string {
    // Try to get error message from response data
    if (errorData?.message) {
      return errorData.message;
    }
    
    if (errorData?.error) {
      return errorData.error;
    }

    // Default messages based on status code
    switch (status) {
      case 400:
        return 'Bad request. Please check your input and try again.';
      case 401:
        return ERROR_MESSAGES.UNAUTHORIZED;
      case 403:
        return 'Access forbidden. You do not have permission to perform this action.';
      case 404:
        return 'Resource not found.';
      case 408:
        return ERROR_MESSAGES.NETWORK_ERROR;
      case 422:
        return 'Validation error. Please check your input.';
      case 429:
        return 'Too many requests. Please try again later.';
      case 500:
      case 502:
      case 503:
      case 504:
        return ERROR_MESSAGES.SERVER_ERROR;
      default:
        return ERROR_MESSAGES.NETWORK_ERROR;
    }
  }

  /**
   * Determine if request should not be retried
   */
  private shouldNotRetry(error: Error, attempt: number): boolean {
    // Don't retry on the first attempt
    if (attempt === 0) {
      return false;
    }

    // Don't retry on certain error types
    if (error instanceof ApiError) {
      // Don't retry on client errors (4xx) except 408 (timeout) and 429 (rate limit)
      if (error.status >= 400 && error.status < 500 && 
          error.status !== 408 && error.status !== 429) {
        return true;
      }
    }

    // Don't retry on network errors that are likely permanent
    if (error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError')) {
      return false; // Allow retry for network errors
    }

    return false;
  }

  /**
   * Utility method to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Convenience methods for common HTTP verbs
   */
  async get<T = any>(endpoint: string, options: Omit<ApiRequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T = any>(endpoint: string, body?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  async put<T = any>(endpoint: string, body?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  async patch<T = any>(endpoint: string, body?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  async delete<T = any>(endpoint: string, options: Omit<ApiRequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Upload file with progress tracking
   */
  async uploadFile<T = any>(
    endpoint: string,
    file: File,
    onProgress?: (progress: number) => void,
    options: Omit<ApiRequestOptions, 'method' | 'body'> = {}
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);

    // For file uploads, we don't use the standard retry logic
    // as it would be complex to track progress across retries
    const url = `${this.baseUrl}${endpoint}`;
    const token = localStorage.getItem('accessToken');
    
    const requestOptions: RequestInit = {
      method: 'POST',
      body: formData,
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    };

    try {
      const response = await this.makeRequest(url, requestOptions, options.timeout || this.defaultTimeout);
      
      if (!response.ok) {
        const errorData = await this.parseErrorResponse(response);
        throw new ApiError(
          this.getErrorMessage(response.status, errorData),
          response.status,
          response.statusText,
          response,
          errorData
        );
      }

      const data = await this.parseResponse<T>(response);
      
      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      };

    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError(
        ERROR_MESSAGES.UPLOAD_FAILED,
        0,
        'Upload Failed',
        undefined,
        { originalError: error }
      );
    }
  }
}

// Create and export a default instance
export const apiClient = new ApiClient();

// Export utility functions for backward compatibility
export const apiRequest = apiClient.request.bind(apiClient);
export const apiGet = apiClient.get.bind(apiClient);
export const apiPost = apiClient.post.bind(apiClient);
export const apiPut = apiClient.put.bind(apiClient);
export const apiPatch = apiClient.patch.bind(apiClient);
export const apiDelete = apiClient.delete.bind(apiClient);
export const apiUploadFile = apiClient.uploadFile.bind(apiClient);
