import React, { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  isAfter
} from 'date-fns';
import { BottomSheet } from '@/components/shared/BottomSheet';
import Button from '@/components/ui/Button';

interface MobileDatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (date: Date) => void;
  selectedDate?: Date;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  maxAdvanceDays?: number;
}

export const MobileDatePicker: React.FC<MobileDatePickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedDate = new Date(),
  minDate = new Date(),
  maxDate,
  disabledDates = [],
  maxAdvanceDays = 30
}) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);

  // Calculate max date if using maxAdvanceDays
  const effectiveMaxDate = maxDate || addDays(new Date(), maxAdvanceDays);

  // Generate calendar days
  const generateCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(new Date(day));
      day = addDays(day, 1);
    }

    return days;
  };

  // Check if a date is disabled
  const isDateDisabled = (date: Date): boolean => {
    if (isBefore(date, minDate)) return true;
    if (isAfter(date, effectiveMaxDate)) return true;

    return disabledDates.some(disabled => isSameDay(disabled, date));
  };

  // Handle date selection
  const handleDateSelect = (date: Date) => {
    if (!isDateDisabled(date)) {
      onSelect(date);
      onClose();
    }
  };

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Select Date"
      maxHeight="90vh"
    >
      <div className="p-4 space-y-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors touch-manipulation"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <h3 className="text-lg font-semibold">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>

          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors touch-manipulation"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Today Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            icon={Calendar}
          >
            Today
          </Button>
        </div>

        {/* Week Days Header */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekDays.map(day => (
            <div
              key={day}
              className="py-2 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);
            const isDisabled = isDateDisabled(day);

            return (
              <button
                key={index}
                onClick={() => handleDateSelect(day)}
                disabled={isDisabled}
                className={`
                  relative p-3 text-sm rounded-lg transition-all duration-200 touch-manipulation min-h-[48px]
                  ${isSelected
                    ? 'bg-[var(--accent)] text-white shadow-md scale-105'
                    : isTodayDate
                      ? 'bg-[var(--accent-light)] text-[var(--accent)] font-semibold'
                      : isDisabled
                        ? 'bg-[var(--bg-tertiary)] text-[var(--text-disabled)] cursor-not-allowed opacity-50'
                        : isCurrentMonth
                          ? 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
                          : 'bg-transparent text-[var(--text-muted)]'
                  }
                `}
              >
                {format(day, 'd')}
                {isTodayDate && (
                  <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-[var(--accent)] rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Info Message */}
        <div className="flex items-start gap-2 p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <Info className="w-4 h-4 text-[var(--accent)] mt-0.5 flex-shrink-0" />
          <div className="text-sm text-[var(--text-secondary)]">
            You can book up to {maxAdvanceDays} days in advance.
            {minDate && (
              <span className="block mt-1">
                Earliest available: {format(minDate, 'MMM d, yyyy')}
              </span>
            )}
          </div>
        </div>

        {/* Selected Date Display */}
        {selectedDate && (
          <div className="p-4 bg-[var(--accent-light)] rounded-lg animate-slideUp">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Selected:</span>
              <span className="font-medium text-[var(--accent)]">
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </span>
            </div>
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
        </div>
      </div>
    </BottomSheet>
  );
};

export default MobileDatePicker;