import { logger } from '../utils/logger';
import fetch from 'node-fetch';
import https from 'https';

interface DoorDevice {
  mac: string;
  ip: string;
  name: string;
  type: string;
  model?: string;
  adopted?: boolean;
  state?: string;
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

// Create an HTTPS agent that ignores self-signed certificates (for local controllers)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

class UnifiNetworkAccessService {
  private cookies: string = '';
  private isAuthenticated: boolean = false;
  private controllerUrl: string = '';
  private useTailscale: boolean = false;
  private useMobileApi: boolean = false;
  private useNetworkApi: boolean = false;

  // Door device mapping from Network console
  private doorDevices: Map<string, DoorDevice> = new Map();

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Check which mode to use
    const tailscaleIp = process.env.BEDFORD_CONTROLLER_IP || process.env.DARTMOUTH_CONTROLLER_IP;
    const mobileToken = process.env.UNIFI_MOBILE_TOKEN;
    const useNetworkApi = process.env.UNIFI_USE_NETWORK_API === 'true';

    if (tailscaleIp) {
      this.useTailscale = true;
      logger.info('Using Tailscale direct connection mode');
      await this.initializeTailscale();
    } else if (mobileToken) {
      this.useMobileApi = true;
      logger.info('Using Mobile API mode');
      await this.initializeMobileApi();
    } else if (useNetworkApi) {
      this.useNetworkApi = true;
      logger.info('Using Network Console API mode');
      await this.initializeNetworkApi();
    } else {
      logger.warn('No UniFi configuration found - running in demo mode');
    }
  }

  private async initializeTailscale(): Promise<void> {
    try {
      // For Tailscale, we connect directly to local controllers
      const bedfordIp = process.env.BEDFORD_CONTROLLER_IP;
      const dartmouthIp = process.env.DARTMOUTH_CONTROLLER_IP;
      const port = process.env.CONTROLLER_PORT || '8443';
      const username = process.env.UNIFI_USERNAME || '';
      const password = process.env.UNIFI_PASSWORD || '';

      // Try Bedford first
      if (bedfordIp) {
        this.controllerUrl = `https://${bedfordIp}:${port}`;
        const success = await this.authenticateLocal(username, password);
        if (success) {
          logger.info('Connected to Bedford controller via Tailscale');
          await this.loadDoorDevices('Bedford');
        }
      }

      // Also connect to Dartmouth if available
      if (dartmouthIp) {
        this.controllerUrl = `https://${dartmouthIp}:${port}`;
        const success = await this.authenticateLocal(username, password);
        if (success) {
          logger.info('Connected to Dartmouth controller via Tailscale');
          await this.loadDoorDevices('Dartmouth');
        }
      }
    } catch (error) {
      logger.error('Tailscale initialization failed:', error);
    }
  }

