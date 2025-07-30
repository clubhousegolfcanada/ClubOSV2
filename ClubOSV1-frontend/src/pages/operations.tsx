import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useAuthState, useStore } from '@/state/useStore';
import toast from 'react-hot-toast';
import axios from 'axios';
import { Download, AlertCircle, RefreshCw, Save, Upload, Trash2, Key, Eye, EyeOff, Settings, Bell, BarChart3, CheckSquare, Calendar, Clock, MapPin, Check, X, ChevronRight, Plus, Edit2, Brain, MessageSquare } from 'lucide-react';
import { FeedbackResponse } from '@/components/FeedbackResponse';
import { UserDebugCheck } from '@/components/UserDebugCheck';
import { KnowledgeRouterPanel } from '@/components/admin/KnowledgeRouterPanel';
import { OpenPhoneConversations } from '@/components/OpenPhoneConversations';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

type User = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'support' | 'kiosk';
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

// Cleaning types
interface ChecklistItem {
  id: string;
  task: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  lastCompleted?: string;
  completedBy?: string;
  notes?: string;
}

interface Checklist {
  id: string;
  name: string;
  location: string;
  category: 'opening' | 'closing' | 'daily' | 'weekly' | 'monthly' | 'deep-clean';
  items: ChecklistItem[];
  lastUpdated: string;
}

// Sample cleaning data
const sampleChecklists: Checklist[] = [
  {
    id: '1',
    name: 'Opening Checklist',
    location: 'All Locations',
    category: 'opening',
    lastUpdated: new Date().toISOString(),
    items: [
      { id: '1-1', task: 'Turn on all simulator computers', frequency: 'daily' },
      { id: '1-2', task: 'Check and clean hitting mats', frequency: 'daily' },
      { id: '1-3', task: 'Verify all projectors are working', frequency: 'daily' },
      { id: '1-4', task: 'Stock golf balls in dispensers', frequency: 'daily' },
      { id: '1-5', task: 'Turn on music system', frequency: 'daily' },
      { id: '1-6', task: 'Check and restock beverages', frequency: 'daily' },
      { id: '1-7', task: 'Clean and sanitize high-touch surfaces', frequency: 'daily' },
      { id: '1-8', task: 'Verify POS system is operational', frequency: 'daily' }
    ]
  },
  {
    id: '2',
    name: 'Closing Checklist',
    location: 'All Locations',
    category: 'closing',
    lastUpdated: new Date().toISOString(),
    items: [
      { id: '2-1', task: 'Shut down all simulator computers', frequency: 'daily' },
      { id: '2-2', task: 'Clean and vacuum hitting areas', frequency: 'daily' },
      { id: '2-3', task: 'Empty trash bins', frequency: 'daily' },
      { id: '2-4', task: 'Wipe down all surfaces', frequency: 'daily' },
      { id: '2-5', task: 'Check and lock all doors', frequency: 'daily' },
      { id: '2-6', task: 'Turn off all displays and projectors', frequency: 'daily' },
      { id: '2-7', task: 'Set security system', frequency: 'daily' },
      { id: '2-8', task: 'Complete cash reconciliation', frequency: 'daily' }
    ]
  },
  {
    id: '3',
    name: 'Weekly Deep Clean',
    location: 'All Locations',
    category: 'weekly',
    lastUpdated: new Date().toISOString(),
    items: [
      { id: '3-1', task: 'Deep clean simulator screens', frequency: 'weekly' },
      { id: '3-2', task: 'Vacuum and shampoo hitting mats', frequency: 'weekly' },
      { id: '3-3', task: 'Clean air vents and filters', frequency: 'weekly' },
      { id: '3-4', task: 'Sanitize golf clubs and equipment', frequency: 'weekly' },
      { id: '3-5', task: 'Clean windows and glass surfaces', frequency: 'weekly' },
      { id: '3-6', task: 'Restock cleaning supplies', frequency: 'weekly' },
      { id: '3-7', task: 'Check and clean projector lenses', frequency: 'weekly' }
    ]
  }
];

