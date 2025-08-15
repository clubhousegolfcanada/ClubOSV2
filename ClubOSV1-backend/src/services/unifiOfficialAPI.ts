import { logger } from '../utils/logger';
import fetch from 'node-fetch';
import https from 'https';

// Ignore self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

interface Door {
  id: string;
  name: string;
  full_name: string;
  floor_id?: string;
  type: string;
  is_bind_hub: boolean;
  door_lock_relay_status: 'lock' | 'unlock';
  door_position_status: 'open' | 'close' | null;
}

interface UnlockResponse {
  code: string;
  data: string;
  msg: string;
}

class UnifiOfficialAPI {
  private baseUrl: string;
  private apiToken: string;
  private isConfigured: boolean = false;
  private consoleId: string;

  constructor() {
    // Get configuration from environment
    const apiToken = process.env.UNIFI_ACCESS_API_TOKEN || process.env.UNIFI_API_KEY || '';
    this.consoleId = process.env.UNIFI_CONSOLE_ID || '';
    
    // Check if we have local controller access
    const localControllerIP = process.env.UNIFI_CONTROLLER_IP || process.env.BEDFORD_CONTROLLER_IP;
    const useRemoteAccess = process.env.UNIFI_USE_REMOTE_ACCESS === 'true';
    
    if (apiToken) {
      this.apiToken = apiToken;
      
      if (useRemoteAccess && this.consoleId) {
        // Try UniFi cloud proxy (requires Remote Access enabled on controller)
        this.baseUrl = `https://unifi.ui.com/proxy/consoles/${this.consoleId}/access`;
        logger.info(`UniFi API configured for remote access via cloud proxy`);
      } else if (localControllerIP) {
        // Direct local connection
        const port = process.env.UNIFI_API_PORT || '12445';
        this.baseUrl = `https://${localControllerIP}:${port}`;
        logger.info(`UniFi API configured for local access at ${this.baseUrl}`);
      } else {
        // Fallback to EA API (read-only, but better than nothing)
        this.baseUrl = 'https://api.ui.com';
        logger.warn('UniFi API using EA endpoints (read-only access)');
      }
      
      this.isConfigured = true;
    } else {
      logger.warn('UniFi Access API not configured - missing API token');
    }
  }

