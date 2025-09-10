import { useState, useEffect } from 'react';
import { http } from '@/api/http';
import toast from 'react-hot-toast';
import { 
  Settings, Copy, Edit2, Trash2, Plus, Save, X, ChevronDown, ChevronRight,
  Package, Camera, QrCode, Clock, MapPin, AlertCircle, TrendingUp,
  FileText, CheckCircle, Download, Upload, Shield, Users
} from 'lucide-react';

interface ChecklistTemplate {
  id: string;
  name: string;
  category: 'cleaning' | 'tech';
  type: 'daily' | 'weekly' | 'quarterly';
  location: string | null;
  active: boolean;
  is_master: boolean;
  qr_enabled: boolean;
  photo_required: boolean;
  max_duration_minutes: number | null;
  parent_template_id: string | null;
  created_at: string;
  updated_at: string;
  tasks?: ChecklistTask[];
}

interface ChecklistTask {
  id: string;
  template_id: string;
  task_text: string;
  position: number;
  is_required: boolean;
  supplies_needed?: string;
  supplies_urgency?: 'low' | 'medium' | 'high';
}

interface PerformanceMetrics {
  location: string;
  template_name: string;
  avg_duration: number;
  completion_rate: number;
  on_time_rate: number;
  supplies_reported: number;
  photos_uploaded: number;
}

