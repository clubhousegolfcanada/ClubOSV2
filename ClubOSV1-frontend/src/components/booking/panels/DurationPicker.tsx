import React, { useEffect, useState } from 'react';
import { Clock, AlertCircle, Check, Calendar, Lock } from 'lucide-react';
import { format, addMinutes } from 'date-fns';
import Button from '@/components/ui/Button';
import { useBookingAvailability } from '@/hooks/useBookingAvailability';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface DurationPickerProps {
  locationId: string;
  spaceId: string;
  spaceName: string;
  startTime: Date;
  initialDuration?: number; // Initial duration in minutes
  onConfirm: (duration: number, endTime: Date) => void;
  onCancel: () => void;
  hourlyRate?: number;
  showPricing?: boolean;
}

export default function DurationPicker({
  locationId,
  spaceId,
  spaceName,
  startTime,
  initialDuration = 60,
  onConfirm,
  onCancel,
  hourlyRate = 30,
  showPricing = true
}: DurationPickerProps) {
  // Use the availability hook
  const {
    loading,
    availability,
    durationOptions,
    selectedDuration,
    updateDuration,
    formatDuration,
    getEndTime,
    isDurationAvailable,
    nextBooking
  } = useBookingAvailability({
    locationId,
    spaceId,
    startTime,
    autoCheck: true
  });

  const [hoveredDuration, setHoveredDuration] = useState<number | null>(null);

  // Set initial duration once loaded
  useEffect(() => {
    if (availability && initialDuration) {
      updateDuration(Math.min(initialDuration, availability.maxAvailableDuration));
    }
  }, [availability, initialDuration]);

  // Quick duration buttons
  const quickDurations = [
    { value: 60, label: '1 hour', icon: '⚡' },
    { value: 90, label: '1.5 hours', icon: '☕' },
    { value: 120, label: '2 hours', icon: '🎯' },
    { value: 150, label: '2.5 hours', icon: '💪' },
    { value: 180, label: '3 hours', icon: '🏆' },
    { value: 240, label: '4 hours', icon: '🔥' }
  ];

  const handleConfirm = () => {
    const endTime = getEndTime();
    if (endTime) {
      onConfirm(selectedDuration, endTime);
    }
  };

  // Calculate price for selected duration
  const calculatePrice = (duration: number): number => {
    return (duration / 60) * hourlyRate;
  };

  if (loading && !availability) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border-2 border-[var(--accent)]/20 p-8">
        <div className="flex items-center justify-center">
          <LoadingSpinner />
          <span className="ml-3 text-[var(--text-secondary)]">Checking availability...</span>
        </div>
      </div>
    );
  }

  if (!availability?.isAvailable) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border-2 border-red-500/20 p-6 max-w-md">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              Time Slot Unavailable
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              This time slot is already booked or unavailable.
            </p>

            {/* Show suggested alternatives */}
            {availability?.suggestedAlternatives && availability.suggestedAlternatives.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-[var(--text-primary)] mb-2">
                  Suggested alternatives:
                </p>
                <div className="space-y-2">
                  {availability.suggestedAlternatives.slice(0, 3).map((alt, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] text-sm"
                    >
                      {format(alt.startTime, 'h:mm a')} - {format(alt.endTime, 'h:mm a')}
                      <span className="text-[var(--text-muted)] ml-2">
                        ({formatDuration(alt.duration)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              variant="secondary"
              onClick={onCancel}
              className="mt-4 w-full"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border-2 border-[var(--accent)]/20 max-w-2xl animate-in slide-in-from-bottom-3 fade-in duration-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-primary)] bg-gradient-to-r from-[var(--accent)]/5 to-[var(--accent)]/10 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse"></div>
              Select Duration
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {spaceName} • {format(startTime, 'EEEE, MMMM d')}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Fixed start time display */}
        <div className="mb-6 p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-sm font-medium text-[var(--text-muted)]">Start Time (Locked)</span>
            </div>
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {format(startTime, 'h:mm a')}
            </span>
          </div>
        </div>

        {/* Duration selection grid */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">
            Choose Duration
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {quickDurations.map(({ value, label, icon }) => {
              const available = isDurationAvailable(value);
              const isSelected = selectedDuration === value;
              const option = durationOptions?.availableOptions.find(opt => opt.duration === value);

              return (
                <button
                  key={value}
                  onClick={() => available && updateDuration(value)}
                  onMouseEnter={() => setHoveredDuration(value)}
                  onMouseLeave={() => setHoveredDuration(null)}
                  disabled={!available}
                  className={`
                    relative p-3 rounded-lg border-2 transition-all duration-200
                    ${isSelected
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-lg scale-105'
                      : available
                        ? 'bg-white dark:bg-gray-800 border-[var(--border-primary)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5'
                        : 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <div className="flex items-center gap-1">
                        <span className="text-lg">{icon}</span>
                        <span className={`font-semibold ${isSelected ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                          {label}
                        </span>
                      </div>
                      {showPricing && (
                        <div className={`text-sm mt-1 ${isSelected ? 'text-white/90' : 'text-[var(--text-secondary)]'}`}>
                          ${calculatePrice(value).toFixed(2)}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-5 h-5 text-white" />
                    )}
                  </div>

                  {/* Disabled reason tooltip */}
                  {!available && option?.disabledReason && hoveredDuration === value && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-10">
                      <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                        {option.disabledReason}
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                          <div className="border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom duration options if more are available */}
          {durationOptions && durationOptions.availableOptions.length > 6 && (
            <div className="mt-3">
              <select
                value={selectedDuration}
                onChange={(e) => updateDuration(Number(e.target.value))}
                className="w-full px-3 py-2 border border-[var(--border-primary)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
              >
                <option value="">More options...</option>
                {durationOptions.availableOptions
                  .filter(opt => opt.duration > 240 && opt.available)
                  .map(opt => (
                    <option key={opt.duration} value={opt.duration}>
                      {opt.label} - ${opt.price.toFixed(2)}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {/* Availability warning */}
        {nextBooking && availability && (
          <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Next booking at {format(nextBooking, 'h:mm a')}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Maximum available: {formatDuration(availability.maxAvailableDuration)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="p-4 bg-gradient-to-r from-[var(--accent)]/5 to-[var(--accent)]/10 rounded-lg border border-[var(--accent)]/20">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-muted)] uppercase tracking-wider">Time</span>
              <div className="text-right">
                <div className="font-semibold text-[var(--text-primary)]">
                  {format(startTime, 'h:mm a')}
                  <span className="mx-2 text-[var(--text-muted)]">→</span>
                  {getEndTime() && format(getEndTime()!, 'h:mm a')}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  {formatDuration(selectedDuration)}
                </div>
              </div>
            </div>

            {showPricing && (
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border-primary)]">
                <span className="text-sm text-[var(--text-muted)] uppercase tracking-wider">Total Price</span>
                <span className="text-2xl font-bold text-[var(--accent)]">
                  ${calculatePrice(selectedDuration).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl border-t border-[var(--border-primary)] flex gap-3">
        <Button
          variant="secondary"
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirm}
          className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-semibold"
          disabled={!selectedDuration || selectedDuration === 0}
        >
          <Calendar className="w-4 h-4 mr-2" />
          Confirm Booking
        </Button>
      </div>
    </div>
  );
}