import React, { useState, useEffect } from 'react';
import { ExternalLink, Monitor, Calendar, Users, Shield, CreditCard, Activity, HardDrive, Edit2, Save, X, Loader } from 'lucide-react';
import { useAuthState } from '@/state/useStore';
import { useNotifications } from '@/state/hooks';
import { userSettingsApi } from '@/services/userSettings';

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

const DatabaseExternalTools: React.FC = () => {
  const { user } = useAuthState();
  const { notify } = useNotifications();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editedUrls, setEditedUrls] = useState<Record<string, string>>({});
  const [savedUrls, setSavedUrls] = useState<Record<string, string>>({});
  
  // All users can now edit their own links
  const canEdit = !!user;

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
        console.error('Failed to load user settings:', error);
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

  const handleToolClick = (url: string) => {
    if (!isEditMode && url) {
      window.open(url, '_blank', 'noopener,noreferrer');
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
      console.error('Failed to save links:', error);
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">External Tools</h3>
        {canEdit && (
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
      </div>
      
      <div className="grid grid-cols-1 gap-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const url = getToolUrl(tool.id);
          const isCustomized = savedUrls[tool.id] && savedUrls[tool.id] !== DEFAULT_EXTERNAL_TOOLS[tool.id as keyof typeof DEFAULT_EXTERNAL_TOOLS];
          
          return (
            <div key={tool.id} className="relative">
              {isEditMode ? (
                <div className="w-full p-4 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="p-2 rounded-lg bg-[var(--bg-tertiary)]"
                      style={{ color: tool.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-[var(--text-primary)]">
                        {tool.name}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {tool.subtitle}
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
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded text-sm focus:outline-none focus:border-[var(--accent)]"
                    placeholder="Enter URL..."
                  />
                </div>
              ) : (
                <button
                  onClick={() => handleToolClick(url)}
                  className="w-full p-4 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg hover:border-[var(--accent)] transition-all duration-200 group"
                  disabled={!url}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div 
                      className="p-2 rounded-lg bg-[var(--bg-tertiary)]"
                      style={{ color: tool.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-sm text-[var(--text-primary)]">
                        {tool.name}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {tool.subtitle}
                      </p>
                    </div>
                    {isCustomized && (
                      <div className="w-2 h-2 bg-[var(--accent)] rounded-full mr-2" title="Customized URL" />
                    )}
                    <ExternalLink className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" />
                  </div>
                </button>
              )}
            </div>
          );
        })}
      </div>
      
      {isEditMode && (
        <div className="mt-3 text-xs text-[var(--text-secondary)]">
          💡 Your custom links are saved to your account and sync across devices
        </div>
      )}
      
      {!user && (
        <div className="mt-3 text-xs text-[var(--text-secondary)] text-center">
          <a href="/login" className="text-[var(--accent)] hover:underline">Log in</a> to customize these links
        </div>
      )}
    </div>
  );
};

export default DatabaseExternalTools;
