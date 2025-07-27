import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { adminOrOperator } from '../middleware/roleGuard';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

const router = Router();

// Get all system configurations
router.get('/', authenticate, adminOrOperator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = await db.query(
      'SELECT key, value, description, "updatedAt" FROM system_config ORDER BY key'
    );
    
    // Transform array to object for easier frontend consumption
    const configObject = configs.rows.reduce((acc: any, row: any) => {
      acc[row.key] = {
        value: row.value,
        description: row.description,
        updatedAt: row.updatedAt
      };
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: configObject
    });
  } catch (error) {
    logger.error('Failed to fetch system configs:', error);
    next(error);
  }
});

// Get specific configuration
router.get('/:key', authenticate, adminOrOperator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    
    const result = await db.query(
      'SELECT key, value, description, "updatedAt" FROM system_config WHERE key = $1',
      [key]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to fetch system config:', error);
    next(error);
  }
});

// Update system configuration
router.put('/:key', authenticate, adminOrOperator, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Value is required'
      });
    }
    
    // Upsert the configuration
    const result = await db.query(
      `INSERT INTO system_config (key, value, description, "updatedAt") 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
       ON CONFLICT (key) 
       DO UPDATE SET value = $2, description = $3, "updatedAt" = CURRENT_TIMESTAMP
       RETURNING *`,
      [key, JSON.stringify(value), description || null]
    );
    
    logger.info('System config updated', { 
      key, 
      userId: req.user?.id,
      userEmail: req.user?.email 
    });
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to update system config:', error);
    next(error);
  }
});

// Initialize default configurations
export async function initializeSystemConfigs() {
  try {
    const defaultConfigs = [
      {
        key: 'slack_notifications',
        value: {
          enabled: true,
          sendOnLLMSuccess: false,
          sendOnLLMFailure: true,
          sendDirectRequests: true,
          sendTickets: true,
          sendUnhelpfulFeedback: true
        },
        description: 'Slack notification settings for different system events'
      },
      {
        key: 'llm_settings',
        value: {
          enabled: true,
          provider: 'openai',
          model: 'gpt-4-turbo-preview',
          maxRetries: 3,
          timeout: 30000
        },
        description: 'LLM service configuration'
      },
      {
        key: 'system_features',
        value: {
          smartAssist: true,
          bookings: true,
          tickets: true,
          slack: true,
          customerKiosk: true
        },
        description: 'System feature toggles'
      }
    ];
    
    for (const config of defaultConfigs) {
      // Only insert if doesn't exist
      await db.query(
        `INSERT INTO system_config (key, value, description) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (key) DO NOTHING`,
        [config.key, JSON.stringify(config.value), config.description]
      );
    }
    
    logger.info('System configurations initialized');
  } catch (error) {
    logger.error('Failed to initialize system configs:', error);
  }
}

export default router;