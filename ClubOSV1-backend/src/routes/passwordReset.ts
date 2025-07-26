import { Router, Request, Response, NextFunction } from 'express';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
// JSON operations removed - using PostgreSQL
import { User } from '../types';
import { AppError } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';

const router = Router();

// Password reset request (admin can reset any user's password)
router.post('/reset-password/:userId',
  authenticate,
  roleGuard(['admin']),
  validate([
    param('userId').isUUID().withMessage('Invalid user ID'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;
      
      const users = await readJsonFile<User[]>('users.json');
      const userIndex = users.findIndex(u => u.id === userId);
      
      if (userIndex === -1) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      // Hash the new password
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
        action: 'admin_password_reset',
        targetUserId: userId,
        timestamp: new Date().toISOString(),
        ip: req.ip
      });
      
      logger.info('Admin password reset:', { 
        adminId: req.user!.id, 
        targetUserId: userId 
      });
      
      res.json({
        success: true,
        message: 'Password reset successfully'
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Self password change (user changes their own password)
router.post('/change-my-password',
  authenticate,
  validate([
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
      .custom((value, { req }) => value !== req.body.currentPassword)
      .withMessage('New password must be different from current password')
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
        action: 'self_password_change',
        timestamp: new Date().toISOString(),
        ip: req.ip
      });
      
      logger.info('User changed password:', { userId: user.id });
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Generate temporary password (admin only)
router.post('/generate-temp-password/:userId',
  authenticate,
  roleGuard(['admin']),
  validate([
    param('userId').isUUID().withMessage('Invalid user ID')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      
      const users = await readJsonFile<User[]>('users.json');
      const userIndex = users.findIndex(u => u.id === userId);
      
      if (userIndex === -1) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      // Generate a temporary password
      const tempPassword = generateTempPassword();
      const hashedPassword = await bcryptjs.hash(tempPassword, 10);
      
      // Update user password
      users[userIndex] = {
        ...users[userIndex],
        password: hashedPassword,
        updatedAt: new Date().toISOString(),
        requirePasswordChange: true
      };
      
      await writeJsonFile('users.json', users);
      
      // Log temporary password generation
      await appendToJsonArray('authLogs.json', {
        id: uuidv4(),
        userId: req.user!.id,
        action: 'generate_temp_password',
        targetUserId: userId,
        timestamp: new Date().toISOString(),
        ip: req.ip
      });
      
      logger.info('Temporary password generated:', { 
        adminId: req.user!.id, 
        targetUserId: userId 
      });
      
      res.json({
        success: true,
        data: {
          tempPassword,
          message: 'Temporary password generated. User will be required to change it on next login.'
        }
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Helper function to generate temporary password
function generateTempPassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  
  let password = '';
  
  // Ensure at least one of each required character type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill the rest randomly
  const allChars = uppercase + lowercase + numbers;
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export default router;
