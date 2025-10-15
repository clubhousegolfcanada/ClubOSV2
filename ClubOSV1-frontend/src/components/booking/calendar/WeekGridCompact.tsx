import React, { useMemo } from 'react';
import { format, startOfDay, addDays, addMinutes, isSameDay, isToday } from 'date-fns';
import { Booking, Space } from './BookingCalendarCompact';
import { BookingConfig } from '@/services/booking/bookingConfig';

interface WeekGridCompactProps {
  startDate: Date;
  bookings: Booking[];
  spaces: Space[];
  config: BookingConfig;
  onBookingCreate?: (startTime: Date, endTime: Date, spaceId?: string, spaceName?: string) => void;
  onBookingSelect?: (booking: Booking) => void;
  onSpaceClick?: (space: Space) => void;
}

const WeekGridCompact: React.FC<WeekGridCompactProps> = ({
  startDate,
  bookings,
  spaces,
  config,
  onBookingCreate,
  onBookingSelect,
  onSpaceClick
}) => {
  // Generate week days
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(startDate, i));
    }
    return days;
  }, [startDate]);

  // Generate time slots for display (6 AM to 11 PM)
  const timeSlots = useMemo(() => {
    const slots: Date[] = [];
    const dayStart = startOfDay(new Date());
    const startTime = addMinutes(dayStart, 6 * 60); // 6 AM
    const endTime = addMinutes(dayStart, 23 * 60); // 11 PM

    let current = startTime;
    while (current <= endTime) {
      slots.push(new Date(current));
      current = addMinutes(current, config.gridInterval || 30);
    }
    return slots;
  }, [config.gridInterval]);

  // Group bookings by day and space
  const bookingsByDayAndSpace = useMemo(() => {
    const grouped: Record<string, Record<string, Booking[]>> = {};

    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      grouped[dayKey] = {};

      spaces.forEach(space => {
        grouped[dayKey][space.id] = bookings.filter(booking =>
          isSameDay(new Date(booking.startAt), day) &&
          booking.spaceIds.includes(space.id)
        );
      });
    });

    return grouped;
  }, [bookings, spaces, weekDays]);

  // Check if a time slot is available
  const isSlotAvailable = (day: Date, slot: Date, spaceId: string): boolean => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const slotTime = new Date(day);
    slotTime.setHours(slot.getHours(), slot.getMinutes(), 0, 0);
    const slotEnd = addMinutes(slotTime, config.gridInterval || 30);

    const spaceBookings = bookingsByDayAndSpace[dayKey]?.[spaceId] || [];

    return !spaceBookings.some(booking => {
      const bookingStart = new Date(booking.startAt);
      const bookingEnd = new Date(booking.endAt);
      return (
        (slotTime >= bookingStart && slotTime < bookingEnd) ||
        (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
        (slotTime <= bookingStart && slotEnd >= bookingEnd)
      );
    });
  };

  // Get booking for a specific slot
  const getSlotBooking = (day: Date, slot: Date, spaceId: string): Booking | undefined => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const slotTime = new Date(day);
    slotTime.setHours(slot.getHours(), slot.getMinutes(), 0, 0);

    return bookingsByDayAndSpace[dayKey]?.[spaceId]?.find(booking => {
      const bookingStart = new Date(booking.startAt);
      return bookingStart.getTime() === slotTime.getTime();
    });
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
      <div style={{ minWidth: `${100 + (spaces.length * 7 * 80)}px` }}>
        {/* Compact Header with Days and Spaces */}
        <div className="grid" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
          {/* Corner cell */}
          <div className="border-r border-b border-[var(--border-primary)] bg-[var(--bg-tertiary)]" />

          {/* Day headers */}
          {weekDays.map(day => (
            <div
              key={format(day, 'yyyy-MM-dd')}
              className={`border-r border-b border-[var(--border-primary)] bg-[var(--bg-tertiary)] ${
                isToday(day) ? 'bg-[var(--accent-light)]' : ''
              }`}
            >
              <div className="text-center py-1">
                <div className="text-[10px] font-medium text-[var(--text-primary)]">
                  {format(day, 'EEE')}
                </div>
                <div className={`text-xs font-bold ${
                  isToday(day) ? 'text-[var(--color-primary)]' : 'text-[var(--text-primary)]'
                }`}>
                  {format(day, 'd')}
                </div>
              </div>

              {/* Space names under each day */}
              <div className="grid" style={{ gridTemplateColumns: `repeat(${spaces.length}, 1fr)` }}>
                {spaces.map(space => (
                  <button
                    key={`${format(day, 'yyyy-MM-dd')}-${space.id}`}
                    onClick={() => onSpaceClick?.(space)}
                    className="px-1 py-0.5 text-[9px] font-medium text-[var(--text-secondary)] border-r border-t border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors truncate"
                    style={{ height: '20px' }}
                    title={space.name}
                  >
                    {space.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Time slots grid with ultra-compact rows (30px) */}
        {timeSlots.map((slot, slotIndex) => (
          <div
            key={slotIndex}
            className="grid"
            style={{ gridTemplateColumns: '60px repeat(7, 1fr)', height: '30px' }}
          >
            {/* Time label (ultra-compact) */}
            <div className="px-1 flex items-center justify-center text-[9px] text-[var(--text-secondary)] border-r border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
              {format(slot, 'h:mm a')}
            </div>

            {/* Day columns */}
            {weekDays.map(day => {
              const dayKey = format(day, 'yyyy-MM-dd');

              return (
                <div
                  key={dayKey}
                  className="grid border-r border-b border-[var(--border-primary)]"
                  style={{ gridTemplateColumns: `repeat(${spaces.length}, 1fr)` }}
                >
                  {spaces.map(space => {
                    const booking = getSlotBooking(day, slot, space.id);
                    const isAvailable = isSlotAvailable(day, slot, space.id);
                    const slotTime = new Date(day);
                    slotTime.setHours(slot.getHours(), slot.getMinutes(), 0, 0);

                    return (
                      <div
                        key={`${dayKey}-${space.id}-${slotIndex}`}
                        className={`relative border-r last:border-r-0 transition-colors ${
                          isAvailable && !booking
                            ? 'cursor-pointer hover:bg-[var(--bg-hover)]'
                            : ''
                        } ${isToday(day) ? 'bg-[var(--accent-light)]/5' : ''}`}
                        style={{ height: '30px' }}
                        onClick={() => {
                          if (isAvailable && !booking && onBookingCreate) {
                            const endTime = addMinutes(slotTime, config.minDuration || 60);
                            onBookingCreate(slotTime, endTime, space.id, space.name);
                          }
                        }}
                      >
                        {booking && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              onBookingSelect?.(booking);
                            }}
                            className="absolute inset-0 m-0.5 rounded-sm cursor-pointer overflow-hidden flex items-center justify-center"
                            style={{
                              backgroundColor: booking.tierColor || 'var(--accent)',
                              opacity: booking.isAdminBlock ? 0.6 : 0.8
                            }}
                          >
                            {/* Ultra-compact booking display */}
                            <div className="text-[8px] font-medium text-white text-center px-0.5">
                              {booking.isAdminBlock ? '🚫' : (
                                booking.customerName ?
                                  booking.customerName.split(' ')[0].substring(0, 6) :
                                  'Booking'
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}

        {/* Week summary footer (optional - 20px height) */}
        <div
          className="grid border-t-2 border-[var(--border-primary)] bg-[var(--bg-tertiary)]"
          style={{ gridTemplateColumns: '60px repeat(7, 1fr)', height: '20px' }}
        >
          <div className="flex items-center justify-center text-[9px] font-medium text-[var(--text-secondary)] border-r border-[var(--border-primary)]">
            Total
          </div>
          {weekDays.map(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayBookings = bookings.filter(b =>
              isSameDay(new Date(b.startAt), day) && !b.isAdminBlock
            ).length;

            return (
              <div
                key={`summary-${dayKey}`}
                className="flex items-center justify-center text-[9px] font-medium border-r border-[var(--border-primary)]"
                style={{
                  color: dayBookings > 0 ? 'var(--status-success)' : 'var(--text-muted)'
                }}
              >
                {dayBookings > 0 ? `${dayBookings} bookings` : '-'}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeekGridCompact;