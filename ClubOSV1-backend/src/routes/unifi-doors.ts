import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { logger } from '../utils/logger';
import fetch from 'node-fetch';
import https from 'https';
import { db } from '../utils/database';
import { actionEventService } from '../services/actionEventService';

const router = Router();

// Ignore self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Get console ID for cloud proxy
const CONSOLE_ID = process.env.UNIFI_CONSOLE_ID || '0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302';
const USE_CLOUD_PROXY = process.env.UNIFI_USE_REMOTE_ACCESS === 'true';

// Door configurations with cloud proxy support
const DOOR_CONFIGS = {
  dartmouth: {
    location: 'Dartmouth',
    token: process.env.DARTMOUTH_ACCESS_TOKEN || process.env.UNIFI_ACCESS_TOKEN || '',
    localIp: process.env.DARTMOUTH_CONTROLLER_IP || '192.168.2.103',
    port: process.env.DARTMOUTH_API_PORT || '12445',
    doors: {
      office: {
        id: '4cea8c1f-b02a-4331-b8ab-4323ec537058',
        name: 'Dartmouth Office',
        description: 'Staff office door'
      },
      staff: {
        id: '4cea8c1f-b02a-4331-b8ab-4323ec537058', // Same as office for now
        name: 'Staff Door',
        description: 'Staff door'
      }
    }
  },
  bedford: {
    location: 'Bedford',
    token: process.env.BEDFORD_ACCESS_TOKEN || '',
    localIp: process.env.BEDFORD_CONTROLLER_IP || '192.168.2.212',
    port: process.env.BEDFORD_API_PORT || '12445',
    doors: {
      front: {
        id: 'bedford-front-door-id', // Will need actual ID when working
        name: 'Bedford Front Door',
        description: 'Main entrance'
      },
      middle: {
        id: 'bedford-middle-door-id', // Will need actual ID when working
        name: 'Bedford Middle Door',
        description: 'Interior door'
      }
    }
  }
};

// Helper function to get the correct API URL
function getApiUrl(locationConfig: any, path: string): string {
  if (USE_CLOUD_PROXY) {
    // Use UniFi cloud proxy for production
    return `https://unifi.ui.com/proxy/consoles/${CONSOLE_ID}/access/api/v1/developer${path}`;
  } else {
    // Use direct connection for local development
    return `https://${locationConfig.localIp}:${locationConfig.port}/api/v1/developer${path}`;
  }
}

// Get all available doors
router.get('/doors', authenticate, async (req: Request, res: Response) => {
  try {
    const availableDoors = [];
    
    // Check Dartmouth doors
    if (DOOR_CONFIGS.dartmouth.token) {
      try {
        const dartmouthDoors = await fetchLocationDoors(DOOR_CONFIGS.dartmouth);
        availableDoors.push(...dartmouthDoors.map(door => ({
          ...door,
          location: 'Dartmouth',
          canUnlock: true
        })));
      } catch (error) {
        logger.debug('Could not fetch Dartmouth doors:', error);
        // Add manual doors as fallback
        Object.entries(DOOR_CONFIGS.dartmouth.doors).forEach(([key, door]) => {
          availableDoors.push({
            id: door.id,
            name: door.name,
            description: door.description,
            location: 'Dartmouth',
            canUnlock: true,
            status: 'unknown'
          });
        });
      }
    }
    
    // Check Bedford doors (may not work yet due to UniFi OS auth)
    if (DOOR_CONFIGS.bedford.token) {
      try {
        const bedfordDoors = await fetchLocationDoors(DOOR_CONFIGS.bedford);
        availableDoors.push(...bedfordDoors.map(door => ({
          ...door,
          location: 'Bedford',
          canUnlock: bedfordDoors.length > 0
        })));
      } catch (error) {
        logger.debug('Could not fetch Bedford doors:', error);
        // Add manual doors as fallback but mark as unavailable
        Object.entries(DOOR_CONFIGS.bedford.doors).forEach(([key, door]) => {
          availableDoors.push({
            id: door.id,
            name: door.name,
            description: door.description,
            location: 'Bedford',
            canUnlock: false,
            status: 'unavailable'
          });
        });
      }
    }
    
    res.json({
      success: true,
      doors: availableDoors,
      usingCloudProxy: USE_CLOUD_PROXY
    });
  } catch (error: any) {
    logger.error('Error fetching doors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch doors',
      message: error.message
    });
  }
});

