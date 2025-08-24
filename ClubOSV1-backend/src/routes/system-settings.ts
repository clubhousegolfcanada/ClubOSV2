import { Router } from 'express';
import { query } from '../utils/db';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Get a system setting value
 */
router.get('/:key', authenticate, async (req, res) => {
  try {
    const { key } = req.params;
    
    // Check if user has permission (admin or operator only)
    if (!req.user || !['admin', 'operator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }
    
    // Get setting from database
    const result = await query(
      `SELECT key, value, description, updated_at 
       FROM system_settings 
       WHERE key = $1`,
      [key]
    );
    
    if (result.rows.length === 0) {
      // Return default value for known settings
      if (key === 'customer_auto_approval') {
        return res.json({
          success: true,
          data: {
            key: 'customer_auto_approval',
            value: { enabled: true },
            description: 'Automatically approve customer registrations',
            updated_at: new Date().toISOString()
          }
        });
      }
      
      return res.status(404).json({
        success: false,
        error: 'Setting not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Error fetching system setting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch setting'
    });
  }
});

/**
 * Update a system setting value
 */
router.put('/:key', authenticate, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    // Check if user has permission (admin only for updates)
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    // Validate known settings
    if (key === 'customer_auto_approval') {
      if (typeof value?.enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'Invalid value format. Expected { enabled: boolean }'
        });
      }
    }
    
    // Update or insert setting
    const result = await query(
      `INSERT INTO system_settings (key, value, description, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (key) 
       DO UPDATE SET 
         value = $2,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        key,
        JSON.stringify(value),
        key === 'customer_auto_approval' ? 'Automatically approve customer registrations' : null
      ]
    );
    
    logger.info(`System setting updated: ${key}`, { 
      userId: req.user.id,
      value 
    });
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Error updating system setting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update setting'
    });
  }
});

/**
 * Get all system settings (admin only)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    // Check if user has permission
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const result = await query(
      `SELECT key, value, description, updated_at 
       FROM system_settings 
       ORDER BY key`
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error: any) {
    logger.error('Error fetching system settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings'
    });
  }
});

export default router;