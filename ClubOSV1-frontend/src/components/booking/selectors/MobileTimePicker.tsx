import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Check } from 'lucide-react';
import { format, addMinutes, startOfDay, isSameDay } from 'date-fns';
import { BottomSheet } from '@/components/shared/BottomSheet';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import { TimeValidationService } from '@/services/booking/timeValidationService';

interface MobileTimePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (startTime: Date, endTime: Date) => void;
  selectedDate: Date;
  minDuration?: number;
  maxDuration?: number;
  incrementAfterFirst?: number;
  customerTier?: 'new' | 'member' | 'promo' | 'frequent';
  availableSlots?: Array<{ start: Date; end: Date }>;
}

export const MobileTimePicker: React.FC<MobileTimePickerProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedDate,
  minDuration = 60,
  maxDuration = 360,
  incrementAfterFirst = 30,
  customerTier = 'new',
  availableSlots = []
}) => {
  const [selectedStartTime, setSelectedStartTime] = useState<Date | null>(null);
  const [selectedEndTime, setSelectedEndTime] = useState<Date | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Generate time slots for the day (6 AM to 11 PM)
  const generateTimeSlots = (): Date[] => {
    const slots: Date[] = [];
    const dayStart = startOfDay(selectedDate);
    const startTime = addMinutes(dayStart, 6 * 60); // 6 AM
    const endTime = addMinutes(dayStart, 23 * 60); // 11 PM

    let current = startTime;
    while (current <= endTime) {
      slots.push(new Date(current));
      current = addMinutes(current, 30); // 30-minute intervals
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Generate valid durations based on business rules
  const generateDurations = (): number[] => {
    const durations: number[] = [];

    // First hour (minimum)
    durations.push(60);

    // After first hour, add in 30-minute increments
    let current = 60 + incrementAfterFirst;
    while (current <= maxDuration) {
      durations.push(current);
      current += incrementAfterFirst;
    }

    return durations;
  };

  const validDurations = generateDurations();

  // Format duration for display
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (mins === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }

    return `${hours}h ${mins}min`;
  };

  // Check if a time slot is available
  const isSlotAvailable = (slot: Date): boolean => {
    if (availableSlots.length === 0) return true; // If no slots provided, all are available

    return availableSlots.some(available =>
      slot >= available.start && slot < available.end
    );
  };

  // Validate the selection
  const validateSelection = () => {
    if (!selectedStartTime || !selectedEndTime) {
      setValidationError('Please select both start and end times');
      return false;
    }

    const validation = TimeValidationService.validateBooking(
      selectedStartTime,
      selectedEndTime,
      customerTier,
      { minDuration, maxDuration, incrementAfterFirst }
    );

    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid time selection');
      return false;
    }

    setValidationError(null);
    return true;
  };

  const handleConfirm = () => {
    if (validateSelection() && selectedStartTime && selectedEndTime) {
      onConfirm(selectedStartTime, selectedEndTime);
      onClose();
    }
  };

  // Update end time when start time changes
  useEffect(() => {
    if (selectedStartTime) {
      // Default to 1-hour booking
      setSelectedEndTime(addMinutes(selectedStartTime, minDuration));
    }
  }, [selectedStartTime, minDuration]);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Select Time"
      maxHeight="80vh"
    >
      <div className="p-4 space-y-6">
        {/* Date display */}
        <div className="flex items-center justify-center p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <Calendar className="w-5 h-5 mr-2 text-[var(--accent)]" />
          <span className="font-medium">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
        </div>

        {/* Start Time Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="font-medium">Start Time</h3>
          </div>

          <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto smooth-scroll">
            {timeSlots.map((slot, index) => {
              const available = isSlotAvailable(slot);
              const selected = selectedStartTime?.getTime() === slot.getTime();

              return (
                <button
                  key={index}
                  onClick={() => available && setSelectedStartTime(slot)}
                  disabled={!available}
                  className={`
                    p-3 text-sm rounded-lg transition-all duration-200 touch-manipulation min-h-[48px]
                    ${selected
                      ? 'bg-[var(--accent)] text-white shadow-md scale-105'
                      : available
                        ? 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-disabled)] cursor-not-allowed opacity-50'
                    }
                  `}
                >
                  {format(slot, 'h:mm a')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration Selection */}
        {selectedStartTime && (
          <div className="space-y-3 animate-slideUp">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="font-medium">Duration</h3>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {validDurations.map((duration) => {
                const endTime = addMinutes(selectedStartTime, duration);
                const selected = selectedEndTime?.getTime() === endTime.getTime();

                return (
                  <button
                    key={duration}
                    onClick={() => setSelectedEndTime(endTime)}
                    className={`
                      p-3 text-sm rounded-lg transition-all duration-200 touch-manipulation min-h-[48px]
                      ${selected
                        ? 'bg-[var(--accent)] text-white shadow-md scale-105'
                        : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
                      }
                    `}
                  >
                    <div>{formatDuration(duration)}</div>
                    {duration === minDuration && (
                      <div className="text-xs opacity-70 mt-0.5">Minimum</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary */}
        {selectedStartTime && selectedEndTime && (
          <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg space-y-2 animate-slideUp">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Selected Time:</span>
              <span className="font-medium">
                {format(selectedStartTime, 'h:mm a')} - {format(selectedEndTime, 'h:mm a')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Duration:</span>
              <StatusBadge
                status="info"
                label={formatDuration(
                  Math.floor((selectedEndTime.getTime() - selectedStartTime.getTime()) / 60000)
                )}
              />
            </div>
          </div>
        )}

        {/* Validation Error */}
        {validationError && (
          <div className="p-3 bg-[var(--status-error)]/10 text-[var(--status-error)] rounded-lg text-sm">
            {validationError}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-[var(--border-primary)]">
          <Button
            variant="secondary"
            onClick={onClose}
            fullWidth
            size="lg"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={!selectedStartTime || !selectedEndTime}
            fullWidth
            size="lg"
            icon={Check}
          >
            Confirm
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
};

export default MobileTimePicker;