import { Router, Request, Response, NextFunction } from 'express';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { readJsonFile, writeJsonFile, appendToJsonArray } from '../utils/fileUtils';
import { User } from '../types';
import { db } from '../utils/database';
import { AppError } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { body } from 'express-validator';
import { authenticate, generateToken } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';

const router = Router();

// Helper to get user data (database first, then JSON)
async function getUsers(): Promise<User[]> {
  if (db.isEnabled()) {
    try {
      const dbUsers = await db.getAllUsers();
      return dbUsers.map(u => ({
        id: u.id,
        email: u.email,
        password: u.password,
        name: u.name,
        role: u.role,
        phone: u.phone,
        createdAt: u.created_at.toISOString(),
        updatedAt: u.updated_at.toISOString()
      }));
    } catch (error) {
      logger.error('Database error, falling back to JSON:', error);
    }
  }
  return await readJsonFile<User[]>('users.json');
}

// Helper to find user
async function findUser(email: string): Promise<User | null> {
  if (db.isEnabled()) {
    try {
      const dbUser = await db.findUserByEmail(email);
      if (dbUser) {
        return {
          id: dbUser.id,
          email: dbUser.email,
          password: dbUser.password,
          name: dbUser.name,
          role: dbUser.role,
          phone: dbUser.phone,
          createdAt: dbUser.created_at.toISOString(),
          updatedAt: dbUser.updated_at.toISOString()
        };
      }
    } catch (error) {
      logger.error('Database error, falling back to JSON:', error);
    }
  }
  
  const users = await readJsonFile<User[]>('users.json');
  return users.find(u => u.email === email) || null;
}

