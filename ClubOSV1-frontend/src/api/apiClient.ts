import axios from "axios";
import type { UserRequest, ApiResponse } from "@/types/request";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 60000, // Increased to 60 seconds for assistant responses
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use(
  (config) => {
    console.log('[Axios Interceptor] Processing request to:', config.url);
    const token = localStorage.getItem('clubos_token');
    console.log('[Axios Interceptor] Token found:', !!token);
    console.log('[Axios Interceptor] Token value:', token ? token.substring(0, 20) + '...' : 'null');
    
    if (token) {
      // Ensure headers object exists
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
      console.log('[Axios Interceptor] Added auth header:', config.headers.Authorization?.substring(0, 30) + '...');
      console.log('[Axios Interceptor] Full config headers:', config.headers);
    } else {
      console.log('[Axios Interceptor] No token found, request will be sent without auth');
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
    const endpoint = request.smartAssistEnabled ? '/llm/request' : '/slack/message';
    
    const payload = request.smartAssistEnabled 
      ? {
          requestDescription: request.requestDescription,
          location: request.location,
          routePreference: request.routePreference || "Auto",
          smartAssistEnabled: request.smartAssistEnabled, // Add this field
          clientStartTime // Include client start time
        }
      : {
          requestDescription: request.requestDescription,
          location: request.location,
          clientStartTime // Include client start time
        };
    
    console.log('Submitting request to:', `${API_URL}${endpoint}`);
    console.log('Payload:', payload);
    console.log('SmartAssist enabled:', request.smartAssistEnabled);
    
    const response = await apiClient.post(endpoint, payload);
    
    // Calculate total end-to-end time
    const totalProcessingTime = Date.now() - clientStartTime;
    
    // Override the processingTime with total end-to-end time
    if (response.data.data) {
      response.data.data.serverProcessingTime = response.data.data.processingTime; // Keep server time
      response.data.data.processingTime = totalProcessingTime; // Use total time
    }
    
    console.log('Request timing:', {
      totalTime: totalProcessingTime,
      serverTime: response.data.data?.serverProcessingTime,
      networkOverhead: totalProcessingTime - (response.data.data?.serverProcessingTime || 0)
    });
    
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
