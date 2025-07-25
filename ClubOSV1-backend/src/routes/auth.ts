import { Router, Request, Response, NextFunction } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { readJsonFile, writeJsonFile, appendToJsonArray } from '../utils/fileUtils';
import { User, JWTPayload } from '../types';
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
      
      // Load users
      const users = await readJsonFile<User[]>('users.json');
      
      // Find user by email
      const user = users.find(u => u.email === email);
      
      if (!user) {
        throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }
      
      // Verify password
      const isValidPassword = await bcryptjs.compare(password, user.password);
      
      if (!isValidPassword) {
        throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }
      
      // Generate JWT token using the proper function
      const sessionId = uuidv4();
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: sessionId
      });
      
      // Log successful login
      await appendToJsonArray('authLogs.json', {
        id: uuidv4(),
        userId: user.id,
        action: 'login',
        timestamp: new Date().toISOString(),
        ip: req.ip
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
      const users = await readJsonFile<User[]>('users.json');
      
      if (users.length > 0) {
        throw new AppError('USERS_EXIST', 'Admin already initialized', 403);
      }
      
      // Create default admin
      const hashedPassword = await bcryptjs.hash('admin123', 10);
      const adminUser: User = {
        id: 'admin-001',
        email: 'admin@clubhouse247golf.com',
        password: hashedPassword,
        name: 'Admin User',
        role: 'admin',
        phone: '+1234567890',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      users.push(adminUser);
      await writeJsonFile('users.json', users);
      
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

// Reset admin password (emergency use only)
router.post('/reset-admin',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await readJsonFile<User[]>('users.json');
      
      // Find admin user
      const adminIndex = users.findIndex(u => u.email === 'admin@clubhouse247golf.com');
      
      if (adminIndex === -1) {
        // Create new admin if doesn't exist
        const hashedPassword = await bcryptjs.hash('admin123', 10);
        const adminUser: User = {
          id: 'admin-001',
          email: 'admin@clubhouse247golf.com',
          password: hashedPassword,
          name: 'Admin User',
          role: 'admin',
          phone: '+1234567890',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        users.push(adminUser);
        await writeJsonFile('users.json', users);
        
        res.json({
          success: true,
          message: 'Admin user created',
          email: 'admin@clubhouse247golf.com'
        });
      } else {
        // Reset existing admin password
        const hashedPassword = await bcryptjs.hash('admin123', 10);
        users[adminIndex].password = hashedPassword;
        users[adminIndex].updatedAt = new Date().toISOString();
        await writeJsonFile('users.json', users);
        
        res.json({
          success: true,
          message: 'Admin password reset',
          email: 'admin@clubhouse247golf.com'
        });
      }
      
      logger.info('Admin password reset');
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
      logger.info('Register endpoint called', {
        user: req.user,
        body: { ...req.body, password: '***' },
        headers: req.headers
      });
      
      const { email, password, name, role, phone } = req.body;
      
      // Load existing users
      const users = await readJsonFile<User[]>('users.json');
      
      // Check if user already exists
      if (users.find(u => u.email === email)) {
        throw new AppError('USER_EXISTS', 'User with this email already exists', 409);
      }
      
      // Hash password
      const hashedPassword = await bcryptjs.hash(password, 10);
      
      // Create new user
      const newUser: User = {
        id: uuidv4(),
        email,
        password: hashedPassword,
        name,
        phone,
        role,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Add user to database
      users.push(newUser);
      await writeJsonFile('users.json', users);
      
      // Log user creation
      await appendToJsonArray('authLogs.json', {
        id: uuidv4(),
        userId: req.user!.id,
        action: 'create_user',
        targetUserId: newUser.id,
        timestamp: new Date().toISOString(),
        ip: req.ip
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
      const users = await readJsonFile<User[]>('users.json');
      const user = users.find(u => u.id === req.user!.id);
      
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
      
      const users = await readJsonFile<User[]>('users.json');
      const userIndex = users.findIndex(u => u.id === req.user!.id);
      
      if (userIndex === -1) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      const user = users[userIndex];
      
      // Verify current password
      const isValidPassword = await bcryptjs.compare(currentPassword, user.password);
      
      if (!isValidPassword) {
        throw new AppError('INVALID_PASSWORD', 'Current password is incorrect', 401);
      }
      
      // Hash new password
      const hashedPassword = await bcryptjs.hash(newPassword, 10);
      
      // Update user password
      users[userIndex] = {
        ...user,
        password: hashedPassword,
        updatedAt: new Date().toISOString()
      };
      
      await writeJsonFile('users.json', users);
      
      // Log password change
      await appendToJsonArray('authLogs.json', {
        id: uuidv4(),
        userId: user.id,
        action: 'change_password',
        timestamp: new Date().toISOString(),
        ip: req.ip
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

// List users (admin only)
router.get('/users',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await readJsonFile<User[]>('users.json');
      
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
      
      const users = await readJsonFile<User[]>('users.json');
      const userIndex = users.findIndex(u => u.id === userId);
      
      if (userIndex === -1) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      // Check if email is being changed and if it's already taken
      if (email && email !== users[userIndex].email) {
        if (users.find(u => u.email === email && u.id !== userId)) {
          throw new AppError('EMAIL_EXISTS', 'Email already in use', 409);
        }
      }
      
      // Update user data
      const updatedUser = {
        ...users[userIndex],
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(email && { email }),
        updatedAt: new Date().toISOString()
      };
      
      users[userIndex] = updatedUser;
      await writeJsonFile('users.json', users);
      
      // Log update
      await appendToJsonArray('authLogs.json', {
        id: uuidv4(),
        userId: req.user!.id,
        action: 'update_profile',
        targetUserId: userId,
        changes: { name, phone, email },
        timestamp: new Date().toISOString(),
        ip: req.ip
      });
      
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

// Update user role (admin only)
router.put('/users/:userId/role',
  authenticate,
  roleGuard(['admin']),
  validate([
    body('role')
      .isIn(['admin', 'operator', 'support', 'kiosk'])
      .withMessage('Invalid role')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      
      // Prevent self role change
      if (userId === req.user!.id) {
        throw new AppError('SELF_UPDATE', 'Cannot change your own role', 400);
      }
      
      const users = await readJsonFile<User[]>('users.json');
      const userIndex = users.findIndex(u => u.id === userId);
      
      if (userIndex === -1) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      // Update user role
      users[userIndex] = {
        ...users[userIndex],
        role,
        updatedAt: new Date().toISOString()
      };
      
      await writeJsonFile('users.json', users);
      
      // Log role change
      await appendToJsonArray('authLogs.json', {
        id: uuidv4(),
        userId: req.user!.id,
        action: 'update_role',
        targetUserId: userId,
        oldRole: users[userIndex].role,
        newRole: role,
        timestamp: new Date().toISOString(),
        ip: req.ip
      });
      
      logger.info('User role updated:', { userId, newRole: role, updatedBy: req.user!.id });
      
      res.json({
        success: true,
        message: 'User role updated successfully'
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
      
      const users = await readJsonFile<User[]>('users.json');
      const userIndex = users.findIndex(u => u.id === userId);
      
      if (userIndex === -1) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      // Hash new password
      const hashedPassword = await bcryptjs.hash(newPassword, 10);
      
      // Update user password
      users[userIndex] = {
        ...users[userIndex],
        password: hashedPassword,
        updatedAt: new Date().toISOString()
      };
      
      await writeJsonFile('users.json', users);
      
      // Log password reset
      await appendToJsonArray('authLogs.json', {
        id: uuidv4(),
        userId: req.user!.id,
        action: 'reset_password',
        targetUserId: userId,
        timestamp: new Date().toISOString(),
        ip: req.ip
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
        throw new AppError('SELF_DELETE', 'Cannot delete your own account', 400);
      }
      
      const users = await readJsonFile<User[]>('users.json');
      const userIndex = users.findIndex(u => u.id === userId);
      
      if (userIndex === -1) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      // Remove user
      const deletedUser = users.splice(userIndex, 1)[0];
      await writeJsonFile('users.json', users);
      
      // Log deletion
      await appendToJsonArray('authLogs.json', {
        id: uuidv4(),
        userId: req.user!.id,
        action: 'delete_user',
        targetUserId: userId,
        timestamp: new Date().toISOString(),
        ip: req.ip
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
