import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { pool } from '../../config/database';
import { 
  generateCustomerTokens, 
  refreshCustomerToken, 
  logoutCustomer,
  authenticateCustomer 
} from '../../middleware/customerAuth';
import { customerAuthLimiter } from '../../middleware/customerRateLimit';
import { body, validationResult } from 'express-validator';

const router = Router();

// Validation middleware
const validateRegistration = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('phone').optional().isMobilePhone('any'),
];

const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

/**
 * Register new customer
 * POST /api/v2/customer/auth/register
 */
router.post('/register', customerAuthLimiter, validateRegistration, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, phone, deviceId, deviceType } = req.body;

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create user account
      const userResult = await client.query(
        `INSERT INTO users (email, password, name, phone, role, is_customer, customer_since)
         VALUES ($1, $2, $3, $4, 'customer', true, CURRENT_TIMESTAMP)
         RETURNING id, email, name`,
        [email, hashedPassword, name, phone]
      );

      const user = userResult.rows[0];

      // Create customer profile
      await client.query(
        `INSERT INTO customer_profiles (user_id, display_name)
         VALUES ($1, $2)`,
        [user.id, name]
      );

      // Generate tokens
      const { accessToken, refreshToken } = await generateCustomerTokens(
        user.id,
        user.email,
        deviceId
      );

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Registration successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        accessToken,
        refreshToken
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * Login customer
 * POST /api/v2/customer/auth/login
 */
router.post('/login', customerAuthLimiter, validateLogin, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, deviceId, deviceType, deviceName } = req.body;

    // Find user
    const userResult = await pool.query(
      `SELECT id, email, name, password, is_active, is_customer 
       FROM users 
       WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Check if user is a customer
    if (!user.is_customer) {
      return res.status(403).json({ error: 'Not a customer account' });
    }

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate tokens
    const { accessToken, refreshToken } = await generateCustomerTokens(
      user.id,
      user.email,
      deviceId
    );

    // Store device info if provided
    if (deviceId && deviceType) {
      await pool.query(
        `UPDATE customer_auth_tokens 
         SET device_type = $1, device_name = $2
         WHERE refresh_token = $3`,
        [deviceType, deviceName, refreshToken]
      );
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * Refresh access token
 * POST /api/v2/customer/auth/refresh
 */
router.post('/refresh', refreshCustomerToken);

/**
 * Logout customer
 * POST /api/v2/customer/auth/logout
 */
router.post('/logout', authenticateCustomer, logoutCustomer);

/**
 * Request password reset
 * POST /api/v2/customer/auth/forgot-password
 */
router.post('/forgot-password', customerAuthLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, name FROM users WHERE email = $1 AND is_customer = true',
      [email]
    );

    // Always return success to prevent email enumeration
    if (userResult.rows.length === 0) {
      return res.json({ message: 'If the email exists, a reset link has been sent' });
    }

    const user = userResult.rows[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Store reset token (expires in 1 hour)
    await pool.query(
      `UPDATE users 
       SET settings = jsonb_set(
         COALESCE(settings, '{}'::jsonb),
         '{reset_token}',
         to_jsonb($1::text)
       ),
       settings = jsonb_set(
         settings,
         '{reset_token_expires}',
         to_jsonb($2::text)
       )
       WHERE id = $3`,
      [resetTokenHash, new Date(Date.now() + 3600000).toISOString(), user.id]
    );

    // TODO: Send email with reset link
    // For now, log the reset token (remove in production)
    console.log(`Password reset token for ${email}: ${resetToken}`);

    res.json({ message: 'If the email exists, a reset link has been sent' });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

/**
 * Reset password with token
 * POST /api/v2/customer/auth/reset-password
 */
router.post('/reset-password', customerAuthLimiter, async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Hash the provided token
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid reset token
    const userResult = await pool.query(
      `SELECT id, email 
       FROM users 
       WHERE settings->>'reset_token' = $1
       AND (settings->>'reset_token_expires')::timestamp > CURRENT_TIMESTAMP
       AND is_customer = true`,
      [tokenHash]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const user = userResult.rows[0];

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await pool.query(
      `UPDATE users 
       SET password = $1,
       settings = settings - 'reset_token' - 'reset_token_expires'
       WHERE id = $2`,
      [hashedPassword, user.id]
    );

    // Revoke all existing refresh tokens for security
    await pool.query(
      'DELETE FROM customer_auth_tokens WHERE user_id = $1',
      [user.id]
    );

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

/**
 * Verify email address
 * POST /api/v2/customer/auth/verify-email
 */
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    // TODO: Implement email verification logic
    res.json({ message: 'Email verification not yet implemented' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

export default router;