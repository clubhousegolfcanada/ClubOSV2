import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { UserRepository, User } from '../repositories/UserRepository';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

export interface LoginResult {
  success: boolean;
  message?: string;
  data?: {
    user: User;
    token: string;
    refreshToken?: string;
  };
}

export interface SignupResult {
  success: boolean;
  message?: string;
  data?: {
    user: User;
    token: string;
  };
}

export class AuthService {
  private userRepository: UserRepository;
  private jwtSecret: string;
  private jwtExpiresIn: string;
  private maxFailedAttempts: number;
  private lockoutDuration: number;

  constructor() {
    this.userRepository = new UserRepository();
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    this.maxFailedAttempts = 5;
    this.lockoutDuration = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Authenticate user login
   */
  async login(email: string, password: string): Promise<LoginResult> {
    try {
      // Get user with password
      const user = await this.userRepository.findByEmailWithPassword(email);
      
      if (!user) {
        logger.warn('Login attempt for non-existent user', { email });
        return {
          success: false,
          message: 'Invalid credentials'
        };
      }

      // Check if account is locked
      if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
        const remainingTime = Math.ceil((new Date(user.account_locked_until).getTime() - Date.now()) / 60000);
        return {
          success: false,
          message: `Account locked. Try again in ${remainingTime} minutes`
        };
      }

      // Check if account is active
      if (!user.is_active) {
        return {
          success: false,
          message: 'Account is inactive. Please contact support.'
        };
      }

      // Verify password
      const isValidPassword = await bcryptjs.compare(password, user.password!);
      
      if (!isValidPassword) {
        await this.handleFailedLogin(user.id);
        return {
          success: false,
          message: 'Invalid credentials'
        };
      }

      // Reset failed attempts and update last login
      await this.userRepository.resetFailedLogins(user.id);
      await this.userRepository.updateLastLogin(user.id);

      // Log auth event
      await this.logAuthEvent(user.id, 'login', true);

      // Generate tokens
      const token = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Store refresh token
      await this.storeRefreshToken(user.id, refreshToken);

      // Remove sensitive data
      delete user.password;
      delete user.reset_token;
      delete user.mfa_secret;

      return {
        success: true,
        data: {
          user,
          token,
          refreshToken
        }
      };
    } catch (error) {
      logger.error('Login error', error);
      throw error;
    }
  }

  /**
   * Register new user
   */
  async signup(userData: any): Promise<SignupResult> {
    try {
      // Validate required fields
      const requiredFields = ['email', 'password', 'name'];
      for (const field of requiredFields) {
        if (!userData[field]) {
          return {
            success: false,
            message: `${field} is required`
          };
        }
      }

      // Check if email exists
      const emailExists = await this.userRepository.emailExists(userData.email);
      
      if (emailExists) {
        return {
          success: false,
          message: 'Email already registered'
        };
      }

      // Validate password strength
      const passwordValidation = this.validatePassword(userData.password);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          message: passwordValidation.message
        };
      }

      // Set default role if not provided (only customer allowed for public signup)
      if (!userData.role || userData.role === 'admin' || userData.role === 'operator') {
        userData.role = 'customer';
      }

      // Generate email verification token
      const verificationToken = this.generateVerificationToken();

      // Create user
      const user = await this.userRepository.createUser({
        ...userData,
        email_verification_token: verificationToken,
        email_verified: false,
        signup_metadata: {
          ip: userData.ip,
          userAgent: userData.userAgent,
          timestamp: new Date()
        }
      });

      // Log auth event
      await this.logAuthEvent(user.id, 'signup', true);

      // Generate token
      const token = this.generateToken(user);

      // TODO: Send welcome email with verification link
      // await this.emailService.sendWelcomeEmail(user.email, user.name, verificationToken);

