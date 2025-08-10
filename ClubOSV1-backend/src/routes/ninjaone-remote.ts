import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { hasMinimumRole } from '../utils/roleUtils';
import { DEVICE_REGISTRY } from '../config/ninjaDevices';
import axios from 'axios';

const router = express.Router();

// Cache for NinjaOne access token
let ninjaOneToken: string | null = null;
let tokenExpiry: Date | null = null;

// Get NinjaOne access token
async function getNinjaOneToken(): Promise<string> {
  // Return cached token if still valid
  if (ninjaOneToken && tokenExpiry && new Date() < tokenExpiry) {
    return ninjaOneToken;
  }

  try {
    const response = await axios.post(
      `${process.env.NINJAONE_BASE_URL}/oauth/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.NINJAONE_CLIENT_ID || '',
        client_secret: process.env.NINJAONE_CLIENT_SECRET || '',
        scope: 'monitoring management'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    ninjaOneToken = response.data.access_token;
    // Set expiry 5 minutes before actual expiry for safety
    tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);
    
    return ninjaOneToken;
  } catch (error) {
    console.error('NinjaOne authentication failed:', error);
    throw new Error('Failed to authenticate with NinjaOne');
  }
}

// Get remote desktop session URL for a specific device
router.post('/session', authenticateToken, async (req, res) => {
  try {
    // Check permissions
    if (!hasMinimumRole(req.user!.role, 'operator')) {
      return res.status(403).json({ 
        success: false, 
        error: 'Insufficient permissions' 
      });
    }

    const { location, bayNumber } = req.body;

    if (!location || !bayNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Location and bay number required' 
      });
    }

    // Get device info from registry
    const deviceKey = `bay-${bayNumber}`;
    const device = DEVICE_REGISTRY[location]?.[deviceKey];

    if (!device) {
      return res.status(404).json({ 
        success: false, 
        error: `Device not found for ${location} Bay ${bayNumber}` 
      });
    }

    // If we're in demo mode or NinjaOne isn't configured
    if (!process.env.NINJAONE_CLIENT_ID || device.deviceId.includes('DEVICE_ID')) {
      // Return placeholder response for demo
      return res.json({
        success: true,
        data: {
          method: 'fallback',
          deviceName: device.name,
          message: `NinjaOne not configured. Device: ${device.name}`,
          fallbackUrl: 'https://my.splashtop.com/computers'
        }
      });
    }

    try {
      const token = await getNinjaOneToken();

      // Attempt to create a remote session via NinjaOne API
      // Note: The exact endpoint may vary based on NinjaOne's API version
      const sessionResponse = await axios.post(
        `${process.env.NINJAONE_BASE_URL}/v2/device/${device.deviceId}/remote-control/session`,
        {
          type: 'REMOTE_CONTROL',
          duration: 3600 // 1 hour session
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Return the session URL or connection details
      return res.json({
        success: true,
        data: {
          method: 'ninjaone',
          sessionUrl: sessionResponse.data.sessionUrl,
          sessionId: sessionResponse.data.sessionId,
          deviceName: device.name,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      });

    } catch (ninjaError: any) {
      console.error('NinjaOne remote session error:', ninjaError.response?.data || ninjaError.message);
      
      // Fallback to alternative method
      return res.json({
        success: true,
        data: {
          method: 'fallback',
          deviceName: device.name,
          message: 'Using fallback remote desktop method',
          fallbackUrl: 'https://my.splashtop.com/computers',
          ninjaConsoleUrl: `https://app.ninjarmm.com/#/deviceDashboard/${device.deviceId}/overview`
        }
      });
    }

  } catch (error: any) {
    console.error('Remote desktop session error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create remote session' 
    });
  }
});

// Get device information for a bay
router.get('/device-info', authenticateToken, async (req, res) => {
  try {
    // Check permissions
    if (!hasMinimumRole(req.user!.role, 'operator')) {
      return res.status(403).json({ 
        success: false, 
        error: 'Insufficient permissions' 
      });
    }

    const { location, bayNumber } = req.query;

    if (!location || !bayNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Location and bay number required' 
      });
    }

    // Get device info from registry
    const deviceKey = `bay-${bayNumber}`;
    const device = DEVICE_REGISTRY[location as string]?.[deviceKey];

    if (!device) {
      return res.status(404).json({ 
        success: false, 
        error: `Device not found for ${location} Bay ${bayNumber}` 
      });
    }

    // Return device information
    res.json({
      success: true,
      data: {
        deviceId: device.deviceId,
        name: device.name,
        type: device.type,
        location: location as string,
        bayNumber: bayNumber as string,
        configured: !device.deviceId.includes('DEVICE_ID')
      }
    });

  } catch (error: any) {
    console.error('Device info error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get device information' 
    });
  }
});

export default router;