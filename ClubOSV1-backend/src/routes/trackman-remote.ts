import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../utils/db';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// --- Device API Key Auth Middleware ---

interface DeviceRequest extends Request {
  device?: { id: string; hostname: string; location: string };
}

async function authenticateDevice(req: DeviceRequest, res: Response, next: NextFunction): Promise<void> {
  const deviceKey = req.headers['x-device-key'] as string;
  if (!deviceKey) {
    res.status(401).json({ success: false, error: 'Missing X-Device-Key header' });
    return;
  }

  try {
    const result = await query(
      'SELECT id, hostname, location FROM trackman_devices WHERE api_key = $1',
      [deviceKey]
    );
    if (result.rows.length === 0) {
      res.status(401).json({ success: false, error: 'Invalid device key' });
      return;
    }
    req.device = result.rows[0];
    next();
  } catch (error: any) {
    logger.error('Device auth error:', error);
    res.status(500).json({ success: false, error: 'Auth failed' });
  }
}

// ============================================
// PUBLIC ENDPOINTS (no auth — used by PC installer exe)
// ============================================

/**
 * GET /locations - Canonical list of locations and bay counts
 * No auth required so the installer exe can fetch this
 */
const LOCATION_CONFIG = [
  { name: 'Bedford', bays: 2 },
  { name: 'Dartmouth', bays: 4 },
  { name: 'Bayers Lake', bays: 4 },
  { name: 'Truro', bays: 3 },
  { name: 'River Oaks', bays: 2 },
];

router.get('/locations', (_req: Request, res: Response) => {
  res.json({ success: true, data: LOCATION_CONFIG });
});

// ============================================
// DASHBOARD ENDPOINTS (JWT auth)
// ============================================

/**
 * GET /devices - List all devices grouped by location
 */
router.get('/devices', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user || !['admin', 'operator'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const result = await query(
      `SELECT id, hostname, display_name, location, bay_number,
              last_seen_at, last_restart_at, status, tps_version, exe_path, created_at,
              CASE WHEN last_seen_at > NOW() - INTERVAL '2 minutes' THEN true ELSE false END as is_online
       FROM trackman_devices
       ORDER BY location, bay_number, display_name`
    );

    const grouped: Record<string, any[]> = {};
    for (const device of result.rows) {
      if (!grouped[device.location]) grouped[device.location] = [];
      grouped[device.location].push(device);
    }

    const totalDevices = result.rows.length;
    const onlineDevices = result.rows.filter((d: any) => d.is_online).length;

    return res.json({
      success: true,
      data: { devices: grouped, total: totalDevices, online: onlineDevices }
    });
  } catch (error: any) {
    logger.error('Error listing trackman devices:', error);
    return res.status(500).json({ success: false, error: 'Failed to list devices' });
  }
});

/**
 * POST /devices - Register a new device
 */
router.post('/devices', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const { hostname, display_name, location, bay_number } = req.body;
    if (!hostname || !display_name || !location) {
      return res.status(400).json({ success: false, error: 'hostname, display_name, and location are required' });
    }

    const deviceApiKey = crypto.randomBytes(32).toString('hex');

    const result = await query(
      `INSERT INTO trackman_devices (hostname, display_name, location, bay_number, api_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, hostname, display_name, location, bay_number, api_key, created_at`,
      [hostname, display_name, location, bay_number || null, deviceApiKey]
    );

    logger.info(`TrackMan device registered: ${hostname} at ${location} by ${req.user.email}`);

    return res.json({
      success: true,
      data: result.rows[0],
      message: 'Device registered. Copy the api_key — it will not be shown again.'
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: 'Device hostname already registered' });
    }
    logger.error('Error registering trackman device:', error);
    return res.status(500).json({ success: false, error: 'Failed to register device' });
  }
});

/**
 * DELETE /devices/:id - Remove a device
 */
router.delete('/devices/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const result = await query(
      'DELETE FROM trackman_devices WHERE id = $1 RETURNING hostname',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    logger.info(`TrackMan device removed: ${result.rows[0].hostname} by ${req.user.email}`);
    return res.json({ success: true, message: 'Device removed' });
  } catch (error: any) {
    logger.error('Error removing trackman device:', error);
    return res.status(500).json({ success: false, error: 'Failed to remove device' });
  }
});

