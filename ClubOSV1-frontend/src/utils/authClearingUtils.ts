import logger from '@/services/logger';

/**
 * Consolidated auth clearing utility
 * Single source of truth for clearing all authentication data
 */

// Define the auth-related localStorage keys in one place
const AUTH_STORAGE_KEYS = [
  'clubos_token',
  'clubos_user',
  'clubos_view_mode',
  'clubos-auth', // Zustand persistence key
  'clubos-settings', // Zustand settings persistence
  'remoteActionsExpanded' // UI state
] as const;

/**
 * Endpoints that should NOT trigger logout on 401
 * These are non-critical features where auth failure can be handled gracefully
 * Centralized here to prevent drift between components
 */
export const NON_CRITICAL_AUTH_ENDPOINTS = [
  '/ninjaone/',
  '/system/check',
  '/door-access/',
  '/remote-actions/',
  '/performance',
  '/devices',
  '/scripts',
  '/status/'
] as const;

/**
 * Clear all authentication-related data from browser storage
 * This is the single consolidated method for auth clearing
 */
export function clearAllAuthData(): void {
  // Clear localStorage keys
  AUTH_STORAGE_KEYS.forEach(key => {
    localStorage.removeItem(key);
    logger.debug(`Cleared localStorage: ${key}`);
  });

  // Clear ALL sessionStorage
  sessionStorage.clear();

  logger.info('All authentication data cleared');
}

/**
 * Get list of auth storage keys (for debugging/testing)
 */
export function getAuthStorageKeys(): readonly string[] {
  return AUTH_STORAGE_KEYS;
}