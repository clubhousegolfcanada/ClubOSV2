import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { query } from '../utils/db';
import { slackFallback } from '../services/slackFallback';
import { logger } from '../utils/logger';
import {
  triggerRestart,
  triggerLocationCommand,
  checkRestartStatus,
  TRACKMAN_LOCATIONS,
  type TrackmanCommandType,
} from '../services/trackmanRestartService';

const router = express.Router();

// Action strings accepted from the dashboard, mapped to TrackMan agent command types.
const ACTION_TO_COMMAND_TYPE: Record<string, TrackmanCommandType> = {
  'restart-trackman':   'restart',
  'reboot-pc':          'reboot',
  'restart-browser':    'restart-browser',
  'restart-all':        'restart-all',
  'restart-music':      'restart-music',
  'restart-tv':         'restart-tv',
  'projector-power':    'projector-power',
  'projector-input':    'projector-input',
  'projector-autosize': 'projector-autosize',
  'other':              'other',
};

// Actions that don't target a specific bay — they queue against the location.
const LOCATION_ACTIONS = new Set([
  'restart-music',
  'restart-tv',
  'projector-power',
  'projector-input',
  'projector-autosize',
  'other',
]);

const ACTION_LABELS: Record<string, string> = {
  'restart-trackman':   'TrackMan restart',
  'reboot-pc':          'PC reboot',
  'restart-browser':    'Browser restart',
  'restart-all':        'Full software restart',
  'restart-music':      'Music system restart',
  'restart-tv':         'Tournament TV restart',
  'projector-power':    'Projector power toggle',
  'projector-input':    'Projector input change',
  'projector-autosize': 'Projector autosize',
  'other':              'Other system action',
};

const ESTIMATED_TIME: Record<string, string> = {
  'restart-trackman':   '30-60 seconds',
  'reboot-pc':          '2-3 minutes',
  'restart-browser':    '10-30 seconds',
  'restart-all':        '60-90 seconds',
  'restart-music':      '10-30 seconds',
  'restart-tv':         '10-30 seconds',
  'projector-power':    '10 seconds',
  'projector-input':    '5 seconds',
  'projector-autosize': '5 seconds',
  'other':              '30 seconds',
};

/**
 * POST /api/remote-actions/execute
 *
 * Dispatches a remote action through the TrackMan agent command queue.
 * The .exe installed on each bay PC polls `/api/trackman-remote` every 30s
 * and picks up pending commands from `trackman_restart_commands`.
 *
 * Bay-specific actions (restart-trackman, reboot-pc, restart-browser, restart-all)
 * are queued against the targeted bay's registered device.
 *
 * Location-wide actions (restart-music, restart-tv, projector-*, other)
 * are queued against the first registered device at the location.
 * The agent may no-op command types it doesn't yet support; commands
 * expire naturally after 10 minutes.
 */
