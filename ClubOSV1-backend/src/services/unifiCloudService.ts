import { logger } from '../utils/logger';
import fetch from 'node-fetch';
import https from 'https';

// Create an HTTPS agent that ignores self-signed certificates (common with UniFi)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

interface DoorConfig {
  doorId: string;
  name: string;
  type: 'exterior' | 'staff' | 'emergency' | 'interior';
}

interface DoorStatus {
  doorId: string;
  name: string;
  locked: boolean;
  online: boolean;
  lastActivity?: Date;
  battery?: number;
}

interface UnlockResult {
  success: boolean;
  doorId: string;
  message?: string;
  unlockDuration?: number;
}

interface AuthToken {
  token: string;
  expiresAt: Date;
}

class UnifiCloudService {
  private authToken: AuthToken | null = null;
  private baseUrl: string;
  private consoleId: string;
  private isAuthenticated: boolean = false;

  // Door mapping for each location - Only show doors we actually have
  private readonly DOOR_MAP: Record<string, Record<string, DoorConfig>> = {
    'Bedford': {
      'main-entrance': { 
        doorId: process.env.BEDFORD_MAIN_DOOR_MAC || '28:70:4e:80:c4:4f',
        name: 'Front Door',
        type: 'exterior'
      },
      'middle-door': {
        doorId: process.env.BEDFORD_MIDDLE_DOOR_MAC || '28:70:4e:80:de:f3',
        name: 'Middle Door',
        type: 'interior'
      }
    },
    'Dartmouth': {
      'main-entrance': { 
        doorId: process.env.DARTMOUTH_MAIN_DOOR_MAC || 'DART-MAIN-001',
        name: 'Front Door',
        type: 'exterior'
      },
      'staff-door': {
        doorId: process.env.DARTMOUTH_STAFF_DOOR_MAC || '28:70:4e:80:de:3b',
        name: 'Staff Door',
        type: 'staff'
      }
    },
    'Stratford': {
      'main-entrance': { 
        doorId: process.env.STRATFORD_MAIN_DOOR_MAC || 'STRAT-MAIN-001',
        name: 'Front Door',
        type: 'exterior'
      }
    },
    'Bayers Lake': {
      'main-entrance': { 
        doorId: process.env.BAYERS_MAIN_DOOR_MAC || 'BAYERS-MAIN-001',
        name: 'Front Door',
        type: 'exterior'
      }
    },
    'Truro': {
      'main-entrance': { 
        doorId: process.env.TRURO_MAIN_DOOR_MAC || 'TRURO-MAIN-001',
        name: 'Front Door',
        type: 'exterior'
      }
    }
  };

  constructor() {
    // Check for API key first (preferred method)
    const apiKey = process.env.UNIFI_ACCESS_API_TOKEN || process.env.UNIFI_API_KEY;
    this.consoleId = process.env.UNIFI_CONSOLE_ID || '0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302';
    
    if (apiKey) {
      // Check if using remote access or local connection
      const useRemoteAccess = process.env.UNIFI_USE_REMOTE_ACCESS === 'true';
      
      if (useRemoteAccess) {
        // Use UniFi cloud proxy for remote access
        // This works when Remote Access is enabled in UniFi Dashboard > Settings > System > Remote Access
        this.baseUrl = `https://unifi.ui.com/proxy/consoles/${this.consoleId}/access`;
      } else {
        // Direct local connection
        const controllerIp = process.env.UNIFI_CONTROLLER_IP || '192.168.1.1';
        const apiPort = process.env.UNIFI_API_PORT || '12445';
        this.baseUrl = `https://${controllerIp}:${apiPort}`;
      }
      
      this.initializeWithApiKey(apiKey);
    } else {
      // Check if using cloud proxy or direct connection
      const cloudUsername = process.env.UNIFI_CLOUD_USERNAME;
      const cloudPassword = process.env.UNIFI_CLOUD_PASSWORD;
      
      if (cloudUsername && cloudPassword && this.consoleId) {
        // Cloud proxy setup
        this.baseUrl = `https://unifi.ui.com/proxy/consoles/${this.consoleId}/access`;
        this.initialize(cloudUsername, cloudPassword, true);
      } else {
        // Direct controller setup (fallback to existing approach)
        const controllerUrl = process.env.UNIFI_CONTROLLER_URL || '';
        const username = process.env.UNIFI_USERNAME || '';
        const password = process.env.UNIFI_PASSWORD || '';
        
        if (controllerUrl && username && password) {
          // Remove trailing slash if present
          this.baseUrl = controllerUrl.replace(/\/$/, '');
          this.initialize(username, password, false);
        } else {
          logger.warn('UniFi Access not configured - running in demo mode');
        }
      }
    }
  }

