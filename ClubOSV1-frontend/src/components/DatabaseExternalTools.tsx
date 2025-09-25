import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ExternalLink, Monitor, Calendar, Users, Shield, CreditCard, Activity, HardDrive, Edit2, Save, X, Loader, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useAuthState } from '@/state/useStore';
import { useNotifications } from '@/state/hooks';
import { userSettingsApi } from '@/services/userSettings';
import { useRouter } from 'next/router';
import { http } from '@/api/http';
import logger from '@/services/logger';

interface QuickStat {
  label: string;
  value: string;
  change?: string;
  trend: 'up' | 'down' | 'neutral';
  isButton?: boolean;
  onClick?: () => void;
  buttonText?: string;
  statusIndicator?: boolean;
}

interface DatabaseExternalToolsProps {
  quickStats?: QuickStat[];
}

// Default URLs
const DEFAULT_EXTERNAL_TOOLS = {
  REMOTE_DESKTOP: 'https://my.splashtop.com/computers',
  BOOKING_SITE: 'https://clubhouse247golf.skedda.com/booking',
  CUSTOMER_INFO: 'https://app.hubspot.com',
  ACCESS_CAMERAS: 'https://unifi.ui.com',
  STRIPE_RETURNS: 'https://dashboard.stripe.com',
  TRACKMAN_PORTAL: 'https://login.trackmangolf.com/Account/Login?ReturnUrl=%2Fconnect%2Fauthorize%2Fcallback%3Fclient_id%3Ddr-web.4633fada-3b16-490f-8de7-2aa67158a1d6%26scope%3Dopenid%2520profile%2520email%2520offline_access%2520https%253A%252F%252Fauth.trackman.com%252Fdr%252Fcloud%2520https%253A%252F%252Fauth.trackman.com%252Fauthorization%2520https%253A%252F%252Fauth.trackman.com%252Fproamevent%26response_type%3Dcode%26redirect_uri%3Dhttps%253A%252F%252Fportal.trackmangolf.com%252Faccount%252Fcallback%26nonce%3D08fBNss-AVg9eR2T8pu2JKKfZGk8sWH9vzCqjPrG8z8%26state%3DeyJyZXR1cm5UbyI6Ii8ifQ%26code_challenge_method%3DS256%26code_challenge%3D06sJEm0-gkB1i-I4J_FdgtLpWCeNkX4OWn2CmMmEmcY',
  GOOGLE_DRIVE: 'https://drive.google.com'
};

