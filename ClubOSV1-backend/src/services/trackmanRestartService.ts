import { query } from '../utils/db';
import { logger } from '../utils/logger';

// Canonical location config — single source of truth
export const TRACKMAN_LOCATIONS = [
  { name: 'Bedford', bays: 2 },
  { name: 'Dartmouth', bays: 4 },
  { name: 'Bayers Lake', bays: 4 },
  { name: 'Truro', bays: 3 },
  { name: 'River Oaks', bays: 2 },
];

export interface RestartResult {
  success: boolean;
  commandId?: string;
  deviceName?: string;
  error?: string;
}

export interface RestartStatus {
  status: 'pending' | 'acknowledged' | 'completed' | 'failed' | 'expired' | 'not_found';
  message?: string;
}

/**
 * Trigger a TrackMan restart for a specific location + bay.
 * Used by: dashboard, commands page, RemoteActionsBar, ClubAI SMS.
 */
export async function triggerRestart(
  location: string,
  bayNumber: number,
  source: 'dashboard' | 'cron' | 'clubai' | 'api',
  requestedBy?: string | null
): Promise<RestartResult> {
  try {
    // Validate location
    const validLocation = TRACKMAN_LOCATIONS.find(l => l.name === location);
    if (!validLocation) {
      return { success: false, error: `Invalid location: ${location}` };
    }
    if (bayNumber < 1 || bayNumber > validLocation.bays) {
      return { success: false, error: `Bay ${bayNumber} out of range for ${location} (1-${validLocation.bays})` };
    }

    // Find device
    const deviceResult = await query(
      'SELECT id, display_name, last_restart_at FROM trackman_devices WHERE location = $1 AND bay_number = $2',
      [location, bayNumber]
    );

    if (deviceResult.rows.length === 0) {
      return { success: false, error: `No device registered for ${location} Bay ${bayNumber}` };
    }

    const device = deviceResult.rows[0];

    // Safety: check 10-minute cooldown
    if (device.last_restart_at) {
      const timeSinceLastRestart = Date.now() - new Date(device.last_restart_at).getTime();
      if (timeSinceLastRestart < 10 * 60 * 1000) {
        const minutesAgo = Math.floor(timeSinceLastRestart / 60000);
        return { success: false, error: `Device was restarted ${minutesAgo} minutes ago. Wait at least 10 minutes between restarts.` };
      }
    }

    // Create restart command
    const result = await query(
      `INSERT INTO trackman_restart_commands (device_id, source, requested_by)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [device.id, source, requestedBy || null]
    );

    const commandId = result.rows[0].id;
    logger.info(`TrackMan restart triggered: ${device.display_name} at ${location} Bay ${bayNumber} (source: ${source}, command: ${commandId})`);

    return {
      success: true,
      commandId,
      deviceName: device.display_name
    };
  } catch (error: any) {
    logger.error('TrackMan restart trigger error:', error);
    return { success: false, error: 'Internal error triggering restart' };
  }
}

/**
 * Check the status of a restart command.
 * Used for follow-up after ClubAI triggers a restart.
 */
export async function checkRestartStatus(commandId: string): Promise<RestartStatus> {
  try {
    const result = await query(
      'SELECT status, result_message FROM trackman_restart_commands WHERE id = $1',
      [commandId]
    );

    if (result.rows.length === 0) {
      return { status: 'not_found' };
    }

    return {
      status: result.rows[0].status,
      message: result.rows[0].result_message
    };
  } catch (error: any) {
    logger.error('TrackMan restart status check error:', error);
    return { status: 'not_found' };
  }
}

/**
 * Check if the ClubAI remote restart feature is enabled.
 */
export async function isClubAIRestartEnabled(): Promise<boolean> {
  try {
    const result = await query(
      "SELECT value FROM system_settings WHERE key = 'clubai_remote_restart_enabled'"
    );
    if (result.rows.length > 0) {
      const val = result.rows[0].value;
      return val === true || val === 'true';
    }
  } catch (error) {
    logger.warn('Failed to check clubai_remote_restart_enabled:', error);
  }
  return false;
}