  private async initializeWithApiKey(apiKey: string): Promise<void> {
    try {
      // API key doesn't require login - it's used directly in headers
      this.authToken = {
        token: apiKey,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // API keys don't expire
      };
      this.isAuthenticated = true;
      logger.info('UniFi Access initialized with API key');
    } catch (error: any) {
      logger.error('Failed to initialize with API key:', error);
      this.isAuthenticated = false;
    }
  }

  private async initialize(username: string, password: string, isCloud: boolean): Promise<void> {
    try {
      if (isCloud) {
        await this.authenticateCloud(username, password);
      } else {
        await this.authenticateDirect(username, password);
      }
    } catch (error: any) {
      logger.error('Failed to initialize UniFi Cloud Service:', error);
      this.isAuthenticated = false;
    }
  }

  private async authenticateCloud(username: string, password: string): Promise<boolean> {
    try {
      // First, authenticate with UniFi cloud
      const cloudAuthResponse = await fetch('https://unifi.ui.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password })
      });

      if (!cloudAuthResponse.ok) {
        throw new Error('Cloud authentication failed');
      }

      // Get cookies from response
      const cookies = cloudAuthResponse.headers.get('set-cookie');
      
      // Now authenticate with the Access API through the proxy
      const accessAuthResponse = await fetch(`${this.baseUrl}/api/v1/developer/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookies || ''
        },
        body: JSON.stringify({ username, password })
      });

      if (!accessAuthResponse.ok) {
        throw new Error('Access API authentication failed');
      }

      const authData = await accessAuthResponse.json();
      
      // Store the authentication token
      this.authToken = {
        token: authData.token || authData.access_token,
        expiresAt: new Date(Date.now() + (authData.expires_in || 3600) * 1000)
      };

      this.isAuthenticated = true;
      logger.info('Successfully authenticated with UniFi Cloud Access API');
      return true;
    } catch (error: any) {
      logger.error('UniFi Cloud authentication failed:', error);
      this.isAuthenticated = false;
      return false;
    }
  }

  private async authenticateDirect(username: string, password: string): Promise<boolean> {
    try {
      // Direct authentication with local controller
      const response = await fetch(`${this.baseUrl}/api/v1/developer/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const authData = await response.json();
      
      // Store the authentication token
      this.authToken = {
        token: authData.token || authData.access_token,
        expiresAt: new Date(Date.now() + (authData.expires_in || 3600) * 1000)
      };

      this.isAuthenticated = true;
      logger.info('Successfully authenticated with UniFi Access API');
      return true;
    } catch (error: any) {
      logger.error('UniFi direct authentication failed:', error);
      this.isAuthenticated = false;
      return false;
    }
  }

  private async ensureAuthenticated(): Promise<boolean> {
    // Check if token exists and is not expired
    if (this.authToken && this.authToken.expiresAt > new Date()) {
      return true;
    }

    // Re-authenticate if needed
    const cloudUsername = process.env.UNIFI_CLOUD_USERNAME;
    const cloudPassword = process.env.UNIFI_CLOUD_PASSWORD;
    
    if (cloudUsername && cloudPassword) {
      return await this.authenticateCloud(cloudUsername, cloudPassword);
    }

    const username = process.env.UNIFI_USERNAME;
    const password = process.env.UNIFI_PASSWORD;
    
    if (username && password) {
      return await this.authenticateDirect(username, password);
    }

    return false;
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.authToken) {
      return {};
    }

