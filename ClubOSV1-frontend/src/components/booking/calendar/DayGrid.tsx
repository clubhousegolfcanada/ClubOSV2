import React, { useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { Clock, Users, Lock } from 'lucide-react';
import { Booking, TimeSlot } from './BookingCalendar';
import BookingBlock from './BookingBlock';

interface DayGridProps {
  date: Date;
  timeSlots: TimeSlot[];
  bookings: Booking[];
  onDragStart?: (time: Date) => void;
  onDragMove?: (time: Date) => void;
  onDragEnd?: () => void;
  dragStart?: Date | null;
  dragEnd?: Date | null;
  isDragging?: boolean;
  onBookingSelect?: (booking: Booking) => void;
}

const DayGrid: React.FC<DayGridProps> = ({
  date,
  timeSlots,
  bookings,
  onDragStart,
  onDragMove,
  onDragEnd,
  dragStart,
  dragEnd,
  isDragging = false,
  onBookingSelect
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Time labels for the left column
  const timeLabels = [];
  for (let hour = 6; hour < 22; hour++) {
    timeLabels.push(format(new Date().setHours(hour, 0, 0, 0), 'h a'));
  }

  // Handle mouse events for drag selection
  const handleMouseDown = (e: React.MouseEvent, slot: TimeSlot) => {
    e.preventDefault();
    isDraggingRef.current = true;
    if (onDragStart) {
      onDragStart(slot.start);
    }
  };

  const handleMouseMove = (e: React.MouseEvent, slot: TimeSlot) => {
    if (isDraggingRef.current && onDragMove) {
      onDragMove(slot.end);
    }
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current && onDragEnd) {
      onDragEnd();
    }
    isDraggingRef.current = false;
  };

  // Global mouse up handler
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current && onDragEnd) {
        onDragEnd();
      }
      isDraggingRef.current = false;
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [onDragEnd]);

  // Check if a slot is within drag selection
  const isSlotSelected = (slot: TimeSlot) => {
    if (!dragStart || !dragEnd || !isDragging) return false;

    const start = dragStart < dragEnd ? dragStart : dragEnd;
    const end = dragStart < dragEnd ? dragEnd : dragStart;

    return slot.start >= start && slot.end <= end;
  };

  // Calculate booking position and height
  const getBookingStyle = (booking: Booking) => {
    const startTime = new Date(booking.startAt);
    const endTime = new Date(booking.endAt);

    const startHour = startTime.getHours() + startTime.getMinutes() / 60;
    const endHour = endTime.getHours() + endTime.getMinutes() / 60;

    const top = ((startHour - 6) / 16) * 100;
    const height = ((endHour - startHour) / 16) * 100;

    return {
      top: `${top}%`,
      height: `${height}%`,
      left: '0',
      right: '0'
    };
  };

  return (
    <div className="flex h-full" ref={gridRef}>
      {/* Time labels column */}
      <div className="w-20 flex-shrink-0 border-r border-[var(--border)]">
        <div className="sticky top-0 bg-[var(--bg-secondary)] h-8 border-b border-[var(--border)]"></div>
        {timeLabels.map((label, index) => (
          <div
            key={index}
            className="h-[60px] border-b border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)] text-right"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 relative">
        <div className="sticky top-0 bg-[var(--bg-secondary)] h-8 border-b border-[var(--border)] px-3 flex items-center">
          <span className="text-sm font-medium">
            {format(date, 'EEEE, MMM d')}
          </span>
        </div>

        {/* Time slots */}
        <div className="relative">
          {timeSlots.map((slot, index) => {
            const isSelected = isSlotSelected(slot);
            const hasBooking = slot.bookings.length > 0;

            return (
              <div
                key={index}
                className={`
                  h-[30px] border-b border-[var(--border)] cursor-pointer transition-all
                  ${hasBooking ? 'cursor-not-allowed' : 'hover:bg-[var(--bg-tertiary)]'}
                  ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''}
                `}
                onMouseDown={(e) => !hasBooking && handleMouseDown(e, slot)}
                onMouseMove={(e) => !hasBooking && handleMouseMove(e, slot)}
                onMouseUp={handleMouseUp}
                title={format(slot.start, 'h:mm a')}
              >
                {/* Hour marker for full hours */}
                {slot.start.getMinutes() === 0 && (
                  <div className="absolute left-0 right-0 top-0 border-t border-[var(--border)]"></div>
                )}
              </div>
            );
          })}

          {/* Bookings overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {bookings.map(booking => (
              <div
                key={booking.id}
                className="absolute px-2 pointer-events-auto"
                style={getBookingStyle(booking)}
              >
                <BookingBlock
                  booking={booking}
                  onClick={() => onBookingSelect?.(booking)}
                />
              </div>
            ))}
          </div>

          {/* Drag selection overlay */}
          {isDragging && dragStart && dragEnd && (
            <div
              className="absolute bg-blue-500/20 border-2 border-blue-500 rounded-lg pointer-events-none z-10"
              style={{
                top: `${((Math.min(dragStart.getHours() + dragStart.getMinutes() / 60,
                  dragEnd.getHours() + dragEnd.getMinutes() / 60) - 6) / 16) * 100}%`,
                height: `${(Math.abs(
                  (dragEnd.getHours() + dragEnd.getMinutes() / 60) -
                  (dragStart.getHours() + dragStart.getMinutes() / 60)
                ) / 16) * 100}%`,
                left: '2%',
                right: '2%'
              }}
            >
              <div className="flex items-center justify-center h-full">
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {format(dragStart < dragEnd ? dragStart : dragEnd, 'h:mm a')} -
                  {format(dragStart < dragEnd ? dragEnd : dragStart, 'h:mm a')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DayGrid;