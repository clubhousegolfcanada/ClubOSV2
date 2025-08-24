import { useAuthState } from '@/state/useStore';
import toast from 'react-hot-toast';
import { sessionExpiryManager } from './sessionExpiryManager';

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
      console.error('Failed to decode token:', error);
      return null;
    }
  }

  /**
   * Check if token is expired or about to expire
   */
  isTokenExpired(token: string): boolean {
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
   * Get appropriate check interval based on token expiry time
   */
  private getCheckInterval(token: string): number {
    const timeUntilExpiry = this.getTimeUntilExpiration(token);
    const role = this.getUserRole(token);
    
    // For short sessions (4-8 hours), check more frequently
    if (timeUntilExpiry <= 8 * 60 * 60 * 1000) { // 8 hours or less
      // Check every 15 minutes for short sessions
      return 15 * 60 * 1000; // 15 minutes
    } else if (timeUntilExpiry <= 24 * 60 * 60 * 1000) { // 24 hours or less
      // Check every 30 minutes for medium sessions
      return 30 * 60 * 1000; // 30 minutes
    } else {
      // Check every 2 hours for long sessions (Remember Me)
      return 2 * 60 * 60 * 1000; // 2 hours
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

    const token = localStorage.getItem('clubos_token');
    if (!token) return;

    // Get appropriate check interval based on token
    const checkInterval = this.getCheckInterval(token);

    // Don't check immediately on start - the token was just validated by login
    this.checkInterval = setInterval(() => {
      const currentToken = localStorage.getItem('clubos_token');
      
      if (currentToken && this.isTokenExpired(currentToken)) {
        this.handleTokenExpiration();
      } else if (currentToken) {
        // Adjust check interval if token was refreshed
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
    
    // Clear any cached token data
    if (typeof window !== 'undefined') {
      // Remove any token from axios default headers if set
      import('axios').then(({ default: axios }) => {
        delete axios.defaults.headers.common['Authorization'];
      });
    }
  }

  /**
   * Handle token expiration
   */
  private handleTokenExpiration(): void {
    // Check if we're already on the login page
    if (typeof window !== 'undefined' && window.location.pathname === '/login') {
      return; // Don't do anything if already on login page
    }
    
    // Check if we should show notification (singleton pattern)
    if (!sessionExpiryManager.shouldShowNotification()) {
      return; // Already handling or already shown
    }
    
    // Mark that we're handling expiry
    sessionExpiryManager.markNotificationShown();
    
    // Get the logout function from the auth store
    const { logout } = useAuthState.getState();
    
    // Stop monitoring to prevent multiple calls
    this.stopTokenMonitoring();
    
    // Show notification only once
    toast.error('Your session has expired. Please log in again.');
    
    // Call the proper logout function
    logout();
    
    // Use Next.js router for navigation
    if (typeof window !== 'undefined') {
      // Import router dynamically to avoid SSR issues
      import('next/router').then(({ default: router }) => {
        router.push('/login');
      });
    }
  }

  /**
   * Set up axios interceptor to handle new tokens from backend
   */
  setupAxiosInterceptor(): void {
    if (typeof window === 'undefined') return;
    
    // Skip if already setup
    if (this.interceptorSetup) return;
    
    // Skip interceptor setup on login page
    if (window.location.pathname === '/login') return;
    
    this.interceptorSetup = true;
    
    // Import axios dynamically to avoid SSR issues
    import('axios').then(({ default: axios }) => {
      // Clear any existing interceptors first
      axios.interceptors.response.eject(0);
      
      axios.interceptors.response.use(
        (response) => {
          // Check for new token in response headers
          const newToken = response.headers['x-new-token'];
          if (newToken) {
            // Update stored token
            localStorage.setItem('clubos_token', newToken);
            
            // Update auth state
            const storedUser = localStorage.getItem('clubos_user');
            if (storedUser) {
              try {
                const user = JSON.parse(storedUser);
                const { setUser } = useAuthState.getState();
                setUser({ ...user, token: newToken });
              } catch (error) {
                console.error('Failed to update auth state with new token:', error);
              }
            }
          }
          return response;
        },
        (error) => {
          // Handle 401 errors (but not on login page or during login)
          if (error.response?.status === 401) {
            const isLoginPage = window.location.pathname === '/login';
            const isAuthEndpoint = error.config?.url?.includes('/auth/');
            
            // Check if we just logged in (within last 5 seconds)
            const loginTimestamp = sessionStorage.getItem('clubos_login_timestamp');
            const recentlyLoggedIn = loginTimestamp && 
              (Date.now() - parseInt(loginTimestamp) < 5000);
            
            // Check if already handling session expiry (via singleton)
            const isAlreadyHandling = sessionExpiryManager.isHandling();
            
            // Don't handle as expired if:
            // 1. We're on the login page
            // 2. This is an auth endpoint
            // 3. We just logged in (grace period)
            // 4. Token exists and is not expired
            // 5. Already handling session expiry
            const token = localStorage.getItem('clubos_token');
            const tokenValid = token && !this.isTokenExpired(token);
            
            if (!isLoginPage && !isAuthEndpoint && !recentlyLoggedIn && !tokenValid && !isAlreadyHandling) {
              this.handleTokenExpiration();
            }
          }
          return Promise.reject(error);
        }
      );
    });
  }
}

// Export singleton instance
export const tokenManager = TokenManager.getInstance();