      return {
        success: true,
        data: {
          user,
          token
        }
      };
    } catch (error) {
      logger.error('Signup error', error);
      throw error;
    }
  }

  /**
   * Logout user (blacklist token)
   */
  async logout(token: string, userId: string): Promise<void> {
    try {
      // Hash the token for storage
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // Add token to blacklist
      await this.blacklistToken(tokenHash, userId);
      
      // Log auth event
      await this.logAuthEvent(userId, 'logout', true);
    } catch (error) {
      logger.error('Logout error', error);
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.userRepository.findByEmail(email);
      
      if (!user) {
        // Don't reveal if user exists
        return {
          success: true,
          message: 'If an account exists with this email, you will receive password reset instructions'
        };
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      // Store hashed token
      await this.userRepository.setResetToken(user.id, hashedToken, expiresAt);

      // Log auth event
      await this.logAuthEvent(user.id, 'password_reset_requested', true);

      // TODO: Send reset email
      // await this.emailService.sendPasswordResetEmail(user.email, user.name, resetToken);

      return {
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions'
      };
    } catch (error) {
      logger.error('Password reset request error', error);
      throw error;
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      // Hash the provided token
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      
      // Find user by token
      const user = await this.userRepository.findByResetToken(hashedToken);
      
      if (!user) {
        return {
          success: false,
          message: 'Invalid or expired reset token'
        };
      }

      // Validate new password
      const passwordValidation = this.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          message: passwordValidation.message!
        };
      }

      // Update password
      await this.userRepository.updatePassword(user.id, newPassword);

      // Log auth event
      await this.logAuthEvent(user.id, 'password_reset', true);

      return {
        success: true,
        message: 'Password has been reset successfully'
      };
    } catch (error) {
      logger.error('Password reset error', error);
      throw error;
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.userRepository.findByVerificationToken(token);
      
      if (!user) {
        return {
          success: false,
          message: 'Invalid verification token'
        };
      }

      if (user.email_verified) {
        return {
          success: true,
          message: 'Email already verified'
        };
      }

      await this.userRepository.verifyEmail(user.id);
      await this.logAuthEvent(user.id, 'email_verified', true);

      return {
        success: true,
        message: 'Email verified successfully'
      };
    } catch (error) {
      logger.error('Email verification error', error);
      throw error;
    }
  }

  /**
   * Change user password (requires current password)
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.userRepository.findByEmailWithPassword((await this.userRepository.findById(userId))!.email);
      
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      // Verify current password
      const isValid = await bcryptjs.compare(currentPassword, user.password!);
      if (!isValid) {
        await this.logAuthEvent(userId, 'password_change_failed', false);
        return {
          success: false,
          message: 'Current password is incorrect'
        };
      }

      // Validate new password
      const passwordValidation = this.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          message: passwordValidation.message!
        };
      }

      // Check if new password is same as current
      const isSame = await bcryptjs.compare(newPassword, user.password!);
      if (isSame) {
        return {
          success: false,
          message: 'New password must be different from current password'
        };
      }

      // Update password
      await this.userRepository.updatePassword(userId, newPassword);
      await this.logAuthEvent(userId, 'password_changed', true);

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      logger.error('Password change error', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<any> {
    try {
      // Check if token is blacklisted
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const isBlacklisted = await this.isTokenBlacklisted(tokenHash);
      
      if (isBlacklisted) {
        throw new Error('Token is blacklisted');
      }

      // Verify token
      const decoded = jwt.verify(token, this.jwtSecret);
      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Generate JWT token
   */
  generateToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      },
      this.jwtSecret,
      {
        expiresIn: this.jwtExpiresIn
      }
    );
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        type: 'refresh'
      },
      this.jwtSecret,
      {
        expiresIn: '30d'
      }
    );
  }

  /**
   * Generate email verification token
   */
  private generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): { isValid: boolean; message?: string } {
    if (password.length < 6) {
      return { isValid: false, message: 'Password must be at least 6 characters' };
    }
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one number' };
    }
    return { isValid: true };
  }

  /**
   * Handle failed login attempt
   */
  private async handleFailedLogin(userId: string): Promise<void> {
    await this.userRepository.incrementFailedLogins(userId);
    
    // Check if should lock account
    const user = await this.userRepository.findById(userId);
    if (user && (user.failed_login_attempts || 0) >= this.maxFailedAttempts) {
      const lockUntil = new Date(Date.now() + this.lockoutDuration);
      await this.userRepository.lockAccount(userId, lockUntil);
      await this.logAuthEvent(userId, 'account_locked', false);
    }
    
    await this.logAuthEvent(userId, 'login_failed', false);
  }

  /**
   * Blacklist a token
   */
  private async blacklistToken(tokenHash: string, userId: string): Promise<void> {
    const query = `
      INSERT INTO blacklisted_tokens (token_hash, user_id, blacklisted_at, expires_at)
      VALUES ($1, $2, NOW(), NOW() + INTERVAL '7 days')
      ON CONFLICT (token_hash) DO NOTHING
    `;
    await db.query(query, [tokenHash, userId]);
  }

  /**
   * Check if token is blacklisted
   */
  private async isTokenBlacklisted(tokenHash: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM blacklisted_tokens 
      WHERE token_hash = $1 
      AND (expires_at IS NULL OR expires_at > NOW())
    `;
    const result = await db.query(query, [tokenHash]);
    return result.rows.length > 0;
  }

  /**
   * Store refresh token
   */
  private async storeRefreshToken(userId: string, token: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const query = `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at)
      VALUES ($1, $2, NOW() + INTERVAL '30 days', NOW())
      ON CONFLICT (user_id) DO UPDATE 
      SET token_hash = $2, expires_at = NOW() + INTERVAL '30 days', created_at = NOW()
    `;
    await db.query(query, [userId, tokenHash]);
  }

  /**
   * Log authentication event
   */
  private async logAuthEvent(userId: string, event: string, success: boolean): Promise<void> {
    try {
      const query = `
        INSERT INTO auth_logs (user_id, event, success, timestamp, metadata)
        VALUES ($1, $2, $3, NOW(), $4)
      `;
      await db.query(query, [userId, event, success, JSON.stringify({ timestamp: new Date() })]);
    } catch (error) {
      logger.error('Failed to log auth event', error);
    }
  }
}