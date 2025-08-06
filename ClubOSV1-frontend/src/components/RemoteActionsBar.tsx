import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Zap, RefreshCw, Monitor, Music, Tv, Loader } from 'lucide-react';
import { remoteActionsAPI, RemoteActionParams } from '@/api/remoteActions';
import { useNotifications } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';
import { hasMinimumRole } from '@/utils/roleUtils';

interface LocationConfig {
  name: string;
  bays: number[];
  hasMusic: boolean;
  hasTv: boolean;
}

const RemoteActionsBar: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [executingActions, setExecutingActions] = useState<Set<string>>(new Set());
  const { notify } = useNotifications();
  const { user } = useAuthState();
  
  // Load saved state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('remoteActionsExpanded');
    if (saved === 'true') {
      setIsExpanded(true);
    }
  }, []);

  // Save state to localStorage
  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem('remoteActionsExpanded', String(newState));
  };

  // Location configurations
  const locations: LocationConfig[] = [
    { name: 'Bedford', bays: [1, 2], hasMusic: true, hasTv: true },
    { name: 'Dartmouth', bays: [1, 2, 3, 4], hasMusic: true, hasTv: true },
    { name: 'Stratford', bays: [1, 2, 3], hasMusic: true, hasTv: false },
    { name: 'Bayers Lake', bays: [1, 2, 3, 4], hasMusic: true, hasTv: false }
  ];

  // Execute remote action
  const executeAction = async (action: string, location: string, bayNumber?: string) => {
    const actionKey = `${location}-${action}-${bayNumber || 'system'}`;
    
    if (executingActions.has(actionKey)) {
      return;
    }

    setExecutingActions(prev => new Set(prev).add(actionKey));

    try {
      const params: RemoteActionParams = {
        action: action as RemoteActionParams['action'],
        location,
        bayNumber: bayNumber || ''
      };

      const response = await remoteActionsAPI.execute(params);
      
      if (response.success) {
        notify('success', `${action} initiated for ${location}${bayNumber ? ` Bay ${bayNumber}` : ''}`);
      } else {
        notify('error', response.message || 'Action failed');
      }
    } catch (error: any) {
      notify('error', error.message || 'Failed to execute action');
    } finally {
      setExecutingActions(prev => {
        const next = new Set(prev);
        next.delete(actionKey);
        return next;
      });
    }
  };

  // Check if user has permission
  if (!user || !hasMinimumRole(user.role, 'operator')) {
    return null;
  }

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ease-out ${
      isExpanded ? 'h-auto max-h-[70vh] overflow-hidden' : 'h-12'
    }`}>
      {/* Collapsed Bar */}
      <div 
        className={`border-t cursor-pointer h-12 transition-all duration-200 ${
          isExpanded 
            ? 'bg-[var(--bg-primary)] border-[var(--accent)] shadow-lg' 
            : 'bg-[var(--bg-secondary)] border-[var(--border-secondary)] hover:border-[var(--accent)] hover:shadow-md sm:hover:bg-[var(--bg-primary)]'
        }`}
        onClick={toggleExpanded}
      >
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-sm font-medium">Remote Actions</span>
            {!isExpanded && (
              <span className="text-xs text-[var(--text-muted)] ml-2 hidden sm:inline">
                {locations.map(l => l.name).join(' • ')}
              </span>
            )}
          </div>
          <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronUp className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div 
          className="bg-[var(--bg-primary)] overflow-y-auto border-l border-r border-[var(--accent)] animate-slideUp shadow-2xl" 
          style={{ maxHeight: 'calc(70vh - 3rem)' }}
        >
          <div className="container mx-auto px-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {locations.map((location) => (
                <div key={location.name} className="card p-4">
                  <h4 className="text-sm font-semibold mb-3 text-[var(--text-primary)]">
                    {location.name}
                  </h4>
                  
                  {/* Bay Actions */}
                  <div className="space-y-2 mb-3">
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Simulators</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {location.bays.map((bay) => {
                        const isExecuting = executingActions.has(`${location.name}-restart-trackman-${bay}`);
                        return (
                          <button
                            key={bay}
                            onClick={() => {
                              executeAction('restart-trackman', location.name, String(bay));
                            }}
                            disabled={isExecuting}
                            className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded transition-all active:scale-95 disabled:opacity-50"
                          >
                            {isExecuting ? (
                              <Loader className="w-3 h-3 animate-spin" />
                            ) : (
                              <Monitor className="w-3 h-3" />
                            )}
                            Bay {bay}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* System Actions */}
                  <div className="space-y-2">
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Systems</p>
                    <div className="flex gap-1.5">
                      {location.hasMusic && (
                        <button
                          onClick={() => {
                            executeAction('restart-music', location.name);
                          }}
                          disabled={executingActions.has(`${location.name}-restart-music-system`)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded transition-all active:scale-95 disabled:opacity-50"
                        >
                          {executingActions.has(`${location.name}-restart-music-system`) ? (
                            <Loader className="w-3 h-3 animate-spin" />
                          ) : (
                            <Music className="w-3 h-3" />
                          )}
                          Music
                        </button>
                      )}
                      {location.hasTv && (
                        <button
                          onClick={() => {
                            executeAction('restart-tv', location.name);
                          }}
                          disabled={executingActions.has(`${location.name}-restart-tv-system`)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded transition-all active:scale-95 disabled:opacity-50"
                        >
                          {executingActions.has(`${location.name}-restart-tv-system`) ? (
                            <Loader className="w-3 h-3 animate-spin" />
                          ) : (
                            <Tv className="w-3 h-3" />
                          )}
                          TV
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemoteActionsBar;