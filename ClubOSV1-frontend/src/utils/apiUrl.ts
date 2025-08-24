/**
 * Utility to handle API URL configuration properly
 * Ensures consistent URL handling across the application
 */

// Get base API URL from environment
const ENV_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Get the base API URL (without /api suffix)
 * Used for system endpoints that don't use /api prefix
 */
export function getBaseUrl(): string {
  // Remove /api suffix if present
  if (ENV_API_URL.endsWith('/api')) {
    return ENV_API_URL.slice(0, -4);
  }
  return ENV_API_URL;
}

/**
 * Get the API URL (with /api suffix)
 * Used for standard API endpoints
 */
export function getApiUrl(): string {
  const baseUrl = getBaseUrl();
  // Ensure /api suffix is present
  if (!baseUrl.endsWith('/api')) {
    return `${baseUrl}/api`;
  }
  return baseUrl;
}

/**
 * Build a full API endpoint URL
 * @param endpoint - The endpoint path (e.g., '/users', '/achievements/create-custom')
 * @param useApiPrefix - Whether to include /api prefix (default: true)
 */
export function buildApiUrl(endpoint: string, useApiPrefix = true): string {
  const baseUrl = useApiPrefix ? getApiUrl() : getBaseUrl();
  // Ensure endpoint starts with /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
}

// Export commonly used URLs
export const API_URL = getApiUrl();
export const BASE_URL = getBaseUrl();