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
import { transformUser } from '../utils/transformers';

const router = Router();

// Request password reset
router.post('/forgot-password',
  validate([
    body('email').isEmail().withMessage('Valid email required')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      
      // Check if user exists
      const user = await db.findUserByEmail(email.toLowerCase());
      
      // Always return success to prevent email enumeration
      // In production, this would send an email if user exists
      if (user) {
        // TODO: Generate reset token and send email
        logger.info('Password reset requested:', { email });
        
        // In a real implementation:
        // 1. Generate a secure reset token
        // 2. Store token with expiration in database
        // 3. Send email with reset link
        // 4. Create a reset page that accepts the token
      }
      
      res.json({
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions.'
      });
      
    } catch (error) {
      next(error);
    }
  }
);

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
        // Log failed attempt
        await db.createAuthLog({
          action: 'login',
          ip_address: req.ip,
          user_agent: req.get('user-agent'),
          success: false,
          error_message: 'User not found'
        });
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }
      
      // Verify password
      const isValidPassword = await bcryptjs.compare(password, user.password);
      
      if (!isValidPassword) {
        // Log failed attempt
        await db.createAuthLog({
          user_id: user.id,
          action: 'login',
          ip_address: req.ip,
          user_agent: req.get('user-agent'),
          success: false,
          error_message: 'Invalid password'
        });
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }
      
      // Update last login
      await db.updateLastLogin(user.id);
      
      // Log successful login
      await db.createAuthLog({
        user_id: user.id,
        action: 'login',
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        success: true
      });
      
      // Generate JWT token
      const sessionId = uuidv4();
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: sessionId
      });
      
      // Transform user for response
      const transformedUser = transformUser(user);
      
      logger.info('Login successful:', { userId: user.id, email: user.email });
      
      res.json({
        success: true,
        data: {
          user: transformedUser,
          token
        }
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
        throw new AppError('User with this email already exists', 409, 'USER_EXISTS');
      }
      
      // Create new user
      const newUser = await db.createUser({
        email,
        password,
        name,
        role,
        phone
      });
      
      // Log user creation
      await db.createAuthLog({
        user_id: req.user!.id,
        action: 'create_user',
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        success: true
      });
      
      // Transform user for response
      const transformedUser = transformUser(newUser);
      
      logger.info('User created:', { userId: newUser.id, email: newUser.email, createdBy: req.user!.id });
      
      res.status(201).json({
        success: true,
        data: transformedUser
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
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      
      // Transform user for response
      const transformedUser = transformUser(user);
      
      res.json({
        success: true,
        data: transformedUser
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
      
      // Transform users for response
      const transformedUsers = users.map(user => transformUser(user));
      
      res.json({
        success: true,
        data: transformedUsers
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
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      
      // Verify current password
      const isValidPassword = await bcryptjs.compare(currentPassword, user.password);
      
      if (!isValidPassword) {
        throw new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD');
      }
      
      // Update password
      await db.updateUserPassword(user.id, newPassword);
      
      // Log password change
      await db.createAuthLog({
        user_id: user.id,
        action: 'change_password',
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        success: true
      });
      
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
      .withMessage('Valid email is required'),
    body('role')
      .optional()
      .isIn(['admin', 'operator', 'support', 'kiosk'])
      .withMessage('Invalid role')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { name, phone, email, role } = req.body;
      
      // Users can only update their own profile unless they're admin
      if (userId !== req.user!.id && req.user!.role !== 'admin') {
        throw new AppError('You can only update your own profile', 403, 'UNAUTHORIZED');
      }
      
      // Role change authorization
      if (role) {
        // Users cannot change their own role
        if (userId === req.user!.id) {
          throw new AppError('You cannot change your own role', 403, 'SELF_ROLE_CHANGE');
        }
        
        // Only admins can create or modify admin roles
        if (role === 'admin' && req.user!.role !== 'admin') {
          throw new AppError('Only admins can assign admin role', 403, 'INSUFFICIENT_PERMISSIONS');
        }
      }
      
      // Check if email is being changed and if it's already taken
      if (email) {
        const existingUser = await db.findUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          throw new AppError('Email already in use', 409, 'EMAIL_EXISTS');
        }
      }
      
      // Update user
      const updatedUser = await db.updateUser(userId, { name, phone, email, role });
      
      if (!updatedUser) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      
      logger.info('User profile updated:', { 
        userId, 
        updatedBy: req.user!.id,
        roleChanged: !!role,
        newRole: role 
      });
      
      // Transform user for response
      const transformedUser = transformUser(updatedUser);
      
      res.json({
        success: true,
        data: transformedUser,
        ...(role && { 
          message: 'Role updated successfully. User must log out and back in for changes to take effect.' 
        })
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
        throw new AppError('Use the change-password endpoint to change your own password', 400, 'SELF_RESET');
      }
      
      const user = await db.findUserById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      
      // Update password
      await db.updateUserPassword(userId, newPassword);
      
      // Log password reset
      await db.createAuthLog({
        user_id: req.user!.id,
        action: 'reset_password',
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        success: true
      });
      
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
        throw new AppError('Cannot delete your own account', 400, 'SELF_DELETE');
      }
      
      const deleted = await db.deleteUser(userId);
      
      if (!deleted) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      
      // Log user deletion
      await db.createAuthLog({
        user_id: req.user!.id,
        action: 'delete_user',
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        success: true
      });
      
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
