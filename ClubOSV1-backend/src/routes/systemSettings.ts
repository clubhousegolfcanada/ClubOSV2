import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { logger } from '../utils/logger';
import { query } from '../utils/db';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Get all system settings (admin only)
router.get('/',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        `SELECT key, value, description, category, updated_at 
         FROM system_settings 
         ORDER BY category, key`
      );
      
      // Convert array to object for easier frontend consumption
      const settings = result.rows.reduce((acc: any, row: any) => {
        if (!acc[row.category]) {
          acc[row.category] = {};
        }
        acc[row.category][row.key] = {
          value: row.value,
          description: row.description,
          updatedAt: row.updated_at
        };
        return acc;
      }, {});
      
      res.json({
        success: true,
        data: settings
      });
      
    } catch (error) {
      logger.error('Error fetching system settings:', error);
      next(error);
    }
  }
);

// Get specific setting
router.get('/:key',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { key } = req.params;
      
      const result = await query(
        `SELECT value, description, category, updated_at 
         FROM system_settings 
         WHERE key = $1`,
        [key]
      );
      
      if (result.rows.length === 0) {
        throw new AppError('Setting not found', 404, 'SETTING_NOT_FOUND');
      }
      
      res.json({
        success: true,
        data: {
          key,
          ...result.rows[0]
        }
      });
      
    } catch (error) {
      logger.error('Error fetching setting:', error);
      next(error);
    }
  }
);

// Update setting
router.put('/:key',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { key } = req.params;
      const { value } = req.body;
      
      if (value === undefined || value === null) {
        throw new AppError('Value is required', 400, 'INVALID_REQUEST');
      }
      
      const result = await query(
        `UPDATE system_settings 
         SET value = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP
         WHERE key = $1
         RETURNING key, value, description, category, updated_at`,
        [key, JSON.stringify(value), req.user!.id]
      );
      
      if (result.rows.length === 0) {
        throw new AppError('Setting not found', 404, 'SETTING_NOT_FOUND');
      }
      
      logger.info('System setting updated:', { 
        key, 
        value,
        updatedBy: req.user!.email 
      });
      
      res.json({
        success: true,
        data: result.rows[0]
      });
      
    } catch (error) {
      logger.error('Error updating setting:', error);
      next(error);
    }
  }
);

// Batch update settings
router.put('/',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updates = req.body.updates;
      
      if (!Array.isArray(updates)) {
        throw new AppError('Updates must be an array', 400, 'INVALID_REQUEST');
      }
      
      const results = [];
      
      for (const update of updates) {
        if (!update.key || update.value === undefined) {
          continue;
        }
        
        const result = await query(
          `UPDATE system_settings 
           SET value = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP
           WHERE key = $1
           RETURNING key, value, updated_at`,
          [update.key, JSON.stringify(update.value), req.user!.id]
        );
        
        if (result.rows.length > 0) {
          results.push(result.rows[0]);
        }
      }
      
      logger.info('System settings batch updated:', { 
        count: results.length,
        updatedBy: req.user!.email 
      });
      
      res.json({
        success: true,
        data: results
      });
      
    } catch (error) {
      logger.error('Error updating settings:', error);
      next(error);
    }
  }
);

export default router;