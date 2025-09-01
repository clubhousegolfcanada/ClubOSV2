import { ApiError } from '@/api/http';
/* eslint-disable no-restricted-imports */
import { AxiosError } from 'axios';
/* eslint-enable no-restricted-imports */

/**
 * Type guard to check if an error is an API error
 */
export function isApiError(error: unknown): error is ApiError {
  return !!(
    error &&
    typeof error === 'object' &&
    'response' in error &&
    'config' in error &&
    'isAxiosError' in error
  );
}

/**
 * Type guard to check if an error is an AxiosError
 */
export function isAxiosError(error: unknown): error is AxiosError {
  return !!(
    error &&
    typeof error === 'object' &&
    'isAxiosError' in error &&
    (error as any).isAxiosError === true
  );
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  // Check for API error with custom message
  if (isApiError(error)) {
    // Priority order for message sources
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.response?.data?.error) {
      return error.response.data.error as string;
    }
    
    // HTTP status messages
    if (error.response?.status) {
      switch (error.response.status) {
        case 400:
          return 'Bad request. Please check your input.';
        case 401:
          return 'Authentication failed. Please login again.';
        case 403:
          return 'You do not have permission to perform this action.';
        case 404:
          return 'The requested resource was not found.';
        case 429:
          return 'Too many requests. Please try again later.';
        case 500:
          return 'Server error. Please try again later.';
        case 502:
        case 503:
        case 504:
          return 'Service temporarily unavailable. Please try again later.';
        default:
          return `Request failed with status ${error.response.status}`;
      }
    }
    
    // Network errors
    if (error.code === 'ECONNABORTED') {
      return 'Request timeout. Please try again.';
    }
    if (error.code === 'ERR_NETWORK') {
      return 'Network error. Please check your connection.';
    }
  }
  
  // Standard Error object
  if (error instanceof Error) {
    return error.message;
  }
  
  // String error
  if (typeof error === 'string') {
    return error;
  }
  
  // Unknown error
  return 'An unexpected error occurred';
}

/**
 * Get error code if available
 */
export function getErrorCode(error: unknown): string | undefined {
  if (isApiError(error)) {
    return error.response?.data?.code;
  }
  return undefined;
}

/**
 * Check if error is a specific status code
 */
export function isErrorStatus(error: unknown, status: number): boolean {
  if (isApiError(error)) {
    return error.response?.status === status;
  }
  return false;
}

/**
 * Check if error is an authentication error (401)
 */
export function isAuthError(error: unknown): boolean {
  return isErrorStatus(error, 401);
}

/**
 * Check if error is a permission error (403)
 */
export function isPermissionError(error: unknown): boolean {
  return isErrorStatus(error, 403);
}

/**
 * Check if error is a not found error (404)
 */
export function isNotFoundError(error: unknown): boolean {
  return isErrorStatus(error, 404);
}

/**
 * Check if error is a rate limit error (429)
 */
export function isRateLimitError(error: unknown): boolean {
  return isErrorStatus(error, 429);
}

/**
 * Check if error is a server error (5xx)
 */
export function isServerError(error: unknown): boolean {
  if (isApiError(error) && error.response?.status) {
    return error.response.status >= 500 && error.response.status < 600;
  }
  return false;
}

/**
 * Check if error is a validation error (usually 400 with specific structure)
 */
export function isValidationError(error: unknown): boolean {
  if (isApiError(error) && error.response?.status === 400) {
    const data = error.response.data;
    return !!(data && (data.code === 'VALIDATION_ERROR' || data.errors));
  }
  return false;
}

/**
 * Get validation errors from API response
 */
export function getValidationErrors(error: unknown): Record<string, string[]> | null {
  if (isValidationError(error) && isApiError(error)) {
    const errors = error.response?.data?.errors;
    if (errors && typeof errors === 'object') {
      return errors as Record<string, string[]>;
    }
  }
  return null;
}