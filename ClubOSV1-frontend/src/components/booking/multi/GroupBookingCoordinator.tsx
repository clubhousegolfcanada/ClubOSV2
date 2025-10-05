import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Mail, Shuffle, ChevronDown, ChevronUp } from 'lucide-react';
import type { GroupBookingCoordinatorProps, Space } from '@/types/booking';

/**
 * Group Booking Coordinator Component
 * Part 5 of Booking System Master Plan
 *
 * Manages group bookings with participant assignment to specific simulators.
 * Handles split bookings and automatic space assignment.
 */
export const GroupBookingCoordinator: React.FC<GroupBookingCoordinatorProps> = ({
  locationId,
  groupSize,
  participants,
  onParticipantUpdate,
  onAutoAssign,
  suggestedAssignments
}) => {
  const [expandedParticipants, setExpandedParticipants] = useState<Set<number>>(new Set());
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [spaces, setSpaces] = useState<Space[]>([]);

  // Load available spaces for the location
  useEffect(() => {
    loadSpaces();
  }, [locationId]);

  const loadSpaces = async () => {
    try {
      const response = await fetch(`/api/bookings/spaces?locationId=${locationId}`);
      const data = await response.json();
      if (data.success) {
        setSpaces(data.data);
      }
    } catch (error) {
      console.error('Failed to load spaces:', error);
    }
  };

  const toggleParticipant = (index: number) => {
    const newExpanded = new Set(expandedParticipants);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedParticipants(newExpanded);
  };

  const handleAddParticipant = () => {
    const newParticipant = {
      name: '',
      email: '',
      preferredSpaceId: undefined
    };
    // This would typically be handled by the parent component
    // For now, we'll just show the UI
  };

  const getSpaceName = (spaceId?: string): string => {
    if (!spaceId) return 'Not assigned';
    const space = spaces.find(s => s.id === spaceId);
    return space ? `Simulator ${space.spaceNumber}` : 'Unknown';
  };

  const getAssignmentStatus = (index: number): 'assigned' | 'suggested' | 'unassigned' => {
    const participant = participants[index];
    if (participant.preferredSpaceId) return 'assigned';
    if (suggestedAssignments?.has(index)) return 'suggested';
    return 'unassigned';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'assigned': return 'text-green-600 bg-green-50';
      case 'suggested': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold">Group Coordination</h3>
          <span className="text-sm text-gray-500">
            ({participants.length} / {groupSize} participants)
          </span>
        </div>

        <button
          onClick={onAutoAssign}
          className="flex items-center gap-2 px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg hover:bg-[#084a45] transition-colors"
        >
          <Shuffle className="w-4 h-4" />
          <span className="text-sm">Auto-Assign</span>
        </button>
      </div>

      {/* Participant list */}
      <div className="space-y-2">
        {participants.map((participant, index) => {
          const isExpanded = expandedParticipants.has(index);
          const status = getAssignmentStatus(index);
          const assignedSpace = participant.preferredSpaceId ||
                              (suggestedAssignments?.get(index));

          return (
            <div
              key={index}
              className="border rounded-lg overflow-hidden"
            >
              {/* Participant header */}
              <button
                onClick={() => toggleParticipant(index)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${getStatusColor(status)}`}>
                    {index + 1}
                  </div>
                  <div className="text-left">
                    <div className="font-medium">
                      {participant.name || `Participant ${index + 1}`}
                    </div>
                    <div className="text-sm text-gray-500">
                      {getSpaceName(assignedSpace)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {participant.email && (
                    <Mail className="w-4 h-4 text-gray-400" />
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 py-3 bg-gray-50 border-t space-y-3">
                  {/* Name input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={participant.name || ''}
                      onChange={(e) => onParticipantUpdate(index, {
                        ...participant,
                        name: e.target.value
                      })}
                      placeholder="Enter participant name"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>

                  {/* Email input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={participant.email || ''}
                      onChange={(e) => onParticipantUpdate(index, {
                        ...participant,
                        email: e.target.value
                      })}
                      placeholder="email@example.com"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      They'll receive booking confirmation
                    </p>
                  </div>

                  {/* Space assignment */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assigned Simulator
                    </label>
                    <select
                      value={participant.preferredSpaceId || ''}
                      onChange={(e) => onParticipantUpdate(index, {
                        ...participant,
                        preferredSpaceId: e.target.value || undefined
                      })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    >
                      <option value="">Auto-assign</option>
                      {spaces.map((space) => (
                        <option key={space.id} value={space.id}>
                          Simulator {space.spaceNumber} - {space.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add participant button */}
        {participants.length < groupSize && (
          <button
            onClick={handleAddParticipant}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-[var(--accent)] hover:bg-gray-50 transition-all"
          >
            <div className="flex items-center justify-center gap-2 text-gray-600">
              <UserPlus className="w-5 h-5" />
              <span>Add Participant</span>
            </div>
          </button>
        )}
      </div>

      {/* Group options */}
      <div className="border-t pt-4 space-y-3">
        {/* Email notifications toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={emailNotifications}
            onChange={(e) => setEmailNotifications(e.target.checked)}
            className="w-4 h-4 text-[var(--accent)] rounded focus:ring-[var(--accent)]"
          />
          <span className="text-sm">
            Send individual confirmation emails to all participants
          </span>
        </label>

        {/* Split booking option */}
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold mt-0.5">
              i
            </div>
            <div className="flex-1">
              <p className="text-sm text-blue-800 font-medium">
                Split Booking Available
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Participants can be assigned to different time slots if needed.
                Use this for tournament-style events or when the group can't all play at once.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium mb-2">Booking Summary</h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Participants:</span>
            <span className="font-medium">{participants.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Assigned:</span>
            <span className="font-medium text-green-600">
              {participants.filter(p => p.preferredSpaceId).length}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Auto-assign:</span>
            <span className="font-medium text-gray-500">
              {participants.filter(p => !p.preferredSpaceId).length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupBookingCoordinator;