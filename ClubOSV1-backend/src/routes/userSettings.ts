import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { body, param } from 'express-validator';
import { logger } from '../utils/logger';
import { Sequelize, DataTypes } from 'sequelize';

const router = Router();

// Initialize database connection (this would come from your database setup)
const sequelize = new Sequelize(process.env.DATABASE_URL!, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

// Define UserSetting model
const UserSetting = sequelize.define('UserSetting', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id'
  },
  settingKey: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'setting_key'
  },
  settingValue: {
    type: DataTypes.TEXT,
    field: 'setting_value'
  }
}, {
  tableName: 'user_settings',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'setting_key']
    }
  ]
});

// Get user settings
router.get('/settings/:key?', 
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { key } = req.params;
      
      if (key) {
        // Get specific setting
        const setting = await UserSetting.findOne({
          where: { userId, settingKey: key }
        });
        
        res.json({
          success: true,
          data: setting ? JSON.parse(setting.get('settingValue') as string) : null
        });
      } else {
        // Get all settings for user
        const settings = await UserSetting.findAll({
          where: { userId }
        });
        
        const settingsMap: Record<string, any> = {};
        settings.forEach(setting => {
          try {
            settingsMap[setting.get('settingKey') as string] = JSON.parse(setting.get('settingValue') as string);
          } catch (e) {
            settingsMap[setting.get('settingKey') as string] = setting.get('settingValue');
          }
        });
        
        res.json({
          success: true,
          data: settingsMap
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
      
      // Upsert the setting
      const [setting, created] = await UserSetting.upsert({
        userId,
        settingKey: key,
        settingValue: serializedValue
      }, {
        where: { userId, settingKey: key }
      });
      
      logger.info(`User setting ${created ? 'created' : 'updated'}`, {
        userId,
        key,
        created
      });
      
      res.json({
        success: true,
        message: `Setting ${created ? 'created' : 'updated'} successfully`,
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
      
      const deleted = await UserSetting.destroy({
        where: { userId, settingKey: key }
      });
      
      if (deleted) {
        logger.info('User setting deleted', { userId, key });
        res.json({
          success: true,
          message: 'Setting deleted successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Setting not found'
        });
      }
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
      const settings = await UserSetting.findAll({
        where: { settingKey: 'external_links' },
        include: [{
          model: sequelize.models.User,
          attributes: ['id', 'email', 'name']
        }]
      });
      
      const userLinks = settings.map(setting => ({
        userId: setting.get('userId'),
        // user: setting.get('User'), // If you have user association
        links: JSON.parse(setting.get('settingValue') as string),
        updatedAt: setting.get('updatedAt')
      }));
      
      res.json({
        success: true,
        data: userLinks
      });
    } catch (error) {
      logger.error('Failed to get all users external links:', error);
      next(error);
    }
  }
);

export default router;
