import { logger } from '../../utils/logger';

interface TunnelConfig {
  hostname: string;
  port: number;
  protocol: 'http' | 'https';
  originRequest?: {
    noTLSVerify?: boolean;
    connectTimeout?: string;
    httpHostHeader?: string;
  };
}

interface LocationConfig {
  name: string;
  tunnelId: string;
  tunnelConfig: TunnelConfig;
  enabled: boolean;
}

export class CloudflareTunnelManager {
  private tunnels: Map<string, LocationConfig>;
  private useCloudflare: boolean;
  
  constructor() {
    this.useCloudflare = process.env.UNIFI_USE_CLOUDFLARE === 'true';
    this.tunnels = new Map();
    this.initializeTunnels();
  }
  
  private initializeTunnels(): void {
    // Initialize tunnel configurations for each location
    const locations: LocationConfig[] = [
      {
        name: 'dartmouth',
        tunnelId: process.env.CLOUDFLARE_TUNNEL_DARTMOUTH_ID || '',
        tunnelConfig: {
          hostname: process.env.CLOUDFLARE_TUNNEL_DARTMOUTH_HOSTNAME || 'dartmouth-unifi.clubos.internal',
          port: 12445,
          protocol: 'https',
          originRequest: {
            noTLSVerify: true,
            connectTimeout: '30s'
          }
        },
        enabled: true
      },
      {
        name: 'bedford',
        tunnelId: process.env.CLOUDFLARE_TUNNEL_BEDFORD_ID || '',
        tunnelConfig: {
          hostname: process.env.CLOUDFLARE_TUNNEL_BEDFORD_HOSTNAME || 'bedford-unifi.clubos.internal',
          port: 12445,
          protocol: 'https',
          originRequest: {
            noTLSVerify: true,
            connectTimeout: '30s'
          }
        },
        enabled: true
      },
      {
        name: 'stratford',
        tunnelId: process.env.CLOUDFLARE_TUNNEL_STRATFORD_ID || '',
        tunnelConfig: {
          hostname: process.env.CLOUDFLARE_TUNNEL_STRATFORD_HOSTNAME || 'stratford-unifi.clubos.internal',
          port: 12445,
          protocol: 'https',
          originRequest: {
            noTLSVerify: true,
            connectTimeout: '30s'
          }
        },
        enabled: false // Enable when location is ready
      },
      {
        name: 'bayerslake',
        tunnelId: process.env.CLOUDFLARE_TUNNEL_BAYERSLAKE_ID || '',
        tunnelConfig: {
          hostname: process.env.CLOUDFLARE_TUNNEL_BAYERSLAKE_HOSTNAME || 'bayerslake-unifi.clubos.internal',
          port: 12445,
          protocol: 'https',
          originRequest: {
            noTLSVerify: true,
            connectTimeout: '30s'
          }
        },
        enabled: false // Enable when location is ready
      },
      {
        name: 'truro',
        tunnelId: process.env.CLOUDFLARE_TUNNEL_TRURO_ID || '',
        tunnelConfig: {
          hostname: process.env.CLOUDFLARE_TUNNEL_TRURO_HOSTNAME || 'truro-unifi.clubos.internal',
          port: 12445,
          protocol: 'https',
          originRequest: {
            noTLSVerify: true,
            connectTimeout: '30s'
          }
        },
        enabled: false // Enable when location is ready
      }
    ];
    
    // Load configurations into map
    for (const location of locations) {
      if (location.enabled) {
        this.tunnels.set(location.name.toLowerCase(), location);
        logger.info(`Initialized Cloudflare tunnel for ${location.name}`, {
          hostname: location.tunnelConfig.hostname,
          enabled: location.enabled
        });
      }
    }
    
    logger.info(`CloudflareTunnelManager initialized with ${this.tunnels.size} active tunnels`);
  }
  
  /**
   * Get tunnel URL for a specific location and path
   */
  getTunnelUrl(location: string, path: string): string {
    const locationKey = location.toLowerCase();
    const config = this.tunnels.get(locationKey);
    
    if (!config) {
      throw new Error(`Unknown or disabled location: ${location}`);
    }
    
    const { protocol, hostname, port } = config.tunnelConfig;
    
    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    // Build URL based on whether we're using Cloudflare tunnels or direct access
    if (this.useCloudflare) {
      // When using Cloudflare tunnels, we connect via the tunnel hostname
      return `${protocol}://${hostname}${normalizedPath}`;
    } else {
      // Fallback to direct connection (requires port forwarding or VPN)
      const directHost = this.getDirectHost(location);
      return `${protocol}://${directHost}:${port}${normalizedPath}`;
    }
  }
  
  /**
   * Get direct host for fallback (non-Cloudflare) access
   */
  private getDirectHost(location: string): string {
    const directHosts: Record<string, string> = {
      dartmouth: process.env.UNIFI_DARTMOUTH_HOST || 'localhost',
      bedford: process.env.UNIFI_BEDFORD_HOST || 'localhost',
      stratford: process.env.UNIFI_STRATFORD_HOST || 'localhost',
      bayerslake: process.env.UNIFI_BAYERSLAKE_HOST || 'localhost',
      truro: process.env.UNIFI_TRURO_HOST || 'localhost'
    };
    
    return directHosts[location.toLowerCase()] || 'localhost';
  }
  
  /**
   * Check if a location is available
   */
  isLocationAvailable(location: string): boolean {
    const locationKey = location.toLowerCase();
    const config = this.tunnels.get(locationKey);
    return config?.enabled || false;
  }
  
  /**
   * Get all available locations
   */
  getAvailableLocations(): string[] {
    return Array.from(this.tunnels.values())
      .filter(config => config.enabled)
      .map(config => config.name);
  }
  
  /**
   * Test tunnel connectivity for a location
   */
  async testConnection(location: string): Promise<boolean> {
    try {
      const url = this.getTunnelUrl(location, '/health');
      
      logger.info(`Testing Cloudflare tunnel connection to ${location}`, { url });
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeout);
      
      const success = response.ok || response.status === 401; // 401 means API is responding but needs auth
      
      logger.info(`Cloudflare tunnel test for ${location}: ${success ? 'SUCCESS' : 'FAILED'}`, {
        status: response.status,
        statusText: response.statusText
      });
      
      return success;
    } catch (error: any) {
      logger.error(`Cloudflare tunnel test failed for ${location}:`, {
        error: error.message,
        type: error.name
      });
      return false;
    }
  }
  
  /**
   * Test all tunnel connections
   */
  async testAllConnections(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (const location of this.getAvailableLocations()) {
      const success = await this.testConnection(location);
      results.set(location, success);
    }
    
    return results;
  }
  
  /**
   * Get tunnel configuration for a location
   */
  getTunnelConfig(location: string): LocationConfig | undefined {
    return this.tunnels.get(location.toLowerCase());
  }
  
  /**
   * Check if Cloudflare tunnels are enabled
   */
  isCloudflareEnabled(): boolean {
    return this.useCloudflare;
  }
  
  /**
   * Enable or disable a location dynamically
   */
  setLocationEnabled(location: string, enabled: boolean): void {
    const config = this.tunnels.get(location.toLowerCase());
    if (config) {
      config.enabled = enabled;
      logger.info(`Location ${location} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }
}

// Export singleton instance
export const cloudflareTunnelManager = new CloudflareTunnelManager();
export default cloudflareTunnelManager;