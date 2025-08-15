import React, { useState, useEffect } from 'react';
import { MapPin, Users, Circle, AlertTriangle, Clock, Activity } from 'lucide-react';
import { systemStatusAPI, LocationStatus } from '@/api/systemStatus';

interface OccupancyMapProps {
  compact?: boolean;
}

const OccupancyMap: React.FC<OccupancyMapProps> = ({ compact = false }) => {
  const [locationStatuses, setLocationStatuses] = useState<LocationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Load and refresh data
  useEffect(() => {
    loadStatuses();
    const interval = setInterval(() => {
      loadStatuses();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const loadStatuses = async () => {
    try {
      const statuses = await systemStatusAPI.getAllStatus();
      setLocationStatuses(statuses);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load occupancy data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate occupancy stats
  const getLocationStats = (location: LocationStatus) => {
    const totalBays = location.bays.length;
    const occupiedBays = location.bays.filter(b => b.isOccupied).length;
    const onlineBays = location.bays.filter(b => b.isOnline).length;
    const issuesBays = location.bays.filter(b => b.hasIssue).length;
    const occupancyRate = totalBays > 0 ? Math.round((occupiedBays / totalBays) * 100) : 0;
    
    return {
      totalBays,
      occupiedBays,
      onlineBays,
      issuesBays,
      occupancyRate,
      availableBays: totalBays - occupiedBays
    };
  };

  // Get status color
  const getStatusColor = (isOnline: boolean, isOccupied: boolean, hasIssue: boolean) => {
    if (!isOnline) return 'bg-red-500';
    if (hasIssue) return 'bg-yellow-500';
    if (isOccupied) return 'bg-blue-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="card p-4">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
        </div>
      </div>
    );
  }

  if (compact) {
    // Compact view for dashboard
    return (
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--accent)]" />
            Live Occupancy
          </h3>
          <span className="text-[10px] text-[var(--text-muted)]">
            Updated {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
        
        <div className="space-y-2">
          {locationStatuses.map((location) => {
            const stats = getLocationStats(location);
            return (
              <div key={location.location} className="flex items-center justify-between p-2 bg-[var(--bg-tertiary)] rounded">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-[var(--text-muted)]" />
                  <span className="text-xs font-medium">{location.location}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-blue-500" />
                    <span className="text-xs">{stats.occupiedBays}/{stats.totalBays}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${stats.occupancyRate > 75 ? 'bg-red-500' : stats.occupancyRate > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} />
                    <span className="text-xs">{stats.occupancyRate}%</span>
                  </div>
                  {stats.issuesBays > 0 && (
                    <span title={`${stats.issuesBays} bay(s) with issues`}>
                      <AlertTriangle className="w-3 h-3 text-yellow-500" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div className="card">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-[var(--accent)]" />
            Live Occupancy Map
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <Circle className="w-3 h-3 text-green-500 fill-current" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Circle className="w-3 h-3 text-blue-500 fill-current" />
              <span>Occupied</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Circle className="w-3 h-3 text-yellow-500 fill-current" />
              <span>Issue</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Circle className="w-3 h-3 text-red-500 fill-current" />
              <span>Offline</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {locationStatuses.map((location) => {
            const stats = getLocationStats(location);
            return (
              <div key={location.location} className="border border-[var(--border-secondary)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {location.location}
                  </h3>
                  <span className={`text-xs px-2 py-1 rounded ${stats.occupancyRate > 75 ? 'bg-red-500/20 text-red-500' : stats.occupancyRate > 50 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'}`}>
                    {stats.occupancyRate}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  {location.bays.map((bay) => (
                    <div
                      key={bay.bayNumber}
                      className={`p-2 rounded text-center text-xs ${getStatusColor(bay.isOnline, bay.isOccupied, bay.hasIssue)} bg-opacity-20 border border-current`}
                    >
                      <div className="font-semibold">Bay {bay.bayNumber}</div>
                      {bay.isOccupied && bay.bookingInfo && (
                        <div className="text-[10px] mt-1 truncate" title={bay.bookingInfo.customerName}>
                          {bay.bookingInfo.customerName}
                        </div>
                      )}
                      {bay.hasIssue && (
                        <div className="text-[10px] mt-1">
                          {bay.issueType === 'frozen' ? '❄️ Frozen' : '⚫ Black'}
                        </div>
                      )}
                      {!bay.isOnline && (
                        <div className="text-[10px] mt-1">Offline</div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                  <span>{stats.availableBays} available</span>
                  <span>{stats.occupiedBays} occupied</span>
                </div>

                {/* System Status Indicators */}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--border-secondary)]">
                  <div className="flex items-center gap-1" title="Network">
                    <Circle className={`w-2 h-2 ${location.systemStatus.network ? 'text-green-500' : 'text-red-500'} fill-current`} />
                    <span className="text-[10px]">Net</span>
                  </div>
                  {location.systemStatus.music !== undefined && (
                    <div className="flex items-center gap-1" title="Music">
                      <Circle className={`w-2 h-2 ${location.systemStatus.music ? 'text-green-500' : 'text-red-500'} fill-current`} />
                      <span className="text-[10px]">Music</span>
                    </div>
                  )}
                  {location.systemStatus.tv !== undefined && (
                    <div className="flex items-center gap-1" title="TV">
                      <Circle className={`w-2 h-2 ${location.systemStatus.tv ? 'text-green-500' : 'text-red-500'} fill-current`} />
                      <span className="text-[10px]">TV</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 text-xs text-[var(--text-muted)] text-center">
          <Clock className="w-3 h-3 inline mr-1" />
          Last updated: {lastUpdate.toLocaleTimeString()} • Auto-refreshes every 30 seconds
        </div>
      </div>
    </div>
  );
};

export default OccupancyMap;