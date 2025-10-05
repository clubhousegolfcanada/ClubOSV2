import React, { useMemo } from 'react';
import { format, startOfDay, addMinutes, isSameDay } from 'date-fns';
import { Booking, Space } from './BookingCalendar';
import { BookingConfig } from '@/services/booking/bookingConfig';
import BookingBlock from './BookingBlock';

interface DayGridProps {
  date: Date;
  bookings: Booking[];
  spaces: Space[];
  config: BookingConfig;
  onBookingCreate?: (startTime: Date, endTime: Date, spaceId?: string) => void;
  onBookingSelect?: (booking: Booking) => void;
}

const DayGrid: React.FC<DayGridProps> = ({
  date,
  bookings,
  spaces,
  config,
  onBookingCreate,
  onBookingSelect
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
      <div className="text-center py-8 text-gray-500">
        <p>No spaces available for this location.</p>
        <p className="text-sm mt-2">Please select a specific location to view availability.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header with space names */}
        <div className="grid grid-cols-[100px_1fr] gap-2 mb-2">
          <div className="text-xs font-medium text-gray-600 text-right pr-2 pt-2">
            Time / Space
          </div>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${spaces.length}, 1fr)` }}>
            {spaces.map(space => (
              <div
                key={space.id}
                className="text-sm font-medium text-gray-900 text-center pb-2 border-b border-gray-200"
              >
                {space.name}
              </div>
            ))}
          </div>
        </div>

        {/* Time slots grid */}
        <div className="space-y-0">
          {timeSlots.map((slot, slotIndex) => (
            <div key={slotIndex} className="grid grid-cols-[100px_1fr] gap-2 hover:bg-gray-50">
              {/* Time label */}
              <div className="text-xs text-gray-600 text-right pr-2 py-2 border-r border-gray-100">
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
                      className={`relative border-l border-b border-gray-100 min-h-[40px] ${
                        isAvailable
                          ? 'cursor-pointer hover:bg-blue-50'
                          : ''
                      }`}
                      onClick={() => {
                        if (isAvailable && onBookingCreate) {
                          const endTime = addMinutes(slot, config.minDuration || 60);
                          onBookingCreate(slot, endTime, space.id);
                        }
                      }}
                    >
                      {slotBooking && (
                        <BookingBlock
                          booking={slotBooking}
                          onClick={() => onBookingSelect?.(slotBooking)}
                          config={config}
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
    </div>
  );
};

export default DayGrid;