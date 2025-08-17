import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { logger } from '../utils/logger';
import fetch from 'node-fetch';
import https from 'https';
import { db } from '../utils/database';

const router = Router();

// Ignore self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Door configurations
const DOOR_CONFIGS = {
  dartmouth: {
    location: 'Dartmouth',
    token: process.env.DARTMOUTH_ACCESS_TOKEN || '',
    ip: process.env.DARTMOUTH_CONTROLLER_IP || '192.168.2.103',
    port: process.env.DARTMOUTH_API_PORT || '12445',
    doors: {
      office: {
        id: '4cea8c1f-b02a-4331-b8ab-4323ec537058',
        name: 'Dartmouth Office',
        description: 'Staff office door'
      }
    }
  },
  bedford: {
    location: 'Bedford',
    token: process.env.BEDFORD_ACCESS_TOKEN || '',
    ip: process.env.BEDFORD_CONTROLLER_IP || '192.168.2.212',
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

// Get all available doors
router.get('/doors', authenticate, async (req: Request, res: Response) => {
  try {
    const availableDoors = [];
    
    // Check Dartmouth doors
    if (DOOR_CONFIGS.dartmouth.token) {
      const dartmouthDoors = await fetchLocationDoors(DOOR_CONFIGS.dartmouth);
      availableDoors.push(...dartmouthDoors.map(door => ({
        ...door,
        location: 'Dartmouth',
        canUnlock: true
      })));
    }
    
    // Check Bedford doors (may not work yet due to UniFi OS auth)
    if (DOOR_CONFIGS.bedford.token) {
      const bedfordDoors = await fetchLocationDoors(DOOR_CONFIGS.bedford);
      availableDoors.push(...bedfordDoors.map(door => ({
        ...door,
        location: 'Bedford',
        canUnlock: bedfordDoors.length > 0
      })));
    }
    
    res.json({
      success: true,
      doors: availableDoors
    });
  } catch (error: any) {
    logger.error('Error fetching doors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch doors'
    });
  }
});

// Unlock a specific door
router.post('/doors/:location/:doorKey/unlock', 
  authenticate, 
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const { location, doorKey } = req.params;
      const { duration = 30 } = req.body;
      const userId = (req as any).user?.id;
      const username = (req as any).user?.username || 'Unknown';
      
      // Get location config
      const locationConfig = DOOR_CONFIGS[location as keyof typeof DOOR_CONFIGS];
      if (!locationConfig) {
        return res.status(404).json({
          success: false,
          error: 'Location not found'
        });
      }
      
      // Get door config
      const doorConfig = locationConfig.doors[doorKey as keyof typeof locationConfig.doors];
      if (!doorConfig) {
        return res.status(404).json({
          success: false,
          error: 'Door not found'
        });
      }
      
      // Unlock the door
      const unlocked = await unlockDoor(locationConfig, (doorConfig as any).id, duration, username);
      
      if (unlocked) {
        // Log to database
        try {
          await db.query(`
            INSERT INTO door_access_log (
              location, door_name, door_id, action, user_id, username, duration, success
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
        }
        
        res.json({
          success: true,
          message: `${(doorConfig as any).name} unlocked for ${duration} seconds`
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to unlock door'
        });
      }
    } catch (error: any) {
      logger.error('Error unlocking door:', error);
      res.status(500).json({
        success: false,
        error: error.message
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
      
      // For now, return basic status
      res.json({
        success: true,
        status: {
          id: (doorConfig as any).id,
          name: (doorConfig as any).name,
          location: location,
          locked: true, // We'd need to fetch actual status
          online: true,
          canUnlock: location === 'dartmouth' // Only Dartmouth works for now
        }
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

// Helper function to fetch doors from a location
async function fetchLocationDoors(locationConfig: any): Promise<any[]> {
  try {
    const url = `https://${locationConfig.ip}:${locationConfig.port}/api/v1/developer/doors`;
    
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
        return data.data;
      }
    }
    
    return [];
  } catch (error) {
    logger.debug(`Failed to fetch doors from ${locationConfig.location}:`, error);
    return [];
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
    const url = `https://${locationConfig.ip}:${locationConfig.port}/api/v1/developer/doors/${doorId}/remote_unlock`;
    
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
      timeout: 10000
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.code === 'SUCCESS') {
        logger.info(`Door ${doorId} unlocked by ${username} for ${duration}s`);
        return true;
      }
    }
    
    return false;
  } catch (error: any) {
    logger.error(`Failed to unlock door:`, error);
    return false;
  }
}

export default router;