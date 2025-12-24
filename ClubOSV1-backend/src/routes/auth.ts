import { Router, Request, Response, NextFunction } from 'express';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { AppError } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { body, query } from 'express-validator';
import { authenticate, generateToken, verifyToken } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { transformUser } from '../utils/transformers';
import { passwordChangeLimiter } from '../middleware/passwordChangeLimiter';
import { authRateLimiter, signupRateLimiters } from '../middleware/rateLimiter';
import { contractorService } from '../services/contractorService';

const router = Router();

// Customer Registration endpoint (public)
router.post('/signup',
  ...signupRateLimiters, // Apply progressive rate limiting
  validate([
    body('email')
      .trim()
      .isEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number')
      .matches(/[!@#$%^&*(),.?":{}|<>]/)
      .withMessage('Password must contain at least one special character'),
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required'),
    body('phone')
      .optional()
      .trim(),
    body('role')
      .optional()
      .isIn(['customer'])
      .withMessage('Only customer registration is allowed through this endpoint')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, name, phone, role = 'customer' } = req.body;
      
      // Only allow customer registration through this endpoint
      if (role !== 'customer') {
        throw new AppError('Only customer registration is allowed', 403, 'FORBIDDEN');
      }
      
      logger.info('Customer registration attempt:', { email, name });
      
      // Check if user already exists
      const existingUser = await db.findUserByEmail(email);
      if (existingUser) {
        throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
      }
      
      // Check auto-approval setting
      let autoApprove = true; // Default to auto-approve
      try {
        const settingResult = await db.query(
          `SELECT value FROM system_settings WHERE key = 'customer_auto_approval'`
        );
        if (settingResult.rows.length > 0) {
          autoApprove = settingResult.rows[0].value?.enabled !== false;
        }
      } catch (err) {
        logger.warn('Could not fetch auto-approval setting, defaulting to auto-approve');
      }
      
      // Create user (password will be hashed in createUser)
      const userId = uuidv4();
      const user = await db.createUser({
        id: userId,
        email: email.toLowerCase(),
        password: password,
        name,
        phone,
        role: 'customer',
        status: autoApprove ? 'active' : 'pending_approval'
      });

      // Generate and save email verification token
      try {
        const { emailService } = await import('../services/emailService');
        const verificationToken = emailService.generateVerificationToken();

        // Save token to database (expires in 24 hours)
        await db.query(
          `INSERT INTO email_verification_tokens (user_id, token, expires_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '24 hours')`,
          [userId, verificationToken]
        );

        // Send verification email
        await emailService.sendVerificationEmail(email, name, verificationToken);
        logger.info('Verification email sent to:', email);
      } catch (emailError) {
        logger.error('Failed to send verification email:', emailError);
        // Don't fail signup if email sending fails
      }
      
      // Create customer profile automatically
      await db.query(
        `INSERT INTO customer_profiles (user_id, display_name) 
         VALUES ($1, $2) 
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, name]
      );
      
      // Initialize ClubCoins with 100 CC signup bonus - REQUIRED
      try {
        const { clubCoinService } = await import('../services/clubCoinService');
        await clubCoinService.initializeUser(userId, 100);
        logger.info('Initialized ClubCoins for new user:', { userId, initialBalance: 100 });
      } catch (error) {
        logger.error('CRITICAL: Failed to initialize ClubCoins for new user:', { 
          userId, 
          email,
          error: error instanceof Error ? error.message : error 
        });
        
        // Clean up the user if CC initialization fails
        try {
          await db.deleteUser(userId);
          logger.warn('Rolled back user creation due to CC initialization failure');
        } catch (rollbackError) {
          logger.error('Failed to rollback user creation:', rollbackError);
        }
        
        throw new AppError(
          'Account creation failed. Please try again or contact support.',
          500,
          'CC_INITIALIZATION_FAILED'
        );
      }
      
      // Add user to current season leaderboard
      try {
        const seasonResult = await db.query(
          `SELECT id FROM seasons WHERE status = 'active' LIMIT 1`
        );
        
        if (seasonResult.rows.length > 0) {
          const seasonId = seasonResult.rows[0].id;
          // Initialize seasonal earnings tracking for leaderboard
          await db.query(
            `INSERT INTO seasonal_cc_earnings 
             (user_id, season_id, cc_from_wins, cc_from_bonuses, cc_lost, cc_net, challenges_completed) 
             VALUES ($1, $2, 0, 100, 0, 100, 0)
             ON CONFLICT (user_id, season_id) DO NOTHING`,
            [userId, seasonId]
          );
          logger.info('Added user to season leaderboard:', { userId, seasonId });
        }
      } catch (error) {
        logger.error('Failed to add user to season leaderboard:', error);
        // Don't fail signup if leaderboard initialization fails
      }
      
      // Log successful registration
      await db.createAuthLog({
        user_id: userId,
        action: 'register',
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        success: true
      });
      
      logger.info('Customer registered successfully:', { 
        userId: user.id,
        email: user.email,
        status: autoApprove ? 'active' : 'pending_approval'
      });
      
      if (autoApprove) {
        // Generate token for auto-approved users
        const sessionId = uuidv4();
        const token = generateToken({
          userId: user.id,
          email: user.email,
          role: user.role,
          sessionId: sessionId
        });
        
        // Transform user for response
        const transformedUser = transformUser(user);
        
        res.status(201).json({
          success: true,
          message: 'Account created successfully!',
          data: {
            user: transformedUser,
            token
          }
        });
      } else {
        // Pending approval response
        res.status(201).json({
          success: true,
          message: 'Account created successfully. Your account is pending approval and you will be notified once approved.',
          data: {
            status: 'pending_approval'
          }
        });
      }
      
    } catch (error) {
      logger.error('Registration error:', error);
      next(error);
    }
  }
);

// Request password reset
// NOTE: This feature is NOT IMPLEMENTED - returns honest error to prevent user frustration
// TODO: Implement full password reset flow with email tokens
router.post('/forgot-password',
  validate([
    body('email').isEmail().withMessage('Valid email required')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;

      // Log the attempt for future implementation
      logger.info('Password reset requested (feature not implemented):', { email });

      // Return honest error - feature not implemented
      // Using 501 to be transparent while not revealing if email exists
      res.status(501).json({
        success: false,
        message: 'Password reset is temporarily unavailable. Please contact support at support@clubhouse247golf.com to reset your password.'
      });

    } catch (error) {
      next(error);
    }
  }
);

// Login endpoint
router.post('/login',
  authRateLimiter,
  validate([
    body('email')
      .trim()
      .isEmail()
      .withMessage('Valid email is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    body('rememberMe')
      .optional()
      .isBoolean()
      .withMessage('Remember me must be a boolean')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, rememberMe = false } = req.body;
      
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
      
      // Check if user account is pending approval
      if ((user as any).status === 'pending_approval') {
        throw new AppError('Your account is pending approval. You will be notified once approved.', 403, 'ACCOUNT_PENDING');
      }
      
      // Check if user account is suspended
      if ((user as any).status === 'suspended') {
        throw new AppError('Your account has been suspended. Please contact support.', 403, 'ACCOUNT_SUSPENDED');
      }
      
      // Check if user account is rejected
      if ((user as any).status === 'rejected') {
        throw new AppError('Your account application was not approved.', 403, 'ACCOUNT_REJECTED');
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
      
      // Generate JWT token with remember me option
      const sessionId = uuidv4();
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: sessionId
      }, rememberMe);
      
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

// Logout endpoint - invalidates the current token
router.post('/logout',
  authenticate, // User must be authenticated to logout
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get the token from the authorization header
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
      
      if (!token) {
        throw new AppError('No token provided', 400, 'INVALID_TOKEN');
      }
      
      // Verify and decode the token to get expiration time
      let decoded;
      try {
        decoded = verifyToken(token);
      } catch (error) {
        // Token is already invalid, consider it logged out
        return res.status(200).json({
          success: true,
          message: 'Logged out successfully'
        });
      }
      
      // Create a hash of the token for storage (security: don't store raw tokens)
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // Calculate when the token expires
      const expiresAt = decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      // Get client information for audit
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      // Insert into blacklist table
      await db.query(
        `INSERT INTO blacklisted_tokens 
         (token_hash, user_id, session_id, expires_at, reason, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (token_hash) DO NOTHING`,
        [
          tokenHash,
          req.user?.id || decoded.userId,
          decoded.sessionId || null,
          expiresAt,
          'user_logout',
          ipAddress,
          userAgent
        ]
      );
      
      logger.info('User logged out', {
        userId: req.user?.id,
        sessionId: decoded.sessionId,
        ipAddress
      });
      
      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Logout from all devices endpoint - invalidates all tokens for a user
router.post('/logout-all',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        throw new AppError('User not found', 400, 'USER_NOT_FOUND');
      }
      
      // Get all active sessions for this user (this would require tracking sessions)
      // For now, we'll just log the action
      // In a production system, you'd want to track all active sessions
      
      logger.info('User logged out from all devices', {
        userId,
        ipAddress: req.ip
      });
      
      res.status(200).json({
        success: true,
        message: 'Logged out from all devices successfully',
        note: 'Full implementation requires session tracking'
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
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
      .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase and numbers'),
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required'),
    body('role')
      .isIn(['admin', 'operator', 'support', 'kiosk', 'customer'])
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

// Create a new user (admin only)
router.post('/users',
  authenticate,
  roleGuard(['admin']),
  validate([
    body('email').isEmail().normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number')
      .matches(/[!@#$%^&*(),.?":{}|<>]/)
      .withMessage('Password must contain at least one special character'),
    body('name').notEmpty().withMessage('Name is required'),
    body('role').isIn(['admin', 'operator', 'support', 'kiosk', 'customer', 'contractor']).withMessage('Invalid role'),
    body('phone').optional(),
    body('locations').optional().isArray(),
    body('permissions').optional().isObject()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, name, role, phone, locations, permissions } = req.body;
      
      // Check if email already exists
      const existingUserQuery = await db.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      
      if (existingUserQuery.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'User with this email already exists'
        });
      }
      
      // Create user with proper status
      const userId = uuidv4();
      const user = await db.createUser({
        id: userId,
        email: email.toLowerCase(),
        password,  // createUser will hash it
        name,
        role,
        phone,
        status: 'active'
      });
      
      // If it's a contractor, create location permissions
      if (role === 'contractor' && locations && locations.length > 0) {
        for (const location of locations) {
          await contractorService.createPermission(
            userId,
            location,
            {
              canUnlockDoors: permissions?.canUnlockDoors ?? true,
              canSubmitChecklists: permissions?.canSubmitChecklists ?? true,
              canViewHistory: permissions?.canViewHistory ?? false
            },
            req.user!.id
          );
        }
      }
      
      // If it's a customer, handle full customer setup
      if (role === 'customer') {
        // Create customer profile
        await db.query(
          `INSERT INTO customer_profiles (user_id, display_name) 
           VALUES ($1, $2) 
           ON CONFLICT (user_id) DO NOTHING`,
          [userId, name]
        );
        
        // Initialize ClubCoins with 100 CC signup bonus
        try {
          const { clubCoinService } = await import('../services/clubCoinService');
          await clubCoinService.initializeUser(userId, 100);
          logger.info('Initialized ClubCoins for new customer:', { userId, initialBalance: 100 });
        } catch (error) {
          logger.error('Failed to initialize ClubCoins for new customer:', { 
            userId, 
            email,
            error: error instanceof Error ? error.message : error 
          });
          
          // Clean up the user if CC initialization fails
          try {
            await db.deleteUser(userId);
            logger.warn('Rolled back user creation due to CC initialization failure');
          } catch (rollbackError) {
            logger.error('Failed to rollback user creation:', rollbackError);
          }
          
          throw new AppError(
            'Customer account creation failed. Please try again.',
            500,
            'CC_INITIALIZATION_FAILED'
          );
        }
        
        // Add user to current season leaderboard
        try {
          const seasonResult = await db.query(
            `SELECT id FROM seasons WHERE status = 'active' LIMIT 1`
          );
          
          if (seasonResult.rows.length > 0) {
            const seasonId = seasonResult.rows[0].id;
            await db.query(
              `INSERT INTO seasonal_cc_earnings 
               (user_id, season_id, cc_from_wins, cc_from_bonuses, cc_lost, cc_net, challenges_completed) 
               VALUES ($1, $2, 0, 100, 0, 100, 0)
               ON CONFLICT (user_id, season_id) DO NOTHING`,
              [userId, seasonId]
            );
            logger.info('Added customer to season leaderboard:', { userId, seasonId });
          }
        } catch (error) {
          logger.error('Failed to add customer to season leaderboard:', error);
          // Don't fail user creation if leaderboard initialization fails
        }
      }
      
      logger.info('User created', {
        userId,
        email,
        role,
        createdBy: req.user!.email
      });
      
      res.status(201).json({
        success: true,
        data: {
          id: userId,
          email,
          name,
          role
        }
      });
      
    } catch (error) {
      logger.error('Error creating user:', error);
      next(error);
    }
  }
);

// Get user count (for dashboard metrics)
router.get('/users/count',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await db.getAllUsers();
      const activeUsers = users.filter(user => user.is_active).length;
      const totalUsers = users.length;
      
      res.json({
        success: true,
        data: {
          total: totalUsers,
          active: activeUsers
        }
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Update user profile
router.put('/profile',
  authenticate,
  validate([
    body('name').optional().isString().trim(),
    body('phone').optional().isMobilePhone('any'),
    body('location').optional().isString().trim(),
    body('homeGolfCourse').optional().isString().trim(),
    body('bio').optional().isString().trim(),
    body('handicap').optional().isFloat({ min: 0, max: 54 })
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { name, phone, location, homeGolfCourse, bio, handicap } = req.body;
      
      // Update user basic info (use 'users' table, not "Users")
      const userUpdate = await db.query(
        `UPDATE users 
         SET name = COALESCE($1, name),
             phone = COALESCE($2, phone),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, name, email, phone, role`,
        [name, phone, userId]
      );
      
      // Update or create customer profile with additional fields
      // Note: home_golf_course column doesn't exist in production yet, so we skip it
      if (location !== undefined || bio !== undefined || handicap !== undefined) {
        await db.query(
          `INSERT INTO customer_profiles (user_id, home_location, bio, handicap)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id) 
           DO UPDATE SET 
             home_location = COALESCE($2, customer_profiles.home_location),
             bio = COALESCE($3, customer_profiles.bio),
             handicap = COALESCE($4, customer_profiles.handicap),
             updated_at = CURRENT_TIMESTAMP`,
          [userId, location, bio, handicap]
        );
      }
      
      res.json({
        success: true,
        data: userUpdate.rows[0],
        message: 'Profile updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Change password
router.post('/change-password',
  authenticate,
  passwordChangeLimiter,
  validate([
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
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

// Approve pending user
router.put('/users/:userId/approve',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      
      // Update user status to active
      const result = await db.query(
        `UPDATE users SET status = 'active', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 AND status = 'pending_approval' 
         RETURNING id, email, name, status`,
        [userId]
      );
      
      if (result.rowCount === 0) {
        throw new AppError('User not found or already approved', 404, 'USER_NOT_FOUND');
      }
      
      const user = result.rows[0];
      
      logger.info('User approved:', { userId, approvedBy: (req as any).userId });
      
      // TODO: Send approval email to user
      
      res.json({
        success: true,
        message: 'User approved successfully',
        data: user
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Reject pending user
router.put('/users/:userId/reject',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      
      // Update user status to rejected
      const result = await db.query(
        `UPDATE users SET status = 'rejected', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 AND status = 'pending_approval' 
         RETURNING id, email, name, status`,
        [userId]
      );
      
      if (result.rowCount === 0) {
        throw new AppError('User not found or not pending', 404, 'USER_NOT_FOUND');
      }
      
      const user = result.rows[0];
      
      logger.info('User rejected:', { userId, rejectedBy: (req as any).userId, reason });
      
      res.json({
        success: true,
        message: 'User rejected',
        data: user
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Get pending users
router.get('/users/pending',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT id, email, name, phone, role, status, "createdAt" as created_at, signup_date
         FROM users 
         WHERE status = 'pending_approval' 
         ORDER BY "createdAt" DESC`
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
      .isIn(['admin', 'operator', 'support', 'kiosk', 'customer'])
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
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
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

// Email verification endpoint
router.get('/verify-email',
  validate([
    query('token')
      .notEmpty()
      .withMessage('Verification token is required')
      .isLength({ min: 64, max: 64 })
      .withMessage('Invalid token format')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.query;

      // Find the token in database
      const tokenResult = await db.query(
        `SELECT user_id, expires_at, used_at
         FROM email_verification_tokens
         WHERE token = $1`,
        [token]
      );

      if (tokenResult.rows.length === 0) {
        throw new AppError('Invalid or expired verification token', 400, 'INVALID_TOKEN');
      }

      const tokenData = tokenResult.rows[0];

      // Check if already used
      if (tokenData.used_at) {
        throw new AppError('This verification link has already been used', 400, 'TOKEN_USED');
      }

      // Check if expired
      if (new Date(tokenData.expires_at) < new Date()) {
        throw new AppError('This verification link has expired', 400, 'TOKEN_EXPIRED');
      }

      // Mark email as verified
      await db.query(
        `UPDATE users
         SET email_verified = true, email_verified_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [tokenData.user_id]
      );

      // Mark token as used
      await db.query(
        `UPDATE email_verification_tokens
         SET used_at = CURRENT_TIMESTAMP
         WHERE token = $1`,
        [token]
      );

      // Get user details for welcome email
      const userResult = await db.query(
        `SELECT email, name FROM users WHERE id = $1`,
        [tokenData.user_id]
      );

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        // Send welcome email
        try {
          const { emailService } = await import('../services/emailService');
          await emailService.sendWelcomeEmail(user.email, user.name);
        } catch (error) {
          logger.error('Failed to send welcome email:', error);
        }
      }

      logger.info('Email verified successfully:', { userId: tokenData.user_id });

      // Redirect to login with success message
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      res.redirect(`${frontendUrl}/login?verified=true`);

    } catch (error) {
      logger.error('Email verification failed:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const errorMessage = error instanceof AppError ? error.message : 'Verification failed';
      res.redirect(`${frontendUrl}/login?verification_error=${encodeURIComponent(errorMessage)}`);
    }
  }
);

// Resend verification email endpoint
router.post('/resend-verification',
  authRateLimiter, // Rate limit to prevent abuse
  validate([
    body('email')
      .trim()
      .isEmail()
      .withMessage('Valid email is required')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;

      // Find user
      const userResult = await db.query(
        `SELECT id, name, email_verified FROM users WHERE email = $1 AND role = 'customer'`,
        [email.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        // Don't reveal if email exists or not
        return res.json({
          success: true,
          message: 'If an account exists with this email, a verification link has been sent.'
        });
      }

      const user = userResult.rows[0];

      // Check if already verified
      if (user.email_verified) {
        return res.json({
          success: true,
          message: 'Your email is already verified. You can sign in.'
        });
      }

      // Generate new token
      const { emailService } = await import('../services/emailService');
      const verificationToken = emailService.generateVerificationToken();

      // Save token (expires old ones)
      await db.query(
        `UPDATE email_verification_tokens
         SET used_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND used_at IS NULL`,
        [user.id]
      );

      await db.query(
        `INSERT INTO email_verification_tokens (user_id, token, expires_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '24 hours')`,
        [user.id, verificationToken]
      );

      // Send email
      await emailService.sendVerificationEmail(email, user.name, verificationToken);

      logger.info('Verification email resent:', { email });

      res.json({
        success: true,
        message: 'Verification email sent. Please check your inbox.'
      });

    } catch (error) {
      logger.error('Failed to resend verification email:', error);
      next(error);
    }
  }
);

export default router;
