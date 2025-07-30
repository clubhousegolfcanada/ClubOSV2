import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validation';
import { body } from 'express-validator';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { notificationService } from '../services/notificationService';
import { config } from '../utils/envValidator';

const router = Router();

// Get VAPID public key for frontend
router.get('/vapid-key', (req: Request, res: Response) => {
  if (!config.VAPID_PUBLIC_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Push notifications not configured'
    });
  }

  res.json({
    success: true,
    data: {
      publicKey: config.VAPID_PUBLIC_KEY
    }
  });
});

// Subscribe to push notifications
router.post('/subscribe',
  authenticate,
  validate([
    body('endpoint').isURL().withMessage('Invalid endpoint URL'),
    body('keys.p256dh').isString().notEmpty().withMessage('Invalid p256dh key'),
    body('keys.auth').isString().notEmpty().withMessage('Invalid auth key')
  ]),
  async (req: Request, res: Response, next) => {
    try {
      const { endpoint, keys } = req.body;
      const userId = req.user!.id;
      const userAgent = req.headers['user-agent'] || null;

      // Check if subscription already exists
      const existing = await db.query(
        `SELECT id FROM push_subscriptions 
         WHERE user_id = $1 AND endpoint = $2`,
        [userId, endpoint]
      );

      if (existing.rows.length > 0) {
        // Update existing subscription
        await db.query(
          `UPDATE push_subscriptions 
           SET p256dh = $1, auth = $2, user_agent = $3, 
               last_used_at = NOW(), is_active = true, failed_attempts = 0
           WHERE user_id = $4 AND endpoint = $5`,
          [keys.p256dh, keys.auth, userAgent, userId, endpoint]
        );
      } else {
        // Create new subscription
        await db.query(
          `INSERT INTO push_subscriptions 
           (user_id, endpoint, p256dh, auth, user_agent)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, endpoint, keys.p256dh, keys.auth, userAgent]
        );
      }

      // Create default preferences if not exists
      await db.query(
        `INSERT INTO notification_preferences (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );

      logger.info('Push subscription created/updated', {
        userId,
        endpoint: endpoint.substring(0, 50) + '...'
      });

      res.json({
        success: true,
        message: 'Successfully subscribed to push notifications'
      });
    } catch (error) {
      logger.error('Error subscribing to push notifications:', error);
      next(error);
    }
  }
);

// Unsubscribe from push notifications
router.delete('/subscribe',
  authenticate,
  validate([
    body('endpoint').isURL().withMessage('Invalid endpoint URL')
  ]),
  async (req: Request, res: Response, next) => {
    try {
      const { endpoint } = req.body;
      const userId = req.user!.id;

      const result = await db.query(
        `UPDATE push_subscriptions 
         SET is_active = false 
         WHERE user_id = $1 AND endpoint = $2`,
        [userId, endpoint]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: 'Subscription not found'
        });
      }

      logger.info('Push subscription deactivated', { userId });

      res.json({
        success: true,
        message: 'Successfully unsubscribed from push notifications'
      });
    } catch (error) {
      logger.error('Error unsubscribing from push notifications:', error);
      next(error);
    }
  }
);

// Get subscription status
router.get('/subscription-status',
  authenticate,
  async (req: Request, res: Response, next) => {
    try {
      const userId = req.user!.id;

      const subscriptions = await db.query(
        `SELECT endpoint, created_at, last_used_at, user_agent
         FROM push_subscriptions 
         WHERE user_id = $1 AND is_active = true
         ORDER BY last_used_at DESC`,
        [userId]
      );

      const preferences = await db.query(
        `SELECT * FROM notification_preferences WHERE user_id = $1`,
        [userId]
      );

      res.json({
        success: true,
        data: {
          subscriptions: subscriptions.rows.map(sub => ({
            ...sub,
            endpoint: sub.endpoint.substring(0, 50) + '...' // Truncate for security
          })),
          preferences: preferences.rows[0] || {
            messages_enabled: true,
            tickets_enabled: true,
            system_enabled: true,
            quiet_hours_enabled: false,
            quiet_hours_start: '22:00',
            quiet_hours_end: '08:00'
          }
        }
      });
    } catch (error) {
      logger.error('Error getting subscription status:', error);
      next(error);
    }
  }
);