  private getHeaders(): Record<string, string> {
    // Different headers for different endpoints
    if (this.baseUrl.includes('api.ui.com')) {
      // EA API uses X-API-KEY
      return {
        'X-API-KEY': this.apiToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
    } else {
      // Developer API uses Bearer token
      return {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
    }
  }

  /**
   * Fetch all doors - tries multiple endpoints
   */
  async fetchAllDoors(): Promise<Door[]> {
    if (!this.isConfigured) {
      logger.warn('[DEMO MODE] Returning simulated doors');
      return this.getDemoDoors();
    }

    // Try different endpoints based on configuration
    const endpoints = [
      '/api/v1/developer/doors',  // Official Developer API
      `/ea/devices?type=uah-door` // EA API fallback
    ];

    for (const endpoint of endpoints) {
      try {
        const url = this.baseUrl.includes('api.ui.com') && endpoint.startsWith('/ea')
          ? `${this.baseUrl}${endpoint}`
          : `${this.baseUrl}${endpoint}`;
          
        logger.info(`Trying endpoint: ${url}`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: this.getHeaders(),
          agent: httpsAgent
        });

        if (response.ok) {
          const result = await response.json();
          
          // Handle different response formats
          if (result.code === 'SUCCESS' && result.data) {
            // Developer API format
            return result.data;
          } else if (Array.isArray(result)) {
            // EA API format - transform to match Door interface
            return this.transformEADevicesToDoors(result);
          } else if (result.data && Array.isArray(result.data)) {
            // EA API with data wrapper
            return this.transformEADevicesToDoors(result.data);
          }
        }
      } catch (error: any) {
        logger.debug(`Endpoint failed: ${error.message}`);
        continue; // Try next endpoint
      }
    }

    logger.error('All door fetch endpoints failed');
    return this.getDemoDoors(); // Fallback to demo mode
  }

  /**
   * Transform EA API device format to Door format
   */
  private transformEADevicesToDoors(devices: any[]): Door[] {
    return devices.map(device => ({
      id: device.id || device._id,
      name: device.name || device.alias || 'Unknown Door',
      full_name: `${device.site_name || ''} - ${device.name || device.alias || 'Unknown'}`.trim(),
      type: 'door',
      is_bind_hub: true, // Assume true if it appears in the list
      door_lock_relay_status: device.lock_status || 'lock',
      door_position_status: device.door_status || null
    }));
  }

  /**
   * Remote unlock using the official API
   */
  async remoteUnlockDoor(
    doorId: string, 
    actorName?: string,
    extra?: Record<string, any>
  ): Promise<boolean> {
    if (!this.isConfigured) {
      logger.info(`[DEMO MODE] Simulating unlock for door ${doorId}`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
      return true;
    }

    // Check if we're using EA API (which can't unlock)
    if (this.baseUrl.includes('api.ui.com') && !this.baseUrl.includes('proxy')) {
      logger.error('Cannot unlock doors using EA API - read-only access');
      throw new Error('Door control requires Developer API access or Remote Access enabled');
    }

    try {
      const body: any = {};
      
      if (actorName) {
        body.actor_id = `clubos-${Date.now()}`;
        body.actor_name = actorName;
      }
      
      if (extra) {
        body.extra = extra;
      }

      const response = await fetch(`${this.baseUrl}/api/v1/developer/doors/${doorId}/remote_unlock`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
        agent: httpsAgent
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Unlock failed: ${response.status} - ${errorText}`);
      }

      const result: UnlockResponse = await response.json();
      
      if (result.code === 'SUCCESS') {
        logger.info(`Successfully unlocked door ${doorId}`);
        return true;
      } else {
        throw new Error(result.msg || 'Failed to unlock door');
      }
    } catch (error: any) {
      logger.error(`Error unlocking door ${doorId}:`, error);
      throw error;
    }
  }

  /**
   * Set temporary unlock (custom duration)
   */
  async setTemporaryUnlock(doorId: string, minutes: number = 0.5): Promise<boolean> {
    if (!this.isConfigured || this.baseUrl.includes('api.ui.com')) {
      logger.info(`[DEMO MODE] Simulating temporary unlock for ${minutes} minutes`);
      return true;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/developer/doors/${doorId}/lock_rule`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({
          type: 'custom',
          interval: Math.ceil(minutes)
        }),
        agent: httpsAgent
      });

      if (!response.ok) {
        throw new Error(`Failed to set lock rule: ${response.status}`);
      }

      const result = await response.json();
      return result.code === 'SUCCESS';
    } catch (error: any) {
      logger.error(`Error setting temporary unlock:`, error);
      throw error;
    }
  }

  /**
   * Unlock door for specified duration (combines unlock + temporary rule)
   */
  async unlockDoorForDuration(doorId: string, seconds: number = 30): Promise<boolean> {
    try {
      // First do immediate unlock
      await this.remoteUnlockDoor(doorId, 'ClubOS Remote', {
        source: 'ClubOS',
        duration_seconds: seconds
      });

      // Then set temporary unlock if duration > 60 seconds
      if (seconds > 60) {
        const minutes = seconds / 60;
        await this.setTemporaryUnlock(doorId, minutes);
      }

      return true;
    } catch (error: any) {
      logger.error(`Error unlocking door for duration:`, error);
      throw error;
    }
  }

  /**
   * Get demo doors for testing
   */
  private getDemoDoors(): Door[] {
    return [
      {
        id: '0ed545f8-2fcd-4839-9021-b39e707f6aa9',
        name: 'Bedford Front Door',
        full_name: 'Bedford - Front Door',
        floor_id: 'bedford-1f',
        type: 'door',
        is_bind_hub: true,
        door_lock_relay_status: 'lock',
        door_position_status: 'close'
      },
      {
        id: '5785e97b-6123-4596-ba49-b6e51164db9b',
        name: 'Bedford Middle Door',
        full_name: 'Bedford - Middle Door',
        floor_id: 'bedford-1f',
        type: 'door',
        is_bind_hub: true,
        door_lock_relay_status: 'lock',
        door_position_status: 'close'
      },
      {
        id: 'a4c7d982-3421-4b76-8e91-c5f2a8b9d123',
        name: 'Dartmouth Staff Door',
        full_name: 'Dartmouth - Staff Door', 
        floor_id: 'dartmouth-1f',
        type: 'door',
        is_bind_hub: true,
        door_lock_relay_status: 'lock',
        door_position_status: 'close'
      }
    ];
  }

  /**
   * Check if API is properly configured
   */
  isApiConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Check if door control is available (not just monitoring)
   */
  canControlDoors(): boolean {
    return this.isConfigured && !this.baseUrl.includes('api.ui.com');
  }

  /**
   * Get API status information
   */
  getApiStatus(): { configured: boolean; canControl: boolean; mode: string; baseUrl: string } {
    let mode = 'demo';
    
    if (this.isConfigured) {
      if (this.baseUrl.includes('unifi.ui.com/proxy')) {
        mode = 'cloud-proxy';
      } else if (this.baseUrl.includes('api.ui.com')) {
        mode = 'ea-readonly';
      } else {
        mode = 'local-direct';
      }
    }

    return {
      configured: this.isConfigured,
      canControl: this.canControlDoors(),
      mode,
      baseUrl: this.baseUrl
    };
  }
}

// Export singleton instance
export const unifiOfficialAPI = new UnifiOfficialAPI();
export default unifiOfficialAPI;