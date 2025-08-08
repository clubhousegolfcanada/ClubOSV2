import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import unifiAccessService from '../services/unifiAccess';
import { pool } from '../utils/db';
import { slackFallback } from '../services/slackFallback';
import { logger } from '../utils/logger';

const router = express.Router();

// Unlock door
router.post('/unlock', authenticate, authorize(['operator', 'admin']), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { location, doorKey, duration, reason } = req.body;
    
    // Validate inputs
    if (!location || !doorKey) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        message: 'Location and door are required' 
      });
    }
    
    // Validate duration
    const unlockDuration = duration || parseInt(process.env.DEFAULT_UNLOCK_DURATION || '30');
    const maxDuration = parseInt(process.env.MAX_UNLOCK_DURATION || '300');
    
    if (unlockDuration > maxDuration) {
      return res.status(400).json({ 
        error: 'Invalid duration',
        message: `Maximum unlock duration is ${maxDuration} seconds` 
      });
    }

    // Execute unlock
    const result = await unifiAccessService.unlockDoor(location, doorKey, unlockDuration);
    
    // Log to database
    try {
      await pool.query(
        `INSERT INTO door_access_log 
         (action_type, location, door_id, door_name, initiated_by, duration_seconds, reason, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          'unlock', 
          location, 
          result.doorId, 
          doorKey,
          req.user.email, 
          unlockDuration,
          reason || 'Manual unlock via Remote Actions',
          result.success ? 'completed' : 'failed',
          JSON.stringify({ 
            timestamp: new Date().toISOString(),
            demo: unifiAccessService.isInDemoMode()
          })
        ]
      );
    } catch (dbError: any) {
      logger.warn('Could not log door access - table may not exist:', dbError.message);
    }
    
    // Send Slack notification for non-main door unlocks
    if (doorKey !== 'main-entrance') {
      await slackFallback.sendMessage({
        channel: '#tech-actions-log',
        username: 'ClubOS Door Access',
        text: `🔓 Door Unlocked`,
        attachments: [{
          title: 'Door Access',
          text: '',
          color: 'good',
          fields: [
            { title: 'Location', value: location, short: true },
            { title: 'Door', value: doorKey, short: true },
            { title: 'User', value: req.user.email, short: true },
            { title: 'Duration', value: `${unlockDuration} seconds`, short: true },
            { title: 'Reason', value: reason || 'Manual unlock', short: false }
          ]
        }]
      });
    }
    
    const responseTime = Date.now() - startTime;
    logger.info(`Door unlock completed in ${responseTime}ms`);
    
    res.json({
      success: result.success,
      message: result.message,
      duration: unlockDuration,
      responseTime
    });
    
  } catch (error: any) {
    logger.error('Door unlock error:', error);
    res.status(500).json({ 
      error: 'Failed to unlock door',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

// Lock door
router.post('/lock', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { location, doorKey } = req.body;
    
    if (!location || !doorKey) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        message: 'Location and door are required' 
      });
    }
    
    const result = await unifiAccessService.lockDoor(location, doorKey);
    
    // Log to database
    try {
      await pool.query(
        `INSERT INTO door_access_log 
         (action_type, location, door_id, door_name, initiated_by, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          'lock', 
          location, 
          result.doorId, 
          doorKey,
          req.user.email, 
          result.success ? 'completed' : 'failed',
          JSON.stringify({ 
            timestamp: new Date().toISOString(),
            demo: unifiAccessService.isInDemoMode()
          })
        ]
      );
    } catch (dbError) {
      logger.warn('Could not log door access:', dbError);
    }
    
    res.json({
      success: result.success,
      message: result.message
    });
    
  } catch (error: any) {
    logger.error('Door lock error:', error);
    res.status(500).json({ 
      error: 'Failed to lock door',
      message: error.message 
    });
  }
});

// Get door status for a location
router.get('/status/:location', authenticate, authorize(['operator', 'admin']), async (req, res) => {
  try {
    const location = req.params.location;
    const statuses = await unifiAccessService.getDoorStatus(location);
    
    res.json({
      location,
      doors: statuses,
      demo: unifiAccessService.isInDemoMode()
    });
    
  } catch (error: any) {
    logger.error('Get door status error:', error);
    res.status(500).json({ 
      error: 'Failed to get door status',
      message: error.message 
    });
  }
});

