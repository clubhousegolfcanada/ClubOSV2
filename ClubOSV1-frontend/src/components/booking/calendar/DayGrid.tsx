import React, { useMemo, useState, useEffect, useRef, memo, lazy, Suspense } from 'react';
import { format, startOfDay, addMinutes, isSameDay, differenceInMinutes } from 'date-fns';
import { Info, Move, Clock, Lock, AlertCircle, ChevronDown, GripVertical } from 'lucide-react';
import { Booking, Space } from './BookingCalendar';
import { BookingConfig } from '@/services/booking/bookingConfig';
import BookingBlock from './BookingBlock';
import Button from '@/components/ui/Button';
import { useScrollLock, useContainerScrollLock } from '@/hooks/useScrollLock';
import { useBookingAvailability } from '@/hooks/useBookingAvailability';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

// Lazy load the duration picker
const DurationPicker = lazy(() => import('../panels/DurationPicker'));

interface DayGridProps {
  date: Date;
  bookings: Booking[];
  spaces: Space[];
  config: BookingConfig | null;
  onTimeSlotClick?: (startTime: Date, endTime: Date, spaceId?: string, spaceName?: string) => void;
  onBookingClick?: (booking: Booking) => void;
  onSpaceClick?: (space: Space) => void;
}

const DayGridComponent: React.FC<DayGridProps> = ({
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

  // Enhanced selection state with locked start time
  const [selectionStart, setSelectionStart] = useState<{
    time: Date;
    spaceId: string;
    slotIndex: number;
    locked: boolean; // Start time is locked after initial selection
  } | null>(null);

  const [selectionEnd, setSelectionEnd] = useState<{
    time: Date;
    slotIndex: number;
  } | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false); // New state for resize mode
  const [showDurationPicker, setShowDurationPicker] = useState(false); // Show duration picker modal
  const [hoveredSlot, setHoveredSlot] = useState<{
    slotIndex: number;
    spaceId: string;
  } | null>(null);

  // Track maximum available duration
  const [maxAvailableDuration, setMaxAvailableDuration] = useState<number>(360); // Default 6 hours
  const [nextBookingTime, setNextBookingTime] = useState<Date | null>(null);

  // Touch support state
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Get location ID from first booking or space (assumes all are same location)
  const locationId = useMemo(() => {
    if (bookings.length > 0) return bookings[0].locationId;
    if (spaces.length > 0) return spaces[0].locationId;
    return '';
  }, [bookings, spaces]);

  // Use availability hook for the selected space
  const {
    checkAvailability,
    availability,
    isDurationAvailable
  } = useBookingAvailability({
    locationId,
    spaceId: selectionStart?.spaceId,
    startTime: selectionStart?.time,
    autoCheck: false // We'll check manually when selection starts
  });

  // Scroll locking during selection
  useScrollLock(isDragging || isResizing, { reserveScrollBarGap: true });
  useContainerScrollLock(gridRef, isDragging || isResizing);

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

      // Calculate selection position (24px for both desktop and mobile for consistency)
      const slotHeight = 24;
      const selectionEndY = (selectionEnd?.slotIndex || selectionStart.slotIndex) * slotHeight + 150;
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
    setIsResizing(false);
    setHoveredSlot(null);
    setShowDurationPicker(false);
  };

  // Handle initial time slot selection
  const handleSlotSelection = async (slotIndex: number, spaceId: string) => {
    const slot = timeSlots[slotIndex];
    const space = spaces.find(s => s.id === spaceId);

    // Set and lock the start time
    setSelectionStart({
      time: slot,
      spaceId,
      slotIndex,
      locked: true
    });

    // Default to 1 hour (2 slots)
    setSelectionEnd({
      time: timeSlots[slotIndex + 1] || addMinutes(slot, 30),
      slotIndex: Math.min(slotIndex + 1, timeSlots.length - 1)
    });

    // Check availability for this slot
    if (locationId && spaceId && slot) {
      const availabilityData = await checkAvailability(spaceId, slot);
      if (availabilityData) {
        setMaxAvailableDuration(availabilityData.maxAvailableDuration);
        setNextBookingTime(availabilityData.nextBookingTime);
      }
    }
  };

  // Handle duration adjustment via drag
  const handleDurationResize = (newEndIndex: number) => {
    if (!selectionStart) return;

    // Ensure minimum 1 hour (2 slots)
    const minEndIndex = selectionStart.slotIndex + 1;
    const actualEndIndex = Math.max(minEndIndex, newEndIndex);

    // Check if we can extend to this duration
    const duration = (actualEndIndex - selectionStart.slotIndex + 1) * 30;
    if (duration <= maxAvailableDuration) {
      setSelectionEnd({
        time: timeSlots[actualEndIndex] || addMinutes(timeSlots[actualEndIndex - 1], 30),
        slotIndex: actualEndIndex
      });
    }
  };

  // Confirm and create booking
  const confirmSelection = () => {
    if (!selectionStart || !onTimeSlotClick) return;

    // Show duration picker instead of immediate confirmation
    setShowDurationPicker(true);
  };

  // Handle duration picker confirmation
  const handleDurationConfirm = (duration: number, endTime: Date) => {
    if (!selectionStart || !onTimeSlotClick) return;

    const space = spaces.find(s => s.id === selectionStart.spaceId);
    onTimeSlotClick(selectionStart.time, endTime, selectionStart.spaceId, space?.name);
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

  // Responsive column sizing - optimize for 4 columns on mobile
  const getGridTemplateColumns = () => {
    if (typeof window === 'undefined') return `repeat(${spaces.length}, 1fr)`;

    const width = window.innerWidth;
    const numSpaces = spaces.length;

    if (width < 640) { // Mobile
      // Calculate available width (viewport width - time column - borders)
      const timeColumnWidth = 70; // Time column is 70px on mobile
      const availableWidth = width - timeColumnWidth - 16; // 16px for padding/scrollbar

      // Target 4 columns, range 3-5 with dynamic sizing
      if (numSpaces <= 3) {
        // For 3 or fewer, use all available space
        return `repeat(${numSpaces}, 1fr)`;
      }

      if (numSpaces === 4) {
        // Sweet spot - 4 columns, calculate optimal width
        const minWidth = Math.max(65, Math.floor(availableWidth / 4.5)); // Slightly tighter than even split
        return `repeat(4, minmax(${minWidth}px, 1fr))`;
      }

      if (numSpaces === 5) {
        // 5 columns - bit tighter
        const minWidth = Math.max(55, Math.floor(availableWidth / 5.5));
        return `repeat(5, minmax(${minWidth}px, 1fr))`;
      }

      // For 6+, show scrollable grid with reasonable min width
      const minWidth = Math.max(70, Math.floor(availableWidth / 5));
      return `repeat(${numSpaces}, minmax(${minWidth}px, 1fr))`;
    } else if (width < 1024) { // Tablet
      return `repeat(${numSpaces}, minmax(80px, 1fr))`;
    }
    // Desktop
    return `repeat(${numSpaces}, minmax(100px, 1fr))`;
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const minWidth = isMobile ? '320px' : '800px';

  return (
    <div className="overflow-x-auto border border-[var(--border-primary)] rounded-lg" ref={gridRef}>
      <div style={{ minWidth }}>
        {/* Header with space names - sticky on mobile */}
        <div className={`grid ${isMobile ? 'grid-cols-[70px_1fr]' : 'grid-cols-[80px_1fr]'} bg-[var(--bg-tertiary)] ${isMobile ? 'sticky top-0 z-20' : ''}`}>
          <div className="p-3 border-r border-b border-[var(--border-primary)]">
            {/* Empty corner cell */}
          </div>
          <div className="grid" style={{ gridTemplateColumns: getGridTemplateColumns() }}>
            {spaces.map(space => (
              <button
                key={space.id}
                onClick={() => onSpaceClick?.(space)}
                className={`${isMobile ? 'p-2' : 'p-3'} text-sm font-medium text-[var(--text-primary)] border-r border-b border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-center gap-1`}
              >
                <span className={isMobile ? 'text-xs font-medium' : ''}>
                  {isMobile
                    ? space.name
                        .replace('Dartmouth - ', 'D')
                        .replace('Bedford - ', 'B')
                        .replace('Box ', '')
                        .replace('Simulator ', 'S')
                    : space.name
                  }
                </span>
                {!isMobile && <Info className="h-3 w-3 text-[var(--text-secondary)]" />}
              </button>
            ))}
          </div>
        </div>

        {/* Time slots grid */}
        {timeSlots.map((slot, slotIndex) => (
          <div key={slotIndex} className={`grid ${isMobile ? 'grid-cols-[70px_1fr]' : 'grid-cols-[80px_1fr]'}`}>
            {/* Time label - always with AM/PM */}
            <div className={`px-1 flex items-center justify-center ${isMobile ? 'h-8' : 'h-7'} text-[10px] font-mono text-[var(--text-secondary)] border-r border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] sticky left-0 z-10`}>
              {format(slot, 'h:mm a')}
            </div>

            {/* Space slots - responsive columns */}
            <div className="grid" style={{ gridTemplateColumns: getGridTemplateColumns() }}>
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
                      relative border-r border-b border-[var(--border-primary)] h-6 transition-all duration-150
                      ${isAvailable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}
                      ${isAvailable && !isSelected && !isDragging ? 'hover:bg-[var(--accent)]/[0.04] hover:border-[var(--accent)]/20' : ''}
                      ${isSelected ? 'bg-[var(--accent)]/[0.12] border-[var(--accent)]/40' : ''}
                      ${isSelectionStart ? 'ring-2 ring-[var(--accent)] ring-inset z-20 border-t-2 border-t-[var(--accent)]' : ''}
                      ${isSelectionEnd ? 'ring-2 ring-[var(--accent)] ring-inset z-20 border-b-2 border-b-[var(--accent)]' : ''}
                      ${isDragging && selectionStart?.spaceId === space.id ? 'cursor-ns-resize' : ''}
                      ${isTouchDevice ? 'touch-manipulation min-h-[44px]' : ''}
                    `}
                    style={{
                      touchAction: isDragging ? 'none' : 'auto',
                      userSelect: isDragging ? 'none' : 'auto',
                      WebkitUserSelect: isDragging ? 'none' : 'auto',
                    }}
                    data-slot-index={slotIndex}
                    data-space-id={space.id}
                    data-time={slot.toISOString()}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (!isTouchDevice && isAvailable && !slotBooking) {
                        // Check if clicking on existing selection
                        if (selectionStart && isSelected) {
                          // Check if clicking near bottom edge (resize area)
                          const rect = (e.target as HTMLElement).getBoundingClientRect();
                          const clickY = e.clientY - rect.top;
                          const isBottomEdge = clickY > rect.height * 0.7; // Bottom 30% is resize zone

                          if (isSelectionEnd || isBottomEdge) {
                            // Enter resize mode
                            setIsResizing(true);
                            setIsDragging(false);
                          }
                        } else {
                          // New selection
                          handleSlotSelection(slotIndex, space.id);
                        }
                      }
                    }}
                    onTouchStart={(e) => {
                      if (isAvailable && !slotBooking) {
                        // Prevent default to avoid scrolling and text selection
                        e.preventDefault();
                        e.stopPropagation();

                        const touch = e.touches[0];
                        touchStartRef.current = {
                          x: touch.clientX,
                          y: touch.clientY,
                          time: Date.now()
                        };

                        // Add haptic feedback if available
                        if ('vibrate' in navigator) {
                          navigator.vibrate(10);
                        }

                        setSelectionStart({
                          time: slot,
                          spaceId: space.id,
                          slotIndex: slotIndex,
                          locked: false  // Will be locked after selection completes
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
                      if (!isTouchDevice && isResizing && selectionStart && selectionStart.spaceId === space.id) {
                        // Only allow resizing end time, not start time
                        if (slotIndex >= selectionStart.slotIndex) {
                          handleDurationResize(slotIndex);
                        }
                      }
                      setHoveredSlot({ slotIndex, spaceId: space.id });
                    }}
                    onTouchMove={(e) => {
                      if (isDragging && selectionStart && selectionStart.spaceId === space.id) {
                        // Prevent default to avoid scrolling
                        e.preventDefault();
                        e.stopPropagation();

                        const touch = e.touches[0];
                        const element = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement;

                        if (element && element.dataset.slotIndex) {
                          const targetSlotIndex = parseInt(element.dataset.slotIndex);
                          const targetSpaceId = element.dataset.spaceId;

                          if (targetSpaceId === space.id) {
                            const canExtend = checkCanExtendSelection(targetSlotIndex, space.id);
                            if (canExtend) {
                              // Provide haptic feedback on successful extension
                              if ('vibrate' in navigator &&
                                  selectionEnd?.slotIndex !== targetSlotIndex) {
                                navigator.vibrate(5);
                              }

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
                      if (!isTouchDevice && selectionStart && (isDragging || isResizing)) {
                        setIsDragging(false);
                        setIsResizing(false);
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
                      <div className="absolute inset-0 overflow-hidden">
                        {/* Subtle gradient overlay with animation */}
                        <div className="w-full h-full bg-gradient-to-b from-[var(--accent)]/[0.08] to-[var(--accent)]/[0.12]"></div>
                        {/* Selection border with visual hints */}
                        <div className="absolute inset-0 ring-1 ring-inset ring-[var(--accent)]/30 rounded-sm"></div>

                        {/* Lock icon on start slot */}
                        {isSelectionStart && (
                          <div className="absolute top-0 left-0 p-0.5">
                            <Lock className="w-3 h-3 text-[var(--accent)] opacity-60" />
                          </div>
                        )}

                        {/* Resize handle on end slot */}
                        {isSelectionEnd && (
                          <div className="absolute bottom-0 left-0 right-0 h-2 bg-[var(--accent)]/20 cursor-ns-resize pointer-events-auto
                                      hover:bg-[var(--accent)]/30 transition-colors flex items-center justify-center">
                            <GripVertical className="w-3 h-2 text-[var(--accent)]" />
                          </div>
                        )}

                        {/* Next booking indicator */}
                        {nextBookingTime && isSelectionEnd && (
                          (() => {
                            const minutesUntilNext = differenceInMinutes(nextBookingTime, timeSlots[slotIndex]);
                            if (minutesUntilNext <= 60 && minutesUntilNext > 0) {
                              return (
                                <div className="absolute top-0 right-0 p-0.5">
                                  <AlertCircle className="w-3 h-3 text-amber-500 animate-pulse" />
                                </div>
                              );
                            }
                            return null;
                          })()
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

      {/* Enhanced live time display with locked start indicator */}
      {selectionStart && !isDragging && !isResizing && (
        <div
          className="absolute z-30 pointer-events-none animate-in slide-in-from-bottom-2 fade-in duration-200"
          style={{
            // Position at center of selection
            left: (() => {
              const spaceIndex = spaces.findIndex(s => s.id === selectionStart.spaceId);
              const spaceWidth = gridRef.current ? (gridRef.current.offsetWidth - 80) / spaces.length : 0;
              return `${80 + spaceIndex * spaceWidth + spaceWidth / 2}px`;
            })(),
            top: (() => {
              const startIdx = Math.min(selectionStart.slotIndex, selectionEnd?.slotIndex || selectionStart.slotIndex + 1);
              const endIdx = Math.max(selectionStart.slotIndex, selectionEnd?.slotIndex || selectionStart.slotIndex + 1);
              const centerSlot = startIdx + (endIdx - startIdx) / 2;
              const slotHeight = isMobile ? 32 : 28;
              return `${150 + centerSlot * slotHeight}px`;
            })(),
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="bg-white dark:bg-gray-900 backdrop-blur-md px-4 py-2.5 rounded-lg shadow-lg border-2 border-[var(--accent)] relative">
            {/* Resize indicator */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] text-[var(--accent)] font-medium bg-white dark:bg-gray-900 px-2 py-0.5 rounded-md shadow-sm flex items-center gap-1">
              <GripVertical className="w-3 h-3" />
              <span>Drag bottom edge to adjust</span>
            </div>

            {/* Time display */}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--accent)]" />
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  {format(timeSlots[Math.min(selectionStart.slotIndex, selectionEnd?.slotIndex || selectionStart.slotIndex + 1)], 'h:mm a')}
                  <span className="mx-1 text-[var(--text-muted)]">→</span>
                  {format(addMinutes(timeSlots[Math.max(selectionStart.slotIndex, selectionEnd?.slotIndex || selectionStart.slotIndex + 1)], 30), 'h:mm a')}
                </div>
                <div className="text-xs text-[var(--text-secondary)] font-medium">
                  {selectionDuration || '1 hour minimum'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Professional inline confirmation panel */}
      {selectionStart && !isDragging && (
        <div
          ref={buttonRef}
          className="fixed z-50 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border-2 border-[var(--accent)]/20 max-w-sm animate-in slide-in-from-bottom-3 fade-in duration-200"
          style={buttonPosition}>
          {/* Header with visual indicator */}
          <div className="px-4 py-3 border-b border-[var(--border-primary)] bg-gradient-to-r from-[var(--accent)]/5 to-[var(--accent)]/10 rounded-t-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse"></div>
                Confirm Booking
              </h3>
              <button
                onClick={clearSelection}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Time details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Time</span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {format(timeSlots[selectionStart.slotIndex], 'h:mm a')} -
                  {' '}{format(timeSlots[(selectionEnd?.slotIndex ?? selectionStart.slotIndex + 1) + 1] ||
                               addMinutes(timeSlots[selectionEnd?.slotIndex ?? selectionStart.slotIndex + 1], 30), 'h:mm a')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Duration</span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {selectionDuration || '1 hour'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Simulator</span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {spaces.find(s => s.id === selectionStart.spaceId)?.name}
                </span>
              </div>
            </div>

            {/* Price estimate with visual emphasis */}
            <div className="bg-gradient-to-r from-[var(--accent)]/5 to-[var(--accent)]/10 rounded-lg p-3 border border-[var(--accent)]/20">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Estimated Price</span>
                <span className="text-lg font-bold text-[var(--accent)]">
                  ${(() => {
                    const duration = Math.abs((selectionEnd?.slotIndex ?? selectionStart.slotIndex + 1) - selectionStart.slotIndex + 1) * 30;
                    const hourlyRate = getHourlyRate();
                    return (duration / 60 * hourlyRate).toFixed(2);
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Actions with better styling */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl border-t border-[var(--border-primary)] flex gap-2">
            <Button
              variant="primary"
              onClick={confirmSelection}
              className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-semibold"
            >
              Continue to Booking
            </Button>
            <Button
              variant="ghost"
              onClick={clearSelection}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Duration Picker Modal */}
      {showDurationPicker && selectionStart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn p-4">
          <Suspense fallback={<LoadingSpinner />}>
            <DurationPicker
              locationId={locationId}
              spaceId={selectionStart.spaceId}
              spaceName={spaces.find(s => s.id === selectionStart.spaceId)?.name || 'Simulator'}
              startTime={selectionStart.time}
              initialDuration={selectionDuration ?
                ((selectionEnd?.slotIndex ?? selectionStart.slotIndex + 1) - selectionStart.slotIndex + 1) * 30
                : 60
              }
              onConfirm={handleDurationConfirm}
              onCancel={() => setShowDurationPicker(false)}
              hourlyRate={getHourlyRate()}
              showPricing={true}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
// Only re-render if date, bookings, or spaces change
const DayGrid = memo(DayGridComponent, (prevProps, nextProps) => {
  return (
    prevProps.date.getTime() === nextProps.date.getTime() &&
    prevProps.bookings.length === nextProps.bookings.length &&
    prevProps.spaces.length === nextProps.spaces.length &&
    prevProps.config === nextProps.config
  );
});

export default DayGrid;