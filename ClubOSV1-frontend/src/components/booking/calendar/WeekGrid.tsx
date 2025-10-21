import React, { useMemo, useState } from 'react';
import { Booking, Space } from './BookingCalendar';
import { BookingConfig } from '@/services/booking/bookingConfig';
import { format, startOfWeek, addDays, isSameDay, isWithinInterval, differenceInMinutes } from 'date-fns';
import BookingBlock from './BookingBlock';
import { Clock } from 'lucide-react';

interface WeekGridProps {
  startDate: Date;
  bookings: Booking[];
  spaces: Space[];
  config: BookingConfig;
  onBookingCreate?: (startTime: Date, endTime: Date, spaceId?: string, spaceName?: string) => void;
  onBookingSelect?: (booking: Booking) => void;
  onSpaceClick?: (space: Space) => void;
}

const WeekGrid: React.FC<WeekGridProps> = ({
  startDate,
  bookings,
  spaces,
  config,
  onBookingCreate,
  onBookingSelect,
  onSpaceClick
}) => {
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ day: number; hour: number } | null>(null);

  // Generate week dates starting from the provided startDate
  const weekDates = useMemo(() => {
    const weekStart = startOfWeek(startDate, { weekStartsOn: 0 }); // Start on Sunday
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [startDate]);

  // Generate time slots for the day (6 AM to 11 PM)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 6; hour < 23; hour++) {
      slots.push({
        hour,
        label: format(new Date().setHours(hour, 0, 0, 0), 'h a')
      });
    }
    return slots;
  }, []);

  // Group bookings by day
  const bookingsByDay = useMemo(() => {
    const grouped = new Map<number, Booking[]>();

    weekDates.forEach((date, dayIndex) => {
      const dayBookings = bookings.filter(booking => {
        const bookingStart = new Date(booking.startAt);
        return isSameDay(bookingStart, date);
      });
      grouped.set(dayIndex, dayBookings);
    });

    return grouped;
  }, [bookings, weekDates]);

  // Calculate booking position and height
  const getBookingStyle = (booking: Booking) => {
    const startTime = new Date(booking.startAt);
    const endTime = new Date(booking.endAt);
    const startHour = startTime.getHours();
    const startMinutes = startTime.getMinutes();
    const duration = differenceInMinutes(endTime, startTime);

    // Calculate position from 6 AM
    const topOffset = ((startHour - 6) * 60 + startMinutes) * (60 / 60); // 60px per hour
    const height = (duration / 60) * 60; // 60px per hour

    return {
      top: `${topOffset}px`,
      height: `${Math.max(height, 30)}px`, // Minimum height of 30px
      position: 'absolute' as const,
      left: '4px',
      right: '4px',
      zIndex: 10
    };
  };

  const handleTimeSlotClick = (dayIndex: number, hour: number) => {
    const date = weekDates[dayIndex];
    const startTime = new Date(date);
    startTime.setHours(hour, 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setHours(hour + 1, 0, 0, 0);

    if (onBookingCreate) {
      // Use the first available space or let the modal handle space selection
      const availableSpace = spaces[0];
      onBookingCreate(startTime, endTime, availableSpace?.id, availableSpace?.name);
    }
  };

  return (
    <div className="week-grid-container">
      {/* Week grid header with days */}
      <div className="grid grid-cols-8 border-b border-[var(--border-primary)]">
        {/* Time column header */}
        <div className="p-2 text-center border-r border-[var(--border-primary)]">
          <Clock className="w-4 h-4 mx-auto text-[var(--text-muted)]" />
        </div>

        {/* Day headers */}
        {weekDates.map((date, index) => {
          const isToday = isSameDay(date, new Date());
          return (
            <div
              key={index}
              className={`p-3 text-center border-r border-[var(--border-primary)] ${
                isToday ? 'bg-[var(--accent)]/10' : ''
              }`}
            >
              <div className="text-xs text-[var(--text-secondary)] uppercase">
                {format(date, 'EEE')}
              </div>
              <div className={`text-lg font-semibold ${
                isToday ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
              }`}>
                {format(date, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time slots and bookings grid */}
      <div className="relative overflow-auto" style={{ maxHeight: '600px' }}>
        <div className="grid grid-cols-8">
          {/* Time labels column */}
          <div className="border-r border-[var(--border-primary)]">
            {timeSlots.map((slot) => (
              <div
                key={slot.hour}
                className="h-[60px] px-2 py-1 text-xs text-[var(--text-secondary)] border-b border-[var(--border-primary)]"
              >
                {slot.label}
              </div>
            ))}
          </div>

          {/* Day columns with time slots */}
          {weekDates.map((date, dayIndex) => {
            const dayBookings = bookingsByDay.get(dayIndex) || [];
            const isToday = isSameDay(date, new Date());

            return (
              <div key={dayIndex} className="relative border-r border-[var(--border-primary)]">
                {/* Time slot cells */}
                {timeSlots.map((slot) => (
                  <div
                    key={`${dayIndex}-${slot.hour}`}
                    className={`h-[60px] border-b border-[var(--border-primary)] cursor-pointer transition-colors ${
                      isToday ? 'bg-[var(--accent)]/5' : 'bg-[var(--bg-primary)]'
                    } hover:bg-[var(--bg-hover)]`}
                    onClick={() => handleTimeSlotClick(dayIndex, slot.hour)}
                  />
                ))}

                {/* Bookings overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  {dayBookings.map((booking) => (
                    <div
                      key={booking.id}
                      style={getBookingStyle(booking)}
                      className="pointer-events-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBookingSelect?.(booking);
                      }}
                    >
                      <div className={`h-full rounded-md p-2 text-xs overflow-hidden cursor-pointer transition-transform hover:scale-[1.02] ${
                        booking.status === 'confirmed'
                          ? 'bg-[var(--status-success)]/20 border-l-4 border-[var(--status-success)]'
                          : booking.status === 'pending'
                          ? 'bg-[var(--status-warning)]/20 border-l-4 border-[var(--status-warning)]'
                          : 'bg-[var(--status-error)]/20 border-l-4 border-[var(--status-error)]'
                      }`}>
                        <div className="font-semibold text-[var(--text-primary)] truncate">
                          {booking.customerName || 'Guest'}
                        </div>
                        <div className="text-[var(--text-secondary)] truncate">
                          {format(new Date(booking.startAt), 'h:mm a')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 p-3 bg-[var(--bg-secondary)] rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[var(--status-success)]/20 border-l-4 border-[var(--status-success)]" />
          <span className="text-xs text-[var(--text-secondary)]">Confirmed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[var(--status-warning)]/20 border-l-4 border-[var(--status-warning)]" />
          <span className="text-xs text-[var(--text-secondary)]">Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[var(--status-error)]/20 border-l-4 border-[var(--status-error)]" />
          <span className="text-xs text-[var(--text-secondary)]">Cancelled</span>
        </div>
        <div className="ml-auto text-xs text-[var(--text-muted)]">
          Click any time slot to create a booking
        </div>
      </div>
    </div>
  );
};

export default WeekGrid;