import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { toast } from 'react-hot-toast';

// Fix for double /api/ issue - ensure base URL doesn't end with /api
let API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
if (API_URL.endsWith('/api')) {
  API_URL = API_URL.slice(0, -4);
}

interface AuthRequestOptions extends Omit<AxiosRequestConfig, 'headers'> {
  showErrorToast?: boolean;
  retryOnAuthError?: boolean;
}

/**
 * Makes an authenticated API request with proper error handling
 * @param url The API endpoint (relative to API_URL)
 * @param options Request options
 * @returns Promise with the response or null if authentication fails
 */
export async function authenticatedRequest<T = any>(
  url: string,
  options: AuthRequestOptions = {}
): Promise<AxiosResponse<T> | null> {
  const { showErrorToast = false, retryOnAuthError = false, ...axiosOptions } = options;
  
  try {
    const token = localStorage.getItem('clubos_token');
    
    // If no token, return null silently (user not logged in)
    if (!token) {
      console.log('No auth token found for request:', url);
      return null;
    }
    
    const response = await axios({
      ...axiosOptions,
      url: `${API_URL}${url}`,
      headers: {
        ...axiosOptions.headers,
        Authorization: `Bearer ${token}`
      }
    });
    
    return response;
  } catch (error: any) {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      console.log('Authentication failed for:', url);
      
      // Clear invalid token
      localStorage.removeItem('clubos_token');
      localStorage.removeItem('clubos_user');
      
      if (showErrorToast) {
        toast.error('Session expired. Please login again.');
      }
      
      // Redirect to login if not already there
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        setTimeout(() => {
          window.location.href = '/login';
        }, 1000);
      }
      
      return null;
    }
    
    // Handle 429 Too Many Requests
    if (error.response?.status === 429) {
      console.log('Rate limit exceeded for:', url);
      
      if (showErrorToast) {
        const retryAfter = error.response.data?.retryAfter;
        const message = retryAfter 
          ? `Too many requests. Please try again in ${Math.ceil((retryAfter - Date.now()) / 1000)} seconds.`
          : 'Too many requests. Please slow down.';
        toast.error(message);
      }
      
      return null;
    }
    
    // Handle other errors
    console.error('API request failed:', url, error);
    
    if (showErrorToast && error.response?.data?.message) {
      toast.error(error.response.data.message);
    }
    
    return null;
  }
}

/**
 * Helper function for GET requests
 */
export async function authenticatedGet<T = any>(
  url: string,
  options?: Omit<AuthRequestOptions, 'method'>
): Promise<T | null> {
  const response = await authenticatedRequest<T>(url, { ...options, method: 'GET' });
  return response?.data || null;
}

/**
 * Helper function for POST requests
 */
export async function authenticatedPost<T = any>(
  url: string,
  data?: any,
  options?: Omit<AuthRequestOptions, 'method' | 'data'>
): Promise<T | null> {
  const response = await authenticatedRequest<T>(url, { ...options, method: 'POST', data });
  return response?.data || null;
}

/**
 * Helper function for PUT requests
 */
export async function authenticatedPut<T = any>(
  url: string,
  data?: any,
  options?: Omit<AuthRequestOptions, 'method' | 'data'>
): Promise<T | null> {
  const response = await authenticatedRequest<T>(url, { ...options, method: 'PUT', data });
  return response?.data || null;
}

/**
 * Helper function for DELETE requests
 */
export async function authenticatedDelete<T = any>(
  url: string,
  options?: Omit<AuthRequestOptions, 'method'>
): Promise<T | null> {
  const response = await authenticatedRequest<T>(url, { ...options, method: 'DELETE' });
  return response?.data || null;
}