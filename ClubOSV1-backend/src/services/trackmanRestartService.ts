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
 * Recognized command types issued to the TrackMan agent .exe.
 * The agent polls every 30s for pending commands and dispatches based on this value.
 *
 * Bay-targeted:   restart, reboot, restart-browser, restart-all
 * Location-wide:  restart-music, restart-tv, projector-power, projector-input, projector-autosize, other
 *
 * The agent implementation may no-op on types it doesn't yet handle; the queue
 * will naturally expire unhandled commands after 10 minutes.
 */
export type TrackmanCommandType =
  | 'restart'
  | 'reboot'
  | 'restart-browser'
  | 'restart-all'
  | 'restart-music'
  | 'restart-tv'
  | 'projector-power'
  | 'projector-input'
  | 'projector-autosize'
  | 'other';

export type CommandSource = 'dashboard' | 'cron' | 'clubai' | 'api';

// Command types that target an entire location rather than a single bay.
// These are routed to the first registered device at the location so the agent
// picks them up on its next poll.
const LOCATION_LEVEL_COMMANDS: ReadonlySet<TrackmanCommandType> = new Set([
  'restart-music',
  'restart-tv',
  'projector-power',
  'projector-input',
  'projector-autosize',
  'other',
]);

// Per-command cooldowns. Each command type cools down against its own history
// only — a TrackMan restart does not block a PC reboot, and vice versa.
// Lightweight commands (projector input change, etc.) are absent and skip the check.
const COOLDOWN_MS: Partial<Record<TrackmanCommandType, number>> = {
  'restart':     5 * 60 * 1000,   // TrackMan software restart
  'reboot':      10 * 60 * 1000,  // Full PC reboot
  'restart-all': 10 * 60 * 1000,  // TrackMan + browser
};

/**
 * Trigger a TrackMan restart for a specific location + bay.
 * Used by: dashboard, commands page, RemoteActionsBar, ClubAI SMS.
 */
export async function triggerRestart(
  location: string,
  bayNumber: number,
  source: CommandSource,
  requestedBy?: string | null,
  commandType: TrackmanCommandType = 'restart'
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
      'SELECT id, display_name FROM trackman_devices WHERE location = $1 AND bay_number = $2',
      [location, bayNumber]
    );

    if (deviceResult.rows.length === 0) {
      return { success: false, error: `No device registered for ${location} Bay ${bayNumber}` };
    }

    const device = deviceResult.rows[0];

    // Safety: per-type cooldown. Only blocks a repeat of the same command type.
    const cooldownMs = COOLDOWN_MS[commandType];
    if (cooldownMs) {
      const recent = await query(
        `SELECT requested_at FROM trackman_restart_commands
         WHERE device_id = $1 AND command_type = $2
           AND status IN ('pending','acknowledged','completed')
           AND requested_at > NOW() - ($3 || ' milliseconds')::interval
         ORDER BY requested_at DESC
         LIMIT 1`,
        [device.id, commandType, cooldownMs]
      );
      if (recent.rows.length > 0) {
        const timeSince = Date.now() - new Date(recent.rows[0].requested_at).getTime();
        const minutesAgo = Math.max(1, Math.floor(timeSince / 60000));
        const cooldownMin = Math.round(cooldownMs / 60000);
        return { success: false, error: `Last ${commandType} was ${minutesAgo} min ago. Wait at least ${cooldownMin} minutes between ${commandType} commands.` };
      }
    }

    // Create command
    const result = await query(
      `INSERT INTO trackman_restart_commands (device_id, source, requested_by, command_type)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [device.id, source, requestedBy || null, commandType]
    );

    const commandId = result.rows[0].id;
    logger.info(`TrackMan ${commandType} triggered: ${device.display_name} at ${location} Bay ${bayNumber} (source: ${source}, command: ${commandId})`);

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
 * Trigger a location-wide command (music/TV/projector) through the TrackMan agent queue.
 *
 * These commands are not bay-specific, so we route them to the first registered
 * device at the location — whichever bay PC's .exe picks it up first will execute
 * it. The agent can be updated in the future to recognize and dispatch these
 * command types (e.g., sending the music/TV/projector an IP command locally).
 *
 * Until the agent supports a given type, the command will simply expire unhandled
 * after 10 minutes. No error is surfaced to the operator in that case; the queue
 * row is visible in the database for debugging.
 */
export async function triggerLocationCommand(
  location: string,
  commandType: TrackmanCommandType,
  source: CommandSource,
  requestedBy?: string | null
): Promise<RestartResult> {
  try {
    if (!LOCATION_LEVEL_COMMANDS.has(commandType)) {
      return { success: false, error: `Command '${commandType}' is not a location-level command. Use triggerRestart() with a bay number.` };
    }

    const validLocation = TRACKMAN_LOCATIONS.find(l => l.name === location);
    if (!validLocation) {
      return { success: false, error: `Invalid location: ${location}` };
    }

    // Pick first registered device at the location as the carrier for this command
    const deviceResult = await query(
      `SELECT id, display_name FROM trackman_devices
       WHERE location = $1
       ORDER BY bay_number ASC NULLS LAST
       LIMIT 1`,
      [location]
    );

    if (deviceResult.rows.length === 0) {
      return { success: false, error: `No TrackMan agent registered at ${location} to relay this command.` };
    }

    const device = deviceResult.rows[0];

    const result = await query(
      `INSERT INTO trackman_restart_commands (device_id, source, requested_by, command_type)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [device.id, source, requestedBy || null, commandType]
    );

    const commandId = result.rows[0].id;
    logger.info(`TrackMan location command ${commandType} queued at ${location} via ${device.display_name} (source: ${source}, command: ${commandId})`);

    return {
      success: true,
      commandId,
      deviceName: `${location} (${device.display_name})`
    };
  } catch (error: any) {
    logger.error('TrackMan location command error:', error);
    return { success: false, error: 'Internal error triggering location command' };
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
