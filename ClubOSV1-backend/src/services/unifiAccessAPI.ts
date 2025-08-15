import { logger } from '../utils/logger';
import fetch from 'node-fetch';
import https from 'https';

// Ignore self-signed certificates for local controllers
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

interface Door {
  id: string;
  name: string;
  full_name: string;
  floor_id: string;
  type: string;
  is_bind_hub: boolean;
  door_lock_relay_status: 'lock' | 'unlock';
  door_position_status: 'open' | 'close' | null;
}

interface DoorLockingRule {
  type: 'schedule' | 'keep_lock' | 'keep_unlock' | 'custom' | 'lock_early';
  ended_time: number;
}

interface EmergencyStatus {
  lockdown: boolean;
  evacuation: boolean;
}

interface UnlockResponse {
  code: string;
  data: string;
  msg: string;
}

class UnifiAccessAPI {
  private baseUrl: string;
  private apiToken: string;
  private isConfigured: boolean = false;

  constructor() {
    // Get configuration from environment
    const apiToken = process.env.UNIFI_ACCESS_API_TOKEN || process.env.UNIFI_API_KEY || '';
    const controllerHost = process.env.UNIFI_CONTROLLER_HOST || '';
    const controllerPort = process.env.UNIFI_CONTROLLER_PORT || '443';
    const useLocalAccess = process.env.UNIFI_USE_LOCAL_ACCESS === 'true';

    if (apiToken && controllerHost) {
      this.apiToken = apiToken;
      
      // Construct base URL based on configuration
      if (useLocalAccess) {
        // Direct local connection to controller
        this.baseUrl = `https://${controllerHost}:${controllerPort}`;
      } else {
        // Cloud access through UniFi Identity
        this.baseUrl = `https://${controllerHost}`;
      }
      
      this.isConfigured = true;
      logger.info(`UniFi Access API configured with base URL: ${this.baseUrl}`);
    } else {
      logger.warn('UniFi Access API not configured - missing API token or controller host');
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Fetch all doors from the system
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
        logger.info(`Fetched ${result.data.length} doors from UniFi Access`);
        return result.data;
      } else {
        throw new Error(result.msg || 'Failed to fetch doors');
      }
    } catch (error: any) {
      logger.error('Error fetching doors:', error);
      throw error;
    }
  }

  /**
   * Remote unlock a specific door
   * @param doorId The identity ID of the door
   * @param actorName Optional custom actor name for logs
   * @param extra Optional custom data to pass through to webhooks
   */
  async remoteUnlockDoor(
    doorId: string, 
    actorName?: string,
    extra?: Record<string, any>
  ): Promise<boolean> {
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
      
      // Add extra data if provided
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
        throw new Error(`Failed to unlock door: ${response.status} ${response.statusText} - ${errorText}`);
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
   * @param doorId The identity ID of the door
   * @param type The type of locking rule
   * @param interval Optional interval in minutes for custom type
   */
  async setDoorLockingRule(
    doorId: string,
    type: 'keep_lock' | 'keep_unlock' | 'custom' | 'reset' | 'lock_early' | 'lock_now',
    interval?: number
  ): Promise<boolean> {
    if (!this.isConfigured) {
      logger.info(`[DEMO MODE] Simulating locking rule for door ${doorId}: ${type}`);
      return true;
    }

    try {
      const body: any = { type };
      
      // Add interval for custom unlock duration
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
        throw new Error(`Failed to set locking rule: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 'SUCCESS') {
        logger.info(`Successfully set locking rule for door ${doorId}: ${type}`);
        return true;
      } else {
        throw new Error(result.msg || 'Failed to set locking rule');
      }
    } catch (error: any) {
      logger.error(`Error setting locking rule for door ${doorId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch door locking rule
   * @param doorId The identity ID of the door
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
        throw new Error(`Failed to fetch locking rule: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 'SUCCESS' && result.data) {
        return result.data;
      } else {
        throw new Error(result.msg || 'Failed to fetch locking rule');
      }
    } catch (error: any) {
      logger.error(`Error fetching locking rule for door ${doorId}:`, error);
      return null;
    }
  }

  /**
   * Set emergency status for all doors
   * @param lockdown Keep all doors locked
   * @param evacuation Keep all doors unlocked
   */
  async setEmergencyStatus(lockdown: boolean, evacuation: boolean): Promise<boolean> {
    if (!this.isConfigured) {
      logger.info(`[DEMO MODE] Simulating emergency status: lockdown=${lockdown}, evacuation=${evacuation}`);
      return true;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/developer/doors/emergency_status`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ lockdown, evacuation }),
        agent: httpsAgent
      });

      if (!response.ok) {
        throw new Error(`Failed to set emergency status: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 'SUCCESS') {
        logger.info(`Successfully set emergency status: lockdown=${lockdown}, evacuation=${evacuation}`);
        return true;
      } else {
        throw new Error(result.msg || 'Failed to set emergency status');
      }
    } catch (error: any) {
      logger.error('Error setting emergency status:', error);
      throw error;
    }
  }

  /**
   * Fetch emergency status
   */
  async fetchEmergencyStatus(): Promise<EmergencyStatus | null> {
    if (!this.isConfigured) {
      return { lockdown: false, evacuation: false };
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/developer/doors/emergency_status`, {
        method: 'GET',
        headers: this.getHeaders(),
        agent: httpsAgent
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch emergency status: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 'SUCCESS' && result.data) {
        return result.data;
      } else {
        throw new Error(result.msg || 'Failed to fetch emergency status');
      }
    } catch (error: any) {
      logger.error('Error fetching emergency status:', error);
      return null;
    }
  }

  /**
   * Helper function to unlock a door for a specific duration
   * Uses the temporary locking rule API with custom type
   * @param doorId The identity ID of the door
   * @param durationMinutes Duration in minutes (default 0.5 = 30 seconds)
   */
  async unlockDoorForDuration(doorId: string, durationMinutes: number = 0.5): Promise<boolean> {
    try {
      // First unlock the door immediately
      const unlocked = await this.remoteUnlockDoor(doorId, 'ClubOS Remote Control', {
        source: 'ClubOS',
        timestamp: new Date().toISOString(),
        duration_minutes: durationMinutes
      });

      if (!unlocked) {
        return false;
      }

      // Then set a custom locking rule to keep it unlocked for the duration
      if (durationMinutes > 0) {
        await this.setDoorLockingRule(doorId, 'custom', Math.ceil(durationMinutes));
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
        id: 'demo-bedford-main',
        name: 'Front Door',
        full_name: 'Bedford - Front Door',
        floor_id: 'bedford-floor-1',
        type: 'door',
        is_bind_hub: true,
        door_lock_relay_status: 'lock',
        door_position_status: 'close'
      },
      {
        id: 'demo-bedford-middle',
        name: 'Middle Door',
        full_name: 'Bedford - Middle Door',
        floor_id: 'bedford-floor-1',
        type: 'door',
        is_bind_hub: true,
        door_lock_relay_status: 'lock',
        door_position_status: 'close'
      },
      {
        id: 'demo-dartmouth-staff',
        name: 'Staff Door',
        full_name: 'Dartmouth - Staff Door',
        floor_id: 'dartmouth-floor-1',
        type: 'door',
        is_bind_hub: true,
        door_lock_relay_status: 'lock',
        door_position_status: 'close'
      }
    ];
  }

  /**
   * Check if the API is configured
   */
  isApiConfigured(): boolean {
    return this.isConfigured;
  }
}

// Export singleton instance
export const unifiAccessAPI = new UnifiAccessAPI();
export default unifiAccessAPI;