import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/ui/use-toast';
import { apiClient, ApiRequestOptions, ApiError } from './api-client';
import { API_CONFIG, ERROR_MESSAGES } from '../config/api';

/**
 * Standardized API call patterns and utilities
 */

// Standard query key patterns
export const QUERY_KEYS = {
  PROPERTIES: ['properties'] as string[],
  TASKS: ['tasks'] as string[],
  EXPENSES: ['expenses'] as string[],
  REVENUES: ['revenues'] as string[],
  STAFF: ['staff'] as string[],
  PENDING_APPROVALS: ['pending-approvals'] as string[],
  DAILY_APPROVAL_CHECK: ['daily-approval-check'] as string[],
  ANALYTICS: ['analytics'] as string[],
  DASHBOARD: ['dashboard'] as string[],
  LEAVE_REQUESTS: ['leave-requests'] as string[],
  PROFIT_LOSS: ['profit-loss'] as string[],
  USERS: ['users'] as string[],
  ORGANIZATIONS: ['organizations'] as string[],
  BRANDING: ['branding'] as string[],
  REPORTS: ['reports'] as string[],
};

// Standard refetch intervals
export const REFETCH_INTERVALS = {
  REAL_TIME: 3000, // 3 seconds
  FREQUENT: 5000, // 5 seconds
  NORMAL: 30000, // 30 seconds
  SLOW: 60000, // 1 minute
} as const;

// Standard stale times
export const STALE_TIMES = {
  REAL_TIME: 0, // Always stale
  FREQUENT: 5000, // 5 seconds
  NORMAL: 10000, // 10 seconds
  SLOW: 30000, // 30 seconds
} as const;

// Standard cache times
export const CACHE_TIMES = {
  REAL_TIME: 0, // No cache
  FREQUENT: 5 * 60 * 1000, // 5 minutes
  NORMAL: 10 * 60 * 1000, // 10 minutes
  SLOW: 30 * 60 * 1000, // 30 minutes
} as const;

// Standard retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  RETRY_CONDITION: (failureCount: number, error: any) => {
    // Don't retry on client errors (4xx) except 408 and 429
    if (error instanceof ApiError) {
      if (error.status >= 400 && error.status < 500 && 
          error.status !== 408 && error.status !== 429) {
        return false;
      }
    }
    return failureCount < 3;
  },
} as const;

// Standard error handling
export const ERROR_HANDLERS = {
  NETWORK_ERROR: (error: any) => ({
    type: 'NETWORK_ERROR',
    message: ERROR_MESSAGES.NETWORK_ERROR,
    retryable: true,
  }),
  UPLOAD_ERROR: (error: any) => ({
    type: 'UPLOAD_FAILED',
    message: ERROR_MESSAGES.UPLOAD_FAILED,
    retryable: true,
  }),
  VALIDATION_ERROR: (error: any) => ({
    type: 'VALIDATION_ERROR',
    message: 'Invalid input. Please check your data and try again.',
    retryable: false,
  }),
  SERVER_ERROR: (error: any) => ({
    type: 'SERVER_ERROR',
    message: ERROR_MESSAGES.SERVER_ERROR,
    retryable: true,
  }),
  UNAUTHORIZED: (error: any) => ({
    type: 'UNAUTHORIZED',
    message: ERROR_MESSAGES.UNAUTHORIZED,
    retryable: false,
  }),
} as const;

/**
 * Standardized query options
 */
export interface StandardQueryOptions {
  enabled?: boolean;
  refetchInterval?: number;
  staleTime?: number;
  gcTime?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnMount?: boolean;
  retry?: boolean | ((failureCount: number, error: any) => boolean);
  retryDelay?: number | ((attemptIndex: number) => number);
}

/**
 * Standardized mutation options
 */
export interface StandardMutationOptions<TData = any, TVariables = any> {
  onSuccess?: (data: TData) => void;
  onError?: (error: ApiError) => void;
  invalidateQueries?: string[][];
  refetchQueries?: string[][];
  showToast?: boolean;
  successMessage?: string;
  errorMessage?: string;
}

/**
 * Standardized API query hook
 */
