import { http } from '@/api/http';
import type { UserRequest, ApiResponse } from '@/types/request';

/**
 * Submit a request to the LLM endpoint
 * This handles both smart assist and Slack routing based on the request configuration
 */
export const submitRequest = async (request: UserRequest): Promise<ApiResponse> => {
  const clientStartTime = Date.now(); // Track when request starts on client
  
  try {
    // Always use the LLM endpoint - it handles both smart assist and Slack routing
    const endpoint = 'llm/request';
    
    // Build payload - user info comes from JWT token, not request body
    const payload = {
      requestDescription: request.requestDescription,
      location: request.location,
      routePreference: request.routePreference || "Auto",
      smartAssistEnabled: request.smartAssistEnabled, // This determines if it goes to LLM or Slack
      clientStartTime // Include client start time
      // User authentication is handled via JWT token in headers
    };
    
    // Submit request using the http client (with CSRF protection now!)
    const response = await http.post<ApiResponse>(endpoint, payload);
    
    // Calculate total end-to-end time
    const totalProcessingTime = Date.now() - clientStartTime;
    
    // Override the processingTime with total end-to-end time
    if (response.data.data) {
      response.data.data.serverProcessingTime = response.data.data.processingTime; // Keep server time
      response.data.data.processingTime = totalProcessingTime; // Use total time
    }
    
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error: any) {
    // Use centralized error logging
    if (process.env.NODE_ENV === 'development') {
      console.error('[LLM API] Request failed:', error);
    }
    
    // Extract error message
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error || 
                        error.message || 
                        'Failed to submit request';
    
    // Check for specific error codes
    if (error.response?.status === 429) {
      const retryAfter = error.response.data?.retryAfter;
      return {
        success: false,
        error: retryAfter 
          ? `Rate limit exceeded. Please try again in ${Math.ceil((retryAfter - Date.now()) / 1000)} seconds.`
          : 'Too many requests. Please try again later.'
      };
    }
    
    if (error.response?.status === 401) {
      return {
        success: false,
        error: 'Authentication failed. Please login again.'
      };
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};