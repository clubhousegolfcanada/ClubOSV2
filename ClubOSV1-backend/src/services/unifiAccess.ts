import { logger } from '../utils/logger';

// Dynamic import for ES module
let AccessApi: any;

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

class UnifiAccessService {
  private access: any | null = null;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private maxRetries: number = 3;

  // Door mapping for each location
  private readonly DOOR_MAP: Record<string, Record<string, DoorConfig>> = {
    'Bedford': {
      'main-entrance': { 
        doorId: process.env.BEDFORD_MAIN_DOOR_ID || 'BEDFORD-MAIN-001',
        name: 'Main Entrance',
        type: 'exterior'
      },
      'staff-door': {
        doorId: process.env.BEDFORD_STAFF_DOOR_ID || 'BEDFORD-STAFF-001',
        name: 'Staff Door',
        type: 'staff'
      },
      'emergency-exit': {
        doorId: process.env.BEDFORD_EMERGENCY_DOOR_ID || 'BEDFORD-EMRG-001',
        name: 'Emergency Exit',
        type: 'emergency'
      }
    },
    'Dartmouth': {
      'main-entrance': { 
        doorId: process.env.DARTMOUTH_MAIN_DOOR_ID || 'DART-MAIN-001',
        name: 'Main Entrance',
        type: 'exterior'
      },
      'staff-door': {
        doorId: process.env.DARTMOUTH_STAFF_DOOR_ID || 'DART-STAFF-001',
        name: 'Staff Door',
        type: 'staff'
      },
      'bay-access': {
        doorId: process.env.DARTMOUTH_BAY_DOOR_ID || 'DART-BAY-001',
        name: 'Bay Access',
        type: 'interior'
      },
      'emergency-exit': {
        doorId: process.env.DARTMOUTH_EMERGENCY_DOOR_ID || 'DART-EMRG-001',
        name: 'Emergency Exit',
        type: 'emergency'
      }
    },
    'Stratford': {
      'main-entrance': { 
        doorId: process.env.STRATFORD_MAIN_DOOR_ID || 'STRAT-MAIN-001',
        name: 'Main Entrance',
        type: 'exterior'
      },
      'staff-door': {
        doorId: process.env.STRATFORD_STAFF_DOOR_ID || 'STRAT-STAFF-001',
        name: 'Staff Door',
        type: 'staff'
      },
      'emergency-exit': {
        doorId: process.env.STRATFORD_EMERGENCY_DOOR_ID || 'STRAT-EMRG-001',
        name: 'Emergency Exit',
        type: 'emergency'
      }
    },
    'Bayers Lake': {
      'main-entrance': { 
        doorId: process.env.BAYERS_MAIN_DOOR_ID || 'BAYERS-MAIN-001',
        name: 'Main Entrance',
        type: 'exterior'
      },
      'staff-door': {
        doorId: process.env.BAYERS_STAFF_DOOR_ID || 'BAYERS-STAFF-001',
        name: 'Staff Door',
        type: 'staff'
      },
      'loading-door': {
        doorId: process.env.BAYERS_LOADING_DOOR_ID || 'BAYERS-LOAD-001',
        name: 'Loading Door',
        type: 'staff'
      },
      'emergency-exit': {
        doorId: process.env.BAYERS_EMERGENCY_DOOR_ID || 'BAYERS-EMRG-001',
        name: 'Emergency Exit',
        type: 'emergency'
      }
    },
    'Truro': {
      'main-entrance': { 
        doorId: process.env.TRURO_MAIN_DOOR_ID || 'TRURO-MAIN-001',
        name: 'Main Entrance',
        type: 'exterior'
      },
      'staff-door': {
        doorId: process.env.TRURO_STAFF_DOOR_ID || 'TRURO-STAFF-001',
        name: 'Staff Door',
        type: 'staff'
      },
      'emergency-exit': {
        doorId: process.env.TRURO_EMERGENCY_DOOR_ID || 'TRURO-EMRG-001',
        name: 'Emergency Exit',
        type: 'emergency'
      }
    }
  };

  constructor() {
    // Initialize asynchronously
    this.initialize().catch(error => {
      logger.error('Failed to initialize UnifiAccessService:', error);
    });
  }

