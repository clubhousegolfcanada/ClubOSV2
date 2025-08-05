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
      // Check user's notification preferences
      const prefsResult = await db.query(
        `SELECT * FROM notification_preferences WHERE user_id = $1`,
        [userId]
      );

      const prefs = prefsResult.rows[0];
      
      // Check if notifications are enabled for this type
      if (prefs) {
        const type = notification.data?.type || 'messages';
        if (type === 'messages' && !prefs.messages_enabled) return;
        if (type === 'tickets' && !prefs.tickets_enabled) return;
        if (type === 'system' && !prefs.system_enabled) return;

        // Check quiet hours
        if (prefs.quiet_hours_enabled) {
          const now = new Date();
          const currentTime = now.getHours() * 60 + now.getMinutes();
          const startTime = this.timeToMinutes(prefs.quiet_hours_start);
          const endTime = this.timeToMinutes(prefs.quiet_hours_end);

          if (startTime < endTime) {
            // Normal case: quiet hours don't cross midnight
            if (currentTime >= startTime && currentTime < endTime) {
              logger.info(`Skipping notification for user ${userId} - quiet hours`);
              return;
            }
          } else {
            // Quiet hours cross midnight
            if (currentTime >= startTime || currentTime < endTime) {
              logger.info(`Skipping notification for user ${userId} - quiet hours`);
              return;
            }
          }
        }
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

      // Update last used timestamp
      await db.query(
        `UPDATE push_subscriptions 
         SET last_used_at = NOW(), failed_attempts = 0 
         WHERE id = $1`,
        [subscription.id]
      );

      // Log to history
      await this.logNotification(subscription.user_id, subscription.id, notification, 'sent');
    } catch (error: any) {
      logger.error('Failed to send push notification:', error);

      // Handle different error types
      if (error.statusCode === 410) {
        // Subscription expired - mark as inactive
        await db.query(
          `UPDATE push_subscriptions SET is_active = false WHERE id = $1`,
          [subscription.id]
        );
      } else {
        // Increment failed attempts
        await db.query(
          `UPDATE push_subscriptions 
           SET failed_attempts = failed_attempts + 1 
           WHERE id = $1`,
          [subscription.id]
        );

        // Disable after 5 failed attempts
        await db.query(
          `UPDATE push_subscriptions 
           SET is_active = false 
           WHERE id = $1 AND failed_attempts >= 5`,
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