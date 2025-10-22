import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  config: BookingConfig | null;
  onTimeSlotClick?: (startTime: Date, endTime: Date, spaceId?: string, spaceName?: string) => void;
  onBookingClick?: (booking: Booking) => void;
  onSpaceClick?: (space: Space) => void;
}

const DayGrid: React.FC<DayGridProps> = ({
  date,
  bookings,
  spaces,
  config,
  onTimeSlotClick,
  onBookingClick,
  onSpaceClick
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

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

  // Touch support state
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Smart button positioning state
  const [buttonPosition, setButtonPosition] = useState<{
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
    transform?: string;
  }>({ bottom: '20px', right: '20px' });

  // Calculate selection duration for display
  const selectionDuration = useMemo(() => {
    if (!selectionStart || !selectionEnd) return null;
    const slots = Math.abs(selectionEnd.slotIndex - selectionStart.slotIndex) + 1;
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

  // Get hourly rate based on config
  const getHourlyRate = () => {
    // Default rates by tier (from CHANGELOG v1.23.9)
    const defaultRates = {
      new: 30,
      member: 22.50,
      promo: 15,
      frequent: 20
    };

    // In a real implementation, this would come from config or user's tier
    return defaultRates.new;
  };

  // Calculate smart button position based on selection and viewport
  useEffect(() => {
    if (!selectionStart || isDragging || !gridRef.current) return;

    const calculatePosition = () => {
      const gridRect = gridRef.current!.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Calculate selection position
      const selectionEndY = (selectionEnd?.slotIndex || selectionStart.slotIndex) * 41 + 150;
      const spaceIndex = spaces.findIndex(s => s.id === selectionStart.spaceId);
      const spaceWidth = gridRect.width / spaces.length;
      const selectionCenterX = gridRect.left + 80 + (spaceIndex + 0.5) * spaceWidth;

      // Determine position based on available space
      const position: typeof buttonPosition = {};

      // Vertical positioning
      if (selectionEndY + 150 < viewportHeight - 100) {
        // Position below selection if space
        position.top = `${selectionEndY + 20}px`;
      } else if (window.innerWidth < 768) {
        // Mobile: dock to bottom
        position.bottom = '20px';
      } else {
        // Position above selection
        position.bottom = `${viewportHeight - selectionEndY + 100}px`;
      }

      // Horizontal positioning
      if (window.innerWidth < 768) {
        // Mobile: center horizontally
        position.left = '50%';
        position.transform = 'translateX(-50%)';
      } else if (selectionCenterX + 200 > viewportWidth) {
        // Too close to right edge
        position.right = '20px';
      } else if (selectionCenterX < 200) {
        // Too close to left edge
        position.left = '20px';
      } else {
        // Center on selection
        position.left = `${selectionCenterX}px`;
        position.transform = 'translateX(-50%)';
      }

      setButtonPosition(position);
    };

    // Calculate on mount and window resize
    calculatePosition();
    window.addEventListener('resize', calculatePosition);
    return () => window.removeEventListener('resize', calculatePosition);
  }, [selectionStart, selectionEnd, isDragging, spaces]);

  // Generate time slots for the day (6 AM to 11 PM)
  const timeSlots = useMemo(() => {
    const slots: Date[] = [];
    const dayStart = startOfDay(date);
    const startTime = addMinutes(dayStart, 6 * 60); // 6 AM
    const endTime = addMinutes(dayStart, 23 * 60); // 11 PM

    let current = startTime;
    while (current <= endTime) {
      slots.push(new Date(current));
      current = addMinutes(current, config?.gridInterval || 30);
    }
    return slots;
  }, [date, config?.gridInterval]);

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
    const slotEnd = addMinutes(slot, config?.gridInterval || 30);
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
    if (!selectionStart || !onTimeSlotClick) return;

    const endIndex = selectionEnd?.slotIndex ?? selectionStart.slotIndex + 1;
    const startTime = timeSlots[selectionStart.slotIndex];
    const endTime = timeSlots[endIndex + 1] || addMinutes(timeSlots[endIndex], 30);
    const space = spaces.find(s => s.id === selectionStart.spaceId);

    onTimeSlotClick(startTime, endTime, selectionStart.spaceId, space?.name);
    clearSelection();
  };

  // Detect touch device
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Global event listeners for mouse/touch up and escape key
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    const handleGlobalTouchEnd = () => {
      if (isDragging) {
        setIsDragging(false);
        touchStartRef.current = null;
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearSelection();
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchend', handleGlobalTouchEnd);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
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
    <div className="overflow-x-auto border border-[var(--border-primary)] rounded-lg" ref={gridRef}>
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
                      relative border-r border-b border-[var(--border-primary)] min-h-[41px] transition-all duration-200
                      ${isAvailable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}
                      ${isAvailable && !isSelected ? 'hover:bg-[var(--bg-hover)]' : ''}
                      ${isSelected ? 'bg-[var(--accent)]/10 border-[var(--accent)]' : ''}
                      ${isSelectionStart ? 'ring-2 ring-[var(--accent)] ring-inset z-10' : ''}
                      ${isSelectionEnd ? 'ring-2 ring-[var(--accent)] ring-inset z-10' : ''}
                      ${isTouchDevice ? 'touch-manipulation' : ''}
                    `}
                    data-slot-index={slotIndex}
                    data-space-id={space.id}
                    data-time={slot.toISOString()}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (!isTouchDevice && isAvailable && !slotBooking) {
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
                    onTouchStart={(e) => {
                      if (isAvailable && !slotBooking) {
                        const touch = e.touches[0];
                        touchStartRef.current = {
                          x: touch.clientX,
                          y: touch.clientY,
                          time: Date.now()
                        };

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
                      if (!isTouchDevice && isDragging && selectionStart && selectionStart.spaceId === space.id) {
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
                    onTouchMove={(e) => {
                      if (isDragging && selectionStart && selectionStart.spaceId === space.id) {
                        const touch = e.touches[0];
                        const element = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement;

                        if (element && element.dataset.slotIndex) {
                          const targetSlotIndex = parseInt(element.dataset.slotIndex);
                          const targetSpaceId = element.dataset.spaceId;

                          if (targetSpaceId === space.id) {
                            const canExtend = checkCanExtendSelection(targetSlotIndex, space.id);
                            if (canExtend) {
                              setSelectionEnd({
                                time: timeSlots[targetSlotIndex],
                                slotIndex: targetSlotIndex
                              });
                            }
                          }
                        }
                      }
                    }}
                    onMouseUp={() => {
                      if (!isTouchDevice && selectionStart && isDragging) {
                        setIsDragging(false);
                        // Selection is complete, ready for confirmation
                      }
                    }}
                    onTouchEnd={() => {
                      if (selectionStart && isDragging) {
                        setIsDragging(false);
                        touchStartRef.current = null;
                        // Selection is complete, ready for confirmation
                      }
                    }}
                  >
                    {slotBooking && (
                      <BookingBlock
                        booking={slotBooking}
                        onClick={() => onBookingClick?.(slotBooking)}
                        config={config}
                        compact={true}
                      />
                    )}
                    {isSelected && !slotBooking && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="w-full h-full bg-[var(--accent)]/5"></div>
                        {/* Show "30 min" marker on each selected slot */}
                        {!isSelectionStart && !isSelectionEnd && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] text-[var(--accent)] opacity-50">30min</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Minimal duration indicator during selection */}
      {isDragging && selectionStart && selectionEnd && selectionDuration && (
        <div
          className="fixed z-40 pointer-events-none"
          style={{
            // Follow the drag position
            bottom: '20px',
            right: '20px',
          }}
        >
          <div className="bg-[var(--accent)] text-white text-sm font-medium px-3 py-1.5 rounded-md shadow-lg">
            {selectionDuration}
          </div>
        </div>
      )}

      {/* Inline confirmation panel - minimal and informative */}
      {selectionStart && !isDragging && (
        <div
          ref={buttonRef}
          className="fixed z-50 bg-white dark:bg-[var(--bg-secondary)] rounded-md shadow-lg p-3 border border-[var(--border-primary)] max-w-sm"
          style={buttonPosition}>
          {/* Time and space info */}
          <div className="space-y-1 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">Time:</span>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {format(timeSlots[selectionStart.slotIndex], 'h:mm a')} -
                {' '}{format(timeSlots[(selectionEnd?.slotIndex ?? selectionStart.slotIndex + 1) + 1] ||
                             addMinutes(timeSlots[selectionEnd?.slotIndex ?? selectionStart.slotIndex + 1], 30), 'h:mm a')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">Duration:</span>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {selectionDuration || '1 hour'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">Simulator:</span>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {spaces.find(s => s.id === selectionStart.spaceId)?.name}
              </span>
            </div>
            {/* Price estimate */}
            <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-primary)]">
              <span className="text-xs text-[var(--text-muted)]">Estimated Price:</span>
              <span className="text-sm font-bold text-[var(--accent)]">
                ${(() => {
                  const duration = Math.abs((selectionEnd?.slotIndex ?? selectionStart.slotIndex + 1) - selectionStart.slotIndex + 1) * 30;
                  const hourlyRate = getHourlyRate();
                  return (duration / 60 * hourlyRate).toFixed(2);
                })()}
              </span>
            </div>
          </div>
          {/* Actions */}
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={confirmSelection} fullWidth>
              Continue to Booking
            </Button>
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayGrid;