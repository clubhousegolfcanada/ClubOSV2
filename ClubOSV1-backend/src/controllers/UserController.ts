import { Request, Response } from 'express';
import { BaseController } from '../utils/BaseController';
import { UserService } from '../services/UserService';
import { logger } from '../utils/logger';

export class UserController extends BaseController {
  private userService: UserService;

  constructor() {
    super();
    this.userService = new UserService();
  }

  /**
   * Get all users (admin only)
   */
  getAllUsers = this.handle(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, role, status, search } = req.query;
    
    const filters = {
      role: role as string,
      status: status as string,
      search: search as string
    };

    const result = await this.userService.getAllUsers(
      Number(page),
      Number(limit),
      filters
    );

    return this.paginated(
      res,
      result.users,
      result.total,
      Number(page),
      Number(limit)
    );
  });

  /**
   * Get current user
   */
  getCurrentUser = this.handle(async (req: Request, res: Response) => {
    // Handle both old format (userId) and new format (id)
    const userId = (req as any).user?.id || (req as any).user?.userId;
    
    if (!userId) {
      return this.unauthorized(res, 'User not authenticated');
    }
    
    const user = await this.userService.getUserById(userId);
    
    if (!user) {
      return this.notFound(res, 'User not found');
    }

    return this.ok(res, user, 'Current user retrieved successfully');
  });

  /**
   * Get user by ID
   */
  getUserById = this.handle(async (req: Request, res: Response) => {
    const { userId } = req.params;
    
    const user = await this.userService.getUserById(userId);
    
    if (!user) {
      return this.notFound(res, 'User not found');
    }

    return this.ok(res, user, 'User retrieved successfully');
  });

  /**
   * Create new user (admin only)
   */
  createUser = this.handle(async (req: Request, res: Response) => {
    const userData = req.body;
    
    // Check if email already exists
    const existingUser = await this.userService.getUserByEmail(userData.email);
    if (existingUser) {
      return this.conflict(res, 'User with this email already exists');
    }

    const user = await this.userService.createUser(userData);
    return this.created(res, user, 'User created successfully');
  });

  /**
   * Update user
   */
  updateUser = this.handle(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const updates = req.body;
    
    // Remove sensitive fields from updates
    delete updates.password;
    delete updates.id;
    
    const user = await this.userService.updateUser(userId, updates);
    
    if (!user) {
      return this.notFound(res, 'User not found');
    }

    return this.ok(res, user, 'User updated successfully');
  });

  /**
   * Delete user (admin only)
   */
  deleteUser = this.handle(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const currentUserId = (req as any).user?.id;
    
    // Prevent self-deletion
    if (userId === currentUserId) {
      return this.badRequest(res, 'Cannot delete your own account');
    }

    const success = await this.userService.deleteUser(userId);
    
    if (!success) {
      return this.notFound(res, 'User not found');
    }

    return this.ok(res, null, 'User deleted successfully');
  });

  /**
   * Reset user password (admin only)
   */
  resetUserPassword = this.handle(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return this.badRequest(res, 'Password must be at least 6 characters');
    }

    const success = await this.userService.resetUserPassword(userId, newPassword);
    
    if (!success) {
      return this.notFound(res, 'User not found');
    }

    return this.ok(res, null, 'Password reset successfully');
  });

  /**
   * Get user count
   */
  getUserCount = this.handle(async (req: Request, res: Response) => {
    const stats = await this.userService.getUserStatistics();
    return this.ok(res, stats, 'User statistics retrieved');
  });

  /**
   * Get pending users
   */
  getPendingUsers = this.handle(async (req: Request, res: Response) => {
    const users = await this.userService.getPendingUsers();
    return this.ok(res, users, 'Pending users retrieved');
  });

  /**
   * Approve user
   */
  approveUser = this.handle(async (req: Request, res: Response) => {
    const { userId } = req.params;
    
    const user = await this.userService.approveUser(userId);
    
    if (!user) {
      return this.notFound(res, 'User not found');
    }

    return this.ok(res, user, 'User approved successfully');
  });

  /**
   * Reject user
   */
  rejectUser = this.handle(async (req: Request, res: Response) => {
    const { userId } = req.params;
    
    const success = await this.userService.rejectUser(userId);
    
    if (!success) {
      return this.notFound(res, 'User not found');
    }

    return this.ok(res, null, 'User rejected successfully');
  });

  /**
   * Search users
   */
  searchUsers = this.handle(async (req: Request, res: Response) => {
    const { q, role, status, limit = 20 } = req.query;
    
    if (!q) {
      return this.badRequest(res, 'Search query is required');
    }

    const users = await this.userService.searchUsers(
      q as string,
      {
        role: role as string,
        status: status as string
      },
      Number(limit)
    );

    return this.ok(res, users, 'Users found');
  });

  /**
   * Get user activity
   */
  getUserActivity = this.handle(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { days = 30 } = req.query;
    
    const activity = await this.userService.getUserActivity(userId, Number(days));
    
    if (!activity) {
      return this.notFound(res, 'User not found');
    }

    return this.ok(res, activity, 'User activity retrieved');
  });

  /**
   * Bulk update users
   */
  bulkUpdateUsers = this.handle(async (req: Request, res: Response) => {
    const { userIds, updates } = req.body;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return this.badRequest(res, 'User IDs array is required');
    }

    // Remove sensitive fields
    delete updates.password;
    delete updates.id;
    delete updates.email;

    const result = await this.userService.bulkUpdateUsers(userIds, updates);
    
    return this.ok(res, result, `${result.updated} users updated successfully`);
  });

  /**
   * Export users
   */
  exportUsers = this.handle(async (req: Request, res: Response) => {
    const { format = 'json', role, status } = req.query;
    
    const filters = {
      role: role as string,
      status: status as string
    };

    const data = await this.userService.exportUsers(filters, format as string);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
      return res.send(data);
    }

    return this.ok(res, data, 'Users exported successfully');
  });
}