import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import ninjaOneService from '../services/ninjaone';
import { pool } from '../utils/db';
import { sendSlackNotification } from '../services/slack';

const router = express.Router();

// Device ID mapping - UPDATE WITH REAL NINJAONE DEVICE IDS
const DEVICE_MAP: Record<string, Record<string, { deviceId: string; name: string }>> = {
  'Bedford': {
    'bay-1': { deviceId: 'BEDFORD-SIM1-PC', name: 'Bedford Bay 1 PC' },
    'bay-2': { deviceId: 'BEDFORD-SIM2-PC', name: 'Bedford Bay 2 PC' },
    'music': { deviceId: 'BEDFORD-MUSIC-PC', name: 'Bedford Music System' },
    'tv': { deviceId: 'BEDFORD-TV-PC', name: 'Bedford Tournament TV' }
  },
  'Dartmouth': {
    'bay-1': { deviceId: 'DART-SIM1-PC', name: 'Dartmouth Bay 1 PC' },
    'bay-2': { deviceId: 'DART-SIM2-PC', name: 'Dartmouth Bay 2 PC' },
    'bay-3': { deviceId: 'DART-SIM3-PC', name: 'Dartmouth Bay 3 PC' },
    'bay-4': { deviceId: 'DART-SIM4-PC', name: 'Dartmouth Bay 4 PC' },
    'music': { deviceId: 'DART-MUSIC-PC', name: 'Dartmouth Music System' },
    'tv': { deviceId: 'DART-TV-PC', name: 'Dartmouth Tournament TV' }
  },
  'Stratford': {
    'bay-1': { deviceId: 'STRAT-SIM1-PC', name: 'Stratford Bay 1 PC' },
    'bay-2': { deviceId: 'STRAT-SIM2-PC', name: 'Stratford Bay 2 PC' },
    'bay-3': { deviceId: 'STRAT-SIM3-PC', name: 'Stratford Bay 3 PC' },
    'music': { deviceId: 'STRAT-MUSIC-PC', name: 'Stratford Music System' },
    'tv': { deviceId: 'STRAT-TV-PC', name: 'Stratford Tournament TV' }
  },
  'Bayers Lake': {
    'bay-1': { deviceId: 'BAYERS-SIM1-PC', name: 'Bayers Lake Bay 1 PC' },
    'bay-2': { deviceId: 'BAYERS-SIM2-PC', name: 'Bayers Lake Bay 2 PC' },
    'bay-3': { deviceId: 'BAYERS-SIM3-PC', name: 'Bayers Lake Bay 3 PC' },
    'bay-4': { deviceId: 'BAYERS-SIM4-PC', name: 'Bayers Lake Bay 4 PC' },
    'bay-5': { deviceId: 'BAYERS-SIM5-PC', name: 'Bayers Lake Bay 5 PC' },
    'music': { deviceId: 'BAYERS-MUSIC-PC', name: 'Bayers Lake Music System' },
    'tv': { deviceId: 'BAYERS-TV-PC', name: 'Bayers Lake Tournament TV' }
  },
  'Truro': {
    'bay-1': { deviceId: 'TRURO-SIM1-PC', name: 'Truro Bay 1 PC' },
    'bay-2': { deviceId: 'TRURO-SIM2-PC', name: 'Truro Bay 2 PC' },
    'bay-3': { deviceId: 'TRURO-SIM3-PC', name: 'Truro Bay 3 PC' },
    'music': { deviceId: 'TRURO-MUSIC-PC', name: 'Truro Music System' },
    'tv': { deviceId: 'TRURO-TV-PC', name: 'Truro Tournament TV' }
  }
};

// NinjaOne script IDs - UPDATE WITH REAL SCRIPT IDS
const SCRIPT_MAP: Record<string, string> = {
  'restart-sim': 'SCRIPT-RESTART-TRACKMAN',
  'reboot-pc': 'SCRIPT-REBOOT-PC',
  'restart-music': 'SCRIPT-RESTART-MUSIC',
  'restart-tv': 'SCRIPT-RESTART-TV',
  'other': 'SCRIPT-OTHER-ACTIONS'
};

