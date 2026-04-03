import cron from 'node-cron';
import { query } from '../utils/db';
import { logger } from '../utils/logger';

class TrackmanRestartJob {
  private task: cron.ScheduledTask | null = null;
  private isRunning = false;

  async start() {
    try {
      const settings = await this.getSettings();
      if (settings.enabled && settings.cron) {
        this.schedule(settings.cron);
      }
      logger.info(`TrackMan restart job initialized (enabled: ${settings.enabled}, cron: ${settings.cron})`);
    } catch (error) {
      logger.error('Failed to start TrackMan restart job:', error);
    }

    // Expire stale commands on startup
    setTimeout(() => this.expireStaleCommands(), 10000);
  }

  private schedule(cronExpr: string) {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }

    if (!cron.validate(cronExpr)) {
      logger.error(`Invalid cron expression for TrackMan restart: ${cronExpr}`);
      return;
    }

    this.task = cron.schedule(cronExpr, async () => {
      await this.execute();
    });

    logger.info(`TrackMan restart scheduled: ${cronExpr}`);
  }

  async reload() {
    try {
      const settings = await this.getSettings();
      if (this.task) {
        this.task.stop();
        this.task = null;
      }
      if (settings.enabled && settings.cron) {
        this.schedule(settings.cron);
      }
      logger.info(`TrackMan restart job reloaded (enabled: ${settings.enabled}, cron: ${settings.cron})`);
    } catch (error) {
      logger.error('Failed to reload TrackMan restart job:', error);
    }
  }

  private async execute() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      logger.info('TrackMan auto-restart: creating restart commands for all devices');

      // Get all registered devices
      const devices = await query('SELECT id, hostname, location FROM trackman_devices');
      if (devices.rows.length === 0) {
        logger.info('TrackMan auto-restart: no devices registered, skipping');
        return;
      }

      // Create pending commands
      let created = 0;
      for (const device of devices.rows) {
        await query(
          `INSERT INTO trackman_restart_commands (device_id, source, requested_by)
           VALUES ($1, 'cron', NULL)`,
          [device.id]
        );
        created++;
      }

      logger.info(`TrackMan auto-restart: ${created} restart commands created`);

      // Expire stale commands
      await this.expireStaleCommands();

    } catch (error) {
      logger.error('TrackMan auto-restart error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async expireStaleCommands() {
    try {
      const result = await query(
        `UPDATE trackman_restart_commands
         SET status = 'expired'
         WHERE status = 'pending' AND expires_at < NOW()`
      );
      if (result.rowCount && result.rowCount > 0) {
        logger.info(`TrackMan: expired ${result.rowCount} stale commands`);
      }
    } catch (error) {
      logger.error('Error expiring stale TrackMan commands:', error);
    }
  }

  private async getSettings(): Promise<{ enabled: boolean; cron: string; notify_slack: boolean }> {
    try {
      const result = await query(
        "SELECT value FROM system_settings WHERE key = 'trackman_auto_restart'"
      );
      if (result.rows.length > 0) {
        return result.rows[0].value;
      }
    } catch (error) {
      logger.error('Error reading TrackMan restart settings:', error);
    }
    return { enabled: true, cron: '0 3 * * *', notify_slack: true };
  }
}

export const trackmanRestartJob = new TrackmanRestartJob();
