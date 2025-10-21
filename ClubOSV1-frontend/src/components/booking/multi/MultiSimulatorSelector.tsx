import React, { useState, useEffect } from 'react';
import { Check, Square, CheckSquare, Users, AlertCircle } from 'lucide-react';
import type {
  MultiSimulatorSelectorProps,
  Space,
  SpaceAvailability
} from '@/types/booking';
import { http } from '@/api/http';

/**
 * Multi-Simulator Selector Component
 * Part 5 of Booking System Master Plan
 *
 * Allows users to select multiple simulators for booking in one transaction.
 * Shows real-time availability and prevents double-booking conflicts.
 */
export const MultiSimulatorSelector: React.FC<MultiSimulatorSelectorProps> = ({
  locationId,
  availableSpaces,
  selectedSpaceIds,
  onSpaceToggle,
  onSelectAll,
  onClearAll,
  date,
  startTime,
  endTime,
  showAvailability = true,
  maxSelectable
}) => {
  const [spaceAvailability, setSpaceAvailability] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<Set<string>>(new Set());

  // Check availability for each space
  useEffect(() => {
    if (showAvailability && date && startTime && endTime) {
      checkSpaceAvailability();
    }
  }, [locationId, date, startTime, endTime]);

  const checkSpaceAvailability = async () => {
    setLoading(true);
    try {
      // Check availability for each space
      const availabilityMap = new Map<string, boolean>();
      const conflictSet = new Set<string>();

      for (const space of availableSpaces) {
        const response = await http.post('/api/bookings/check', {
          spaceIds: [space.id],
          startAt: `${date}T${startTime}`,
          endAt: `${date}T${endTime}`
        });

        availabilityMap.set(space.id, response.data.available);
        if (!response.data.available) {
          conflictSet.add(space.id);
        }
      }

      setSpaceAvailability(availabilityMap);
      setConflicts(conflictSet);
    } catch (error) {
      logger.error('Failed to check availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSpaceToggle = (spaceId: string) => {
    // Check if we've reached max selectable limit
    if (maxSelectable &&
        !selectedSpaceIds.includes(spaceId) &&
        selectedSpaceIds.length >= maxSelectable) {
      alert(`You can only select up to ${maxSelectable} simulators`);
      return;
    }

    // Check if space has conflict
    if (conflicts.has(spaceId) && !selectedSpaceIds.includes(spaceId)) {
      if (!confirm('This simulator has a conflict at the selected time. Continue anyway?')) {
        return;
      }
    }

    onSpaceToggle(spaceId);
  };

  const getSpaceStatus = (space: Space): 'available' | 'selected' | 'conflict' | 'unavailable' => {
    if (selectedSpaceIds.includes(space.id)) return 'selected';
    if (!space.isActive) return 'unavailable';
    if (conflicts.has(space.id)) return 'conflict';
    if (spaceAvailability.has(space.id) && !spaceAvailability.get(space.id)) return 'conflict';
    return 'available';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'selected': return 'bg-[var(--accent)] text-white';
      case 'conflict': return 'bg-red-100 text-red-700 border-red-300';
      case 'unavailable': return 'bg-gray-100 text-gray-400 cursor-not-allowed';
      default: return 'bg-white hover:bg-gray-50';
    }
  };

  const canSelectAll = availableSpaces.filter(s =>
    s.isActive && !conflicts.has(s.id)
  ).length > selectedSpaceIds.length;

  return (
    <div className="space-y-4">
      {/* Header with bulk actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold">Select Simulators</h3>
          <span className="text-sm text-gray-500">
            ({selectedSpaceIds.length} selected
            {maxSelectable && ` / ${maxSelectable} max`})
          </span>
        </div>

        <div className="flex gap-2">
          {canSelectAll && (
            <button
              onClick={onSelectAll}
              className="text-sm px-3 py-1 bg-[var(--accent)]/10 text-[var(--accent)] rounded hover:bg-[var(--accent)]/20 transition-colors"
            >
              Select All Available
            </button>
          )}
          {selectedSpaceIds.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-sm px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)] mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Checking availability...</p>
        </div>
      )}

      {/* Simulator grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {availableSpaces.map((space) => {
          const status = getSpaceStatus(space);
          const isSelected = selectedSpaceIds.includes(space.id);
          const isDisabled = status === 'unavailable';

          return (
            <button
              key={space.id}
              onClick={() => !isDisabled && handleSpaceToggle(space.id)}
              disabled={isDisabled}
              className={`
                relative p-4 rounded-lg border-2 transition-all
                ${getStatusColor(status)}
                ${isDisabled ? '' : 'cursor-pointer hover:shadow-md'}
                ${isSelected ? 'border-[var(--accent)]' : 'border-gray-200'}
              `}
            >
              {/* Checkbox indicator */}
              <div className="absolute top-2 right-2">
                {isSelected ? (
                  <CheckSquare className="w-5 h-5 text-[var(--accent)]" />
                ) : (
                  <Square className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {/* Space info */}
              <div className="text-left">
                <div className="font-semibold text-lg">
                  {space.spaceNumber}
                </div>
                <div className="text-sm mt-1">
                  {space.name}
                </div>

                {/* Features */}
                {space.features && space.features.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {space.features.slice(0, 2).map((feature, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-0.5 bg-gray-100 rounded"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                )}

                {/* Status indicator */}
                {status === 'conflict' && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-red-600">
                    <AlertCircle className="w-3 h-3" />
                    <span>Conflict</span>
                  </div>
                )}
                {status === 'unavailable' && (
                  <div className="text-xs mt-2 text-gray-500">
                    Unavailable
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Special options */}
      <div className="border-t pt-4">
        <button
          onClick={() => {
            // Select all spaces for full location rental
            const allActiveSpaceIds = availableSpaces
              .filter(s => s.isActive)
              .map(s => s.id);
            allActiveSpaceIds.forEach(id => {
              if (!selectedSpaceIds.includes(id)) {
                onSpaceToggle(id);
              }
            });
          }}
          className="w-full py-3 bg-gradient-to-r from-[var(--accent)] to-[#084a45] text-white rounded-lg hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-center gap-2">
            <Users className="w-5 h-5" />
            <span className="font-semibold">Book Full Location</span>
            <span className="text-sm opacity-90">
              (All {availableSpaces.filter(s => s.isActive).length} simulators)
            </span>
          </div>
        </button>
      </div>

      {/* Help text */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>• Click simulators to select/deselect</p>
        <p>• Book multiple simulators for group events</p>
        {maxSelectable && (
          <p>• Maximum {maxSelectable} simulators per booking</p>
        )}
      </div>
    </div>
  );
};

export default MultiSimulatorSelector;