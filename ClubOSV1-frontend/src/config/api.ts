/**
 * Centralized API Configuration
 * Single source of truth for all API-related settings
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

export const API_CONFIG = {
  // Base URL - automatically handles local vs production
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 
           (isLocalhost ? 'http://localhost:3001' : 'https://api.clubos.io'),
  
  // Timeout settings
  timeout: 30000, // 30 seconds
  
  // Default headers
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  
  // Retry configuration
  retry: {
    maxAttempts: 3,
    delay: 1000, // milliseconds
    backoff: 2, // exponential backoff multiplier
  },
  
  // Feature flags
  features: {
    enableLogging: isDevelopment,
    enableRetry: true,
    enableCache: true,
  }
};

/**
 * Get full API endpoint URL
 */
export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_CONFIG.baseUrl}${cleanEndpoint}`;
}

/**
 * Get headers with authentication token
 */
export function getAuthHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = { ...API_CONFIG.headers };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

/**
 * API endpoints registry
 */
export const API_ENDPOINTS = {
  // Auth
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    verify: '/auth/verify',
    register: '/auth/register',
  },
  
  // Customer
  customer: {
    profile: '/customer/profile',
    challenges: '/customer/challenges',
    leaderboard: '/customer/leaderboard',
    compete: '/customer/compete',
    clubcoins: '/customer/clubcoins',
  },
  
  // Messages
  messages: {
    list: '/messages',
    send: '/messages/send',
    conversations: '/messages/conversations',
  },
  
  // Operations
  operations: {
    dashboard: '/operations/dashboard',
    analytics: '/operations/analytics',
    users: '/operations/users',
  },
  
  // Integrations
  integrations: {
    trackman: '/integrations/trackman',
    unifi: '/integrations/unifi',
    openphone: '/integrations/openphone',
  },
};