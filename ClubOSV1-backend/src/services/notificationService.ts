import webpush from 'web-push';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { config } from '../utils/envValidator';

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  vibrate?: number[];
  sound?: string;
  silent?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

class NotificationService {
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY || !config.VAPID_EMAIL) {
        logger.warn('VAPID keys not configured - push notifications disabled');
        return;
      }

      webpush.setVapidDetails(
        config.VAPID_EMAIL,
        config.VAPID_PUBLIC_KEY,
        config.VAPID_PRIVATE_KEY
      );

      this.initialized = true;
      logger.info('Notification service initialized');
    } catch (error) {
      logger.error('Failed to initialize notification service:', error);
    }
  }

  /**
   * Send notification to a specific user
   */
  async sendToUser(userId: string, notification: NotificationPayload): Promise<void> {
    if (!this.initialized) {
      logger.warn('Notification service not initialized');
      return;
    }

    try {
      // Check user's notification preferences.
      // Non-fatal: if this query fails (table missing, transient DB error), send anyway.
      // Better to send an unwanted notification than silently drop an important one.
      try {
        const prefsResult = await db.query(
          `SELECT * FROM notification_preferences WHERE user_id = $1`,
          [userId]
        );

        const prefs = prefsResult.rows[0];

        if (prefs) {
          const type = notification.data?.type || 'messages';
          if (type === 'messages' && prefs.messages_enabled === false) return;
          if (type === 'tickets' && prefs.tickets_enabled === false) return;
          if (type === 'system' && prefs.system_enabled === false) return;

          // Check quiet hours
          if (prefs.quiet_hours_enabled && prefs.quiet_hours_start && prefs.quiet_hours_end) {
            const now = new Date();
            const currentTime = now.getHours() * 60 + now.getMinutes();
            const startTime = this.timeToMinutes(prefs.quiet_hours_start);
            const endTime = this.timeToMinutes(prefs.quiet_hours_end);

            if (startTime < endTime) {
              if (currentTime >= startTime && currentTime < endTime) {
                logger.info(`Skipping notification for user ${userId} - quiet hours`);
                return;
              }
            } else {
              if (currentTime >= startTime || currentTime < endTime) {
                logger.info(`Skipping notification for user ${userId} - quiet hours`);
                return;
              }
            }
          }
        }
      } catch (prefsErr) {
        // Preferences check failed — send notification anyway
        logger.warn(`Notification preferences check failed for user ${userId}, sending anyway:`, prefsErr);
      }

      // Get active subscriptions for user
      const subscriptions = await db.query(
        `SELECT * FROM push_subscriptions 
         WHERE user_id = $1 AND is_active = true 
         ORDER BY last_used_at DESC`,
        [userId]
      );

      if (subscriptions.rows.length === 0) {
        logger.debug(`No active push subscriptions for user ${userId}`);
        return;
      }

      // Send to all user's devices
      const results = await Promise.allSettled(
        subscriptions.rows.map(sub => this.sendNotification(sub as PushSubscription, notification))
      );

      // Log results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (successful > 0) {
        logger.info(`Sent notification to ${successful} devices for user ${userId}`);
      }
      if (failed > 0) {
        logger.warn(`Failed to send notification to ${failed} devices for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error sending notification to user:', error);
    }
  }

  /**
   * Send notification to specific subscription
   */
  private async sendNotification(
    subscription: PushSubscription,
    notification: NotificationPayload
  ): Promise<void> {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth
      }
    };

    try {
      // Add default icon and badge
      const payload = {
        ...notification,
        icon: notification.icon || '/logo-192.png',
        badge: notification.badge || '/badge-72.png',
        timestamp: Date.now()
      };

      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify(payload)
      );

      // Update last used timestamp and re-activate if previously deactivated by transient errors.
      // This handles the case where a subscription was disabled by temporary failures
      // (e.g. Android Doze throttling FCM) but the push service is working again.
      await db.query(
        `UPDATE push_subscriptions
         SET last_used_at = NOW(), failed_attempts = 0, is_active = true
         WHERE id = $1`,
        [subscription.id]
      );

      // Log to history
      await this.logNotification(subscription.user_id, subscription.id, notification, 'sent');
    } catch (error: any) {
      logger.error('Failed to send push notification:', {
        error: error.message,
        statusCode: error.statusCode,
        subscriptionId: subscription.id,
        userId: subscription.user_id,
        endpoint: subscription.endpoint.substring(0, 60),
      });

      // Handle different error types:
      // 404/410 = subscription genuinely expired or invalid → deactivate immediately
      // 401/403 = VAPID auth issue → don't punish the subscription, it's our problem
      // 429 = rate limited → transient, don't count
      // 5xx/network = push service down → transient, don't count
      const status = error.statusCode;

      if (status === 410 || status === 404) {
        // Subscription expired or endpoint gone — permanently deactivate
        await db.query(
          `UPDATE push_subscriptions SET is_active = false WHERE id = $1`,
          [subscription.id]
        );
        logger.info('Push subscription expired, deactivated', {
          subscriptionId: subscription.id,
          statusCode: status,
        });
      } else if (status === 401 || status === 403) {
        // VAPID auth issue — log loudly but don't touch the subscription
        logger.error('Push VAPID auth failure — check VAPID keys', {
          statusCode: status,
          subscriptionId: subscription.id,
        });
      } else {
        // Transient failure (429 rate limit, 5xx server error, network timeout).
        // Increment counter but use a generous threshold. Android aggressively
        // throttles background network (Doze mode, App Standby) which causes
        // temporary FCM failures. 5 was way too aggressive — subscriptions were
        // getting permanently killed by normal Android power management.
        await db.query(
          `UPDATE push_subscriptions
           SET failed_attempts = failed_attempts + 1
           WHERE id = $1`,
          [subscription.id]
        );

        // Only deactivate after 25 consecutive failures (was 5).
        // Successful sends reset the counter to 0, so this only triggers
        // for subscriptions that are truly dead.
        await db.query(
          `UPDATE push_subscriptions
           SET is_active = false
           WHERE id = $1 AND failed_attempts >= 25`,
          [subscription.id]
        );
      }

      // Log failure
      await this.logNotification(
        subscription.user_id,
        subscription.id,
        notification,
        'failed',
        error.message
      );

      throw error;
    }
  }

  /**
   * Log notification for analytics
   */
  private async logNotification(
    userId: string,
    subscriptionId: string,
    notification: NotificationPayload,
    status: string,
    error?: string
  ): Promise<void> {
    try {
      await db.query(
        `INSERT INTO notification_history 
         (user_id, subscription_id, type, title, body, data, status, error)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          subscriptionId,
          notification.data?.type || 'messages',
          notification.title,
          notification.body,
          JSON.stringify(notification.data || {}),
          status,
          error
        ]
      );
    } catch (err) {
      logger.error('Failed to log notification:', err);
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendToUsers(userIds: string[], notification: NotificationPayload): Promise<void> {
    await Promise.allSettled(
      userIds.map(userId => this.sendToUser(userId, notification))
    );
  }

  /**
   * Send notification to users with specific role
   */
  async sendToRole(role: string, notification: NotificationPayload): Promise<void> {
    try {
      const users = await db.query(
        `SELECT id FROM users WHERE role = $1 AND is_active = true`,
        [role]
      );

      const userIds = users.rows.map(u => u.id);
      await this.sendToUsers(userIds, notification);
    } catch (error) {
      logger.error('Error sending notification to role:', error);
    }
  }

  /**
   * Mark notification as clicked
   */
  async markAsClicked(notificationId: string): Promise<void> {
    try {
      await db.query(
        `UPDATE notification_history 
         SET status = 'clicked', clicked_at = NOW() 
         WHERE id = $1`,
        [notificationId]
      );
    } catch (error) {
      logger.error('Error marking notification as clicked:', error);
    }
  }

  /**
   * Convert time string to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Test notification sending
   */
  async sendTestNotification(userId: string): Promise<void> {
    await this.sendToUser(userId, {
      title: 'Test Notification',
      body: 'This is a test notification from ClubOS',
      tag: 'test',
      data: {
        type: 'system',
        test: true
      }
    });
  }
}

// Export singleton instance
export const notificationService = new NotificationService();