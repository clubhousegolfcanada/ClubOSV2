import React, { useMemo } from 'react';
import { format, startOfDay, addMinutes, isSameDay } from 'date-fns';
import { Info } from 'lucide-react';
import { Booking, Space } from './BookingCalendarCompact';
import { BookingConfig } from '@/services/booking/bookingConfig';

interface DayGridCompactProps {
  date: Date;
  bookings: Booking[];
  spaces: Space[];
  config: BookingConfig;
  onBookingCreate?: (startTime: Date, endTime: Date, spaceId?: string, spaceName?: string) => void;
  onBookingSelect?: (booking: Booking) => void;
  onSpaceClick?: (space: Space) => void;
}

const DayGridCompact: React.FC<DayGridCompactProps> = ({
  date,
  bookings,
  spaces,
  config,
  onBookingCreate,
  onBookingSelect,
  onSpaceClick
}) => {
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

  // Get booking for a specific slot and space
  const getSlotBooking = (slot: Date, spaceId: string): Booking | undefined => {
    return dayBookings.find(booking => {
      const bookingStart = new Date(booking.startAt);
      return (
        booking.spaceIds.includes(spaceId) &&
        bookingStart.getTime() === slot.getTime()
      );
    });
  };

  // Calculate booking span (how many slots it covers)
  const getBookingSpan = (booking: Booking): number => {
    const start = new Date(booking.startAt);
    const end = new Date(booking.endAt);
    const durationMinutes = (end.getTime() - start.getTime()) / 60000;
    return Math.ceil(durationMinutes / (config.gridInterval || 30));
  };

  if (spaces.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)]">
        <p>Loading simulator boxes...</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-[var(--border-primary)] rounded-lg">
      <div className="min-w-[600px]">
        {/* Compact Header (25px height) */}
        <div className="grid grid-cols-[60px_1fr] bg-[var(--bg-tertiary)]">
          <div className="border-r border-b border-[var(--border-primary)]">
            {/* Empty corner cell */}
          </div>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${spaces.length}, 1fr)` }}>
            {spaces.map(space => (
              <button
                key={space.id}
                onClick={() => onSpaceClick?.(space)}
                className="px-2 py-1 text-xs font-medium text-[var(--text-primary)] border-r border-b border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-center gap-1 touch-manipulation"
                style={{ minHeight: '44px' }}
              >
                <span className="truncate">{space.name}</span>
                <Info className="h-2.5 w-2.5 text-[var(--text-secondary)] flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Time slots grid with 38px row height */}
        {timeSlots.map((slot, slotIndex) => {
          // Track which spaces have bookings starting at this slot
          const bookingsAtSlot: Record<string, Booking | undefined> = {};
          const shouldRenderSlot: Record<string, boolean> = {};

          spaces.forEach(space => {
            const booking = getSlotBooking(slot, space.id);
            bookingsAtSlot[space.id] = booking;

            // Check if we should render this slot (not covered by a multi-slot booking)
            const previousSlots = timeSlots.slice(0, slotIndex);
            const isCoveredByPreviousBooking = previousSlots.some((prevSlot, prevIndex) => {
              const prevBooking = getSlotBooking(prevSlot, space.id);
              if (!prevBooking) return false;
              const span = getBookingSpan(prevBooking);
              return slotIndex < prevIndex + span;
            });

            shouldRenderSlot[space.id] = !isCoveredByPreviousBooking;
          });

          return (
            <div key={slotIndex} className="grid grid-cols-[60px_1fr]" style={{ minHeight: '44px' }}>
              {/* Time label (compact) */}
              <div className="px-1 flex items-center justify-center text-[10px] text-[var(--text-secondary)] border-r border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                {format(slot, 'h:mm a')}
              </div>

              {/* Space slots (38px height) */}
              <div className="grid" style={{ gridTemplateColumns: `repeat(${spaces.length}, 1fr)` }}>
                {spaces.map(space => {
                  const booking = bookingsAtSlot[space.id];
                  const isAvailable = isSlotAvailable(slot, space.id);
                  const shouldRender = shouldRenderSlot[space.id];

                  if (!shouldRender) {
                    return null; // Skip rendering if covered by a multi-slot booking
                  }

                  const rowSpan = booking ? getBookingSpan(booking) : 1;

                  return (
                    <div
                      key={`${space.id}-${slotIndex}`}
                      className={`relative border-r border-b border-[var(--border-primary)] transition-colors ${
                        isAvailable && !booking
                          ? 'cursor-pointer hover:bg-[var(--bg-hover)]'
                          : ''
                      }`}
                      style={{
                        gridRow: `span ${rowSpan}`,
                        minHeight: `${44 * rowSpan}px`
                      }}
                      onClick={() => {
                        if (isAvailable && !booking && onBookingCreate) {
                          const endTime = addMinutes(slot, config.minDuration || 60);
                          onBookingCreate(slot, endTime, space.id, space.name);
                        }
                      }}
                    >
                      {booking && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onBookingSelect?.(booking);
                          }}
                          className="absolute inset-0 m-0.5 rounded cursor-pointer overflow-hidden"
                          style={{
                            backgroundColor: booking.tierColor || 'var(--accent)',
                            opacity: booking.isAdminBlock ? 0.7 : 0.9
                          }}
                        >
                          <div className="p-1 h-full flex flex-col justify-between">
                            {/* Top: Customer name or block reason */}
                            <div className="text-[10px] font-medium text-white truncate">
                              {booking.isAdminBlock ? 'BLOCKED' : booking.customerName || 'Guest'}
                            </div>

                            {/* Bottom: Time range (only if booking spans multiple slots) */}
                            {rowSpan > 1 && (
                              <div className="text-[9px] text-white/80 truncate">
                                {format(new Date(booking.startAt), 'h:mm')} - {format(new Date(booking.endAt), 'h:mm a')}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DayGridCompact;