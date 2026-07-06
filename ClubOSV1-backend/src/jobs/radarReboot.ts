import cron from 'node-cron';
import { query } from '../utils/db';
import { logger } from '../utils/logger';

/**
 * Nightly radar reboot job — mirrors jobs/trackmanRestart.ts but enqueues
 * 'reboot_radar' commands for every registered device. Only TrackMan agent
 * v1.2.0+ executes them; older agents no-op and the queue rows expire after
 * 10 minutes, so enabling this before full agent rollout is harmless.
 *
 * Settings live in system_settings under 'trackman_radar_auto_reboot' as
 * { enabled: boolean, time: 'HH:MM' }. The time is Atlantic local time —
 * the task is scheduled with an explicit America/Halifax timezone so "04:00"
 * means 4am at the facilities regardless of the server's timezone.
 */
class RadarRebootJob {
  private task: cron.ScheduledTask | null = null;
  private isRunning = false;

  async start() {
    try {
      const settings = await this.getSettings();
      if (settings.enabled && settings.time) {
        this.schedule(settings.time);
      }
      logger.info(`Radar reboot job initialized (enabled: ${settings.enabled}, time: ${settings.time})`);
    } catch (error) {
      logger.error('Failed to start radar reboot job:', error);
    }
  }

  async reload() {
    try {
      const settings = await this.getSettings();
      if (this.task) {
        this.task.stop();
        this.task = null;
      }
      if (settings.enabled && settings.time) {
        this.schedule(settings.time);
      }
      logger.info(`Radar reboot job reloaded (enabled: ${settings.enabled}, time: ${settings.time})`);
    } catch (error) {
      logger.error('Failed to reload radar reboot job:', error);
    }
  }

  private schedule(time: string) {
    const match = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) {
      logger.error(`Invalid time for radar reboot schedule: ${time}`);
      return;
    }
    const cronExpr = `${parseInt(match[2], 10)} ${parseInt(match[1], 10)} * * *`;

    if (this.task) {
      this.task.stop();
      this.task = null;
    }

    this.task = cron.schedule(cronExpr, async () => {
      await this.execute();
    }, { timezone: 'America/Halifax' });

    logger.info(`Nightly radar reboot scheduled: ${time} Atlantic (cron: ${cronExpr})`);
  }

  private async execute() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      logger.info('Nightly radar reboot: creating reboot_radar commands for all devices');

      const devices = await query('SELECT id, hostname FROM trackman_devices');
      if (devices.rows.length === 0) {
        logger.info('Nightly radar reboot: no devices registered, skipping');
        return;
      }

      let created = 0;
      for (const device of devices.rows) {
        await query(
          `INSERT INTO trackman_restart_commands (device_id, source, requested_by, command_type)
           VALUES ($1, 'cron', NULL, 'reboot_radar')`,
          [device.id]
        );
        created++;
      }

      logger.info(`Nightly radar reboot: ${created} reboot_radar commands created`);
    } catch (error) {
      logger.error('Nightly radar reboot error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async getSettings(): Promise<{ enabled: boolean; time: string }> {
    try {
      const result = await query(
        "SELECT value FROM system_settings WHERE key = 'trackman_radar_auto_reboot'"
      );
      if (result.rows.length > 0) {
        return result.rows[0].value;
      }
    } catch (error) {
      logger.error('Error reading radar reboot settings:', error);
    }
    return { enabled: false, time: '04:00' };
  }
}

export const radarRebootJob = new RadarRebootJob();
