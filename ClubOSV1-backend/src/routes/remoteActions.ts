import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import ninjaOneService from '../services/ninjaone';
import { pool } from '../utils/db';  // Fixed import path
import { slackFallback } from '../services/slackFallback';
import { logger } from '../utils/logger';
import { UserRole } from '../types';

const router = express.Router();

// Simplified device mapping - Only PCs for software restarts
// UPDATE THESE WITH REAL NINJAONE DEVICE IDS WHEN AVAILABLE
const DEVICE_MAP: Record<string, Record<string, { deviceId: string; name: string }>> = {
  'Bedford': {
    'bay-1': { deviceId: 'DEMO-BEDFORD-SIM1-PC', name: 'Bedford Bay 1 PC' },
    'bay-2': { deviceId: 'DEMO-BEDFORD-SIM2-PC', name: 'Bedford Bay 2 PC' }
  },
  'Dartmouth': {
    'bay-1': { deviceId: 'DEMO-DART-SIM1-PC', name: 'Dartmouth Bay 1 PC' },
    'bay-2': { deviceId: 'DEMO-DART-SIM2-PC', name: 'Dartmouth Bay 2 PC' },
    'bay-3': { deviceId: 'DEMO-DART-SIM3-PC', name: 'Dartmouth Bay 3 PC' },
    'bay-4': { deviceId: 'DEMO-DART-SIM4-PC', name: 'Dartmouth Bay 4 PC' }
  },
  'Stratford': {
    'bay-1': { deviceId: 'DEMO-STRAT-SIM1-PC', name: 'Stratford Bay 1 PC' },
    'bay-2': { deviceId: 'DEMO-STRAT-SIM2-PC', name: 'Stratford Bay 2 PC' },
    'bay-3': { deviceId: 'DEMO-STRAT-SIM3-PC', name: 'Stratford Bay 3 PC' }
  },
  'Bayers Lake': {
    'bay-1': { deviceId: 'DEMO-BAYERS-SIM1-PC', name: 'Bayers Lake Bay 1 PC' },
    'bay-2': { deviceId: 'DEMO-BAYERS-SIM2-PC', name: 'Bayers Lake Bay 2 PC' },
    'bay-3': { deviceId: 'DEMO-BAYERS-SIM3-PC', name: 'Bayers Lake Bay 3 PC' },
    'bay-4': { deviceId: 'DEMO-BAYERS-SIM4-PC', name: 'Bayers Lake Bay 4 PC' },
    'bay-5': { deviceId: 'DEMO-BAYERS-SIM5-PC', name: 'Bayers Lake Bay 5 PC' }
  },
  'Truro': {
    'bay-1': { deviceId: 'DEMO-TRURO-SIM1-PC', name: 'Truro Bay 1 PC' },
    'bay-2': { deviceId: 'DEMO-TRURO-SIM2-PC', name: 'Truro Bay 2 PC' },
    'bay-3': { deviceId: 'DEMO-TRURO-SIM3-PC', name: 'Truro Bay 3 PC' }
  }
};

// Simplified script mapping - Only essential actions
// UPDATE THESE WITH REAL SCRIPT IDS AFTER UPLOADING TO NINJAONE
const SCRIPT_MAP: Record<string, string> = {
  'restart-trackman': 'DEMO-SCRIPT-RESTART-TRACKMAN',
  'restart-browser': 'DEMO-SCRIPT-RESTART-BROWSER',
  'reboot-pc': 'DEMO-SCRIPT-REBOOT-PC',
  'restart-all': 'DEMO-SCRIPT-RESTART-ALL-SOFTWARE',
  'restart-music': 'DEMO-SCRIPT-RESTART-MUSIC',
  'restart-tv': 'DEMO-SCRIPT-RESTART-TV',
  'other': 'DEMO-SCRIPT-OTHER-ACTIONS',
  'projector-power': 'DEMO-SCRIPT-PROJECTOR-POWER',
  'projector-input': 'DEMO-SCRIPT-PROJECTOR-INPUT',
  'projector-autosize': 'DEMO-SCRIPT-PROJECTOR-AUTOSIZE'
};