// Update notification preferences
router.put('/preferences',
  authenticate,
  validate([
    body('messages_enabled').optional().isBoolean(),
    body('tickets_enabled').optional().isBoolean(),
    body('system_enabled').optional().isBoolean(),
    body('quiet_hours_enabled').optional().isBoolean(),
    body('quiet_hours_start').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
    body('quiet_hours_end').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
  ]),
  async (req: Request, res: Response, next) => {
    try {
      const userId = req.user!.id;
      const updates = req.body;

      // Build dynamic update query
      const updateFields = Object.keys(updates);
      const updateValues = updateFields.map((field, index) => `${field} = $${index + 2}`);
      const values = [userId, ...updateFields.map(field => updates[field])];

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No fields to update'
        });
      }

      await db.query(
        `INSERT INTO notification_preferences (user_id, ${updateFields.join(', ')})
         VALUES ($1, ${updateFields.map((_, i) => `$${i + 2}`).join(', ')})
         ON CONFLICT (user_id) DO UPDATE SET
         ${updateValues.join(', ')}, updated_at = NOW()`,
        values
      );

      logger.info('Notification preferences updated', { userId, updates });

      res.json({
        success: true,
        message: 'Notification preferences updated'
      });
    } catch (error) {
      logger.error('Error updating notification preferences:', error);
      next(error);
    }
  }
);

// Send test notification (admin only)
router.post('/test',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next) => {
    try {
      const userId = req.user!.id;

      await notificationService.sendTestNotification(userId);

      res.json({
        success: true,
        message: 'Test notification sent'
      });
    } catch (error) {
      logger.error('Error sending test notification:', error);
      next(error);
    }
  }
);

// Get notification history (admin only)
router.get('/history',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next) => {
    try {
      const { limit = 50, offset = 0, userId, status } = req.query;

      let query = `
        SELECT 
          nh.*,
          u.name as user_name,
          u.email as user_email
        FROM notification_history nh
        LEFT JOIN users u ON nh.user_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (userId) {
        params.push(userId);
        query += ` AND nh.user_id = $${params.length}`;
      }

      if (status) {
        params.push(status);
        query += ` AND nh.status = $${params.length}`;
      }

      query += ` ORDER BY nh.sent_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Error getting notification history:', error);
      next(error);
    }
  }
);

// Analytics endpoint (admin only)
router.get('/analytics',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next) => {
    try {
      const stats = await db.query(`
        SELECT 
          COUNT(DISTINCT user_id) as total_users_subscribed,
          COUNT(*) as total_subscriptions,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_subscriptions,
          COUNT(CASE WHEN failed_attempts >= 5 THEN 1 END) as failed_subscriptions
        FROM push_subscriptions
      `);

      const history = await db.query(`
        SELECT 
          status,
          COUNT(*) as count
        FROM notification_history
        WHERE sent_at > NOW() - INTERVAL '7 days'
        GROUP BY status
      `);

      const clickRate = await db.query(`
        SELECT 
          COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END)::float / 
          NULLIF(COUNT(*), 0) as click_rate
        FROM notification_history
        WHERE sent_at > NOW() - INTERVAL '7 days'
          AND status = 'sent'
      `);

      res.json({
        success: true,
        data: {
          subscriptions: stats.rows[0],
          last7Days: {
            byStatus: history.rows,
            clickRate: clickRate.rows[0]?.click_rate || 0
          }
        }
      });
    } catch (error) {
      logger.error('Error getting notification analytics:', error);
      next(error);
    }
  }
);

export default router;