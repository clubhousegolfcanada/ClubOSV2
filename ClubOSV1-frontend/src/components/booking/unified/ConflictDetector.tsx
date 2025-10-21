import React, { useEffect, useState } from 'react';
import { http } from '@/api/http';
import { format, addMinutes, subMinutes, parseISO } from 'date-fns';
import { AlertTriangle, Clock, ChevronRight, Calendar, Users } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import logger from '@/services/logger';

interface ConflictDetectorProps {
  locationId: string;
  spaceIds: string[];
  startAt: string;
  endAt: string;
  onConflictsDetected: (conflicts: any[]) => void;
  onSuggestionsFound: (suggestions: any[]) => void;
  excludeBookingId?: string; // For editing existing bookings
}

interface Conflict {
  id: string;
  customerName: string;
  customerEmail?: string;
  startAt: string;
  endAt: string;
  spaceIds: string[];
  status: string;
  isAdminBlock?: boolean;
  blockReason?: string;
}

interface Suggestion {
  startAt: string;
  endAt: string;
  label: string;
  type: 'earlier' | 'later' | 'next_available';
}

export default function ConflictDetector({
  locationId,
  spaceIds,
  startAt,
  endAt,
  onConflictsDetected,
  onSuggestionsFound,
  excludeBookingId
}: ConflictDetectorProps) {
  const [checking, setChecking] = useState(false);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [expandDetails, setExpandDetails] = useState(false);

  useEffect(() => {
    if (locationId && startAt && endAt) {
      const debounceTimer = setTimeout(() => {
        checkConflicts();
      }, 500); // Debounce to avoid too many API calls

      return () => clearTimeout(debounceTimer);
    }
  }, [locationId, spaceIds.join(','), startAt, endAt]);

  const checkConflicts = async () => {
    if (!startAt || !endAt) return;

    setChecking(true);
    try {
      // Use the existing backend endpoint for conflict checking
      const response = await http.post('/api/bookings/check-availability', {
        locationId,
        spaceIds: spaceIds.length > 0 ? spaceIds : undefined,
        startAt,
        endAt,
        excludeBookingId
      });

      const foundConflicts = response.data.conflicts || [];
      setConflicts(foundConflicts);
      onConflictsDetected(foundConflicts);

      // Generate suggestions if conflicts exist
      if (foundConflicts.length > 0) {
        await generateSuggestions(startAt, endAt);
      } else {
        setSuggestions([]);
        onSuggestionsFound([]);
      }
    } catch (error) {
      logger.error('Failed to check conflicts:', error);
      // Silently fail - don't block the user from booking
      setConflicts([]);
      onConflictsDetected([]);
    } finally {
      setChecking(false);
    }
  };

  const generateSuggestions = async (originalStart: string, originalEnd: string) => {
    try {
      const start = parseISO(originalStart);
      const end = parseISO(originalEnd);
      const duration = (end.getTime() - start.getTime()) / (1000 * 60); // Duration in minutes

      const newSuggestions: Suggestion[] = [];

      // Suggest earlier time (30 minutes before)
      const earlierStart = subMinutes(start, 30);
      const earlierEnd = subMinutes(end, 30);
      if (earlierStart > new Date()) {
        newSuggestions.push({
          startAt: earlierStart.toISOString(),
          endAt: earlierEnd.toISOString(),
          label: `${format(earlierStart, 'h:mm a')} - ${format(earlierEnd, 'h:mm a')}`,
          type: 'earlier'
        });
      }

      // Suggest later time (30 minutes after)
      const laterStart = addMinutes(start, 30);
      const laterEnd = addMinutes(end, 30);
      newSuggestions.push({
        startAt: laterStart.toISOString(),
        endAt: laterEnd.toISOString(),
        label: `${format(laterStart, 'h:mm a')} - ${format(laterEnd, 'h:mm a')}`,
        type: 'later'
      });

      // Try to get next available slot from backend
      try {
        const nextSlotResponse = await http.get('/api/bookings/next-available', {
          params: {
            locationId,
            spaceIds: spaceIds.length > 0 ? spaceIds.join(',') : undefined,
            duration,
            after: originalStart
          }
        });

        if (nextSlotResponse.data.slot) {
          const nextStart = parseISO(nextSlotResponse.data.slot.startAt);
          const nextEnd = parseISO(nextSlotResponse.data.slot.endAt);
          newSuggestions.push({
            startAt: nextSlotResponse.data.slot.startAt,
            endAt: nextSlotResponse.data.slot.endAt,
            label: `Next Available: ${format(nextStart, 'MMM d, h:mm a')}`,
            type: 'next_available'
          });
        }
      } catch (error) {
        // Ignore if next available endpoint fails
        logger.debug('Next available slot endpoint not available');
      }

      setSuggestions(newSuggestions);
      onSuggestionsFound(newSuggestions);
    } catch (error) {
      logger.error('Failed to generate suggestions:', error);
      setSuggestions([]);
      onSuggestionsFound([]);
    }
  };

  if (!conflicts.length && !checking) return null;

  return (
    <div className="mx-6 mb-4">
      <div className={`
        p-4 rounded-lg border transition-all
        ${conflicts.length > 0
          ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
          : 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800'
        }
      `}>
        <div className="flex items-start gap-3">
          {checking ? (
            <>
              <div className="animate-spin mt-0.5">
                <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                  Checking availability...
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  Verifying selected time slot
                </p>
              </div>
            </>
          ) : conflicts.length > 0 ? (
            <>
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-red-900 dark:text-red-100">
                    Time Conflict Detected
                  </h4>
                  <StatusBadge
                    status="error"
                    text={`${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''}`}
                  />
                </div>

                {/* Conflict Details */}
                <div className="mt-2 space-y-2">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    This time slot conflicts with existing bookings:
                  </p>

                  <div className="space-y-1">
                    {conflicts.slice(0, expandDetails ? undefined : 2).map((conflict, idx) => (
                      <div
                        key={conflict.id || idx}
                        className="flex items-start gap-2 text-xs bg-white/50 dark:bg-gray-800/50 rounded p-2"
                      >
                        <ChevronRight className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {conflict.isAdminBlock ? (
                              <>
                                <span className="font-medium text-red-800 dark:text-red-200">
                                  Blocked: {conflict.blockReason || 'Maintenance'}
                                </span>
                              </>
                            ) : (
                              <>
                                <Users className="w-3 h-3" />
                                <span className="font-medium text-red-800 dark:text-red-200">
                                  {conflict.customerName || 'Guest Booking'}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mt-1">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {format(parseISO(conflict.startAt), 'MMM d, h:mm a')} -
                              {format(parseISO(conflict.endAt), 'h:mm a')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {conflicts.length > 2 && (
                    <button
                      onClick={() => setExpandDetails(!expandDetails)}
                      className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
                    >
                      {expandDetails ? 'Show less' : `Show ${conflicts.length - 2} more conflicts`}
                    </button>
                  )}
                </div>

                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-red-200 dark:border-red-700">
                    <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-2">
                      Available Alternative Times:
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            // Parent component will handle this through the onChange prop
                            const startInput = document.querySelector('input[type="datetime-local"][name*="start"]') as HTMLInputElement;
                            const endInput = document.querySelector('input[type="datetime-local"][name*="end"]') as HTMLInputElement;

                            if (startInput && endInput) {
                              const newStart = new Date(suggestion.startAt);
                              const newEnd = new Date(suggestion.endAt);

                              // Format for datetime-local input
                              const formatForInput = (date: Date) => {
                                const year = date.getFullYear();
                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                const day = String(date.getDate()).padStart(2, '0');
                                const hours = String(date.getHours()).padStart(2, '0');
                                const minutes = String(date.getMinutes()).padStart(2, '0');
                                return `${year}-${month}-${day}T${hours}:${minutes}`;
                              };

                              startInput.value = formatForInput(newStart);
                              endInput.value = formatForInput(newEnd);

                              // Trigger change events
                              startInput.dispatchEvent(new Event('change', { bubbles: true }));
                              endInput.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                          }}
                          className={`
                            px-3 py-1.5 text-xs rounded-lg border transition-all
                            ${suggestion.type === 'next_available'
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30'
                              : 'bg-white dark:bg-gray-800 border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20'
                            }
                          `}
                        >
                          {suggestion.type === 'earlier' && '⏪ '}
                          {suggestion.type === 'later' && '⏩ '}
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}