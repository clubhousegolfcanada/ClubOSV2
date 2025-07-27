import React, { useState, useEffect } from 'react';
import { CheckSquare, Clock, Calendar, User, MapPin, ChevronRight, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

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

  const locations = ['Bedford', 'Dartmouth', 'Stratford', 'Bayers Lake', 'Truro'];

  // Load checklist template
  useEffect(() => {
    loadTemplate();
  }, [activeCategory, activeType]);

  // Load submissions when tracker tab is active
  useEffect(() => {
    if (activeTab === 'tracker') {
      loadSubmissions();
    }
  }, [activeTab]);

  const loadTemplate = async () => {
    try {
      const token = localStorage.getItem('token');
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
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/checklists/submissions?limit=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setSubmissions(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load submissions:', error);
      toast.error('Failed to load submission history');
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
      const token = localStorage.getItem('token');
      const completedTaskIds = Object.keys(completedTasks).filter(id => completedTasks[id]);
      
      const response = await axios.post(
        `${API_URL}/checklists/submit`,
        {
          category: activeCategory,
          type: activeType,
          location: selectedLocation,
          completedTasks: completedTaskIds,
          totalTasks: currentTemplate.tasks.length
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        toast.success('Checklist submitted successfully!');
        setCompletedTasks({});
        
        // Reload submissions if on tracker tab
        if (activeTab === 'tracker') {
          loadSubmissions();
        }
      }
    } catch (error: any) {
      console.error('Failed to submit checklist:', error);
      toast.error(error.response?.data?.error || 'Failed to submit checklist');
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

  return (
    <div className="max-w-7xl mx-auto">
      {/* Tab Navigation */}
      <div className="flex items-center gap-6 mb-6">
        <button
          onClick={() => setActiveTab('checklist')}
          className={`text-lg font-semibold transition-all relative pb-1 ${
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
          className={`text-lg font-semibold transition-all relative pb-1 ${
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
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                      activeCategory === 'cleaning'
                        ? 'bg-blue-500 text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
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
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                      activeCategory === 'tech'
                        ? 'bg-purple-500 text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
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
                      className={`flex-1 px-3 py-3 rounded-lg font-medium transition-all ${
                        activeType === 'daily'
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                      }`}
                    >
                      Daily
                    </button>
                  )}
                  <button
                    onClick={() => setActiveType('weekly')}
                    className={`flex-1 px-3 py-3 rounded-lg font-medium transition-all ${
                      activeType === 'weekly'
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setActiveType('quarterly')}
                    className={`flex-1 px-3 py-3 rounded-lg font-medium transition-all ${
                      activeType === 'quarterly'
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
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

              {/* Progress and Submit */}
              <div className="border-t border-[var(--border-secondary)] pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-[var(--text-secondary)]">
                      Progress: {Object.values(completedTasks).filter(Boolean).length} / {currentTemplate.tasks.length} tasks
                    </div>
                    <div className="h-2 w-48 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
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
                    className={`px-6 py-3 rounded-lg font-medium transition-all ${
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
          <div className="card">
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Recent Submissions</h3>
            
            {loadingSubmissions ? (
              <div className="text-center py-8 text-[var(--text-secondary)]">Loading submissions...</div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-secondary)]">No submissions found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-secondary)]">
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">User</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Category</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Location</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Tasks</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((submission) => (
                      <tr key={submission.id} className="border-b border-[var(--border-secondary)] hover:bg-[var(--bg-secondary)]">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-[var(--text-muted)]" />
                            <span className="text-sm text-[var(--text-primary)]">{submission.user_name}</span>
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
                            <MapPin className="w-4 h-4 text-[var(--text-muted)]" />
                            <span className="text-sm text-[var(--text-secondary)]">{submission.location}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-[var(--text-secondary)]">{submission.total_tasks}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                            <span className="text-sm text-[var(--text-secondary)]">
                              {new Date(submission.completion_time).toLocaleString()}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};