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
  location?: string;
  type: string;
  is_bind_hub: boolean;
  door_lock_relay_status: 'lock' | 'unlock';
  door_position_status: 'open' | 'close' | null;
}

interface LocationConfig {
  name: string;
  token: string;
  ip: string;
  port: string;
}

class UnifiMultiLocationService {
  private locations: Map<string, LocationConfig> = new Map();
  private doorsCache: Map<string, Door[]> = new Map();
  private lastFetch: Date | null = null;

  constructor() {
    this.loadConfiguration();
  }

  private loadConfiguration() {
    // Bedford configuration
    if (process.env.BEDFORD_ACCESS_TOKEN) {
      this.locations.set('Bedford', {
        name: 'Bedford',
        token: process.env.BEDFORD_ACCESS_TOKEN,
        ip: process.env.BEDFORD_CONTROLLER_IP || '192.168.1.1',
        port: process.env.BEDFORD_API_PORT || '12445'
      });
      logger.info('Bedford location configured');
    }

    // Dartmouth configuration
    if (process.env.DARTMOUTH_ACCESS_TOKEN) {
      this.locations.set('Dartmouth', {
        name: 'Dartmouth',
        token: process.env.DARTMOUTH_ACCESS_TOKEN,
        ip: process.env.DARTMOUTH_CONTROLLER_IP || '192.168.1.1',
        port: process.env.DARTMOUTH_API_PORT || '12445'
      });
      logger.info('Dartmouth location configured');
    }

    // Add more locations as needed
    logger.info(`Configured ${this.locations.size} location(s)`);
  }

  /**
   * Fetch doors from a specific location
   */
  async fetchLocationDoors(locationName: string): Promise<Door[]> {
    const location = this.locations.get(locationName);
    if (!location) {
      logger.warn(`Location ${locationName} not configured`);
      return [];
    }

    try {
      const url = `https://${location.ip}:${location.port}/api/v1/developer/doors`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${location.token}`,
          'Accept': 'application/json'
        },
        agent: httpsAgent,
        timeout: 5000
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch doors: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.code === 'SUCCESS' && result.data) {
        // Add location info to each door
        const doors = result.data.map((door: any) => ({
          ...door,
          location: locationName
        }));
        
        // Cache the results
        this.doorsCache.set(locationName, doors);
        this.lastFetch = new Date();
        
        logger.info(`Fetched ${doors.length} doors from ${locationName}`);
        return doors;
      }
      
      return [];
    } catch (error: any) {
      logger.error(`Error fetching doors from ${locationName}:`, error.message);
      
      // Return cached data if available
      return this.doorsCache.get(locationName) || [];
    }
  }

  /**
   * Fetch all doors from all locations
   */
  async fetchAllDoors(): Promise<Door[]> {
    const allDoors: Door[] = [];
    
    for (const [locationName] of this.locations) {
      const doors = await this.fetchLocationDoors(locationName);
      allDoors.push(...doors);
    }
    
    return allDoors;
  }

  /**
   * Unlock a door at a specific location
   */
  async unlockDoor(locationName: string, doorId: string, duration: number = 30): Promise<boolean> {
    const location = this.locations.get(locationName);
    if (!location) {
      logger.error(`Location ${locationName} not configured`);
      return false;
    }

    try {
      const url = `https://${location.ip}:${location.port}/api/v1/developer/doors/${doorId}/remote_unlock`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${location.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          actor_id: 'clubos-multi',
          actor_name: 'ClubOS Multi-Location',
          extra: {
            source: 'ClubOS',
            location: locationName,
            duration_seconds: duration,
            timestamp: new Date().toISOString()
          }
        }),
        agent: httpsAgent
      });

      if (!response.ok) {
        throw new Error(`Unlock failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.code === 'SUCCESS') {
        logger.info(`Successfully unlocked door ${doorId} at ${locationName}`);
        
        // Set custom lock rule for longer durations
        if (duration > 60) {
          await this.setLockRule(locationName, doorId, 'custom', Math.ceil(duration / 60));
        }
        
        return true;
      }
      
      return false;
    } catch (error: any) {
      logger.error(`Error unlocking door at ${locationName}:`, error);
      return false;
    }
  }

  /**
   * Set lock rule for a door
   */
  async setLockRule(
    locationName: string,
    doorId: string,
    type: 'keep_lock' | 'keep_unlock' | 'custom' | 'reset',
    interval?: number
  ): Promise<boolean> {
    const location = this.locations.get(locationName);
    if (!location) {
      return false;
    }

    try {
      const url = `https://${location.ip}:${location.port}/api/v1/developer/doors/${doorId}/lock_rule`;
      
      const body: any = { type };
      if (type === 'custom' && interval) {
        body.interval = interval;
      }

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${location.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        agent: httpsAgent
      });

      if (!response.ok) {
        throw new Error(`Failed to set lock rule: ${response.status}`);
      }

      const result = await response.json();
      return result.code === 'SUCCESS';
    } catch (error: any) {
      logger.error(`Error setting lock rule:`, error);
      return false;
    }
  }

  /**
   * Find a door by name across all locations
   */
  async findDoorByName(doorName: string): Promise<{ door: Door; location: string } | null> {
    const allDoors = await this.fetchAllDoors();
    
    const door = allDoors.find(d => 
      d.name.toLowerCase().includes(doorName.toLowerCase()) ||
      d.full_name?.toLowerCase().includes(doorName.toLowerCase())
    );
    
    if (door && door.location) {
      return { door, location: door.location };
    }
    
    return null;
  }

  /**
   * Get configured locations
   */
  getLocations(): string[] {
    return Array.from(this.locations.keys());
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.locations.size > 0;
  }
}

// Export singleton instance
export const unifiMultiLocation = new UnifiMultiLocationService();
export default unifiMultiLocation;