export function useStandardQuery<T = any>(
  queryKey: string[],
  endpoint: string,
  options: StandardQueryOptions & ApiRequestOptions = {}
) {
  const {
    enabled = true,
    refetchInterval,
    staleTime,
    gcTime,
    refetchOnWindowFocus = true,
    refetchOnMount = true,
    retry = RETRY_CONFIG.RETRY_CONDITION,
    retryDelay = RETRY_CONFIG.RETRY_DELAY,
    ...requestOptions
  } = options;

  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await apiClient.request<T>(endpoint, requestOptions);
      return response.data;
    },
    enabled,
    refetchInterval,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
    refetchOnMount,
    retry,
    retryDelay,
  });
}

/**
 * Standardized API mutation hook
 */
export function useStandardMutation<TData = any, TVariables = any>(
  endpoint: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST',
  options: StandardMutationOptions<TData, TVariables> = {}
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    onSuccess,
    onError,
    invalidateQueries = [],
    refetchQueries = [],
    showToast = true,
    successMessage,
    errorMessage,
  } = options;

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      // Handle dynamic endpoints with ID replacement
      let finalEndpoint = endpoint;
      if (variables && typeof variables === 'object' && 'id' in variables) {
        finalEndpoint = endpoint.replace(':id', (variables as any).id);
        // Remove id from body if it's in the URL
        const { id, ...bodyWithoutId } = variables as any;
        variables = bodyWithoutId as TVariables;
      }
      
      const response = await apiClient.request<TData>(finalEndpoint, {
        method,
        body: variables,
        ...options,
      });
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate specified queries
      invalidateQueries.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });

      // Refetch specified queries
      refetchQueries.forEach(queryKey => {
        queryClient.refetchQueries({ queryKey });
      });

      // Show success toast
      if (showToast && successMessage) {
        toast({
          title: "Success",
          description: successMessage,
        });
      }

      // Call custom success handler
      onSuccess?.(data);
    },
    onError: (error: ApiError) => {
      // Show error toast
      if (showToast) {
        toast({
          variant: "destructive",
          title: "Error",
          description: errorMessage || error.message || "An error occurred",
        });
      }

      // Call custom error handler
      onError?.(error);
    },
  });
}

/**
 * Standardized file upload hook
 */
export function useStandardFileUpload(
  endpoint: string,
  options: StandardMutationOptions = {}
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    onSuccess,
    onError,
    invalidateQueries = [],
    showToast = true,
    successMessage = "File uploaded successfully",
    errorMessage,
  } = options;

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiClient.request(endpoint, {
        method: 'POST',
        body: formData,
      });
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate specified queries
      invalidateQueries.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });

      // Show success toast
      if (showToast) {
        toast({
          title: "Success",
          description: successMessage,
        });
      }

      // Call custom success handler
      onSuccess?.(data);
    },
    onError: (error: ApiError) => {
      // Show error toast
      if (showToast) {
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: errorMessage || error.message || "Failed to upload file",
        });
      }

      // Call custom error handler
      onError?.(error);
    },
  });
}

/**
 * Standardized error handler
 */
export function handleStandardError(error: any, context?: string): void {
  console.error(`Error in ${context || 'API call'}:`, error);

  let errorInfo;
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        errorInfo = ERROR_HANDLERS.VALIDATION_ERROR(error);
        break;
      case 401:
        errorInfo = ERROR_HANDLERS.UNAUTHORIZED(error);
        break;
      case 500:
        errorInfo = ERROR_HANDLERS.SERVER_ERROR(error);
        break;
      default:
        errorInfo = ERROR_HANDLERS.NETWORK_ERROR(error);
    }
  } else {
    errorInfo = ERROR_HANDLERS.NETWORK_ERROR(error);
  }

  // Log error for debugging
  console.error('Error details:', {
    type: errorInfo.type,
    message: errorInfo.message,
    retryable: errorInfo.retryable,
    originalError: error,
  });
}

/**
 * Standardized cache invalidation
 */
export function invalidateStandardQueries(
  queryClient: any,
  queryKeys: string[][]
): void {
  queryKeys.forEach(queryKey => {
    queryClient.invalidateQueries({ queryKey });
  });
}

/**
 * Standardized cache refetch
 */
export function refetchStandardQueries(
  queryClient: any,
  queryKeys: string[][]
): void {
  queryKeys.forEach(queryKey => {
    queryClient.refetchQueries({ queryKey });
  });
}

/**
 * Standardized data transformation utilities
 */
