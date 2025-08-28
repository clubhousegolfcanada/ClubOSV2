import axios from "axios";
import type { UserRequest, ApiResponse } from "@/types/request";
import { addCSRFToRequest } from "@/utils/csrf";
import logger from "@/services/logger";

// Fix for double /api/ issue - ensure base URL doesn't end with /api
let API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// Remove /api from the end if it exists
if (API_URL.endsWith('/api')) {
  API_URL = API_URL.slice(0, -4);
}

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 60000, // Increased to 60 seconds for assistant responses
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies with requests
});

// Export the axios instance for use in other API modules
export default apiClient;

// Add auth token and CSRF token to requests
apiClient.interceptors.request.use(
  (config) => {
    // Fix double /api/api/ issue
    if (config.url) {
      config.url = config.url.replace(/\/api\/api\//g, '/api/');
      
      // Ensure /api prefix is present
      if (!config.url.startsWith('/api') && !config.url.startsWith('http')) {
        config.url = '/api' + config.url;
      }
    }
    
    // Debug logging removed for security
    
    // Only access localStorage and cookies on client side
    if (typeof window !== 'undefined') {
      // Add auth token
      const token = localStorage.getItem('clubos_token');
      // Security: Never log tokens
      
      if (token) {
        // Ensure headers object exists
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
        // Auth header added successfully
      } else {
        // No auth token available
      }
      
      // Add CSRF token for non-GET requests
      if (config.method && ['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
        const csrfHeaders = addCSRFToRequest({});
        Object.entries(csrfHeaders).forEach(([key, value]) => {
          if (config.headers && typeof value === 'string') {
            config.headers[key] = value;
          }
        });
        // CSRF token added
      }
    }
    
    return config;
  },
  (error) => {
    console.error('[Axios Interceptor] Request error:', error);
    return Promise.reject(error);
  }
);

export const submitRequest = async (request: UserRequest): Promise<ApiResponse> => {
  const clientStartTime = Date.now(); // Track when request starts on client
  
  try {
    // Always use the LLM endpoint - it handles both smart assist and Slack routing
    const endpoint = '/api/llm/request';
    
    // REMOVED: Sending user info in request body is a security risk
    // User info should only come from authenticated JWT token
    
    const payload = {
      requestDescription: request.requestDescription,
      location: request.location,
      routePreference: request.routePreference || "Auto",
      smartAssistEnabled: request.smartAssistEnabled, // This determines if it goes to LLM or Slack
      clientStartTime // Include client start time
      // REMOVED: user field - authentication via JWT only
    };
    
    // Request submission - logging removed for security
    
    const response = await apiClient.post(endpoint, payload);
    
    // Calculate total end-to-end time
    const totalProcessingTime = Date.now() - clientStartTime;
    
    // Override the processingTime with total end-to-end time
    if (response.data.data) {
      response.data.data.serverProcessingTime = response.data.data.processingTime; // Keep server time
      response.data.data.processingTime = totalProcessingTime; // Use total time
    }
    
    // Performance metrics available in response.data.data.processingTime
    
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error('API Request failed:', error);
    
    if (axios.isAxiosError(error)) {
      console.error('Axios error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL
        }
      });
      
      // Check for specific error types
      if (error.code === 'ERR_NETWORK') {
        return {
          success: false,
          error: 'Network error: Unable to connect to the server. Please ensure the backend is running on port 3001.',
        };
      }
      
      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: 'Connection refused: The backend server is not running or not accessible.',
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Request failed',
      };
    }
    
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
};
