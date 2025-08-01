import React, { useState, useEffect } from 'react';
import { CheckSquare, Clock, Calendar, User, MapPin, ChevronRight, Check, Trash2, Edit2, X, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useAuthState } from '../state/useStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Task {
  id: string;
  label: string;
  originalLabel?: string;
  isCustomized?: boolean;
}

interface ChecklistTemplate {
  category: string;
  type: string;
  tasks: Task[];
}

interface Submission {
  id: string;
  category: string;
  type: string;
  location: string;
  total_tasks: number;
  completion_time: string;
  user_name: string;
  user_email: string;
  comments?: string;
  ticket_created?: boolean;
  ticket_id?: string;
}

export const ChecklistSystem: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'cleaning' | 'tech'>('cleaning');
  const [activeType, setActiveType] = useState<'daily' | 'weekly' | 'quarterly'>('daily');
  const [selectedLocation, setSelectedLocation] = useState('Bedford');
  const [currentTemplate, setCurrentTemplate] = useState<ChecklistTemplate | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'checklist' | 'tracker'>('checklist');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [trackerLocation, setTrackerLocation] = useState<string>('all');
  const [trackerPeriod, setTrackerPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [comments, setComments] = useState('');
  const [createTicket, setCreateTicket] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  
  const { user } = useAuthState();
  const isAdmin = user?.role === 'admin';
  const locations = ['Bedford', 'Dartmouth', 'Stratford', 'Bayers Lake', 'Truro'];

  // Load checklist template
  useEffect(() => {
    loadTemplate();
  }, [activeCategory, activeType]);

  // Load submissions when tracker tab is active or filters change
  useEffect(() => {
    // Only load if we're in the browser (avoid SSR issues)
    if (typeof window !== 'undefined' && activeTab === 'tracker') {
      loadSubmissions();
    }
  }, [activeTab, trackerLocation, trackerPeriod]);

  const loadTemplate = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      if (!token) {
        console.error('No auth token found');
        return;
      }
      
      console.log('Loading template for:', activeCategory, activeType);
      const response = await axios.get(
        `${API_URL}/checklists/template/${activeCategory}/${activeType}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Template response:', response.data);
      
      if (response.data.success) {
        setCurrentTemplate(response.data.data);
        // Reset completed tasks
        setCompletedTasks({});
      } else {
        // If success is false but we got a response
        setCurrentTemplate(response.data.data || null);
        setCompletedTasks({});
      }
    } catch (error: any) {
      console.error('Failed to load template:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      // Don't show error for expected cases
      if (error.response?.data?.code !== 'INVALID_TYPE') {
        toast.error(error.response?.data?.error || 'Failed to load checklist template');
      }
    }
  };

  const loadSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const token = localStorage.getItem('clubos_token');
      if (!token) {
        setLoadingSubmissions(false);
        return;
      }
      
      // Build query params
      let queryParams = 'limit=100';
      
      // Add location filter
      if (trackerLocation !== 'all') {
        queryParams += `&location=${encodeURIComponent(trackerLocation)}`;
      }
      
      // Add date filter based on period
      if (trackerPeriod !== 'all') {
        const now = new Date();
        let startDate;
        
        if (trackerPeriod === 'week') {
          // Get the start of the current week (Sunday)
          startDate = new Date(now);
          startDate.setDate(now.getDate() - now.getDay());
          startDate.setHours(0, 0, 0, 0);
        } else if (trackerPeriod === 'month') {
          // Get the start of the current month
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        
        if (startDate) {
          queryParams += `&startDate=${startDate.toISOString()}`;
        }
      }
      
      const response = await axios.get(
        `${API_URL}/checklists/submissions?${queryParams}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        const submissions = response.data.data || [];
        setSubmissions(submissions);
      } else {
        // Only show error if response indicates failure
        console.error('API returned unsuccessful response:', response.data);
        toast.error(response.data.error || 'Failed to load submission history');
      }
    } catch (error: any) {
      console.error('Failed to load submissions:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      // Only show error toast for actual errors, not for empty results
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
      } else if (error.response?.status === 403) {
        toast.error('Access denied. Contact your administrator.');
      } else if (error.response?.status >= 400) {
        // Only show error for actual HTTP errors
        toast.error(error.response?.data?.error || 'Failed to load submission history');
      } else if (!error.response) {
        // Network error
        toast.error('Network error. Please check your connection.');
      }
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleTaskToggle = (taskId: string) => {
    setCompletedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const isAllTasksCompleted = () => {
    if (!currentTemplate) return false;
    return currentTemplate.tasks.every(task => completedTasks[task.id] === true);
  };

  // Edit functionality for admin users
  const handleEditStart = (task: Task) => {
    setEditingTaskId(task.id);
    setEditValue(task.label);
  };

  const handleEditSave = async (task: Task) => {
    if (editValue.trim() === task.label) {
      setEditingTaskId(null);
      return;
    }
    
    try {
      setSavingTask(true);
      const token = localStorage.getItem('clubos_token');
      
      await axios.put(
        `${API_URL}/checklists/template/task`,
        {
          category: activeCategory,
          type: activeType,
          taskId: task.id,
          label: editValue.trim()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Task updated successfully');
      setEditingTaskId(null);
      loadTemplate(); // Reload to get updated data
    } catch (error: any) {
      console.error('Failed to update task:', error);
      toast.error(error.response?.data?.error || 'Failed to update task');
    } finally {
      setSavingTask(false);
    }
  };

  const handleEditCancel = () => {
    setEditingTaskId(null);
    setEditValue('');
  };

  const handleResetTask = async (task: Task) => {
    if (!confirm(`Reset "${task.label}" to original text "${task.originalLabel}"?`)) return;
    
    try {
      const token = localStorage.getItem('clubos_token');
      
      await axios.delete(
        `${API_URL}/checklists/template/task/${activeCategory}/${activeType}/${task.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Task reset to default');
      loadTemplate();
    } catch (error: any) {
      console.error('Failed to reset task:', error);
      toast.error('Failed to reset task');
    }
  };

  const handleSubmit = async () => {
    if (!currentTemplate || !isAllTasksCompleted()) return;

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('clubos_token');
      const completedTaskIds = Object.keys(completedTasks).filter(id => completedTasks[id]);
      
      console.log('Submitting checklist:', {
        category: activeCategory,
        type: activeType,
        location: selectedLocation,
        completedTasks: completedTaskIds,
        totalTasks: currentTemplate.tasks.length,
        hasToken: !!token
      });
      
      const response = await axios.post(
        `${API_URL}/checklists/submit`,
        {
          category: activeCategory,
          type: activeType,
          location: selectedLocation,
          completedTasks: completedTaskIds,
          totalTasks: currentTemplate.tasks.length,
          comments: comments.trim(),
          createTicket: createTicket && comments.trim().length > 0
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        toast.success(`${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} checklist submitted successfully!`);
        
        if (response.data.ticket) {
          toast.success('Support ticket created!', { duration: 4000 });
        }
        
        // Reset form
        setCompletedTasks({});
        setComments('');
        setCreateTicket(false);
        
        // Reload template to reset the form
        loadTemplate();
        
        // Reload submissions if on tracker tab
        if (activeTab === 'tracker') {
          loadSubmissions();
        }
      }
    } catch (error: any) {
      console.error('Failed to submit checklist:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
      } else if (error.response?.status === 400) {
        toast.error(error.response?.data?.error || 'Invalid submission data');
      } else {
        toast.error(error.response?.data?.error || error.response?.data?.message || 'Failed to submit checklist');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryColor = (category: string) => {
    return category === 'cleaning' ? 'text-blue-400' : 'text-purple-400';
  };

  const getTypeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };
  
  const handleDeleteSubmission = async (submissionId: string) => {
    if (!confirm('Are you sure you want to delete this submission?')) return;
    
    try {
      const token = localStorage.getItem('clubos_token');
      
      await axios.delete(
        `${API_URL}/checklists/submissions/${submissionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Submission deleted successfully');
      
      // Reload submissions
      loadSubmissions();
    } catch (error: any) {
      console.error('Failed to delete submission:', error);
      
      if (error.response?.status === 403) {
        toast.error('You do not have permission to delete submissions');
      } else {
        toast.error(error.response?.data?.error || 'Failed to delete submission');
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Tab Navigation */}
      <div className="border-b border-[var(--border-primary)] mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('checklist')}
            className={`pb-3 text-lg md:text-xl font-medium transition-colors relative ${
              activeTab === 'checklist' 
                ? 'text-[var(--text-primary)]' 
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            Checklists
            {activeTab === 'checklist' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('tracker')}
            className={`pb-3 text-lg md:text-xl font-medium transition-colors relative ${
              activeTab === 'tracker' 
                ? 'text-[var(--text-primary)]' 
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            Completion Tracker
            {activeTab === 'tracker' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]"></div>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'checklist' ? (
        <>
          {/* Category and Type Selection */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium mb-3 text-[var(--text-secondary)]">Category</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveCategory('cleaning')}
                    className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                      activeCategory === 'cleaning'
                        ? 'bg-blue-500 text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-primary)]'
                    }`}
                  >
                    Cleaning
                  </button>
                  <button
                    onClick={() => {
                      setActiveCategory('tech');
                      if (activeType === 'daily') {
                        setActiveType('weekly');
                      }
                    }}
                    className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                      activeCategory === 'tech'
                        ? 'bg-purple-500 text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-primary)]'
                    }`}
                  >
                    Tech
                  </button>
                </div>
              </div>

              {/* Type Selection */}
              <div>
                <label className="block text-sm font-medium mb-3 text-[var(--text-secondary)]">Type</label>
                <div className="flex gap-2">
                  {activeCategory === 'cleaning' && (
                    <button
                      onClick={() => setActiveType('daily')}
                      className={`flex-1 px-3 py-2.5 rounded-lg font-medium text-sm transition-all ${
                        activeType === 'daily'
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-primary)]'
                      }`}
                    >
                      Daily
                    </button>
                  )}
                  <button
                    onClick={() => setActiveType('weekly')}
                    className={`flex-1 px-3 py-2.5 rounded-lg font-medium text-sm transition-all ${
                      activeType === 'weekly'
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-primary)]'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setActiveType('quarterly')}
                    className={`flex-1 px-3 py-2.5 rounded-lg font-medium text-sm transition-all ${
                      activeType === 'quarterly'
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-primary)]'
                    }`}
                  >
                    Quarterly
                  </button>
                </div>
              </div>

              {/* Location Selection */}
              <div>
                <label className="block text-sm font-medium mb-3 text-[var(--text-secondary)]">Location</label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg text-[var(--text-primary)]"
                >
                  {locations.map(location => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Checklist Tasks */}
          {currentTemplate && (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg p-4 mb-4">
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                  {activeCategory === 'cleaning' ? 'Cleaning' : 'Tech'} Checklist - {getTypeLabel(activeType)}
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Complete all tasks below and submit when finished.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                {currentTemplate.tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-3 rounded border transition-all ${
                      completedTasks[task.id]
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-[var(--bg-tertiary)] border-[var(--border-secondary)]'
                    } ${editingTaskId === task.id ? '' : 'hover:bg-[var(--bg-primary)]'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${
                          completedTasks[task.id]
                            ? 'bg-green-500 border-green-500'
                            : 'border-[var(--border-primary)]'
                        }`}
                        onClick={() => handleTaskToggle(task.id)}
                      >
                        {completedTasks[task.id] && <Check className="w-4 h-4 text-white" />}
                      </div>
                      
                      {editingTaskId === task.id ? (
                        // Edit mode
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEditSave(task);
                              if (e.key === 'Escape') handleEditCancel();
                            }}
                            className="flex-1 px-2 py-1 text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded focus:outline-none focus:border-[var(--accent)]"
                            autoFocus
                            disabled={savingTask}
                          />
                          <button
                            onClick={() => handleEditSave(task)}
                            disabled={savingTask}
                            className="p-1 text-green-500 hover:text-green-600 disabled:opacity-50"
                            title="Save"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleEditCancel}
                            className="p-1 text-red-500 hover:text-red-600"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        // View mode
                        <div className="flex-1 flex items-center justify-between group">
                          <span 
                            className={`flex-1 text-sm cursor-pointer ${
                              completedTasks[task.id]
                                ? 'text-[var(--text-primary)]'
                                : 'text-[var(--text-secondary)]'
                            }`}
                            onClick={() => handleTaskToggle(task.id)}
                          >
                            {task.label}
                            {task.isCustomized && (
                              <span className="ml-1 text-[var(--accent)] text-xs opacity-70">
                                (edited)
                              </span>
                            )}
                          </span>
                          
                          {isAdmin && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditStart(task);
                                }}
                                className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                title="Edit task"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              
                              {task.isCustomized && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetTask(task);
                                  }}
                                  className="p-1 text-[var(--text-secondary)] hover:text-red-500 transition-colors"
                                  title="Reset to default"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Comments and Ticket Section */}
              {isAllTasksCompleted() && (
                <div className="border-t border-[var(--border-secondary)] pt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)] uppercase tracking-wider">
                      Comments (Optional)
                    </label>
                    <textarea
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Add any notes about issues, missing items, or required maintenance..."
                      className="w-full px-3 py-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors resize-none text-xs"
                      rows={2}
                    />
                  </div>
                  
                  {comments.trim() && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="create-ticket"
                        checked={createTicket}
                        onChange={(e) => setCreateTicket(e.target.checked)}
                        className="w-3 h-3 text-[var(--accent)] bg-[var(--bg-tertiary)] border-[var(--border-secondary)] rounded focus:ring-[var(--accent)]"
                      />
                      <label htmlFor="create-ticket" className="text-xs text-[var(--text-secondary)] cursor-pointer">
                        Create a support ticket for issues mentioned in comments
                      </label>
                    </div>
                  )}
                </div>
              )}
              
              {/* Progress and Submit */}
              <div className="border-t border-[var(--border-secondary)] pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-[var(--text-secondary)]">
                      Progress: {Object.values(completedTasks).filter(Boolean).length} / {currentTemplate.tasks.length}
                    </div>
                    <div className="h-1.5 w-32 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[var(--accent)] transition-all duration-300"
                        style={{ 
                          width: `${(Object.values(completedTasks).filter(Boolean).length / currentTemplate.tasks.length) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={!isAllTasksCompleted() || isSubmitting}
                    className={`px-4 py-2 rounded text-xs font-medium transition-all ${
                      isAllTasksCompleted() && !isSubmitting
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed'
                    }`}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Checklist'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Completion Tracker */}
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg p-4 mb-4">
              <div className="flex flex-wrap gap-3 items-center">
                {/* Location Filter */}
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)] uppercase tracking-wider">Location</label>
                  <select
                    value={trackerLocation}
                    onChange={(e) => setTrackerLocation(e.target.value)}
                    className="px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded text-xs text-[var(--text-primary)] min-w-[120px]"
                  >
                    <option value="all">All Locations</option>
                    {locations.map(location => (
                      <option key={location} value={location}>{location}</option>
                    ))}
                  </select>
                </div>

                {/* Time Period Filter */}
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)] uppercase tracking-wider">Time Period</label>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setTrackerPeriod('week')}
                      className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${
                        trackerPeriod === 'week'
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:bg-[var(--bg-primary)]'
                      }`}
                    >
                      This Week
                    </button>
                    <button
                      onClick={() => setTrackerPeriod('month')}
                      className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${
                        trackerPeriod === 'month'
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:bg-[var(--bg-primary)]'
                      }`}
                    >
                      This Month
                    </button>
                    <button
                      onClick={() => setTrackerPeriod('all')}
                      className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${
                        trackerPeriod === 'all'
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:bg-[var(--bg-primary)]'
                      }`}
                    >
                      All Time
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Submissions Table */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                Checklist Submissions
                {trackerLocation !== 'all' && ` - ${trackerLocation}`}
                {trackerPeriod !== 'all' && ` (${trackerPeriod === 'week' ? 'This Week' : 'This Month'})`}
              </h3>
              
              {loadingSubmissions ? (
                <div className="text-center py-8 text-[var(--text-secondary)]">Loading submissions...</div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-secondary)]">
                  <div className="mb-2">No submissions found</div>
                  <div className="text-sm text-[var(--text-muted)]">
                    {trackerLocation !== 'all' || trackerPeriod !== 'all' 
                      ? 'Try adjusting your filters' 
                      : 'Complete a checklist to see it here'}
                  </div>
                </div>
              ) : (
                <>
                  {/* Group submissions by location */}
                  {(() => {
                    const groupedSubmissions = submissions.reduce((acc, submission) => {
                      if (!acc[submission.location]) {
                        acc[submission.location] = [];
                      }
                      acc[submission.location].push(submission);
                      return acc;
                    }, {} as Record<string, Submission[]>);

                    return Object.entries(groupedSubmissions).map(([location, locationSubmissions]) => (
                      <div key={location} className="mb-4 last:mb-0">
                        <h4 className="text-xs font-medium text-[var(--text-primary)] mb-2 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />
                          {location}
                          <span className="text-xs text-[var(--text-muted)] font-normal">
                            ({locationSubmissions.length} submission{locationSubmissions.length !== 1 ? 's' : ''})
                          </span>
                        </h4>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-[var(--border-secondary)]">
                                <th className="text-left py-2 px-2 text-xs font-medium text-[var(--text-muted)]">User</th>
                                <th className="text-left py-2 px-2 text-xs font-medium text-[var(--text-muted)]">Category</th>
                                <th className="text-left py-2 px-2 text-xs font-medium text-[var(--text-muted)]">Type</th>
                                <th className="text-left py-2 px-2 text-xs font-medium text-[var(--text-muted)]">Tasks</th>
                                <th className="text-left py-2 px-2 text-xs font-medium text-[var(--text-muted)]">Completed</th>
                                {(user?.role === 'admin' || user?.role === 'operator') && (
                                  <th className="text-left py-2 px-2 text-xs font-medium text-[var(--text-muted)]">Actions</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {locationSubmissions.map((submission) => (
                                <tr key={submission.id} className="border-b border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)]">
                                  <td className="py-2 px-2">
                                    <div className="flex items-center gap-1.5">
                                      <User className="w-3 h-3 text-[var(--text-muted)]" />
                                      <div>
                                        <div className="text-xs text-[var(--text-primary)]">{submission.user_name}</div>
                                        <div className="text-[10px] text-[var(--text-muted)]">{submission.user_email}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-2 px-2">
                                    <span className={`text-xs font-medium ${getCategoryColor(submission.category)}`}>
                                      {submission.category.charAt(0).toUpperCase() + submission.category.slice(1)}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 text-xs text-[var(--text-secondary)]">
                                    {submission.type.charAt(0).toUpperCase() + submission.type.slice(1)}
                                  </td>
                                  <td className="py-2 px-2">
                                    <div className="flex items-center gap-1">
                                      <CheckSquare className="w-3 h-3 text-green-500" />
                                      <span className="text-xs text-[var(--text-secondary)]">{submission.total_tasks}</span>
                                    </div>
                                  </td>
                                  <td className="py-2 px-2">
                                    <div className="flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                                      <div>
                                        <div className="text-xs text-[var(--text-secondary)]">
                                          {new Date(submission.completion_time).toLocaleDateString()}
                                        </div>
                                        <div className="text-[10px] text-[var(--text-muted)]">
                                          {new Date(submission.completion_time).toLocaleTimeString()}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  {(user?.role === 'admin' || user?.role === 'operator') && (
                                    <td className="py-2 px-2">
                                      <button
                                        onClick={() => handleDeleteSubmission(submission.id)}
                                        className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                                        title="Delete submission"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ));
                  })()}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};