import React, { useState, useEffect } from 'react';
import { CheckSquare, Clock, Calendar, User, MapPin, ChevronRight, Check, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useAuthState } from '../state/useStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Task {
  id: string;
  label: string;
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
  
  const { user } = useAuthState();
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
      <div className="flex items-center gap-4 md:gap-6 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('checklist')}
          className={`text-base md:text-lg font-semibold transition-all relative pb-1 whitespace-nowrap ${
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
          className={`text-base md:text-lg font-semibold transition-all relative pb-1 whitespace-nowrap ${
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

      {activeTab === 'checklist' ? (
        <>
          {/* Category and Type Selection */}
          <div className="card mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium mb-3 text-[var(--text-secondary)]">Category</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveCategory('cleaning')}
                    className={`flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-lg font-medium text-sm md:text-base transition-all ${
                      activeCategory === 'cleaning'
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-primary)]'
                    }`}
                  >
                    Cleaning
                  </button>
                  <button
                    onClick={() => {
                      setActiveCategory('tech');
                      // Tech doesn't have daily, so switch to weekly
                      if (activeType === 'daily') {
                        setActiveType('weekly');
                      }
                    }}
                    className={`flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-lg font-medium text-sm md:text-base transition-all ${
                      activeCategory === 'tech'
                        ? 'bg-purple-500 text-white border-purple-500'
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
                      className={`flex-1 px-2 md:px-3 py-2.5 md:py-3 rounded-lg font-medium text-sm md:text-base transition-all ${
                        activeType === 'daily'
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-primary)]'
                      }`}
                    >
                      Daily
                    </button>
                  )}
                  <button
                    onClick={() => setActiveType('weekly')}
                    className={`flex-1 px-2 md:px-3 py-2.5 md:py-3 rounded-lg font-medium text-sm md:text-base transition-all ${
                      activeType === 'weekly'
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-primary)]'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setActiveType('quarterly')}
                    className={`flex-1 px-2 md:px-3 py-2.5 md:py-3 rounded-lg font-medium text-sm md:text-base transition-all ${
                      activeType === 'quarterly'
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
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
            <div className="card">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                  {activeCategory === 'cleaning' ? 'Cleaning' : 'Tech'} Checklist - {getTypeLabel(activeType)}
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Complete all tasks below and submit when finished.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {currentTemplate.tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-4 rounded-lg border transition-all cursor-pointer ${
                      completedTasks[task.id]
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-[var(--bg-secondary)] border-[var(--border-secondary)] hover:border-[var(--border-primary)]'
                    }`}
                    onClick={() => handleTaskToggle(task.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                        completedTasks[task.id]
                          ? 'bg-green-500 border-green-500'
                          : 'border-[var(--border-primary)]'
                      }`}>
                        {completedTasks[task.id] && <Check className="w-4 h-4 text-white" />}
                      </div>
                      <span className={`flex-1 ${
                        completedTasks[task.id]
                          ? 'text-[var(--text-primary)]'
                          : 'text-[var(--text-secondary)]'
                      }`}>
                        {task.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Comments and Ticket Section */}
              {isAllTasksCompleted() && (
                <div className="border-t border-[var(--border-secondary)] pt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">
                      Comments (Optional)
                    </label>
                    <textarea
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Add any notes about issues, missing items, or required maintenance..."
                      className="w-full px-4 py-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-50)] transition-colors resize-none"
                      rows={3}
                    />
                  </div>
                  
                  {comments.trim() && (
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="create-ticket"
                        checked={createTicket}
                        onChange={(e) => setCreateTicket(e.target.checked)}
                        className="w-4 h-4 text-[var(--accent)] bg-[var(--bg-secondary)] border-[var(--border-secondary)] rounded focus:ring-[var(--accent)]"
                      />
                      <label htmlFor="create-ticket" className="text-sm text-[var(--text-secondary)] cursor-pointer">
                        Create a support ticket for issues mentioned in comments
                      </label>
                    </div>
                  )}
                </div>
              )}
              
              {/* Progress and Submit */}
              <div className="border-t border-[var(--border-secondary)] pt-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                    <div className="text-sm text-[var(--text-secondary)]">
                      Progress: {Object.values(completedTasks).filter(Boolean).length} / {currentTemplate.tasks.length} tasks
                    </div>
                    <div className="h-2 w-full md:w-48 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
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
                    className={`w-full md:w-auto px-6 py-3 rounded-lg font-medium transition-all ${
                      isAllTasksCompleted() && !isSubmitting
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] cursor-not-allowed'
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
            <div className="card">
              <div className="flex flex-wrap gap-4 items-center">
                {/* Location Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">Location</label>
                  <select
                    value={trackerLocation}
                    onChange={(e) => setTrackerLocation(e.target.value)}
                    className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg text-[var(--text-primary)] min-w-[150px]"
                  >
                    <option value="all">All Locations</option>
                    {locations.map(location => (
                      <option key={location} value={location}>{location}</option>
                    ))}
                  </select>
                </div>

                {/* Time Period Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">Time Period</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTrackerPeriod('week')}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        trackerPeriod === 'week'
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)]'
                      }`}
                    >
                      This Week
                    </button>
                    <button
                      onClick={() => setTrackerPeriod('month')}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        trackerPeriod === 'month'
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)]'
                      }`}
                    >
                      This Month
                    </button>
                    <button
                      onClick={() => setTrackerPeriod('all')}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        trackerPeriod === 'all'
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)]'
                      }`}
                    >
                      All Time
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Submissions Table */}
            <div className="card">
              <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-6">
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
                      <div key={location} className="mb-8 last:mb-0">
                        <h4 className="text-lg font-medium text-[var(--text-primary)] mb-4 flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-[var(--accent)]" />
                          {location}
                          <span className="text-sm text-[var(--text-muted)] font-normal">
                            ({locationSubmissions.length} submission{locationSubmissions.length !== 1 ? 's' : ''})
                          </span>
                        </h4>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-[var(--border-secondary)]">
                                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">User</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Category</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Type</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Tasks</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Completed</th>
                                {(user?.role === 'admin' || user?.role === 'operator') && (
                                  <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Actions</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {locationSubmissions.map((submission) => (
                                <tr key={submission.id} className="border-b border-[var(--border-secondary)] hover:bg-[var(--bg-secondary)]">
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <User className="w-4 h-4 text-[var(--text-muted)]" />
                                      <div>
                                        <div className="text-sm text-[var(--text-primary)]">{submission.user_name}</div>
                                        <div className="text-xs text-[var(--text-muted)]">{submission.user_email}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className={`text-sm font-medium ${getCategoryColor(submission.category)}`}>
                                      {submission.category.charAt(0).toUpperCase() + submission.category.slice(1)}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">
                                    {submission.type.charAt(0).toUpperCase() + submission.type.slice(1)}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <CheckSquare className="w-4 h-4 text-green-500" />
                                      <span className="text-sm text-[var(--text-secondary)]">{submission.total_tasks}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                                      <div>
                                        <div className="text-sm text-[var(--text-secondary)]">
                                          {new Date(submission.completion_time).toLocaleDateString()}
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)]">
                                          {new Date(submission.completion_time).toLocaleTimeString()}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  {(user?.role === 'admin' || user?.role === 'operator') && (
                                    <td className="py-3 px-4">
                                      <button
                                        onClick={() => handleDeleteSubmission(submission.id)}
                                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Delete submission"
                                      >
                                        <Trash2 className="w-4 h-4" />
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