/**
 * POST /restart - Request restart for devices
 * Body: { all?: true, deviceIds?: string[], location?: string }
 */
router.post('/restart', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user || !['admin', 'operator'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { all, deviceIds, location } = req.body;
    let targetQuery = '';
    let targetParams: any[] = [];

    if (all) {
      targetQuery = 'SELECT id FROM trackman_devices';
    } else if (deviceIds && deviceIds.length > 0) {
      targetQuery = 'SELECT id FROM trackman_devices WHERE id = ANY($1)';
      targetParams = [deviceIds];
    } else if (location) {
      targetQuery = 'SELECT id FROM trackman_devices WHERE location = $1';
      targetParams = [location];
    } else {
      return res.status(400).json({ success: false, error: 'Specify all, deviceIds, or location' });
    }

    const devices = await query(targetQuery, targetParams);
    if (devices.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No devices found' });
    }

    let created = 0;
    for (const device of devices.rows) {
      await query(
        `INSERT INTO trackman_restart_commands (device_id, source, requested_by)
         VALUES ($1, 'dashboard', $2)`,
        [device.id, req.user.id]
      );
      created++;
    }

    logger.info(`TrackMan restart requested for ${created} devices by ${req.user.email}`);
    return res.json({
      success: true,
      message: `Restart command sent to ${created} device(s). They will restart within 60 seconds.`,
      count: created
    });
  } catch (error: any) {
    logger.error('Error creating restart commands:', error);
    return res.status(500).json({ success: false, error: 'Failed to create restart commands' });
  }
});

/**
 * GET /restart-history - Recent restart events
 */
