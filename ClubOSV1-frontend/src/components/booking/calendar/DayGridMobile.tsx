import React, { useState, useRef, useEffect, useMemo } from 'react';
import { format, startOfDay, addMinutes, isSameDay } from 'date-fns';
import { Clock } from 'lucide-react';
import { Booking, Space } from './BookingCalendarCompact';
import { BookingConfig } from '@/services/booking/bookingConfig';
import Button from '@/components/ui/Button';

interface DayGridMobileProps {
  date: Date;
  bookings: Booking[];
  spaces: Space[];
  config: BookingConfig;
  onBookingCreate?: (startTime: Date, endTime: Date, spaceId?: string, spaceName?: string) => void;
  onBookingSelect?: (booking: Booking) => void;
}

const DayGridMobile: React.FC<DayGridMobileProps> = ({
  date,
  bookings,
  spaces,
  config,
  onBookingCreate,
  onBookingSelect
}) => {
  const gridRef = useRef<HTMLDivElement>(null);

  // Selection state
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number>(0);

  // Generate time slots for the day (6 AM to 11 PM)
  const timeSlots = useMemo(() => {
    const slots: Date[] = [];
    const dayStart = startOfDay(date);
    const startTime = addMinutes(dayStart, 6 * 60); // 6 AM
    const endTime = addMinutes(dayStart, 23 * 60); // 11 PM

    let current = startTime;
    while (current <= endTime) {
      slots.push(new Date(current));
      current = addMinutes(current, 30); // Always 30-minute slots
    }
    return slots;
  }, [date]);

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
  const isSlotAvailable = (slotIndex: number, spaceId: string): boolean => {
    const slot = timeSlots[slotIndex];
    if (!slot) return false;

    const slotEnd = addMinutes(slot, 30);
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

  // Calculate selection duration
  const selectionDuration = useMemo(() => {
    if (selectionStart === null || selectionEnd === null) return null;
    const slots = Math.abs(selectionEnd - selectionStart) + 1;
    const totalMinutes = slots * 30;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${minutes} minutes`;
    }
  }, [selectionStart, selectionEnd]);

  // Calculate price based on duration
  const selectionPrice = useMemo(() => {
    if (selectionStart === null || selectionEnd === null) return null;
    const slots = Math.abs(selectionEnd - selectionStart) + 1;
    const totalMinutes = slots * 30;
    const hourlyRate = 30; // Should come from config/tier
    return (totalMinutes / 60 * hourlyRate).toFixed(2);
  }, [selectionStart, selectionEnd]);

  // Handle touch/click on slot
  const handleSlotInteraction = (slotIndex: number, space: Space) => {
    if (!isSlotAvailable(slotIndex, space.id)) return;

    setSelectedSpace(space);
    setSelectionStart(slotIndex);
    setSelectionEnd(Math.min(slotIndex + 1, timeSlots.length - 1)); // Default 1 hour
    setIsDragging(true);
  };

  // Handle drag to extend selection
  const handleDragMove = (clientY: number) => {
    if (!isDragging || selectionStart === null || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const slotHeight = 24; // Reduced height for modern look
    const headerHeight = 40; // Compact header

    const slotIndex = Math.floor((relativeY - headerHeight) / slotHeight);
    const clampedIndex = Math.max(0, Math.min(slotIndex, timeSlots.length - 1));

    // Check if we can extend to this slot
    if (selectedSpace) {
      let canExtend = true;
      const start = Math.min(selectionStart, clampedIndex);
      const end = Math.max(selectionStart, clampedIndex);

      for (let i = start; i <= end; i++) {
        if (!isSlotAvailable(i, selectedSpace.id)) {
          canExtend = false;
          break;
        }
      }

      if (canExtend && Math.abs(clampedIndex - selectionStart) < 8) { // Max 4 hours
        setSelectionEnd(clampedIndex);
      }
    }
  };

  // Confirm selection
  const confirmSelection = () => {
    if (selectionStart === null || selectionEnd === null || !selectedSpace) return;

    const startIdx = Math.min(selectionStart, selectionEnd);
    const endIdx = Math.max(selectionStart, selectionEnd);

    const startTime = timeSlots[startIdx];
    const endTime = addMinutes(timeSlots[endIdx], 30);

    onBookingCreate?.(startTime, endTime, selectedSpace.id, selectedSpace.name);
    clearSelection();
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedSpace(null);
    setSelectionStart(null);
    setSelectionEnd(null);
    setIsDragging(false);
  };

  // Global event listeners
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        handleDragMove(e.touches[0].clientY);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleDragMove(e.clientY);
      }
    };

    const handleEnd = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('mouseup', handleEnd);

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('mouseup', handleEnd);
    };
  }, [isDragging]);

  return (
    <div className="relative" ref={gridRef}>
      {/* Space selector tabs */}
      <div className="flex overflow-x-auto scrollbar-hide border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        {spaces.map(space => {
          const spaceBookings = bookingsBySpace[space.id] || [];
          const availableSlots = timeSlots.filter((_, idx) => isSlotAvailable(idx, space.id)).length;

          return (
            <button
              key={space.id}
              onClick={() => setSelectedSpace(space)}
              className={`
                flex-shrink-0 px-3 py-1.5 border-r-[0.5px] border-[var(--border-primary)] transition-all duration-150 touch-manipulation
                ${selectedSpace?.id === space.id ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--accent)]/[0.04]'}
              `}
              style={{ minWidth: '90px', minHeight: '40px' }}
            >
              <div className="text-xs font-medium">{space.name}</div>
              <div className="text-[10px] opacity-75">
                {availableSlots} free
              </div>
            </button>
          );
        })}
      </div>

      {/* Time grid for selected space */}
      {selectedSpace && (
        <div className="border border-t-0 border-[var(--border-primary)] rounded-b-lg">
          <div className="max-h-[60vh] overflow-y-auto">
            {timeSlots.map((slot, slotIndex) => {
              const isAvailable = isSlotAvailable(slotIndex, selectedSpace.id);
              const booking = dayBookings.find(b =>
                b.spaceIds.includes(selectedSpace.id) &&
                new Date(b.startAt).getTime() === slot.getTime()
              );

              const isSelected = selectionStart !== null && selectionEnd !== null &&
                slotIndex >= Math.min(selectionStart, selectionEnd) &&
                slotIndex <= Math.max(selectionStart, selectionEnd);

              return (
                <div
                  key={slotIndex}
                  className={`
                    flex items-center border-b-[0.5px] border-[var(--border-primary)] transition-all duration-150
                    ${isAvailable ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}
                    ${isSelected ? 'bg-[var(--accent)]/[0.08] border-l-2 border-l-[var(--accent)]' : ''}
                    ${!isSelected && isAvailable ? 'hover:bg-[var(--accent)]/[0.04]' : ''}
                  `}
                  style={{ height: '24px' }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    if (isAvailable) {
                      setTouchStartY(e.touches[0].clientY);
                      handleSlotInteraction(slotIndex, selectedSpace);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (isAvailable) {
                      handleSlotInteraction(slotIndex, selectedSpace);
                    }
                  }}
                >
                  {/* Time label - compact */}
                  <div className="w-14 px-1 text-[10px] font-mono text-[var(--text-secondary)]">
                    {format(slot, slotIndex % 2 === 0 ? 'h:mma' : 'h:mm').toLowerCase()}
                  </div>

                  {/* Availability indicator - minimal */}
                  <div className="flex-1 px-1">
                    {booking ? (
                      <div className="text-[10px] text-[var(--text-muted)] truncate">
                        {booking.customerName?.split(' ')[0] || '•••'}
                      </div>
                    ) : isAvailable ? (
                      <div className="text-[10px] text-[var(--accent)]/60">—</div>
                    ) : (
                      <div className="text-[10px] text-[var(--text-muted)]">×</div>
                    )}
                  </div>

                  {/* Live time display on selection */}
                  {isSelected && selectionStart === slotIndex && (
                    <div className="absolute right-2 text-[9px] font-medium text-[var(--accent)]">
                      {format(slot, 'h:mm a')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selection summary panel with glass morphism */}
      {selectionStart !== null && !isDragging && selectedSpace && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t-[0.5px] border-[var(--accent)]/20 p-3 shadow-xl z-50">
          <div className="max-w-lg mx-auto">
            <div className="flex items-start justify-between mb-3">
              <div className="space-y-1">
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  {selectedSpace.name} • {selectionDuration}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {selectionStart !== null && selectionEnd !== null && (
                    <>
                      {format(timeSlots[Math.min(selectionStart, selectionEnd)], 'h:mm a')} -
                      {' '}{format(addMinutes(timeSlots[Math.max(selectionStart, selectionEnd)], 30), 'h:mm a')}
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-[var(--accent)]">
                  ${selectionPrice}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  Estimated
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={confirmSelection}
                fullWidth
                icon={Clock}
              >
                Continue Booking
              </Button>
              <Button
                variant="ghost"
                onClick={clearSelection}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions overlay when no space selected */}
      {!selectedSpace && spaces.length > 0 && (
        <div className="p-8 text-center text-[var(--text-muted)]">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a simulator above to view availability</p>
          <p className="text-xs mt-1">Tap and slide to select your time</p>
        </div>
      )}
    </div>
  );
};

export default DayGridMobile;