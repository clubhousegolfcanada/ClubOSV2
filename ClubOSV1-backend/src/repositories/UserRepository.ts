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
  // Extended fields stored in signup_metadata JSON
  reset_token?: string;
  reset_token_expires?: Date;
  email_verified?: boolean;
  email_verification_token?: string;
  failed_login_attempts?: number;
  account_locked_until?: Date;
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
             last_login, is_active, status, signup_metadata, signup_date
      FROM users 
      WHERE id = $1
    `;
    const result = await this.raw(query, [id]);
    if (result[0]) {
      // Extract extended fields from signup_metadata
      const user = result[0];
      if (user.signup_metadata) {
        Object.assign(user, {
          email_verified: user.signup_metadata.email_verified,
          email_verification_token: user.signup_metadata.email_verification_token,
          reset_token: user.signup_metadata.reset_token,
          reset_token_expires: user.signup_metadata.reset_token_expires,
          failed_login_attempts: user.signup_metadata.failed_login_attempts,
          account_locked_until: user.signup_metadata.account_locked_until
        });
      }
    }
    return result[0] || null;
  }

  /**
   * Find user by reset token
   */
  async findByResetToken(token: string): Promise<User | null> {
    const query = `
      SELECT * FROM users 
      WHERE signup_metadata->>'reset_token' = $1 
      AND (signup_metadata->>'reset_token_expires')::timestamp > NOW()
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
      WHERE signup_metadata->>'email_verification_token' = $1
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

    // Extract extended fields to store in signup_metadata
    const metadata = {
      ...(userData.signup_metadata || {}),
      email_verified: userData.email_verified || false,
      email_verification_token: userData.email_verification_token,
      reset_token: userData.reset_token,
      reset_token_expires: userData.reset_token_expires,
      failed_login_attempts: userData.failed_login_attempts || 0,
      account_locked_until: userData.account_locked_until
    };

    // Only include columns that exist in the database
    const dbData = {
      email: userData.email?.toLowerCase(),
      password: hashedPassword,
      name: userData.name,
      role: userData.role || 'customer',
      phone: userData.phone,
      is_active: userData.is_active !== undefined ? userData.is_active : true,
      status: userData.status || 'active',
      signup_metadata: metadata,
      signup_date: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };

    const user = await this.create(dbData);

    // Remove password from response
    delete user.password;
    return user;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.update(userId, {
      last_login: new Date()
    });
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcryptjs.hash(newPassword, 12);
    
    // Get current metadata and update it
    const user = await this.findById(userId);
    const metadata = user?.signup_metadata || {};
    delete metadata.reset_token;
    delete metadata.reset_token_expires;
    
    await this.update(userId, {
      password: hashedPassword,
      signup_metadata: metadata
    });
  }

  /**
   * Set password reset token
   */
  async setResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    // Get current metadata and update it
    const user = await this.findById(userId);
    const metadata = {
      ...(user?.signup_metadata || {}),
      reset_token: token,
      reset_token_expires: expiresAt
    };
    
    await this.update(userId, {
      signup_metadata: metadata
    });
  }

  /**
   * Verify user email
   */
  async verifyEmail(userId: string): Promise<void> {
    // Get current metadata and update it
    const user = await this.findById(userId);
    const metadata = {
      ...(user?.signup_metadata || {}),
      email_verified: true,
      email_verification_token: null
    };
    
    await this.update(userId, {
      signup_metadata: metadata
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
    const user = await this.findById(userId);
    const metadata = user?.signup_metadata || {};
    const attempts = (metadata.failed_login_attempts || 0) + 1;
    
    const query = `
      UPDATE users 
      SET signup_metadata = jsonb_set(
        COALESCE(signup_metadata, '{}'), 
        '{failed_login_attempts}', 
        $2::jsonb
      ),
      updated_at = NOW()
      WHERE id = $1
    `;
    await this.raw(query, [userId, JSON.stringify(attempts)]);
  }

  /**
   * Reset failed login attempts
   */
  async resetFailedLogins(userId: string): Promise<void> {
    const user = await this.findById(userId);
    const metadata = {
      ...(user?.signup_metadata || {}),
      failed_login_attempts: 0,
      account_locked_until: null
    };
    
    await this.update(userId, {
      signup_metadata: metadata
    });
  }

  /**
   * Lock user account
   */
  async lockAccount(userId: string, until: Date): Promise<void> {
    const user = await this.findById(userId);
    const metadata = {
      ...(user?.signup_metadata || {}),
      account_locked_until: until
    };
    
    await this.update(userId, {
      signup_metadata: metadata,
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
        COUNT(CASE WHEN signup_metadata->>'email_verified' = 'true' THEN 1 END) as verified
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
      SELECT id, email, name, role, created_at, signup_metadata
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
    // Find users with expired tokens in metadata
    const query = `
      UPDATE users 
      SET signup_metadata = signup_metadata - 'reset_token' - 'reset_token_expires'
      WHERE (signup_metadata->>'reset_token_expires')::timestamp < NOW()
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
      SELECT id, email, name, role, signup_metadata,
             CASE 
               WHEN signup_metadata->>'email_verified' = 'false' THEN 'Email not verified'
               WHEN (signup_metadata->>'account_locked_until')::timestamp > NOW() THEN 'Account locked'
               WHEN (signup_metadata->>'failed_login_attempts')::int > 5 THEN 'Multiple failed logins'
               WHEN is_active = false THEN 'Account inactive'
             END as action_required
      FROM users 
      WHERE signup_metadata->>'email_verified' = 'false' 
         OR (signup_metadata->>'account_locked_until')::timestamp > NOW()
         OR (signup_metadata->>'failed_login_attempts')::int > 5
         OR is_active = false
      ORDER BY created_at DESC
    `;
    return this.raw(query);
  }

  /**
   * Get all users with pagination and filters
   */
  async getAllUsers(page: number, limit: number, filters: any = {}): Promise<{ users: User[], total: number }> {
    let query = `
      SELECT id, email, name, role, phone, created_at, updated_at, 
             last_login, is_active, status, signup_date
      FROM users 
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (filters.role) {
      query += ` AND role = $${++paramCount}`;
      params.push(filters.role);
    }

    if (filters.status) {
      query += ` AND status = $${++paramCount}`;
      params.push(filters.status);
    }

    if (filters.search) {
      query += ` AND (LOWER(name) LIKE LOWER($${++paramCount}) OR LOWER(email) LIKE LOWER($${paramCount}))`;
      params.push(`%${filters.search}%`);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM users WHERE 1=1${query.substring(query.indexOf(' AND'))}`;
    const countResult = await this.raw(countQuery.split(' AND ')[0] + (params.length > 0 ? query.substring(query.indexOf(' AND')) : ''), params);
    const total = parseInt(countResult[0]?.count || '0');

    // Add pagination
    query += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, (page - 1) * limit);

    const users = await this.raw(query, params);
    return { users, total };
  }

  /**
   * Get pending users (not activated/verified)
   */
  async getPendingUsers(): Promise<User[]> {
    const query = `
      SELECT id, email, name, role, created_at, signup_metadata
      FROM users 
      WHERE status = 'pending' 
         OR signup_metadata->>'email_verified' = 'false'
         OR is_active = false
      ORDER BY created_at DESC
    `;
    return this.raw(query);
  }

  /**
   * Approve user
   */
  async approveUser(userId: string): Promise<User | null> {
    const user = await this.findById(userId);
    if (!user) return null;

    const metadata = {
      ...(user.signup_metadata || {}),
      email_verified: true,
      approved_at: new Date(),
      account_locked_until: null
    };

    await this.update(userId, {
      is_active: true,
      status: 'active',
      signup_metadata: metadata
    });

    return this.findById(userId);
  }

  /**
   * Reject/deactivate user
   */
  async rejectUser(userId: string): Promise<boolean> {
    const result = await this.update(userId, {
      is_active: false,
      status: 'rejected'
    });
    return !!result;
  }

  /**
   * Delete user (soft delete by default)
   */
  async deleteUser(userId: string, hardDelete = false): Promise<boolean> {
    if (hardDelete) {
      const query = 'DELETE FROM users WHERE id = $1 RETURNING id';
      const result = await this.raw(query, [userId]);
      return result.length > 0;
    } else {
      // Soft delete
      const result = await this.update(userId, {
        is_active: false,
        status: 'deleted',
        deleted_at: new Date()
      });
      return !!result;
    }
  }

  /**
   * Bulk update users
   */
  async bulkUpdateUsers(userIds: string[], updates: Partial<User>): Promise<number> {
    const query = `
      UPDATE users 
      SET ${Object.keys(updates).map((key, i) => `${key} = $${i + 2}`).join(', ')},
          updated_at = NOW()
      WHERE id = ANY($1)
      RETURNING id
    `;
    const result = await this.raw(query, [userIds, ...Object.values(updates)]);
    return result.length;
  }

  /**
   * Get user activity logs
   */
  async getUserActivity(userId: string, days: number): Promise<any> {
    const query = `
      SELECT 
        u.id, u.name, u.email,
        (SELECT COUNT(*) FROM auth_logs WHERE user_id = $1 AND "createdAt" > NOW() - INTERVAL '${days} days') as login_count,
        (SELECT COUNT(*) FROM bookings WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${days} days') as booking_count,
        (SELECT COUNT(*) FROM feedback WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${days} days') as feedback_count,
        (SELECT COUNT(*) FROM tickets WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${days} days') as ticket_count,
        u.last_login,
        u.created_at
      FROM users u
      WHERE u.id = $1
    `;
    const result = await this.raw(query, [userId]);
    return result[0];
  }

  /**
   * Export users in different formats
   */
  async exportUsers(filters: any = {}): Promise<User[]> {
    let query = `
      SELECT id, email, name, role, phone, created_at, 
             last_login, is_active, status, signup_date
      FROM users 
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (filters.role) {
      query += ` AND role = $${++paramCount}`;
      params.push(filters.role);
    }

    if (filters.status) {
      query += ` AND status = $${++paramCount}`;
      params.push(filters.status);
    }

    query += ' ORDER BY created_at DESC';
    return this.raw(query, params);
  }
}