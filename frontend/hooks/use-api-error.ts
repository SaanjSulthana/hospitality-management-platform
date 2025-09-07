import { useToast } from '@/components/ui/use-toast';
import { useCallback } from 'react';

interface ApiError {
  message?: string;
  status?: number;
  code?: string;
}

export function useApiError() {
  const { toast } = useToast();

  const handleError = useCallback((error: any, context?: string) => {
    console.error(`API Error${context ? ` in ${context}` : ''}:`, error);

    let errorMessage = 'An unexpected error occurred. Please try again.';
    let errorTitle = 'Error';

    if (error?.message) {
      errorMessage = error.message;
    } else if (error?.status) {
      switch (error.status) {
        case 400:
          errorTitle = 'Bad Request';
          errorMessage = 'The request was invalid. Please check your input and try again.';
          break;
        case 401:
          errorTitle = 'Unauthorized';
          errorMessage = 'You are not authorized to perform this action. Please log in again.';
          break;
        case 403:
          errorTitle = 'Forbidden';
          errorMessage = 'You do not have permission to perform this action.';
          break;
        case 404:
          errorTitle = 'Not Found';
          errorMessage = 'The requested resource was not found.';
          break;
        case 409:
          errorTitle = 'Conflict';
          errorMessage = 'This resource already exists or conflicts with existing data.';
          break;
        case 422:
          errorTitle = 'Validation Error';
          errorMessage = 'Please check your input and try again.';
          break;
        case 429:
          errorTitle = 'Too Many Requests';
          errorMessage = 'You have made too many requests. Please wait a moment and try again.';
          break;
        case 500:
          errorTitle = 'Server Error';
          errorMessage = 'An internal server error occurred. Please try again later.';
          break;
        case 503:
          errorTitle = 'Service Unavailable';
          errorMessage = 'The service is temporarily unavailable. Please try again later.';
          break;
        default:
          errorTitle = 'Error';
          errorMessage = 'An unexpected error occurred. Please try again.';
      }
    } else if (error?.code) {
      switch (error.code) {
        case 'NETWORK_ERROR':
          errorTitle = 'Network Error';
          errorMessage = 'Unable to connect to the server. Please check your internet connection.';
          break;
        case 'TIMEOUT':
          errorTitle = 'Request Timeout';
          errorMessage = 'The request took too long to complete. Please try again.';
          break;
        default:
          errorTitle = 'Error';
          errorMessage = error.message || 'An unexpected error occurred. Please try again.';
      }
    }

    toast({
      variant: 'destructive',
      title: errorTitle,
      description: errorMessage,
    });

    return {
      title: errorTitle,
      message: errorMessage,
      status: error?.status,
      code: error?.code,
    };
  }, [toast]);

  const handleNetworkError = useCallback((context?: string) => {
    return handleError({
      code: 'NETWORK_ERROR',
      message: 'Unable to connect to the server',
    }, context);
  }, [handleError]);

  const handleValidationError = useCallback((errors: Record<string, string[]>, context?: string) => {
    const errorMessage = Object.values(errors)
      .flat()
      .join(', ');
    
    toast({
      variant: 'destructive',
      title: 'Validation Error',
      description: errorMessage || 'Please check your input and try again.',
    });

    return {
      title: 'Validation Error',
      message: errorMessage,
      errors,
    };
  }, [toast]);

  return {
    handleError,
    handleNetworkError,
    handleValidationError,
  };
}
