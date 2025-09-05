import { UserRepository, User } from '../repositories/UserRepository';
import { logger } from '../utils/logger';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * Get all users with pagination and filters
   */
  async getAllUsers(page: number, limit: number, filters: any = {}) {
    try {
      return await this.userRepository.getAllUsers(page, limit, filters);
    } catch (error) {
      logger.error('Error getting all users:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      return await this.userRepository.findById(userId);
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      throw error;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      return await this.userRepository.findByEmail(email);
    } catch (error) {
      logger.error('Error getting user by email:', error);
      throw error;
    }
  }

  /**
   * Create new user
   */
  async createUser(userData: any): Promise<User> {
    try {
      // Generate ID if not provided
      if (!userData.id) {
        userData.id = uuidv4();
      }

      // Hash password if provided
      if (userData.password) {
        userData.password = await bcryptjs.hash(userData.password, 12);
      }

      // Set defaults
      userData.is_active = userData.is_active !== undefined ? userData.is_active : true;
      userData.status = userData.status || 'active';
      userData.email_verified = userData.email_verified !== undefined ? userData.email_verified : false;

      const user = await this.userRepository.createUser(userData);
      
      logger.info('User created', { userId: user.id, email: user.email });
      
      return user;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    try {
      // Check if user exists
      const existingUser = await this.userRepository.findById(userId);
      if (!existingUser) {
        return null;
      }

      // Hash password if being updated
      if (updates.password) {
        updates.password = await bcryptjs.hash(updates.password, 12);
      }

      const updatedUser = await this.userRepository.update(userId, updates);
      
      logger.info('User updated', { userId });
      
      return updatedUser;
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string, hardDelete = false): Promise<boolean> {
    try {
      const result = await this.userRepository.deleteUser(userId, hardDelete);
      
      if (result) {
        logger.info('User deleted', { userId, hardDelete });
      }
      
      return result;
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Reset user password
   */
  async resetUserPassword(userId: string, newPassword: string): Promise<boolean> {
    try {
      const hashedPassword = await bcryptjs.hash(newPassword, 12);
      
      await this.userRepository.updatePassword(userId, newPassword);
      logger.info('User password reset', { userId });
      return true;
    } catch (error) {
      logger.error('Error resetting user password:', error);
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(): Promise<any> {
    try {
      return await this.userRepository.getUserStats();
    } catch (error) {
      logger.error('Error getting user statistics:', error);
      throw error;
    }
  }

  /**
   * Get pending users
   */
  async getPendingUsers(): Promise<User[]> {
    try {
      return await this.userRepository.getPendingUsers();
    } catch (error) {
      logger.error('Error getting pending users:', error);
      throw error;
    }
  }

  /**
   * Approve user
   */
  async approveUser(userId: string): Promise<User | null> {
    try {
      const user = await this.userRepository.approveUser(userId);
      
      if (user) {
        logger.info('User approved', { userId });
        // TODO: Send approval email
      }
      
      return user;
    } catch (error) {
      logger.error('Error approving user:', error);
      throw error;
    }
  }

  /**
   * Reject user
   */
  async rejectUser(userId: string): Promise<boolean> {
    try {
      const result = await this.userRepository.rejectUser(userId);
      
      if (result) {
        logger.info('User rejected', { userId });
        // TODO: Send rejection email
      }
      
      return result;
    } catch (error) {
      logger.error('Error rejecting user:', error);
      throw error;
    }
  }

  /**
   * Search users
   */
  async searchUsers(query: string, filters: any = {}, limit = 20): Promise<User[]> {
    try {
      return await this.userRepository.searchUsers(query, limit);
    } catch (error) {
      logger.error('Error searching users:', error);
      throw error;
    }
  }

  /**
   * Get user activity
   */
  async getUserActivity(userId: string, days: number): Promise<any> {
    try {
      return await this.userRepository.getUserActivity(userId, days);
    } catch (error) {
      logger.error('Error getting user activity:', error);
      throw error;
    }
  }

  /**
   * Bulk update users
   */
  async bulkUpdateUsers(userIds: string[], updates: Partial<User>): Promise<{ updated: number }> {
    try {
      // Hash password if being updated
      if (updates.password) {
        updates.password = await bcryptjs.hash(updates.password, 12);
      }

      const updated = await this.userRepository.bulkUpdateUsers(userIds, updates);
      
      logger.info('Users bulk updated', { count: updated, userIds });
      
      return { updated };
    } catch (error) {
      logger.error('Error bulk updating users:', error);
      throw error;
    }
  }

  /**
   * Export users
   */
  async exportUsers(filters: any = {}, format: string): Promise<any> {
    try {
      const users = await this.userRepository.exportUsers(filters);
      
      if (format === 'csv') {
        return this.convertToCSV(users);
      }
      
      return users;
    } catch (error) {
      logger.error('Error exporting users:', error);
      throw error;
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: string): Promise<User[]> {
    try {
      return await this.userRepository.getUsersByRole(role);
    } catch (error) {
      logger.error('Error getting users by role:', error);
      throw error;
    }
  }

  /**
   * Get active users
   */
  async getActiveUsers(limit = 100, offset = 0): Promise<User[]> {
    try {
      return await this.userRepository.getActiveUsers(limit, offset);
    } catch (error) {
      logger.error('Error getting active users:', error);
      throw error;
    }
  }

  /**
   * Get recent signups
   */
  async getRecentSignups(days = 7): Promise<User[]> {
    try {
      return await this.userRepository.getRecentSignups(days);
    } catch (error) {
      logger.error('Error getting recent signups:', error);
      throw error;
    }
  }

  /**
   * Validate user credentials (for internal use)
   */
  async validateCredentials(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.userRepository.findByEmailWithPassword(email);
      
      if (!user || !user.password) {
        return null;
      }

      const isValid = await bcryptjs.compare(password, user.password);
      
      if (!isValid) {
        return null;
      }

      // Remove password from response
      delete user.password;
      return user;
    } catch (error) {
      logger.error('Error validating credentials:', error);
      throw error;
    }
  }

  /**
   * Convert users array to CSV format
   */
  private convertToCSV(users: User[]): string {
    if (users.length === 0) {
      return '';
    }

    // Define CSV headers
    const headers = ['ID', 'Email', 'Name', 'Role', 'Phone', 'Status', 'Active', 'Created At', 'Last Login'];
    const rows = users.map(user => [
      user.id,
      user.email,
      user.name,
      user.role,
      user.phone || '',
      user.status || '',
      user.is_active ? 'Yes' : 'No',
      user.created_at ? new Date(user.created_at).toISOString() : '',
      user.last_login ? new Date(user.last_login).toISOString() : 'Never'
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Check if user has permission
   */
  async userHasPermission(userId: string, permission: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findById(userId);
      
      if (!user) {
        return false;
      }

      // Admin has all permissions
      if (user.role === 'admin') {
        return true;
      }

      // Define role-based permissions
      const rolePermissions: Record<string, string[]> = {
        admin: ['*'],
        operator: ['read:users', 'update:users', 'create:bookings', 'update:bookings'],
        support: ['read:users', 'read:bookings', 'create:tickets'],
        customer: ['read:own', 'update:own'],
        kiosk: ['read:public']
      };

      const permissions = rolePermissions[user.role] || [];
      
      return permissions.includes('*') || permissions.includes(permission);
    } catch (error) {
      logger.error('Error checking user permission:', error);
      return false;
    }
  }
}