router.get('/restart-history', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user || !['admin', 'operator'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const result = await query(
      `SELECT c.id, c.status, c.source, c.requested_at, c.acknowledged_at, c.completed_at,
              c.result_message, d.hostname, d.display_name, d.location, d.bay_number,
              u.name as requested_by_name
       FROM trackman_restart_commands c
       JOIN trackman_devices d ON c.device_id = d.id
       LEFT JOIN users u ON c.requested_by = u.id
       ORDER BY c.requested_at DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    logger.error('Error fetching restart history:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

/**
 * GET /settings - Get trackman auto-restart settings
 */
router.get('/settings', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const result = await query(
      "SELECT value FROM system_settings WHERE key = 'trackman_auto_restart'"
    );

    const settings = result.rows.length > 0
      ? result.rows[0].value
      : { enabled: true, cron: '0 3 * * *', notify_slack: true };

    return res.json({ success: true, data: settings });
  } catch (error: any) {
    logger.error('Error fetching trackman settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

/**
 * PUT /settings - Update trackman auto-restart settings
 */
router.put('/settings', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const { enabled, cron: cronExpr, notify_slack } = req.body;
    const value = { enabled: !!enabled, cron: cronExpr || '0 3 * * *', notify_slack: !!notify_slack };

    await query(
      `INSERT INTO system_settings (key, value, description, updated_at)
       VALUES ('trackman_auto_restart', $1, 'Automatic TrackMan TPS restart schedule', CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(value)]
    );

    logger.info(`TrackMan auto-restart settings updated by ${req.user.email}: ${JSON.stringify(value)}`);
    return res.json({ success: true, data: value, message: 'Settings saved. Restart the cron job to apply.' });
  } catch (error: any) {
    logger.error('Error updating trackman settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

// ============================================
// SELF-REGISTRATION (setup secret auth — used by PC installer exe)
// ============================================

const SETUP_SECRET = process.env.TRACKMAN_SETUP_SECRET || 'clubhouse247-trackman-setup';

/**
 * POST /self-register - PC registers itself, receives its API key
 * Auth: X-Setup-Secret header (shared secret baked into the exe)
 */
router.post('/self-register', async (req: Request, res: Response) => {
  try {
    const secret = req.headers['x-setup-secret'] as string;
    if (!secret || secret !== SETUP_SECRET) {
      return res.status(401).json({ success: false, error: 'Invalid setup secret' });
    }

    const { location, bay_number } = req.body;
    if (!location || !bay_number) {
      return res.status(400).json({ success: false, error: 'location and bay_number required' });
    }

    const bayNum = parseInt(bay_number);
    const validLocation = LOCATION_CONFIG.find(l => l.name === location);
    if (!validLocation) {
      return res.status(400).json({ success: false, error: `Invalid location: ${location}` });
    }
    if (bayNum < 1 || bayNum > validLocation.bays) {
      return res.status(400).json({ success: false, error: `Bay ${bayNum} out of range for ${location} (1-${validLocation.bays})` });
    }

    const hostname = `${location.toUpperCase().replace(/\s+/g, '-')}-BOX${bayNum}`;
    const displayName = `Box ${bayNum}`;
    const deviceApiKey = crypto.randomBytes(32).toString('hex');

    // Upsert: if this location+bay already exists, regenerate its key
    const existing = await query(
      'SELECT id FROM trackman_devices WHERE location = $1 AND bay_number = $2',
      [location, bayNum]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await query(
        `UPDATE trackman_devices
         SET hostname = $1, display_name = $2, api_key = $3, status = 'unknown', updated_at = NOW()
         WHERE location = $4 AND bay_number = $5
         RETURNING id, hostname, display_name, location, bay_number, api_key`,
        [hostname, displayName, deviceApiKey, location, bayNum]
      );
      logger.info(`TrackMan device re-registered: ${hostname} (replaced existing)`);
    } else {
      result = await query(
        `INSERT INTO trackman_devices (hostname, display_name, location, bay_number, api_key)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, hostname, display_name, location, bay_number, api_key`,
        [hostname, displayName, location, bayNum, deviceApiKey]
      );
      logger.info(`TrackMan device self-registered: ${hostname}`);
    }

    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Error in self-registration:', error);
    return res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// ============================================
// DEVICE ENDPOINTS (API key auth)
// ============================================

/**
 * GET /poll - Device polls for pending restart commands
 */
router.get('/poll', authenticateDevice as any, async (req: DeviceRequest, res: Response) => {
  try {
    const deviceId = req.device!.id;

    // Atomically claim the oldest pending non-expired command
    const result = await query(
      `UPDATE trackman_restart_commands
       SET status = 'acknowledged', acknowledged_at = NOW()
       WHERE id = (
         SELECT id FROM trackman_restart_commands
         WHERE device_id = $1 AND status = 'pending' AND expires_at > NOW()
         ORDER BY requested_at ASC
         LIMIT 1
       )
       RETURNING id, source, requested_at`,
      [deviceId]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, command: null });
    }

    return res.json({
      success: true,
      command: { id: result.rows[0].id, action: 'restart', source: result.rows[0].source }
    });
  } catch (error: any) {
    logger.error('Error polling trackman commands:', error);
    return res.status(500).json({ success: false, error: 'Poll failed' });
  }
});

/**
 * POST /heartbeat - Device reports its status
 */
router.post('/heartbeat', authenticateDevice as any, async (req: DeviceRequest, res: Response) => {
  try {
    const deviceId = req.device!.id;
    const { tps_version, exe_path, tps_running } = req.body;

    await query(
      `UPDATE trackman_devices
       SET last_seen_at = NOW(),
           status = $2,
           tps_version = COALESCE($3, tps_version),
           exe_path = COALESCE($4, exe_path),
           updated_at = NOW()
       WHERE id = $1`,
      [deviceId, tps_running ? 'online' : 'idle', tps_version || null, exe_path || null]
    );

    return res.json({ success: true });
  } catch (error: any) {
    logger.error('Error processing heartbeat:', error);
    return res.status(500).json({ success: false, error: 'Heartbeat failed' });
  }
});

/**
 * POST /report - Device reports command result
 */
router.post('/report', authenticateDevice as any, async (req: DeviceRequest, res: Response) => {
  try {
    const { command_id, success: cmdSuccess, message } = req.body;
    if (!command_id) {
      return res.status(400).json({ success: false, error: 'command_id required' });
    }

    const newStatus = cmdSuccess ? 'completed' : 'failed';

    await query(
      `UPDATE trackman_restart_commands
       SET status = $1, completed_at = NOW(), result_message = $2
       WHERE id = $3 AND device_id = $4`,
      [newStatus, message || '', command_id, req.device!.id]
    );

    if (cmdSuccess) {
      await query(
        'UPDATE trackman_devices SET last_restart_at = NOW() WHERE id = $1',
        [req.device!.id]
      );
    }

    return res.json({ success: true });
  } catch (error: any) {
    logger.error('Error processing command report:', error);
    return res.status(500).json({ success: false, error: 'Report failed' });
  }
});

export default router;
