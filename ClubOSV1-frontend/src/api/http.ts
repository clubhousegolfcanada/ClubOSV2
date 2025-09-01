/* eslint-disable no-restricted-imports */
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
/* eslint-enable no-restricted-imports */
import { tokenManager } from '@/utils/tokenManager';

// API Error type
export interface ApiError extends AxiosError {
  response?: {
    data?: {
      message?: string;
      code?: string;
      success?: boolean;
    };
    status: number;
  };
}

// Get base URL and ensure no double /api
const getBaseUrl = () => {
  /* eslint-disable no-restricted-syntax */
  const raw = process.env.NEXT_PUBLIC_API_URL || '';
  /* eslint-enable no-restricted-syntax */
  const base = raw.replace(/\/+$/, ''); // trim trailing slashes
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

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for 401 handling
client.interceptors.response.use(
  (response) => response,
  (error: ApiError) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      
      // Don't redirect if already on login or if it's an auth endpoint
      if (currentPath !== '/login' && !currentPath.startsWith('/auth/')) {
        // Clear auth and redirect to login
        tokenManager.clearToken();
        localStorage.removeItem('clubos_user');
        localStorage.removeItem('clubos_view_mode');
        
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