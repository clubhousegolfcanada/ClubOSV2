import { useState, useEffect } from 'react';
import Head from 'next/head';
import { hasMinimumRole } from '@/utils/roleUtils';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { 
  CheckSquare,
  RefreshCw,
  Calendar,
  Clock,
  MapPin,
  AlertCircle,
  Check,
  X,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  Save
} from 'lucide-react';

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

// Sample data - this would come from the database
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

const categoryConfig = {
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

export default function CleaningChecklists() {
  const router = useRouter();
  const { user } = useAuthState();
  const [activeTab, setActiveTab] = useState<'checklists' | 'schedule'>('checklists');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [checklists, setChecklists] = useState<Checklist[]>(sampleChecklists);
  const [activeChecklist, setActiveChecklist] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});
  const [isEditMode, setIsEditMode] = useState(false);

  // Check authentication
  useEffect(() => {
    if (!user || !hasMinimumRole(user?.role, 'operator')) {
      router.push('/login');
    }
  }, [user, router]);

  // Filter checklists
  const filteredChecklists = checklists.filter(checklist => {
    const matchesCategory = selectedCategory === 'all' || checklist.category === selectedCategory;
    const matchesLocation = selectedLocation === 'all' || checklist.location === selectedLocation;
    return matchesCategory && matchesLocation;
  });

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

  if (!user) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Cleaning Checklists - ClubOS</title>
      </Head>
      
      <main className="min-h-screen bg-[var(--bg-primary)]">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center gap-6 mb-6">
              <button
                onClick={() => setActiveTab('checklists')}
                className={`text-2xl font-semibold transition-all relative pb-1 ${
                  activeTab === 'checklists' 
                    ? 'text-[var(--text-primary)]' 
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                Checklists
                {activeTab === 'checklists' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]"></div>
                )}
              </button>
              <button
                onClick={() => setActiveTab('schedule')}
                className={`text-2xl font-semibold transition-all relative pb-1 ${
                  activeTab === 'schedule' 
                    ? 'text-[var(--text-primary)]' 
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                Schedule
                {activeTab === 'schedule' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]"></div>
                )}
              </button>
            </div>
            
            <p className="text-[var(--text-secondary)] text-sm font-light max-w-3xl">
              {activeTab === 'checklists' 
                ? 'Manage daily cleaning tasks and maintenance checklists for all locations.'
                : 'View and manage the cleaning schedule across all facilities.'}
            </p>
          </div>

          {activeTab === 'checklists' ? (
            <>
              {/* Filters */}
              <div className="flex flex-wrap gap-4 mb-8">
                {/* Category Filter */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedCategory === 'all'
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    All Categories
                  </button>
                  {Object.entries(categoryConfig).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedCategory(key)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedCategory === key
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
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="all">All Locations</option>
                  <option value="Bedford">Bedford</option>
                  <option value="Dartmouth">Dartmouth</option>
                  <option value="Stratford">Stratford</option>
                  <option value="Truro">Truro</option>
                  <option value="Bayers Lake">Bayers Lake</option>
                </select>

                {/* Edit Mode Toggle */}
                {hasMinimumRole(user.role, 'admin') && (
                  <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    className={`ml-auto px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                      isEditMode
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    <Edit2 className="w-4 h-4" />
                    {isEditMode ? 'Done Editing' : 'Edit Mode'}
                  </button>
                )}
              </div>

              {/* Checklists Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filteredChecklists.map((checklist) => {
                  const config = categoryConfig[checklist.category];
                  const Icon = config.icon;
                  const isActive = activeChecklist === checklist.id;
                  const completedCount = checklist.items.filter(item => completedTasks[item.id]).length;
                  const progress = (completedCount / checklist.items.length) * 100;
                  
                  return (
                    <div
                      key={checklist.id}
                      className={`card group transition-all ${
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
                              className="px-4 py-2 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setActiveChecklist(null)}
                              className="px-4 py-2 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>

                      {/* Edit Actions */}
                      {isEditMode && (
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
                {isEditMode && (
                  <button className="card border-2 border-dashed border-[var(--border-secondary)] hover:border-[var(--accent)] transition-all flex flex-col items-center justify-center gap-3 min-h-[200px]">
                    <Plus className="w-8 h-8 text-[var(--text-muted)]" />
                    <span className="text-[var(--text-secondary)]">Add New Checklist</span>
                  </button>
                )}
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
        </div>
      </main>
    </>
  );
}