import { useAuthState } from '@/state/useStore';
import toast from 'react-hot-toast';
import { sessionExpiryManager } from './sessionExpiryManager';
import logger from '@/services/logger';

interface DecodedToken {
  exp: number;
  iat: number;
  userId: string;
  email: string;
  role: string;
}

export class TokenManager {
  private static instance: TokenManager;
  private checkInterval: NodeJS.Timeout | null = null;
  private interceptorSetup: boolean = false;
  private isHandlingExpiration: boolean = false;
  
  private constructor() {}
  
  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Decode JWT token without verification (for reading expiration)
   */
  private decodeToken(token: string): DecodedToken | null {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      logger.error('Failed to decode token:', error);
      return null;
    }
  }

  /**
   * Validate token format (JWT structure check)
   */
  isValidTokenFormat(token: string): boolean {
    if (!token) return false;
    
    // Check for JWT format (header.payload.signature)
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    
    // Check for bearer token format (shouldn't be stored with Bearer prefix)
    if (token.startsWith('Bearer ')) {
      logger.warn('Token stored with Bearer prefix - this should be stripped');
      token = token.replace('Bearer ', '');
    }
    
    return jwtRegex.test(token);
  }

  /**
   * Check if token is expired or about to expire
   */
  isTokenExpired(token: string): boolean {
    if (!this.isValidTokenFormat(token)) return true;
    
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    
    // Check if expired (no buffer - was causing premature expiration)
    const now = Date.now() / 1000;
    return decoded.exp < now;
  }

  /**
   * Get time until token expiration in milliseconds
   */
  getTimeUntilExpiration(token: string): number {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return 0;
    
    const now = Date.now() / 1000;
    const timeLeft = (decoded.exp - now) * 1000;
    return Math.max(0, timeLeft);
  }

  /**
   * Get user role from token
   */
  getUserRole(token: string): string | null {
    const decoded = this.decodeToken(token);
    return decoded?.role || null;
  }

  /**
   * Get token from localStorage
   */
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('clubos_token');
  }

  /**
   * Set token in localStorage
   */
  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('clubos_token', token);
  }

  /**
   * Clear token from localStorage
   */
  clearToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('clubos_token');
  }

  /**
   * Get appropriate check interval based on token expiry time
   * Enhanced for operator-friendly PWA experience
   */
  private getCheckInterval(token: string): number {
    const timeUntilExpiry = this.getTimeUntilExpiration(token);
    const role = this.getUserRole(token);

    // Operators get more frequent checks for seamless experience
    if (role === 'operator' || role === 'admin') {
      if (timeUntilExpiry > 7 * 24 * 60 * 60 * 1000) { // > 7 days
        return 2 * 60 * 60 * 1000; // Check every 2 hours
      } else if (timeUntilExpiry > 24 * 60 * 60 * 1000) { // > 1 day
        return 30 * 60 * 1000; // Check every 30 minutes
      } else {
        return 5 * 60 * 1000; // Check every 5 minutes when close to expiry
      }
    }

    // Other roles with standard intervals
    if (timeUntilExpiry <= 8 * 60 * 60 * 1000) { // 8 hours or less
      return 15 * 60 * 1000; // 15 minutes
    } else if (timeUntilExpiry <= 24 * 60 * 60 * 1000) { // 24 hours or less
      return 30 * 60 * 1000; // 30 minutes
    } else if (timeUntilExpiry <= 7 * 24 * 60 * 60 * 1000) { // 7 days or less
      return 2 * 60 * 60 * 1000; // 2 hours
    } else {
      return 4 * 60 * 60 * 1000; // 4 hours for very long tokens
    }
  }

  /**
   * Start monitoring token expiration
   */
  startTokenMonitoring(): void {
    // Clear any existing interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    const token = this.getToken();
    if (!token) return;

    // Get appropriate check interval based on token
    const checkInterval = this.getCheckInterval(token);

    // Don't check immediately on start - the token was just validated by login
    this.checkInterval = setInterval(() => {
      const currentToken = this.getToken();

      // If no token, stop monitoring
      if (!currentToken) {
        this.stopTokenMonitoring();
        return;
      }

      // Check if token is expired
      if (this.isTokenExpired(currentToken)) {
        // Check for grace period before handling expiration
        const loginTimestamp = sessionStorage.getItem('clubos_login_timestamp');
        const gracePeriod = 5 * 60 * 1000; // 5 minutes

        if (loginTimestamp) {
          const timeSinceLogin = Date.now() - parseInt(loginTimestamp);
          if (timeSinceLogin < gracePeriod) {
            // Still in grace period, don't expire yet
            logger.debug('Token expired but within grace period, continuing');
            return;
          }
        }

        // Grace period exceeded or no timestamp, handle expiration
        this.handleTokenExpiration();
      } else {
        // Token still valid, check if interval needs adjustment
        const newInterval = this.getCheckInterval(currentToken);
        if (newInterval !== checkInterval) {
          // Restart monitoring with new interval
          this.startTokenMonitoring();
        }
      }
    }, checkInterval);
  }

  /**
   * Stop monitoring token expiration
   */
  stopTokenMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    // Reset interceptor flag so it can be set up again if needed
    this.interceptorSetup = false;
  }

  /**
   * Clear all token references and reset state
   */
  clearAllTokens(): void {
    // Stop monitoring
    this.stopTokenMonitoring();
    
    // Reset all flags
    this.interceptorSetup = false;
    this.isHandlingExpiration = false;
    
    // Clear any cached token data
    if (typeof window !== 'undefined') {
      // Auth header cleanup now handled by http client
    }
  }

  /**
   * Handle token expiration
   */
  private handleTokenExpiration(): void {
    // Prevent multiple simultaneous handlers
    if (this.isHandlingExpiration) {
      return;
    }
    
    // Check if we're already on the login page
    if (typeof window !== 'undefined' && window.location.pathname === '/login') {
      return; // Don't do anything if already on login page
    }
    
    // Check if we should show notification (singleton pattern)
    if (!sessionExpiryManager.shouldShowNotification()) {
      return; // Already handling or already shown
    }
    
    // Set flag to prevent multiple handlers
    this.isHandlingExpiration = true;
    
    // Mark that we're handling expiry
    sessionExpiryManager.markNotificationShown();
    
    // Get the logout function from the auth store
    const { logout } = useAuthState.getState();
    
    // Stop monitoring to prevent multiple calls
    this.stopTokenMonitoring();
    
    // Clear the token immediately to stop API calls
    this.clearToken();
    localStorage.removeItem('clubos_user');
    
    // Show notification only once
    toast.error('Your session has expired. Please log in again.');
    
    // Call the proper logout function
    logout();
    
    // Use Next.js router for navigation
    if (typeof window !== 'undefined') {
      // Import router dynamically to avoid SSR issues
      import('next/router').then(({ default: router }) => {
        router.push('/login').then(() => {
          // Reset flag after navigation completes
          this.isHandlingExpiration = false;
          // Reset session expiry manager
          sessionExpiryManager.reset();
        });
      });
    }
  }

  /**
   * Set up response interceptor to handle new tokens from backend
   * Note: This is now handled by the http client
   */
  setupAxiosInterceptor(): void {
    // This functionality is now handled by the http client
    // Keeping method for backwards compatibility
    return;
  }
}

// Export singleton instance
export const tokenManager = TokenManager.getInstance();