// Helper to find user by ID
async function findUserById(id: string): Promise<User | null> {
  if (db.isEnabled()) {
    try {
      const dbUser = await db.findUserById(id);
      if (dbUser) {
        return {
          id: dbUser.id,
          email: dbUser.email,
          password: dbUser.password,
          name: dbUser.name,
          role: dbUser.role,
          phone: dbUser.phone,
          createdAt: dbUser.created_at.toISOString(),
          updatedAt: dbUser.updated_at.toISOString()
        };
      }
    } catch (error) {
      logger.error('Database error, falling back to JSON:', error);
    }
  }
  
  const users = await readJsonFile<User[]>('users.json');
  return users.find(u => u.id === id) || null;
}

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
      
      // Find user
      const user = await findUser(email);
      
      if (!user) {
        throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }
      
      // Verify password
      const isValidPassword = await bcryptjs.compare(password, user.password);
      
      if (!isValidPassword) {
        throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }
      
      // Update last login if using database
      if (db.isEnabled()) {
        try {
          await db.updateLastLogin(user.id);
        } catch (error) {
          logger.error('Failed to update last login:', error);
        }
      }
      
      // Generate JWT token
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
      const existingUser = await findUser(email);
      if (existingUser) {
        throw new AppError('USER_EXISTS', 'User with this email already exists', 409);
      }
      
      let newUser: User;
      
      // Try to create in database first
      if (db.isEnabled()) {
        try {
          const dbUser = await db.createUser({
            email,
            password,
            name,
            role,
            phone
          });
          
          newUser = {
            id: dbUser.id,
            email: dbUser.email,
            password: dbUser.password,
            name: dbUser.name,
            role: dbUser.role,
            phone: dbUser.phone,
            createdAt: dbUser.created_at.toISOString(),
            updatedAt: dbUser.updated_at.toISOString()
          };
          
          // Also save to JSON for backup
          const users = await readJsonFile<User[]>('users.json');
          users.push(newUser);
          await writeJsonFile('users.json', users);
        } catch (error) {
          logger.error('Database error, using JSON only:', error);
          throw error;
        }
      } else {
        // JSON only
        const hashedPassword = await bcryptjs.hash(password, 10);
        newUser = {
          id: uuidv4(),
          email,
          password: hashedPassword,
          name,
          phone,
          role,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        const users = await readJsonFile<User[]>('users.json');
        users.push(newUser);
        await writeJsonFile('users.json', users);
      }
      
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
      const user = await findUserById(req.user!.id);
      
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

// List users (admin only)
router.get('/users',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await getUsers();
      
      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      
      res.json({
        success: true,
        data: usersWithoutPasswords,
        source: db.isEnabled() ? 'database' : 'json'
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
      
      const user = await findUserById(req.user!.id);
      
      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      // Verify current password
      const isValidPassword = await bcryptjs.compare(currentPassword, user.password);
      
      if (!isValidPassword) {
        throw new AppError('INVALID_PASSWORD', 'Current password is incorrect', 401);
      }
      
      // Update password
      if (db.isEnabled()) {
        try {
          await db.updateUserPassword(user.id, newPassword);
          
          // Also update in JSON
          const users = await readJsonFile<User[]>('users.json');
          const userIndex = users.findIndex(u => u.id === user.id);
          if (userIndex !== -1) {
            const hashedPassword = await bcryptjs.hash(newPassword, 10);
            users[userIndex].password = hashedPassword;
            users[userIndex].updatedAt = new Date().toISOString();
            await writeJsonFile('users.json', users);
          }
        } catch (error) {
          logger.error('Database error:', error);
          throw error;
        }
      } else {
        // JSON only
        const users = await readJsonFile<User[]>('users.json');
        const userIndex = users.findIndex(u => u.id === user.id);
        if (userIndex !== -1) {
          const hashedPassword = await bcryptjs.hash(newPassword, 10);
          users[userIndex].password = hashedPassword;
          users[userIndex].updatedAt = new Date().toISOString();
          await writeJsonFile('users.json', users);
        }
      }
      
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
        const existingUser = await findUser(email);
        if (existingUser && existingUser.id !== userId) {
          throw new AppError('EMAIL_EXISTS', 'Email already in use', 409);
        }
      }
      
      let updatedUser: User | null = null;
      
      // Update in database first
      if (db.isEnabled()) {
        try {
          const dbUser = await db.updateUser(userId, { name, phone, email });
          if (dbUser) {
            updatedUser = {
              id: dbUser.id,
              email: dbUser.email,
              password: dbUser.password,
              name: dbUser.name,
              role: dbUser.role,
              phone: dbUser.phone,
              createdAt: dbUser.created_at.toISOString(),
              updatedAt: dbUser.updated_at.toISOString()
            };
            
            // Also update in JSON
            const users = await readJsonFile<User[]>('users.json');
            const userIndex = users.findIndex(u => u.id === userId);
            if (userIndex !== -1) {
              users[userIndex] = { ...users[userIndex], ...updatedUser };
              await writeJsonFile('users.json', users);
            }
          }
        } catch (error) {
          logger.error('Database error:', error);
          throw error;
        }
      } else {
        // JSON only
        const users = await readJsonFile<User[]>('users.json');
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
          throw new AppError('USER_NOT_FOUND', 'User not found', 404);
        }
        
        users[userIndex] = {
          ...users[userIndex],
          ...(name && { name }),
          ...(phone !== undefined && { phone }),
          ...(email && { email }),
          updatedAt: new Date().toISOString()
        };
        
        await writeJsonFile('users.json', users);
        updatedUser = users[userIndex];
      }
      
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
      
      const user = await findUserById(userId);
      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      // Update password
      if (db.isEnabled()) {
        try {
          await db.updateUserPassword(userId, newPassword);
          
          // Also update in JSON
          const users = await readJsonFile<User[]>('users.json');
          const userIndex = users.findIndex(u => u.id === userId);
          if (userIndex !== -1) {
            const hashedPassword = await bcryptjs.hash(newPassword, 10);
            users[userIndex].password = hashedPassword;
            users[userIndex].updatedAt = new Date().toISOString();
            await writeJsonFile('users.json', users);
          }
        } catch (error) {
          logger.error('Database error:', error);
          throw error;
        }
      } else {
        // JSON only
        const users = await readJsonFile<User[]>('users.json');
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
          const hashedPassword = await bcryptjs.hash(newPassword, 10);
          users[userIndex].password = hashedPassword;
          users[userIndex].updatedAt = new Date().toISOString();
          await writeJsonFile('users.json', users);
        }
      }
      
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
      
      let deleted = false;
      
      // Delete from database first
      if (db.isEnabled()) {
        try {
          deleted = await db.deleteUser(userId);
          
          // Also delete from JSON
          const users = await readJsonFile<User[]>('users.json');
          const userIndex = users.findIndex(u => u.id === userId);
          if (userIndex !== -1) {
            users.splice(userIndex, 1);
            await writeJsonFile('users.json', users);
          }
        } catch (error) {
          logger.error('Database error:', error);
          throw error;
        }
      } else {
        // JSON only
        const users = await readJsonFile<User[]>('users.json');
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
          users.splice(userIndex, 1);
          await writeJsonFile('users.json', users);
          deleted = true;
        }
      }
      
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
