import { useAuthState } from '@/state/useStore';
import toast from 'react-hot-toast';

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
    
    // Check if expired (with 30 second buffer)
    const now = Date.now() / 1000;
    return decoded.exp < now + 30;
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
   * Start monitoring token expiration
   */
  startTokenMonitoring(): void {
    // Clear any existing interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Don't check immediately on start - the token was just validated by login
    // Start checking after 30 seconds
    this.checkInterval = setInterval(() => {
      const token = localStorage.getItem('clubos_token');
      
      if (token && this.isTokenExpired(token)) {
        this.handleTokenExpiration();
      }
    }, 30000);
  }

  /**
   * Stop monitoring token expiration
   */
  stopTokenMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Handle token expiration
   */
  private handleTokenExpiration(): void {
    // Get the logout function from the auth store
    const { logout } = useAuthState.getState();
    
    // Call the proper logout function
    logout();
    
    // Show notification
    toast.error('Your session has expired. Please log in again.');
    
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
    
    // Import axios dynamically to avoid SSR issues
    import('axios').then(({ default: axios }) => {
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
          // Handle 401 errors
          if (error.response?.status === 401) {
            this.handleTokenExpiration();
          }
          return Promise.reject(error);
        }
      );
    });
  }
}

// Export singleton instance
export const tokenManager = TokenManager.getInstance();