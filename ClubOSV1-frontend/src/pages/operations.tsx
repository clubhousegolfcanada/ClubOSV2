import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useAuthState, useStore } from '@/state/useStore';
import toast from 'react-hot-toast';
import axios from 'axios';
import { Download, AlertCircle, RefreshCw, Save, Upload } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

type User = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'support';
  phone?: string;
  createdAt: string;
  updatedAt: string;
};

export default function Operations() {
  const { user } = useAuthState();
  const { users, setUsers } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'operator' as const,
    phone: ''
  });
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    role: 'admin' | 'operator' | 'support';
  }>({
    name: '',
    email: '',
    phone: '',
    role: 'operator'
  });
  const [feedback, setFeedback] = useState<any[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // Fetch users and feedback on mount
  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
      if (showFeedback) {
        fetchFeedback();
      }
    }
  }, [user, showFeedback]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/auth/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFeedback = async () => {
    try {
      setFeedbackLoading(true);
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/feedback/not-useful`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setFeedback(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
      toast.error('Failed to load feedback');
    } finally {
      setFeedbackLoading(false);
    }
  };

  const exportFeedback = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/feedback/export`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `clubos_feedback_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Feedback exported successfully');
    } catch (error) {
      console.error('Failed to export feedback:', error);
      toast.error('Failed to export feedback');
    }
  };

  const createBackup = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/backup`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        const backup = response.data.data;
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `clubos_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        
        toast.success('Backup created successfully');
      }
    } catch (error) {
      console.error('Failed to create backup:', error);
      toast.error('Failed to create backup');
    }
  };

  const restoreBackup = async (file: File) => {
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      
      const token = localStorage.getItem('clubos_token');
      const response = await axios.post(`${API_URL}/backup/restore`, backup, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success('Backup restored successfully');
        // Reload data
        fetchUsers();
        if (showFeedback) {
          fetchFeedback();
        }
      }
    } catch (error) {
      console.error('Failed to restore backup:', error);
      toast.error('Failed to restore backup');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (confirm('Are you sure you want to restore from this backup? This will overwrite existing data.')) {
        restoreBackup(file);
      }
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const token = localStorage.getItem('clubos_token');
      console.log('Creating user with token:', token ? 'Token exists' : 'No token');
      console.log('Token value:', token ? token.substring(0, 20) + '...' : 'None');
      console.log('Form data being sent:', formData);
      
      const response = await axios.post(`${API_URL}/auth/register`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success('User created successfully');
        setShowCreateForm(false);
        setFormData({ email: '', password: '', name: '', role: 'operator', phone: '' });
        fetchUsers();
      }
    } catch (error: any) {
      console.error('Failed to create user:', error);
      
      // Handle specific error cases
      if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
        // Redirect to login
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else if (error.response?.status === 403) {
        toast.error('You do not have permission to create users');
      } else if (error.response?.status === 400) {
        // Validation error - show specific message
        const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Validation failed';
        console.log('Validation error details:', error.response?.data);
        toast.error(`Validation error: ${errorMessage}`);
      } else {
        toast.error(error.response?.data?.message || 'Failed to create user');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = async (userId: string) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('clubos_token');
      const response = await axios.put(`${API_URL}/auth/users/${userId}`, editFormData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success('User updated successfully');
        setEditingUser(null);
        fetchUsers();
      }
    } catch (error: any) {
      console.error('Failed to update user:', error);
      toast.error(error.response?.data?.message || 'Failed to update user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      setIsLoading(true);
      const token = localStorage.getItem('clubos_token');
      await axios.delete(`${API_URL}/auth/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      toast.error(error.response?.data?.message || 'Failed to delete user');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditUser = (user: User) => {
    setEditingUser(user.id);
    setEditFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role
    });
  };

  const roleColors = {
    admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    operator: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    support: 'bg-green-500/20 text-green-400 border-green-500/30'
  };

  return (
    <>
      <Head>
        <title>ClubOS - Operations</title>
        <meta name="description" content="Manage users and operations" />
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
              Operations Center
            </h1>
            <p className="text-[var(--text-secondary)]">
              Manage system users and access controls
            </p>
          </div>

          {user?.role === 'admin' ? (
            <>
              {/* Tab Navigation */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowFeedback(false)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      !showFeedback
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    User Management
                  </button>
                  <button
                    onClick={() => setShowFeedback(true)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      showFeedback
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4" />
                    Feedback Log
                    {feedback.length > 0 && !showFeedback && (
                      <span className="ml-1 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                        {feedback.length}
                      </span>
                    )}
                  </button>
                </div>
                
                {/* Backup/Restore buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={createBackup}
                    className="px-3 py-2 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2"
                    title="Create backup of all data"
                  >
                    <Save className="w-4 h-4" />
                    Backup
                  </button>
                  <label className="px-3 py-2 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2 cursor-pointer"
                     title="Restore from backup file">
                    <Upload className="w-4 h-4" />
                    Restore
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {!showFeedback ? (
                <>
                  {/* User Management Section */}
                  <div className="card">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-semibold">User Management</h2>
                      <button
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                      >
                        {showCreateForm ? 'Cancel' : 'Add User'}
                      </button>
                    </div>

                    {/* Create User Form */}
                    {showCreateForm && (
                      <form onSubmit={handleCreateUser} className="mb-6 p-4 bg-[var(--bg-secondary)] rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">Name</label>
                            <input
                              type="text"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Email</label>
                            <input
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Password</label>
                            <input
                              type="password"
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg"
                              required
                              minLength={8}
                            />
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                              Min 8 chars, must include uppercase, lowercase, and numbers
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Phone (optional)</label>
                            <input
                              type="tel"
                              value={formData.phone}
                              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg"
                              placeholder="+1234567890"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Role</label>
                            <select
                              value={formData.role}
                              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg"
                            >
                              <option value="operator">Operator</option>
                              <option value="support">Support</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                          <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50"
                          >
                            {isLoading ? 'Creating...' : 'Create User'}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Users List */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[var(--border-secondary)]">
                            <th className="text-left py-3 px-4">Name</th>
                            <th className="text-left py-3 px-4">Email</th>
                            <th className="text-left py-3 px-4">Role</th>
                            <th className="text-left py-3 px-4">Phone</th>
                            <th className="text-left py-3 px-4">Created</th>
                            <th className="text-right py-3 px-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u) => (
                            <tr key={u.id} className="border-b border-[var(--border-secondary)]">
                              <td className="py-3 px-4">
                                {editingUser === u.id ? (
                                  <input
                                    type="text"
                                    value={editFormData.name}
                                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                    className="px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded"
                                  />
                                ) : (
                                  u.name
                                )}
                              </td>
                              <td className="py-3 px-4">
                                {editingUser === u.id ? (
                                  <input
                                    type="email"
                                    value={editFormData.email}
                                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                    className="px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded"
                                  />
                                ) : (
                                  u.email
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 text-xs rounded-full border ${roleColors[u.role]}`}>
                                  {u.role}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                {editingUser === u.id ? (
                                  <input
                                    type="tel"
                                    value={editFormData.phone}
                                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                                    className="px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded"
                                  />
                                ) : (
                                  u.phone || '-'
                                )}
                              </td>
                              <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">
                                {new Date(u.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {editingUser === u.id ? (
                                  <>
                                    <button
                                      onClick={() => handleUpdateUser(u.id)}
                                      className="text-green-400 hover:text-green-300 mr-2"
                                      disabled={isLoading}
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingUser(null)}
                                      className="text-gray-400 hover:text-gray-300"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => startEditUser(u)}
                                      className="text-blue-400 hover:text-blue-300 mr-3"
                                      disabled={u.id === user?.id}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(u.id)}
                                      className="text-red-400 hover:text-red-300"
                                      disabled={u.id === user?.id}
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Feedback Section */}
                  <div className="card">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h2 className="text-xl font-semibold">Not Helpful Feedback</h2>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">
                          Review responses that users marked as not helpful
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={fetchFeedback}
                          disabled={feedbackLoading}
                          className="px-4 py-2 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2"
                        >
                          <RefreshCw className={`w-4 h-4 ${feedbackLoading ? 'animate-spin' : ''}`} />
                          Refresh
                        </button>
                        <button
                          onClick={exportFeedback}
                          disabled={feedback.length === 0}
                          className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Export for Claude
                        </button>
                      </div>
                    </div>

                    {feedbackLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)] mx-auto"></div>
                        <p className="text-[var(--text-secondary)] mt-4">Loading feedback...</p>
                      </div>
                    ) : feedback.length === 0 ? (
                      <div className="text-center py-12 text-[var(--text-secondary)]">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No feedback entries yet</p>
                        <p className="text-sm mt-2">When users mark responses as "not helpful", they'll appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {feedback.map((item) => (
                          <div
                            key={item.id}
                            className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-secondary)]"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                              <div>
                                <span className="text-xs text-[var(--text-muted)]">Request:</span>
                                <p className="text-sm font-medium">{item.requestDescription}</p>
                              </div>
                              <div className="flex gap-4">
                                <div>
                                  <span className="text-xs text-[var(--text-muted)]">Route:</span>
                                  <p className="text-sm">
                                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                                      item.route === 'Emergency' ? 'bg-red-500/20 text-red-400' :
                                      item.route === 'TechSupport' ? 'bg-blue-500/20 text-blue-400' :
                                      item.route === 'Booking & Access' ? 'bg-green-500/20 text-green-400' :
                                      'bg-purple-500/20 text-purple-400'
                                    }`}>
                                      {item.route}
                                    </span>
                                  </p>
                                </div>
                                <div>
                                  <span className="text-xs text-[var(--text-muted)]">Confidence:</span>
                                  <p className="text-sm">{Math.round((item.confidence || 0) * 100)}%</p>
                                </div>
                                {item.location && (
                                  <div>
                                    <span className="text-xs text-[var(--text-muted)]">Location:</span>
                                    <p className="text-sm">{item.location}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="mb-3">
                              <span className="text-xs text-[var(--text-muted)]">Response:</span>
                              <p className="text-sm bg-[var(--bg-primary)] p-3 rounded mt-1">
                                {item.response}
                              </p>
                            </div>
                            <div className="flex justify-between items-center text-xs text-[var(--text-muted)]">
                              <span>{new Date(item.timestamp).toLocaleString()}</span>
                              <span>User: {item.userEmail || 'Unknown'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* System Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="card">
                  <h3 className="text-lg font-semibold mb-4">System Status</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">API Status</span>
                      <span className="text-green-400">Operational</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Database</span>
                      <span className="text-green-400">Connected</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">LLM Service</span>
                      <span className="text-green-400">Active</span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Total Users</span>
                      <span className="font-medium">{users.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Not Helpful Feedback</span>
                      <span className="font-medium">{feedback.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Active Sessions</span>
                      <span className="font-medium">0</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="card">
              <p className="text-[var(--text-secondary)]">
                You don't have permission to access operations management.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