// Get available scripts from database
router.get('/scripts', authenticate, authorize(['operator', 'admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM ninjaone_scripts WHERE is_active = true ORDER BY category, name`
    );
    res.json({ success: true, scripts: result.rows });
  } catch (error: any) {
    logger.error('Error fetching scripts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch scripts' });
  }
});

// Execute remote action
router.post('/execute', authenticate, authorize(['operator', 'admin']), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { action, location, bayNumber } = req.body;
    
    // Validate inputs
    if (!action || !location) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        message: 'Location is required' 
      });
    }
    
    // Bay number required for non-system actions
    const systemActions = ['restart-music', 'restart-tv', 'projector-power', 'projector-input', 'projector-autosize'];
    if (!systemActions.includes(action) && !bayNumber) {
      return res.status(400).json({ 
        error: 'Missing bay number',
        message: 'Bay number is required for this action' 
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

    let device;
    let deviceName;
    
    // For music/TV systems, use a generic device ID for the location
    if (action === 'restart-music') {
      device = { 
        deviceId: `DEMO-${location.toUpperCase().replace(' ', '')}-MUSIC`, 
        name: `${location} Music System` 
      };
      deviceName = device.name;
    } else if (action === 'restart-tv') {
      device = { 
        deviceId: `DEMO-${location.toUpperCase().replace(' ', '')}-TV`, 
        name: `${location} Tournament TV` 
      };
      deviceName = device.name;
    } else {
      // For bay-specific actions
      device = locationDevices[`bay-${bayNumber}`];
      if (!device) {
        return res.status(404).json({ 
          error: 'Device not found',
          message: `Bay ${bayNumber} not found at ${location}` 
        });
      }
      deviceName = device.name;
    }

    // Check if NinjaOne is configured (use demo credentials to check)
    const isDemoMode = !process.env.NINJAONE_CLIENT_ID || 
                      process.env.NINJAONE_CLIENT_ID === 'demo_client_id' ||
                      !process.env.NINJAONE_CLIENT_SECRET ||
                      process.env.NINJAONE_CLIENT_SECRET === 'demo_client_secret';

    if (isDemoMode) {
      logger.info('NinjaOne in demo mode - simulating action');
      
      // Simulate success for demo
      const simulatedJobId = `DEMO-${Date.now()}`;
      
      // Log to database (check if table exists first)
      try {
        await pool.query(
          `INSERT INTO remote_actions_log 
           (action_type, location, device_name, device_id, initiated_by, ninja_job_id, status, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [action, location, deviceName, device.deviceId, req.user.email, simulatedJobId, 'simulated', 
           JSON.stringify({ simulated: true, timestamp: new Date().toISOString(), demoMode: true })]
        );
      } catch (dbError: any) {
        logger.warn('Could not log to database - table may not exist yet:', dbError.message);
      }
      
      // Send simulated success response
      const actionDescriptions: Record<string, string> = {
        'restart-trackman': 'TrackMan restart',
        'restart-browser': 'Browser restart',
        'reboot-pc': 'PC reboot',
        'restart-all': 'Full software restart',
        'restart-music': 'Music system restart',
        'restart-tv': 'TV system restart',
        'other': 'System maintenance actions'
      };
      
      // Send Slack notification in demo mode
      try {
        await slackFallback.sendMessage({
          channel: '#tech-alerts',
          username: 'ClubOS Remote Actions',
          text: '🎮 [DEMO] Remote Action Simulated',
          attachments: [{
            title: 'Remote Action',
            text: '',
            color: 'good',
            fields: [
              { title: 'User', value: req.user.email, short: true },
              { title: 'Action', value: actionDescriptions[action] || action, short: true },
              { title: 'Device', value: deviceName, short: true },
              { title: 'Note', value: 'This is a demo - no actual restart occurred', short: false }
            ]
          }]
        });
      } catch (slackError) {
        logger.warn('Could not send Slack notification:', slackError);
      }
      
      return res.json({
        success: true,
        message: `[DEMO] ${actionDescriptions[action] || action} initiated on ${deviceName}`,
        jobId: simulatedJobId,
        device: deviceName,
        simulated: true,
        estimatedTime: action === 'reboot-pc' ? '3-5 minutes' : '30-60 seconds'
      });
    }

    // PRODUCTION MODE (when NinjaOne credentials are configured)
    
    // Check device is online
    const isOnline = await ninjaOneService.validateDeviceOnline(device.deviceId);
    if (!isOnline) {
      return res.status(503).json({ 
        error: 'Device is offline',
        message: `${deviceName} is not currently accessible. Please check if the PC is powered on.`
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
        [action, location, deviceName, device.deviceId, req.user.email, job.jobId, 'initiated', 
         JSON.stringify({ timestamp: new Date().toISOString(), action: action })]
      );
    } catch (dbError) {
      logger.error('Database logging failed:', dbError);
    }

    // Send Slack notification for critical actions
    if (action === 'reboot-pc') {
      await slackFallback.sendMessage({
        channel: '#tech-alerts',
        username: 'ClubOS Remote Actions',
        text: '⚠️ PC Reboot Initiated',
        attachments: [{
          title: 'PC Reboot',
          text: '',
          color: 'warning',
          fields: [
            { title: 'User', value: req.user.email, short: true },
            { title: 'Device', value: deviceName, short: true },
            { title: 'Expected Downtime', value: '3-5 minutes', short: true },
            { title: 'Job ID', value: job.jobId, short: true }
          ]
        }]
      });
    } else {
      await slackFallback.sendMessage({
        channel: '#tech-actions-log', 
        username: 'ClubOS Remote Actions',
        text: `🔧 Remote Action: ${action}`,
        attachments: [{
          title: 'Action Log',
          text: '',
          color: 'good',
          fields: [
            { title: 'User', value: req.user.email, short: true },
            { title: 'Device', value: deviceName, short: true }
          ]
        }]
      });
    }

    res.json({
      success: true,
      message: `${action} initiated on ${deviceName}`,
      jobId: job.jobId,
      device: deviceName,
      estimatedTime: action === 'reboot-pc' ? '3-5 minutes' : '30-60 seconds'
    });

  } catch (error: any) {
    logger.error('Remote action error:', error);
    
    res.status(500).json({ 
      error: 'Failed to execute remote action',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

// Check job status
router.get('/status/:jobId', authenticate, async (req, res) => {
  try {
    // Check if simulated/demo job
    if (req.params.jobId.startsWith('DEMO-') || req.params.jobId.startsWith('SIM-')) {
      // Simulate completion after 5 seconds
      const jobAge = Date.now() - parseInt(req.params.jobId.split('-')[1]);
      const status = jobAge > 5000 ? 'completed' : 'running';
      
      return res.json({
        jobId: req.params.jobId,
        status: status,
        result: { simulated: true, demo: true }
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
      logger.error('Could not update job status in database:', dbError);
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
router.get('/devices/:location', authenticate, authorize(['operator', 'admin']), async (req, res) => {
  try {
    const location = req.params.location;
    const devices = DEVICE_MAP[location];
    
    if (!devices) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    // Check if in demo mode
    const isDemoMode = !process.env.NINJAONE_CLIENT_ID || 
                      process.env.NINJAONE_CLIENT_ID === 'demo_client_id';
    
    if (isDemoMode) {
      // In demo mode, return all devices as online
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

// Get recent actions (for monitoring)
router.get('/recent', authenticate, authorize(['operator', 'admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT action_type, location, device_name, initiated_by, status, created_at
       FROM remote_actions_log
       ORDER BY created_at DESC
       LIMIT 20`
    );
    
    res.json({ actions: result.rows });
  } catch (error) {
    // If table doesn't exist, return empty array
    res.json({ actions: [] });
  }
});

export default router;
