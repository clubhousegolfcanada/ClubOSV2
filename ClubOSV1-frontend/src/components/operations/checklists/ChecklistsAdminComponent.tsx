import { useState, useEffect } from 'react';
import logger from '@/services/logger';
import { http } from '@/api/http';
import toast from 'react-hot-toast';
import { 
  Settings, Copy, Edit2, Trash2, Plus, Save, X, ChevronDown, ChevronRight,
  Package, Camera, QrCode, Clock, MapPin, AlertCircle, TrendingUp,
  FileText, CheckCircle, Download, Upload, Shield, Users, Award, Timer,
  Clipboard, Share2
} from 'lucide-react';
import QRCodeLib from 'qrcode';

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

interface CompletionStats {
  daily: { completed: number; total: number };
  weekly: { completed: number; total: number };
  monthly: { completed: number; total: number };
  topPerformer?: { name: string; count: number };
}

// People category interfaces
interface Person {
  id: string;
  name: string;
  description?: string;
  color?: string;
  active: boolean;
  created_at: string;
}

interface PersonTask {
  id: string;
  person_id: string;
  task_text: string;
  day_of_week: string;
  position: number;
  is_required: boolean;
  active: boolean;
}

export function ChecklistsAdminComponent() {
  const [activeTab, setActiveTab] = useState<'templates' | 'performance' | 'tools' | 'settings' | 'people'>('templates');
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ChecklistTemplate>>({});
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<Partial<ChecklistTask>>({});
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics[]>([]);
  const [completionStats, setCompletionStats] = useState<CompletionStats | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [selectedQrCategory, setSelectedQrCategory] = useState<'cleaning' | 'tech'>('cleaning');
  const [selectedQrType, setSelectedQrType] = useState<'daily' | 'weekly' | 'quarterly'>('daily');
  const [selectedQrLocation, setSelectedQrLocation] = useState('Bedford');
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showAddTaskModal, setShowAddTaskModal] = useState<string | null>(null);
  const [showDeleteTaskConfirm, setShowDeleteTaskConfirm] = useState<string | null>(null);
  const [cloneLocation, setCloneLocation] = useState('');
  const [newTaskText, setNewTaskText] = useState('');
  const [templateToClone, setTemplateToClone] = useState<string | null>(null);
  const [systemConfig, setSystemConfig] = useState({
    requirePhotos: true,
    enableQrCode: true,
    sendNotifications: false
  });
  const [newTemplateForm, setNewTemplateForm] = useState({
    name: '',
    category: 'cleaning' as 'cleaning' | 'tech',
    type: 'daily' as 'daily' | 'weekly' | 'quarterly',
    location: '',
    qr_enabled: true,
    photo_required: false,
    max_duration_minutes: null as number | null
  });

  // People management state
  const [persons, setPersons] = useState<Person[]>([]);
  const [personTasks, setPersonTasks] = useState<Record<string, PersonTask[]>>({});
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const [editingPerson, setEditingPerson] = useState<string | null>(null);
  const [showNewPersonModal, setShowNewPersonModal] = useState(false);
  const [showAddPersonTaskModal, setShowAddPersonTaskModal] = useState<string | null>(null);
  const [showBulkImportModal, setShowBulkImportModal] = useState<string | null>(null);
  const [bulkImportText, setBulkImportText] = useState('');
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [newPersonForm, setNewPersonForm] = useState({ name: '', description: '' });
  const [newPersonTaskForm, setNewPersonTaskForm] = useState({ task_text: '', day_of_week: 'monday' });
  const [loadingPeople, setLoadingPeople] = useState(false);

  const locations = ['Bedford', 'Dartmouth', 'Stratford', 'Bayers Lake', 'Truro'];
  const daysOfWeek = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' },
  ];

  useEffect(() => {
    loadTemplates();
    if (activeTab === 'performance') {
      loadPerformanceMetrics();
      loadCompletionStats();
    }
    if (activeTab === 'people') {
      loadPersons();
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

  // ===== PEOPLE MANAGEMENT FUNCTIONS =====

  const loadPersons = async () => {
    setLoadingPeople(true);
    try {
      const response = await http.get('/checklists-people/persons');
      if (response.data.success) {
        setPersons(response.data.data);
      }
    } catch (error) {
      toast.error('Failed to load persons');
    } finally {
      setLoadingPeople(false);
    }
  };

  const loadPersonTasks = async (personId: string) => {
    try {
      const response = await http.get(`/checklists-people/persons/${personId}/tasks`);
      if (response.data.success) {
        setPersonTasks(prev => ({ ...prev, [personId]: response.data.data }));
      }
    } catch (error) {
      toast.error('Failed to load tasks');
    }
  };

  const handleCreatePerson = async () => {
    if (!newPersonForm.name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      const response = await http.post('/checklists-people/persons', newPersonForm);
      if (response.data.success) {
        toast.success('Person created');
        setShowNewPersonModal(false);
        setNewPersonForm({ name: '', description: '' });
        loadPersons();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create person');
    }
  };

  const handleDeletePerson = async (personId: string) => {
    try {
      await http.delete(`/checklists-people/persons/${personId}`);
      toast.success('Person deactivated');
      loadPersons();
    } catch (error) {
      toast.error('Failed to delete person');
    }
  };

  const handleCreatePersonTask = async (personId: string) => {
    if (!newPersonTaskForm.task_text.trim()) {
      toast.error('Task text is required');
      return;
    }
    try {
      const response = await http.post(`/checklists-people/persons/${personId}/tasks`, newPersonTaskForm);
      if (response.data.success) {
        toast.success('Task added');
        setShowAddPersonTaskModal(null);
        setNewPersonTaskForm({ task_text: '', day_of_week: 'monday' });
        loadPersonTasks(personId);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add task');
    }
  };

  const handleDeletePersonTask = async (taskId: string, personId: string) => {
    try {
      await http.delete(`/checklists-people/tasks/${taskId}`);
      toast.success('Task deleted');
      loadPersonTasks(personId);
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  // Parse bulk import text into tasks organized by day
  const parseBulkImportText = (text: string): { day: string; tasks: string[] }[] => {
    const dayMap: Record<string, string> = {
      'monday': 'monday',
      'tuesday': 'tuesday',
      'wednesday': 'wednesday',
      'thursday': 'thursday',
      'friday': 'friday',
      'saturday': 'saturday',
      'sunday': 'sunday',
    };

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const result: { day: string; tasks: string[] }[] = [];
    let currentDay = 'monday'; // default
    let currentTasks: string[] = [];

    for (const line of lines) {
      // Check if this line is a day header (e.g., "Monday - Location Visits")
      const lowerLine = line.toLowerCase();
      let foundDay: string | null = null;

      for (const [dayName, dayValue] of Object.entries(dayMap)) {
        if (lowerLine.startsWith(dayName)) {
          foundDay = dayValue;
          break;
        }
      }

      if (foundDay) {
        // Save previous day's tasks if any
        if (currentTasks.length > 0) {
          result.push({ day: currentDay, tasks: currentTasks });
        }
        currentDay = foundDay;
        currentTasks = [];
      } else {
        // Clean up the task text - remove checkbox symbols and "Admin" headers
        let taskText = line
          .replace(/^☐\s*/, '')
          .replace(/^-\s*/, '')
          .replace(/^\*\s*/, '')
          .replace(/^•\s*/, '')
          .trim();

        // Skip empty lines, section headers like "Admin", and lines that are just whitespace
        if (taskText &&
            taskText.toLowerCase() !== 'admin' &&
            !taskText.toLowerCase().startsWith('admin')) {
          currentTasks.push(taskText);
        }
      }
    }

    // Don't forget the last day's tasks
    if (currentTasks.length > 0) {
      result.push({ day: currentDay, tasks: currentTasks });
    }

    return result;
  };

  const handleBulkImport = async (personId: string) => {
    const parsed = parseBulkImportText(bulkImportText);

    if (parsed.length === 0) {
      toast.error('No tasks found. Make sure to include day headers like "Monday -"');
      return;
    }

    setBulkImportLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const dayGroup of parsed) {
        for (const taskText of dayGroup.tasks) {
          try {
            await http.post(`/checklists-people/persons/${personId}/tasks`, {
              task_text: taskText,
              day_of_week: dayGroup.day
            });
            successCount++;
          } catch {
            errorCount++;
          }
        }
      }

      if (successCount > 0) {
        toast.success(`Imported ${successCount} task${successCount !== 1 ? 's' : ''}`);
        loadPersonTasks(personId);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} task${errorCount !== 1 ? 's' : ''} failed to import`);
      }

      setShowBulkImportModal(null);
      setBulkImportText('');
    } catch (error) {
      toast.error('Bulk import failed');
    } finally {
      setBulkImportLoading(false);
    }
  };

  const groupTasksByDay = (tasks: PersonTask[]): Record<string, PersonTask[]> => {
    const grouped: Record<string, PersonTask[]> = {};
    for (const task of tasks) {
      if (!grouped[task.day_of_week]) {
        grouped[task.day_of_week] = [];
      }
      grouped[task.day_of_week].push(task);
    }
    // Sort tasks within each day by position
    for (const day of Object.keys(grouped)) {
      grouped[day].sort((a, b) => a.position - b.position);
    }
    return grouped;
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

  const loadCompletionStats = async () => {
    try {
      const response = await http.get('/checklists-v2/stats');
      if (response.data.success) {
        const stats = response.data.data.stats;
        const processedStats: CompletionStats = {
          daily: { completed: 0, total: 5 },
          weekly: { completed: 0, total: 4 },
          monthly: { completed: 0, total: 1 },
          topPerformer: undefined
        };
        
        stats.forEach((stat: any) => {
          if (stat.type === 'daily') {
            processedStats.daily.completed = stat.submission_count;
          } else if (stat.type === 'weekly') {
            processedStats.weekly.completed = stat.submission_count;
          } else if (stat.type === 'quarterly') {
            processedStats.monthly.completed = stat.submission_count;
          }
        });
        
        setCompletionStats(processedStats);
      }
    } catch (error) {
      logger.error('Failed to load completion stats:', error);
    }
  };

  const generateQrCodeForTools = async () => {
    try {
      const checklistUrl = `${window.location.origin}/checklists?category=${selectedQrCategory}&type=${selectedQrType}&location=${encodeURIComponent(selectedQrLocation)}`;
      const qrDataUrl = await QRCodeLib.toDataURL(checklistUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(qrDataUrl);
      toast.success('QR code generated!');
    } catch (error) {
      logger.error('Failed to generate QR code:', error);
      toast.error('Failed to generate QR code');
    }
  };

  const handleCloneTemplate = async () => {
    if (!templateToClone) return;
    try {
      const response = await http.post(`/checklists-v2/templates/${templateToClone}/clone`, {
        location: cloneLocation
      });
      if (response.data.success) {
        toast.success('Template cloned successfully');
        setShowCloneModal(false);
        setCloneLocation('');
        setTemplateToClone(null);
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

  const handleDeleteTemplate = async () => {
    if (!showDeleteConfirm) return;
    
    try {
      const response = await http.delete(`/checklists-v2/templates/${showDeleteConfirm}`);
      if (response.data.success) {
        toast.success('Template deleted');
        setShowDeleteConfirm(null);
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

  const handleAddTask = async () => {
    if (!showAddTaskModal || !newTaskText) return;

    try {
      const response = await http.post(`/checklists-v2/templates/${showAddTaskModal}/tasks`, {
        task_text: newTaskText,
        is_required: true
      });
      if (response.data.success) {
        toast.success('Task added');
        setShowAddTaskModal(null);
        setNewTaskText('');
        loadTemplates();
      }
    } catch (error) {
      toast.error('Failed to add task');
    }
  };

  const handleDeleteTask = async () => {
    if (!showDeleteTaskConfirm) return;
    
    try {
      const response = await http.delete(`/checklists-v2/tasks/${showDeleteTaskConfirm}`);
      if (response.data.success) {
        toast.success('Task deleted');
        setShowDeleteTaskConfirm(null);
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

  const exportCSV = async () => {
    try {
      const response = await http.get('/checklists-v2/submissions/export?format=csv');
      if (response.data.success) {
        const blob = new Blob([response.data.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `checklist-submissions-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        toast.success('CSV exported successfully');
      }
    } catch (error) {
      toast.error('Failed to export CSV');
    }
  };

  const exportPDF = async () => {
    try {
      const response = await http.get('/checklists-v2/submissions/report?format=pdf');
      if (response.data.success) {
        toast.success('PDF report will be sent to your email');
      }
    } catch (error) {
      toast.error('PDF export coming soon');
    }
  };

  const exportSuppliesReport = async () => {
    try {
      const response = await http.get('/checklists-v2/supplies/report');
      if (response.data.success) {
        const blob = new Blob([JSON.stringify(response.data.supplies, null, 2)], 
          { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `supplies-report-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        toast.success('Supplies report exported');
      }
    } catch (error) {
      toast.error('Failed to export supplies report');
    }
  };

  const importTemplates = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const templates = JSON.parse(text);
      
      const response = await http.post('/checklists-v2/templates/import', { templates });
      if (response.data.success) {
        toast.success(`Imported ${response.data.imported} templates`);
        loadTemplates();
      }
    } catch (error) {
      toast.error('Failed to import templates');
    }
  };

  const saveSystemConfig = async () => {
    try {
      const response = await http.put('/checklists-v2/config', systemConfig);
      if (response.data.success) {
        toast.success('System configuration saved');
      }
    } catch (error) {
      toast.error('Failed to save configuration');
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
                  className="px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg 
                           hover:bg-[var(--bg-primary)] border border-[var(--border-primary)]
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
              onClick={() => setActiveTab('tools')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === 'tools'
                  ? 'text-[var(--accent)] border-[var(--accent)]'
                  : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4" />
                Tools
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
            <button
              onClick={() => setActiveTab('people')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === 'people'
                  ? 'text-[var(--accent)] border-[var(--accent)]'
                  : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                People
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
                                onClick={() => {
                                  setTemplateToClone(template.id);
                                  setShowCloneModal(true);
                                }}
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
                                  onClick={() => setShowDeleteConfirm(template.id)}
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
                              className="px-2 py-1 border rounded bg-[var(--bg-primary)] text-[var(--text-primary)] w-20"
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
                              onClick={() => setShowAddTaskModal(template.id)}
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
                                    className="w-full px-2 py-1 border rounded bg-[var(--bg-primary)] text-[var(--text-primary)]"
                                  />
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="text"
                                      value={taskForm.supplies_needed || ''}
                                      onChange={(e) => setTaskForm({ ...taskForm, supplies_needed: e.target.value })}
                                      placeholder="Supplies needed"
                                      className="flex-1 px-2 py-1 border rounded bg-[var(--bg-primary)] text-[var(--text-primary)]"
                                    />
                                    <select
                                      value={taskForm.supplies_urgency || 'low'}
                                      onChange={(e) => setTaskForm({ 
                                        ...taskForm, 
                                        supplies_urgency: e.target.value as 'low' | 'medium' | 'high' 
                                      })}
                                      className="px-2 py-1 border rounded bg-[var(--bg-primary)] text-[var(--text-primary)]"
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
                                      onClick={() => setShowDeleteTaskConfirm(task.id)}
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
            <div className="space-y-6">
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg p-4">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Performance Overview</h3>
                
                {completionStats ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[var(--text-muted)]">Daily Checklists</span>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      </div>
                      <div className="text-2xl font-bold text-[var(--text-primary)]">
                        {completionStats.daily.completed}/{completionStats.daily.total}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-1">
                        {Math.round((completionStats.daily.completed / completionStats.daily.total) * 100)}% completion rate
                      </div>
                    </div>
                    
                    <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[var(--text-muted)]">Weekly Checklists</span>
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="text-2xl font-bold text-[var(--text-primary)]">
                        {completionStats.weekly.completed}/{completionStats.weekly.total}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-1">
                        {Math.round((completionStats.weekly.completed / completionStats.weekly.total) * 100)}% completion rate
                      </div>
                    </div>
                    
                    <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[var(--text-muted)]">Quarterly Checklists</span>
                        <Award className="w-4 h-4 text-purple-500" />
                      </div>
                      <div className="text-2xl font-bold text-[var(--text-primary)]">
                        {completionStats.monthly.completed}/{completionStats.monthly.total}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-1">
                        {Math.round((completionStats.monthly.completed / completionStats.monthly.total) * 100)}% completion rate
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-[var(--text-secondary)]">
                    Loading performance data...
                  </div>
                )}
              </div>

              <div className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">Location Performance</h3>
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
                      <div key={index} className="bg-[var(--bg-tertiary)] rounded-lg p-4 border border-[var(--border-primary)]">
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
              
              {/* Quick Actions for Contractors */}
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg p-4">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button 
                    onClick={exportCSV}
                    className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-left hover:bg-[var(--bg-primary)] transition-colors border border-[var(--border-primary)]">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-[var(--accent)]" />
                      <div>
                        <div className="text-sm font-medium text-[var(--text-primary)]">Export Reports</div>
                        <div className="text-xs text-[var(--text-muted)]">Download completion data as CSV</div>
                      </div>
                    </div>
                  </button>
                  
                  <button 
                    onClick={exportTemplates}
                    className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-left hover:bg-[var(--bg-primary)] transition-colors border border-[var(--border-primary)]">
                    <div className="flex items-center gap-3">
                      <Clipboard className="w-5 h-5 text-[var(--accent)]" />
                      <div>
                        <div className="text-sm font-medium text-[var(--text-primary)]">Template Library</div>
                        <div className="text-xs text-[var(--text-muted)]">Export all checklist templates</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tools Tab */}
          {activeTab === 'tools' && (
            <div className="space-y-6">
              {/* QR Code Generator */}
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg p-4">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                  <QrCode className="inline w-5 h-5 mr-2 text-[var(--accent)]" />
                  QR Code Generator
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <p className="text-sm text-[var(--text-secondary)]">
                      Generate QR codes for quick mobile access to specific checklists. 
                      Perfect for cleaning contractors and field teams.
                    </p>
                    
                    {/* QR Code Settings */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)] uppercase tracking-wider">
                          Category
                        </label>
                        <select
                          value={selectedQrCategory}
                          onChange={(e) => setSelectedQrCategory(e.target.value as 'cleaning' | 'tech')}
                          className="w-full px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded text-xs text-[var(--text-primary)]"
                        >
                          <option value="cleaning">Cleaning</option>
                          <option value="tech">Tech</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)] uppercase tracking-wider">
                          Type
                        </label>
                        <select
                          value={selectedQrType}
                          onChange={(e) => setSelectedQrType(e.target.value as 'daily' | 'weekly' | 'quarterly')}
                          className="w-full px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded text-xs text-[var(--text-primary)]"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="quarterly">Quarterly</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)] uppercase tracking-wider">
                          Location
                        </label>
                        <select
                          value={selectedQrLocation}
                          onChange={(e) => setSelectedQrLocation(e.target.value)}
                          className="w-full px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded text-xs text-[var(--text-primary)]"
                        >
                          {locations.map(location => (
                            <option key={location} value={location}>{location}</option>
                          ))}
                        </select>
                      </div>
                      
                      <button
                        onClick={generateQrCodeForTools}
                        className="w-full px-4 py-2 bg-[var(--accent)] text-white rounded text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        Generate QR Code
                      </button>
                    </div>
                  </div>
                  
                  {/* QR Code Display */}
                  <div className="flex flex-col items-center justify-center">
                    {qrCodeUrl ? (
                      <div className="space-y-3">
                        <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64 border-2 border-[var(--border-secondary)] rounded-lg" />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.download = `checklist-${selectedQrCategory}-${selectedQrType}-${selectedQrLocation}.png`;
                              link.href = qrCodeUrl;
                              link.click();
                            }}
                            className="flex-1 px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded text-xs text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors"
                          >
                            <Download className="inline w-3 h-3 mr-1" />
                            Download
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/checklists?category=${selectedQrCategory}&type=${selectedQrType}&location=${encodeURIComponent(selectedQrLocation)}`);
                              toast.success('Link copied to clipboard!');
                            }}
                            className="flex-1 px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded text-xs text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors"
                          >
                            <Share2 className="inline w-3 h-3 mr-1" />
                            Copy Link
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-8 border-2 border-dashed border-[var(--border-secondary)] rounded-lg">
                        <QrCode className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
                        <p className="text-sm text-[var(--text-secondary)]">
                          Configure settings and generate a QR code
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Export Options */}
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg p-4">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                  <Download className="inline w-5 h-5 mr-2 text-[var(--accent)]" />
                  Export & Reports
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button 
                    onClick={exportCSV}
                    className="p-3 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-primary)] transition-colors border border-[var(--border-primary)]">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-green-500" />
                      <div className="text-left">
                        <div className="text-sm font-medium text-[var(--text-primary)]">CSV Export</div>
                        <div className="text-xs text-[var(--text-muted)]">Download submissions data</div>
                      </div>
                    </div>
                  </button>
                  
                  <button 
                    onClick={exportPDF}
                    className="p-3 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-primary)] transition-colors border border-[var(--border-primary)]">
                    <div className="flex items-center gap-3">
                      <Clipboard className="w-5 h-5 text-blue-500" />
                      <div className="text-left">
                        <div className="text-sm font-medium text-[var(--text-primary)]">PDF Report</div>
                        <div className="text-xs text-[var(--text-muted)]">Generate monthly report</div>
                      </div>
                    </div>
                  </button>
                  
                  <button 
                    onClick={exportSuppliesReport}
                    className="p-3 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-primary)] transition-colors border border-[var(--border-primary)]">
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-purple-500" />
                      <div className="text-left">
                        <div className="text-sm font-medium text-[var(--text-primary)]">Supplies Report</div>
                        <div className="text-xs text-[var(--text-muted)]">View all supplies needed</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
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
                <button 
                  onClick={() => toast('User permissions management coming soon', { icon: 'ℹ️' })}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[#0a3532] 
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
                    className="px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg 
                               hover:bg-[var(--bg-primary)] border border-[var(--border-primary)]
                               transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export All Templates
                  </button>
                  <label className="px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg 
                                  hover:bg-[var(--bg-primary)] border border-[var(--border-primary)]
                                  transition-colors flex items-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Import Templates
                    <input type="file" accept=".json" onChange={importTemplates} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="bg-[var(--bg-secondary)] rounded-lg p-6 border border-[var(--border-primary)]">
                <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  System Configuration
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      className="rounded" 
                      checked={systemConfig.requirePhotos}
                      onChange={(e) => setSystemConfig({...systemConfig, requirePhotos: e.target.checked})}
                    />
                    <span className="text-sm text-[var(--text-primary)]">
                      Require photo attachments for damage reports
                    </span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      className="rounded" 
                      checked={systemConfig.enableQrCode}
                      onChange={(e) => setSystemConfig({...systemConfig, enableQrCode: e.target.checked})}
                    />
                    <span className="text-sm text-[var(--text-primary)]">
                      Enable QR code access for all templates
                    </span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      className="rounded" 
                      checked={systemConfig.sendNotifications}
                      onChange={(e) => setSystemConfig({...systemConfig, sendNotifications: e.target.checked})}
                    />
                    <span className="text-sm text-[var(--text-primary)]">
                      Send notifications for overdue checklists
                    </span>
                  </label>
                </div>
                <div className="mt-4">
                  <button 
                    onClick={saveSystemConfig}
                    className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[#0a3532] 
                               transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Configuration
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* People Tab */}
          {activeTab === 'people' && (
            <div className="space-y-4">
              {/* Header with Add Button */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--text-secondary)]">
                  Manage weekly task lists for staff members
                </p>
                <button
                  onClick={() => setShowNewPersonModal(true)}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Person
                </button>
              </div>

              {/* People List */}
              {loadingPeople ? (
                <div className="text-center py-8 text-[var(--text-secondary)]">
                  Loading people...
                </div>
              ) : persons.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-secondary)]">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No people configured yet</p>
                  <p className="text-sm">Add a person to create their weekly task list</p>
                </div>
              ) : (
                persons.map(person => (
                  <div key={person.id} className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
                    {/* Person Header */}
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              if (expandedPerson === person.id) {
                                setExpandedPerson(null);
                              } else {
                                setExpandedPerson(person.id);
                                loadPersonTasks(person.id);
                              }
                            }}
                            className="text-[var(--text-primary)]"
                          >
                            {expandedPerson === person.id ? (
                              <ChevronDown className="w-5 h-5" />
                            ) : (
                              <ChevronRight className="w-5 h-5" />
                            )}
                          </button>
                          <div>
                            <h3 className="font-semibold text-[var(--text-primary)]">{person.name}</h3>
                            {person.description && (
                              <p className="text-sm text-[var(--text-secondary)]">{person.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded ${person.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {person.active ? 'Active' : 'Inactive'}
                          </span>
                          <button
                            onClick={() => handleDeletePerson(person.id)}
                            className="p-1 text-red-500 hover:text-red-400"
                            title="Deactivate"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Person Tasks */}
                    {expandedPerson === person.id && (
                      <div className="border-t border-[var(--border-primary)] p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium text-[var(--text-primary)]">Weekly Tasks</h4>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowBulkImportModal(person.id)}
                              className="px-3 py-1 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded hover:bg-[var(--bg-primary)] flex items-center gap-1"
                            >
                              <Upload className="w-3 h-3" />
                              Bulk Import
                            </button>
                            <button
                              onClick={() => setShowAddPersonTaskModal(person.id)}
                              className="px-3 py-1 text-sm bg-[var(--accent)] text-white rounded hover:opacity-90 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Add Task
                            </button>
                          </div>
                        </div>

                        {/* Tasks grouped by day */}
                        {personTasks[person.id] && personTasks[person.id].length > 0 ? (
                          <div className="space-y-3">
                            {daysOfWeek.map(day => {
                              const dayTasks = groupTasksByDay(personTasks[person.id])[day.value] || [];
                              if (dayTasks.length === 0) return null;

                              return (
                                <div key={day.value} className="bg-[var(--bg-tertiary)] rounded p-3">
                                  <h5 className="font-medium text-sm text-[var(--accent)] mb-2">{day.label}</h5>
                                  <div className="space-y-1">
                                    {dayTasks.map(task => (
                                      <div key={task.id} className="flex items-center justify-between bg-[var(--bg-primary)] rounded px-3 py-2">
                                        <span className="text-sm text-[var(--text-primary)]">{task.task_text}</span>
                                        <button
                                          onClick={() => handleDeletePersonTask(task.id, person.id)}
                                          className="p-1 text-red-500 hover:text-red-400"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-[var(--text-muted)] text-center py-4">
                            No tasks yet. Add tasks for each day of the week.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* New Person Modal */}
        {showNewPersonModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[var(--bg-secondary)] rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Add New Person</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Name</label>
                  <input
                    type="text"
                    value={newPersonForm.name}
                    onChange={(e) => setNewPersonForm({ ...newPersonForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                    placeholder="e.g., Jamie"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={newPersonForm.description}
                    onChange={(e) => setNewPersonForm({ ...newPersonForm, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                    placeholder="e.g., Location visits and phone coverage"
                  />
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={() => {
                      setShowNewPersonModal(false);
                      setNewPersonForm({ name: '', description: '' });
                    }}
                    className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreatePerson}
                    className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90"
                  >
                    Create Person
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Person Task Modal */}
        {showAddPersonTaskModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[var(--bg-secondary)] rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Add Task</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Day of Week</label>
                  <select
                    value={newPersonTaskForm.day_of_week}
                    onChange={(e) => setNewPersonTaskForm({ ...newPersonTaskForm, day_of_week: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                  >
                    {daysOfWeek.map(day => (
                      <option key={day.value} value={day.value}>{day.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Task</label>
                  <input
                    type="text"
                    value={newPersonTaskForm.task_text}
                    onChange={(e) => setNewPersonTaskForm({ ...newPersonTaskForm, task_text: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                    placeholder="e.g., Visit each location"
                  />
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={() => {
                      setShowAddPersonTaskModal(null);
                      setNewPersonTaskForm({ task_text: '', day_of_week: 'monday' });
                    }}
                    className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleCreatePersonTask(showAddPersonTaskModal)}
                    className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90"
                  >
                    Add Task
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Import Tasks Modal */}
        {showBulkImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[var(--bg-secondary)] rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Bulk Import Tasks</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Paste a task list with day headers. The parser will detect days (Monday, Tuesday, etc.) and tasks automatically.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Task List</label>
                  <textarea
                    value={bulkImportText}
                    onChange={(e) => setBulkImportText(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono text-sm"
                    placeholder={`Monday - Location Visits
☐ Visit each location (Bedford, Dartmouth, etc.)
☐ Calibrate each TrackMan
☐ Check bathrooms

Tuesday - Task Day
☐ Work through ClubOS task list

Friday - Phone Coverage
☐ Cover phone lines`}
                    rows={12}
                  />
                </div>

                {/* Preview */}
                {bulkImportText && (
                  <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
                    <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">Preview</h4>
                    <div className="space-y-2 text-sm">
                      {parseBulkImportText(bulkImportText).map((dayGroup, idx) => (
                        <div key={idx}>
                          <span className="font-medium text-[var(--accent)] capitalize">{dayGroup.day}</span>
                          <span className="text-[var(--text-secondary)]"> ({dayGroup.tasks.length} task{dayGroup.tasks.length !== 1 ? 's' : ''})</span>
                          <ul className="ml-4 text-[var(--text-muted)]">
                            {dayGroup.tasks.slice(0, 3).map((task, tIdx) => (
                              <li key={tIdx}>• {task}</li>
                            ))}
                            {dayGroup.tasks.length > 3 && (
                              <li className="italic">...and {dayGroup.tasks.length - 3} more</li>
                            )}
                          </ul>
                        </div>
                      ))}
                      {parseBulkImportText(bulkImportText).length === 0 && (
                        <p className="text-[var(--text-muted)] italic">No tasks detected. Include day headers like &quot;Monday -&quot;</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={() => {
                      setShowBulkImportModal(null);
                      setBulkImportText('');
                    }}
                    className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    disabled={bulkImportLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleBulkImport(showBulkImportModal)}
                    disabled={bulkImportLoading || !bulkImportText.trim()}
                    className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                  >
                    {bulkImportLoading ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Import Tasks
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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

        {/* Clone Template Modal */}
        {showCloneModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[var(--bg-secondary)] rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
                Clone Template
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                    Location (optional)
                  </label>
                  <select
                    value={cloneLocation}
                    onChange={(e) => setCloneLocation(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                  >
                    <option value="">All Locations</option>
                    {locations.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowCloneModal(false);
                      setCloneLocation('');
                      setTemplateToClone(null);
                    }}
                    className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCloneTemplate}
                    className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[#0a3532]"
                  >
                    Clone Template
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Template Confirmation */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[var(--bg-secondary)] rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
                Confirm Delete
              </h2>
              <p className="text-[var(--text-secondary)] mb-6">
                Are you sure you want to delete this template? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTemplate}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete Template
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Task Modal */}
        {showAddTaskModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[var(--bg-secondary)] rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
                Add New Task
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                    Task Description
                  </label>
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                    placeholder="e.g., Clean simulator screens"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowAddTaskModal(null);
                      setNewTaskText('');
                    }}
                    className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddTask}
                    disabled={!newTaskText.trim()}
                    className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[#0a3532] disabled:opacity-50"
                  >
                    Add Task
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Task Confirmation */}
        {showDeleteTaskConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[var(--bg-secondary)] rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
                Confirm Delete Task
              </h2>
              <p className="text-[var(--text-secondary)] mb-6">
                Are you sure you want to delete this task?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteTaskConfirm(null)}
                  className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTask}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete Task
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}