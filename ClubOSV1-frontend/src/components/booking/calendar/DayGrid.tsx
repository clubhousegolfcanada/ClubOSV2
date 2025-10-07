import React, { useMemo } from 'react';
import { format, startOfDay, addMinutes, isSameDay } from 'date-fns';
import { Info } from 'lucide-react';
import { Booking, Space } from './BookingCalendar';
import { BookingConfig } from '@/services/booking/bookingConfig';
import BookingBlock from './BookingBlock';

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

                return (
                  <div
                    key={`${space.id}-${slotIndex}`}
                    className={`relative border-r border-b border-[var(--border-primary)] min-h-[41px] transition-colors ${
                      isAvailable
                        ? 'cursor-pointer hover:bg-[var(--bg-hover)]'
                        : ''
                    }`}
                    onClick={() => {
                      if (isAvailable && onBookingCreate) {
                        const endTime = addMinutes(slot, config.minDuration || 60);
                        onBookingCreate(slot, endTime, space.id, space.name);
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
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DayGrid;