export const DataTransformers = {
  formatDateForAPI: (date: Date): string => date.toISOString().split('T')[0],
  
  formatCurrency: (amount: number): string => `$${(amount / 100).toFixed(2)}`,
  
  formatFileSize: (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  },
  
  sanitizeInput: (input: string): string => input.trim().replace(/[<>]/g, ''),
  
  validateEmail: (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  
  validatePhone: (phone: string): boolean => /^\+?[\d\s-()]+$/.test(phone),
  
  validateRequired: (value: any): boolean => 
    value !== null && value !== undefined && value !== '',
  
  validateNumber: (value: any): boolean => 
    !isNaN(Number(value)) && Number(value) > 0,
};

/**
 * Standardized file validation utilities
 */
export const FileValidators = {
  validateFileType: (file: File, allowedTypes: string[]): boolean => {
    return allowedTypes.includes(file.type);
  },
  
  validateFileSize: (file: File, maxSize: number): boolean => {
    return file.size <= maxSize;
  },
  
  validateFileCount: (files: File[], maxCount: number): boolean => {
    return files.length <= maxCount;
  },
  
  validateImageFile: (file: File): boolean => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    return FileValidators.validateFileType(file, allowedTypes);
  },
  
  validateDocumentFile: (file: File): boolean => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    return FileValidators.validateFileType(file, allowedTypes);
  },
};

/**
 * Standardized performance utilities
 */
export const PerformanceUtils = {
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): ((...args: Parameters<T>) => void) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  },
  
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): ((...args: Parameters<T>) => void) => {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      }
    };
  },
};

/**
 * Standardized API endpoint patterns
 */
export const API_ENDPOINTS = {
  // Properties
  PROPERTIES: '/properties',
  PROPERTY_BY_ID: (id: number) => `/properties/${id}`,
  
  // Tasks
  TASKS: '/tasks',
  TASK_BY_ID: (id: number) => `/tasks/${id}`,
  TASK_IMAGES: (id: number) => `/tasks/${id}/images`,
  
  // Finance
  EXPENSES: '/expenses',
  EXPENSE_BY_ID: (id: number) => `/expenses/${id}`,
  REVENUES: '/revenues',
  REVENUE_BY_ID: (id: number) => `/revenues/${id}`,
  PENDING_APPROVALS: '/finance/pending-approvals',
  GRANT_APPROVAL: '/finance/grant-daily-approval',
  
  // Staff
  STAFF: '/staff',
  STAFF_BY_ID: (id: number) => `/staff/${id}`,
  LEAVE_REQUESTS: '/staff/leave-requests',
  
  // Uploads
  UPLOAD: '/uploads/upload',
  FILE_BY_ID: (id: number) => `/uploads/file/${id}`,
  FILE_INFO: (id: number) => `/uploads/file/${id}/info`,
  
  // Branding
  BRANDING: '/branding',
  LOGO: '/branding/logo',
  
  // Reports
  REPORTS: '/reports',
  EXPORT_PDF: '/reports/export-daily-pdf',
  EXPORT_EXCEL: '/reports/export-daily-excel',
} as const;

/**
 * Standardized query configurations for common use cases
 */
export const STANDARD_QUERY_CONFIGS = {
  // Real-time data (frequent updates)
  REAL_TIME: {
    refetchInterval: REFETCH_INTERVALS.REAL_TIME,
    staleTime: STALE_TIMES.REAL_TIME,
    gcTime: CACHE_TIMES.REAL_TIME,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  },
  
  // Frequent updates (every 5 seconds)
  FREQUENT: {
    refetchInterval: REFETCH_INTERVALS.FREQUENT,
    staleTime: STALE_TIMES.FREQUENT,
    gcTime: CACHE_TIMES.FREQUENT,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  },
  
  // Normal updates (every 30 seconds)
  NORMAL: {
    refetchInterval: REFETCH_INTERVALS.NORMAL,
    staleTime: STALE_TIMES.NORMAL,
    gcTime: CACHE_TIMES.NORMAL,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  },
  
  // Slow updates (every minute)
  SLOW: {
    refetchInterval: REFETCH_INTERVALS.SLOW,
    staleTime: STALE_TIMES.SLOW,
    gcTime: CACHE_TIMES.SLOW,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  },
  
  // Static data (no automatic refetch)
  STATIC: {
    refetchInterval: false,
    staleTime: STALE_TIMES.SLOW,
    gcTime: CACHE_TIMES.SLOW,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  },
} as const;