const cleaningCategoryConfig = {
  opening: {
    label: 'Opening',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    icon: Clock
  },
  closing: {
    label: 'Closing',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    icon: Clock
  },
  daily: {
    label: 'Daily',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    icon: Calendar
  },
  weekly: {
    label: 'Weekly',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    icon: Calendar
  },
  monthly: {
    label: 'Monthly',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    icon: Calendar
  },
  'deep-clean': {
    label: 'Deep Clean',
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    icon: RefreshCw
  }
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
    role: 'operator' as 'admin' | 'operator' | 'support' | 'kiosk',
    phone: ''
  });
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    role: 'admin' | 'operator' | 'support' | 'kiosk';
  }>({
    name: '',
    email: '',
    phone: '',
    role: 'operator'
  });
  const [feedback, setFeedback] = useState<any[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [showFeedbackSection, setShowFeedbackSection] = useState(false);
  const [showSystemConfig, setShowSystemConfig] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [systemConfigs, setSystemConfigs] = useState<any>({});
  const [systemMetrics, setSystemMetrics] = useState<any>({ total_documents: 0, unique_assistants: 0 });
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  
  // Cleaning state
  const [cleaningActiveTab, setCleaningActiveTab] = useState<'checklists' | 'schedule'>('checklists');
  const [selectedCleaningCategory, setSelectedCleaningCategory] = useState<string>('all');
  const [selectedCleaningLocation, setSelectedCleaningLocation] = useState<string>('all');
  const [activeChecklist, setActiveChecklist] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});
  const [isCleaningEditMode, setIsCleaningEditMode] = useState(false);
  const [checklists, setChecklists] = useState<Checklist[]>(sampleChecklists);
  
  // Password change modal states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Password validation state
  const [passwordValidation, setPasswordValidation] = useState<PasswordValidation>({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false
  });

  // Fetch users and feedback on mount
  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
      if (showKnowledge) {
        fetchFeedback();
        fetchSystemMetrics();
      }
      if (showSystemConfig) {
        fetchSystemConfigs();
      }
      if (showAnalytics) {
        fetchAnalytics();
      }
    }
  }, [user, showKnowledge, showSystemConfig, showAnalytics]);

  // Validate password whenever it changes
  useEffect(() => {
    const password = formData.password || passwordData.newPassword;
    setPasswordValidation({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password)
    });
  }, [formData.password, passwordData.newPassword]);

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

  const fetchSystemMetrics = async () => {
    // SOP monitoring is deprecated - using static metrics for now
    // TODO: Replace with new knowledge system metrics
    setSystemMetrics({
      total_documents: 0,
      unique_assistants: 4 // Emergency, Booking, Tech, Brand
    });
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

  const clearFeedback = async () => {
    if (!confirm('Are you sure you want to clear all feedback? This action cannot be undone.')) return;
    
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.delete(`${API_URL}/feedback/clear`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success('Feedback cleared successfully');
        setFeedback([]);
      }
    } catch (error) {
      console.error('Failed to clear feedback:', error);
      toast.error('Failed to clear feedback');
    }
  };

  const fetchSystemConfigs = async () => {
    try {
      setConfigLoading(true);
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/system-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setSystemConfigs(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch system configs:', error);
      toast.error('Failed to load system configurations');
    } finally {
      setConfigLoading(false);
    }
  };

  const updateSystemConfig = async (key: string, value: any) => {
    try {
      setConfigSaving(true);
      const token = localStorage.getItem('clubos_token');
      const response = await axios.put(`${API_URL}/system-config/${key}`, 
        { value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        toast.success('Configuration updated successfully');
        // Update local state
        setSystemConfigs((prev: any) => ({
          ...prev,
          [key]: {
            ...prev[key],
            value
          }
        }));
      }
    } catch (error) {
      console.error('Failed to update system config:', error);
      toast.error('Failed to update configuration');
    } finally {
      setConfigSaving(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const token = localStorage.getItem('clubos_token');
      
      // Fetch multiple analytics endpoints
      const [routingResponse, feedbackResponse, accuracyResponse] = await Promise.all([
        axios.get(`${API_URL}/analytics/routing`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/analytics/feedback`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/analytics/routing-accuracy`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setAnalyticsData({
        routing: routingResponse.data.data,
        feedback: feedbackResponse.data.data,
        accuracy: accuracyResponse.data.data
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const createBackup = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/backup/export`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob' // Important: handle binary response
      });
      
      // Create a blob from the response
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from Content-Disposition header if available
      const contentDisposition = response.headers['content-disposition'];
      let filename = `clubos_backup_${new Date().toISOString().split('T')[0]}.sql`;
      if (contentDisposition) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Backup created successfully');
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
        if (false) {
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
    
    // Validate password requirements
    if (!passwordValidation.minLength || !passwordValidation.hasUppercase || 
        !passwordValidation.hasLowercase || !passwordValidation.hasNumber) {
      toast.error('Password does not meet all requirements');
      return;
    }
    
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
      } else if (error.response?.status === 409) {
        toast.error('A user with this email already exists');
      } else if (error.response?.status === 400) {
        // Validation error - show specific message
        const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Validation failed';
        console.log('Validation error details:', error.response?.data);
        
        // Parse validation errors if they exist
        if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
          const errors = error.response.data.errors.map((err: any) => err.msg).join(', ');
          toast.error(`Validation errors: ${errors}`);
        } else {
          toast.error(`Validation error: ${errorMessage}`);
        }
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
        if (response.data.message) {
          toast.success(response.data.message);
        } else {
          toast.success('User updated successfully');
        }
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

  const openPasswordModal = (userId: string) => {
    setPasswordUserId(userId);
    setShowPasswordModal(true);
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordUserId(null);
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    
    // Validate password requirements
    if (!passwordValidation.minLength || !passwordValidation.hasUppercase || 
        !passwordValidation.hasLowercase || !passwordValidation.hasNumber) {
      toast.error('New password does not meet all requirements');
      return;
    }
    
    try {
      setIsLoading(true);
      const token = localStorage.getItem('clubos_token');
      
      // If changing own password
      if (passwordUserId === user?.id) {
        const response = await axios.post(`${API_URL}/auth/change-password`, {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.success) {
          toast.success('Password changed successfully');
          closePasswordModal();
        }
      } else {
        // Admin resetting another user's password
        const response = await axios.post(`${API_URL}/auth/users/${passwordUserId}/reset-password`, {
          newPassword: passwordData.newPassword
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.success) {
          toast.success('User password reset successfully');
          closePasswordModal();
        }
      }
    } catch (error: any) {
      console.error('Failed to change password:', error);
      if (error.response?.status === 401) {
        toast.error('Current password is incorrect');
      } else {
        toast.error(error.response?.data?.message || 'Failed to change password');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const roleColors = {
    admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    operator: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    support: 'bg-green-500/20 text-green-400 border-green-500/30',
    kiosk: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
  };

  // Cleaning functions
  const handleTaskToggle = (taskId: string) => {
    setCompletedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const handleCompleteChecklist = (checklistId: string) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;

    const completedCount = checklist.items.filter(item => completedTasks[item.id]).length;
    const totalCount = checklist.items.length;

    if (completedCount === totalCount) {
      toast.success(`${checklist.name} completed!`);
      // Reset completed tasks for this checklist
      const resetTasks = { ...completedTasks };
      checklist.items.forEach(item => {
        delete resetTasks[item.id];
      });
      setCompletedTasks(resetTasks);
      setActiveChecklist(null);
    } else {
      toast.error(`Please complete all tasks (${completedCount}/${totalCount} done)`);
    }
  };

  const handleResetChecklist = (checklistId: string) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;

    const resetTasks = { ...completedTasks };
    checklist.items.forEach(item => {
      delete resetTasks[item.id];
    });
    setCompletedTasks(resetTasks);
    toast.success('Checklist reset');
  };

  const handleKnowledgeExport = async () => {
    try {
      setExportLoading(true);
      const token = localStorage.getItem('clubos_token');
      
      const response = await axios.get(`${API_URL}/knowledge/export`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        // Create a blob from the data
        const exportData = response.data.data;
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = response.data.filename || `clubos-knowledge-export-${new Date().toISOString().split('T')[0]}.json`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success(`Export complete! ${exportData.metrics.totalDocuments} documents, ${exportData.metrics.totalKnowledge} knowledge entries exported.`);
      } else {
        toast.error('Export failed: ' + (response.data.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Knowledge export error:', error);
      toast.error('Failed to export knowledge: ' + (error.response?.data?.error || error.message));
    } finally {
      setExportLoading(false);
    }
  };

  // Filter checklists
  const filteredChecklists = checklists.filter(checklist => {
    const matchesCategory = selectedCleaningCategory === 'all' || checklist.category === selectedCleaningCategory;
    const matchesLocation = selectedCleaningLocation === 'all' || checklist.location === selectedCleaningLocation;
    return matchesCategory && matchesLocation;
  });

  const renderCleaningContent = () => {
    return (
      <>
        {/* Cleaning Tab Navigation */}
        <div className="flex items-center gap-6 mb-6">
          <button
            onClick={() => setCleaningActiveTab('checklists')}
            className={`text-lg font-semibold transition-all relative pb-1 ${
              cleaningActiveTab === 'checklists' 
                ? 'text-[var(--text-primary)]' 
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            Checklists
            {cleaningActiveTab === 'checklists' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]"></div>
            )}
          </button>
          <button
            onClick={() => setCleaningActiveTab('schedule')}
            className={`text-lg font-semibold transition-all relative pb-1 ${
              cleaningActiveTab === 'schedule' 
                ? 'text-[var(--text-primary)]' 
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            Schedule
            {cleaningActiveTab === 'schedule' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]"></div>
            )}
          </button>
        </div>

        {cleaningActiveTab === 'checklists' ? (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-8">
              {/* Category Filter */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCleaningCategory('all')}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    selectedCleaningCategory === 'all'
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  All Categories
                </button>
                {Object.entries(cleaningCategoryConfig).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedCleaningCategory(key)}
                    className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                      selectedCleaningCategory === key
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    {config.label}
                  </button>
                ))}
              </div>

              {/* Location Filter */}
              <select
                value={selectedCleaningLocation}
                onChange={(e) => setSelectedCleaningLocation(e.target.value)}
                className="px-3 sm:px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg text-xs sm:text-sm focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="all">All Locations</option>
                <option value="All Locations">All Locations</option>
                <option value="Bedford">Bedford</option>
                <option value="Dartmouth">Dartmouth</option>
                <option value="Stratford">Stratford</option>
                <option value="Truro">Truro</option>
                <option value="Bayers Lake">Bayers Lake</option>
              </select>

              {/* Edit Mode Toggle */}
              <button
                onClick={() => setIsCleaningEditMode(!isCleaningEditMode)}
                className={`ml-auto px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  isCleaningEditMode
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <Edit2 className="w-4 h-4" />
                {isCleaningEditMode ? 'Done Editing' : 'Edit Mode'}
              </button>
            </div>

            {/* Checklists Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredChecklists.map((checklist) => {
                const config = cleaningCategoryConfig[checklist.category];
                const Icon = config.icon;
                const isActive = activeChecklist === checklist.id;
                const completedCount = checklist.items.filter(item => completedTasks[item.id]).length;
                const progress = (completedCount / checklist.items.length) * 100;
                
                return (
                  <div
                    key={checklist.id}
                    className={`bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-xl p-4 sm:p-6 mb-4 transition-all ${
                      isActive ? 'ring-2 ring-[var(--accent)]' : ''
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-1">
                          {checklist.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                          <MapPin className="w-3 h-3" />
                          {checklist.location}
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color} ${config.borderColor} border`}>
                        <Icon className="w-3 h-3" />
                        {config.label}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    {isActive && (
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                          <span>Progress</span>
                          <span>{completedCount}/{checklist.items.length}</span>
                        </div>
                        <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2">
                          <div 
                            className="bg-[var(--accent)] h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Task List (Expanded) */}
                    {isActive && (
                      <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                        {checklist.items.map((item) => (
                          <label
                            key={item.id}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={completedTasks[item.id] || false}
                              onChange={() => handleTaskToggle(item.id)}
                              className="w-4 h-4 text-[var(--accent)] rounded border-[var(--border-secondary)] focus:ring-[var(--accent)]"
                            />
                            <span className={`text-sm ${
                              completedTasks[item.id] 
                                ? 'line-through text-[var(--text-muted)]' 
                                : 'text-[var(--text-primary)]'
                            }`}>
                              {item.task}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {!isActive ? (
                        <button
                          onClick={() => setActiveChecklist(checklist.id)}
                          className="flex-1 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckSquare className="w-4 h-4" />
                          Start Checklist
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleCompleteChecklist(checklist.id)}
                            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                          >
                            <Check className="w-4 h-4" />
                            Complete
                          </button>
                          <button
                            onClick={() => handleResetChecklist(checklist.id)}
                            className="px-2 py-1.5 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-md hover:bg-[var(--bg-tertiary)] transition-colors"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setActiveChecklist(null)}
                            className="px-2 py-1.5 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-md hover:bg-[var(--bg-tertiary)] transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Edit Actions */}
                    {isCleaningEditMode && (
                      <div className="mt-2 pt-2 border-t border-[var(--border-secondary)] flex gap-2">
                        <button className="flex-1 px-3 py-1.5 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded text-sm hover:bg-[var(--bg-tertiary)] transition-colors flex items-center justify-center gap-1">
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </button>
                        <button className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded text-sm hover:bg-red-500/30 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add New Checklist Card */}
              {isCleaningEditMode && (
                <button className="bg-[var(--bg-secondary)] border-2 border-dashed border-[var(--border-secondary)] rounded-lg p-3 hover:border-[var(--accent)] hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-2 min-h-[150px]">
                  <Plus className="w-6 h-6 text-[var(--text-muted)]" />
                  <span className="text-xs text-[var(--text-secondary)]">Add New Checklist</span>
                </button>
              )}
                </div>
              
              {/* Sidebar - Quick Stats & History (4 columns) */}
              <div className="lg:col-span-4 space-y-4">
                {/* Submission History - Compact */}
                <div className="card p-4 hover:shadow-lg transition-shadow duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[var(--accent)]" />
                      Recent Submissions
                    </h3>
                    <span className="text-xs text-[var(--text-muted)]">Last 7 days</span>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                    <div className="text-xs text-[var(--text-muted)] text-center py-4">
                      No recent submissions
                    </div>
                  </div>
                </div>
                
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-3 hover:bg-[var(--bg-tertiary)] hover:scale-105 transition-all duration-200 cursor-pointer">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[var(--text-muted)]">Today</span>
                      <CheckSquare className="w-3.5 h-3.5 text-[var(--accent)]" />
                    </div>
                    <p className="text-xl font-bold">0</p>
                    <p className="text-xs text-[var(--text-secondary)]">Completed</p>
                  </div>
                  
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-3 hover:bg-[var(--bg-tertiary)] hover:scale-105 transition-all duration-200 cursor-pointer">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[var(--text-muted)]">This Week</span>
                      <BarChart3 className="w-3.5 h-3.5 text-green-400" />
                    </div>
                    <p className="text-xl font-bold">0</p>
                    <p className="text-xs text-[var(--text-secondary)]">Total</p>
                  </div>
                </div>
                
                {/* Active Location Stats */}
                <div className="card p-4 hover:shadow-lg transition-shadow duration-200">
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[var(--accent)]" />
                    By Location
                  </h3>
                  <div className="space-y-2">
                    {['Bedford', 'Dartmouth', 'Stratford', 'Truro', 'Bayers Lake'].map(location => (
                      <div key={location} className="flex justify-between items-center text-xs">
                        <span className="text-[var(--text-secondary)]">{location}</span>
                        <span className="font-medium">0</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
          </>
        ) : (
          <>
            {/* Schedule Tab */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Cleaning Schedule</h2>
              <div className="text-[var(--text-secondary)]">
                <p>Schedule view coming soon...</p>
                <p className="text-sm mt-2">This will show a calendar view of scheduled cleaning tasks across all locations.</p>
              </div>
            </div>
          </>
        )}
      </>
    );
  };

  const PasswordStrengthIndicator = ({ validation, showRequirements = false }: { validation: PasswordValidation, showRequirements?: boolean }) => {
    const requirements = [
      { met: validation.minLength, text: 'At least 8 characters' },
      { met: validation.hasUppercase, text: 'One uppercase letter' },
      { met: validation.hasLowercase, text: 'One lowercase letter' },
      { met: validation.hasNumber, text: 'One number' }
    ];
    
    const strength = requirements.filter(r => r.met).length;
    const strengthLabel = strength === 0 ? 'Weak' : strength <= 2 ? 'Fair' : strength === 3 ? 'Good' : 'Strong';
    const strengthColor = strength === 0 ? 'bg-red-500' : strength <= 2 ? 'bg-yellow-500' : strength === 3 ? 'bg-blue-500' : 'bg-green-500';
    
    return (
      <div className="mt-2">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${strengthColor}`}
              style={{ width: `${(strength / 4) * 100}%` }}
            />
          </div>
          <span className="text-xs text-[var(--text-secondary)]">{strengthLabel}</span>
        </div>
        {showRequirements && (
          <ul className="text-xs space-y-1 mt-2">
            {requirements.map((req, idx) => (
              <li key={idx} className={`flex items-center gap-1 ${req.met ? 'text-green-400' : 'text-[var(--text-muted)]'}`}>
                <span>{req.met ? '✓' : '○'}</span>
                {req.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>ClubOS - Operations</title>
        <meta name="description" content="Manage users and operations" />
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <div className="mb-8">
            <div className="flex flex-wrap items-center gap-4 md:gap-6 mb-6">
              <button
                onClick={() => { setShowSystemConfig(false); setShowAnalytics(false); setShowKnowledge(false); }}
                className={`text-xl md:text-2xl font-semibold transition-all relative pb-1 ${
                  !showSystemConfig && !showAnalytics && !showKnowledge
                    ? 'text-[var(--text-primary)]' 
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                Settings
                {!showSystemConfig && !showAnalytics && !showKnowledge && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]"></div>
                )}
              </button>
              {user?.role === 'admin' && (
                <button
                  onClick={() => { setShowSystemConfig(false); setShowAnalytics(false); setShowKnowledge(true); }}
                  className={`text-xl md:text-2xl font-semibold transition-all relative pb-1 ${
                    showKnowledge 
                      ? 'text-[var(--text-primary)]' 
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  Knowledge
                  {showKnowledge && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]"></div>
                  )}
                </button>
              )}
            </div>
            
            <p className="text-[var(--text-secondary)] text-sm font-light max-w-3xl">
              {showKnowledge
                ? 'Manage AI knowledge extraction, feedback, and SOP system.'
                : 'Manage system users, configurations, and analytics.'}
            </p>
          </div>

          {user?.role === 'admin' ? (
            <>
              {showKnowledge ? (
                <>
                  {/* Knowledge Center - Compressed Dashboard Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                    {/* Main Content Area */}
                    <div className="lg:col-span-9">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                        {/* Full Width Panel - Knowledge Management (12 columns) */}
                        <div className="lg:col-span-12 space-y-3">
                          <div className="bg-[var(--bg-secondary)] rounded-lg">
                            <div className="p-3 border-b border-[var(--border-primary)]">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                                  <Brain className="w-4 h-4 text-[var(--accent)]" />
                                  Knowledge Management
                                </h3>
                                <div className="flex items-center gap-1">
                                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                                  <span className="text-[10px] text-[var(--text-muted)]">Live</span>
                                </div>
                              </div>
                            </div>
                            <div className="p-3">
                              <KnowledgeRouterPanel />
                            </div>
                          </div>

                          {/* Feedback Analysis - Collapsible */}
                          <div className="bg-[var(--bg-secondary)] rounded-lg">
                            <button
                              onClick={() => setShowFeedbackSection(!showFeedbackSection)}
                              className="w-full p-3 flex items-center justify-between hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                            >
                              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 text-[var(--accent)]" />
                                Not Helpful Feedback
                                {feedback.length > 0 && (
                                  <span className="ml-2 px-1.5 py-0.5 text-[9px] bg-red-500/20 text-red-400 rounded-full">
                                    {feedback.length}
                                  </span>
                                )}
                              </h3>
                              <ChevronRight className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${showFeedbackSection ? 'rotate-90' : ''}`} />
                            </button>
                            
                            {showFeedbackSection && (
                              <div className="px-3 pb-3">
                                <div className="flex gap-1 mb-2">
                                  <button
                                    onClick={fetchFeedback}
                                    disabled={feedbackLoading}
                                    className="px-2 py-1 text-[10px] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-1"
                                  >
                                    <RefreshCw className={`w-3 h-3 ${feedbackLoading ? 'animate-spin' : ''}`} />
                                    <span className="hidden sm:inline">Refresh</span>
                                  </button>
                                  <button
                                    onClick={exportFeedback}
                                    disabled={feedback.length === 0}
                                    className="px-2 py-1 text-[10px] bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
                                  >
                                    <Download className="w-3 h-3" />
                                    Export
                                  </button>
                                  <button
                                    onClick={clearFeedback}
                                    disabled={feedback.length === 0}
                                    className="px-2 py-1 text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors disabled:opacity-50"
                                    title="Clear all feedback"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                                
                                {/* Feedback Content - Ultra Compact */}
                                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                  {feedbackLoading ? (
                                    <div className="flex items-center justify-center py-6">
                                      <RefreshCw className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
                                      <span className="ml-1 text-xs text-[var(--text-muted)]">Loading...</span>
                                    </div>
                                  ) : feedback.length > 0 ? (
                                    <div className="space-y-2">
                                      {feedback.map((item) => (
                                        <div key={item.id} className="bg-[var(--bg-primary)] rounded p-2 hover:bg-[var(--bg-tertiary)] transition-colors">
                                          <div className="flex justify-between items-start mb-1">
                                            <div className="flex-1">
                                              <p className="text-xs font-medium truncate">{item.query}</p>
                                              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{item.feedback}</p>
                                            </div>
                                            <span className="text-[10px] text-[var(--text-muted)] ml-2">
                                              {new Date(item.timestamp).toLocaleDateString()}
                                            </span>
                                          </div>
                                          <div className="mt-1">
                                            <FeedbackResponse responseData={item.response} />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-center py-6">
                                      <AlertCircle className="w-6 h-6 mx-auto mb-1 opacity-30" />
                                      <p className="text-xs text-[var(--text-muted)]">No feedback entries yet</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Sidebar - Status Panel (3 columns) */}
                    <div className="lg:col-span-3 space-y-3">
                      {/* Recent Messages - Compact Sidebar */}
                      <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-[var(--accent)]" />
                            Recent Messages
                          </h3>
                          <div className="flex items-center gap-1">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin text-[var(--accent)]" />
                            <span className="text-[10px] text-[var(--text-muted)]">Live</span>
                          </div>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                          <OpenPhoneConversations />
                        </div>
                      </div>
                      
                      {/* Quick Stats - Inline Metrics */}
                      <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">System Metrics</h3>
                          <button
                            onClick={fetchSystemMetrics}
                            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                            title="Refresh metrics"
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                              <Brain className="w-3 h-3 text-[var(--accent)]" />
                              Documents
                            </span>
                            <span className="text-sm font-semibold">{systemMetrics.total_documents}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                              <CheckSquare className="w-3 h-3 text-green-500" />
                              Assistants
                            </span>
                            <span className="text-sm font-semibold">{systemMetrics.unique_assistants}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Export Knowledge Button */}
                      <div>
                        <button
                          onClick={handleKnowledgeExport}
                          disabled={exportLoading}
                          className="w-full px-3 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors flex items-center justify-center gap-1.5 text-xs font-medium disabled:opacity-50"
                        >
                          {exportLoading ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Exporting...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              Export All Knowledge
                            </>
                          )}
                        </button>
                        <p className="text-xs text-[var(--text-muted)] mt-2 text-center">
                          Download complete backup of SOP & AI data
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <style jsx>{`
                    .custom-scrollbar::-webkit-scrollbar {
                      width: 6px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                      background: var(--bg-secondary);
                      border-radius: 3px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                      background: var(--border-secondary);
                      border-radius: 3px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                      background: var(--text-muted);
                    }
                  `}</style>
                </>
              ) : (
                <>
                  {/* Settings Tab Navigation */}
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                <div className="flex flex-wrap gap-2 md:gap-4">
                  <button
                    onClick={() => { setShowSystemConfig(false); setShowAnalytics(true); }}
                    className={`px-3 py-2 text-sm md:px-4 md:text-base rounded-lg font-medium transition-all flex items-center gap-2 ${
                      showAnalytics
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span className="hidden sm:inline">Analytics</span>
                    <span className="sm:hidden">Stats</span>
                  </button>
                  <button
                    onClick={() => { setShowSystemConfig(true); setShowAnalytics(false); }}
                    className={`px-3 py-2 text-sm md:px-4 md:text-base rounded-lg font-medium transition-all flex items-center gap-2 ${
                      showSystemConfig
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span className="hidden sm:inline">System Config</span>
                    <span className="sm:hidden">Config</span>
                  </button>
                  <button
                    onClick={() => { setShowSystemConfig(false); setShowAnalytics(false); }}
                    className={`px-3 py-2 text-sm md:px-4 md:text-base rounded-lg font-medium transition-all ${
                      !showSystemConfig && !showAnalytics
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span className="hidden sm:inline">User Management</span>
                    <span className="sm:hidden">Users</span>
                  </button>
                </div>
                
                {/* Backup/Restore buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={createBackup}
                    className="px-3 py-2 text-sm md:text-base bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2"
                    title="Create backup of all data"
                  >
                    <Save className="w-4 h-4" />
                    <span className="hidden sm:inline">Backup</span>
                  </button>
                  <label className="px-3 py-2 text-sm md:text-base bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2 cursor-pointer"
                     title="Restore from backup file">
                    <Upload className="w-4 h-4" />
                    <span className="hidden sm:inline">Restore</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {!showSystemConfig && !showAnalytics ? (
                <>
                  {/* User Management Section */}
                  <div className="space-y-6">
                    {/* Database Status Check */}
                    <UserDebugCheck />
                    
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
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium mb-2">Password</label>
                            <input
                              type="password"
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg"
                              required
                            />
                            <PasswordStrengthIndicator validation={passwordValidation} showRequirements={true} />
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
                              <option value="kiosk">Kiosk (ClubOS Boy Only)</option>
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
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                      <table className="w-full min-w-[640px]">
                        <thead>
                          <tr className="border-b border-[var(--border-secondary)]">
                            <th className="text-left py-3 px-4 text-sm">Name</th>
                            <th className="text-left py-3 px-4 text-sm">Email</th>
                            <th className="text-left py-3 px-4 text-sm">Role</th>
                            <th className="text-left py-3 px-4 text-sm hidden sm:table-cell">Phone</th>
                            <th className="text-left py-3 px-4 text-sm hidden md:table-cell">Created</th>
                            <th className="text-right py-3 px-4 text-sm">Actions</th>
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
                                {editingUser === u.id ? (
                                  <select
                                    value={editFormData.role}
                                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as User['role'] })}
                                    className="px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded text-sm"
                                    disabled={u.id === user?.id} // Prevent changing own role
                                  >
                                    {user?.role === 'admin' && (
                                      <option value="admin">Admin</option>
                                    )}
                                    <option value="operator">Operator</option>
                                    <option value="support">Support</option>
                                    <option value="kiosk">Kiosk</option>
                                  </select>
                                ) : (
                                  <span className={`px-2 py-1 text-xs rounded-full border ${roleColors[u.role]}`}>
                                    {u.role}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 hidden sm:table-cell">
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
                              <td className="py-3 px-4 text-sm text-[var(--text-secondary)] hidden md:table-cell">
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
                                  <div className="flex items-center justify-end gap-1 sm:gap-3">
                                    <button
                                      onClick={() => startEditUser(u)}
                                      className="text-blue-400 hover:text-blue-300 text-sm"
                                      disabled={u.id === user?.id}
                                      title="Edit user"
                                    >
                                      <span className="hidden sm:inline">Edit</span>
                                      <Edit2 className="w-4 h-4 sm:hidden" />
                                    </button>
                                    <button
                                      onClick={() => openPasswordModal(u.id)}
                                      className="text-yellow-400 hover:text-yellow-300 text-sm"
                                      title={u.id === user?.id ? "Change password" : "Reset password"}
                                    >
                                      <span className="hidden sm:inline">Password</span>
                                      <Key className="w-4 h-4 sm:hidden" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(u.id)}
                                      className="text-red-400 hover:text-red-300 text-sm"
                                      disabled={u.id === user?.id}
                                      title="Delete user"
                                    >
                                      <span className="hidden sm:inline">Delete</span>
                                      <Trash2 className="w-4 h-4 sm:hidden" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  </div>
                </>
              ) : showSystemConfig ? (
                <>
                  {/* System Configuration Section */}
                  <div className="card">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h2 className="text-xl font-semibold">System Configuration</h2>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">
                          Configure system-wide settings and features
                        </p>
                      </div>
                      <button
                        onClick={fetchSystemConfigs}
                        disabled={configLoading}
                        className="px-4 py-2 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2"
                      >
                        <RefreshCw className={`w-4 h-4 ${configLoading ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    </div>

                    {configLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)] mx-auto"></div>
                        <p className="text-[var(--text-secondary)] mt-4">Loading configurations...</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Slack Notifications */}
                        {systemConfigs.slack_notifications && (
                          <div className="bg-[var(--bg-secondary)] rounded-lg p-6">
                            <div className="flex items-center gap-2 mb-4">
                              <Bell className="w-5 h-5 text-[var(--accent)]" />
                              <h3 className="text-lg font-semibold">Slack Notifications</h3>
                            </div>
                            <div className="space-y-4">
                              <label className="flex items-center justify-between">
                                <span className="text-sm">Enable Slack notifications</span>
                                <input
                                  type="checkbox"
                                  checked={systemConfigs.slack_notifications.value.enabled}
                                  onChange={(e) => updateSystemConfig('slack_notifications', {
                                    ...systemConfigs.slack_notifications.value,
                                    enabled: e.target.checked
                                  })}
                                  className="toggle-checkbox"
                                />
                              </label>
                              <label className="flex items-center justify-between">
                                <span className="text-sm">Send on LLM success</span>
                                <input
                                  type="checkbox"
                                  checked={systemConfigs.slack_notifications.value.sendOnLLMSuccess}
                                  onChange={(e) => updateSystemConfig('slack_notifications', {
                                    ...systemConfigs.slack_notifications.value,
                                    sendOnLLMSuccess: e.target.checked
                                  })}
                                  className="toggle-checkbox"
                                  disabled={!systemConfigs.slack_notifications.value.enabled}
                                />
                              </label>
                              <label className="flex items-center justify-between">
                                <span className="text-sm">Send on LLM failure</span>
                                <input
                                  type="checkbox"
                                  checked={systemConfigs.slack_notifications.value.sendOnLLMFailure}
                                  onChange={(e) => updateSystemConfig('slack_notifications', {
                                    ...systemConfigs.slack_notifications.value,
                                    sendOnLLMFailure: e.target.checked
                                  })}
                                  className="toggle-checkbox"
                                  disabled={!systemConfigs.slack_notifications.value.enabled}
                                />
                              </label>
                              <label className="flex items-center justify-between">
                                <span className="text-sm">Send direct requests</span>
                                <input
                                  type="checkbox"
                                  checked={systemConfigs.slack_notifications.value.sendDirectRequests}
                                  onChange={(e) => updateSystemConfig('slack_notifications', {
                                    ...systemConfigs.slack_notifications.value,
                                    sendDirectRequests: e.target.checked
                                  })}
                                  className="toggle-checkbox"
                                  disabled={!systemConfigs.slack_notifications.value.enabled}
                                />
                              </label>
                              <label className="flex items-center justify-between">
                                <span className="text-sm">Send tickets</span>
                                <input
                                  type="checkbox"
                                  checked={systemConfigs.slack_notifications.value.sendTickets}
                                  onChange={(e) => updateSystemConfig('slack_notifications', {
                                    ...systemConfigs.slack_notifications.value,
                                    sendTickets: e.target.checked
                                  })}
                                  className="toggle-checkbox"
                                  disabled={!systemConfigs.slack_notifications.value.enabled}
                                />
                              </label>
                              <label className="flex items-center justify-between">
                                <span className="text-sm">Send unhelpful feedback</span>
                                <input
                                  type="checkbox"
                                  checked={systemConfigs.slack_notifications.value.sendUnhelpfulFeedback}
                                  onChange={(e) => updateSystemConfig('slack_notifications', {
                                    ...systemConfigs.slack_notifications.value,
                                    sendUnhelpfulFeedback: e.target.checked
                                  })}
                                  className="toggle-checkbox"
                                  disabled={!systemConfigs.slack_notifications.value.enabled}
                                />
                              </label>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-4">
                              Last updated: {new Date(systemConfigs.slack_notifications.updatedAt).toLocaleString()}
                            </p>
                          </div>
                        )}

                        {/* System Features */}
                        {systemConfigs.system_features && (
                          <div className="bg-[var(--bg-secondary)] rounded-lg p-6">
                            <div className="flex items-center gap-2 mb-4">
                              <Settings className="w-5 h-5 text-[var(--accent)]" />
                              <h3 className="text-lg font-semibold">System Features</h3>
                            </div>
                            <div className="space-y-4">
                              <label className="flex items-center justify-between">
                                <span className="text-sm">Smart Assist</span>
                                <input
                                  type="checkbox"
                                  checked={systemConfigs.system_features.value.smartAssist}
                                  onChange={(e) => updateSystemConfig('system_features', {
                                    ...systemConfigs.system_features.value,
                                    smartAssist: e.target.checked
                                  })}
                                  className="toggle-checkbox"
                                />
                              </label>
                              <label className="flex items-center justify-between">
                                <span className="text-sm">Bookings</span>
                                <input
                                  type="checkbox"
                                  checked={systemConfigs.system_features.value.bookings}
                                  onChange={(e) => updateSystemConfig('system_features', {
                                    ...systemConfigs.system_features.value,
                                    bookings: e.target.checked
                                  })}
                                  className="toggle-checkbox"
                                />
                              </label>
                              <label className="flex items-center justify-between">
                                <span className="text-sm">Tickets</span>
                                <input
                                  type="checkbox"
                                  checked={systemConfigs.system_features.value.tickets}
                                  onChange={(e) => updateSystemConfig('system_features', {
                                    ...systemConfigs.system_features.value,
                                    tickets: e.target.checked
                                  })}
                                  className="toggle-checkbox"
                                />
                              </label>
                              <label className="flex items-center justify-between">
                                <span className="text-sm">Slack Integration</span>
                                <input
                                  type="checkbox"
                                  checked={systemConfigs.system_features.value.slack}
                                  onChange={(e) => updateSystemConfig('system_features', {
                                    ...systemConfigs.system_features.value,
                                    slack: e.target.checked
                                  })}
                                  className="toggle-checkbox"
                                />
                              </label>
                              <label className="flex items-center justify-between">
                                <span className="text-sm">Customer Kiosk</span>
                                <input
                                  type="checkbox"
                                  checked={systemConfigs.system_features.value.customerKiosk}
                                  onChange={(e) => updateSystemConfig('system_features', {
                                    ...systemConfigs.system_features.value,
                                    customerKiosk: e.target.checked
                                  })}
                                  className="toggle-checkbox"
                                />
                              </label>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-4">
                              Last updated: {new Date(systemConfigs.system_features.updatedAt).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : showAnalytics ? (
                <>
                  {/* Analytics Section */}
                  <div className="card">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
                      <div>
                        <h2 className="text-xl font-semibold">Routing Analytics</h2>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">
                          Monitor routing performance and identify optimization opportunities
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={fetchAnalytics}
                          disabled={analyticsLoading}
                          className="px-3 py-2 text-sm sm:px-4 sm:text-base bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2"
                        >
                          <RefreshCw className={`w-4 h-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
                          <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('Clear analytics data older than 30 days? This will remove old customer interaction logs.')) {
                              try {
                                const token = localStorage.getItem('clubos_token');
                                const response = await axios.delete(`${API_URL}/analytics/clear-old-data?days=30`, {
                                  headers: { Authorization: `Bearer ${token}` }
                                });
                                if (response.data.success) {
                                  toast.success(`Cleared ${response.data.deletedCount} old records`);
                                  fetchAnalytics();
                                }
                              } catch (error) {
                                console.error('Failed to clear old data:', error);
                                toast.error('Failed to clear old data');
                              }
                            }
                          }}
                          className="px-3 py-2 text-sm sm:px-4 sm:text-base bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors flex items-center gap-2"
                          title="Clear old analytics data"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Clear Old Data</span>
                          <span className="sm:hidden">Clear</span>
                        </button>
                      </div>
                    </div>

                    {analyticsLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)] mx-auto"></div>
                        <p className="text-[var(--text-secondary)] mt-4">Loading analytics...</p>
                      </div>
                    ) : analyticsData ? (
                      <div className="space-y-8">
                        {/* Route Distribution */}
                        <div>
                          <h3 className="text-lg font-semibold mb-4">Route Distribution</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {analyticsData.routing?.routeDistribution?.map((route: any) => (
                              <div key={route.route} className="bg-[var(--bg-secondary)] rounded-lg p-4">
                                <h4 className="font-medium text-sm mb-2">{route.route}</h4>
                                <p className="text-2xl font-bold">{route.count}</p>
                                <p className="text-xs text-[var(--text-muted)] mt-1">
                                  Avg confidence: {Math.round(route.avg_confidence * 100)}%
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Low Confidence Requests */}
                        {analyticsData.routing?.lowConfidenceRequests?.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold mb-4">Low Confidence Requests</h3>
                            {/* Mobile Card View */}
                            <div className="block sm:hidden space-y-3">
                              {analyticsData.routing.lowConfidenceRequests.slice(0, 10).map((req: any) => (
                                <div key={req.id} className="bg-[var(--bg-secondary)] rounded-lg p-4 space-y-2">
                                  <p className="text-sm font-medium truncate">{req.request_text}</p>
                                  <div className="flex items-center justify-between">
                                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                                      req.route === 'Emergency' ? 'bg-red-500/20 text-red-400' :
                                      req.route === 'TechSupport' ? 'bg-blue-500/20 text-blue-400' :
                                      req.route === 'Booking & Access' ? 'bg-green-500/20 text-green-400' :
                                      'bg-purple-500/20 text-purple-400'
                                    }`}>
                                      {req.route}
                                    </span>
                                    <span className="text-sm">{Math.round(req.confidence * 100)}%</span>
                                  </div>
                                  <p className="text-xs text-[var(--text-muted)]">
                                    {new Date(req.createdAt).toLocaleString()}
                                  </p>
                                </div>
                              ))}
                            </div>
                            {/* Desktop Table View */}
                            <div className="hidden sm:block overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-[var(--border-secondary)]">
                                    <th className="text-left py-2 px-3">Request</th>
                                    <th className="text-left py-2 px-3">Route</th>
                                    <th className="text-left py-2 px-3">Confidence</th>
                                    <th className="text-left py-2 px-3">Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {analyticsData.routing.lowConfidenceRequests.slice(0, 10).map((req: any) => (
                                    <tr key={req.id} className="border-b border-[var(--border-secondary)]">
                                      <td className="py-2 px-3 max-w-xs truncate">{req.request_text}</td>
                                      <td className="py-2 px-3">
                                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                                          req.route === 'Emergency' ? 'bg-red-500/20 text-red-400' :
                                          req.route === 'TechSupport' ? 'bg-blue-500/20 text-blue-400' :
                                          req.route === 'Booking & Access' ? 'bg-green-500/20 text-green-400' :
                                          'bg-purple-500/20 text-purple-400'
                                        }`}>
                                          {req.route}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3">{Math.round(req.confidence * 100)}%</td>
                                      <td className="py-2 px-3 text-xs text-[var(--text-muted)]">
                                        {new Date(req.createdAt).toLocaleString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Feedback Analysis */}
                        {analyticsData.feedback && (
                          <div>
                            <h3 className="text-lg font-semibold mb-4">Feedback Performance by Route</h3>
                            <div className="space-y-3">
                              {analyticsData.feedback.feedbackByRoute?.map((route: any) => (
                                <div key={route.route} className="flex items-center justify-between bg-[var(--bg-secondary)] rounded-lg p-4">
                                  <div>
                                    <h4 className="font-medium">{route.route}</h4>
                                    <p className="text-sm text-[var(--text-muted)]">
                                      {route.total_feedback} total feedback
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-semibold">
                                      {route.unhelpful_percentage}%
                                    </p>
                                    <p className="text-xs text-[var(--text-muted)]">
                                      unhelpful rate
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Routing Accuracy Issues */}
                        {analyticsData.accuracy?.potentialMisroutes?.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold mb-4">Potential Routing Issues</h3>
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
                              <p className="text-sm text-yellow-400">
                                These patterns suggest requests may be routed incorrectly based on feedback analysis.
                              </p>
                            </div>
                            <div className="space-y-3">
                              {analyticsData.accuracy.potentialMisroutes.map((issue: any, idx: number) => (
                                <div key={idx} className="bg-[var(--bg-secondary)] rounded-lg p-4">
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <p className="text-sm">
                                        <span className="text-[var(--text-muted)]">Currently routed to:</span>{' '}
                                        <span className="font-medium">{issue.original_route}</span>
                                      </p>
                                      <p className="text-sm">
                                        <span className="text-[var(--text-muted)]">Should be routed to:</span>{' '}
                                        <span className="font-medium text-green-400">{issue.suggested_route}</span>
                                      </p>
                                    </div>
                                    <span className="text-sm font-semibold text-orange-400">
                                      {issue.mismatch_count} cases
                                    </span>
                                  </div>
                                  <div className="mt-2">
                                    <p className="text-xs text-[var(--text-muted)]">Example requests:</p>
                                    <ul className="mt-1 space-y-1">
                                      {issue.example_requests.slice(0, 2).map((req: string, i: number) => (
                                        <li key={i} className="text-xs text-[var(--text-secondary)] truncate">
                                          • {req}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recommendations */}
                        {analyticsData.accuracy?.recommendations?.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold mb-4">Optimization Recommendations</h3>
                            <div className="space-y-2">
                              {analyticsData.accuracy.recommendations.map((rec: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-2 bg-[var(--bg-secondary)] rounded-lg p-3">
                                  <span className="text-[var(--accent)] mt-0.5">•</span>
                                  <p className="text-sm">{rec}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-[var(--text-secondary)]">
                        <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No analytics data available</p>
                        <p className="text-sm mt-2">Click refresh to load routing analytics</p>
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              {/* System Status - Only show when not in specific views */}
              {!showSystemConfig && !showAnalytics && !showKnowledge && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-6">
                <div className="card">
                  <h3 className="text-lg font-semibold mb-4">System Status</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)] text-sm">API Status</span>
                      <span className="text-green-400 text-sm">Operational</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)] text-sm">Database</span>
                      <span className="text-green-400 text-sm">Connected</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)] text-sm">LLM Service</span>
                      <span className="text-green-400 text-sm">Active</span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)] text-sm">Total Users</span>
                      <span className="font-medium text-sm">{users.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)] text-sm">Not Helpful Feedback</span>
                      <span className="font-medium text-sm">{feedback.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)] text-sm">Active Sessions</span>
                      <span className="font-medium text-sm">0</span>
                    </div>
                  </div>
                </div>
              </div>
              )}
                </>
              )}
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

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-primary)] rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">
              {passwordUserId === user?.id ? 'Change Password' : 'Reset User Password'}
            </h3>
            {passwordUserId !== user?.id && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-yellow-400">
                  You are resetting the password for user: <strong>{users.find(u => u.id === passwordUserId)?.name}</strong>
                </p>
              </div>
            )}
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordUserId === user?.id && (
                <div>
                  <label className="block text-sm font-medium mb-2">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      className="w-full px-3 py-2 pr-10 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium mb-2">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full px-3 py-2 pr-10 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <PasswordStrengthIndicator validation={passwordValidation} showRequirements={true} />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 pr-10 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                  <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                )}
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  className="px-4 py-2 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
                  {isLoading ? 'Processing...' : (passwordUserId === user?.id ? 'Change Password' : 'Reset Password')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
