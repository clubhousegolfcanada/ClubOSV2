import { logger } from '../utils/logger';
import { unifiCloudAuth } from './unifiCloudAuth';

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

interface UnlockResult {
  success: boolean;
  doorId: string;
  message?: string;
  unlockDuration?: number;
}

interface DoorLockingRule {
  type: 'schedule' | 'keep_lock' | 'keep_unlock' | 'custom' | 'lock_early';
  ended_time: number;
}

interface EmergencyStatus {
  lockdown: boolean;
  evacuation: boolean;
}

class UnifiCloudAccess {
  private initialized: boolean = false;
  private doors: Door[] = [];
  private lastFetch: Date | null = null;
  private cacheDuration = 60000; // 1 minute cache

  /**
   * Initialize the service and authenticate
   */
  async initialize(): Promise<boolean> {
    try {
      logger.info('Initializing UniFi Cloud Access...');
      
      // Attempt to login
      const loginSuccess = await unifiCloudAuth.login();
      
      if (loginSuccess) {
        this.initialized = true;
        logger.info('UniFi Cloud Access initialized successfully');
        
        // Pre-fetch doors for caching
        await this.fetchAllDoors();
        
        return true;
      }
      
      logger.error('Failed to initialize UniFi Cloud Access');
      return false;
    } catch (error: any) {
      logger.error('Error initializing UniFi Cloud Access:', error);
      
      if (error.message.includes('MFA_REQUIRED')) {
        logger.error('Two-factor authentication is enabled on this account.');
        logger.error('Please either:');
        logger.error('1. Temporarily disable 2FA in your UniFi account settings');
        logger.error('2. Use a Developer API token instead');
        logger.error('3. Create a service account without 2FA');
      }
      
      return false;
    }
  }

