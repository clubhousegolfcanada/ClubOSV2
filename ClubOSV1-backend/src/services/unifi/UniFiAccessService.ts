import { logger } from '../../utils/logger';
import { cloudflareTunnelManager } from '../cloudflare/CloudflareTunnelManager';
import NodeCache from 'node-cache';
import https from 'https';

interface Door {
  id: string;
  name: string;
  full_name: string;
  mac: string;
  location: string;
  floor_id?: string;
  type: string;
  is_bind_hub: boolean;
  door_lock_relay_status: 'lock' | 'unlock';
  door_position_status: 'open' | 'close' | null;
}

interface UnlockResult {
  success: boolean;
  doorId: string;
  location: string;
  message?: string;
  unlockDuration?: number;
  timestamp: string;
}

interface DoorStatus {
  id: string;
  name: string;
  location: string;
  status: 'locked' | 'unlocked';
  position: 'open' | 'closed' | 'unknown';
  lastActivity?: string;
  online: boolean;
}

interface AccessToken {
  token: string;
  expiresAt: number;
  location: string;
}

export class UniFiAccessService {
  private cache: NodeCache;
  private tokens: Map<string, AccessToken>;
  private readonly httpsAgent: https.Agent;
  
  constructor() {
    // Cache door status for 60 seconds
    this.cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });
    this.tokens = new Map();
    
    // HTTPS agent for self-signed certificates
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });
  }
  
  /**
   * Get API URL for a specific location and path
   */
  private getApiUrl(location: string, path: string): string {
    // Use Cloudflare tunnel manager to get the appropriate URL
    return cloudflareTunnelManager.getTunnelUrl(location, `/api/v1/developer${path}`);
  }
  
  /**
   * Get access token for a location
   */
  private async getAccessToken(location: string): Promise<string> {
    const cached = this.tokens.get(location);
    
    // Check if we have a valid cached token
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }
    
    // Get location-specific token from environment
    const envKey = `UNIFI_${location.toUpperCase()}_TOKEN`;
    const token = process.env[envKey];
    
    if (!token) {
      // Fallback to general token if location-specific not found
      const generalToken = process.env.UNIFI_ACCESS_API_TOKEN;
      if (!generalToken) {
        throw new Error(`No access token configured for location: ${location}`);
      }
      return generalToken;
    }
    
    // Cache the token (tokens don't expire but we refresh every hour for safety)
    this.tokens.set(location, {
      token,
      expiresAt: Date.now() + 3600000, // 1 hour
      location
    });
    
    return token;
  }
  
  /**
   * Make authenticated request to UniFi Access API
   */
  private async authenticatedRequest(url: string, location: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getAccessToken(location);
    
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      }
    };
    
    // Add HTTPS agent for Node.js fetch if using self-signed certificates
    if (url.startsWith('https://')) {
      (requestOptions as any).agent = this.httpsAgent;
    }
    
    logger.debug(`UniFi Access API request to ${location}:`, {
      url,
      method: options.method || 'GET'
    });
    
    return fetch(url, requestOptions);
  }
  
  /**
   * Unlock a door at a specific location
   */
  async unlockDoor(location: string, doorId: string, duration: number = 5): Promise<UnlockResult> {
    try {
      // Check if location is available
      if (!cloudflareTunnelManager.isLocationAvailable(location)) {
        throw new Error(`Location ${location} is not available`);
      }
      
      const url = this.getApiUrl(location, `/doors/${doorId}/unlock`);
      
      logger.info(`Unlocking door at ${location}:`, { doorId, duration });
      
      const response = await this.authenticatedRequest(url, location, {
        method: 'POST',
        body: JSON.stringify({ 
          duration,
          reason: 'Remote unlock via ClubOS'
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to unlock door: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      
      // Log door access for audit trail
      await this.logDoorAccess(location, doorId, 'unlock', true, duration);
      
      // Clear cache for this door
      this.cache.del(`door:${location}:${doorId}`);
      
      return {
        success: true,
        doorId,
        location,
        message: 'Door unlocked successfully',
        unlockDuration: duration,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      logger.error(`Failed to unlock door at ${location}:`, {
        doorId,
        error: error.message
      });
      
      await this.logDoorAccess(location, doorId, 'unlock', false, duration, error.message);
      
      return {
        success: false,
        doorId,
        location,
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Get door ID by MAC address or name
   */
  async getDoorId(location: string, doorKey: string): Promise<string> {
    // Check cache first
    const cacheKey = `doorId:${location}:${doorKey}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Fetch all doors for the location
    const doors = await this.getDoorsByLocation(location);
    
    // Find door by MAC or name
    const door = doors.find(d => 
      d.mac?.toLowerCase() === doorKey.toLowerCase() ||
      d.name?.toLowerCase() === doorKey.toLowerCase() ||
      d.id === doorKey
    );
    
    if (!door) {
      throw new Error(`Door not found: ${doorKey} at ${location}`);
    }
    
    // Cache the result
    this.cache.set(cacheKey, door.id, 3600); // Cache for 1 hour
    
    return door.id;
  }
  
  /**
   * Get all doors for a location
   */
  async getDoorsByLocation(location: string): Promise<Door[]> {
    const cacheKey = `doors:${location}`;
    const cached = this.cache.get<Door[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const url = this.getApiUrl(location, '/doors');
      const response = await this.authenticatedRequest(url, location);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch doors: ${response.status}`);
      }
      
      const result = await response.json();
      const doors = (result.data || []).map((door: any) => ({
        ...door,
        location
      }));
      
      // Cache the result
      this.cache.set(cacheKey, doors);
      
      return doors;
    } catch (error: any) {
      logger.error(`Failed to fetch doors for ${location}:`, error);
      return [];
    }
  }
  
  /**
   * Get status of all doors across all locations
   */
  async getAllDoorsStatus(): Promise<DoorStatus[]> {
    const locations = cloudflareTunnelManager.getAvailableLocations();
    const allDoors: DoorStatus[] = [];
    
    for (const location of locations) {
      try {
        const doors = await this.getDoorsByLocation(location);
        
        for (const door of doors) {
          allDoors.push({
            id: door.id,
            name: door.name,
            location,
            status: door.door_lock_relay_status === 'lock' ? 'locked' : 'unlocked',
            position: door.door_position_status === 'open' ? 'open' : 
                     door.door_position_status === 'close' ? 'closed' : 'unknown',
            online: door.is_bind_hub
          });
        }
      } catch (error) {
        logger.error(`Failed to get doors for ${location}:`, error);
      }
    }
    
    return allDoors;
  }
  
  /**
   * Lock a door at a specific location
   */
  async lockDoor(location: string, doorId: string): Promise<UnlockResult> {
    try {
      const url = this.getApiUrl(location, `/doors/${doorId}/lock`);
      
      logger.info(`Locking door at ${location}:`, { doorId });
      
      const response = await this.authenticatedRequest(url, location, {
        method: 'POST',
        body: JSON.stringify({ 
          reason: 'Remote lock via ClubOS'
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to lock door: ${response.status} - ${errorText}`);
      }
      
      await this.logDoorAccess(location, doorId, 'lock', true);
      
      // Clear cache for this door
      this.cache.del(`door:${location}:${doorId}`);
      
      return {
        success: true,
        doorId,
        location,
        message: 'Door locked successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      logger.error(`Failed to lock door at ${location}:`, error);
      
      await this.logDoorAccess(location, doorId, 'lock', false, 0, error.message);
      
      return {
        success: false,
        doorId,
        location,
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Get single door status
   */
  async getDoorStatus(location: string, doorId: string): Promise<DoorStatus | null> {
    try {
      const url = this.getApiUrl(location, `/doors/${doorId}`);
      const response = await this.authenticatedRequest(url, location);
      
      if (!response.ok) {
        throw new Error(`Failed to get door status: ${response.status}`);
      }
      
      const door = await response.json();
      
      return {
        id: door.id,
        name: door.name,
        location,
        status: door.door_lock_relay_status === 'lock' ? 'locked' : 'unlocked',
        position: door.door_position_status === 'open' ? 'open' : 
                 door.door_position_status === 'close' ? 'closed' : 'unknown',
        lastActivity: door.last_activity,
        online: door.is_bind_hub
      };
    } catch (error: any) {
      logger.error(`Failed to get door status:`, error);
      return null;
    }
  }
  
  /**
   * Test connectivity to all locations
   */
  async testConnectivity(): Promise<Map<string, boolean>> {
    return cloudflareTunnelManager.testAllConnections();
  }
  
  /**
   * Log door access for audit trail
   */
  private async logDoorAccess(
    location: string, 
    doorId: string, 
    action: 'lock' | 'unlock',
    success: boolean,
    duration?: number,
    error?: string
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      location,
      doorId,
      action,
      success,
      duration,
      error,
      source: 'ClubOS',
      tunnelMode: cloudflareTunnelManager.isCloudflareEnabled() ? 'cloudflare' : 'direct'
    };
    
    logger.info('Door access log:', logEntry);
    
    // In production, this would also write to a database for audit trail
    // await db.insertDoorAccessLog(logEntry);
  }
  
  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.flushAll();
    logger.info('UniFi Access cache cleared');
  }
  
  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    cloudflareEnabled: boolean;
    locations: Array<{ name: string; available: boolean; connected: boolean }>;
  }> {
    const connectivity = await this.testConnectivity();
    const locations = cloudflareTunnelManager.getAvailableLocations();
    
    return {
      healthy: Array.from(connectivity.values()).some(v => v),
      cloudflareEnabled: cloudflareTunnelManager.isCloudflareEnabled(),
      locations: locations.map(loc => ({
        name: loc,
        available: cloudflareTunnelManager.isLocationAvailable(loc),
        connected: connectivity.get(loc) || false
      }))
    };
  }
}

// Export singleton instance
export const unifiAccessService = new UniFiAccessService();
export default unifiAccessService;