import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Zap, RefreshCw, Monitor, Music, Tv, Loader, Lock, Unlock, AlertTriangle, DoorOpen, Shield, MonitorSmartphone, Users, Circle, AlertCircle } from 'lucide-react';
import { remoteActionsAPI, RemoteActionParams } from '@/api/remoteActions';
import { doorAccessAPI, DoorStatus } from '@/api/doorAccess';
import { unifiDoorsAPI } from '@/api/unifiDoors';
import { systemStatusAPI, LocationStatus } from '@/api/systemStatus';
import { useNotifications } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';
import { hasMinimumRole } from '@/utils/roleUtils';
import { openRemoteDesktopForBay } from '@/utils/remoteDesktopConfig';

interface LocationConfig {
  name: string;
  bays: number[];
  hasMusic: boolean;
  hasTv: boolean;
}

const RemoteActionsBar: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [executingActions, setExecutingActions] = useState<Set<string>>(new Set());
  const [doorStatuses, setDoorStatuses] = useState<Record<string, DoorStatus[]>>({});
  const [loadingDoors, setLoadingDoors] = useState<Set<string>>(new Set());
  const [locationStatuses, setLocationStatuses] = useState<LocationStatus[]>([]);
  const { notify } = useNotifications();
  const { user } = useAuthState();
  
  // Load saved state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('remoteActionsExpanded');
    if (saved === 'true') {
      setIsExpanded(true);
    }
  }, []);

  // Load door statuses and system status when expanded
  useEffect(() => {
    if (isExpanded) {
      // Load initial data
      loadSystemStatuses();
      locations.forEach(location => {
        loadDoorStatus(location.name);
      });
      
      // Refresh every 30 seconds
      const interval = setInterval(() => {
        loadSystemStatuses();
        locations.forEach(location => {
          loadDoorStatus(location.name);
        });
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isExpanded]);
  
  // Load system statuses
  const loadSystemStatuses = async () => {
    try {
      const statuses = await systemStatusAPI.getAllStatus();
      setLocationStatuses(statuses);
    } catch (error) {
      console.error('Failed to load system statuses:', error);
    }
  };

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

  // Load door status for a location
  const loadDoorStatus = async (location: string) => {
    if (loadingDoors.has(location)) return;
    
    setLoadingDoors(prev => new Set(prev).add(location));
    try {
      const response = await doorAccessAPI.getStatus(location);
      setDoorStatuses(prev => ({ ...prev, [location]: response.doors }));
    } catch (error) {
      console.error(`Failed to load door status for ${location}:`, error);
    } finally {
      setLoadingDoors(prev => {
        const next = new Set(prev);
        next.delete(location);
        return next;
      });
    }
  };

  // Execute door action
  const executeDoorAction = async (action: 'unlock' | 'lock' | 'emergency', location: string, doorKey?: string) => {
    const actionKey = `door-${location}-${action}-${doorKey || 'all'}`;
    
    if (executingActions.has(actionKey)) return;
    
    setExecutingActions(prev => new Set(prev).add(actionKey));
    
    try {
      let response;
      
      if (action === 'emergency') {
        // Confirm emergency action
        if (!confirm(`Are you sure you want to UNLOCK ALL DOORS at ${location}? This is an emergency action.`)) {
          return;
        }
        response = await doorAccessAPI.emergency({ action: 'unlock_all', location });
        notify('warning', `Emergency unlock initiated for all doors at ${location}`);
      } else if (action === 'unlock' && doorKey) {
        response = await doorAccessAPI.unlock({ location, doorKey, duration: 30 });
        notify('success', `${doorKey.replace('-', ' ')} unlocked for 30 seconds`);
      } else if (action === 'lock' && doorKey) {
        response = await doorAccessAPI.lock({ location, doorKey });
        notify('success', `${doorKey.replace('-', ' ')} locked`);
      }
      
      // Refresh door status
      loadDoorStatus(location);
    } catch (error: any) {
      notify('error', error.response?.data?.message || 'Door action failed');
    } finally {
      setExecutingActions(prev => {
        const next = new Set(prev);
        next.delete(actionKey);
        return next;
      });
    }
  };

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
              <>
                <span className="text-xs text-[var(--text-muted)] ml-2 hidden sm:inline">
                  {locations.map(l => l.name).join(' • ')}
                </span>
                {(() => {
                  const criticalCount = locationStatuses.reduce((acc, loc) => 
                    acc + loc.bays.filter(b => b.criticalError).length, 0
                  );
                  return criticalCount > 0 ? (
                    <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full animate-pulse">
                      {criticalCount} Critical {criticalCount === 1 ? 'Error' : 'Errors'}
                    </span>
                  ) : null;
                })()}
              </>
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
                    <div className="space-y-1.5">
                      {location.bays.map((bay) => {
                        const isExecuting = executingActions.has(`${location.name}-restart-trackman-${bay}`);
                        const locationStatus = locationStatuses.find(ls => ls.location === location.name);
                        const bayStatus = locationStatus?.bays.find(b => b.bayNumber === bay);
                        const isOnline = bayStatus?.isOnline ?? true;
                        const isOccupied = bayStatus?.isOccupied ?? false;
                        const hasIssue = bayStatus?.hasIssue ?? false;
                        const hasCriticalError = bayStatus?.criticalError ?? false;
                        const ninjaOneError = bayStatus?.ninjaOneError;
                        
                        return (
                          <div 
                            key={bay} 
                            className={`flex items-center gap-1 p-1 rounded transition-all ${
                              hasCriticalError ? 'ring-2 ring-red-500 bg-red-500/10' : ''
                            }`}
                            title={hasCriticalError && ninjaOneError ? 
                              `CRITICAL: ${ninjaOneError.type.replace(/_/g, ' ')} detected during active booking` : 
                              undefined
                            }
                          >
                            <span className="text-xs text-[var(--text-muted)] w-10">Bay {bay}:</span>
                            <button
                              onClick={() => {
                                executeAction('restart-trackman', location.name, String(bay));
                              }}
                              disabled={isExecuting}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded transition-all active:scale-95 disabled:opacity-50"
                              title={`Reset TrackMan Bay ${bay}`}
                            >
                              {isExecuting ? (
                                <Loader className="w-3 h-3 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3 h-3" />
                              )}
                              Reset
                            </button>
                            <button
                              onClick={() => {
                                openRemoteDesktopForBay(location.name, String(bay));
                              }}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-[var(--bg-tertiary)] hover:bg-blue-500 hover:text-white border border-[var(--border-secondary)] rounded transition-all active:scale-95"
                              title={`Remote Desktop to Bay ${bay}`}
                            >
                              <MonitorSmartphone className="w-3 h-3" />
                              Remote
                            </button>
                            {/* Status indicator - enhanced for critical errors */}
                            <div className="flex items-center gap-1">
                              {hasCriticalError ? (
                                <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />
                              ) : (
                                <>
                                  {!isOnline && (
                                    <span title="Offline" className="w-2 h-2 bg-red-500 rounded-full" />
                                  )}
                                  {isOnline && hasIssue && !hasCriticalError && (
                                    <span title={bayStatus?.issueType || 'Issue'} className="w-2 h-2 bg-yellow-500 rounded-full" />
                                  )}
                                  {isOccupied && !hasCriticalError && (
                                    <span title={bayStatus?.bookingInfo?.customerName || 'Occupied'} className="w-2 h-2 bg-blue-500 rounded-full" />
                                  )}
                                </>
                              )}
                            </div>
                          </div>
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

                  {/* Door Access Section */}
                  <div className="space-y-2 mt-3 pt-3 border-t border-[var(--border-secondary)]">
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Door Access
                    </p>
                    
                    {/* Dartmouth Office Door - UniFi API */}
                    {location.name === 'Dartmouth' && (
                      <div className="space-y-1.5 mb-2">
                        <button
                          onClick={async () => {
                            const actionKey = `door-dartmouth-office-unlock`;
                            if (executingActions.has(actionKey)) return;
                            
                            setExecutingActions(prev => new Set(prev).add(actionKey));
                            try {
                              await unifiDoorsAPI.unlock({
                                location: 'dartmouth',
                                doorKey: 'office',
                                duration: 30
                              });
                              notify('success', 'Office door unlocked for 30 seconds');
                            } catch (error: any) {
                              notify('error', error.response?.data?.error || 'Failed to unlock door');
                            } finally {
                              setExecutingActions(prev => {
                                const next = new Set(prev);
                                next.delete(actionKey);
                                return next;
                              });
                            }
                          }}
                          disabled={executingActions.has('door-dartmouth-office-unlock')}
                          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-[var(--bg-tertiary)] hover:bg-blue-500 hover:text-white border border-blue-500/30 rounded transition-all active:scale-95 disabled:opacity-50"
                        >
                          {executingActions.has('door-dartmouth-office-unlock') ? (
                            <Loader className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <Unlock className="w-3 h-3" />
                              Unlock Office Door
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    
                    {/* Individual Door Controls - Legacy */}
                    <div className="space-y-1.5">
                      {doorStatuses[location.name]?.map((door) => (
                        <div key={door.doorId} className="flex items-center justify-between p-1.5 bg-[var(--bg-tertiary)] rounded text-xs">
                          <div className="flex items-center gap-1.5">
                            {door.online ? (
                              door.locked ? (
                                <Lock className="w-3 h-3 text-[var(--text-muted)]" />
                              ) : (
                                <Unlock className="w-3 h-3 text-[var(--accent)]" />
                              )
                            ) : (
                              <AlertTriangle className="w-3 h-3 text-yellow-500" />
                            )}
                            <span className={door.online ? '' : 'text-[var(--text-muted)]'}>
                              {door.name}
                            </span>
                          </div>
                          
                          {door.online && (
                            <button
                              onClick={() => executeDoorAction(
                                door.locked ? 'unlock' : 'lock',
                                location.name,
                                door.name.toLowerCase().replace(' ', '-')
                              )}
                              disabled={executingActions.has(`door-${location.name}-${door.locked ? 'unlock' : 'lock'}-${door.name.toLowerCase().replace(' ', '-')}`)}
                              className="px-2 py-0.5 bg-[var(--bg-primary)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border-secondary)] rounded transition-all text-xs disabled:opacity-50"
                            >
                              {executingActions.has(`door-${location.name}-${door.locked ? 'unlock' : 'lock'}-${door.name.toLowerCase().replace(' ', '-')}`) ? (
                                <Loader className="w-3 h-3 animate-spin" />
                              ) : (
                                door.locked ? 'Unlock' : 'Lock'
                              )}
                            </button>
                          )}
                        </div>
                      )) || (
                        <div className="text-xs text-[var(--text-muted)] text-center py-2">
                          {loadingDoors.has(location.name) ? 'Loading doors...' : 'No doors configured'}
                        </div>
                      )}
                    </div>
                    
                    {/* Emergency Unlock All */}
                    {user && hasMinimumRole(user.role, 'admin') && doorStatuses[location.name]?.length > 0 && (
                      <button
                        onClick={() => executeDoorAction('emergency', location.name)}
                        disabled={executingActions.has(`door-${location.name}-emergency-all`)}
                        className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded transition-all active:scale-95 disabled:opacity-50"
                      >
                        {executingActions.has(`door-${location.name}-emergency-all`) ? (
                          <Loader className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <AlertTriangle className="w-3 h-3" />
                            Emergency Unlock All
                          </>
                        )}
                      </button>
                    )}
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