  /**
   * Ensure we're authenticated before making requests
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('Failed to authenticate with UniFi Cloud');
      }
    }
  }

  /**
   * Fetch all doors from UniFi Access
   */
  async fetchAllDoors(forceRefresh: boolean = false): Promise<Door[]> {
    try {
      // Use cache if available and not forcing refresh
      if (!forceRefresh && this.doors.length > 0 && this.lastFetch) {
        const cacheAge = Date.now() - this.lastFetch.getTime();
        if (cacheAge < this.cacheDuration) {
          return this.doors;
        }
      }

      await this.ensureInitialized();

      logger.info('Fetching doors from UniFi Cloud...');
      const response = await unifiCloudAuth.accessAPI('/api/v1/developer/doors', {
        method: 'GET'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch doors: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (result.code === 'SUCCESS' && result.data) {
        this.doors = result.data;
        this.lastFetch = new Date();
        logger.info(`Fetched ${this.doors.length} doors from UniFi Access`);
        return this.doors;
      } else {
        throw new Error(result.msg || 'Failed to fetch doors');
      }
    } catch (error: any) {
      logger.error('Error fetching doors:', error);
      
      // Return cached doors if available
      if (this.doors.length > 0) {
        logger.warn('Returning cached doors due to error');
        return this.doors;
      }
      
      throw error;
    }
  }

  /**
   * Remote unlock a door
   */
  async remoteUnlockDoor(doorId: string, actorName: string = 'ClubOS'): Promise<UnlockResult> {
    try {
      await this.ensureInitialized();

      logger.info(`Unlocking door ${doorId}...`);
      
      const body = {
        actor_id: `clubos-${Date.now()}`,
        actor_name: actorName,
        extra: {
          source: 'ClubOS',
          timestamp: new Date().toISOString()
        }
      };

      const response = await unifiCloudAuth.accessAPI(`/api/v1/developer/doors/${doorId}/remote_unlock`, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Unlock failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (result.code === 'SUCCESS') {
        logger.info(`Successfully unlocked door ${doorId}`);
        return {
          success: true,
          doorId,
          message: 'Door unlocked successfully'
        };
      } else {
        throw new Error(result.msg || 'Failed to unlock door');
      }
    } catch (error: any) {
      logger.error(`Error unlocking door ${doorId}:`, error);
      return {
        success: false,
        doorId,
        message: error.message
      };
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
    try {
      await this.ensureInitialized();

      const body: any = { type };
      if (type === 'custom' && interval) {
        body.interval = interval;
      }

      const response = await unifiCloudAuth.accessAPI(`/api/v1/developer/doors/${doorId}/lock_rule`, {
        method: 'PUT',
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Failed to set locking rule: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.code === 'SUCCESS') {
        logger.info(`Set locking rule for door ${doorId}: ${type}`);
        return true;
      }
      
      return false;
    } catch (error: any) {
      logger.error(`Error setting locking rule:`, error);
      return false;
    }
  }

  /**
   * Fetch door locking rule
   */
  async fetchDoorLockingRule(doorId: string): Promise<DoorLockingRule | null> {
    try {
      await this.ensureInitialized();

      const response = await unifiCloudAuth.accessAPI(`/api/v1/developer/doors/${doorId}/lock_rule`, {
        method: 'GET'
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
   * Set emergency status for all doors
   */
  async setEmergencyStatus(lockdown: boolean, evacuation: boolean): Promise<boolean> {
    try {
      await this.ensureInitialized();

      const response = await unifiCloudAuth.accessAPI('/api/v1/developer/doors/emergency_status', {
        method: 'PUT',
        body: JSON.stringify({ lockdown, evacuation })
      });

      if (!response.ok) {
        throw new Error(`Failed to set emergency status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.code === 'SUCCESS') {
        logger.info(`Set emergency status: lockdown=${lockdown}, evacuation=${evacuation}`);
        return true;
      }
      
      return false;
    } catch (error: any) {
      logger.error('Error setting emergency status:', error);
      return false;
    }
  }

  /**
   * Fetch emergency status
   */
  async fetchEmergencyStatus(): Promise<EmergencyStatus | null> {
    try {
      await this.ensureInitialized();

      const response = await unifiCloudAuth.accessAPI('/api/v1/developer/doors/emergency_status', {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch emergency status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.code === 'SUCCESS' && result.data) {
        return result.data;
      }
      
      return null;
    } catch (error: any) {
      logger.error('Error fetching emergency status:', error);
      return null;
    }
  }

  /**
   * Unlock door for specified duration (combines unlock + temporary rule)
   */
  async unlockDoorForDuration(doorId: string, seconds: number = 30): Promise<UnlockResult> {
    try {
      // First unlock the door
      const unlockResult = await this.remoteUnlockDoor(doorId);
      
      if (!unlockResult.success) {
        return unlockResult;
      }

      // If duration > 60 seconds, set a custom locking rule
      if (seconds > 60) {
        const minutes = Math.ceil(seconds / 60);
        const ruleSet = await this.setDoorLockingRule(doorId, 'custom', minutes);
        
        if (ruleSet) {
          logger.info(`Door ${doorId} will remain unlocked for ${minutes} minutes`);
        }
      }

      return {
        success: true,
        doorId,
        message: `Door unlocked for ${seconds} seconds`,
        unlockDuration: seconds
      };
    } catch (error: any) {
      logger.error(`Error unlocking door for duration:`, error);
      return {
        success: false,
        doorId,
        message: error.message
      };
    }
  }

  /**
   * Get door by ID
   */
  async getDoorById(doorId: string): Promise<Door | null> {
    const doors = await this.fetchAllDoors();
    return doors.find(d => d.id === doorId) || null;
  }

  /**
   * Get doors by location
   */
  async getDoorsByLocation(location: string): Promise<Door[]> {
    const doors = await this.fetchAllDoors();
    return doors.filter(d => 
      d.full_name?.toLowerCase().includes(location.toLowerCase()) ||
      d.name?.toLowerCase().includes(location.toLowerCase())
    );
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.initialized && unifiCloudAuth.isLoggedIn();
  }
}

// Export singleton instance
export const unifiCloudAccess = new UnifiCloudAccess();
export default unifiCloudAccess;