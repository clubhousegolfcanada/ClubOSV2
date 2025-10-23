import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Zap, RefreshCw, Monitor, Music, Tv, Loader, Lock, Unlock, AlertTriangle, DoorOpen, Shield, MonitorSmartphone, Users, Circle, AlertCircle, Power } from 'lucide-react';
import { remoteActionsAPI, RemoteActionParams } from '@/api/remoteActions';
import { doorAccessAPI, DoorStatus } from '@/api/doorAccess';
import { unifiDoorsAPI } from '@/api/unifiDoors';
import { systemStatusAPI, LocationStatus } from '@/api/systemStatus';
import { useNotifications } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';
import { hasMinimumRole } from '@/utils/roleUtils';
import { openRemoteDesktopForBay } from '@/utils/remoteDesktopConfig';
import { http } from '@/api/http';
import logger from '@/services/logger';

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
  const [availableScripts, setAvailableScripts] = useState<any[]>([]);
  const [availableDevices, setAvailableDevices] = useState<any[]>([]);
  const { notify } = useNotifications();
  const { user } = useAuthState();
  
  // Load saved state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('remoteActionsExpanded');
    if (saved === 'true') {
      setIsExpanded(true);
    }
  }, []);

  // Load door statuses, system status, and NinjaOne data when expanded
  useEffect(() => {
    if (isExpanded) {
      // Load initial data
      loadSystemStatuses();
      loadNinjaOneData();
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
  
  // Load NinjaOne scripts and devices from database
  const loadNinjaOneData = async () => {
    try {
      // Fetch scripts with error resilience
      try {
        const scriptsResponse = await http.get('ninjaone/scripts');
        if (scriptsResponse.data.success) {
          setAvailableScripts(scriptsResponse.data.scripts);
        }
      } catch (scriptsError: any) {
        // Don't let script loading failure break the component
        if (scriptsError.response?.status !== 401) {
          logger.debug('Scripts endpoint not available, using defaults');
        }
      }

      // Fetch devices with error resilience
      try {
        const devicesResponse = await http.get('ninjaone/devices');
        if (devicesResponse.data.success) {
          setAvailableDevices(devicesResponse.data.devices);
        }
      } catch (devicesError: any) {
        // Don't let device loading failure break the component
        if (devicesError.response?.status !== 401) {
          logger.debug('Devices endpoint not available, using defaults');
        }
      }
    } catch (error: any) {
      // Only log non-401 errors to avoid confusion
      if (error.response?.status !== 401) {
        logger.debug('NinjaOne data not available, using defaults');
      }
      // Fallback to default scripts if database is empty
      setAvailableScripts([
        { script_id: 'restart-trackman', display_name: 'Restart TrackMan', category: 'trackman', icon: 'refresh-cw', requires_bay: true },
        { script_id: 'reboot-pc', display_name: 'Reboot PC', category: 'system', icon: 'power', requires_bay: true }
      ]);
    }
  };
  
  // Load system statuses
  const loadSystemStatuses = async () => {
    try {
      const statuses = await systemStatusAPI.getAllStatus();
      setLocationStatuses(statuses);
    } catch (error) {
      logger.error('Failed to load system statuses:', error);
    }
  };

  // Save state to localStorage
  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem('remoteActionsExpanded', String(newState));
  };

  // Dynamic location configurations based on devices
  const locations: LocationConfig[] = React.useMemo(() => {
    if (availableDevices.length === 0) {
      // Fallback to default if no devices loaded
      return [
        { name: 'Bedford', bays: [1, 2], hasMusic: true, hasTv: true },
        { name: 'Dartmouth', bays: [1, 2, 3, 4], hasMusic: true, hasTv: true },
        { name: 'Stratford', bays: [1, 2, 3], hasMusic: true, hasTv: false },
        { name: 'Bayers Lake', bays: [1, 2, 3, 4], hasMusic: true, hasTv: false }
      ];
    }
    
    // Build locations from devices
    const locationMap = new Map<string, LocationConfig>();
    
    availableDevices.forEach(device => {
      if (!locationMap.has(device.location)) {
        locationMap.set(device.location, {
          name: device.location,
          bays: [],
          hasMusic: false,
          hasTv: false
        });
      }
      
      const config = locationMap.get(device.location)!;
      
      if (device.device_type === 'trackman' && device.bay_number) {
        const bayNum = parseInt(device.bay_number);
        if (!isNaN(bayNum) && !config.bays.includes(bayNum)) {
          config.bays.push(bayNum);
        }
      } else if (device.device_type === 'music') {
        config.hasMusic = true;
      } else if (device.device_type === 'tv') {
        config.hasTv = true;
      }
    });
    
    // Sort bays and return locations
    return Array.from(locationMap.values()).map(loc => ({
      ...loc,
      bays: loc.bays.sort((a, b) => a - b)
    }));
  }, [availableDevices]);

  // Load door status for a location
  const loadDoorStatus = async (location: string) => {
    if (loadingDoors.has(location)) return;
    
    setLoadingDoors(prev => new Set(prev).add(location));
    try {
      const response = await doorAccessAPI.getStatus(location);
      setDoorStatuses(prev => ({ ...prev, [location]: response.doors }));
    } catch (error) {
      logger.error(`Failed to load door status for ${location}:`, error);
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

  // Mobile: Position as FAB above navigation
  // Desktop: Keep at bottom as usual
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ease-out ${
        isExpanded ? 'h-auto max-h-[70vh] overflow-hidden' : 'h-12'
      } ${
        isMobile
          ? 'right-4 left-4 rounded-t-lg shadow-lg' // Mobile: FAB style
          : 'left-0 right-0' // Desktop: full width
      } lg:z-40 lg:left-0 lg:right-0 lg:rounded-none`}
      style={{
        bottom: isMobile
          ? 'calc(env(safe-area-inset-bottom, 0px) + 76px)' // Mobile: above nav + sub-nav
          : 'env(safe-area-inset-bottom, 0px)', // Desktop: at bottom
        paddingBottom: isExpanded ? 'env(safe-area-inset-bottom, 0px)' : '0'
      }}
    >
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
                        
                        // Simplified status logic:
                        // Green = working (online, no issues)
                        // Red = not working + occupied
                        // Yellow = not working + empty
                        let statusColor = 'bg-green-500'; // Default: working
                        let statusTitle = 'Working';
                        
                        if (!isOnline || hasIssue) {
                          // Not working
                          if (isOccupied) {
                            statusColor = 'bg-red-500';
                            statusTitle = 'Issue - Customer in bay';
                          } else {
                            statusColor = 'bg-yellow-500';
                            statusTitle = 'Issue - Bay empty';
                          }
                        }
                        
                        return (
                          <div 
                            key={bay} 
                            className="flex items-center gap-2 p-1"
                          >
                            <span className="text-xs text-[var(--text-muted)] w-12 flex-shrink-0">Bay {bay}:</span>
                            <div className="flex items-center gap-1 flex-1">
                              <button
                                onClick={() => {
                                  executeAction('restart-trackman', location.name, String(bay));
                                }}
                                disabled={isExecuting}
                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded transition-all active:scale-95 disabled:opacity-50 min-w-[60px]"
                                title={`Reset TrackMan Bay ${bay}`}
                              >
                                {isExecuting ? (
                                  <Loader className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-3 h-3" />
                                )}
                                <span className="hidden sm:inline">Reset</span>
                              </button>
                              <button
                                onClick={() => {
                                  openRemoteDesktopForBay(location.name, String(bay));
                                }}
                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-[var(--bg-tertiary)] hover:bg-blue-500 hover:text-white border border-[var(--border-secondary)] rounded transition-all active:scale-95 min-w-[60px]"
                                title={`Remote Desktop to Bay ${bay}`}
                              >
                                <MonitorSmartphone className="w-3 h-3" />
                                <span className="hidden sm:inline">Remote</span>
                              </button>
                            </div>
                            {/* Status indicator - simplified */}
                            <div className="flex-shrink-0">
                              <span 
                                title={statusTitle} 
                                className={`block w-2 h-2 ${statusColor} rounded-full`} 
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* System Actions */}
                  <div className="space-y-2">
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Systems</p>
                    <div className="flex gap-2">
                      {location.hasMusic && (
                        <button
                          onClick={() => {
                            executeAction('restart-music', location.name);
                          }}
                          disabled={executingActions.has(`${location.name}-restart-music-system`)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded transition-all active:scale-95 disabled:opacity-50 min-w-[60px]"
                        >
                          {executingActions.has(`${location.name}-restart-music-system`) ? (
                            <Loader className="w-3 h-3 animate-spin" />
                          ) : (
                            <Music className="w-3 h-3" />
                          )}
                          <span className="hidden sm:inline">Music</span>
                        </button>
                      )}
                      {location.hasTv && (
                        <button
                          onClick={() => {
                            executeAction('restart-tv', location.name);
                          }}
                          disabled={executingActions.has(`${location.name}-restart-tv-system`)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded transition-all active:scale-95 disabled:opacity-50 min-w-[60px]"
                        >
                          {executingActions.has(`${location.name}-restart-tv-system`) ? (
                            <Loader className="w-3 h-3 animate-spin" />
                          ) : (
                            <Tv className="w-3 h-3" />
                          )}
                          <span className="hidden sm:inline">TV</span>
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