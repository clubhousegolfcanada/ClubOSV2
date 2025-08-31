import { useState, useEffect, useCallback } from 'react';
import { userService, User } from '@/services/api/userService';

// Custom hook for user management
export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getUsers();
      setUsers(data);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  // Update user role
  const updateUserRole = useCallback(async (userId: string, role: User['role']) => {
    try {
      const updatedUser = await userService.updateUserRole(userId, role);
      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
      return updatedUser;
    } catch (err) {
      throw err;
    }
  }, []);

  // Delete user
  const deleteUser = useCallback(async (userId: string) => {
    try {
      await userService.deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      throw err;
    }
  }, []);

  // Approve pending user
  const approveUser = useCallback(async (userId: string) => {
    try {
      await userService.approvePendingUser(userId);
      await fetchUsers(); // Refresh list
    } catch (err) {
      throw err;
    }
  }, [fetchUsers]);

  // Load users on mount
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    fetchUsers,
    updateUserRole,
    deleteUser,
    approveUser,
  };
};

// Hook for system settings
export const useSystemSettings = () => {
  const [autoApproval, setAutoApproval] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const settings = await userService.getSystemSettings();
      setAutoApproval(settings.customer_auto_approval?.enabled || false);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }, []);

  const updateAutoApproval = useCallback(async (enabled: boolean) => {
    setLoading(true);
    try {
      await userService.updateAutoApproval(enabled);
      setAutoApproval(enabled);
    } catch (err) {
      // Revert on error
      setAutoApproval(!enabled);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    autoApproval,
    updateAutoApproval,
    loading,
  };
};