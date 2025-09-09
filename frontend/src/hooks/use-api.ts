import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiRequestOptions, ApiError } from '../utils/api-client';
import { useToast } from '../../components/ui/use-toast';

/**
 * Hook for making API requests with React Query integration
 */
export function useApiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions & { enabled?: boolean } = {}
) {
  const { enabled = true, ...requestOptions } = options;
  
  return useQuery({
    queryKey: [endpoint, requestOptions],
    queryFn: async () => {
      const response = await apiClient.request<T>(endpoint, requestOptions);
      return response.data;
    },
    enabled,
    retry: (failureCount, error) => {
      // Don't retry on client errors (4xx) except 408 and 429
      if (error instanceof ApiError) {
        if (error.status >= 400 && error.status < 500 && 
            error.status !== 408 && error.status !== 429) {
          return false;
        }
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook for making API mutations with React Query integration
 */
export function useApiMutation<TData = any, TVariables = any>(
  endpoint: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST',
  options: {
    onSuccess?: (data: TData) => void;
    onError?: (error: ApiError) => void;
    invalidateQueries?: string[];
  } = {}
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { onSuccess, onError, invalidateQueries = [] } = options;

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      const response = await apiClient.request<TData>(endpoint, {
        method,
        body: variables,
      });
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate specified queries
      invalidateQueries.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });
      
      onSuccess?.(data);
    },
    onError: (error: ApiError) => {
      // Show error toast
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      
      onError?.(error);
    },
  });
}

/**
 * Hook for file uploads with progress tracking
 */
export function useFileUpload<T = any>(
  endpoint: string,
  options: {
    onSuccess?: (data: T) => void;
    onError?: (error: ApiError) => void;
    onProgress?: (progress: number) => void;
    invalidateQueries?: string[];
  } = {}
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { onSuccess, onError, onProgress, invalidateQueries = [] } = options;

  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const response = await apiClient.uploadFile<T>(
        endpoint,
        file,
        (progress) => {
          setUploadProgress(progress);
          onProgress?.(progress);
        }
      );

      // Invalidate specified queries
      invalidateQueries.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });

      onSuccess?.(response.data);
      
      toast({
        title: 'Success',
        description: 'File uploaded successfully',
      });

      return response.data;
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(
        'Upload failed',
        0,
        'Upload Error',
        undefined,
        { originalError: error }
      );

      toast({
        title: 'Upload Failed',
        description: apiError.message,
        variant: 'destructive',
      });

      onError?.(apiError);
      throw apiError;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [endpoint, onSuccess, onError, onProgress, invalidateQueries, queryClient, toast]);

  return {
    uploadFile,
    isUploading,
    uploadProgress,
  };
}

/**
 * Hook for handling API errors consistently
 */
export function useApiError() {
  const { toast } = useToast();

  const handleError = useCallback((error: unknown) => {
    let message = 'An unexpected error occurred';
    let title = 'Error';

    if (error instanceof ApiError) {
      message = error.message;
      title = error.status >= 500 ? 'Server Error' : 'Request Error';
    } else if (error instanceof Error) {
      message = error.message;
    }

    toast({
      title,
      description: message,
      variant: 'destructive',
    });
  }, [toast]);

  return { handleError };
}

/**
 * Hook for retrying failed requests
 */
export function useRetryableRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions & { 
    enabled?: boolean;
    retryCount?: number;
    retryDelay?: number;
  } = {}
) {
  const { retryCount = 3, retryDelay = 1000, ...requestOptions } = options;
  const [retryAttempt, setRetryAttempt] = useState(0);

  const query = useQuery({
    queryKey: [endpoint, requestOptions, retryAttempt],
    queryFn: async () => {
      const response = await apiClient.request<T>(endpoint, {
        ...requestOptions,
        retryAttempts: 0, // Disable built-in retry, we'll handle it manually
      });
      return response.data;
    },
    enabled: options.enabled,
    retry: false, // Disable React Query retry
  });

  const retry = useCallback(() => {
    setRetryAttempt(prev => prev + 1);
  }, []);

  return {
    ...query,
    retry,
    canRetry: retryAttempt < retryCount,
    retryAttempt,
  };
}
