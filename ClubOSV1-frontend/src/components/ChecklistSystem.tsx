import React, { useState, useEffect } from 'react';
import { CheckSquare, Clock, Calendar, User, MapPin, ChevronRight, ChevronDown, Check, Trash2, Edit2, X, RotateCcw, AlertTriangle, FileText, CheckCircle, XCircle, Timer, MessageSquare, Clipboard, Package, Camera, Plus, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { http } from '@/api/http';
import { useAuthState } from '../state/useStore';
import { tokenManager } from '@/utils/tokenManager';
import logger from '@/services/logger';


interface Task {
  id: string;
  label: string;
  originalLabel?: string;
  isCustomized?: boolean;
}

interface ChecklistTemplate {
  templateId?: string;
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
  completed_tasks?: string; // JSON string of completed task IDs
  completion_time: string;
  user_name: string;
  user_email: string;
  comments?: string;
  ticket_created?: boolean;
  ticket_id?: string;
  supplies_needed?: string; // JSON string of supply items
  photo_urls?: string; // JSON string of photo URLs
  duration_minutes?: number; // Duration in minutes (only visible to admins)
}

interface SupplyItem {
  id: string;
  name: string;
  quantity?: string;
  urgency: 'low' | 'medium' | 'high';
}


interface ChecklistSystemProps {
  activeTab?: 'checklist' | 'tracker';
}

export const ChecklistSystem: React.FC<ChecklistSystemProps> = ({ activeTab = 'checklist' }) => {
  const [activeCategory, setActiveCategory] = useState<'cleaning' | 'tech'>('cleaning');
  const [activeType, setActiveType] = useState<'daily' | 'weekly' | 'quarterly'>('daily');
  const [selectedLocation, setSelectedLocation] = useState('Bedford');
  const [currentTemplate, setCurrentTemplate] = useState<ChecklistTemplate | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [trackerLocation, setTrackerLocation] = useState<string>('all');
  const [trackerPeriod, setTrackerPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [comments, setComments] = useState('');
  const [createTicket, setCreateTicket] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [expandedSubmissions, setExpandedSubmissions] = useState<Set<string>>(new Set());
  const [photoAttachments, setPhotoAttachments] = useState<string[]>([]);
  const [estimatedTime, setEstimatedTime] = useState<number>(0);
  const [supplies, setSupplies] = useState<SupplyItem[]>([]);
  const [newSupplyName, setNewSupplyName] = useState('');
  const [newSupplyQuantity, setNewSupplyQuantity] = useState('');
  const [newSupplyUrgency, setNewSupplyUrgency] = useState<'low' | 'medium' | 'high'>('medium');
  
  // Session management states
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  
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
  
  // Timer tracking removed - duration is calculated on backend for admin view only


  const loadTemplate = async () => {
    try {
      const token = tokenManager.getToken();
      if (!token) {
        logger.error('No auth token found');
        return;
      }
      
      logger.debug(`Loading template for: ${activeCategory} ${activeType}`);
      const response = await http.get(
        `checklists-v2/template/${activeCategory}/${activeType}?location=${selectedLocation}`,

      );
      
      logger.debug(`Template response: ${JSON.stringify(response.data)}`);
      
      if (response.data.success) {
        setCurrentTemplate(response.data.data);
        // Reset completed tasks
        setCompletedTasks({});
        // Set estimated time based on checklist type
        setEstimatedTime(
          activeType === 'daily' ? 15 : 
          activeType === 'weekly' ? 30 : 
          60
        );
      } else {
        // If success is false but we got a response
        setCurrentTemplate(response.data.data || null);
        setCompletedTasks({});
      }
    } catch (error: any) {
      logger.error('Failed to load template:', error);
      logger.error('Error response:', error.response?.data);
      logger.error('Error status:', error.response?.status);
      
      // Don't show error for expected cases
      if (error.response?.data?.code !== 'INVALID_TYPE') {
        toast.error(error.response?.data?.error || 'Failed to load checklist template');
      }
    }
  };

  const loadSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const token = tokenManager.getToken();
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
      
      const response = await http.get(
        `checklists-v2/submissions?${queryParams}`,

      );
      
      if (response.data.success) {
        const submissions = response.data.data || [];
        setSubmissions(submissions);
      } else {
        // Only show error if response indicates failure
        logger.error('API returned unsuccessful response:', response.data);
        toast.error(response.data.error || 'Failed to load submission history');
      }
    } catch (error: any) {
      logger.error('Failed to load submissions:', error);
      logger.error('Error details:', {
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
      const token = tokenManager.getToken();
      
      await http.put(
        `checklists/template/task`,
        {
          category: activeCategory,
          type: activeType,
          taskId: task.id,
          label: editValue.trim()
        },

      );
      
      toast.success('Task updated successfully');
      setEditingTaskId(null);
      loadTemplate(); // Reload to get updated data
    } catch (error: any) {
      logger.error('Failed to update task:', error);
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
      const token = tokenManager.getToken();
      
      await http.delete(
        `checklists/template/task/${activeCategory}/${activeType}/${task.id}`,

      );
      
      toast.success('Task reset to default');
      loadTemplate();
    } catch (error: any) {
      logger.error('Failed to reset task:', error);
      toast.error('Failed to reset task');
    }
  };

  // Supply management functions
  const addSupply = () => {
    if (!newSupplyName.trim()) return;
    
    const newSupply: SupplyItem = {
      id: Date.now().toString(),
      name: newSupplyName.trim(),
      quantity: newSupplyQuantity.trim(),
      urgency: newSupplyUrgency
    };
    
    setSupplies([...supplies, newSupply]);
    setNewSupplyName('');
    setNewSupplyQuantity('');
    setNewSupplyUrgency('medium');
  };

  const removeSupply = (id: string) => {
    setSupplies(supplies.filter(s => s.id !== id));
  };

  // Photo management functions
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // In production, you'd upload to a cloud service
    // For now, we'll use a data URL for demonstration
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      setPhotoAttachments([...photoAttachments, url]);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (index: number) => {
    setPhotoAttachments(photoAttachments.filter((_, i) => i !== index));
  };


  const getUrgencyColor = (urgency: 'low' | 'medium' | 'high') => {
    switch (urgency) {
      case 'high': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'low': return 'text-green-500 bg-green-500/10 border-green-500/30';
    }
  };
  
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleStartChecklist = async () => {
    if (!currentTemplate) return;
    
    setIsStarting(true);
    try {
      const token = tokenManager.getToken();
      if (!token) {
        toast.error('Please log in to start a checklist');
        return;
      }
      
      logger.debug('Starting checklist session:', {
        templateId: currentTemplate.templateId,
        location: selectedLocation,
        category: activeCategory,
        type: activeType
      });
      
      const response = await http.post(
        'checklists-v2/start',
        {
          templateId: currentTemplate.templateId || '',
          location: selectedLocation,
          unlockDoor: true
        }
      );
      
      if (response.data.success) {
        setSessionId(response.data.id);
        setSessionStartTime(new Date(response.data.startedAt));
        setIsSessionActive(true);
        setElapsedTime(0);
        
        if (response.data.doorUnlocked) {
          toast.success(`Door unlocked at ${selectedLocation}!`, {
            icon: '🔓',
            duration: 5000
          });
        }
        
        toast.success('Checklist started! Complete all tasks before submitting.', {
          duration: 4000
        });
      }
    } catch (error: any) {
      logger.error('Failed to start checklist:', error);
      toast.error(error.response?.data?.error || 'Failed to start checklist');
    } finally {
      setIsStarting(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentTemplate || !isAllTasksCompleted()) return;

    setIsSubmitting(true);
    try {
      const token = tokenManager.getToken();
      const completedTaskIds = Object.keys(completedTasks).filter(id => completedTasks[id]);
      
      logger.debug('Submitting checklist:', {
        sessionId,
        category: activeCategory,
        type: activeType,
        location: selectedLocation,
        completedTasks: completedTaskIds,
        totalTasks: currentTemplate.tasks.length,
        hasToken: !!token
      });
      
      let response;
      
      if (sessionId && isSessionActive) {
        // Use the complete endpoint for an active session
        response = await http.patch(
          `checklists-v2/complete/${sessionId}`,
          {
            completedTasks: completedTaskIds,
            comments: comments.trim(),
            supplies: supplies,
            photos: photoAttachments
          }
        );
      } else {
        // Use the legacy submit endpoint
        response = await http.post(
          `checklists-v2/submit`,
          {
            templateId: currentTemplate.templateId || '',
            category: activeCategory,
            type: activeType,
            location: selectedLocation,
            completedTasks: completedTaskIds,
            comments: comments.trim(),
            createTicket: createTicket && comments.trim().length > 0,
            supplies: supplies,
            photoUrls: photoAttachments
          }
        );
      }
      
      if (response.data.success) {
        toast.success(`${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} checklist submitted successfully!`);
        
        if (response.data.ticket) {
          toast.success('Support ticket created!', { duration: 4000 });
        }
        
        // Reset form and session
        setCompletedTasks({});
        setComments('');
        setCreateTicket(false);
        setPhotoAttachments([]);
        setSupplies([]);
        setSessionId(null);
        setSessionStartTime(null);
        setIsSessionActive(false);
        setElapsedTime(0);
        
        // Reload template to reset the form
        loadTemplate();
        
        // Reload submissions if on tracker tab
        if (activeTab === 'tracker') {
          loadSubmissions();
        }
      }
    } catch (error: any) {
      logger.error('Failed to submit checklist:', error);
      logger.error('Error details:', {
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
      const token = tokenManager.getToken();
      
      await http.delete(
        `checklists-v2/submissions/${submissionId}`,

      );
      
      toast.success('Submission deleted successfully');
      
      // Reload submissions
      loadSubmissions();
    } catch (error: any) {
      logger.error('Failed to delete submission:', error);
      
      if (error.response?.status === 403) {
        toast.error('You do not have permission to delete submissions');
      } else {
        toast.error(error.response?.data?.error || 'Failed to delete submission');
      }
    }
  };

  const toggleSubmissionExpanded = (submissionId: string) => {
    setExpandedSubmissions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(submissionId)) {
        newSet.delete(submissionId);
      } else {
        newSet.add(submissionId);
      }
      return newSet;
    });
  };

  const getCompletedTaskLabels = (submission: Submission): string[] => {
    if (!submission.completed_tasks) return [];
    try {
      const taskIds = JSON.parse(submission.completed_tasks);
      // Match task IDs to labels based on the template
      // This is a simplified version - in production you'd fetch the actual template
      return taskIds;
    } catch {
      return [];
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
                    className={`flex-1 px-3 py-1.5 rounded-md font-medium text-sm transition-all ${
                      activeCategory === 'cleaning'
                        ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)]'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:text-[var(--text-primary)]'
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
                    className={`flex-1 px-3 py-1.5 rounded-md font-medium text-sm transition-all ${
                      activeCategory === 'tech'
                        ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)]'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:text-[var(--text-primary)]'
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
                      className={`flex-1 px-3 py-1.5 rounded-md font-medium text-sm transition-all ${
                        activeType === 'daily'
                          ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)]'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Daily
                    </button>
                  )}
                  <button
                    onClick={() => setActiveType('weekly')}
                    className={`flex-1 px-3 py-1.5 rounded-md font-medium text-sm transition-all ${
                      activeType === 'weekly'
                        ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)]'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setActiveType('quarterly')}
                    className={`flex-1 px-3 py-1.5 rounded-md font-medium text-sm transition-all ${
                      activeType === 'quarterly'
                        ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)]'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:text-[var(--text-primary)]'
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
                  className="w-full px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-md text-[var(--text-primary)] text-sm"
                >
                  {locations.map(location => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Start Session / Timer Card */}
          {currentTemplate && !isSessionActive && (
            <div className="bg-gradient-to-r from-[var(--accent)] to-[#0a4a45] rounded-lg p-4 mb-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Ready to Begin?</h3>
                  <p className="text-sm text-white/80">
                    Starting the checklist will unlock the door at {selectedLocation}
                  </p>
                </div>
                <button
                  onClick={handleStartChecklist}
                  disabled={isStarting || !currentTemplate}
                  className="px-6 py-3 bg-[var(--bg-secondary)] text-[var(--accent)] rounded-lg font-semibold hover:bg-[var(--bg-hover)] transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isStarting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--accent)] border-t-transparent" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Start Checklist
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
          
          {/* Active Session Status (no timer for contractors) */}
          {isSessionActive && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-600">Checklist In Progress</p>
                  <p className="text-xs text-green-500">Complete all tasks below and submit when finished</p>
                </div>
              </div>
            </div>
          )}


          {/* Message when checklist not started */}
          {currentTemplate && !isSessionActive && (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg p-8 mb-4 text-center">
              <Clipboard className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                Ready to Begin {activeCategory === 'cleaning' ? 'Cleaning' : 'Tech'} Checklist
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-1">
                {getTypeLabel(activeType)} checklist for {selectedLocation}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Click "Start Checklist" above to unlock the door and begin
              </p>
            </div>
          )}

          {/* Checklist Tasks - Only show after session starts */}
          {currentTemplate && isSessionActive && (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg p-4 mb-4">
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                  {activeCategory === 'cleaning' ? 'Cleaning' : 'Tech'} Checklist - {getTypeLabel(activeType)}
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  {!isSessionActive 
                    ? 'Start the checklist to unlock the door and begin tracking time.'
                    : 'Complete all tasks below and submit when finished.'}
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
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                          isSessionActive ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                        } ${
                          completedTasks[task.id]
                            ? 'bg-green-500 border-green-500'
                            : 'border-[var(--border-primary)]'
                        }`}
                        onClick={() => isSessionActive && handleTaskToggle(task.id)}
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

              {/* Comments, Supplies, Photos and Ticket Section */}
              {isAllTasksCompleted() && (
                <div className="border-t border-[var(--border-secondary)] pt-3 space-y-3">
                  {/* Comments */}
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
                  
                  {/* Supplies Tracking */}
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)] uppercase tracking-wider">
                      <Package className="inline w-3 h-3 mr-1" />
                      Supplies Needed
                    </label>
                    
                    <div className="space-y-2">
                      {/* Add supply form */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newSupplyName}
                          onChange={(e) => setNewSupplyName(e.target.value)}
                          placeholder="Supply name"
                          className="flex-1 px-2 py-1 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded focus:outline-none focus:border-[var(--accent)]"
                          onKeyDown={(e) => e.key === 'Enter' && addSupply()}
                        />
                        <input
                          type="text"
                          value={newSupplyQuantity}
                          onChange={(e) => setNewSupplyQuantity(e.target.value)}
                          placeholder="Qty"
                          className="w-16 px-2 py-1 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded focus:outline-none focus:border-[var(--accent)]"
                        />
                        <select
                          value={newSupplyUrgency}
                          onChange={(e) => setNewSupplyUrgency(e.target.value as 'low' | 'medium' | 'high')}
                          className="px-2 py-1 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded focus:outline-none focus:border-[var(--accent)]"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                        <button
                          onClick={addSupply}
                          disabled={!newSupplyName.trim()}
                          className="px-2 py-1 bg-[var(--accent)] text-white rounded text-xs hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      
                      {/* Supplies list */}
                      {supplies.length > 0 && (
                        <div className="space-y-1">
                          {supplies.map((supply) => (
                            <div
                              key={supply.id}
                              className={`flex items-center justify-between px-2 py-1 rounded border ${getUrgencyColor(supply.urgency)}`}
                            >
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-3 h-3" />
                                <span className="text-xs font-medium">{supply.name}</span>
                                {supply.quantity && (
                                  <span className="text-xs opacity-75">({supply.quantity})</span>
                                )}
                              </div>
                              <button
                                onClick={() => removeSupply(supply.id)}
                                className="p-0.5 hover:bg-red-500/20 rounded transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Photo Attachments */}
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)] uppercase tracking-wider">
                      <Camera className="inline w-3 h-3 mr-1" />
                      Photo Attachments
                    </label>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                          id="photo-upload"
                        />
                        <label
                          htmlFor="photo-upload"
                          className="px-3 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] cursor-pointer transition-colors"
                        >
                          <Camera className="inline w-3 h-3 mr-1" />
                          Add Photo
                        </label>
                        <span className="text-xs text-[var(--text-muted)]">
                          Document damage or issues
                        </span>
                      </div>
                      
                      {/* Photo preview */}
                      {photoAttachments.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {photoAttachments.map((photo, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={photo}
                                alt={`Attachment ${index + 1}`}
                                className="w-16 h-16 object-cover rounded border border-[var(--border-secondary)]"
                              />
                              <button
                                onClick={() => removePhoto(index)}
                                className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Create ticket checkbox */}
                  {(comments.trim() || supplies.length > 0 || photoAttachments.length > 0) && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="create-ticket"
                        checked={createTicket}
                        onChange={(e) => setCreateTicket(e.target.checked)}
                        className="w-3 h-3 text-[var(--accent)] bg-[var(--bg-tertiary)] border-[var(--border-secondary)] rounded focus:ring-[var(--accent)]"
                      />
                      <label htmlFor="create-ticket" className="text-xs text-[var(--text-secondary)] cursor-pointer">
                        Create a support ticket for issues and supplies needed
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
                    disabled={!isSessionActive || !isAllTasksCompleted() || isSubmitting}
                    className={`px-4 py-2 rounded text-xs font-medium transition-all ${
                      isSessionActive && isAllTasksCompleted() && !isSubmitting
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed'
                    }`}
                  >
                    {!isSessionActive ? 'Start Checklist First' : isSubmitting ? 'Submitting...' : 'Submit Checklist'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : activeTab === 'tracker' ? (
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
                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                        trackerPeriod === 'week'
                          ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)]'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      This Week
                    </button>
                    <button
                      onClick={() => setTrackerPeriod('month')}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                        trackerPeriod === 'month'
                          ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)]'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      This Month
                    </button>
                    <button
                      onClick={() => setTrackerPeriod('all')}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                        trackerPeriod === 'all'
                          ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)]'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:text-[var(--text-primary)]'
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
                        
                        <div className="space-y-2">
                          {locationSubmissions.map((submission) => (
                            <div key={submission.id} className="border border-[var(--border-secondary)] rounded-lg overflow-hidden">
                              <div 
                                className="p-3 hover:bg-[var(--bg-tertiary)] cursor-pointer transition-all"
                                onClick={() => toggleSubmissionExpanded(submission.id)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4 flex-1">
                                    <button className="p-1 hover:bg-[var(--bg-primary)] rounded transition-colors">
                                      {expandedSubmissions.has(submission.id) ? (
                                        <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                                      )}
                                    </button>
                                    
                                    <div className="flex items-center gap-2">
                                      <User className="w-3 h-3 text-[var(--text-muted)]" />
                                      <div>
                                        <div className="text-xs text-[var(--text-primary)]">{submission.user_name}</div>
                                        <div className="text-[10px] text-[var(--text-muted)]">{submission.user_email}</div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs font-medium ${getCategoryColor(submission.category)}`}>
                                        {submission.category.charAt(0).toUpperCase() + submission.category.slice(1)}
                                      </span>
                                      <span className="text-xs text-[var(--text-secondary)]">
                                        {submission.type.charAt(0).toUpperCase() + submission.type.slice(1)}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                      <CheckSquare className="w-3 h-3 text-green-500" />
                                      <span className="text-xs text-[var(--text-secondary)]">{submission.total_tasks} tasks</span>
                                    </div>
                                    
                                    {submission.comments && (
                                      <MessageSquare className="w-3 h-3 text-[var(--accent)]" />
                                    )}
                                    
                                    {submission.ticket_created && (
                                      <AlertTriangle className="w-3 h-3 text-yellow-500" />
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <div className="text-xs text-[var(--text-secondary)]">
                                        {new Date(submission.completion_time).toLocaleDateString()}
                                      </div>
                                      <div className="text-[10px] text-[var(--text-muted)]">
                                        {new Date(submission.completion_time).toLocaleTimeString()}
                                      </div>
                                      {/* Show duration only for admins */}
                                      {user?.role === 'admin' && submission.duration_minutes && (
                                        <div className="text-[10px] text-[var(--accent)] mt-1">
                                          {submission.duration_minutes} min
                                        </div>
                                      )}
                                    </div>
                                    
                                    {(user?.role === 'admin' || user?.role === 'operator') && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteSubmission(submission.id);
                                        }}
                                        className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                                        title="Delete submission"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Expanded Details */}
                              {expandedSubmissions.has(submission.id) && (
                                <div className="border-t border-[var(--border-secondary)] bg-[var(--bg-tertiary)] p-4">
                                  <div className="space-y-3">
                                    {/* Show duration for admins in expanded view */}
                                    {user?.role === 'admin' && submission.duration_minutes && (
                                      <div>
                                        <div className="flex items-center gap-2 mb-1">
                                          <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                                          <span className="text-xs font-medium text-[var(--text-secondary)]">Duration:</span>
                                        </div>
                                        <p className="text-xs text-[var(--accent)] ml-5">
                                          {submission.duration_minutes} minutes
                                        </p>
                                      </div>
                                    )}
                                    {submission.comments && (
                                      <div>
                                        <div className="flex items-center gap-2 mb-1">
                                          <FileText className="w-3 h-3 text-[var(--text-muted)]" />
                                          <span className="text-xs font-medium text-[var(--text-secondary)]">Comments:</span>
                                        </div>
                                        <p className="text-xs text-[var(--text-primary)] ml-5 bg-[var(--bg-secondary)] p-2 rounded">
                                          {submission.comments}
                                        </p>
                                      </div>
                                    )}
                                    
                                    {submission.supplies_needed && (() => {
                                      try {
                                        const supplies = JSON.parse(submission.supplies_needed) as SupplyItem[];
                                        if (supplies.length > 0) {
                                          return (
                                            <div>
                                              <div className="flex items-center gap-2 mb-1">
                                                <Package className="w-3 h-3 text-[var(--text-muted)]" />
                                                <span className="text-xs font-medium text-[var(--text-secondary)]">Supplies Needed:</span>
                                              </div>
                                              <div className="ml-5 space-y-1">
                                                {supplies.map((supply, idx) => (
                                                  <div key={idx} className={`inline-flex items-center gap-2 px-2 py-0.5 rounded text-xs ${getUrgencyColor(supply.urgency)}`}>
                                                    <AlertCircle className="w-3 h-3" />
                                                    <span>{supply.name}</span>
                                                    {supply.quantity && <span className="opacity-75">({supply.quantity})</span>}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          );
                                        }
                                        return null;
                                      } catch {
                                        return null;
                                      }
                                    })()}
                                    
                                    {submission.photo_urls && (() => {
                                      try {
                                        // Handle both array and JSON string formats
                                        const photos = Array.isArray(submission.photo_urls)
                                          ? submission.photo_urls
                                          : JSON.parse(submission.photo_urls) as string[];
                                        if (photos.length > 0) {
                                          return (
                                            <div>
                                              <div className="flex items-center gap-2 mb-1">
                                                <Camera className="w-3 h-3 text-[var(--text-muted)]" />
                                                <span className="text-xs font-medium text-[var(--text-secondary)]">Photo Attachments:</span>
                                              </div>
                                              <div className="ml-5 flex gap-2 flex-wrap">
                                                {photos.map((photo, idx) => (
                                                  <img
                                                    key={idx}
                                                    src={photo}
                                                    alt={`Photo ${idx + 1}`}
                                                    className="w-16 h-16 object-cover rounded border border-[var(--border-secondary)] cursor-pointer hover:opacity-80"
                                                    onClick={() => window.open(photo, '_blank')}
                                                  />
                                                ))}
                                              </div>
                                            </div>
                                          );
                                        }
                                        return null;
                                      } catch {
                                        return null;
                                      }
                                    })()}
                                    
                                    {submission.ticket_created && (
                                      <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-3 h-3 text-yellow-500" />
                                        <span className="text-xs text-[var(--text-secondary)]">
                                          Support ticket created {submission.ticket_id && `(ID: ${submission.ticket_id.slice(0, 8)}...)`}
                                        </span>
                                      </div>
                                    )}
                                    
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <Clipboard className="w-3 h-3 text-[var(--text-muted)]" />
                                        <span className="text-xs font-medium text-[var(--text-secondary)]">Completed Tasks:</span>
                                      </div>
                                      <div className="ml-5">
                                        <div className="text-xs text-[var(--text-muted)]">
                                          All {submission.total_tasks} tasks completed successfully
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};