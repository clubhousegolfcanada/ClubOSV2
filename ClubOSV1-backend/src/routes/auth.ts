import { Router, Request, Response, NextFunction } from 'express';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { AppError } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { body } from 'express-validator';
import { authenticate, generateToken } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';

const router = Router();

// Login endpoint
router.post('/login',
  validate([
    body('email')
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      
      logger.info('Login attempt:', { email });
      
      // Find user in database
      const user = await db.findUserByEmail(email);
      
      if (!user) {
        throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }
      
      // Verify password
      const isValidPassword = await bcryptjs.compare(password, user.password);
      
      if (!isValidPassword) {
        throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }
      
      // Update last login
      await db.updateLastLogin(user.id);
      
      // Generate JWT token
      const sessionId = uuidv4();
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: sessionId
      });
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      
      logger.info('Login successful:', { userId: user.id, email: user.email });
      
      res.json({
        success: true,
        data: {
          user: userWithoutPassword,
          token
        }
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Initialize admin endpoint (only works if no users exist)
router.post('/init-admin',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if any users exist
      const users = await db.getAllUsers();
      
      if (users.length > 0) {
        throw new AppError('USERS_EXIST', 'Admin already initialized', 403);
      }
      
      // Create default admin
      await db.ensureDefaultAdmin();
      
      logger.info('Admin user initialized');
      
      res.json({
        success: true,
        message: 'Admin user created successfully',
        email: 'admin@clubhouse247golf.com'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Register endpoint (admin only)
router.post('/register',
  authenticate,
  roleGuard(['admin']),
  validate([
    body('email')
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase and numbers'),
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required'),
    body('role')
      .isIn(['admin', 'operator', 'support', 'kiosk'])
      .withMessage('Invalid role'),
    body('phone')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .matches(/^[+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/)
      .withMessage('Invalid phone number format')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, name, role, phone } = req.body;
      
      // Check if user already exists
      const existingUser = await db.findUserByEmail(email);
      if (existingUser) {
        throw new AppError('USER_EXISTS', 'User with this email already exists', 409);
      }
      
      // Create new user
      const newUser = await db.createUser({
        email,
        password,
        name,
        role,
        phone
      });
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = newUser;
      
      logger.info('User created:', { userId: newUser.id, email: newUser.email, createdBy: req.user!.id });
      
      res.status(201).json({
        success: true,
        data: userWithoutPassword
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Get current user
router.get('/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await db.findUserById(req.user!.id);
      
      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      
      res.json({
        success: true,
        data: userWithoutPassword
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Change password
router.post('/change-password',
  authenticate,
  validate([
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase and numbers')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      const user = await db.findUserById(req.user!.id);
      
      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      // Verify current password
      const isValidPassword = await bcryptjs.compare(currentPassword, user.password);
      
      if (!isValidPassword) {
        throw new AppError('INVALID_PASSWORD', 'Current password is incorrect', 401);
      }
      
      // Update password
      await db.updateUserPassword(user.id, newPassword);
      
      logger.info('Password changed:', { userId: user.id });
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// List users (admin only)
router.get('/users',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await db.getAllUsers();
      
      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      
      res.json({
        success: true,
        data: usersWithoutPasswords
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Update user profile
router.put('/users/:userId',
  authenticate,
  validate([
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty'),
    body('phone')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .matches(/^[+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/)
      .withMessage('Invalid phone number format'),
    body('email')
      .optional()
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { name, phone, email } = req.body;
      
      // Users can only update their own profile unless they're admin
      if (userId !== req.user!.id && req.user!.role !== 'admin') {
        throw new AppError('UNAUTHORIZED', 'You can only update your own profile', 403);
      }
      
      // Check if email is being changed and if it's already taken
      if (email) {
        const existingUser = await db.findUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          throw new AppError('EMAIL_EXISTS', 'Email already in use', 409);
        }
      }
      
      // Update user
      const updatedUser = await db.updateUser(userId, { name, phone, email });
      
      if (!updatedUser) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      logger.info('User profile updated:', { userId, updatedBy: req.user!.id });
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = updatedUser;
      
      res.json({
        success: true,
        data: userWithoutPassword
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Reset user password (admin only)
router.post('/users/:userId/reset-password',
  authenticate,
  roleGuard(['admin']),
  validate([
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase and numbers')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;
      
      // Prevent resetting own password through this endpoint
      if (userId === req.user!.id) {
        throw new AppError('SELF_RESET', 'Use the change-password endpoint to change your own password', 400);
      }
      
      const user = await db.findUserById(userId);
      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      // Update password
      await db.updateUserPassword(userId, newPassword);
      
      logger.info('User password reset:', { userId, resetBy: req.user!.id });
      
      res.json({
        success: true,
        message: 'Password reset successfully'
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Delete user (admin only)
router.delete('/users/:userId',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      
      // Prevent self-deletion
      if (userId === req.user!.id) {
        throw new AppError('SELF_DELETE', 'Cannot delete your own account', 400);
      }
      
      const deleted = await db.deleteUser(userId);
      
      if (!deleted) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      logger.info('User deleted:', { userId, deletedBy: req.user!.id });
      
      res.json({
        success: true,
        message: 'User deleted successfully'
      });
      
    } catch (error) {
      next(error);
    }
  }
);

export default router;
