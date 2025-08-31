/**
 * Simple API URL configuration
 */

// Get base URL from environment (without /api)
const ENV_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Export the base URL (for non-API endpoints if needed)
export const BASE_URL = ENV_BASE_URL;

// Export the API URL (base URL without /api suffix - let the calls add it)
export const API_URL = ENV_BASE_URL;