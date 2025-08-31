/**
 * Simple API URL configuration
 * FIXED: API_URL now includes /api to prevent double /api/api/ issue
 */

// Get base URL from environment (without /api)
const ENV_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Export the base URL (for non-API endpoints if needed)
export const BASE_URL = ENV_BASE_URL;

// Export the API URL WITH /api suffix - all calls expect this to include /api
export const API_URL = ENV_BASE_URL + '/api';
