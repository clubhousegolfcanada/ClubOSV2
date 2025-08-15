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

interface DoorLockingRule {
  type: 'schedule' | 'keep_lock' | 'keep_unlock' | 'custom' | 'lock_early';
  ended_time: number;
}

class UnifiAccessDirect {
  private baseUrl: string;
  private apiToken: string;
  private isConfigured: boolean = false;

  constructor() {
    // Try different configuration options
    this.apiToken = process.env.UNIFI_ACCESS_TOKEN || process.env.UNIFI_DEVELOPER_TOKEN || '';
    
    // Option 1: Local controller access
    const localController = process.env.UNIFI_CONTROLLER_IP || process.env.BEDFORD_CONTROLLER_IP;
    const localPort = process.env.UNIFI_API_PORT || '12445';
    
    // Option 2: Cloud proxy (requires session cookie)
    const consoleId = process.env.UNIFI_CONSOLE_ID;
    const sessionCookie = process.env.UNIFI_SESSION_COOKIE || '';
    
    if (this.apiToken && localController) {
      // Direct local access with API token
      this.baseUrl = `https://${localController}:${localPort}`;
      this.isConfigured = true;
      logger.info(`UniFi Access configured for local access at ${this.baseUrl}`);
    } else if (sessionCookie && consoleId) {
      // Cloud proxy with session cookie
      this.baseUrl = `https://unifi.ui.com/proxy/consoles/${consoleId}/access`;
      this.apiToken = sessionCookie; // Use session cookie as token
      this.isConfigured = true;
      logger.info(`UniFi Access configured for cloud proxy access`);
    } else {
      logger.warn('UniFi Access Direct not configured - missing credentials');
      logger.warn('Please provide either:');
      logger.warn('1. UNIFI_ACCESS_TOKEN + UNIFI_CONTROLLER_IP for local access');
      logger.warn('2. UNIFI_SESSION_COOKIE + UNIFI_CONSOLE_ID for cloud access');
    }
  }

  private getHeaders(): Record<string, string> {
    // Check if using session cookie or API token
    if (this.apiToken.includes('TOKEN') || this.apiToken.length < 100) {
      // Looks like an API token
      return {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
    } else {
      // Looks like a session cookie
      return {
        'Cookie': this.apiToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
    }
  }

  /**
   * Fetch all doors
   */
  async fetchAllDoors(): Promise<Door[]> {
    if (!this.isConfigured) {
      logger.warn('[DEMO MODE] Returning simulated doors');
      return this.getDemoDoors();
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/developer/doors`, {
        method: 'GET',
        headers: this.getHeaders(),
        agent: httpsAgent
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch doors: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 'SUCCESS' && result.data) {
        logger.info(`Fetched ${result.data.length} doors`);
        return result.data;
      } else {
        throw new Error(result.msg || 'Failed to fetch doors');
      }
    } catch (error: any) {
      logger.error('Error fetching doors:', error);
      return this.getDemoDoors();
    }
  }

  /**
   * Remote unlock a specific door
   */
  async remoteUnlockDoor(doorId: string, actorName?: string): Promise<boolean> {
    if (!this.isConfigured) {
      logger.info(`[DEMO MODE] Simulating unlock for door ${doorId}`);
      return true;
    }

    try {
      const body: any = {};
      
      // Add actor information if provided
      if (actorName) {
        body.actor_id = `clubos-${Date.now()}`;
        body.actor_name = actorName;
      }
      
      // Add metadata
      body.extra = {
        source: 'ClubOS',
        timestamp: new Date().toISOString(),
        version: '1.0'
      };

      const response = await fetch(`${this.baseUrl}/api/v1/developer/doors/${doorId}/remote_unlock`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
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
   * Set temporary door locking rule
   */
  async setDoorLockingRule(
    doorId: string,
    type: 'keep_lock' | 'keep_unlock' | 'custom' | 'reset' | 'lock_early' | 'lock_now',
    interval?: number
  ): Promise<boolean> {
    if (!this.isConfigured) {
      logger.info(`[DEMO MODE] Setting lock rule: ${type}`);
      return true;
    }

    try {
      const body: any = { type };
      
      if (type === 'custom' && interval) {
        body.interval = interval;
      }

      const response = await fetch(`${this.baseUrl}/api/v1/developer/doors/${doorId}/lock_rule`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        agent: httpsAgent
      });

      if (!response.ok) {
        throw new Error(`Failed to set locking rule: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.code === 'SUCCESS') {
        logger.info(`Set locking rule for door ${doorId}: ${type}`);
        return true;
      } else {
        throw new Error(result.msg || 'Failed to set locking rule');
      }
    } catch (error: any) {
      logger.error(`Error setting locking rule:`, error);
      return false;
    }
  }

  /**
   * Fetch door locking rule
   */
  async fetchDoorLockingRule(doorId: string): Promise<DoorLockingRule | null> {
    if (!this.isConfigured) {
      return { type: 'schedule', ended_time: Date.now() / 1000 };
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/developer/doors/${doorId}/lock_rule`, {
        method: 'GET',
        headers: this.getHeaders(),
        agent: httpsAgent
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch locking rule: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.code === 'SUCCESS' && result.data) {
        return result.data;
      }
      
      return null;
    } catch (error: any) {
      logger.error(`Error fetching locking rule:`, error);
      return null;
    }
  }

  /**
   * Unlock door for specific duration
   */
  async unlockDoorForDuration(doorId: string, seconds: number = 30): Promise<boolean> {
    try {
      // First unlock the door
      const unlocked = await this.remoteUnlockDoor(doorId, 'ClubOS Remote');
      
      if (!unlocked) {
        return false;
      }

      // If duration > 60 seconds, set custom locking rule
      if (seconds > 60) {
        const minutes = Math.ceil(seconds / 60);
        await this.setDoorLockingRule(doorId, 'custom', minutes);
      }

      return true;
    } catch (error: any) {
      logger.error(`Error unlocking door for duration:`, error);
      return false;
    }
  }

  /**
   * Get demo doors for testing
   */
  private getDemoDoors(): Door[] {
    return [
      {
        id: 'demo-bedford-front',
        name: 'Front Door',
        full_name: 'Bedford - Front Door',
        type: 'door',
        is_bind_hub: true,
        door_lock_relay_status: 'lock',
        door_position_status: 'close'
      },
      {
        id: 'demo-bedford-middle',
        name: 'Middle Door',
        full_name: 'Bedford - Middle Door',
        type: 'door',
        is_bind_hub: true,
        door_lock_relay_status: 'lock',
        door_position_status: 'close'
      },
      {
        id: 'demo-dartmouth-staff',
        name: 'Staff Door',
        full_name: 'Dartmouth - Staff Door',
        type: 'door',
        is_bind_hub: true,
        door_lock_relay_status: 'lock',
        door_position_status: 'close'
      }
    ];
  }

  /**
   * Check if configured
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Get configuration status
   */
  getStatus(): { configured: boolean; mode: string; baseUrl?: string } {
    if (!this.isConfigured) {
      return { configured: false, mode: 'demo' };
    }

    const mode = this.baseUrl.includes('unifi.ui.com') ? 'cloud' : 'local';
    return { configured: true, mode, baseUrl: this.baseUrl };
  }
}

// Export singleton instance
export const unifiAccessDirect = new UnifiAccessDirect();
export default unifiAccessDirect;