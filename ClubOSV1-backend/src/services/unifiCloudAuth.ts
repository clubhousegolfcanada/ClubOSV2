import { logger } from '../utils/logger';
import fetch, { Headers } from 'node-fetch';
import * as tough from 'tough-cookie';

interface AuthResponse {
  userId: string;
  token: string;
  csrfToken?: string;
  cookies: string[];
}

interface CloudConsole {
  id: string;
  name: string;
  type: string;
  devices?: any[];
}

export class UnifiCloudAuth {
  private cookies: tough.CookieJar;
  private csrfToken: string | null = null;
  private authToken: string | null = null;
  private userId: string | null = null;
  private isAuthenticated: boolean = false;
  private consoleId: string;

  constructor() {
    this.cookies = new tough.CookieJar();
    this.consoleId = process.env.UNIFI_CONSOLE_ID || '';
  }

  /**
   * Login to UniFi cloud account
   */
  async login(username?: string, password?: string): Promise<boolean> {
    const user = username || process.env.UNIFI_CLOUD_USERNAME || process.env.UNIFI_USERNAME;
    const pass = password || process.env.UNIFI_CLOUD_PASSWORD || process.env.UNIFI_PASSWORD;

    if (!user || !pass) {
      logger.error('UniFi credentials not provided');
      return false;
    }

    try {
      logger.info('Attempting UniFi cloud login...');

      // Step 1: Get CSRF token
      const csrfResponse = await fetch('https://account.ui.com/api/auth/csrf', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ClubOS/1.0'
        }
      });

      if (csrfResponse.ok) {
        const csrfData = await csrfResponse.json();
        this.csrfToken = csrfData.csrf_token || csrfData.csrfToken;
        
        // Store cookies
        const setCookies = csrfResponse.headers.raw()['set-cookie'];
        if (setCookies) {
          for (const cookie of setCookies) {
            await this.cookies.setCookie(cookie, 'https://account.ui.com');
          }
        }
      }

      // Step 2: Login with credentials
      const loginPayload = {
        username: user,
        password: pass,
        token: '', // MFA token if needed
        rememberMe: true
      };

      const cookieString = await this.cookies.getCookieString('https://account.ui.com');
      
      const loginResponse = await fetch('https://account.ui.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': this.csrfToken || '',
          'Cookie': cookieString,
          'User-Agent': 'ClubOS/1.0'
        },
        body: JSON.stringify(loginPayload)
      });

      if (!loginResponse.ok) {
        const errorText = await loginResponse.text();
        
        // Check if MFA is required
        if (loginResponse.status === 401 && errorText.includes('totpAuthRequired')) {
          logger.warn('MFA/2FA is required for this account');
          throw new Error('MFA_REQUIRED: Two-factor authentication is required. Please disable 2FA temporarily or use a Developer API token instead.');
        }
        
        logger.error(`Login failed: ${loginResponse.status} - ${errorText}`);
        return false;
      }

      const loginData = await loginResponse.json();
      
      // Store auth data
      this.userId = loginData.userId || loginData.user?.id;
      this.authToken = loginData.token || loginData.access_token;
      
      // Store cookies from login response
      const loginCookies = loginResponse.headers.raw()['set-cookie'];
      if (loginCookies) {
        for (const cookie of loginCookies) {
          await this.cookies.setCookie(cookie, 'https://account.ui.com');
        }
      }

      // Step 3: Verify authentication by getting user info
      const verifyResponse = await fetch('https://account.ui.com/api/users/self', {
        method: 'GET',
        headers: await this.getAuthHeaders('https://account.ui.com')
      });

      if (verifyResponse.ok) {
        this.isAuthenticated = true;
        logger.info('Successfully authenticated with UniFi cloud');
        
        // Get console information if needed
        await this.getConsoles();
        
        return true;
      }

      logger.error('Failed to verify authentication');
      return false;

    } catch (error: any) {
      logger.error('UniFi cloud login error:', error);
      throw error;
    }
  }

  /**
   * Get list of consoles (controllers) associated with account
   */
  async getConsoles(): Promise<CloudConsole[]> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch('https://api.ui.com/ea/hosts', {
        method: 'GET',
        headers: await this.getAuthHeaders('https://api.ui.com')
      });

      if (response.ok) {
        const consoles = await response.json();
        logger.info(`Found ${consoles.length} console(s) in account`);
        
        // Log console IDs for reference
        consoles.forEach((console: any) => {
          logger.debug(`Console: ${console.name} (${console.id})`);
        });
        
        return consoles;
      }

      return [];
    } catch (error: any) {
      logger.error('Failed to get consoles:', error);
      return [];
    }
  }

  /**
   * Get authentication headers for requests
   */
  async getAuthHeaders(url: string): Promise<Record<string, string>> {
    const cookieString = await this.cookies.getCookieString(url);
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'ClubOS/1.0',
      'Cookie': cookieString
    };

    if (this.csrfToken) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Make authenticated request to UniFi API
   */
  async makeAuthenticatedRequest(url: string, options: any = {}): Promise<any> {
    if (!this.isAuthenticated) {
      // Try to login first
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        throw new Error('Authentication required');
      }
    }

    const requestUrl = url.startsWith('http') ? url : `https://unifi.ui.com${url}`;
    const headers = await this.getAuthHeaders(requestUrl);

    const response = await fetch(requestUrl, {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    });

    // Check if we need to re-authenticate
    if (response.status === 401) {
      logger.info('Session expired, re-authenticating...');
      this.isAuthenticated = false;
      const loginSuccess = await this.login();
      
      if (loginSuccess) {
        // Retry the request
        const retryHeaders = await this.getAuthHeaders(requestUrl);
        const retryResponse = await fetch(requestUrl, {
          ...options,
          headers: {
            ...retryHeaders,
            ...options.headers
          }
        });
        return retryResponse;
      }
    }

    return response;
  }

  /**
   * Access UniFi Access API through cloud proxy
   */
  async accessAPI(endpoint: string, options: any = {}): Promise<any> {
    if (!this.consoleId) {
      throw new Error('Console ID not configured');
    }

    const url = `/proxy/consoles/${this.consoleId}/access${endpoint}`;
    return this.makeAuthenticatedRequest(url, options);
  }

  /**
   * Check if authenticated
   */
  isLoggedIn(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    if (this.isAuthenticated) {
      try {
        await fetch('https://account.ui.com/api/auth/logout', {
          method: 'POST',
          headers: await this.getAuthHeaders('https://account.ui.com')
        });
      } catch (error) {
        logger.error('Logout error:', error);
      }
    }

    this.isAuthenticated = false;
    this.authToken = null;
    this.csrfToken = null;
    this.userId = null;
    this.cookies = new tough.CookieJar();
  }
}

// Export singleton instance
export const unifiCloudAuth = new UnifiCloudAuth();
export default unifiCloudAuth;