router.post('/execute', authenticate, authorize(['operator', 'admin']), async (req, res) => {
  try {
    const { action, location, bayNumber } = req.body;

    if (!action || !location) {
      return res.status(400).json({ error: 'Missing required parameters', message: 'Action and location are required' });
    }

    const commandType = ACTION_TO_COMMAND_TYPE[action];
    if (!commandType) {
      return res.status(400).json({ error: 'Invalid action', message: `Action '${action}' is not supported` });
    }

    const isLocationAction = LOCATION_ACTIONS.has(action);

    if (!isLocationAction && !bayNumber) {
      return res.status(400).json({ error: 'Missing bay number', message: 'Bay number is required for this action' });
    }

    const result = isLocationAction
      ? await triggerLocationCommand(location, commandType, 'dashboard', req.user!.id)
      : await triggerRestart(location, parseInt(bayNumber, 10), 'dashboard', req.user!.id, commandType);

    if (!result.success) {
      return res.status(400).json({ error: 'Failed to dispatch action', message: result.error });
    }

    // Best-effort Slack notification — don't block on failures
    try {
      await slackFallback.sendMessage({
        channel: action === 'reboot-pc' ? '#tech-alerts' : '#tech-actions-log',
        username: 'ClubOS Remote Actions',
        text: `🔧 ${ACTION_LABELS[action] || action} queued`,
        attachments: [{
          title: 'Remote Action',
          text: '',
          color: action === 'reboot-pc' ? 'warning' : 'good',
          fields: [
            { title: 'User', value: req.user!.email, short: true },
            { title: 'Action', value: ACTION_LABELS[action] || action, short: true },
            { title: 'Device', value: result.deviceName || location, short: true },
            { title: 'Method', value: 'TrackMan agent — picks up within 30s', short: false },
          ],
        }],
      });
    } catch (slackError) {
      logger.warn('Could not send Slack notification:', slackError);
    }

    return res.json({
      success: true,
      message: `${ACTION_LABELS[action] || action} queued for ${result.deviceName}. Will execute within 30 seconds.`,
      jobId: result.commandId,
      device: result.deviceName,
      estimatedTime: ESTIMATED_TIME[action] || '30-60 seconds',
    });
  } catch (error: any) {
    logger.error('Remote action error:', error);
    return res.status(500).json({ error: 'Failed to execute remote action', message: error.message || 'Unexpected error' });
  }
});

/**
 * GET /api/remote-actions/status/:jobId
 * Returns the status of a queued command (jobId is the TrackMan command UUID).
 */
router.get('/status/:jobId', authenticate, async (req, res) => {
  try {
    const status = await checkRestartStatus(req.params.jobId);

    // Map internal statuses to the contract the frontend expects
    const frontendStatus =
      status.status === 'acknowledged' ? 'running' :
      status.status === 'completed'     ? 'completed' :
      status.status === 'failed'        ? 'failed' :
      status.status === 'expired'       ? 'failed' :
      status.status === 'not_found'     ? 'failed' :
      'pending';

    return res.json({
      jobId: req.params.jobId,
      status: frontendStatus,
      result: status.message ? { message: status.message } : undefined,
    });
  } catch (error: any) {
    logger.error('Remote action status error:', error);
    return res.status(500).json({ error: 'Failed to check job status' });
  }
});

/**
 * GET /api/remote-actions/devices/:location
 * Returns registered TrackMan agent devices at a location.
 */
router.get('/devices/:location', authenticate, authorize(['operator', 'admin']), async (req, res) => {
  try {
    const location = req.params.location;

    if (!TRACKMAN_LOCATIONS.find(l => l.name === location)) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const result = await query(
      `SELECT bay_number, display_name, id, last_seen_at,
              CASE WHEN last_seen_at > NOW() - INTERVAL '2 minutes' THEN 'online' ELSE 'offline' END as status
       FROM trackman_devices
       WHERE location = $1
       ORDER BY bay_number NULLS LAST`,
      [location]
    );

    const devices = result.rows.map((row: any) => ({
      bay: row.bay_number != null ? String(row.bay_number) : '',
      name: row.display_name,
      deviceId: row.id,
      status: row.status,
      lastSeen: row.last_seen_at,
    }));

    return res.json({ devices });
  } catch (error: any) {
    logger.error('Remote action devices error:', error);
    return res.status(500).json({ error: 'Failed to get device status' });
  }
});

/**
 * GET /api/remote-actions/recent
 * Recent commands across all devices (for monitoring).
 */
router.get('/recent', authenticate, authorize(['operator', 'admin']), async (_req, res) => {
  try {
    const result = await query(
      `SELECT
         c.command_type  AS action_type,
         d.location      AS location,
         d.display_name  AS device_name,
         c.requested_by  AS initiated_by,
         c.status        AS status,
         c.requested_at  AS created_at
       FROM trackman_restart_commands c
       JOIN trackman_devices d ON d.id = c.device_id
       ORDER BY c.requested_at DESC
       LIMIT 20`
    );

    return res.json({ actions: result.rows });
  } catch (error) {
    return res.json({ actions: [] });
  }
});

export default router;
