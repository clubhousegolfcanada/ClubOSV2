import { useAuthState } from '@/state/useStore';
import toast from 'react-hot-toast';
import { sessionExpiryManager } from './sessionExpiryManager';
import logger from '@/services/logger';
import { clearAllAuthData } from './authClearingUtils';

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
   * Comprehensive auth clearing - removes ALL auth-related data atomically
   * This prevents any race conditions or stale data issues
   */
  clearAllAuth(): void {
    if (typeof window === 'undefined') return;

    logger.info('TokenManager: Clearing all auth data');

    // Stop token monitoring first
    this.stopTokenMonitoring();

    // Use consolidated auth clearing utility
    clearAllAuthData();

    // Reset all internal flags
    this.interceptorSetup = false;
    this.isHandlingExpiration = false;

    logger.info('TokenManager: All auth data cleared');
  }

  /**
   * Atomic token update - prevents race conditions
   * This ensures there's no gap between clearing and setting the token
   */
  updateToken(token: string | null): void {
    if (typeof window === 'undefined') return;

    if (token) {
      // Set new token FIRST
      localStorage.setItem('clubos_token', token);
      // Then start monitoring AFTER token is set
      this.startTokenMonitoring();
    } else {
      // Stop monitoring FIRST
      this.stopTokenMonitoring();
      // Then remove token
      localStorage.removeItem('clubos_token');
    }
  }

  /**
   * Detect if running on mobile device
   */
  private isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }

  /**
   * Get appropriate check interval based on token expiry time
   * Simplified 3-tier system - backend handles proactive refresh at 70%/50%
   * Frontend just needs to catch truly expired tokens
   */
  private getCheckInterval(token: string): number {
    const timeUntilExpiry = this.getTimeUntilExpiration(token);
    const isMobile = this.isMobileDevice();

    // Simple 3-tier system (mobile gets slightly more aggressive checks)
    if (timeUntilExpiry > 24 * 60 * 60 * 1000) { // > 1 day
      return isMobile ? 30 * 60 * 1000 : 60 * 60 * 1000; // 30min / 1hr
    } else if (timeUntilExpiry > 2 * 60 * 60 * 1000) { // > 2 hours
      return isMobile ? 10 * 60 * 1000 : 15 * 60 * 1000; // 10min / 15min
    } else {
      return 5 * 60 * 1000; // 5min for everyone when close to expiry
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

      // Check if token is expired (grace period is now checked inside isTokenExpired)
      if (this.isTokenExpired(currentToken)) {
        // Token is truly expired (grace period already checked)
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

}

// Export singleton instance
export const tokenManager = TokenManager.getInstance();