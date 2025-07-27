import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import ninjaOneService from '../services/ninjaone';
import { pool } from '../utils/db';  // Fixed import path
import { sendSlackNotification } from '../services/slack';

const router = express.Router();

// Simplified device mapping - Only PCs for software restarts
const DEVICE_MAP: Record<string, Record<string, { deviceId: string; name: string }>> = {
  'Bedford': {
    'bay-1': { deviceId: 'BEDFORD-SIM1-PC', name: 'Bedford Bay 1 PC' },
    'bay-2': { deviceId: 'BEDFORD-SIM2-PC', name: 'Bedford Bay 2 PC' }
  },
  'Dartmouth': {
    'bay-1': { deviceId: 'DART-SIM1-PC', name: 'Dartmouth Bay 1 PC' },
    'bay-2': { deviceId: 'DART-SIM2-PC', name: 'Dartmouth Bay 2 PC' },
    'bay-3': { deviceId: 'DART-SIM3-PC', name: 'Dartmouth Bay 3 PC' },
    'bay-4': { deviceId: 'DART-SIM4-PC', name: 'Dartmouth Bay 4 PC' }
  },
  'Stratford': {
    'bay-1': { deviceId: 'STRAT-SIM1-PC', name: 'Stratford Bay 1 PC' },
    'bay-2': { deviceId: 'STRAT-SIM2-PC', name: 'Stratford Bay 2 PC' },
    'bay-3': { deviceId: 'STRAT-SIM3-PC', name: 'Stratford Bay 3 PC' }
  },
  'Bayers Lake': {
    'bay-1': { deviceId: 'BAYERS-SIM1-PC', name: 'Bayers Lake Bay 1 PC' },
    'bay-2': { deviceId: 'BAYERS-SIM2-PC', name: 'Bayers Lake Bay 2 PC' },
    'bay-3': { deviceId: 'BAYERS-SIM3-PC', name: 'Bayers Lake Bay 3 PC' },
    'bay-4': { deviceId: 'BAYERS-SIM4-PC', name: 'Bayers Lake Bay 4 PC' },
    'bay-5': { deviceId: 'BAYERS-SIM5-PC', name: 'Bayers Lake Bay 5 PC' }
  },
  'Truro': {
    'bay-1': { deviceId: 'TRURO-SIM1-PC', name: 'Truro Bay 1 PC' },
    'bay-2': { deviceId: 'TRURO-SIM2-PC', name: 'Truro Bay 2 PC' },
    'bay-3': { deviceId: 'TRURO-SIM3-PC', name: 'Truro Bay 3 PC' }
  }
};

// Simplified script mapping - Only essential actions
const SCRIPT_MAP: Record<string, string> = {
  'restart-trackman': 'SCRIPT-RESTART-TRACKMAN',    // Restart TrackMan software only
  'restart-browser': 'SCRIPT-RESTART-BROWSER',      // Restart browser with tournament display
  'reboot-pc': 'SCRIPT-REBOOT-PC',                 // Full PC reboot
  'restart-all': 'SCRIPT-RESTART-ALL-SOFTWARE'      // Restart TrackMan + Browser
};

