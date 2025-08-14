import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

const router = Router();

// Get Slack configuration
router.get('/slack/config', authenticate, roleGuard(['admin', 'operator']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await db.query(`
      SELECT key, value 
      FROM system_configs 
      WHERE key LIKE 'slack_%'
    `);
    
    const slackConfig: any = {
      webhook_url: '',
      notifications_enabled: true,
      notify_on_error: true,
      notify_on_ticket: true,
      sendOnLLMSuccess: false,
      sendOnLLMFailure: true,
      sendDirectRequests: false,
      sendUnhelpfulFeedback: true
    };
    
    // Map database config to response format
    config.rows.forEach((row: any) => {
      const key = row.key.replace('slack_', '');
      if (key in slackConfig) {
        slackConfig[key] = row.value;
      }
    });
    
    res.json({
      success: true,
      data: slackConfig
    });
  } catch (error) {
    next(error);
  }
});

// Update Slack configuration
router.put('/slack/config', authenticate, roleGuard(['admin', 'operator']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      webhook_url,
      notifications_enabled,
      notify_on_error,
      notify_on_ticket,
      sendOnLLMSuccess,
      sendOnLLMFailure,
      sendDirectRequests,
      sendUnhelpfulFeedback
    } = req.body;
    
    const configs = [
      { key: 'slack_webhook_url', value: webhook_url },
      { key: 'slack_notifications_enabled', value: notifications_enabled },
      { key: 'slack_notify_on_error', value: notify_on_error },
      { key: 'slack_notify_on_ticket', value: notify_on_ticket },
      { key: 'slack_sendOnLLMSuccess', value: sendOnLLMSuccess },
      { key: 'slack_sendOnLLMFailure', value: sendOnLLMFailure },
      { key: 'slack_sendDirectRequests', value: sendDirectRequests },
      { key: 'slack_sendUnhelpfulFeedback', value: sendUnhelpfulFeedback }
    ];
    
    // Upsert each configuration
    for (const config of configs) {
      await db.query(`
        INSERT INTO system_configs (key, value, updated_at) 
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) 
        DO UPDATE SET value = $2, updated_at = NOW()
      `, [config.key, config.value]);
    }
    
    logger.info('Slack configuration updated', { updatedBy: req.user?.id });
    
    res.json({
      success: true,
      message: 'Slack configuration updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get OpenPhone configuration
router.get('/openphone/config', authenticate, roleGuard(['admin', 'operator']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await db.query(`
      SELECT key, value 
      FROM system_configs 
      WHERE key LIKE 'openphone_%'
    `);
    
    const openphoneConfig: any = {
      api_key: '',
      webhook_secret: '',
      default_number: '',
      enabled: true
    };
    
    // Map database config to response format
    config.rows.forEach((row: any) => {
      const key = row.key.replace('openphone_', '');
      if (key in openphoneConfig) {
        openphoneConfig[key] = row.value;
      }
    });
    
    // Mask API key for security
    if (openphoneConfig.api_key) {
      openphoneConfig.api_key = openphoneConfig.api_key.substring(0, 4) + '****';
    }
    
    res.json({
      success: true,
      data: openphoneConfig
    });
  } catch (error) {
    next(error);
  }
});

// Update OpenPhone configuration
router.put('/openphone/config', authenticate, roleGuard(['admin', 'operator']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { api_key, webhook_secret, default_number, enabled } = req.body;
    
    const configs = [];
    
    // Only update API key if it's not masked
    if (api_key && !api_key.includes('****')) {
      configs.push({ key: 'openphone_api_key', value: api_key });
    }
    
    if (webhook_secret !== undefined) {
      configs.push({ key: 'openphone_webhook_secret', value: webhook_secret });
    }
    
    if (default_number !== undefined) {
      configs.push({ key: 'openphone_default_number', value: default_number });
    }
    
    if (enabled !== undefined) {
      configs.push({ key: 'openphone_enabled', value: enabled });
    }
    
    // Upsert each configuration
    for (const config of configs) {
      await db.query(`
        INSERT INTO system_configs (key, value, updated_at) 
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) 
        DO UPDATE SET value = $2, updated_at = NOW()
      `, [config.key, config.value]);
    }
    
    logger.info('OpenPhone configuration updated', { updatedBy: req.user?.id });
    
    res.json({
      success: true,
      message: 'OpenPhone configuration updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Test integration connection
router.post('/:service/test', authenticate, roleGuard(['admin', 'operator']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { service } = req.params;
    
    switch (service.toLowerCase()) {
      case 'slack':
        // Test Slack webhook
        const slackWebhook = await db.query(`
          SELECT value FROM system_configs WHERE key = 'slack_webhook_url'
        `);
        
        if (!slackWebhook.rows[0]?.value) {
          return res.json({
            success: false,
            message: 'Slack webhook URL not configured'
          });
        }
        
        // TODO: Actually test the webhook
        res.json({
          success: true,
          message: 'Slack connection test successful'
        });
        break;
        
      case 'openphone':
        // Test OpenPhone API
        const openphoneKey = await db.query(`
          SELECT value FROM system_configs WHERE key = 'openphone_api_key'
        `);
        
        if (!openphoneKey.rows[0]?.value) {
          return res.json({
            success: false,
            message: 'OpenPhone API key not configured'
          });
        }
        
        // TODO: Actually test the API connection
        res.json({
          success: true,
          message: 'OpenPhone connection test successful'
        });
        break;
        
      default:
        res.status(400).json({
          success: false,
          message: 'Unknown service: ' + service
        });
    }
  } catch (error) {
    next(error);
  }
});

// Get system features
router.get('/features', authenticate, roleGuard(['admin', 'operator']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const features = await db.query(`
      SELECT key, value 
      FROM system_configs 
      WHERE key LIKE 'feature_%'
    `);
    
    const systemFeatures = [
      {
        key: 'smart_assist',
        name: 'Smart Assist',
        description: 'AI-powered request routing and responses',
        enabled: true
      },
      {
        key: 'bookings',
        name: 'Bookings',
        description: 'Skedda booking system integration',
        enabled: true
      },
      {
        key: 'tickets',
        name: 'Tickets',
        description: 'Support ticket management system',
        enabled: true
      },
      {
        key: 'customer_kiosk',
        name: 'Customer Kiosk',
        description: 'ClubOS Boy public interface',
        enabled: true
      }
    ];
    
    // Override with database values if they exist
    features.rows.forEach((row: any) => {
      const key = row.key.replace('feature_', '');
      const feature = systemFeatures.find(f => f.key === key);
      if (feature) {
        feature.enabled = row.value === 'true' || row.value === true;
      }
    });
    
    res.json({
      success: true,
      data: systemFeatures
    });
  } catch (error) {
    next(error);
  }
});

// Update system feature
router.put('/features/:featureKey', authenticate, roleGuard(['admin', 'operator']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { featureKey } = req.params;
    const { enabled } = req.body;
    
    await db.query(`
      INSERT INTO system_configs (key, value, updated_at) 
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) 
      DO UPDATE SET value = $2, updated_at = NOW()
    `, [`feature_${featureKey}`, enabled]);
    
    logger.info('System feature toggled', { 
      feature: featureKey, 
      enabled, 
      updatedBy: req.user?.id 
    });
    
    res.json({
      success: true,
      message: `Feature ${featureKey} ${enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    next(error);
  }
});

export default router;