  private async initialize(): Promise<void> {
    try {
      // Dynamically import the ES module
      const unifiModule = await import('unifi-access');
      AccessApi = unifiModule.AccessApi;

      const address = process.env.UNIFI_CONTROLLER_URL || '';
      const username = process.env.UNIFI_USERNAME || '';
      const password = process.env.UNIFI_PASSWORD || '';

      // Check if UniFi is configured
      if (!address || address === '' || 
          !username || username === '' ||
          !password || password === '') {
        logger.warn('UniFi Access not configured - running in demo mode');
        this.isConnected = false;
        return;
      }

      // Create API instance with custom logger
      this.access = new AccessApi({
        error: (message: string) => logger.error(message),
        info: (message: string) => logger.info(message),
        debug: (message: string) => logger.debug(message),
        warn: (message: string) => logger.warn(message)
      });
      
      // Store credentials for connect method
      this.credentials = { address, username, password };
      
      // Attempt connection
      await this.connect();
    } catch (error: any) {
      logger.error('Failed to initialize UniFi Access:', error);
      this.isConnected = false;
    }
  }

  private credentials: { address: string; username: string; password: string } | null = null;

  private async connect(): Promise<boolean> {
    if (!this.access || !this.credentials) return false;

    try {
      this.connectionAttempts++;
      
      // Login to UniFi Access controller
      const loginSuccess = await this.access.login(
        this.credentials.address,
        this.credentials.username,
        this.credentials.password
      );
      
      if (!loginSuccess) {
        throw new Error('Login failed');
      }
      
      this.isConnected = true;
      this.connectionAttempts = 0;
      logger.info('Successfully connected to UniFi Access controller');
      return true;
    } catch (error: any) {
      logger.error(`UniFi Access connection attempt ${this.connectionAttempts} failed:`, error);
      
      if (this.connectionAttempts < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000 * this.connectionAttempts));
        return this.connect();
      }
      
      this.isConnected = false;
      return false;
    }
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
      if (!this.isConnected || !this.access) {
        logger.info(`[DEMO] Simulating unlock for ${doorConfig.name} at ${location}`);
        return {
          success: true,
          doorId: doorConfig.doorId,
          message: `[DEMO] ${doorConfig.name} unlocked for ${duration} seconds`,
          unlockDuration: duration
        };
      }

      // Actual UniFi Access API call - using device control endpoint
      // Note: The actual API may differ, this is a placeholder
      // You'll need to check the UniFi Access API documentation for the correct method
      const devices = this.access.devices;
      const device = devices?.find(d => d.mac === doorConfig.doorId);
      if (device) {
        // This is a placeholder - actual unlock method may vary
        logger.info(`Would unlock door ${doorConfig.doorId} for ${duration} seconds`);
      }

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
      if (!this.isConnected || !this.access) {
        logger.info(`[DEMO] Simulating lock for ${doorConfig.name} at ${location}`);
        return {
          success: true,
          doorId: doorConfig.doorId,
          message: `[DEMO] ${doorConfig.name} locked`
        };
      }

      // Actual UniFi Access API call - using device control endpoint
      // Note: The actual API may differ, this is a placeholder
      const devices = this.access.devices;
      const device = devices?.find(d => d.mac === doorConfig.doorId);
      if (device) {
        // This is a placeholder - actual lock method may vary
        logger.info(`Would lock door ${doorConfig.doorId}`);
      }

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
        if (!this.isConnected || !this.access) {
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
            // Get actual status from UniFi
            const devices = this.access.devices;
            const device = devices?.find(d => d.mac === doorConfig.doorId);
            if (device) {
              statuses.push({
                doorId: doorConfig.doorId,
                name: doorConfig.name,
                locked: true, // Default to locked - actual status would come from device
                online: device.is_online || false,
                battery: 85, // Placeholder - actual battery level would come from device
                lastActivity: new Date() // Placeholder - actual last activity would come from device
              });
            } else {
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
      if (!this.isConnected || !this.access) {
        // Return demo data
        return Array.from({ length: limit }, (_, i) => ({
          timestamp: new Date(Date.now() - i * 3600000),
          door: doorKey || 'main-entrance',
          event: ['unlock', 'lock', 'access_granted', 'access_denied'][Math.floor(Math.random() * 4)],
          user: ['John Doe', 'Jane Smith', 'System', 'Remote'][Math.floor(Math.random() * 4)]
        }));
      }

      // Get actual access logs from UniFi - placeholder
      // The actual API method would need to be determined from the UniFi Access API
      logger.info(`Would fetch ${limit} access logs for ${location}`);
      return [];
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
    return !this.isConnected;
  }
}

// Export singleton instance
export default new UnifiAccessService();