// Execute remote action
router.post('/execute', requireAuth, requireRole('operator'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { action, location, bayNumber } = req.body;
    
    // Validate inputs
    if (!action || !location || !bayNumber) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        message: 'Location and bay number are required' 
      });
    }

    // Validate action type
    if (!SCRIPT_MAP[action]) {
      return res.status(400).json({ 
        error: 'Invalid action',
        message: `Action '${action}' is not supported` 
      });
    }

    // Get device
    const locationDevices = DEVICE_MAP[location];
    if (!locationDevices) {
      return res.status(404).json({ 
        error: 'Invalid location',
        message: `Location '${location}' not found` 
      });
    }

    const device = locationDevices[`bay-${bayNumber}`];
    if (!device) {
      return res.status(404).json({ 
        error: 'Device not found',
        message: `Bay ${bayNumber} not found at ${location}` 
      });
    }

    // Check if NinjaOne is configured
    if (!process.env.NINJAONE_CLIENT_ID || !process.env.NINJAONE_CLIENT_SECRET) {
      console.warn('NinjaOne not configured - simulating action');
      
      // Simulate success for demo
      const simulatedJobId = `SIM-${Date.now()}`;
      
      // Log to database (check if table exists first)
      try {
        await pool.query(
          `INSERT INTO remote_actions_log 
           (action_type, location, device_name, device_id, initiated_by, ninja_job_id, status, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [action, location, device.name, device.deviceId, req.user.email, simulatedJobId, 'simulated', 
           JSON.stringify({ simulated: true, timestamp: new Date().toISOString() })]
        );
      } catch (dbError) {
        console.warn('Could not log to database - table may not exist yet');
      }
      
      // Send simulated success response
      const actionDescriptions: Record<string, string> = {
        'restart-trackman': 'TrackMan restart',
        'restart-browser': 'Browser restart',
        'reboot-pc': 'PC reboot',
        'restart-all': 'Full software restart'
      };
      
      return res.json({
        success: true,
        message: `[DEMO] ${actionDescriptions[action] || action} initiated on ${device.name}`,
        jobId: simulatedJobId,
        device: device.name,
        simulated: true,
        estimatedTime: action === 'reboot-pc' ? '3-5 minutes' : '30-60 seconds'
      });
    }

    // Check device is online
    const isOnline = await ninjaOneService.validateDeviceOnline(device.deviceId);
    if (!isOnline) {
      return res.status(503).json({ 
        error: 'Device is offline',
        message: `${device.name} is not currently accessible. Please check if the PC is powered on.`
      });
    }

    // Execute action via NinjaOne
    const scriptId = SCRIPT_MAP[action];
    const job = await ninjaOneService.executeScript(
      device.deviceId,
      scriptId,
      {
        initiatedBy: req.user.email,
        timestamp: new Date().toISOString(),
        reason: 'Manual trigger from ClubOS Remote Actions',
        action: action
      }
    );

    // Log to database
    try {
      await pool.query(
        `INSERT INTO remote_actions_log 
         (action_type, location, device_name, device_id, initiated_by, ninja_job_id, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [action, location, device.name, device.deviceId, req.user.email, job.jobId, 'initiated', 
         JSON.stringify({ timestamp: new Date().toISOString(), action: action })]
      );
    } catch (dbError) {
      console.error('Database logging failed:', dbError);
    }

    // Send Slack notification for critical actions
    if (action === 'reboot-pc') {
      await sendSlackNotification(
        `⚠️ PC Reboot Initiated\n` +
        `User: ${req.user.email}\n` +
        `Device: ${device.name}\n` +
        `Expected downtime: 3-5 minutes\n` +
        `Job ID: ${job.jobId}`,
        '#tech-alerts'
      );
    } else {
      await sendSlackNotification(
        `🔧 Remote Action: ${action}\n` +
        `User: ${req.user.email}\n` +
        `Device: ${device.name}`,
        '#tech-actions-log'
      );
    }

    res.json({
      success: true,
      message: `${action} initiated on ${device.name}`,
      jobId: job.jobId,
      device: device.name,
      estimatedTime: action === 'reboot-pc' ? '3-5 minutes' : '30-60 seconds'
    });

  } catch (error: any) {
    console.error('Remote action error:', error);
    
    res.status(500).json({ 
      error: 'Failed to execute remote action',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

// Check job status
router.get('/status/:jobId', requireAuth, async (req, res) => {
  try {
    // Check if simulated job
    if (req.params.jobId.startsWith('SIM-')) {
      // Simulate completion after 5 seconds
      const jobAge = Date.now() - parseInt(req.params.jobId.split('-')[1]);
      const status = jobAge > 5000 ? 'completed' : 'running';
      
      return res.json({
        jobId: req.params.jobId,
        status: status,
        result: { simulated: true }
      });
    }

    // Get real job status from NinjaOne
    const job = await ninjaOneService.getJobStatus(req.params.jobId);
    
    // Update database status
    try {
      await pool.query(
        `UPDATE remote_actions_log 
         SET status = $1, completed_at = CASE WHEN $1 IN ('completed', 'failed') THEN NOW() ELSE NULL END
         WHERE ninja_job_id = $2`,
        [job.status, req.params.jobId]
      );
    } catch (dbError) {
      console.error('Could not update job status in database');
    }
    
    res.json({
      jobId: job.jobId,
      status: job.status,
      result: job.result
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check job status' });
  }
});

// Get device status (simplified)
router.get('/devices/:location', requireAuth, requireRole('operator'), async (req, res) => {
  try {
    const location = req.params.location;
    const devices = DEVICE_MAP[location];
    
    if (!devices) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    // In demo mode, return all devices as online
    if (!process.env.NINJAONE_CLIENT_ID) {
      const deviceList = Object.entries(devices).map(([key, device]) => ({
        bay: key.replace('bay-', ''),
        name: device.name,
        deviceId: device.deviceId,
        status: 'online',
        lastSeen: new Date().toISOString()
      }));
      
      return res.json({ devices: deviceList, demo: true });
    }
    
    // Get real device status from NinjaOne
    const deviceStatus = await Promise.all(
      Object.entries(devices).map(async ([key, device]) => {
        try {
          const status = await ninjaOneService.getDeviceStatus(device.deviceId);
          return {
            bay: key.replace('bay-', ''),
            name: device.name,
            deviceId: device.deviceId,
            status: status.online ? 'online' : 'offline',
            lastSeen: status.lastSeen
          };
        } catch (error) {
          return {
            bay: key.replace('bay-', ''),
            name: device.name,
            deviceId: device.deviceId,
            status: 'unknown',
            lastSeen: null
          };
        }
      })
    );
    
    res.json({ devices: deviceStatus });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get device status' });
  }
});

export default router;