// Unlock a specific door
router.post('/doors/:location/:doorKey/unlock', 
  authenticate, 
  roleGuard(['admin', 'operator', 'contractor']),
  async (req: Request, res: Response) => {
    try {
      const { location, doorKey } = req.params;
      const { duration = 30 } = req.body;
      const userId = (req as any).user?.id;
      const username = (req as any).user?.username || 'Unknown';
      const userRole = (req as any).user?.role;
      
      // Check contractor permissions if applicable
      if (userRole === 'contractor') {
        const contractorService = require('../services/contractorService');
        const canUnlock = await contractorService.canUnlockDoor(userId, location);
        if (!canUnlock) {
          logger.warn(`Contractor ${username} denied door unlock at ${location}`);
          return res.status(403).json({
            success: false,
            error: 'No permission to unlock doors at this location'
          });
        }
        // Log the door unlock for contractors
        await contractorService.logDoorUnlock(userId, location, doorKey);
      }
      
      logger.info(`Door unlock request: ${location}/${doorKey} by ${username} (${userRole})`);
      
      // Get location config
      const locationConfig = DOOR_CONFIGS[location as keyof typeof DOOR_CONFIGS];
      if (!locationConfig) {
        logger.warn(`Location not found: ${location}`);
        return res.status(404).json({
          success: false,
          error: 'Location not found'
        });
      }
      
      // Get door config
      const doorConfig = locationConfig.doors[doorKey as keyof typeof locationConfig.doors];
      if (!doorConfig) {
        logger.warn(`Door not found: ${doorKey} at ${location}`);
        return res.status(404).json({
          success: false,
          error: 'Door not found'
        });
      }
      
      // Check if token is configured
      if (!locationConfig.token) {
        logger.error(`No access token configured for ${location}`);
        return res.status(503).json({
          success: false,
          error: 'Door access not configured for this location'
        });
      }
      
      // Unlock the door
      const unlocked = await unlockDoor(locationConfig, (doorConfig as any).id, duration, username);
      
      if (unlocked) {
        // Log to database
        try {
          await db.query(`
            INSERT INTO door_access_log (
              location, door_name, door_id, action, user_id, username, duration, success, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          `, [
            location,
            (doorConfig as any).name,
            (doorConfig as any).id,
            'unlock',
            userId,
            username,
            duration,
            true
          ]);
        } catch (logError) {
          logger.error('Failed to log door access:', logError);
          // Don't fail the request if logging fails
        }

        // Emit action event for V3-PLS learning correlation
        actionEventService.emitAction({
          actionType: 'door_unlock',
          actionSource: 'unifi',
          operatorId: userId,
          operatorName: username,
          actionParams: {
            location,
            doorKey,
            doorId: (doorConfig as any).id,
            doorName: (doorConfig as any).name,
            duration
          },
          success: true
        }).catch(err => logger.debug('[ActionEvent] Non-blocking emit failed', err));

        res.json({
          success: true,
          message: `${(doorConfig as any).name} unlocked for ${duration} seconds`,
          usingCloudProxy: USE_CLOUD_PROXY
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to unlock door',
          message: 'Unable to communicate with door controller'
        });
      }
    } catch (error: any) {
      logger.error('Error unlocking door:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  }
);

// Get door status
router.get('/doors/:location/:doorKey/status',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { location, doorKey } = req.params;
      
      const locationConfig = DOOR_CONFIGS[location as keyof typeof DOOR_CONFIGS];
      if (!locationConfig) {
        return res.status(404).json({
          success: false,
          error: 'Location not found'
        });
      }
      
      const doorConfig = locationConfig.doors[doorKey as keyof typeof locationConfig.doors];
      if (!doorConfig) {
        return res.status(404).json({
          success: false,
          error: 'Door not found'
        });
      }
      
      // Try to fetch actual status
      let actualStatus = null;
      try {
        actualStatus = await fetchDoorStatus(locationConfig, (doorConfig as any).id);
      } catch (error) {
        logger.debug('Could not fetch door status:', error);
      }
      
      res.json({
        success: true,
        status: actualStatus || {
          id: (doorConfig as any).id,
          name: (doorConfig as any).name,
          location: location,
          locked: true, // Default to locked if we can't fetch
          online: false, // Default to offline if we can't fetch
          canUnlock: location === 'dartmouth' && !!locationConfig.token
        },
        usingCloudProxy: USE_CLOUD_PROXY
      });
    } catch (error: any) {
      logger.error('Error getting door status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// System status endpoint (for frontend health checks)
router.get('/system-status', authenticate, async (req: Request, res: Response) => {
  try {
    const status = {
      unifiAccess: {
        configured: !!(DOOR_CONFIGS.dartmouth.token || DOOR_CONFIGS.bedford.token),
        usingCloudProxy: USE_CLOUD_PROXY,
        locations: {
          dartmouth: !!DOOR_CONFIGS.dartmouth.token,
          bedford: !!DOOR_CONFIGS.bedford.token
        }
      }
    };
    
    res.json({
      success: true,
      status
    });
  } catch (error: any) {
    logger.error('Error getting system status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to fetch doors from a location
async function fetchLocationDoors(locationConfig: any): Promise<any[]> {
  try {
    const url = getApiUrl(locationConfig, '/doors');
    
    logger.debug(`Fetching doors from: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${locationConfig.token}`,
        'Accept': 'application/json'
      },
      agent: httpsAgent,
      timeout: 10000
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.code === 'SUCCESS' && data.data) {
        return data.data;
      }
    } else {
      logger.warn(`Failed to fetch doors: ${response.status} ${response.statusText}`);
    }
    
    return [];
  } catch (error: any) {
    logger.debug(`Failed to fetch doors from ${locationConfig.location}:`, error.message);
    throw error;
  }
}

// Helper function to fetch door status
async function fetchDoorStatus(locationConfig: any, doorId: string): Promise<any> {
  try {
    const url = getApiUrl(locationConfig, `/doors/${doorId}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${locationConfig.token}`,
        'Accept': 'application/json'
      },
      agent: httpsAgent,
      timeout: 5000
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.code === 'SUCCESS' && data.data) {
        return {
          id: data.data.id,
          name: data.data.name || data.data.full_name,
          locked: data.data.door_lock_relay_status === 'lock',
          online: data.data.is_bind_hub || false,
          canUnlock: true
        };
      }
    }
    
    return null;
  } catch (error) {
    logger.debug('Failed to fetch door status:', error);
    return null;
  }
}

// Helper function to unlock a door
async function unlockDoor(
  locationConfig: any,
  doorId: string,
  duration: number,
  username: string
): Promise<boolean> {
  try {
    const url = getApiUrl(locationConfig, `/doors/${doorId}/remote_unlock`);
    
    logger.info(`Attempting to unlock door at: ${USE_CLOUD_PROXY ? 'Cloud Proxy' : 'Direct'} - ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${locationConfig.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        actor_id: `clubos-${Date.now()}`,
        actor_name: `ClubOS - ${username}`,
        extra: {
          source: 'ClubOS',
          user: username,
          duration_seconds: duration,
          timestamp: new Date().toISOString()
        }
      }),
      agent: httpsAgent,
      timeout: 15000
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.code === 'SUCCESS') {
        logger.info(`Door ${doorId} unlocked by ${username} for ${duration}s`);
        return true;
      } else {
        logger.warn(`Door unlock failed: ${result.msg || 'Unknown error'}`);
      }
    } else {
      const errorText = await response.text();
      logger.error(`Door unlock HTTP error: ${response.status} - ${errorText}`);
    }
    
    return false;
  } catch (error: any) {
    logger.error(`Failed to unlock door:`, error.message);
    
    // Log more details for debugging
    if (error.code === 'ECONNREFUSED') {
      logger.error('Connection refused - check if cloud proxy is accessible or use Cloudflare Tunnel');
    } else if (error.code === 'ETIMEDOUT') {
      logger.error('Connection timeout - network issue or firewall blocking');
    }
    
    return false;
  }
}

export default router;