import React, { useState, useEffect } from 'react';
import { useAuthState, useStore } from '@/state/useStore';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Save, Download, Upload, Trash2, Key, Eye, EyeOff, Plus, Edit2, X, Check, RefreshCw, Users, Shield, Clock, Database } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type User = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'support' | 'kiosk' | 'customer';
  phone?: string;
  createdAt: string;
  updatedAt: string;
};

type PasswordValidation = {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
};

export const OperationsUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editedUser, setEditedUser] = useState<Partial<User>>({});
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    password: '',
    role: 'support' as 'admin' | 'operator' | 'support' | 'kiosk' | 'customer',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState<PasswordValidation>({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false
  });
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  
  const { user } = useAuthState();
  const token = user?.token || localStorage.getItem('clubos_token');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const authToken = token || localStorage.getItem('clubos_token');
    
    if (!authToken) {
      console.log('No token available, skipping users fetch');
      toast.error('Please login to view users');
      return;
    }
    
    try {
      console.log('Fetching users from:', `${API_URL}/auth/users`);
      const response = await axios.get(`${API_URL}/auth/users`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      console.log('Users response:', response.data);
      
      // Handle both response formats
      if (response.data.success && response.data.data) {
        setUsers(Array.isArray(response.data.data) ? response.data.data : []);
      } else if (Array.isArray(response.data)) {
        setUsers(response.data);
      } else {
        console.error('Unexpected users response format:', response.data);
        setUsers([]);
      }
    } catch (error: any) {
      console.error('Error fetching users:', error.response || error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        // Optionally redirect to login
        // window.location.href = '/login';
      } else if (error.response?.status === 403) {
        toast.error('Admin access required');
      } else {
        toast.error(`Failed to load users: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  const validatePassword = (password: string) => {
    setPasswordValidation({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password)
    });
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user.id);
    setEditedUser({
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone
    });
  };

  const handleSaveUser = async () => {
    try {
      await axios.put(
        `${API_URL}/auth/users/${editingUser}`,
        editedUser,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('User updated successfully');
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await axios.delete(`${API_URL}/auth/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.name) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    const isValid = Object.values(passwordValidation).every(v => v);
    if (!isValid) {
      toast.error('Password does not meet requirements');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(
        `${API_URL}/auth/users`,
        newUser,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('User created successfully');
      setShowAddUser(false);
      setNewUser({
        email: '',
        name: '',
        password: '',
        role: 'support',
        phone: ''
      });
      fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !resetPasswordUserId) return;
    
    const isValid = Object.values(passwordValidation).every(v => v);
    if (!isValid) {
      toast.error('Password does not meet requirements');
      return;
    }
    
    try {
      await axios.put(
        `${API_URL}/auth/users/${resetPasswordUserId}/password`,
        { password: newPassword },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Password reset successfully');
      setResetPasswordUserId(null);
      setNewPassword('');
      setShowResetPassword(false);
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Failed to reset password');
    }
  };

  const handleBackup = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/backup`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      toast.success('Backup downloaded successfully');
    } catch (error) {
      console.error('Error downloading backup:', error);
      toast.error('Failed to download backup');
    }
  };

  const handleRestore = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          await axios.post(
            `${API_URL}/auth/restore`,
            data,
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );
          toast.success('Users restored successfully');
          fetchUsers();
        } catch (error) {
          console.error('Error restoring users:', error);
          toast.error('Failed to restore users');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Separate operators and customers
  const operators = users.filter(u => u.role !== 'customer');
  const customers = users.filter(u => u.role === 'customer');

  return (
    <div className="space-y-6">
      {/* Operator Management Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-gray-900">Operator Management</h2>
              <span className="text-sm text-gray-500">({operators.length} operators)</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowAddUser(true)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add User</span>
              </button>
              <button
                onClick={fetchUsers}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Email</th>
                  <th className="pb-3">Role</th>
                  <th className="pb-3">Phone</th>
                  <th className="pb-3">Created</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {operators.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="py-3">
                      {editingUser === user.id ? (
                        <input
                          type="text"
                          value={editedUser.name || ''}
                          onChange={(e) => setEditedUser({ ...editedUser, name: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-900">{user.name}</span>
                      )}
                    </td>
                    <td className="py-3">
                      {editingUser === user.id ? (
                        <input
                          type="email"
                          value={editedUser.email || ''}
                          onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
                        />
                      ) : (
                        <span className="text-sm text-gray-600">{user.email}</span>
                      )}
                    </td>
                    <td className="py-3">
                      {editingUser === user.id ? (
                        <select
                          value={editedUser.role || user.role}
                          onChange={(e) => setEditedUser({ ...editedUser, role: e.target.value as User['role'] })}
                          className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="admin">Admin</option>
                          <option value="operator">Operator</option>
                          <option value="support">Support</option>
                          <option value="kiosk">Kiosk</option>
                          <option value="customer">Customer</option>
                        </select>
                      ) : (
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          user.role === 'operator' ? 'bg-blue-100 text-blue-700' :
                          user.role === 'support' ? 'bg-green-100 text-green-700' :
                          user.role === 'customer' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {user.role}
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      {editingUser === user.id ? (
                        <input
                          type="tel"
                          value={editedUser.phone || ''}
                          onChange={(e) => setEditedUser({ ...editedUser, phone: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
                        />
                      ) : (
                        <span className="text-sm text-gray-600">{user.phone || '-'}</span>
                      )}
                    </td>
                    <td className="py-3">
                      <span className="text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center space-x-2">
                        {editingUser === user.id ? (
                          <>
                            <button
                              onClick={handleSaveUser}
                              className="p-1 text-green-600 hover:text-green-700"
                              title="Save"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingUser(null)}
                              className="p-1 text-gray-600 hover:text-gray-700"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEditUser(user)}
                              className="p-1 text-gray-600 hover:text-gray-700"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setResetPasswordUserId(user.id);
                                setShowResetPassword(true);
                              }}
                              className="p-1 text-blue-600 hover:text-blue-700"
                              title="Reset Password"
                            >
                              <Key className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-1 text-red-600 hover:text-red-700"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Customer Management Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-orange-500" />
              <h2 className="text-lg font-semibold text-gray-900">Customer Management</h2>
              <span className="text-sm text-gray-500">({customers.length} customers)</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setNewUser({ ...newUser, role: 'customer' });
                  setShowAddUser(true);
                }}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add Customer</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {customers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Email</th>
                    <th className="pb-3">Phone</th>
                    <th className="pb-3">Member Since</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="py-3">
                        <span className="text-sm font-medium text-gray-900">{customer.name}</span>
                      </td>
                      <td className="py-3">
                        <span className="text-sm text-gray-600">{customer.email}</span>
                      </td>
                      <td className="py-3">
                        <span className="text-sm text-gray-600">{customer.phone || '-'}</span>
                      </td>
                      <td className="py-3">
                        <span className="text-sm text-gray-500">
                          {new Date(customer.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditUser(customer)}
                            className="p-1 text-gray-600 hover:text-gray-700"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setResetPasswordUserId(customer.id);
                              setShowResetPassword(true);
                            }}
                            className="p-1 text-blue-600 hover:text-blue-700"
                            title="Reset Password"
                          >
                            <Key className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(customer.id)}
                            className="p-1 text-red-600 hover:text-red-700"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No customers yet</p>
              <p className="text-sm text-gray-400">Customers can sign up through the mobile app or you can add them manually.</p>
            </div>
          )}
        </div>
      </div>

      {/* Access Control Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900">Access Control</h2>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 bg-purple-50 rounded-lg">
              <h3 className="font-semibold text-purple-900 mb-2">Admin</h3>
              <ul className="text-sm text-purple-700 space-y-1">
                <li>• Full system access</li>
                <li>• User management</li>
                <li>• Knowledge editing</li>
                <li>• All operations</li>
              </ul>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Operator</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Operations access</li>
                <li>• Ticket management</li>
                <li>• Checklists</li>
                <li>• Basic analytics</li>
              </ul>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">Support</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• Commands access</li>
                <li>• ClubOS Boy</li>
                <li>• Message viewing</li>
                <li>• Limited operations</li>
              </ul>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Kiosk</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• ClubOS Boy only</li>
                <li>• Public terminal</li>
                <li>• Auto-redirect</li>
                <li>• No admin access</li>
              </ul>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <h3 className="font-semibold text-orange-900 mb-2">Customer</h3>
              <ul className="text-sm text-orange-700 space-y-1">
                <li>• Mobile app access</li>
                <li>• Book bays</li>
                <li>• Social features</li>
                <li>• View stats</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Backup/Restore Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900">Backup & Restore</h2>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBackup}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Download Backup</span>
            </button>
            <button
              onClick={handleRestore}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center space-x-2"
            >
              <Upload className="h-4 w-4" />
              <span>Restore from Backup</span>
            </button>
          </div>
          <p className="mt-3 text-sm text-gray-600">
            Regular backups help protect against data loss. Restore with caution as it will overwrite existing users.
          </p>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Add New User</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newUser.password}
                    onChange={(e) => {
                      setNewUser({ ...newUser, password: e.target.value });
                      validatePassword(e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="mt-2 space-y-1">
                  <div className={`text-xs ${passwordValidation.minLength ? 'text-green-600' : 'text-gray-400'}`}>
                    ✓ At least 8 characters
                  </div>
                  <div className={`text-xs ${passwordValidation.hasUppercase ? 'text-green-600' : 'text-gray-400'}`}>
                    ✓ One uppercase letter
                  </div>
                  <div className={`text-xs ${passwordValidation.hasLowercase ? 'text-green-600' : 'text-gray-400'}`}>
                    ✓ One lowercase letter
                  </div>
                  <div className={`text-xs ${passwordValidation.hasNumber ? 'text-green-600' : 'text-gray-400'}`}>
                    ✓ One number
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as User['role'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="admin">Admin</option>
                  <option value="operator">Operator</option>
                  <option value="support">Support</option>
                  <option value="kiosk">Kiosk</option>
                  <option value="customer">Customer</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowAddUser(false);
                  setNewUser({
                    email: '',
                    name: '',
                    password: '',
                    role: 'support',
                    phone: ''
                  });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                disabled={loading}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPassword && resetPasswordUserId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Reset Password</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    validatePassword(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-2 space-y-1">
                <div className={`text-xs ${passwordValidation.minLength ? 'text-green-600' : 'text-gray-400'}`}>
                  ✓ At least 8 characters
                </div>
                <div className={`text-xs ${passwordValidation.hasUppercase ? 'text-green-600' : 'text-gray-400'}`}>
                  ✓ One uppercase letter
                </div>
                <div className={`text-xs ${passwordValidation.hasLowercase ? 'text-green-600' : 'text-gray-400'}`}>
                  ✓ One lowercase letter
                </div>
                <div className={`text-xs ${passwordValidation.hasNumber ? 'text-green-600' : 'text-gray-400'}`}>
                  ✓ One number
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowResetPassword(false);
                  setResetPasswordUserId(null);
                  setNewPassword('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};