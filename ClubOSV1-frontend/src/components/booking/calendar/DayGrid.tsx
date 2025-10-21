import React, { useMemo, useState, useEffect } from 'react';
import { format, startOfDay, addMinutes, isSameDay } from 'date-fns';
import { Info } from 'lucide-react';
import { Booking, Space } from './BookingCalendar';
import { BookingConfig } from '@/services/booking/bookingConfig';
import BookingBlock from './BookingBlock';
import Button from '@/components/ui/Button';

interface DayGridProps {
  date: Date;
  bookings: Booking[];
  spaces: Space[];
  config: BookingConfig;
  onBookingCreate?: (startTime: Date, endTime: Date, spaceId?: string, spaceName?: string) => void;
  onBookingSelect?: (booking: Booking) => void;
  onSpaceClick?: (space: Space) => void;
}

const DayGrid: React.FC<DayGridProps> = ({
  date,
  bookings,
  spaces,
  config,
  onBookingCreate,
  onBookingSelect,
  onSpaceClick
}) => {
  // Selection state
  const [selectionStart, setSelectionStart] = useState<{
    time: Date;
    spaceId: string;
    slotIndex: number;
  } | null>(null);

  const [selectionEnd, setSelectionEnd] = useState<{
    time: Date;
    slotIndex: number;
  } | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState<{
    slotIndex: number;
    spaceId: string;
  } | null>(null);
  // Generate time slots for the day (6 AM to 11 PM)
  const timeSlots = useMemo(() => {
    const slots: Date[] = [];
    const dayStart = startOfDay(date);
    const startTime = addMinutes(dayStart, 6 * 60); // 6 AM
    const endTime = addMinutes(dayStart, 23 * 60); // 11 PM

    let current = startTime;
    while (current <= endTime) {
      slots.push(new Date(current));
      current = addMinutes(current, config.gridInterval || 30);
    }
    return slots;
  }, [date, config.gridInterval]);

  // Filter bookings for this day
  const dayBookings = useMemo(() => {
    return bookings.filter(booking =>
      isSameDay(new Date(booking.startAt), date)
    );
  }, [bookings, date]);

  // Group bookings by space
  const bookingsBySpace = useMemo(() => {
    const grouped: Record<string, Booking[]> = {};

    spaces.forEach(space => {
      grouped[space.id] = dayBookings.filter(booking =>
        booking.spaceIds.includes(space.id)
      );
    });

    return grouped;
  }, [dayBookings, spaces]);

  // Check if a time slot is available for a space
  const isSlotAvailable = (slot: Date, spaceId: string): boolean => {
    const slotEnd = addMinutes(slot, config.gridInterval || 30);
    const spaceBookings = bookingsBySpace[spaceId] || [];

    return !spaceBookings.some(booking => {
      const bookingStart = new Date(booking.startAt);
      const bookingEnd = new Date(booking.endAt);
      return (
        (slot >= bookingStart && slot < bookingEnd) ||
        (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
        (slot <= bookingStart && slotEnd >= bookingEnd)
      );
    });
  };

  // Check if a slot is within selection range
  const isSlotSelected = (slotIndex: number, spaceId: string): boolean => {
    if (!selectionStart || spaceId !== selectionStart.spaceId) return false;

    const endIndex = selectionEnd?.slotIndex ?? selectionStart.slotIndex + 1; // Min 1 hour (2 slots)
    const startIndex = selectionStart.slotIndex;

    return slotIndex >= Math.min(startIndex, endIndex) &&
           slotIndex <= Math.max(startIndex, endIndex);
  };

  // Check if we can extend selection to a slot
  const checkCanExtendSelection = (toSlotIndex: number, spaceId: string): boolean => {
    if (!selectionStart || spaceId !== selectionStart.spaceId) return false;

    const fromIndex = selectionStart.slotIndex;
    const startIdx = Math.min(fromIndex, toSlotIndex);
    const endIdx = Math.max(fromIndex, toSlotIndex);

    // Check all slots in range are available
    for (let i = startIdx; i <= endIdx; i++) {
      if (i < timeSlots.length && !isSlotAvailable(timeSlots[i], spaceId)) {
        return false;
      }
    }

    // Check max duration (e.g., 4 hours = 8 slots)
    if (endIdx - startIdx > 7) return false;

    return true;
  };

  // Clear selection
  const clearSelection = () => {
    setSelectionStart(null);
    setSelectionEnd(null);
    setIsDragging(false);
    setHoveredSlot(null);
  };

  // Confirm and create booking
  const confirmSelection = () => {
    if (!selectionStart || !onBookingCreate) return;

    const endIndex = selectionEnd?.slotIndex ?? selectionStart.slotIndex + 1;
    const startTime = timeSlots[selectionStart.slotIndex];
    const endTime = timeSlots[endIndex + 1] || addMinutes(timeSlots[endIndex], 30);
    const space = spaces.find(s => s.id === selectionStart.spaceId);

    onBookingCreate(startTime, endTime, selectionStart.spaceId, space?.name);
    clearSelection();
  };

  // Global event listeners for mouse up and escape key
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearSelection();
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isDragging]);

  if (spaces.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)]">
        <p>Loading simulator boxes...</p>
        <p className="text-sm mt-2">If this persists, please refresh the page.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-[var(--border-primary)] rounded-lg">
      <div className="min-w-[800px]">
        {/* Header with space names */}
        <div className="grid grid-cols-[80px_1fr] bg-[var(--bg-tertiary)]">
          <div className="p-3 border-r border-b border-[var(--border-primary)]">
            {/* Empty corner cell */}
          </div>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${spaces.length}, 1fr)` }}>
            {spaces.map(space => (
              <button
                key={space.id}
                onClick={() => onSpaceClick?.(space)}
                className="p-3 text-sm font-medium text-[var(--text-primary)] border-r border-b border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-center gap-1"
              >
                {space.name}
                <Info className="h-3 w-3 text-[var(--text-secondary)]" />
              </button>
            ))}
          </div>
        </div>

        {/* Time slots grid */}
        {timeSlots.map((slot, slotIndex) => (
          <div key={slotIndex} className="grid grid-cols-[80px_1fr]">
            {/* Time label */}
            <div className="px-2 py-2 text-xs text-[var(--text-secondary)] text-center border-r border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
              {format(slot, 'h:mm a')}
            </div>

            {/* Space slots */}
            <div className="grid" style={{ gridTemplateColumns: `repeat(${spaces.length}, 1fr)` }}>
              {spaces.map(space => {
                const slotBooking = dayBookings.find(booking => {
                  const bookingStart = new Date(booking.startAt);
                  return (
                    booking.spaceIds.includes(space.id) &&
                    bookingStart.getTime() === slot.getTime()
                  );
                });

                const isAvailable = isSlotAvailable(slot, space.id);
                const isSelected = isSlotSelected(slotIndex, space.id);
                const isSelectionStart = selectionStart?.spaceId === space.id && selectionStart?.slotIndex === slotIndex;
                const isSelectionEnd = selectionStart?.spaceId === space.id && selectionEnd?.slotIndex === slotIndex;

                return (
                  <div
                    key={`${space.id}-${slotIndex}`}
                    className={`
                      relative border-r border-b border-[var(--border-primary)] min-h-[41px] transition-all duration-150
                      ${isAvailable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}
                      ${isAvailable && !isSelected ? 'hover:bg-[var(--bg-hover)]' : ''}
                      ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-400' : ''}
                      ${isSelectionStart ? 'ring-2 ring-blue-500 ring-inset z-10' : ''}
                      ${isSelectionEnd ? 'ring-2 ring-blue-500 ring-inset z-10' : ''}
                    `}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (isAvailable && !slotBooking) {
                        setSelectionStart({
                          time: slot,
                          spaceId: space.id,
                          slotIndex: slotIndex
                        });
                        setIsDragging(true);

                        // Auto-select minimum 1 hour (next slot)
                        if (slotIndex < timeSlots.length - 1) {
                          setSelectionEnd({
                            time: timeSlots[slotIndex + 1],
                            slotIndex: slotIndex + 1
                          });
                        }
                      }
                    }}
                    onMouseEnter={() => {
                      if (isDragging && selectionStart && selectionStart.spaceId === space.id) {
                        // Check if we can extend to this slot
                        const canExtend = checkCanExtendSelection(slotIndex, space.id);
                        if (canExtend) {
                          setSelectionEnd({
                            time: slot,
                            slotIndex: slotIndex
                          });
                        }
                      }
                      setHoveredSlot({ slotIndex, spaceId: space.id });
                    }}
                    onMouseUp={() => {
                      if (selectionStart && isDragging) {
                        setIsDragging(false);
                        // Selection is complete, ready for confirmation
                      }
                    }}
                  >
                    {slotBooking && (
                      <BookingBlock
                        booking={slotBooking}
                        onClick={() => onBookingSelect?.(slotBooking)}
                        config={config}
                        compact={true}
                      />
                    )}
                    {isSelected && !slotBooking && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-full h-full bg-blue-500/10 dark:bg-blue-400/10"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Floating confirmation button */}
      {selectionStart && !isDragging && (
        <div className="absolute z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 border border-gray-200 dark:border-gray-700"
             style={{
               // Position it at the bottom-right of the selection
               bottom: '20px',
               right: '20px'
             }}>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            <div className="font-medium text-[var(--text-primary)]">
              {spaces.find(s => s.id === selectionStart.spaceId)?.name}
            </div>
            <div className="mt-1">
              {format(timeSlots[selectionStart.slotIndex], 'h:mm a')} -
              {' '}{format(timeSlots[(selectionEnd?.slotIndex ?? selectionStart.slotIndex + 1) + 1] ||
                           addMinutes(timeSlots[selectionEnd?.slotIndex ?? selectionStart.slotIndex + 1], 30), 'h:mm a')}
            </div>
            <div className="text-xs mt-1 text-[var(--text-muted)]">
              Duration: {((selectionEnd?.slotIndex ?? selectionStart.slotIndex + 1) - selectionStart.slotIndex + 1) * 30} minutes
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={confirmSelection}>
              Book Now
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayGrid;