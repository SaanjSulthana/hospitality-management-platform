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
  ORGS: ['orgs'] as string[],
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
  refetchInterval?: number | false;
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
  onSuccess?: (data: TData, variables: TVariables, context: unknown) => void;
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
    refetchOnWindowFocus = false,
    refetchOnMount = false,
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
    onSuccess: (data, variables, context) => {
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
      onSuccess?.(data, variables, context);
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
    onSuccess: (data, variables, context) => {
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
      onSuccess?.(data, variables, context);
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
  // Prefix for versioned API
  // Using path-only versioning since we are on api.<domain>
  // Change to '' to fall back to legacy during migration if needed
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __PREFIX: '/v1',

  // Utility to prefix paths
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _p(path: string): string { return `${(API_ENDPOINTS as any).__PREFIX}${path}` },

  // Auth - Authentication & Authorization
  AUTH_LOGIN: '/v1/auth/login',
  AUTH_SIGNUP: '/v1/auth/signup',
  AUTH_LOGOUT: '/v1/auth/logout',
  AUTH_REFRESH: '/v1/auth/refresh',
  AUTH_ME: '/v1/auth/me',
  AUTH_FORGOT_PASSWORD: '/v1/auth/forgot-password',
  AUTH_RESET_PASSWORD: '/v1/auth/reset-password',

  // Properties - CRUD Operations
  PROPERTIES: '/v1/properties',
  PROPERTY_CREATE: '/v1/properties',
  PROPERTY_BY_ID: (id: number) => `/v1/properties/${id}`,
  PROPERTY_UPDATE: (id: number) => `/v1/properties/${id}`,
  PROPERTY_DELETE: (id: number) => `/v1/properties/${id}`,
  PROPERTY_OCCUPANCY: (id: number) => `/v1/properties/${id}/occupancy`,

  // Tasks - All V1 Endpoints ✅ (12/12 = 100%)
  TASKS: '/v1/tasks',
  TASKS_CREATE: '/v1/tasks',
  TASK_BY_ID: (id: number) => `/v1/tasks/${id}`,
  TASK_UPDATE: (id: number) => `/v1/tasks/${id}`,
  TASK_DELETE: (id: number) => `/v1/tasks/${id}`,
  TASK_ASSIGN: (id: number) => `/v1/tasks/${id}/assign`,
  TASK_STATUS: (id: number) => `/v1/tasks/${id}/status`,
  TASK_HOURS: (id: number) => `/v1/tasks/${id}/hours`,
  TASK_ATTACHMENTS: '/v1/tasks/attachments',
  TASK_IMAGES: (taskId: number) => `/v1/tasks/${taskId}/images`,
  TASK_IMAGE_UPLOAD: (taskId: number) => `/v1/tasks/${taskId}/images`,
  TASK_IMAGE_BY_ID: (taskId: number, imageId: number) => `/v1/tasks/${taskId}/images/${imageId}`,
  TASK_IMAGE_DELETE: (taskId: number, imageId: number) => `/v1/tasks/${taskId}/images/${imageId}`,
  TASK_IMAGE_SET_PRIMARY: (taskId: number, imageId: number) => `/v1/tasks/${taskId}/images/${imageId}/primary`,

  // Finance - CRUD Operations
  EXPENSES: '/v1/finance/expenses',
  EXPENSE_BY_ID: (id: number) => `/v1/finance/expenses/${id}`,
  REVENUES: '/v1/finance/revenues',
  REVENUE_BY_ID: (id: number) => `/v1/finance/revenues/${id}`,

  // Finance - Approval Management
  PENDING_APPROVALS: '/v1/finance/pending-approvals',
  GRANT_APPROVAL: '/v1/finance/grant-daily-approval',
  APPROVE_REVENUE: '/v1/finance/revenues/approve',
  APPROVE_EXPENSE: '/v1/finance/expenses/approve',
  DAILY_APPROVAL_STATS: '/v1/finance/daily-approval-stats',
  DAILY_APPROVAL_SUMMARY: '/v1/finance/daily-approval-summary',
  TODAY_PENDING: '/v1/finance/today-pending-transactions',
  BULK_APPROVE: '/v1/finance/bulk-approve',
  CHECK_DAILY_APPROVAL: '/v1/finance/check-daily-approval',
  RESET_APPROVAL_STATUS: '/v1/finance/reset-approval-status',

  // Finance - Realtime & Events
  FINANCE_REALTIME_SUBSCRIBE: '/v1/finance/realtime/subscribe',
  FINANCE_REALTIME_METRICS: '/v1/finance/realtime/metrics',
  FINANCE_EVENTS_SUBSCRIBE: '/v1/finance/events/subscribe',
  FINANCE_EVENT_HISTORY: '/v1/finance/events/history',
  FINANCE_EVENT_METRICS: '/v1/finance/events/metrics',
  FINANCE_EVENT_MONITORING: '/v1/finance/events/monitoring',
  FINANCE_SUMMARY: '/v1/finance/summary',

  // Finance - Bank Integration
  BANK_ACCOUNTS: '/v1/finance/bank-accounts',
  BANK_SYNC: '/v1/finance/bank-sync',
  RECONCILE_TRANSACTION: '/v1/finance/reconcile',

  // Finance - Notifications
  FINANCE_NOTIFICATIONS: '/v1/finance/notifications',
  FINANCE_NOTIFICATIONS_MARK_READ: '/v1/finance/notifications/mark-read',

  // Guest Check-in - CRUD Operations
  GUEST_CHECKINS: '/v1/guest-checkin/list',
  GUEST_CHECKIN_CREATE: '/v1/guest-checkin/create',
  GUEST_CHECKIN_BY_ID: (id: number) => `/v1/guest-checkin/${id}`,
  GUEST_CHECKIN_UPDATE: (id: number) => `/v1/guest-checkin/${id}/update`,
  GUEST_CHECKIN_DELETE: (id: number) => `/v1/guest-checkin/${id}`,

  // Guest Check-in - Management
  GUEST_CHECKIN_CHECKOUT: (id: number) => `/v1/guest-checkin/${id}/checkout`,
  GUEST_CHECKIN_CREATE_WITH_DOCS: '/v1/guest-checkin/create-with-documents',
  GUEST_CHECKIN_GENERATE_C_FORM: (id: number) => `/v1/guest-checkin/${id}/generate-c-form`,
  GUEST_CHECKIN_STATS: '/v1/guest-checkin/stats',

  // Guest Check-in - Documents
  GUEST_DOCUMENT_UPLOAD: '/v1/guest-checkin/documents/upload',
  GUEST_DOCUMENT_LIST: (checkInId: number) => `/v1/guest-checkin/${checkInId}/documents`,
  GUEST_DOCUMENT_DELETE: (documentId: number) => `/v1/guest-checkin/documents/${documentId}`,
  GUEST_DOCUMENT_VERIFY: (documentId: number) => `/v1/guest-checkin/documents/${documentId}/verify`,
  GUEST_DOCUMENT_RETRY_EXTRACTION: (documentId: number) => `/v1/guest-checkin/documents/${documentId}/retry-extraction`,
  GUEST_DOCUMENT_VIEW: (documentId: number) => `/v1/guest-checkin/documents/${documentId}/view`,
  GUEST_DOCUMENT_THUMBNAIL: (documentId: number) => `/v1/guest-checkin/documents/${documentId}/thumbnail`,
  GUEST_DOCUMENT_DOWNLOAD: (documentId: number) => `/v1/guest-checkin/documents/${documentId}/download`,
  GUEST_DOCUMENT_STATS: '/v1/guest-checkin/documents/stats',
  GUEST_DOCUMENT_EXTRACT_ONLY: '/v1/guest-checkin/documents/extract-only',

  // Guest Check-in - Audit
  GUEST_AUDIT_LOG_VIEW_DOCUMENTS: '/v1/guest-checkin/audit/view-documents',
  GUEST_AUDIT_LOG_VIEW_DETAILS: '/v1/guest-checkin/audit/view-guest-details',
  GUEST_AUDIT_LOGS: '/v1/guest-checkin/audit-logs',
  GUEST_AUDIT_LOG_DETAIL: (logId: number) => `/v1/guest-checkin/audit-logs/${logId}`,
  GUEST_AUDIT_SUMMARY: '/v1/guest-checkin/audit-logs/summary',
  GUEST_AUDIT_EXPORT: '/v1/guest-checkin/audit-logs/export',

  // Guest Check-in - Real-time Events
  GUEST_EVENTS_SUBSCRIBE: '/v1/guest-checkin/events/subscribe',
  GUEST_EVENTS_REALTIME_SUBSCRIBE: '/v1/guest-checkin/realtime/subscribe',
  GUEST_EVENTS_METRICS: '/v1/guest-checkin/events/metrics',
  GUEST_AUDIT_EVENTS_SUBSCRIBE: '/v1/guest-checkin/audit-events/subscribe',
  GUEST_AUDIT_EVENTS_SUBSCRIBE_SIMPLE: '/v1/guest-checkin/audit-events/subscribe-simple',

  // Staff - Core Management
  STAFF: '/v1/staff',
  STAFF_CREATE: '/v1/staff',
  STAFF_BY_ID: (id: number) => `/v1/staff/${id}`,
  STAFF_UPDATE: '/v1/staff/update',
  STAFF_UPDATE_SIMPLE: '/v1/staff/update-simple',
  STAFF_DELETE: (id: number) => `/v1/staff/${id}`,
  STAFF_SEARCH: '/v1/staff/search',
  STAFF_BY_USER: (userId: number) => `/v1/staff/user/${userId}`,
  STAFF_BY_PROPERTY: (propertyId: number) => `/v1/staff/property/${propertyId}`,
  STAFF_BY_DEPARTMENT: '/v1/staff/department',

  // Staff - Attendance
  STAFF_ATTENDANCE: '/v1/staff/attendance',
  STAFF_ATTENDANCE_CREATE: '/v1/staff/attendance/create',
  STAFF_ATTENDANCE_UPDATE: (id: number) => `/v1/staff/attendance/${id}`,
  STAFF_ATTENDANCE_DELETE: (id: number) => `/v1/staff/attendance/${id}`,
  STAFF_ATTENDANCE_BY_STAFF: (staffId: number) => `/v1/staff/${staffId}/attendance`,
  STAFF_ATTENDANCE_MARK: '/v1/staff/attendance/mark',
  STAFF_ATTENDANCE_BULK_MARK: '/v1/staff/attendance/bulk-mark',

  // Staff - Leave Requests
  LEAVE_REQUESTS: '/v1/staff/leave-requests',
  LEAVE_REQUEST_CREATE: '/v1/staff/leave-requests/create',
  LEAVE_REQUEST_BY_ID: (id: number) => `/v1/staff/leave-requests/${id}`,
  LEAVE_REQUEST_UPDATE: (id: number) => `/v1/staff/leave-requests/${id}`,
  LEAVE_REQUEST_DELETE: (id: number) => `/v1/staff/leave-requests/${id}`,
  LEAVE_REQUEST_APPROVE: (id: number) => `/v1/staff/leave-requests/${id}/approve`,
  LEAVE_REQUEST_REJECT: (id: number) => `/v1/staff/leave-requests/${id}/reject`,
  LEAVE_REQUEST_CANCEL: (id: number) => `/v1/staff/leave-requests/${id}/cancel`,
  LEAVE_REQUEST_BY_STAFF: (staffId: number) => `/v1/staff/${staffId}/leave-requests`,

  // Staff - Schedules
  STAFF_SCHEDULES: '/v1/staff/schedules',
  STAFF_SCHEDULE_CREATE: '/v1/staff/schedules/create',
  STAFF_SCHEDULE_BY_ID: (id: number) => `/v1/staff/schedules/${id}`,
  STAFF_SCHEDULE_UPDATE: (id: number) => `/v1/staff/schedules/${id}`,
  STAFF_SCHEDULE_DELETE: (id: number) => `/v1/staff/schedules/${id}`,
  STAFF_SCHEDULE_BY_STAFF: (staffId: number) => `/v1/staff/${staffId}/schedules`,
  STAFF_SCHEDULE_BULK_CREATE: '/v1/staff/schedules/bulk-create',
  STAFF_SCHEDULE_COPY: '/v1/staff/schedules/copy',

  // Staff - Schedule Change Requests
  SCHEDULE_CHANGE_REQUESTS: '/v1/staff/schedule-change-requests',
  SCHEDULE_CHANGE_REQUEST_CREATE: '/v1/staff/schedule-change-requests/create',
  SCHEDULE_CHANGE_REQUEST_APPROVE: (id: number) => `/v1/staff/schedule-change-requests/${id}/approve`,
  SCHEDULE_CHANGE_REQUEST_REJECT: (id: number) => `/v1/staff/schedule-change-requests/${id}/reject`,

  // Staff - Payslips & Salary
  STAFF_PAYSLIPS: '/v1/staff/payslips',
  STAFF_PAYSLIP_CREATE: '/v1/staff/payslips/create',
  STAFF_PAYSLIP_BY_ID: (id: number) => `/v1/staff/payslips/${id}`,
  STAFF_PAYSLIP_UPDATE: (id: number) => `/v1/staff/payslips/${id}`,
  STAFF_PAYSLIP_DELETE: (id: number) => `/v1/staff/payslips/${id}`,
  STAFF_PAYSLIP_BY_STAFF: (staffId: number) => `/v1/staff/${staffId}/payslips`,
  STAFF_PAYSLIP_GENERATE: '/v1/staff/payslips/generate',
  STAFF_SALARY_CALCULATION: '/v1/staff/salary/calculate',

  // Staff - Performance
  STAFF_PERFORMANCE_REVIEWS: '/v1/staff/performance-reviews',
  STAFF_PERFORMANCE_REVIEW_CREATE: '/v1/staff/performance-reviews/create',
  STAFF_PERFORMANCE_REVIEW_BY_ID: (id: number) => `/v1/staff/performance-reviews/${id}`,
  STAFF_PERFORMANCE_REVIEW_UPDATE: (id: number) => `/v1/staff/performance-reviews/${id}`,

  // Staff - Statistics
  STAFF_STATISTICS: '/v1/staff/statistics',
  STAFF_ATTENDANCE_STATISTICS: '/v1/staff/attendance/statistics',
  STAFF_LEAVE_STATISTICS: '/v1/staff/leave/statistics',
  STAFF_SCHEDULE_STATISTICS: '/v1/staff/schedules/statistics',
  STAFF_SALARY_STATISTICS: '/v1/staff/salary/statistics',

  // Staff - Validation
  STAFF_LEAVE_VALIDATE: '/v1/staff/leave/validate',
  STAFF_SCHEDULE_VALIDATE: '/v1/staff/schedules/validate',

  // Organizations - All V1 Endpoints ✅ (2/2 = 100%)
  ORGS_CREATE: '/v1/orgs',
  ORGS_INVITE: '/v1/orgs/invite',

  // Uploads
  UPLOAD: '/v1/uploads/upload',
  FILE_BY_ID: (id: number) => `/v1/uploads/file/${id}`,
  FILE_INFO: (id: number) => `/v1/uploads/file/${id}/info`,

  // Branding - All V1 Endpoints ✅ (5/5 = 100%)
  BRANDING_THEME: '/v1/branding/theme',
  BRANDING_THEME_UPDATE: '/v1/branding/theme',
  BRANDING_THEME_CLEANUP: '/v1/branding/cleanup-theme',
  BRANDING_LOGO_UPLOAD: '/v1/branding/logo',
  BRANDING_LOGO_SERVE: (orgId: string, filename: string) => `/v1/branding/logo/${orgId}/${filename}`,

  // Documents - All V1 Endpoints ✅ (6/6 = 100%)
  DOCUMENTS_CREATE_EXPORT: '/v1/documents/exports/create',
  DOCUMENTS_LIST_EXPORTS: '/v1/documents/exports',
  DOCUMENTS_EXPORT_STATUS: (exportId: string) => `/v1/documents/exports/${exportId}/status`,
  DOCUMENTS_EXPORT_DOWNLOAD: (exportId: string) => `/v1/documents/exports/${exportId}/download`,
  DOCUMENTS_EXPORT_DELETE: (exportId: string) => `/v1/documents/exports/${exportId}`,
  DOCUMENTS_EXPORT_RETRY: (exportId: string) => `/v1/documents/exports/${exportId}/retry`,

  // Analytics - All V1 Endpoints ✅ (1/1 = 100%)
  ANALYTICS_OVERVIEW: '/v1/analytics/overview',

  // Uploads - All V1 Endpoints ✅ (8/8 = 100%)
  UPLOAD_FILE: '/v1/uploads/file',
  UPLOAD_FILE_UPDATE: (fileId: number) => `/v1/uploads/file/${fileId}`,
  UPLOAD_FILE_DELETE: (fileId: number) => `/v1/uploads/file/${fileId}`,
  UPLOAD_FILE_DOWNLOAD: (fileId: number) => `/v1/uploads/${fileId}/download`,
  UPLOAD_FILE_INFO: (fileId: number) => `/v1/uploads/${fileId}/info`,
  UPLOAD_TASK_IMAGE: (imageId: number) => `/v1/uploads/tasks/${imageId}`,
  UPLOADS_CHECK_FILES_TABLE: '/v1/uploads/check-files-table',
  UPLOADS_CLEANUP_ORPHANED: '/v1/uploads/cleanup-orphaned',

  // Reports - Daily Reports
  REPORTS: '/v1/reports',
  REPORTS_DAILY_REPORT: '/v1/reports/daily-report',
  REPORTS_DAILY_REPORTS_LIST: '/v1/reports/daily-reports',
  REPORTS_MONTHLY_REPORT: '/v1/reports/monthly-report',

  // Reports - Cash Balance Management
  REPORTS_UPDATE_CASH_BALANCE_SMART: '/v1/reports/update-daily-cash-balance-smart',
  REPORTS_UPDATE_CASH_BALANCE: '/v1/reports/update-daily-cash-balance',
  REPORTS_RECONCILE_CASH_BALANCE: '/v1/reports/reconcile-daily-cash-balance',

  // Reports - Monthly/Yearly Summary
  REPORTS_MONTHLY_YEARLY: '/v1/reports/monthly-yearly-report',
  REPORTS_MONTHLY_SUMMARY: '/v1/reports/monthly-summary',
  REPORTS_YEARLY_SUMMARY: '/v1/reports/yearly-summary',
  REPORTS_QUARTERLY_SUMMARY: '/v1/reports/quarterly-summary',

  // Reports - Export Functions
  EXPORT_PDF: '/v1/reports/export-daily-pdf',
  EXPORT_EXCEL: '/v1/reports/export-daily-excel',
  EXPORT_MONTHLY_PDF: '/v1/reports/export-monthly-pdf',
  EXPORT_MONTHLY_EXCEL: '/v1/reports/export-monthly-excel',
  REPORTS_GENERATE_PDF: '/v1/reports/generate-pdf',

  // Reports - Real-time Updates
  REPORTS_REALTIME_POLL: '/v1/reports/realtime/poll',

  // Reports - Cache & Audit Utilities
  REPORTS_CACHE_METRICS: '/v1/reports/cache/metrics',
  REPORTS_CACHE_CLEAR: '/v1/reports/cache/clear',
  REPORTS_AUDIT_BALANCES: '/v1/reports/audit-balances',
  REPORTS_DATE_TRANSACTIONS: '/v1/reports/date-transactions',

  // Cache - System Cache Management
  CACHE_WARM_HIGH_TRAFFIC: '/v1/system/cache/warm-high-traffic',
  CACHE_WARM_SPECIFIC_ORG: '/v1/system/cache/warm-specific-org',
  CACHE_COLLECT_STATS: '/v1/system/cache/collect-stats',
  CACHE_STATUS: '/v1/system/cache/status',
  CACHE_METRICS: '/v1/system/cache/metrics',

  // Communication Gateway - Service Communication & Health
  GATEWAY_ROUTE: '/v1/system/gateway/route',
  GATEWAY_SERVICE_HEALTH: (service: string) => `/v1/system/gateway/health/${service}`,
  GATEWAY_ALL_SERVICES_HEALTH: '/v1/system/gateway/health',
  GATEWAY_STATUS: '/v1/system/gateway/status',
  GATEWAY_RESET_CIRCUIT_BREAKER: '/v1/system/gateway/reset-circuit-breaker',

  // Config - System Configuration & Health
  CONFIG_HEALTH: '/v1/system/config/health',
  CONFIG_VALIDATE: '/v1/system/config/validate',
  CONFIG_ENVIRONMENT: '/v1/system/config/environment',
  CONFIG_TEST_DATABASE: '/v1/system/config/test-database',

  // Cron - Scheduled Job Management
  CRON_CLEANUP_ORPHANED_DOCUMENTS: '/v1/system/cron/cleanup-orphaned-documents',
  CRON_CLEANUP_STATS: '/v1/system/cron/cleanup-stats',
  CRON_CREATE_NEXT_MONTH_PARTITIONS: '/v1/system/cron/partitions/create-next-month',
  CRON_CLEANUP_OLD_PARTITIONS: '/v1/system/cron/partitions/cleanup',
  CRON_DAILY_CONSISTENCY_CHECK: '/v1/system/cron/daily-consistency-check',
  CRON_TASK_REMINDERS: '/v1/system/cron/task-reminders',
  CRON_NIGHT_AUDIT: '/v1/system/cron/night-audit',
  CRON_OTA_SYNC: '/v1/system/cron/ota-sync',

  // Database - Replica & Connection Pool Monitoring
  DATABASE_REPLICA_STATUS: '/v1/system/database/replicas/status',
  DATABASE_REPLICA_HEALTH: '/v1/system/database/replicas/health',
  DATABASE_REPLICA_LAG: '/v1/system/database/replicas/lag',
  DATABASE_CONNECTION_POOL_STATS: '/v1/system/database/connection-pool/stats',

  // Monitoring - System Monitoring & Metrics
  MONITORING_ACTIVE_ALERTS: '/v1/system/monitoring/alerts/active',
  MONITORING_ALERT_HISTORY: '/v1/system/monitoring/alerts/history',
  MONITORING_ACKNOWLEDGE_ALERT: (alertId: number) => `/v1/system/monitoring/alerts/${alertId}/acknowledge`,
  MONITORING_CLEAR_ALERT: (alertId: number) => `/v1/system/monitoring/alerts/${alertId}/clear`,
  MONITORING_ALERT_STATS: '/v1/system/monitoring/alerts/stats',
  MONITORING_ALL_METRICS: '/v1/system/monitoring/metrics/all',
  MONITORING_METRIC_HISTORY: '/v1/system/monitoring/metrics/history',
  MONITORING_AGGREGATED_METRICS: '/v1/system/monitoring/metrics/aggregated',
  MONITORING_UNIFIED_METRICS: '/v1/system/monitoring/unified-metrics',
  MONITORING_SYSTEM_HEALTH: '/v1/system/monitoring/system-health',
  MONITORING_HEALTH_DASHBOARD: '/v1/system/monitoring/health-dashboard',
  MONITORING_HEALTH: '/v1/system/monitoring/health',
  MONITORING_READINESS: '/v1/system/monitoring/readiness',
  MONITORING_LIVENESS: '/v1/system/monitoring/liveness',
  MONITORING_PARTITION_MIGRATE: '/v1/system/monitoring/partitions/migrate',
  MONITORING_PARTITION_VERIFY: '/v1/system/monitoring/partitions/verify',
  MONITORING_PARTITION_METRICS: '/v1/system/monitoring/partitions/metrics',
  MONITORING_PARTITION_TABLE_STATS: '/v1/system/monitoring/partitions/table-stats',
  MONITORING_CACHE_INVALIDATION_METRICS: '/v1/system/monitoring/cache/invalidation-metrics',
  MONITORING_CACHE_RESET_METRICS: '/v1/system/monitoring/cache/reset-metrics',
  MONITORING_CACHE_KEY_STATS: '/v1/system/monitoring/cache/key-stats',

  // Telemetry - Client Telemetry Collection
  TELEMETRY_INGEST_CLIENT: '/v1/system/telemetry/client',

  // Validation - Data Consistency Validation & Repair
  VALIDATION_CHECK_CONSISTENCY: '/v1/system/validation/check-consistency',
  VALIDATION_AUTO_REPAIR: '/v1/system/validation/auto-repair',
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
