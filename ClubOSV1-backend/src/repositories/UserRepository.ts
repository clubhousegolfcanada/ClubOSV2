import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';
import bcryptjs from 'bcryptjs';

export interface User {
  id: string;
  email: string;
  password?: string;
  name: string;
  role: 'admin' | 'operator' | 'support' | 'kiosk' | 'customer';
  phone?: string;
  created_at?: Date;
  updated_at?: Date;
  last_login?: Date;
  is_active?: boolean;
  status?: string;
  signup_metadata?: any;
  signup_date?: Date;
  reset_token?: string;
  reset_token_expires?: Date;
  email_verified?: boolean;
  email_verification_token?: string;
  profile_image_url?: string;
  preferences?: any;
  customer_id?: string;
  location_id?: string;
  manager_notes?: string;
  auth_provider?: string;
  external_auth_id?: string;
  failed_login_attempts?: number;
  account_locked_until?: Date;
  mfa_enabled?: boolean;
  mfa_secret?: string;
  subscription_status?: string;
  subscription_tier?: string;
  last_activity?: Date;
  timezone?: string;
  language?: string;
  notification_preferences?: any;
  session_token?: string;
}

export class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const users = await this.findWhere({ email: email.toLowerCase() });
    return users[0] || null;
  }

  /**
   * Find user by email with password (for auth only)
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    const query = `
      SELECT * FROM users 
      WHERE LOWER(email) = LOWER($1)
    `;
    const result = await this.raw(query, [email]);
    return result[0] || null;
  }

  /**
   * Find user by ID (without password)
   */
  async findById(id: string): Promise<User | null> {
    const query = `
      SELECT id, email, name, role, phone, created_at, updated_at, 
             last_login, is_active, status, email_verified,
             profile_image_url, customer_id, location_id,
             subscription_status, subscription_tier, timezone, language
      FROM users 
      WHERE id = $1
    `;
    const result = await this.raw(query, [id]);
    return result[0] || null;
  }

  /**
   * Find user by reset token
   */
  async findByResetToken(token: string): Promise<User | null> {
    const query = `
      SELECT * FROM users 
      WHERE reset_token = $1 
      AND reset_token_expires > NOW()
    `;
    const result = await this.raw(query, [token]);
    return result[0] || null;
  }

  /**
   * Find user by email verification token
   */
  async findByVerificationToken(token: string): Promise<User | null> {
    const query = `
      SELECT * FROM users 
      WHERE email_verification_token = $1
    `;
    const result = await this.raw(query, [token]);
    return result[0] || null;
  }

  /**
   * Create new user
   */
  async createUser(userData: Partial<User>): Promise<User> {
    const hashedPassword = userData.password 
      ? await bcryptjs.hash(userData.password, 12)
      : null;

    const user = await this.create({
      ...userData,
      email: userData.email?.toLowerCase(),
      password: hashedPassword,
      is_active: userData.is_active !== undefined ? userData.is_active : true,
      created_at: new Date(),
      updated_at: new Date(),
      signup_date: new Date()
    });

    // Remove password from response
    delete user.password;
    return user;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.update(userId, {
      last_login: new Date(),
      last_activity: new Date()
    });
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcryptjs.hash(newPassword, 12);
    await this.update(userId, {
      password: hashedPassword,
      reset_token: null,
      reset_token_expires: null
    });
  }

  /**
   * Set password reset token
   */
  async setResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await this.update(userId, {
      reset_token: token,
      reset_token_expires: expiresAt
    });
  }

  /**
   * Verify user email
   */
  async verifyEmail(userId: string): Promise<void> {
    await this.update(userId, {
      email_verified: true,
      email_verification_token: null
    });
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    return this.exists({ email: email.toLowerCase() });
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: string): Promise<User[]> {
    return this.findWhere({ role, is_active: true });
  }

  /**
   * Get active users
   */
  async getActiveUsers(limit = 100, offset = 0): Promise<User[]> {
    const query = `
      SELECT id, email, name, role, phone, created_at, updated_at, 
             last_login, is_active, status
      FROM users 
      WHERE is_active = true
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    return this.raw(query, [limit, offset]);
  }

  /**
   * Search users
   */
  async searchUsers(searchTerm: string, limit = 20): Promise<User[]> {
    const query = `
      SELECT id, email, name, role, phone, created_at, last_login, is_active
      FROM users 
      WHERE (
        LOWER(email) LIKE LOWER($1) OR 
        LOWER(name) LIKE LOWER($1) OR 
        phone LIKE $1
      )
      ORDER BY created_at DESC
      LIMIT $2
    `;
    return this.raw(query, [`%${searchTerm}%`, limit]);
  }

  /**
   * Increment failed login attempts
   */
  async incrementFailedLogins(userId: string): Promise<void> {
    const query = `
      UPDATE users 
      SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1,
          updated_at = NOW()
      WHERE id = $1
    `;
    await this.raw(query, [userId]);
  }

  /**
   * Reset failed login attempts
   */
  async resetFailedLogins(userId: string): Promise<void> {
    await this.update(userId, {
      failed_login_attempts: 0,
      account_locked_until: null
    });
  }

  /**
   * Lock user account
   */
  async lockAccount(userId: string, until: Date): Promise<void> {
    await this.update(userId, {
      account_locked_until: until,
      is_active: false
    });
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
        COUNT(CASE WHEN role = 'operator' THEN 1 END) as operators,
        COUNT(CASE WHEN role = 'support' THEN 1 END) as support,
        COUNT(CASE WHEN role = 'customer' THEN 1 END) as customers,
        COUNT(CASE WHEN role = 'kiosk' THEN 1 END) as kiosks,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active,
        COUNT(CASE WHEN last_login > NOW() - INTERVAL '24 hours' THEN 1 END) as active_24h,
        COUNT(CASE WHEN last_login > NOW() - INTERVAL '7 days' THEN 1 END) as active_7d,
        COUNT(CASE WHEN email_verified = true THEN 1 END) as verified
      FROM users
    `;
    const result = await this.raw(query);
    return result[0];
  }

  /**
   * Get recent signups
   */
  async getRecentSignups(days = 7): Promise<User[]> {
    const query = `
      SELECT id, email, name, role, created_at, email_verified
      FROM users 
      WHERE created_at > NOW() - INTERVAL '${days} days'
      ORDER BY created_at DESC
    `;
    return this.raw(query);
  }

  /**
   * Cleanup expired reset tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const query = `
      UPDATE users 
      SET reset_token = NULL, 
          reset_token_expires = NULL
      WHERE reset_token_expires < NOW()
      RETURNING id
    `;
    const result = await this.raw(query);
    return result.length;
  }

  /**
   * Get users requiring action
   */
  async getUsersRequiringAction(): Promise<User[]> {
    const query = `
      SELECT id, email, name, role, 
             CASE 
               WHEN email_verified = false THEN 'Email not verified'
               WHEN account_locked_until > NOW() THEN 'Account locked'
               WHEN failed_login_attempts > 5 THEN 'Multiple failed logins'
               WHEN is_active = false THEN 'Account inactive'
             END as action_required
      FROM users 
      WHERE email_verified = false 
         OR account_locked_until > NOW()
         OR failed_login_attempts > 5
         OR is_active = false
      ORDER BY created_at DESC
    `;
    return this.raw(query);
  }
}