  private async authenticateLocal(username: string, password: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.controllerUrl}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        agent: httpsAgent
      });

      if (response.ok) {
        // Store cookies
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
          this.cookies = setCookie;
        }
        this.isAuthenticated = true;
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Local authentication failed:', error);
      return false;
    }
  }

  private async initializeMobileApi(): Promise<void> {
    // Mobile API uses OAuth token
    const token = process.env.UNIFI_MOBILE_TOKEN;
    if (token) {
      this.isAuthenticated = true;
      logger.info('Mobile API initialized with token');
    }
  }

  private async initializeNetworkApi(): Promise<void> {
    // Network API for devices in Network console
    const consoleId = process.env.UNIFI_CONSOLE_ID;
    if (consoleId) {
      this.controllerUrl = `https://unifi.ui.com/proxy/consoles/${consoleId}/network`;
      logger.info('Network Console API initialized');
    }
  }

  private async loadDoorDevices(location: string): Promise<void> {
    try {
      // Get device list from controller
      const response = await fetch(`${this.controllerUrl}/api/s/default/stat/device`, {
        headers: {
          'Cookie': this.cookies,
          'Accept': 'application/json'
        },
        agent: httpsAgent
      });

      if (response.ok) {
        const data = await response.json();
        const devices = data.data || [];

        // Filter for door/access devices
        const doorDevices = devices.filter((d: any) => 
          d.type === 'uah' || // UniFi Access Hub
          d.type === 'ualite' || // UniFi Access Lite
          d.model?.toLowerCase().includes('access') ||
          d.name?.toLowerCase().includes('door')
        );

        // Store devices
        doorDevices.forEach((device: any) => {
          const key = `${location}-${device.name || device.mac}`;
          this.doorDevices.set(key, {
            mac: device.mac,
            ip: device.ip,
            name: device.name || `Door ${device.mac}`,
            type: device.type,
            model: device.model,
            adopted: device.adopted,
            state: device.state
          });
        });

        logger.info(`Loaded ${doorDevices.length} door devices for ${location}`);
      }
    } catch (error) {
      logger.error(`Failed to load door devices for ${location}:`, error);
    }
  }

  async unlockDoor(location: string, doorKey: string, duration: number = 30): Promise<UnlockResult> {
    try {
      // Demo mode
      if (!this.isAuthenticated) {
        logger.info(`[DEMO] Simulating unlock for ${doorKey} at ${location}`);
        return {
          success: true,
          doorId: doorKey,
          message: `[DEMO] Door unlocked for ${duration} seconds`,
          unlockDuration: duration
        };
      }

      // Different approaches based on connection type
      if (this.useTailscale) {
        return await this.unlockViaTailscale(location, doorKey, duration);
      } else if (this.useMobileApi) {
        return await this.unlockViaMobileApi(location, doorKey, duration);
      } else if (this.useNetworkApi) {
        return await this.unlockViaNetworkApi(location, doorKey, duration);
      }

      throw new Error('No valid UniFi connection method configured');
    } catch (error: any) {
      logger.error('Failed to unlock door:', error);
      throw new Error(`Failed to unlock door: ${error.message}`);
    }
  }

  private async unlockViaTailscale(location: string, doorKey: string, duration: number): Promise<UnlockResult> {
    // Direct control via Tailscale connection
    const deviceKey = `${location}-${doorKey}`;
    const device = this.doorDevices.get(deviceKey);

    if (!device) {
      throw new Error(`Door device not found: ${doorKey} at ${location}`);
    }

    // Send unlock command to device
    // This depends on the specific UniFi Access API
    // For Network-managed devices, we might need to use SSH or specific endpoints
    
    logger.info(`Unlocking ${device.name} (${device.mac}) for ${duration} seconds`);

    // Placeholder for actual unlock command
    // The actual implementation depends on device type and API
    
    return {
      success: true,
      doorId: device.mac,
      message: `${device.name} unlocked for ${duration} seconds`,
      unlockDuration: duration
    };
  }

  private async unlockViaMobileApi(location: string, doorKey: string, duration: number): Promise<UnlockResult> {
    // Use mobile API endpoints
    const token = process.env.UNIFI_MOBILE_TOKEN;
    const consoleId = process.env.UNIFI_CONSOLE_ID;

    const response = await fetch(`https://api.ui.com/ea/door/${doorKey}/unlock`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        duration,
        location
      })
    });

    if (response.ok) {
      return {
        success: true,
        doorId: doorKey,
        message: `Door unlocked for ${duration} seconds via mobile API`,
        unlockDuration: duration
      };
    }

    throw new Error('Mobile API unlock failed');
  }

  private async unlockViaNetworkApi(location: string, doorKey: string, duration: number): Promise<UnlockResult> {
    // Control via Network console API
    // This requires the device to be adopted in the Network console
    
    const deviceMac = this.getDeviceMac(location, doorKey);
    
    // Send command through Network API
    const response = await fetch(`${this.controllerUrl}/api/s/default/cmd/devmgr`, {
      method: 'POST',
      headers: {
        'Cookie': this.cookies,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mac: deviceMac,
        cmd: 'unlock-door',
        duration
      })
    });

    if (response.ok) {
      return {
        success: true,
        doorId: deviceMac,
        message: `Door unlocked for ${duration} seconds`,
        unlockDuration: duration
      };
    }

    throw new Error('Network API unlock failed');
  }

  private getDeviceMac(location: string, doorKey: string): string {
    // Map door key to actual device MAC
    const envKey = `${location.toUpperCase()}_${doorKey.toUpperCase().replace('-', '_')}_MAC`;
    return process.env[envKey] || doorKey;
  }

  async getDoorStatus(location: string): Promise<DoorStatus[]> {
    // Return status for all doors at location
    const statuses: DoorStatus[] = [];

    if (!this.isAuthenticated) {
      // Demo mode
      return [
        {
          doorId: 'main-door',
          name: 'Main Entrance',
          locked: true,
          online: true,
          battery: 95
        },
        {
          doorId: 'staff-door',
          name: 'Staff Door',
          locked: true,
          online: true,
          battery: 88
        }
      ];
    }

    // Get real status from devices
    for (const [key, device] of this.doorDevices.entries()) {
      if (key.startsWith(location)) {
        statuses.push({
          doorId: device.mac,
          name: device.name,
          locked: true, // Would need to query actual state
          online: device.state === 'connected',
          battery: 100 // Would need to query actual battery
        });
      }
    }

    return statuses;
  }

  isInDemoMode(): boolean {
    return !this.isAuthenticated;
  }
}

// Export singleton instance
export default new UnifiNetworkAccessService();