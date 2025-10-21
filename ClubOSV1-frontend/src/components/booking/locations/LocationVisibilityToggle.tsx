'use client';

import React, { useState, useEffect } from 'react';
import logger from '@/services/logger';
import { Eye, EyeOff, MapPin, Filter, Check } from 'lucide-react';
import { locationNoticeService } from '../../../services/booking/locationNoticeService';
import { useNotifications } from '../../../hooks/useNotifications';

interface Location {
  id: string;
  name: string;
  isVisible: boolean;
  isActive: boolean;
  activeNotices?: number;
  availableSpaces?: number;
}

interface LocationVisibilityToggleProps {
  onLocationChange?: (locationId: string | 'all') => void;
  selectedLocationId?: string | 'all';
  isAdmin?: boolean;
}

export const LocationVisibilityToggle: React.FC<LocationVisibilityToggleProps> = ({
  onLocationChange,
  selectedLocationId = 'all',
  isAdmin = false
}) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'single'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const { showError, showSuccess } = useNotifications();

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const data = await locationNoticeService.getLocations();
      setLocations(data);
    } catch (error) {
      showError('Failed to load locations');
      logger.error('Error loading locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = async (locationId: string, currentVisibility: boolean) => {
    if (!isAdmin) {
      showError('Only administrators can change location visibility');
      return;
    }

    try {
      await locationNoticeService.toggleLocationVisibility(locationId, !currentVisibility);
      showSuccess(`Location ${currentVisibility ? 'hidden' : 'shown'} successfully`);
      await loadLocations();
    } catch (error) {
      showError('Failed to update location visibility');
      logger.error('Error toggling visibility:', error);
    }
  };

  const handleLocationSelect = (locationId: string | 'all') => {
    if (locationId === 'all') {
      setFilterMode('all');
    } else {
      setFilterMode('single');
    }
    onLocationChange?.(locationId);
    setShowFilterMenu(false);
  };

  const visibleLocations = locations.filter(loc => loc.isVisible || isAdmin);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-2">
        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
        <span className="text-sm">Loading locations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">
              {filterMode === 'all' ? 'All Locations' : 'Single Location'}
            </span>
          </button>

          {filterMode === 'single' && selectedLocationId !== 'all' && (
            <div className="px-3 py-1 bg-primary/10 rounded-lg">
              <span className="text-sm font-medium text-primary">
                {locations.find(l => l.id === selectedLocationId)?.name || 'Select Location'}
              </span>
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Click eye icon to toggle visibility
          </div>
        )}
      </div>

      {/* Location Filter Menu */}
      {showFilterMenu && (
        <div className="card p-2 space-y-1">
          <button
            onClick={() => handleLocationSelect('all')}
            className={`w-full px-3 py-2 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
              selectedLocationId === 'all' ? 'bg-primary/10' : ''
            }`}
          >
            <span className="text-sm font-medium">All Locations</span>
            {selectedLocationId === 'all' && <Check className="w-4 h-4 text-primary" />}
          </button>

          <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

          {visibleLocations.map(location => (
            <button
              key={location.id}
              onClick={() => handleLocationSelect(location.id)}
              className={`w-full px-3 py-2 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
                selectedLocationId === location.id ? 'bg-primary/10' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium">{location.name}</span>
                {location.activeNotices && location.activeNotices > 0 && (
                  <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs rounded-full">
                    {location.activeNotices} notice{location.activeNotices > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {selectedLocationId === location.id && <Check className="w-4 h-4 text-primary" />}
            </button>
          ))}
        </div>
      )}

      {/* Location Cards with Visibility Toggle (Admin Only) */}
      {isAdmin && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map(location => (
            <div
              key={location.id}
              className={`card p-4 ${!location.isVisible ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <h4 className="font-medium">{location.name}</h4>
                  </div>

                  <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-4">
                      <span>{location.availableSpaces || 0} spaces</span>
                      {location.activeNotices && location.activeNotices > 0 && (
                        <span className="text-yellow-600 dark:text-yellow-400">
                          {location.activeNotices} active notice{location.activeNotices > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div>
                      Status: {location.isVisible ? (
                        <span className="text-green-600 dark:text-green-400">Visible to customers</span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">Hidden from customers</span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleVisibility(location.id, location.isVisible)}
                  className={`p-2 rounded-lg transition-colors ${
                    location.isVisible
                      ? 'bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title={location.isVisible ? 'Click to hide location' : 'Click to show location'}
                >
                  {location.isVisible ? (
                    <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <EyeOff className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary for Non-Admin Users */}
      {!isAdmin && visibleLocations.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visibleLocations.map(location => (
            <div
              key={location.id}
              className={`px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                selectedLocationId === location.id
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
              }`}
              onClick={() => handleLocationSelect(location.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium">{location.name}</span>
                </div>
                {location.activeNotices && location.activeNotices > 0 && (
                  <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Locations Message */}
      {visibleLocations.length === 0 && (
        <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
          <MapPin className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>No locations available</p>
        </div>
      )}
    </div>
  );
};