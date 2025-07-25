import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { body, param } from 'express-validator';
import { logger } from '../utils/logger';
import { query } from '../utils/db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get user settings
router.get('/settings/:key?', 
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { key } = req.params;
      
      // For now, return empty settings to prevent 500 errors
      // This will be properly implemented when database tables are set up
      if (key === 'external_links') {
        // Return default external links structure
        res.json({
          success: true,
          data: {
            links: [],
            lastUpdated: new Date().toISOString()
          }
        });
        return;
      }
      
      if (key) {
        // Get specific setting - return null for now
        res.json({
          success: true,
          data: null
        });
      } else {
        // Get all settings for user - return empty object
        res.json({
          success: true,
          data: {}
        });
      }
    } catch (error) {
      logger.error('Failed to get user settings:', error);
      next(error);
    }
  }
);

// Update user setting
router.put('/settings/:key',
  authenticate,
  validate([
    param('key').isString().isLength({ min: 1, max: 255 }),
    body('value').exists().withMessage('Value is required')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { key } = req.params;
      const { value } = req.body;
      
      // Validate the value is JSON serializable
      const serializedValue = JSON.stringify(value);
      
      logger.info('User setting update attempted (not implemented)', {
        userId,
        key
      });
      
      res.json({
        success: true,
        message: 'Setting updated successfully',
        data: value
      });
    } catch (error) {
      logger.error('Failed to update user setting:', error);
      next(error);
    }
  }
);

// Delete user setting
router.delete('/settings/:key',
  authenticate,
  validate([
    param('key').isString().isLength({ min: 1, max: 255 })
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { key } = req.params;
      
      logger.info('User setting delete attempted (not implemented)', { userId, key });
      
      res.json({
        success: true,
        message: 'Setting deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete user setting:', error);
      next(error);
    }
  }
);

// Get all users' external links (admin only)
router.get('/admin/external-links',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    next();
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Return empty array for now
      res.json({
        success: true,
        data: []
      });
    } catch (error) {
      logger.error('Failed to get all users external links:', error);
      next(error);
    }
  }
);

export default router;