const DatabaseExternalTools: React.FC<DatabaseExternalToolsProps> = ({ quickStats = [] }) => {
  const { user } = useAuthState();
  const { notify } = useNotifications();
  const router = useRouter();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editedUrls, setEditedUrls] = useState<Record<string, string>>({});
  const [savedUrls, setSavedUrls] = useState<Record<string, string>>({});
  const [isTasksCollapsed, setIsTasksCollapsed] = useState(false);
  const [isLinksCollapsed, setIsLinksCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Task states
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTask, setNewTask] = useState('');
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  // All users can now edit their own links - but not on mobile
  const canEdit = !!user && !isMobile;

  // Load collapsed state from localStorage and detect mobile
  useEffect(() => {
    // Detect mobile
    const checkMobile = () => {
      const mobile = window.innerWidth < 640; // sm breakpoint
      setIsMobile(mobile);
      
      // Set initial collapsed state for links
      const savedLinksState = localStorage.getItem('linksSectionCollapsed');
      if (savedLinksState !== null) {
        setIsLinksCollapsed(savedLinksState === 'true');
      } else {
        // Default to collapsed on mobile only
        setIsLinksCollapsed(mobile);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Load tasks collapsed state
    const savedTasksState = localStorage.getItem('tasksSectionCollapsed');
    if (savedTasksState !== null) {
      setIsTasksCollapsed(savedTasksState === 'true');
    }

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load tasks when user is authenticated
  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user]);

  // Save collapsed state to localStorage
  const toggleTasksCollapsed = () => {
    const newState = !isTasksCollapsed;
    setIsTasksCollapsed(newState);
    localStorage.setItem('tasksSectionCollapsed', String(newState));
  };

  // Task management functions
  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const response = await http.get('tasks');
      if (response.data.success) {
        setTasks(response.data.data);
      }
    } catch (error) {
      logger.error('Failed to load tasks:', error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    try {
      await http.post('tasks', { text: newTask });
      setNewTask('');
      loadTasks();
    } catch (error) {
      notify('error', 'Failed to add task');
    }
  };

  const toggleTask = async (id: string, completed: boolean) => {
    try {
      await http.patch(`tasks/${id}`, { is_completed: completed });
      loadTasks();
    } catch (error) {
      notify('error', 'Failed to update task');
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await http.delete(`tasks/${id}`);
      loadTasks();
    } catch (error) {
      notify('error', 'Failed to delete task');
    }
  };
  
  const toggleLinksCollapsed = () => {
    const newState = !isLinksCollapsed;
    setIsLinksCollapsed(newState);
    localStorage.setItem('linksSectionCollapsed', String(newState));
  };

  // Tool definitions (name and icon are locked)
  const tools = [
    {
      id: 'REMOTE_DESKTOP',
      name: 'Remote Desktop',
      subtitle: 'Splashtop',
      icon: Monitor,
      color: '#FFFFFF'
    },
    {
      id: 'BOOKING_SITE',
      name: 'Booking Site',
      subtitle: 'Skedda',
      icon: Calendar,
      color: '#FFFFFF'
    },
    {
      id: 'CUSTOMER_INFO',
      name: 'Customer Info',
      subtitle: 'HubSpot',
      icon: Users,
      color: '#FFFFFF'
    },
    {
      id: 'ACCESS_CAMERAS',
      name: 'Access & Cameras',
      subtitle: 'UniFi',
      icon: Shield,
      color: '#FFFFFF'
    },
    {
      id: 'STRIPE_RETURNS',
      name: 'Returns',
      subtitle: 'Stripe',
      icon: CreditCard,
      color: '#FFFFFF'
    },
    {
      id: 'TRACKMAN_PORTAL',
      name: 'Simulator Portal',
      subtitle: 'Trackman',
      icon: Activity,
      color: '#FF9800'
    },
    {
      id: 'GOOGLE_DRIVE',
      name: 'File Search',
      subtitle: 'Google Drive',
      icon: HardDrive,
      color: '#FFFFFF'
    }
  ];

  // Load saved URLs from database on mount
  useEffect(() => {
    const loadUserSettings = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      try {
        const links = await userSettingsApi.getExternalLinks();
        if (links) {
          setSavedUrls(links);
        }
      } catch (error) {
        logger.error('Failed to load user settings:', error);
        notify('error', 'Failed to load your custom links');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserSettings();
  }, [user, notify]);

  // Get the current URL for a tool
  const getToolUrl = (toolId: string) => {
    // Priority: edited URL > saved URL > environment variable > default
    if (isEditMode && editedUrls[toolId] !== undefined) {
      return editedUrls[toolId];
    }
    if (savedUrls[toolId]) {
      return savedUrls[toolId];
    }
    if (process.env[`NEXT_PUBLIC_${toolId}_URL`]) {
      return process.env[`NEXT_PUBLIC_${toolId}_URL`]!;
    }
    return DEFAULT_EXTERNAL_TOOLS[toolId as keyof typeof DEFAULT_EXTERNAL_TOOLS];
  };

  const handleToolClick = (url: string, toolName?: string) => {
    if (!isEditMode && url) {
      // Special handling for Splashtop on all platforms
      if (toolName === 'Remote Desktop') {
        const userAgent = navigator.userAgent;
        const isIOS = /iPhone|iPad|iPod/.test(userAgent) && !/Mac/.test(userAgent);
        const isAndroid = /Android/.test(userAgent);
        const isMac = /Mac/.test(userAgent) && !isIOS;
        const isWindows = /Windows/.test(userAgent);
        const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                      window.matchMedia('(display-mode: minimal-ui)').matches ||
                      window.matchMedia('(display-mode: fullscreen)').matches;
        
        logger.debug(`Platform detection - iOS: ${isIOS}, Android: ${isAndroid}, Mac: ${isMac}, Windows: ${isWindows}, PWA: ${isPWA}`);
        
        if (isIOS) {
          // iOS: Try multiple URL schemes for Splashtop Business app
          logger.debug('iOS detected - attempting to open Splashtop Business app...');
          
          // Try different URL schemes
          const schemes = [
            'splashtopbusiness://',  // Splashtop Business specific
            'splashtop://',          // Generic Splashtop
            'stbusiness://'          // Alternative Business scheme
          ];
          
          let schemeIndex = 0;
          const tryNextScheme = () => {
            if (schemeIndex < schemes.length) {
              const scheme = schemes[schemeIndex];
              logger.debug(`Trying iOS scheme: ${scheme}`);
              
              // Create invisible iframe to attempt app launch
              const iframe = document.createElement('iframe');
              iframe.style.display = 'none';
              iframe.src = scheme;
              document.body.appendChild(iframe);
              
              setTimeout(() => {
                document.body.removeChild(iframe);
                schemeIndex++;
                
                // Check if page is still visible (app didn't open)
                if (!document.hidden && schemeIndex < schemes.length) {
                  tryNextScheme();
                } else if (!document.hidden && schemeIndex >= schemes.length) {
                  // All schemes failed, fallback to web
                  logger.debug('No iOS app found, opening web portal...');
                  window.open(url, '_blank', 'noopener,noreferrer');
                }
              }, 500);
            }
          };
          
          tryNextScheme();
          
        } else if (isAndroid) {
          // Android: Use intent for Splashtop Business app
          logger.debug('Android detected - attempting to open Splashtop Business app...');
          
          // Try Splashtop Business package first
          const businessIntent = `intent://open#Intent;scheme=splashtopbusiness;package=com.splashtop.remote.business;S.browser_fallback_url=${encodeURIComponent(url)};end`;
          window.location.href = businessIntent;
          
        } else if (isMac || isWindows) {
          // Desktop: Try to open desktop app first, then fallback to web
          logger.debug(`Desktop ${isMac ? 'Mac' : 'Windows'} detected - attempting to open Splashtop Business desktop app...`);
          
          // Try desktop URL schemes
          const desktopScheme = 'splashtopbusiness://';
          
          // Create invisible iframe to attempt desktop app launch
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = desktopScheme;
          document.body.appendChild(iframe);
          
          // Set up fallback to web portal
          setTimeout(() => {
            document.body.removeChild(iframe);
            // Always open web portal as backup on desktop
            logger.debug('Opening web portal as fallback/primary option...');
            window.open(url, '_blank', 'noopener,noreferrer');
          }, 1000);
          
        } else {
          // Unknown platform: Open web portal
          logger.debug('Unknown platform - opening web portal...');
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } else {
        // For all other tools, use standard web opening
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleEditToggle = () => {
    if (!user) {
      notify('error', 'Please log in to customize links');
      return;
    }
    
    if (isEditMode) {
      // Cancel edit mode - discard changes
      setEditedUrls({});
      setIsEditMode(false);
    } else {
      // Enter edit mode - initialize with current URLs
      const currentUrls: Record<string, string> = {};
      tools.forEach(tool => {
        currentUrls[tool.id] = getToolUrl(tool.id);
      });
      setEditedUrls(currentUrls);
      setIsEditMode(true);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Filter out default URLs - only save customized ones
      const urlsToSave: Record<string, string> = {};
      tools.forEach(tool => {
        const url = editedUrls[tool.id];
        if (url && url !== DEFAULT_EXTERNAL_TOOLS[tool.id as keyof typeof DEFAULT_EXTERNAL_TOOLS]) {
          urlsToSave[tool.id] = url;
        }
      });
      
      // Save to database
      await userSettingsApi.saveExternalLinks(urlsToSave);
      
      setSavedUrls(urlsToSave);
      setIsEditMode(false);
      setEditedUrls({});
      notify('success', 'External links updated successfully');
    } catch (error) {
      logger.error('Failed to save links:', error);
      notify('error', 'Failed to save your custom links');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUrlChange = (toolId: string, value: string) => {
    setEditedUrls(prev => ({
      ...prev,
      [toolId]: value
    }));
  };

  const handleReset = (toolId: string) => {
    setEditedUrls(prev => ({
      ...prev,
      [toolId]: DEFAULT_EXTERNAL_TOOLS[toolId as keyof typeof DEFAULT_EXTERNAL_TOOLS]
    }));
  };

  const handleResetAll = () => {
    const defaultUrls: Record<string, string> = {};
    tools.forEach(tool => {
      defaultUrls[tool.id] = DEFAULT_EXTERNAL_TOOLS[tool.id as keyof typeof DEFAULT_EXTERNAL_TOOLS];
    });
    setEditedUrls(defaultUrls);
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-8">
          <Loader className="w-6 h-6 animate-spin text-[var(--accent)]" />
        </div>
      </div>
    );
  }


  return (
    <div className="card">
      <div className="space-y-3">
        {/* Tasks Section - Personal Todo List */}
        <div>
          <button
            onClick={toggleTasksCollapsed}
            className="w-full flex items-center justify-between text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] mb-3 hover:text-[var(--text-primary)] transition-colors"
          >
            <span>My Tasks</span>
            <div className="flex items-center gap-2">
              {isTasksCollapsed && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="bg-[var(--bg-tertiary)] px-2 py-1 rounded">
                    {tasks.filter(t => !t.is_completed).length} active
                  </span>
                </div>
              )}
              {isTasksCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </div>
          </button>

          {/* Collapsible Content */}
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
            isTasksCollapsed ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'
          }`}>
            {/* Add Task Input */}
            {user && (
              <div className="flex gap-1.5 mb-3">
                <input
                  type="text"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTask()}
                  placeholder="Add a task..."
                  className="flex-1 px-2 py-1.5 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  onClick={addTask}
                  className="px-3 py-1.5 bg-[var(--accent)] text-white rounded text-xs hover:opacity-90"
                >
                  Add
                </button>
              </div>
            )}

            {/* Task List */}
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {loadingTasks ? (
                <div className="text-center py-4">
                  <Loader className="w-4 h-4 animate-spin mx-auto text-[var(--accent)]" />
                </div>
              ) : !user ? (
                <div className="text-center py-4 text-xs text-[var(--text-muted)]">
                  <Link href="/login" className="text-[var(--accent)] hover:underline">Log in</Link> to manage tasks
                </div>
              ) : (
                <>
                  {/* Active Tasks */}
                  {tasks.filter(t => !t.is_completed).map(task => (
                    <div key={task.id} className="flex items-center gap-2 p-2 bg-[var(--bg-tertiary)] rounded hover:bg-[var(--bg-secondary)] transition-colors">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => toggleTask(task.id, true)}
                        className="w-3 h-3 rounded"
                      />
                      <span className="flex-1 text-xs text-[var(--text-primary)]">{task.text}</span>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-[var(--text-muted)] hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {/* Completed Section */}
                  {tasks.filter(t => t.is_completed).length > 0 && (
                    <div className="pt-2 mt-2 border-t border-[var(--border-secondary)]">
                      <button
                        onClick={() => setShowCompleted(!showCompleted)}
                        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      >
                        + {tasks.filter(t => t.is_completed).length} completed {showCompleted ? '▼' : '▶'}
                      </button>

                      {showCompleted && (
                        <div className="mt-1 space-y-1">
                          {tasks.filter(t => t.is_completed).map(task => (
                            <div key={task.id} className="flex items-center gap-2 p-2 bg-[var(--bg-tertiary)] rounded opacity-50">
                              <input
                                type="checkbox"
                                checked={true}
                                onChange={() => toggleTask(task.id, false)}
                                className="w-3 h-3 rounded"
                              />
                              <span className="flex-1 text-xs line-through text-[var(--text-muted)]">{task.text}</span>
                              <button
                                onClick={() => deleteTask(task.id)}
                                className="text-[var(--text-muted)] hover:text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Empty state */}
                  {tasks.length === 0 && (
                    <div className="text-center py-4 text-xs text-[var(--text-muted)]">
                      No tasks yet. Add one above!
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Divider */}
        <div className="border-t border-[var(--border-secondary)]"></div>
        
        {/* External Tools Section */}
        <div>
          <button
            onClick={toggleLinksCollapsed}
            className="w-full flex items-center justify-between mb-3 text-left hover:opacity-80 transition-opacity"
          >
            <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">Quick Links</h3>
            <div className="flex items-center gap-2">
              {isLinksCollapsed && (
                <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2 py-1 rounded">
                  {tools.length} tools
                </span>
              )}
              {canEdit && !isLinksCollapsed && (
            <div className="flex gap-2">
            {isEditMode ? (
              <>
                <button
                  onClick={handleResetAll}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline mr-2"
                  title="Reset all to defaults"
                >
                  Reset All
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="p-1.5 text-green-500 hover:bg-green-500/10 rounded transition-colors disabled:opacity-50"
                  title="Save changes"
                >
                  {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleEditToggle}
                  disabled={isSaving}
                  className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={handleEditToggle}
                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded transition-colors"
                title="Edit your links"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
              {isLinksCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </div>
          </button>
      
        {/* Collapsible Quick Links Content */}
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isLinksCollapsed ? 'max-h-0 opacity-0' : 'max-h-[600px] opacity-100'
        }`}>
          <div className="grid grid-cols-2 sm:grid-cols-1 gap-1.5 sm:gap-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const url = getToolUrl(tool.id);
          const isCustomized = savedUrls[tool.id] && savedUrls[tool.id] !== DEFAULT_EXTERNAL_TOOLS[tool.id as keyof typeof DEFAULT_EXTERNAL_TOOLS];
          
          return (
            <div key={tool.id} className="relative">
              {isEditMode ? (
                  <div className="w-full p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                      <div 
                        className="p-1 rounded bg-[var(--bg-tertiary)]"
                        style={{ color: tool.color }}
                      >
                        <Icon className="w-3 h-3" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-xs text-[var(--text-primary)]">
                        {tool.name}
                      </p>
                    </div>
                    {editedUrls[tool.id] !== DEFAULT_EXTERNAL_TOOLS[tool.id as keyof typeof DEFAULT_EXTERNAL_TOOLS] && (
                      <button
                        onClick={() => handleReset(tool.id)}
                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
                        title="Reset to default"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => handleUrlChange(tool.id, e.target.value)}
                    className="w-full px-2 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded text-xs focus:outline-none focus:border-[var(--accent)]"
                    placeholder="Enter URL..."
                  />
                </div>
              ) : (
                <button
                  onClick={() => handleToolClick(url, tool.name)}
                  className="w-full p-2 sm:p-2.5 min-h-[44px] bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-all duration-200 group active:scale-95"
                  disabled={!url}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div 
                      className="p-1 rounded bg-[var(--bg-tertiary)] group-hover:bg-[var(--bg-primary)]"
                      style={{ color: tool.color }}
                    >
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-xs text-[var(--text-primary)]">
                        {tool.name}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {tool.subtitle}
                      </p>
                    </div>
                    {isCustomized && (
                      <div className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full" title="Customized URL" />
                    )}
                    <ExternalLink className="w-3 h-3 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors" />
                  </div>
                </button>
              )}
            </div>
            );
          })}
          </div>
        </div>
        
        {isEditMode && (
          <div className="mt-2 text-[10px] text-[var(--text-muted)]">
            Custom links sync across devices
          </div>
        )}
        
        {!user && (
          <div className="mt-2 text-[10px] text-[var(--text-muted)] text-center">
            <Link href="/login" className="text-[var(--accent)] hover:underline">Log in</Link> to customize
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default DatabaseExternalTools;
