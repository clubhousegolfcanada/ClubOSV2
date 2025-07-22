import Head from 'next/head';
import { useState, useEffect } from 'react';
import Button from '@/components/Button';
import { useAnalytics, useSystemStatus, useRequestHistory, useNotifications } from '@/state/hooks';
import { useSettingsState, useAuthState } from '@/state/useStore';
import axios from 'axios';
import { Trash2, Edit2, UserPlus, X, Check, User, Save } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function Operations() {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'logs' | 'settings' | 'feedback' | 'profile'>('overview');
  const { stats, period, setPeriod, refresh: refreshAnalytics } = useAnalytics();
  const { config, fetchSystemStatus, updateConfig } = useSystemStatus();
  const { entries, isLoading: historyLoading, fetchHistory } = useRequestHistory();
  const { preferences, updatePreferences } = useSettingsState();
  const { notify } = useNotifications();
  const { user } = useAuthState();
  
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // User management state
  const [users, setUsers] = useState<any[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    role: 'operator'
  });
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [usersLoading, setUsersLoading] = useState(false);
  
  // Feedback state
  const [feedbackData, setFeedbackData] = useState<any[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  
  // Profile state
  const [profileData, setProfileData] = useState<any>(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    loadSystemStatus();
    if (activeTab === 'settings' && user?.role === 'admin') {
      loadUsers();
    }
    if (activeTab === 'feedback' && user?.role === 'admin') {
      loadFeedback();
    }
    if (activeTab === 'profile') {
      loadProfile();
    }
  }, [activeTab, user]);

  const loadSystemStatus = async () => {
    try {
      const status = await fetchSystemStatus();
      if (status) {
        setSystemStatus(status);
      }
    } catch (error) {
      notify('error', 'Failed to fetch system status');
    } finally {
      setLoading(false);
    }
  };

  // Profile functions
  const loadProfile = async () => {
    setProfileLoading(true);
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        const userData = response.data.data;
        setProfileData(userData);
        setProfileForm({
          name: userData.name || '',
          email: userData.email || '',
          phone: userData.phone || ''
        });
      }
    } catch (error) {
      notify('error', 'Failed to load profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.put(
        `${API_URL}/auth/users/${user?.id}`,
        profileForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        notify('success', 'Profile updated successfully');
        loadProfile();
      }
    } catch (error: any) {
      notify('error', error.response?.data?.message || 'Failed to update profile');
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      notify('error', 'New passwords do not match');
      return;
    }
    
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.post(
        `${API_URL}/auth/change-password`,
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        notify('success', 'Password changed successfully');
        setChangingPassword(false);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (error: any) {
      notify('error', error.response?.data?.message || 'Failed to change password');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadSystemStatus(),
        refreshAnalytics(),
        fetchHistory(),
      ]);
      notify('success', 'Data refreshed');
    } catch (error) {
      notify('error', 'Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const testLLM = async () => {
    try {
      const response = await axios.post(`${API_URL}/llm/test`, {
        description: 'Test request - need to book a simulator for tomorrow at 3pm'
      });
      notify('success', 'LLM test successful');
      console.log('LLM test result:', response.data);
    } catch (error) {
      notify('error', 'LLM test failed');
    }
  };

  const testSlack = async () => {
    try {
      await axios.post(`${API_URL}/slack/test`);
      notify('success', 'Slack test message sent');
    } catch (error) {
      notify('error', 'Slack test failed');
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const handleConfigUpdate = (key: string, value: any) => {
    updateConfig({ [key]: value });
    notify('info', 'Settings updated');
  };

  const handlePreferenceUpdate = (key: string, value: any) => {
    updatePreferences({ [key]: value });
    notify('info', 'Preferences updated');
  };

  // User management functions
  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/auth/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      notify('error', 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.post(`${API_URL}/auth/register`, newUser, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        notify('success', 'User created successfully');
        setShowCreateUser(false);
        setNewUser({ email: '', password: '', name: '', phone: '', role: 'operator' });
        loadUsers();
      }
    } catch (error: any) {
      notify('error', error.response?.data?.message || 'Failed to create user');
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.put(
        `${API_URL}/auth/users/${userId}/role`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        notify('success', 'User role updated successfully');
        loadUsers();
      }
    } catch (error: any) {
      notify('error', error.response?.data?.message || 'Failed to update user role');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.delete(`${API_URL}/auth/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        notify('success', 'User deleted successfully');
        loadUsers();
      }
    } catch (error: any) {
      notify('error', error.response?.data?.message || 'Failed to delete user');
    }
  };

  const startEditUser = (user: any) => {
    setEditingUser(user.id);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || ''
    });
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setEditForm({ name: '', email: '', phone: '' });
  };

  const handleUpdateUser = async (userId: string) => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.put(
        `${API_URL}/auth/users/${userId}`,
        editForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        notify('success', 'User updated successfully');
        setEditingUser(null);
        setEditForm({ name: '', email: '', phone: '' });
        loadUsers();
      }
    } catch (error: any) {
      notify('error', error.response?.data?.message || 'Failed to update user');
    }
  };

  // Feedback functions
  const loadFeedback = async () => {
    setFeedbackLoading(true);
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/feedback/not-useful`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setFeedbackData(response.data.data);
      }
    } catch (error) {
      notify('error', 'Failed to load feedback');
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
      
      notify('success', 'Feedback exported successfully');
    } catch (error) {
      notify('error', 'Failed to export feedback');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto"></div>
          <p className="mt-4 text-[var(--text-secondary)]">Loading operations data...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>ClubOSV1 - Operations Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <main className="min-h-screen bg-[var(--bg-primary)]">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
                Operations Dashboard
              </h1>
              <p className="text-[var(--text-secondary)]">
                Monitor and manage ClubOSV1 system operations
              </p>
            </div>
            <Button
              onClick={handleRefresh}
              variant="secondary"
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          {/* Tab Navigation */}
          <div className="card mb-6">
            <div className="border-b border-[var(--border-secondary)] -mx-8 -mt-8 px-8">
              <nav className="flex -mb-px">
                {(['overview', 'analytics', 'logs', 'settings'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`
                      py-4 px-6 capitalize font-medium text-sm transition-all duration-200
                      ${activeTab === tab
                        ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }
                    `}
                  >
                    {tab}
                  </button>
                ))}
                {user?.role === 'admin' && (
                  <button
                    onClick={() => setActiveTab('feedback')}
                    className={`
                      py-4 px-6 capitalize font-medium text-sm transition-all duration-200
                      ${activeTab === 'feedback'
                        ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }
                    `}
                  >
                    Feedback
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`
                    py-4 px-6 capitalize font-medium text-sm transition-all duration-200 flex items-center gap-2
                    ${activeTab === 'profile'
                      ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }
                  `}
                >
                  <User className="w-4 h-4" />
                  Profile
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="mt-8">
              {activeTab === 'overview' && systemStatus && (
                <div className="space-y-6">
                  {/* System Status Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* LLM Status Card */}
                    <div className="bg-[var(--bg-tertiary)] rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">LLM Service</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          systemStatus.llm?.enabled ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                        }`}>
                          {systemStatus.llm?.enabled ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <p><span className="text-[var(--text-secondary)]">Provider:</span> {systemStatus.llm?.provider}</p>
                        <p><span className="text-[var(--text-secondary)]">Model:</span> {systemStatus.llm?.model}</p>
                        <p><span className="text-[var(--text-secondary)]">Success Rate:</span> {
                          systemStatus.llm?.stats?.totalRequests > 0
                            ? ((systemStatus.llm.stats.successfulRequests / systemStatus.llm.stats.totalRequests) * 100).toFixed(1)
                            : 0
                        }%</p>
                        <p><span className="text-[var(--text-secondary)]">Avg Response:</span> {systemStatus.llm?.stats?.averageProcessingTime?.toFixed(0) || 0}ms</p>
                      </div>
                      <Button
                        onClick={testLLM}
                        variant="secondary"
                        size="sm"
                        fullWidth
                        className="mt-4"
                      >
                        Test LLM
                      </Button>
                    </div>

                    {/* Slack Status Card */}
                    <div className="bg-[var(--bg-tertiary)] rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Slack Integration</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          systemStatus.slack?.enabled ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                        }`}>
                          {systemStatus.slack?.enabled ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <p><span className="text-[var(--text-secondary)]">Channel:</span> {systemStatus.slack?.channel}</p>
                        <p><span className="text-[var(--text-secondary)]">Messages (24h):</span> {systemStatus.slack?.stats?.last24Hours || 0}</p>
                        <p><span className="text-[var(--text-secondary)]">Success Rate:</span> {
                          systemStatus.slack?.stats?.totalMessages > 0
                            ? ((systemStatus.slack.stats.successfulMessages / systemStatus.slack.stats.totalMessages) * 100).toFixed(1)
                            : 0
                        }%</p>
                        <p><span className="text-[var(--text-secondary)]">Webhook:</span> {systemStatus.slack?.webhookConfigured ? '✓' : '✗'}</p>
                      </div>
                      <Button
                        onClick={testSlack}
                        variant="secondary"
                        size="sm"
                        fullWidth
                        className="mt-4"
                      >
                        Test Slack
                      </Button>
                    </div>

                    {/* System Health Card */}
                    <div className="bg-[var(--bg-tertiary)] rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">System Health</h3>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-900/50 text-green-400">
                          Healthy
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <p><span className="text-[var(--text-secondary)]">Data Retention:</span> {config.dataRetentionDays} days</p>
                        <p><span className="text-[var(--text-secondary)]">Request Timeout:</span> {config.requestTimeout / 1000}s</p>
                        <p><span className="text-[var(--text-secondary)]">Max Retries:</span> {config.maxRetries}</p>
                        <p><span className="text-[var(--text-secondary)]">API Version:</span> v1.0.0</p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="bg-[var(--bg-tertiary)] rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Quick Statistics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-[var(--accent)]">{stats.totalRequests}</p>
                        <p className="text-sm text-[var(--text-secondary)]">Total Requests</p>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-bold text-[var(--status-success)]">{stats.successRate.toFixed(1)}%</p>
                        <p className="text-sm text-[var(--text-secondary)]">Success Rate</p>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-bold text-[var(--status-info)]">{stats.avgResponseTime.toFixed(0)}ms</p>
                        <p className="text-sm text-[var(--text-secondary)]">Avg Response</p>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-bold text-[var(--status-warning)]">{stats.peakHour}:00</p>
                        <p className="text-sm text-[var(--text-secondary)]">Peak Hour</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  {/* Period Selector */}
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold">Analytics Period</h3>
                    <div className="flex gap-2">
                      {(['1h', '24h', '7d', '30d'] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setPeriod(p)}
                          className={`
                            px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                            ${period === p
                              ? 'bg-[var(--accent)] text-white'
                              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }
                          `}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Route Distribution */}
                  <div className="bg-[var(--bg-tertiary)] rounded-lg p-6">
                    <h4 className="font-medium mb-4">Request Distribution by Bot</h4>
                    <div className="space-y-3">
                      {Object.entries(stats.routeDistribution || {}).map(([route, count]) => {
                        const percentage = stats.totalRequests > 0 ? (count / stats.totalRequests) * 100 : 0;
                        return (
                          <div key={route} className="flex items-center">
                            <span className="w-32 text-sm">{route}</span>
                            <div className="flex-1 mx-4">
                              <div className="bg-[var(--bg-secondary)] rounded-full h-4">
                                <div
                                  className="bg-[var(--accent)] rounded-full h-4 transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-sm font-medium">{count} ({percentage.toFixed(1)}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'logs' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4">Recent Activity Logs</h3>
                  {historyLoading ? (
                    <div className="text-center py-8">
                      <div className="spinner mx-auto"></div>
                      <p className="text-[var(--text-secondary)] mt-2">Loading logs...</p>
                    </div>
                  ) : entries.length > 0 ? (
                    <div className="space-y-2">
                      {entries.slice(0, 10).map((entry) => (
                        <div key={entry.id} className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{entry.request.requestDescription}</p>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">
                                {new Date(entry.timestamp).toLocaleString()} • 
                                Route: {entry.response.botRoute} • 
                                Status: <span className={`font-medium ${
                                  entry.response.status === 'completed' ? 'text-[var(--status-success)]' : 'text-[var(--status-error)]'
                                }`}>{entry.response.status}</span>
                              </p>
                            </div>
                            <span className="text-xs text-[var(--text-muted)]">{entry.duration}ms</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-[var(--text-secondary)]">No logs found</p>
                  )}
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-6">
                  {/* User Management Section - Admin Only */}
                  {user?.role === 'admin' && (
                    <div className="border-b border-[var(--border-secondary)] pb-6">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-medium">User Management</h4>
                        <Button
                          onClick={() => setShowCreateUser(true)}
                          variant="primary"
                          size="sm"
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Add User
                        </Button>
                      </div>

                      {/* Create User Form */}
                      {showCreateUser && (
                        <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 mb-4">
                          <h5 className="font-medium mb-3">Create New User</h5>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                Email
                              </label>
                              <input
                                type="email"
                                className="form-input w-full"
                                value={newUser.email}
                                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                placeholder="user@example.com"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                Name
                              </label>
                              <input
                                type="text"
                                className="form-input w-full"
                                value={newUser.name}
                                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                placeholder="John Doe"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                Phone Number
                              </label>
                              <input
                                type="tel"
                                className="form-input w-full"
                                value={newUser.phone}
                                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                                placeholder="+1 (902) 555-0101"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                Password
                              </label>
                              <input
                                type="password"
                                className="form-input w-full"
                                value={newUser.password}
                                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                placeholder="Minimum 8 characters"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                Role
                              </label>
                              <select
                                className="form-input w-full"
                                value={newUser.role}
                                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                              >
                                <option value="operator">Operator - Standard Access</option>
                                <option value="support">Support - Read Only</option>
                                <option value="admin">Admin - Full Access</option>
                              </select>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={handleCreateUser}
                                variant="primary"
                                size="sm"
                              >
                                Create User
                              </Button>
                              <Button
                                onClick={() => {
                                  setShowCreateUser(false);
                                  setNewUser({ email: '', password: '', name: '', phone: '', role: 'operator' });
                                }}
                                variant="secondary"
                                size="sm"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Users List */}
                      {usersLoading ? (
                        <div className="text-center py-4">
                          <div className="spinner mx-auto"></div>
                          <p className="text-[var(--text-secondary)] mt-2">Loading users...</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {users.map((u) => (
                            <div key={u.id} className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                              {editingUser === u.id ? (
                                // Edit Mode
                                <div className="space-y-3">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                        Name
                                      </label>
                                      <input
                                        type="text"
                                        className="form-input w-full text-sm"
                                        value={editForm.name}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        placeholder="Full name"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                        Email
                                      </label>
                                      <input
                                        type="email"
                                        className="form-input w-full text-sm"
                                        value={editForm.email}
                                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                        placeholder="Email address"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                        Phone
                                      </label>
                                      <input
                                        type="tel"
                                        className="form-input w-full text-sm"
                                        value={editForm.phone}
                                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                        placeholder="Phone number"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => handleUpdateUser(u.id)}
                                      className="p-2 text-[var(--status-success)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
                                      title="Save changes"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={cancelEdit}
                                      className="p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
                                      title="Cancel"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                // View Mode
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium">{u.name}</p>
                                    <p className="text-sm text-[var(--text-secondary)]">{u.email}</p>
                                    {u.phone && (
                                      <p className="text-sm text-[var(--text-secondary)]">📱 {u.phone}</p>
                                    )}
                                    <p className="text-xs text-[var(--text-muted)] mt-1">
                                      Role: <span className="text-[var(--accent)]">{u.role}</span>
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <select
                                      className="form-input text-sm"
                                      value={u.role}
                                      onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                      disabled={u.id === user?.id}
                                    >
                                      <option value="support">Support</option>
                                      <option value="operator">Operator</option>
                                      <option value="admin">Admin</option>
                                    </select>
                                    <button
                                      onClick={() => startEditUser(u)}
                                      className="p-2 text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
                                      title="Edit user"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(u.id)}
                                      disabled={u.id === user?.id}
                                      className="p-2 text-[var(--status-error)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      title={u.id === user?.id ? "Cannot delete your own account" : "Delete user"}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-b border-[var(--border-secondary)] pb-6">
                    <h4 className="font-medium mb-4">System Configuration</h4>
                    <div className="space-y-4">
                      <label className="flex items-center justify-between">
                        <span>Enable LLM Processing</span>
                        <input
                          type="checkbox"
                          className="toggle"
                          checked={config.llmEnabled}
                          onChange={(e) => handleConfigUpdate('llmEnabled', e.target.checked)}
                        />
                      </label>
                      <label className="flex items-center justify-between">
                        <span>Enable Slack Fallback</span>
                        <input
                          type="checkbox"
                          className="toggle"
                          checked={config.slackFallbackEnabled}
                          onChange={(e) => handleConfigUpdate('slackFallbackEnabled', e.target.checked)}
                        />
                      </label>
                      <div className="flex items-center justify-between">
                        <span>Request Timeout (seconds)</span>
                        <input
                          type="number"
                          className="form-input w-24"
                          value={config.requestTimeout / 1000}
                          onChange={(e) => handleConfigUpdate('requestTimeout', parseInt(e.target.value) * 1000)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Max Retries</span>
                        <input
                          type="number"
                          className="form-input w-24"
                          value={config.maxRetries}
                          onChange={(e) => handleConfigUpdate('maxRetries', parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-[var(--border-secondary)] pb-6">
                    <h4 className="font-medium mb-4">User Preferences</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span>Default Route</span>
                        <select
                          className="form-input"
                          value={preferences.defaultRoute}
                          onChange={(e) => handlePreferenceUpdate('defaultRoute', e.target.value)}
                        >
                          <option value="Auto">Auto</option>
                          <option value="Emergency">Emergency</option>
                          <option value="Booking&Access">Booking & Access</option>
                          <option value="TechSupport">Tech Support</option>
                          <option value="BrandTone">Brand Tone</option>
                        </select>
                      </div>
                      <label className="flex items-center justify-between">
                        <span>Sound Notifications</span>
                        <input
                          type="checkbox"
                          className="toggle"
                          checked={preferences.soundEnabled}
                          onChange={(e) => handlePreferenceUpdate('soundEnabled', e.target.checked)}
                        />
                      </label>
                      <label className="flex items-center justify-between">
                        <span>Compact Mode</span>
                        <input
                          type="checkbox"
                          className="toggle"
                          checked={preferences.compactMode}
                          onChange={(e) => handlePreferenceUpdate('compactMode', e.target.checked)}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'feedback' && user?.role === 'admin' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h4 className="font-medium text-lg">Not Useful Responses</h4>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">
                        Review responses marked as not useful to improve the system
                      </p>
                    </div>
                    <Button
                      onClick={exportFeedback}
                      variant="primary"
                      size="sm"
                      disabled={feedbackData.length === 0}
                    >
                      Export for Claude
                    </Button>
                  </div>

                  {feedbackLoading ? (
                    <div className="text-center py-8">
                      <div className="spinner mx-auto"></div>
                      <p className="text-[var(--text-secondary)] mt-2">Loading feedback...</p>
                    </div>
                  ) : feedbackData.length > 0 ? (
                    <div className="space-y-4">
                      {feedbackData.map((item) => (
                        <div key={item.id} className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="text-sm font-medium text-[var(--text-primary)]">Request:</p>
                              <p className="text-sm text-[var(--text-secondary)]">{item.requestDescription}</p>
                            </div>
                            <span className="text-xs text-[var(--text-muted)]">
                              {new Date(item.timestamp).toLocaleString()}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-[var(--text-muted)]">Location:</p>
                              <p className="text-sm text-[var(--text-secondary)]">{item.location || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[var(--text-muted)]">Route:</p>
                              <p className="text-sm text-[var(--text-secondary)]">{item.route}</p>
                            </div>
                          </div>
                          
                          <div className="mb-3">
                            <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Response:</p>
                            <p className="text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded p-3">
                              {item.response}
                            </p>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-[var(--text-muted)]">
                              Confidence: {Math.round(item.confidence * 100)}%
                            </span>
                            <span className="text-xs text-[var(--text-muted)]">
                              By: {item.userEmail}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-[var(--text-secondary)]">No feedback recorded yet</p>
                      <p className="text-sm text-[var(--text-muted)] mt-2">
                        Responses marked as "Not Useful" will appear here
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold mb-4">My Profile</h3>
                  
                  {profileLoading ? (
                    <div className="text-center py-8">
                      <div className="spinner mx-auto"></div>
                      <p className="text-[var(--text-secondary)] mt-2">Loading profile...</p>
                    </div>
                  ) : profileData ? (
                    <div className="space-y-6">
                      {/* Profile Information */}
                      <div className="bg-[var(--bg-tertiary)] rounded-lg p-6">
                        <h4 className="font-medium mb-4">Personal Information</h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                              Name
                            </label>
                            <input
                              type="text"
                              className="form-input w-full"
                              value={profileForm.name}
                              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                              placeholder="Your full name"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                              Email
                            </label>
                            <input
                              type="email"
                              className="form-input w-full"
                              value={profileForm.email}
                              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                              placeholder="Your email address"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                              Phone Number
                            </label>
                            <input
                              type="tel"
                              className="form-input w-full"
                              value={profileForm.phone}
                              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                              placeholder="+1 (902) 555-0101"
                            />
                          </div>
                          <div className="flex justify-between items-center pt-4">
                            <div>
                              <p className="text-sm text-[var(--text-secondary)]">Role: <span className="text-[var(--accent)]">{profileData.role}</span></p>
                              <p className="text-xs text-[var(--text-muted)]">Member since: {new Date(profileData.createdAt).toLocaleDateString()}</p>
                            </div>
                            <Button
                              onClick={handleUpdateProfile}
                              variant="primary"
                              size="sm"
                            >
                              <Save className="w-4 h-4 mr-2" />
                              Save Changes
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Password Change */}
                      <div className="bg-[var(--bg-tertiary)] rounded-lg p-6">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-medium">Security</h4>
                          {!changingPassword && (
                            <Button
                              onClick={() => setChangingPassword(true)}
                              variant="secondary"
                              size="sm"
                            >
                              Change Password
                            </Button>
                          )}
                        </div>
                        
                        {changingPassword ? (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                Current Password
                              </label>
                              <input
                                type="password"
                                className="form-input w-full"
                                value={passwordForm.currentPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                placeholder="Enter current password"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                New Password
                              </label>
                              <input
                                type="password"
                                className="form-input w-full"
                                value={passwordForm.newPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                placeholder="Enter new password (min 8 characters)"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                Confirm New Password
                              </label>
                              <input
                                type="password"
                                className="form-input w-full"
                                value={passwordForm.confirmPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                placeholder="Confirm new password"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={handleChangePassword}
                                variant="primary"
                                size="sm"
                              >
                                Update Password
                              </Button>
                              <Button
                                onClick={() => {
                                  setChangingPassword(false);
                                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                }}
                                variant="secondary"
                                size="sm"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-[var(--text-secondary)]">
                            Last password change: {profileData.updatedAt ? new Date(profileData.updatedAt).toLocaleDateString() : 'Never'}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-center py-8 text-[var(--text-secondary)]">Failed to load profile data</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