// Emergency actions
router.post('/emergency', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { action, location } = req.body;
    
    if (!action || !location) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        message: 'Action and location are required' 
      });
    }
    
    let results;
    const emergencyDuration = parseInt(process.env.EMERGENCY_UNLOCK_DURATION || '60');
    
    if (action === 'unlock_all') {
      results = await unifiAccessService.unlockAllDoors(location, emergencyDuration);
      
      // Send urgent Slack notification
      await slackFallback.sendMessage({
        channel: '#tech-alerts',
        username: 'ClubOS Door Access',
        text: '🚨 EMERGENCY: All Doors Unlocked',
        attachments: [{
          title: 'Emergency Door Unlock',
          text: '',
          color: 'danger',
          fields: [
            { title: 'Location', value: location, short: true },
            { title: 'Initiated By', value: req.user.email, short: true },
            { title: 'Duration', value: `${emergencyDuration} seconds`, short: true },
            { title: 'Timestamp', value: new Date().toISOString(), short: true }
          ]
        }]
      });
    } else if (action === 'lockdown') {
      results = await unifiAccessService.lockdownLocation(location);
      
      await slackFallback.sendMessage({
        channel: '#tech-alerts',
        username: 'ClubOS Door Access',
        text: '🔒 Location Lockdown Initiated',
        attachments: [{
          title: 'Lockdown',
          text: '',
          color: 'warning',
          fields: [
            { title: 'Location', value: location, short: true },
            { title: 'Initiated By', value: req.user.email, short: true },
            { title: 'Timestamp', value: new Date().toISOString(), short: true }
          ]
        }]
      });
    } else {
      return res.status(400).json({ 
        error: 'Invalid action',
        message: 'Action must be unlock_all or lockdown' 
      });
    }
    
    // Log emergency action
    try {
      await pool.query(
        `INSERT INTO door_access_log 
         (action_type, location, door_id, door_name, initiated_by, duration_seconds, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          `emergency_${action}`, 
          location, 
          'ALL_DOORS', 
          'All Doors',
          req.user.email, 
          action === 'unlock_all' ? emergencyDuration : null,
          'completed',
          JSON.stringify({ 
            timestamp: new Date().toISOString(),
            results,
            demo: unifiAccessService.isInDemoMode()
          })
        ]
      );
    } catch (dbError) {
      logger.warn('Could not log emergency action:', dbError);
    }
    
    res.json({
      success: true,
      action,
      location,
      results,
      message: `Emergency ${action} executed for ${location}`
    });
    
  } catch (error: any) {
    logger.error('Emergency action error:', error);
    res.status(500).json({ 
      error: 'Failed to execute emergency action',
      message: error.message 
    });
  }
});

// Get access logs
router.get('/logs/:location', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { location } = req.params;
    const { doorKey, limit = 20 } = req.query;
    
    // Get logs from database
    let query = `
      SELECT action_type, door_name, initiated_by, duration_seconds, reason, status, created_at
      FROM door_access_log
      WHERE location = $1
    `;
    const params: any[] = [location];
    
    if (doorKey) {
      query += ` AND door_name = $2`;
      params.push(doorKey);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    try {
      const result = await pool.query(query, params);
      res.json({ 
        logs: result.rows,
        location,
        doorKey 
      });
    } catch (dbError) {
      // If table doesn't exist, return UniFi access logs
      const unifiLogs = await unifiAccessService.getAccessLog(
        location, 
        doorKey as string, 
        parseInt(limit as string)
      );
      res.json({ 
        logs: unifiLogs,
        location,
        doorKey,
        source: 'unifi' 
      });
    }
    
  } catch (error: any) {
    logger.error('Get access logs error:', error);
    res.status(500).json({ 
      error: 'Failed to get access logs',
      message: error.message 
    });
  }
});

// Get available doors for a location
router.get('/doors/:location', authenticate, async (req, res) => {
  try {
    const location = req.params.location;
    const doors = unifiAccessService.getLocationDoors(location);
    
    res.json({
      location,
      doors,
      demo: unifiAccessService.isInDemoMode()
    });
    
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to get doors',
      message: error.message 
    });
  }
});

export default router;