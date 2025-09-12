import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, hashPassword } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import { body, param, query } from 'express-validator';
import { db } from '../../utils/database';
import { logger } from '../../utils/logger';
import { contractorService } from '../../services/contractorService';
import { AppError } from '../../middleware/errorHandler';

const router = Router();

// Create a new contractor account
router.post('/',
  authenticate,
  authorize(['admin']),
  validate([
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').notEmpty(),
    body('phone').optional().isMobilePhone('any'),
    body('locations').isArray(),
    body('permissions').optional().isObject()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, name, phone, locations, permissions } = req.body;
      const createdBy = req.user!.id;

      // Check if user already exists
      const existingUser = await db.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        throw new AppError('User with this email already exists', 400, 'USER_EXISTS');
      }

      // Create contractor user
      const hashedPassword = await hashPassword(password);
      const userResult = await db.query(
        `INSERT INTO users (email, password, name, phone, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'contractor', NOW(), NOW())
         RETURNING id, email, name, phone, role, created_at`,
        [email, hashedPassword, name, phone]
      );

      const newUser = userResult.rows[0];

      // Create permissions for each location
      const permissionPromises = locations.map((location: string) => 
        contractorService.createPermission(
          newUser.id,
          location,
          {
            canUnlockDoors: permissions?.canUnlockDoors ?? true,
            canSubmitChecklists: permissions?.canSubmitChecklists ?? true,
            canViewHistory: permissions?.canViewHistory ?? false,
            activeFrom: permissions?.activeFrom || new Date(),
            activeUntil: permissions?.activeUntil || null
          },
          createdBy
        )
      );

      const createdPermissions = await Promise.all(permissionPromises);

      logger.info('Contractor created', {
        contractorId: newUser.id,
        email: newUser.email,
        locations,
        createdBy
      });

      res.status(201).json({
        success: true,
        data: {
          user: newUser,
          permissions: createdPermissions
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get all contractors
router.get('/',
  authenticate,
  authorize(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT 
          u.id, u.email, u.name, u.phone, u.created_at, u.updated_at, u.last_login,
          COUNT(DISTINCT cp.location) as location_count,
          ARRAY_AGG(DISTINCT cp.location) as locations,
          MAX(cp.active_until) as active_until
         FROM users u
         LEFT JOIN contractor_permissions cp ON u.id = cp.user_id
         WHERE u.role = 'contractor'
         GROUP BY u.id, u.email, u.name, u.phone, u.created_at, u.updated_at, u.last_login
         ORDER BY u.created_at DESC`
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get contractor details with permissions
router.get('/:id',
  authenticate,
  authorize(['admin']),
  validate([
    param('id').isUUID()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Get contractor user
      const userResult = await db.query(
        'SELECT id, email, name, phone, created_at, updated_at, last_login FROM users WHERE id = $1 AND role = $2',
        [id, 'contractor']
      );

      if (userResult.rows.length === 0) {
        throw new AppError('Contractor not found', 404, 'CONTRACTOR_NOT_FOUND');
      }

      const user = userResult.rows[0];

      // Get permissions
      const permissions = await contractorService.getPermissions(id);

      // Get recent activity
      const activity = await contractorService.getContractorActivity(id, 20);

      res.json({
        success: true,
        data: {
          user,
          permissions,
          activity
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update contractor permissions
router.put('/:id/permissions',
  authenticate,
  authorize(['admin']),
  validate([
    param('id').isUUID(),
    body('location').notEmpty(),
    body('permissions').isObject()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { location, permissions } = req.body;

      // Check if permission exists for this location
      const existingPermission = await db.query(
        'SELECT id FROM contractor_permissions WHERE user_id = $1 AND location = $2',
        [id, location]
      );

      let updatedPermission;

      if (existingPermission.rows.length > 0) {
        // Update existing permission
        updatedPermission = await contractorService.updatePermission(
          existingPermission.rows[0].id,
          permissions
        );
      } else {
        // Create new permission
        updatedPermission = await contractorService.createPermission(
          id,
          location,
          permissions,
          req.user!.id
        );
      }

      logger.info('Contractor permissions updated', {
        contractorId: id,
        location,
        updatedBy: req.user!.id
      });

      res.json({
        success: true,
        data: updatedPermission
      });
    } catch (error) {
      next(error);
    }
  }
);

// Deactivate contractor
router.delete('/:id',
  authenticate,
  authorize(['admin']),
  validate([
    param('id').isUUID()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Set all permissions to expire now
      await db.query(
        `UPDATE contractor_permissions 
         SET active_until = NOW(), updated_at = NOW()
         WHERE user_id = $1 AND (active_until IS NULL OR active_until > NOW())`,
        [id]
      );

      // Optionally, mark user as inactive
      await db.query(
        'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1',
        [id]
      );

      logger.info('Contractor deactivated', {
        contractorId: id,
        deactivatedBy: req.user!.id
      });

      res.json({
        success: true,
        message: 'Contractor deactivated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get contractor activity log
router.get('/:id/activity',
  authenticate,
  authorize(['admin']),
  validate([
    param('id').isUUID(),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const activity = await contractorService.getContractorActivity(id, limit);

      res.json({
        success: true,
        data: activity
      });
    } catch (error) {
      next(error);
    }
  }
);

// Add location permission to contractor
router.post('/:id/locations',
  authenticate,
  authorize(['admin']),
  validate([
    param('id').isUUID(),
    body('location').notEmpty(),
    body('permissions').optional().isObject()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { location, permissions } = req.body;

      // Check if permission already exists
      const existing = await db.query(
        'SELECT id FROM contractor_permissions WHERE user_id = $1 AND location = $2',
        [id, location]
      );

      if (existing.rows.length > 0) {
        throw new AppError('Permission already exists for this location', 400, 'PERMISSION_EXISTS');
      }

      const newPermission = await contractorService.createPermission(
        id,
        location,
        permissions || {},
        req.user!.id
      );

      logger.info('Location added to contractor', {
        contractorId: id,
        location,
        addedBy: req.user!.id
      });

      res.status(201).json({
        success: true,
        data: newPermission
      });
    } catch (error) {
      next(error);
    }
  }
);

// Remove location permission from contractor
router.delete('/:id/locations/:location',
  authenticate,
  authorize(['admin']),
  validate([
    param('id').isUUID(),
    param('location').notEmpty()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, location } = req.params;

      const result = await db.query(
        `UPDATE contractor_permissions 
         SET active_until = NOW(), updated_at = NOW()
         WHERE user_id = $1 AND location = $2 AND (active_until IS NULL OR active_until > NOW())
         RETURNING id`,
        [id, location]
      );

      if (result.rows.length === 0) {
        throw new AppError('Permission not found', 404, 'PERMISSION_NOT_FOUND');
      }

      logger.info('Location removed from contractor', {
        contractorId: id,
        location,
        removedBy: req.user!.id
      });

      res.json({
        success: true,
        message: 'Location permission removed'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;