import React, { useState, useEffect } from 'react';
import { format, addMinutes, differenceInMinutes, isBefore, isAfter, startOfDay, endOfDay } from 'date-fns';
import { Clock, AlertCircle, Info } from 'lucide-react';

interface TimeIncrementSelectorProps {
  startTime?: Date;
  endTime?: Date;
  minDuration?: number;  // From config, default 60
  maxDuration?: number;  // From config, default 360
  incrementAfterFirstHour?: number;  // From config, default 30
  allowCrossMidnight?: boolean;  // From config
  customerTier?: string;
  maxAdvanceDays?: number;  // Based on customer tier
  onChange: (start: Date, end: Date) => void;
  onValidationError?: (error: string) => void;
  className?: string;
}

const TimeIncrementSelector: React.FC<TimeIncrementSelectorProps> = ({
  startTime = new Date(),
  endTime,
  minDuration = 60,
  maxDuration = 360,
  incrementAfterFirstHour = 30,
  allowCrossMidnight = true,
  customerTier = 'new',
  maxAdvanceDays = 14,
  onChange,
  onValidationError,
  className = ''
}) => {
  const [selectedStart, setSelectedStart] = useState(startTime);
  const [selectedEnd, setSelectedEnd] = useState(endTime || addMinutes(startTime, minDuration));
  const [durationMinutes, setDurationMinutes] = useState(minDuration);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Available duration options based on config
  const getDurationOptions = () => {
    const options = [];

    // Always include minimum duration
    options.push({
      value: minDuration,
      label: formatDuration(minDuration),
      recommended: true
    });

    // Add increments after first hour
    let currentDuration = minDuration;
    while (currentDuration < maxDuration) {
      currentDuration += incrementAfterFirstHour;
      if (currentDuration <= maxDuration) {
        options.push({
          value: currentDuration,
          label: formatDuration(currentDuration),
          recommended: false
        });
      }
    }

    return options;
  };

  // Format duration for display
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) {
      return `${mins} minutes`;
    } else if (mins === 0) {
      return hours === 1 ? '1 hour' : `${hours} hours`;
    } else {
      return `${hours}h ${mins}m`;
    }
  };

  // Validate booking time
  const validateBooking = (): string | null => {
    const now = new Date();
    const bookingStart = selectedStart;
    const bookingEnd = selectedEnd;

    // Check if booking is in the past
    if (isBefore(bookingStart, now)) {
      return 'Cannot book in the past';
    }

    // Check if booking is less than 1 hour before start
    const minutesUntilStart = differenceInMinutes(bookingStart, now);
    if (minutesUntilStart < 60) {
      return 'Bookings must be made at least 1 hour in advance';
    }

    // Check advance booking limit based on tier
    const daysInAdvance = differenceInMinutes(bookingStart, now) / (60 * 24);
    if (daysInAdvance > maxAdvanceDays) {
      return `${customerTier === 'new' ? 'New customers' : 'Your tier'} can only book ${maxAdvanceDays} days in advance`;
    }

    // Check duration constraints
    const duration = differenceInMinutes(bookingEnd, bookingStart);
    if (duration < minDuration) {
      return `Minimum booking duration is ${formatDuration(minDuration)}`;
    }

    if (duration > maxDuration) {
      return `Maximum booking duration is ${formatDuration(maxDuration)}`;
    }

    // Check increment rules (after first hour)
    if (duration > minDuration) {
      const additionalMinutes = duration - minDuration;
      if (additionalMinutes % incrementAfterFirstHour !== 0) {
        return `After ${formatDuration(minDuration)}, bookings must be in ${incrementAfterFirstHour}-minute increments`;
      }
    }

    // Check cross-midnight bookings
    if (!allowCrossMidnight) {
      const startDay = startOfDay(bookingStart);
      const endDay = startOfDay(bookingEnd);
      if (startDay.getTime() !== endDay.getTime()) {
        return 'Bookings cannot cross midnight';
      }
    }

    return null;
  };

  // Handle duration change
  const handleDurationChange = (newDuration: number) => {
    setDurationMinutes(newDuration);
    const newEnd = addMinutes(selectedStart, newDuration);
    setSelectedEnd(newEnd);

    const error = validateBooking();
    if (error) {
      setValidationError(error);
      onValidationError?.(error);
    } else {
      setValidationError(null);
      onChange(selectedStart, newEnd);
    }
  };

  // Handle start time change
  const handleStartTimeChange = (newStart: Date) => {
    setSelectedStart(newStart);
    const newEnd = addMinutes(newStart, durationMinutes);
    setSelectedEnd(newEnd);

    const error = validateBooking();
    if (error) {
      setValidationError(error);
      onValidationError?.(error);
    } else {
      setValidationError(null);
      onChange(newStart, newEnd);
    }
  };

  // Quick time selectors
  const quickTimes = [
    { label: 'Morning', hour: 9, minute: 0 },
    { label: 'Noon', hour: 12, minute: 0 },
    { label: 'Afternoon', hour: 14, minute: 0 },
    { label: 'Evening', hour: 18, minute: 0 },
    { label: 'Night', hour: 20, minute: 0 }
  ];

  // Effect to validate on mount and changes
  useEffect(() => {
    const error = validateBooking();
    setValidationError(error);
    if (error) {
      onValidationError?.(error);
    }
  }, [selectedStart, selectedEnd, customerTier]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Duration Selector */}
      <div>
        <label className="block text-sm font-medium mb-2">
          <Clock className="inline w-4 h-4 mr-1" />
          Booking Duration
        </label>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {getDurationOptions().map(option => (
            <button
              key={option.value}
              onClick={() => handleDurationChange(option.value)}
              className={`
                px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 touch-manipulation
                min-h-[44px] sm:min-h-[40px]
                ${durationMinutes === option.value
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)]'
                }
                ${option.recommended ? 'ring-2 ring-[var(--status-success)]/30' : ''}
              `}
            >
              {option.label}
              {option.recommended && (
                <span className="block text-xs mt-0.5 opacity-80">Popular</span>
              )}
            </button>
          ))}
        </div>

        {/* Duration info */}
        <div className="mt-2 text-xs text-[var(--text-secondary)] flex items-start gap-1">
          <Info className="w-3 h-3 mt-0.5" />
          <span>
            {minDuration} minute minimum •
            {incrementAfterFirstHour} minute increments after first hour •
            Maximum {formatDuration(maxDuration)}
          </span>
        </div>
      </div>

      {/* Time Display */}
      <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-[var(--text-secondary)] uppercase mb-1">Start</div>
            <div className="text-lg font-semibold">
              {format(selectedStart, 'h:mm a')}
            </div>
            <div className="text-sm text-[var(--text-secondary)]">
              {format(selectedStart, 'EEE, MMM d')}
            </div>
          </div>

          <div className="px-4">
            <div className="text-2xl text-[var(--text-secondary)]">→</div>
            <div className="text-xs text-center mt-1">{formatDuration(durationMinutes)}</div>
          </div>

          <div>
            <div className="text-xs text-[var(--text-secondary)] uppercase mb-1">End</div>
            <div className="text-lg font-semibold">
              {format(selectedEnd, 'h:mm a')}
            </div>
            <div className="text-sm text-[var(--text-secondary)]">
              {format(selectedEnd, 'EEE, MMM d')}
            </div>
          </div>
        </div>

        {/* Quick time buttons */}
        <div className="pt-3 border-t border-[var(--border)]">
          <div className="text-xs text-[var(--text-secondary)] mb-2">Quick Start Times</div>
          <div className="flex gap-2 flex-wrap">
            {quickTimes.map(time => {
              const quickStart = new Date(selectedStart);
              quickStart.setHours(time.hour, time.minute, 0, 0);

              return (
                <button
                  key={time.label}
                  onClick={() => handleStartTimeChange(quickStart)}
                  className="px-3 py-2 min-h-[36px] text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--accent)] hover:text-white rounded-md transition-all duration-200 touch-manipulation border border-[var(--border-primary)] hover:border-[var(--accent)]"
                >
                  {time.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className="bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-[var(--status-error)] mt-0.5" />
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">
                Invalid Booking Time
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                {validationError}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tier-based restrictions info */}
      {customerTier === 'new' && (
        <div className="bg-[var(--status-info)]/10 border border-[var(--status-info)]/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-[var(--status-info)] mt-0.5" />
            <div className="text-xs">
              <div className="font-medium text-[var(--text-primary)]">
                New Customer Booking Limits
              </div>
              <ul className="mt-1 space-y-0.5 text-[var(--text-secondary)]">
                <li>• Book up to {maxAdvanceDays} days in advance</li>
                <li>• After 3 bookings, upgrade to Standard Member</li>
                <li>• Standard Members can book 30 days ahead</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeIncrementSelector;