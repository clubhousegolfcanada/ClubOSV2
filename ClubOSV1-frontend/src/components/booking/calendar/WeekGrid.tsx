import React from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { Booking } from './BookingCalendar';
import BookingBlock from './BookingBlock';

interface WeekGridProps {
  startDate: Date;
  bookings: Booking[];
  onBookingSelect?: (booking: Booking) => void;
  onTimeSelect?: (time: Date) => void;
}

const WeekGrid: React.FC<WeekGridProps> = ({
  startDate,
  bookings,
  onBookingSelect,
  onTimeSelect
}) => {
  // Generate 7 days starting from startDate
  const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));

  // Time slots from 6 AM to 10 PM
  const timeSlots = Array.from({ length: 32 }, (_, i) => {
    const hour = Math.floor(i / 2) + 6;
    const minute = (i % 2) * 30;
    return { hour, minute, label: format(new Date().setHours(hour, minute, 0, 0), 'h:mm a') };
  });

  // Get bookings for a specific day and time slot
  const getBookingsForSlot = (day: Date, hour: number, minute: number) => {
    return bookings.filter(booking => {
      const bookingStart = new Date(booking.startAt);
      const bookingEnd = new Date(booking.endAt);

      // Check if booking is on this day
      if (!isSameDay(bookingStart, day)) return false;

      // Check if booking overlaps with this time slot
      const slotStart = new Date(day);
      slotStart.setHours(hour, minute, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + 30);

      return bookingStart < slotEnd && bookingEnd > slotStart;
    });
  };

  // Calculate booking position within a cell
  const getBookingPosition = (booking: Booking, slotIndex: number) => {
    const bookingStart = new Date(booking.startAt);
    const bookingEnd = new Date(booking.endAt);

    const slotHour = Math.floor(slotIndex / 2) + 6;
    const slotMinute = (slotIndex % 2) * 30;

    const slotStart = new Date(bookingStart);
    slotStart.setHours(slotHour, slotMinute, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotEnd.getMinutes() + 30);

    // Calculate how much of this slot the booking covers
    const overlapStart = Math.max(bookingStart.getTime(), slotStart.getTime());
    const overlapEnd = Math.min(bookingEnd.getTime(), slotEnd.getTime());
    const overlapDuration = overlapEnd - overlapStart;
    const slotDuration = 30 * 60 * 1000; // 30 minutes in ms

    const coverage = overlapDuration / slotDuration;

    // Return position style
    return {
      height: `${coverage * 100}%`,
      top: bookingStart > slotStart ? `${((bookingStart.getTime() - slotStart.getTime()) / slotDuration) * 100}%` : '0'
    };
  };

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-[var(--bg-secondary)]">
          <tr>
            <th className="w-20 text-xs font-medium text-[var(--text-secondary)] p-2 border-b border-r border-[var(--border)]">
              Time
            </th>
            {days.map((day, index) => (
              <th
                key={index}
                className="text-sm font-medium p-2 border-b border-r border-[var(--border)]"
              >
                <div>{format(day, 'EEE')}</div>
                <div className="text-lg">{format(day, 'd')}</div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {format(day, 'MMM')}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((slot, slotIndex) => (
            <tr key={slotIndex}>
              <td className="text-xs text-[var(--text-secondary)] text-right p-1 border-b border-r border-[var(--border)]">
                {slot.minute === 0 ? slot.label : ''}
              </td>
              {days.map((day, dayIndex) => {
                const slotBookings = getBookingsForSlot(day, slot.hour, slot.minute);
                const isHourBoundary = slot.minute === 0;

                return (
                  <td
                    key={dayIndex}
                    className={`
                      relative p-0 border-r border-[var(--border)]
                      ${isHourBoundary ? 'border-t' : 'border-b'}
                      ${slotBookings.length === 0 ? 'hover:bg-[var(--bg-tertiary)] cursor-pointer' : ''}
                    `}
                    onClick={() => {
                      if (slotBookings.length === 0 && onTimeSelect) {
                        const selectedTime = new Date(day);
                        selectedTime.setHours(slot.hour, slot.minute, 0, 0);
                        onTimeSelect(selectedTime);
                      }
                    }}
                    style={{ height: '30px' }}
                  >
                    {/* Render bookings */}
                    {slotBookings.map(booking => {
                      const isFirstSlot = slotIndex === 0 ||
                        !getBookingsForSlot(day, timeSlots[slotIndex - 1].hour, timeSlots[slotIndex - 1].minute)
                          .some(b => b.id === booking.id);

                      if (!isFirstSlot) return null;

                      // Calculate how many slots this booking spans
                      const bookingStart = new Date(booking.startAt);
                      const bookingEnd = new Date(booking.endAt);
                      const startSlotIndex = Math.max(0,
                        (bookingStart.getHours() - 6) * 2 + Math.floor(bookingStart.getMinutes() / 30)
                      );
                      const endSlotIndex = Math.min(timeSlots.length - 1,
                        (bookingEnd.getHours() - 6) * 2 + Math.ceil(bookingEnd.getMinutes() / 30)
                      );
                      const spanCount = endSlotIndex - startSlotIndex;

                      return (
                        <div
                          key={booking.id}
                          className="absolute inset-x-0 z-5 px-1"
                          style={{
                            top: '0',
                            height: `${spanCount * 30}px`
                          }}
                        >
                          <BookingBlock
                            booking={booking}
                            onClick={() => onBookingSelect?.(booking)}
                            showDetails={spanCount > 2}
                          />
                        </div>
                      );
                    })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default WeekGrid;