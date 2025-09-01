import { http } from '@/api/http';
import { toast } from 'react-hot-toast';

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'Admin' | 'Customer' | 'Staff';
  status: 'active' | 'pending' | 'inactive';
  created_at: string;
  last_login?: string;
}

export interface SystemSettings {
  customer_auto_approval?: { enabled: boolean };
}

// Service class for all user-related API calls
class UserService {
  // Get all users
  async getUsers(): Promise<User[]> {
    try {
      const { data } = await http.get('/auth/users');
      
      // Handle both response formats
      if (data.success && data.data) {
        return Array.isArray(data.data) ? data.data : [];
      }
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
      throw error;
    }
  }

  // Get single user
  async getUser(userId: string): Promise<User> {
    const { data } = await http.get(`/auth/users/${userId}`);
    return data;
  }

  // Update user role
  async updateUserRole(userId: string, role: User['role']): Promise<User> {
    try {
      const { data } = await http.put(`/auth/users/${userId}/role`, { role });
      toast.success('User role updated');
      return data;
    } catch (error) {
      toast.error('Failed to update user role');
      throw error;
    }
  }

  // Delete user
  async deleteUser(userId: string): Promise<void> {
    try {
      await http.delete(`/auth/users/${userId}`);
      toast.success('User deleted');
    } catch (error) {
      toast.error('Failed to delete user');
      throw error;
    }
  }

  // System settings
  async updateAutoApproval(enabled: boolean): Promise<void> {
    try {
      await http.put('/system-settings/customer_auto_approval', {
        value: { enabled }
      });
      toast.success(`Customer auto-approval ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to update setting');
      throw error;
    }
  }

  async getSystemSettings(): Promise<SystemSettings> {
    const { data } = await http.get('/system-settings');
    return data;
  }

  // Pending user actions
  async approvePendingUser(userId: string): Promise<void> {
    try {
      await http.post(`/auth/users/${userId}/approve`);
      toast.success('User approved');
    } catch (error) {
      toast.error('Failed to approve user');
      throw error;
    }
  }

  async rejectPendingUser(userId: string): Promise<void> {
    try {
      await http.post(`/auth/users/${userId}/reject`);
      toast.success('User rejected');
    } catch (error) {
      toast.error('Failed to reject user');
      throw error;
    }
  }

  // User statistics
  async getUserStats() {
    const { data } = await http.get('/auth/users/stats');
    return data;
  }
}

// Export singleton instance
export const userService = new UserService();

// Export for use with React Query / SWR
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: any) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};