    // Always use Bearer token format
    return {
      'Authorization': `Bearer ${this.authToken.token}`,
      'Content-Type': 'application/json'
    };
  }

  async unlockDoor(location: string, doorKey: string, duration: number = 30): Promise<UnlockResult> {
    try {
      // Get door configuration
      const locationDoors = this.DOOR_MAP[location];
      if (!locationDoors) {
        throw new Error(`Location '${location}' not found`);
      }

      const doorConfig = locationDoors[doorKey];
      if (!doorConfig) {
        throw new Error(`Door '${doorKey}' not found at ${location}`);
      }

      // Demo mode check
      if (!this.isAuthenticated) {
        logger.info(`[DEMO] Simulating unlock for ${doorConfig.name} at ${location}`);
        return {
          success: true,
          doorId: doorConfig.doorId,
          message: `[DEMO] ${doorConfig.name} unlocked for ${duration} seconds`,
          unlockDuration: duration
        };
      }

      // Ensure we're authenticated
      if (!await this.ensureAuthenticated()) {
        throw new Error('Authentication failed');
      }

      // Make the API call to unlock the door
      const response = await fetch(`${this.baseUrl}/api/v1/developer/doors/${doorConfig.doorId}/unlock`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          duration,
          reason: 'Remote unlock via ClubOS'
        }),
        agent: this.baseUrl.startsWith('https') ? httpsAgent : undefined
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Unlock failed: ${response.statusText} - ${errorData}`);
      }

      const result = await response.json();

      logger.info(`Successfully unlocked ${doorConfig.name} at ${location} for ${duration} seconds`);

      return {
        success: true,
        doorId: doorConfig.doorId,
        message: `${doorConfig.name} unlocked for ${duration} seconds`,
        unlockDuration: duration
      };
    } catch (error: any) {
      logger.error('Failed to unlock door:', error);
      throw new Error(`Failed to unlock door: ${error.message}`);
    }
  }

  async lockDoor(location: string, doorKey: string): Promise<UnlockResult> {
    try {
      const locationDoors = this.DOOR_MAP[location];
      if (!locationDoors) {
        throw new Error(`Location '${location}' not found`);
      }

      const doorConfig = locationDoors[doorKey];
      if (!doorConfig) {
        throw new Error(`Door '${doorKey}' not found at ${location}`);
      }

      // Demo mode check
      if (!this.isAuthenticated) {
        logger.info(`[DEMO] Simulating lock for ${doorConfig.name} at ${location}`);
        return {
          success: true,
          doorId: doorConfig.doorId,
          message: `[DEMO] ${doorConfig.name} locked`
        };
      }

      // Ensure we're authenticated
      if (!await this.ensureAuthenticated()) {
        throw new Error('Authentication failed');
      }

      // Make the API call to lock the door
      const response = await fetch(`${this.baseUrl}/api/v1/developer/doors/${doorConfig.doorId}/lock`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        agent: this.baseUrl.startsWith('https') ? httpsAgent : undefined
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Lock failed: ${response.statusText} - ${errorData}`);
      }

      logger.info(`Successfully locked ${doorConfig.name} at ${location}`);

      return {
        success: true,
        doorId: doorConfig.doorId,
        message: `${doorConfig.name} locked`
      };
    } catch (error: any) {
      logger.error('Failed to lock door:', error);
      throw new Error(`Failed to lock door: ${error.message}`);
    }
  }

  async getDoorStatus(location: string): Promise<DoorStatus[]> {
    try {
      const locationDoors = this.DOOR_MAP[location];
      if (!locationDoors) {
        throw new Error(`Location '${location}' not found`);
      }

      const statuses: DoorStatus[] = [];

      for (const [key, doorConfig] of Object.entries(locationDoors)) {
        if (!this.isAuthenticated) {
          // Demo mode - return simulated status
          statuses.push({
            doorId: doorConfig.doorId,
            name: doorConfig.name,
            locked: Math.random() > 0.3, // 70% locked
            online: true,
            battery: 85 + Math.floor(Math.random() * 15),
            lastActivity: new Date(Date.now() - Math.random() * 3600000)
          });
        } else {
          try {
            // Ensure we're authenticated
            if (!await this.ensureAuthenticated()) {
              throw new Error('Authentication failed');
            }

            // Get actual status from UniFi
            const response = await fetch(`${this.baseUrl}/api/v1/developer/doors/${doorConfig.doorId}`, {
              headers: this.getAuthHeaders(),
              agent: this.baseUrl.startsWith('https') ? httpsAgent : undefined
            });

            if (response.ok) {
              const doorData = await response.json();
              statuses.push({
                doorId: doorConfig.doorId,
                name: doorConfig.name,
                locked: doorData.locked || doorData.is_locked || false,
                online: doorData.online || doorData.is_online || false,
                battery: doorData.battery_level || 100,
                lastActivity: doorData.last_activity ? new Date(doorData.last_activity) : new Date()
              });
            } else {
              // If individual door fails, mark as offline
              statuses.push({
                doorId: doorConfig.doorId,
                name: doorConfig.name,
                locked: false,
                online: false
              });
            }
          } catch (error) {
            // If individual door fails, mark as offline
            statuses.push({
              doorId: doorConfig.doorId,
              name: doorConfig.name,
              locked: false,
              online: false
            });
          }
        }
      }

      return statuses;
    } catch (error: any) {
      logger.error('Failed to get door status:', error);
      throw new Error(`Failed to get door status: ${error.message}`);
    }
  }

  async unlockAllDoors(location: string, duration: number = 60): Promise<UnlockResult[]> {
    try {
      const locationDoors = this.DOOR_MAP[location];
      if (!locationDoors) {
        throw new Error(`Location '${location}' not found`);
      }

      const results: UnlockResult[] = [];

      // Unlock all non-emergency doors (emergency exits should remain locked for security)
      for (const [key, doorConfig] of Object.entries(locationDoors)) {
        if (doorConfig.type !== 'emergency') {
          try {
            const result = await this.unlockDoor(location, key, duration);
            results.push(result);
          } catch (error) {
            results.push({
              success: false,
              doorId: doorConfig.doorId,
              message: `Failed to unlock ${doorConfig.name}`
            });
          }
        }
      }

      return results;
    } catch (error: any) {
      logger.error('Failed to unlock all doors:', error);
      throw new Error(`Failed to unlock all doors: ${error.message}`);
    }
  }

  async lockdownLocation(location: string): Promise<UnlockResult[]> {
    try {
      const locationDoors = this.DOOR_MAP[location];
      if (!locationDoors) {
        throw new Error(`Location '${location}' not found`);
      }

      const results: UnlockResult[] = [];

      // Lock all doors
      for (const [key, doorConfig] of Object.entries(locationDoors)) {
        try {
          const result = await this.lockDoor(location, key);
          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            doorId: doorConfig.doorId,
            message: `Failed to lock ${doorConfig.name}`
          });
        }
      }

      return results;
    } catch (error: any) {
      logger.error('Failed to lockdown location:', error);
      throw new Error(`Failed to lockdown location: ${error.message}`);
    }
  }

  async getAccessLog(location: string, doorKey?: string, limit: number = 10): Promise<any[]> {
    try {
      if (!this.isAuthenticated) {
        // Return demo data
        return Array.from({ length: limit }, (_, i) => ({
          timestamp: new Date(Date.now() - i * 3600000),
          door: doorKey || 'main-entrance',
          event: ['unlock', 'lock', 'access_granted', 'access_denied'][Math.floor(Math.random() * 4)],
          user: ['John Doe', 'Jane Smith', 'System', 'Remote'][Math.floor(Math.random() * 4)]
        }));
      }

      // Ensure we're authenticated
      if (!await this.ensureAuthenticated()) {
        throw new Error('Authentication failed');
      }

      // Get actual access logs from UniFi
      const endpoint = doorKey 
        ? `${this.baseUrl}/api/v1/developer/doors/${this.DOOR_MAP[location]?.[doorKey]?.doorId}/events`
        : `${this.baseUrl}/api/v1/developer/events`;

      const response = await fetch(`${endpoint}?limit=${limit}`, {
        headers: this.getAuthHeaders(),
        agent: this.baseUrl.startsWith('https') ? httpsAgent : undefined
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch access logs: ${response.statusText}`);
      }

      const events = await response.json();
      return events.data || events || [];
    } catch (error: any) {
      logger.error('Failed to get access log:', error);
      return [];
    }
  }

  getLocationDoors(location: string): DoorConfig[] {
    const locationDoors = this.DOOR_MAP[location];
    if (!locationDoors) {
      return [];
    }
    return Object.values(locationDoors);
  }

  isInDemoMode(): boolean {
    return !this.isAuthenticated;
  }
}

// Export singleton instance
export default new UnifiCloudService();