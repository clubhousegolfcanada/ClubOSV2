/* eslint-disable no-restricted-imports */
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
/* eslint-enable no-restricted-imports */
import { tokenManager } from '@/utils/tokenManager';
import { addCSRFToRequest } from '@/utils/csrf';
import logger from '@/services/logger';

// API Error type - using type instead of interface for proper extension
export type ApiError = AxiosError<{
  message?: string;
  code?: string;
  success?: boolean;
  error?: string;
  errors?: Record<string, string[]>;
}>;

// Get base URL and ensure no double /api
const getBaseUrl = () => {
  /* eslint-disable no-restricted-syntax */
  const raw = process.env.NEXT_PUBLIC_API_URL || '';
  /* eslint-enable no-restricted-syntax */
  
  // Remove trailing slashes
  let base = raw.replace(/\/+$/, '');
  
  // CRITICAL FIX: Remove /api if it's already at the end of the URL
  // This handles cases where Vercel env has the URL with /api already
  if (base.endsWith('/api')) {
    base = base.slice(0, -4);
    // Only log in development with debug flag
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_API === 'true') {
      logger.debug('[HTTP Client] Removed /api suffix from base URL');
    }
  }
  
  return base;
};

// Create axios instance
const client = axios.create({
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor for URL resolution and auth
client.interceptors.request.use(
  (config) => {
    // Handle URL resolution
    if (config.url && !/^https?:\/\//i.test(config.url)) {
      // Prevent double /api prefix
      if (config.url.startsWith('/api/')) {
        throw new Error(`Do not include '/api' in request path: '${config.url}'`);
      }
      
      // Ensure path starts with /
      const path = config.url.startsWith('/') ? config.url : `/${config.url}`;
      config.url = `${getBaseUrl()}/api${path}`;
    }

    // Add auth token unless explicitly disabled
    const skipAuth = (config as any).auth === false;
    if (!skipAuth && typeof window !== 'undefined') {
      const token = tokenManager.getToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    // Add CSRF token for state-changing requests (POST, PUT, PATCH, DELETE)
    if (typeof window !== 'undefined' && 
        config.method && 
        ['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
      const csrfHeaders = addCSRFToRequest({});
      Object.entries(csrfHeaders).forEach(([key, value]) => {
        if (config.headers && typeof value === 'string') {
          config.headers[key] = value;
        }
      });
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for 401 handling and token refresh
client.interceptors.response.use(
  (response) => {
    // Handle new token from backend (auto-refresh)
    const newToken = response.headers['x-new-token'];
    if (newToken) {
      tokenManager.setToken(newToken);

      logger.debug('Token auto-refreshed from backend', {
        endpoint: response.config.url
      });
    }

    return response;
  },
  (error: ApiError) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      const requestUrl = error.config?.url || '';

      // List of non-critical endpoints that shouldn't trigger logout
      const nonCriticalEndpoints = [
        '/api/ninjaone/',
        '/ninjaone/',
        '/api/system/check',
        '/system/check',
        '/api/door-access/',
        '/door-access/',
        '/api/remote-actions/',
        '/remote-actions/',
        '/api/performance',
        '/performance',
        '/api/devices',
        '/devices',
        '/api/scripts',
        '/scripts',
        '/api/status/',
        '/status/'
      ];

      // Check if this is a non-critical endpoint
      const isNonCritical = nonCriticalEndpoints.some(endpoint =>
        requestUrl.includes(endpoint)
      );

      // Don't logout for non-critical endpoints - just let them fail gracefully
      if (isNonCritical) {
        return Promise.reject(error);
      }

      // Don't redirect if already on login or if it's an auth endpoint
      if (currentPath !== '/login' && !currentPath.startsWith('/auth/')) {
        // Clear auth and redirect to login
        tokenManager.clearToken();
        localStorage.removeItem('clubos_user');
        localStorage.removeItem('clubos_view_mode');
        localStorage.removeItem('remoteActionsExpanded'); // Clear RemoteActionsBar state

        // Only redirect once, prevent loops
        if (!sessionStorage.getItem('redirecting_to_login')) {
          sessionStorage.setItem('redirecting_to_login', 'true');
          window.location.href = '/login';
        }
      }
    }

    // Clear redirect flag on successful auth
    if (error.response?.status !== 401) {
      sessionStorage.removeItem('redirecting_to_login');
    }

    return Promise.reject(error);
  }
);

// Export convenience methods
export const get = <T = any>(url: string, config?: AxiosRequestConfig) => 
  client.get<T>(url, config);

export const post = <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
  client.post<T>(url, data, config);

export const put = <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
  client.put<T>(url, data, config);

export const patch = <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
  client.patch<T>(url, data, config);

export const del = <T = any>(url: string, config?: AxiosRequestConfig) => 
  client.delete<T>(url, config);

// Export the client for advanced usage
export const http = client;

// Default export for backward compatibility
export default client;