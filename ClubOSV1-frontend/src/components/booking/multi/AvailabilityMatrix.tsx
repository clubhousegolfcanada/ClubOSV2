import React, { useState, useRef, useEffect } from 'react';
import { Grid3x3, Clock, Info } from 'lucide-react';
import type { AvailabilityMatrixProps, BookingV2, TimeSlot } from '@/types/booking';

/**
 * Availability Matrix Component
 * Part 5 of Booking System Master Plan
 *
 * Visual grid showing simulator availability across time slots.
 * Supports drag-to-select for booking multiple slots.
 */
export const AvailabilityMatrix: React.FC<AvailabilityMatrixProps> = ({
  locationId,
  date,
  spaces,
  timeSlots,
  onCellClick,
  onDragSelect,
  selectedCells = new Set(),
  bookings = [],
  showLegend = true,
  interactive = true
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<[string, TimeSlot] | null>(null);
  const [dragEnd, setDragEnd] = useState<[string, TimeSlot] | null>(null);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const matrixRef = useRef<HTMLDivElement>(null);

  // Build booking lookup map for performance
  const bookingMap = new Map<string, BookingV2>();
  bookings.forEach(booking => {
    booking.spaceIds.forEach(spaceId => {
      const key = `${spaceId}:${new Date(booking.startAt).toISOString()}`;
      bookingMap.set(key, booking);
    });
  });

  const getCellKey = (spaceId: string, timeSlot: TimeSlot): string => {
    return `${spaceId}:${timeSlot.startTime}`;
  };

  const getCellStatus = (spaceId: string, timeSlot: TimeSlot): string => {
    const key = getCellKey(spaceId, timeSlot);

    // Check if selected
    if (selectedCells.has(key)) return 'selected';

    // Check if booked
    const booking = bookingMap.get(key);
    if (booking) {
      switch (booking.customerTier) {
        case 'new': return 'booked-new';
        case 'member': return 'booked-member';
        case 'promo': return 'booked-promo';
        case 'frequent': return 'booked-frequent';
        default: return 'booked';
      }
    }

    // Check if available
    if (!timeSlot.available) return 'unavailable';

    return 'available';
  };

  const getCellColor = (status: string): string => {
    switch (status) {
      case 'selected': return 'bg-[var(--accent)] text-white';
      case 'booked-new': return 'bg-blue-500 text-white';
      case 'booked-member': return 'bg-yellow-500 text-white';
      case 'booked-promo': return 'bg-green-500 text-white';
      case 'booked-frequent': return 'bg-purple-500 text-white';
      case 'booked': return 'bg-gray-600 text-white';
      case 'unavailable': return 'bg-gray-200 text-gray-400';
      default: return 'bg-white hover:bg-gray-50';
    }
  };

  const handleCellMouseDown = (spaceId: string, timeSlot: TimeSlot) => {
    if (!interactive) return;
    setIsDragging(true);
    setDragStart([spaceId, timeSlot]);
    setDragEnd([spaceId, timeSlot]);
  };

  const handleCellMouseEnter = (spaceId: string, timeSlot: TimeSlot) => {
    setHoveredCell(getCellKey(spaceId, timeSlot));
    if (isDragging && dragStart) {
      setDragEnd([spaceId, timeSlot]);
    }
  };

  const handleCellMouseUp = () => {
    if (isDragging && dragStart && dragEnd && onDragSelect) {
      onDragSelect(dragStart, dragEnd);
    }
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  const handleCellClick = (spaceId: string, timeSlot: TimeSlot) => {
    if (!interactive || isDragging) return;
    onCellClick(spaceId, timeSlot);
  };

  // Handle mouse up outside of matrix
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging) {
        handleCellMouseUp();
      }
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [isDragging]);

  // Check if cell is in drag selection
  const isInDragSelection = (spaceId: string, timeSlot: TimeSlot): boolean => {
    if (!isDragging || !dragStart || !dragEnd) return false;

    const spaceIds = spaces.map(s => s.id);
    const startSpaceIndex = spaceIds.indexOf(dragStart[0]);
    const endSpaceIndex = spaceIds.indexOf(dragEnd[0]);
    const currentSpaceIndex = spaceIds.indexOf(spaceId);

    const startTimeIndex = timeSlots.indexOf(dragStart[1]);
    const endTimeIndex = timeSlots.indexOf(dragEnd[1]);
    const currentTimeIndex = timeSlots.indexOf(timeSlot);

    const minSpaceIndex = Math.min(startSpaceIndex, endSpaceIndex);
    const maxSpaceIndex = Math.max(startSpaceIndex, endSpaceIndex);
    const minTimeIndex = Math.min(startTimeIndex, endTimeIndex);
    const maxTimeIndex = Math.max(startTimeIndex, endTimeIndex);

    return currentSpaceIndex >= minSpaceIndex &&
           currentSpaceIndex <= maxSpaceIndex &&
           currentTimeIndex >= minTimeIndex &&
           currentTimeIndex <= maxTimeIndex;
  };

  // Format time for display
  const formatTime = (timeStr: string): string => {
    const date = new Date(timeStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid3x3 className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold">Availability Matrix</h3>
          <span className="text-sm text-gray-500">
            {date ? new Date(date).toLocaleDateString() : 'Today'}
          </span>
        </div>

        {interactive && (
          <div className="text-sm text-gray-500">
            Click or drag to select
          </div>
        )}
      </div>

      {/* Matrix Grid */}
      <div
        ref={matrixRef}
        className="overflow-x-auto"
        style={{ userSelect: 'none' }}
      >
        <div className="min-w-[800px]">
          {/* Time headers */}
          <div className="flex">
            <div className="w-24 p-2 font-semibold text-sm text-gray-600">
              Simulator
            </div>
            {timeSlots.map((slot, index) => (
              <div
                key={index}
                className="flex-1 min-w-[60px] p-2 text-center text-xs font-medium text-gray-600 border-l"
              >
                {formatTime(slot.startTime)}
              </div>
            ))}
          </div>

          {/* Space rows */}
          {spaces.map((space) => (
            <div key={space.id} className="flex border-t">
              {/* Space label */}
              <div className="w-24 p-3 bg-gray-50 font-medium text-sm">
                <div>#{space.spaceNumber}</div>
                <div className="text-xs text-gray-500">{space.name}</div>
              </div>

              {/* Time cells */}
              {timeSlots.map((slot, index) => {
                const cellKey = getCellKey(space.id, slot);
                const status = getCellStatus(space.id, slot);
                const isSelected = selectedCells.has(cellKey);
                const isDragSelected = isInDragSelection(space.id, slot);
                const isHovered = hoveredCell === cellKey;

                return (
                  <div
                    key={index}
                    className={`
                      flex-1 min-w-[60px] p-2 border-l transition-all
                      ${getCellColor(status)}
                      ${isDragSelected ? 'ring-2 ring-[var(--accent)] ring-inset' : ''}
                      ${isHovered && interactive ? 'shadow-inner' : ''}
                      ${interactive && status === 'available' ? 'cursor-pointer' : ''}
                    `}
                    onMouseDown={() => handleCellMouseDown(space.id, slot)}
                    onMouseEnter={() => handleCellMouseEnter(space.id, slot)}
                    onMouseUp={handleCellMouseUp}
                    onClick={() => handleCellClick(space.id, slot)}
                  >
                    {/* Show booking info if booked */}
                    {status.startsWith('booked') && (
                      <div className="text-xs text-center opacity-90">
                        Booked
                      </div>
                    )}
                    {isSelected && (
                      <div className="text-xs text-center font-semibold">
                        ✓
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="border-t pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-600">Legend</span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-white border rounded"></div>
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-[var(--accent)] rounded"></div>
              <span>Selected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span>New Customer</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span>Member</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>Promo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-purple-500 rounded"></div>
              <span>Frequent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-gray-200 rounded"></div>
              <span>Unavailable</span>
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      {interactive && (
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Click any available cell to select/deselect</p>
          <p>• Click and drag to select multiple cells</p>
          <p>• Colors indicate customer tier for existing bookings</p>
        </div>
      )}
    </div>
  );
};

export default AvailabilityMatrix;