// Execute remote action
router.post('/execute', requireAuth, requireRole('operator'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { action, location, bayNumber, systemType } = req.body;
    
    // Validate inputs
    if (!action || !location) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Determine device
    const locationDevices = DEVICE_MAP[location];
    if (!locationDevices) {
      return res.status(404).json({ error: 'Invalid location' });
    }

    let device;
    if (bayNumber) {
      device = locationDevices[`bay-${bayNumber}`];
    } else if (systemType) {
      device = locationDevices[systemType];
    }

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check if NinjaOne is configured
    if (!process.env.NINJAONE_CLIENT_ID || !process.env.NINJAONE_CLIENT_SECRET) {
      console.warn('NinjaOne not configured - simulating action');
      
      // Simulate success for demo
      const simulatedJobId = `SIM-${Date.now()}`;
      
      // Log to database
      await pool.query(
        `INSERT INTO remote_actions_log 
         (action_type, location, device_name, device_id, initiated_by, ninja_job_id, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [action, location, device.name, device.deviceId, req.user.email, simulatedJobId, 'simulated', 
         JSON.stringify({ simulated: true, timestamp: new Date().toISOString() })]
      );
      
      return res.json({
        success: true,
        message: `[DEMO] ${action} initiated on ${device.name}`,
        jobId: simulatedJobId,
        device: device.name,
        simulated: true
      });
    }

    // Check device is online
    const isOnline = await ninjaOneService.validateDeviceOnline(device.deviceId);
    if (!isOnline) {
      return res.status(503).json({ 
        error: 'Device is offline',
        message: `${device.name} is not currently accessible`
      });
    }

    // Determine script
    const scriptId = SCRIPT_MAP[action];
    if (!scriptId) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Execute action
    const job = await ninjaOneService.executeScript(
      device.deviceId,
      scriptId,
      {
        initiatedBy: req.user.email,
        timestamp: new Date().toISOString(),
        reason: 'Manual trigger from ClubOS Remote Actions'
      }
    );

    // Log to database
    await pool.query(
      `INSERT INTO remote_actions_log 
       (action_type, location, device_name, device_id, initiated_by, ninja_job_id, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [action, location, device.name, device.deviceId, req.user.email, job.jobId, 'initiated', 
       JSON.stringify({ timestamp: new Date().toISOString() })]
    );

    // Send Slack notification
    await sendSlackNotification(
      `🔧 Remote Action Executed\n` +
      `User: ${req.user.email}\n` +
      `Action: ${action}\n` +
      `Device: ${device.name}\n` +
      `Location: ${location}\n` +
      `Job ID: ${job.jobId}`,
      '#tech-alerts'
    );

    res.json({
      success: true,
      message: `${action} initiated on ${device.name}`,
      jobId: job.jobId,
      device: device.name
    });

  } catch (error: any) {
    console.error('Remote action error:', error);
    
    // Log error to database
    await pool.query(
      `INSERT INTO remote_actions_log 
       (action_type, location, device_name, device_id, initiated_by, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.body.action || 'unknown', req.body.location || 'unknown', 
       'unknown', 'unknown', req.user.email, 'failed', error.message]
    );
    
    res.status(500).json({ 
      error: 'Failed to execute remote action',
      message: error.message 
    });
  }
});

// Check job status
router.get('/status/:jobId', requireAuth, async (req, res) => {
  try {
    // Check if simulated job
    if (req.params.jobId.startsWith('SIM-')) {
      return res.json({
        jobId: req.params.jobId,
        status: 'completed',
        result: { simulated: true }
      });
    }

    const job = await ninjaOneService.getJobStatus(req.params.jobId);
    
    // Update database status
    await pool.query(
      `UPDATE remote_actions_log 
       SET status = $1, completed_at = CASE WHEN $1 IN ('completed', 'failed') THEN NOW() ELSE NULL END
       WHERE ninja_job_id = $2`,
      [job.status, req.params.jobId]
    );
    
    res.json({
      jobId: job.jobId,
      status: job.status,
      result: job.result
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check job status' });
  }
});

// Get recent actions for dashboard
router.get('/recent', requireAuth, requireRole('operator'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT action_type, location, device_name, initiated_by, status, created_at
       FROM remote_actions_log
       ORDER BY created_at DESC
       LIMIT 10`
    );
    
    res.json({ actions: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get recent actions' });
  }
});

// Get statistics
router.get('/stats', requireAuth, requireRole('operator'), async (req, res) => {
  try {
    const stats = await pool.query(
      `SELECT 
         COUNT(*) as total_actions,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
         COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
         mode() WITHIN GROUP (ORDER BY action_type) as most_common_action
       FROM remote_actions_log
       WHERE created_at > NOW() - INTERVAL '30 days'`
    );
    
    const successRate = stats.rows[0].total_actions > 0 
      ? Math.round((stats.rows[0].successful / stats.rows[0].total_actions) * 100)
      : 0;
    
    res.json({
      totalActions: stats.rows[0].total_actions,
      successRate,
      last24h: stats.rows[0].last_24h,
      mostCommonAction: stats.rows[0].most_common_action
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

export default router;
