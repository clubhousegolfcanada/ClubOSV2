/**
 * Notification Handlers
 * 
 * Manages push notification subscriptions and preferences
 */

import { Request, Response } from 'express';
import { db } from '../../../utils/database';
import { logger } from '../../../utils/logger';
import { AppError } from '../../../middleware/errorHandler';
import { notificationService } from '../../../services/notificationService';

/**
 * Get notification preferences
 */
export async function getPreferences(req: Request, res: Response) {
  try {
    const result = await db.query(`
      SELECT * FROM notification_preferences
      WHERE user_id = $1
    `, [req.user!.id]);

    const preferences = result.rows[0] || {
      new_messages: true,
      ticket_updates: true,
      system_alerts: true
    };

    res.json(preferences);
  } catch (error) {
    logger.error('Error fetching preferences:', error);
    throw new AppError('Failed to fetch preferences', 500);
  }
}

/**
 * Update notification preferences
 */
export async function updatePreferences(req: Request, res: Response) {
  const { new_messages, ticket_updates, system_alerts } = req.body;

  try {
    await db.query(`
      INSERT INTO notification_preferences 
        (user_id, new_messages, ticket_updates, system_alerts, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        new_messages = $2,
        ticket_updates = $3,
        system_alerts = $4,
        updated_at = NOW()
    `, [
      req.user!.id,
      new_messages ?? true,
      ticket_updates ?? true,
      system_alerts ?? true
    ]);

    logger.info('Notification preferences updated', {
      userId: req.user!.id,
      preferences: { new_messages, ticket_updates, system_alerts }
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating preferences:', error);
    throw new AppError('Failed to update preferences', 500);
  }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(req: Request, res: Response) {
  const { subscription } = req.body;

  if (!subscription || !subscription.endpoint) {
    throw new AppError('Valid subscription object required', 400);
  }

  try {
    await db.query(`
      INSERT INTO push_subscriptions 
        (user_id, endpoint, p256dh, auth, user_agent, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (endpoint) DO UPDATE SET
        user_id = $1,
        p256dh = $3,
        auth = $4,
        user_agent = $5,
        updated_at = NOW()
    `, [
      req.user!.id,
      subscription.endpoint,
      subscription.keys?.p256dh,
      subscription.keys?.auth,
      req.headers['user-agent']
    ]);

    logger.info('Push subscription created', {
      userId: req.user!.id,
      endpoint: subscription.endpoint
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error subscribing to push:', error);
    throw new AppError('Failed to subscribe', 500);
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(req: Request, res: Response) {
  const { endpoint } = req.body;

  if (!endpoint) {
    throw new AppError('Endpoint required', 400);
  }

  try {
    await db.query(`
      DELETE FROM push_subscriptions
      WHERE endpoint = $1 AND user_id = $2
    `, [endpoint, req.user!.id]);

    logger.info('Push subscription removed', {
      userId: req.user!.id,
      endpoint
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error unsubscribing:', error);
    throw new AppError('Failed to unsubscribe', 500);
  }
}

/**
 * Send test notification
 */
export async function sendTestNotification(req: Request, res: Response) {
  try {
    await notificationService.sendToUser(req.user!.id, {
      title: 'Test Notification',
      body: 'This is a test notification from ClubOS',
      data: {
        type: 'test',
        timestamp: new Date().toISOString()
      }
    });

    res.json({ 
      success: true,
      message: 'Test notification sent'
    });
  } catch (error: any) {
    logger.error('Error sending test notification:', error);
    throw new AppError(
      error.message || 'Failed to send test notification',
      500
    );
  }
}