export function ChecklistsAdminComponent() {
  const [activeTab, setActiveTab] = useState<'templates' | 'performance' | 'settings'>('templates');
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ChecklistTemplate>>({});
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<Partial<ChecklistTask>>({});
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics[]>([]);
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [newTemplateForm, setNewTemplateForm] = useState({
    name: '',
    category: 'cleaning' as 'cleaning' | 'tech',
    type: 'daily' as 'daily' | 'weekly' | 'quarterly',
    location: '',
    qr_enabled: true,
    photo_required: false,
    max_duration_minutes: null as number | null
  });

  const locations = ['Bedford', 'Dartmouth', 'Stratford', 'Bayers Lake', 'Truro'];

  useEffect(() => {
    loadTemplates();
    if (activeTab === 'performance') {
      loadPerformanceMetrics();
    }
  }, [activeTab, selectedLocation]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await http.get('/checklists-v2/templates');
      if (response.data.success) {
        setTemplates(response.data.templates);
      }
    } catch (error) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const loadPerformanceMetrics = async () => {
    try {
      const params = selectedLocation !== 'all' ? `?location=${selectedLocation}` : '';
      const response = await http.get(`/checklists-v2/performance${params}`);
      if (response.data.success) {
        setPerformanceMetrics(response.data.metrics);
      }
    } catch (error) {
      toast.error('Failed to load performance metrics');
    }
  };

  const handleCloneTemplate = async (templateId: string) => {
    try {
      const response = await http.post(`/checklists-v2/templates/${templateId}/clone`, {
        location: prompt('Enter location for cloned template (or leave empty for all locations):')
      });
      if (response.data.success) {
        toast.success('Template cloned successfully');
        loadTemplates();
      }
    } catch (error) {
      toast.error('Failed to clone template');
    }
  };

  const handleUpdateTemplate = async (templateId: string) => {
    try {
      const response = await http.put(`/checklists-v2/templates/${templateId}`, editForm);
      if (response.data.success) {
        toast.success('Template updated');
        setEditingTemplate(null);
        loadTemplates();
      }
    } catch (error) {
      toast.error('Failed to update template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      const response = await http.delete(`/checklists-v2/templates/${templateId}`);
      if (response.data.success) {
        toast.success('Template deleted');
        loadTemplates();
      }
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const handleUpdateTask = async (taskId: string) => {
    try {
      const response = await http.put(`/checklists-v2/tasks/${taskId}`, taskForm);
      if (response.data.success) {
        toast.success('Task updated');
        setEditingTask(null);
        loadTemplates();
      }
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleAddTask = async (templateId: string) => {
    const taskText = prompt('Enter new task description:');
    if (!taskText) return;

    try {
      const response = await http.post(`/checklists-v2/templates/${templateId}/tasks`, {
        task_text: taskText,
        is_required: true
      });
      if (response.data.success) {
        toast.success('Task added');
        loadTemplates();
      }
    } catch (error) {
      toast.error('Failed to add task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      const response = await http.delete(`/checklists-v2/tasks/${taskId}`);
      if (response.data.success) {
        toast.success('Task deleted');
        loadTemplates();
      }
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const handleCreateTemplate = async () => {
    try {
      const response = await http.post('/checklists-v2/templates', newTemplateForm);
      if (response.data.success) {
        toast.success('Template created');
        setShowNewTemplateModal(false);
        setNewTemplateForm({
          name: '',
          category: 'cleaning',
          type: 'daily',
          location: '',
          qr_enabled: true,
          photo_required: false,
          max_duration_minutes: null
        });
        loadTemplates();
      }
    } catch (error) {
      toast.error('Failed to create template');
    }
  };

  const generateQRCode = async (templateId: string, location: string) => {
    try {
      const response = await http.post(`/checklists-v2/templates/${templateId}/qr-code`, {
        location
      });
      if (response.data.success && response.data.qr_code) {
        // Create download link
        const link = document.createElement('a');
        link.href = response.data.qr_code;
        link.download = `checklist-qr-${location || 'all'}.png`;
        link.click();
        toast.success('QR code generated');
      }
    } catch (error) {
      toast.error('Failed to generate QR code');
    }
  };

  const exportTemplates = async () => {
    try {
      const response = await http.get('/checklists-v2/templates/export');
      if (response.data.success) {
        const blob = new Blob([JSON.stringify(response.data.templates, null, 2)], 
          { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'checklist-templates.json';
        link.click();
        toast.success('Templates exported');
      }
    } catch (error) {
      toast.error('Failed to export templates');
    }
  };

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="pb-12">
      <div className="px-3 sm:px-4 py-4 sm:py-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
                Checklist Administration
              </h1>
              <div className="flex gap-2">
                <button
                  onClick={exportTemplates}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 
                           transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button
                  onClick={() => setShowNewTemplateModal(true)}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[#0a3532] 
                           transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Template
                </button>
              </div>
            </div>
            <p className="text-[var(--text-secondary)] text-sm">
              Manage checklist templates, track performance, and configure settings
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-[var(--border-primary)]">
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === 'templates'
                  ? 'text-[var(--accent)] border-[var(--accent)]'
                  : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Templates
              </div>
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === 'performance'
                  ? 'text-[var(--accent)] border-[var(--accent)]'
                  : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Performance
              </div>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === 'settings'
                  ? 'text-[var(--accent)] border-[var(--accent)]'
                  : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </div>
            </button>
          </div>

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-8 text-[var(--text-secondary)]">
                  Loading templates...
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-secondary)]">
                  No templates found
                </div>
              ) : (
                templates.map(template => (
                  <div key={template.id} className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
                    <div className="p-4">
                      {/* Template Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setExpandedTemplate(
                              expandedTemplate === template.id ? null : template.id
                            )}
                            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          >
                            {expandedTemplate === template.id ? (
                              <ChevronDown className="w-5 h-5" />
                            ) : (
                              <ChevronRight className="w-5 h-5" />
                            )}
                          </button>
                          
                          {editingTemplate === template.id ? (
                            <input
                              type="text"
                              value={editForm.name || ''}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="px-2 py-1 border rounded bg-[var(--bg-primary)] text-[var(--text-primary)]"
                            />
                          ) : (
                            <h3 className="font-semibold text-[var(--text-primary)]">
                              {template.name}
                            </h3>
                          )}
                          
                          <span className={`px-2 py-1 text-xs rounded ${
                            template.category === 'cleaning' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {template.category}
                          </span>
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                            {template.type}
                          </span>
                          {template.location && (
                            <span className="flex items-center gap-1 text-sm text-[var(--text-secondary)]">
                              <MapPin className="w-3 h-3" />
                              {template.location}
                            </span>
                          )}
                          {template.is_master && (
                            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              Master
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {template.qr_enabled && (
                            <button
                              onClick={() => generateQRCode(template.id, template.location || '')}
                              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                              title="Generate QR Code"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                          )}
                          {template.photo_required && (
                            <span title="Photos Required">
                              <Camera className="w-4 h-4 text-[var(--text-secondary)]" />
                            </span>
                          )}
                          {template.max_duration_minutes && (
                            <span className="flex items-center gap-1 text-sm text-[var(--text-secondary)]">
                              <Clock className="w-3 h-3" />
                              {template.max_duration_minutes}m
                            </span>
                          )}
                          
                          {editingTemplate === template.id ? (
                            <>
                              <button
                                onClick={() => handleUpdateTemplate(template.id)}
                                className="p-2 text-green-600 hover:text-green-700"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingTemplate(null)}
                                className="p-2 text-gray-600 hover:text-gray-700"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleCloneTemplate(template.id)}
                                className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                title="Clone Template"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingTemplate(template.id);
                                  setEditForm(template);
                                }}
                                className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                title="Edit Template"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {!template.is_master && (
                                <button
                                  onClick={() => handleDeleteTemplate(template.id)}
                                  className="p-2 text-red-600 hover:text-red-700"
                                  title="Delete Template"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Template Settings (when editing) */}
                      {editingTemplate === template.id && (
                        <div className="mt-4 p-3 bg-[var(--bg-primary)] rounded-lg space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editForm.active}
                                onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                                className="rounded"
                              />
                              <span className="text-sm">Active</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editForm.qr_enabled}
                                onChange={(e) => setEditForm({ ...editForm, qr_enabled: e.target.checked })}
                                className="rounded"
                              />
                              <span className="text-sm">QR Enabled</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editForm.photo_required}
                                onChange={(e) => setEditForm({ ...editForm, photo_required: e.target.checked })}
                                className="rounded"
                              />
                              <span className="text-sm">Photos Required</span>
                            </label>
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="text-sm">Max Duration (minutes):</label>
                            <input
                              type="number"
                              value={editForm.max_duration_minutes || ''}
                              onChange={(e) => setEditForm({ 
                                ...editForm, 
                                max_duration_minutes: e.target.value ? parseInt(e.target.value) : null 
                              })}
                              className="px-2 py-1 border rounded bg-white text-[var(--text-primary)] w-20"
                            />
                          </div>
                        </div>
                      )}

                      {/* Tasks (when expanded) */}
                      {expandedTemplate === template.id && template.tasks && (
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-[var(--text-primary)]">Tasks</h4>
                            <button
                              onClick={() => handleAddTask(template.id)}
                              className="px-3 py-1 bg-[var(--accent)] text-white text-sm rounded hover:bg-[#0a3532] 
                                       flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Add Task
                            </button>
                          </div>
                          
                          {template.tasks.map((task, index) => (
                            <div key={task.id} className="p-3 bg-[var(--bg-primary)] rounded-lg">
                              {editingTask === task.id ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={taskForm.task_text || ''}
                                    onChange={(e) => setTaskForm({ ...taskForm, task_text: e.target.value })}
                                    className="w-full px-2 py-1 border rounded bg-white text-[var(--text-primary)]"
                                  />
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="text"
                                      value={taskForm.supplies_needed || ''}
                                      onChange={(e) => setTaskForm({ ...taskForm, supplies_needed: e.target.value })}
                                      placeholder="Supplies needed"
                                      className="flex-1 px-2 py-1 border rounded bg-white text-[var(--text-primary)]"
                                    />
                                    <select
                                      value={taskForm.supplies_urgency || 'low'}
                                      onChange={(e) => setTaskForm({ 
                                        ...taskForm, 
                                        supplies_urgency: e.target.value as 'low' | 'medium' | 'high' 
                                      })}
                                      className="px-2 py-1 border rounded bg-white text-[var(--text-primary)]"
                                    >
                                      <option value="low">Low</option>
                                      <option value="medium">Medium</option>
                                      <option value="high">High</option>
                                    </select>
                                    <button
                                      onClick={() => handleUpdateTask(task.id)}
                                      className="p-1 text-green-600 hover:text-green-700"
                                    >
                                      <Save className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setEditingTask(null)}
                                      className="p-1 text-gray-600 hover:text-gray-700"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[var(--text-secondary)]">{index + 1}.</span>
                                      <span className="text-[var(--text-primary)]">{task.task_text}</span>
                                      {task.is_required && (
                                        <span className="text-xs text-red-500">*Required</span>
                                      )}
                                    </div>
                                    {task.supplies_needed && (
                                      <div className="flex items-center gap-2 mt-1 ml-6">
                                        <Package className="w-3 h-3 text-[var(--text-secondary)]" />
                                        <span className="text-sm text-[var(--text-secondary)]">
                                          {task.supplies_needed}
                                        </span>
                                        <span className={`text-xs ${getUrgencyColor(task.supplies_urgency)}`}>
                                          ({task.supplies_urgency})
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        setEditingTask(task.id);
                                        setTaskForm(task);
                                      }}
                                      className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTask(task.id)}
                                      className="p-1 text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Performance Tab */}
          {activeTab === 'performance' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <label className="text-sm font-medium text-[var(--text-primary)]">Location:</label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                >
                  <option value="all">All Locations</option>
                  {locations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              {performanceMetrics.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-secondary)]">
                  No performance data available
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {performanceMetrics.map((metric, index) => (
                    <div key={index} className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-primary)]">
                      <h3 className="font-semibold text-[var(--text-primary)] mb-3">
                        {metric.template_name}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Location:</span>
                          <span className="text-[var(--text-primary)]">{metric.location}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Avg Duration:</span>
                          <span className="text-[var(--text-primary)]">{metric.avg_duration}m</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Completion Rate:</span>
                          <span className="text-[var(--text-primary)]">{metric.completion_rate}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">On-Time Rate:</span>
                          <span className="text-[var(--text-primary)]">{metric.on_time_rate}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Supplies Reported:</span>
                          <span className="text-[var(--text-primary)]">{metric.supplies_reported}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Photos Uploaded:</span>
                          <span className="text-[var(--text-primary)]">{metric.photos_uploaded}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-[var(--bg-secondary)] rounded-lg p-6 border border-[var(--border-primary)]">
                <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Access Control
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  Manage which users can access specific locations
                </p>
                <button className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[#0a3532] 
                               transition-colors flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Manage User Permissions
                </button>
              </div>

              <div className="bg-[var(--bg-secondary)] rounded-lg p-6 border border-[var(--border-primary)]">
                <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Import/Export
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  Backup templates or import from another system
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={exportTemplates}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 
                               transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export All Templates
                  </button>
                  <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 
                               transition-colors flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Import Templates
                  </button>
                </div>
              </div>

              <div className="bg-[var(--bg-secondary)] rounded-lg p-6 border border-[var(--border-primary)]">
                <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  System Configuration
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="rounded" defaultChecked />
                    <span className="text-sm text-[var(--text-primary)]">
                      Require photo attachments for damage reports
                    </span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="rounded" defaultChecked />
                    <span className="text-sm text-[var(--text-primary)]">
                      Enable QR code access for all templates
                    </span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm text-[var(--text-primary)]">
                      Send notifications for overdue checklists
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Template Modal */}
      {showNewTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
              Create New Template
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newTemplateForm.name}
                  onChange={(e) => setNewTemplateForm({ ...newTemplateForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                  placeholder="e.g., Daily Cleaning - Bedford"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                    Category
                  </label>
                  <select
                    value={newTemplateForm.category}
                    onChange={(e) => setNewTemplateForm({ 
                      ...newTemplateForm, 
                      category: e.target.value as 'cleaning' | 'tech' 
                    })}
                    className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                  >
                    <option value="cleaning">Cleaning</option>
                    <option value="tech">Tech</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                    Type
                  </label>
                  <select
                    value={newTemplateForm.type}
                    onChange={(e) => setNewTemplateForm({ 
                      ...newTemplateForm, 
                      type: e.target.value as 'daily' | 'weekly' | 'quarterly' 
                    })}
                    className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Location (optional)
                </label>
                <select
                  value={newTemplateForm.location}
                  onChange={(e) => setNewTemplateForm({ ...newTemplateForm, location: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                >
                  <option value="">All Locations</option>
                  {locations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newTemplateForm.qr_enabled}
                    onChange={(e) => setNewTemplateForm({ 
                      ...newTemplateForm, 
                      qr_enabled: e.target.checked 
                    })}
                    className="rounded"
                  />
                  <span className="text-sm text-[var(--text-primary)]">Enable QR code access</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newTemplateForm.photo_required}
                    onChange={(e) => setNewTemplateForm({ 
                      ...newTemplateForm, 
                      photo_required: e.target.checked 
                    })}
                    className="rounded"
                  />
                  <span className="text-sm text-[var(--text-primary)]">Require photo attachments</span>
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Max Duration (minutes, optional)
                </label>
                <input
                  type="number"
                  value={newTemplateForm.max_duration_minutes || ''}
                  onChange={(e) => setNewTemplateForm({ 
                    ...newTemplateForm, 
                    max_duration_minutes: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                  placeholder="e.g., 30"
                />
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowNewTemplateModal(false)}
                  className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTemplate}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[#0a3532]"
                >
                  Create Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}