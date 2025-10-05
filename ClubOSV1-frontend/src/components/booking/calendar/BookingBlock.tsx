import React from 'react';
import { format } from 'date-fns';
import { Clock, Users, Lock, AlertCircle, DollarSign } from 'lucide-react';
import { Booking } from './BookingCalendar';

interface BookingBlockProps {
  booking: Booking;
  onClick?: () => void;
  showDetails?: boolean;
  className?: string;
}

const BookingBlock: React.FC<BookingBlockProps> = ({
  booking,
  onClick,
  showDetails = true,
  className = ''
}) => {
  const startTime = new Date(booking.startAt);
  const endTime = new Date(booking.endAt);

  // Determine block styling based on booking type and status
  const getBlockStyle = () => {
    // Admin blocks (maintenance, cleaning)
    if (booking.isAdminBlock) {
      return {
        backgroundColor: '#6B7280',
        borderColor: '#4B5563',
        textColor: 'text-white'
      };
    }

    // Cancelled bookings
    if (booking.status === 'cancelled') {
      return {
        backgroundColor: '#FEE2E2',
        borderColor: '#FCA5A5',
        textColor: 'text-red-900',
        opacity: '0.6'
      };
    }

    // Color based on customer tier
    return {
      backgroundColor: `${booking.tierColor}20`,
      borderColor: booking.tierColor,
      textColor: 'text-gray-900 dark:text-white'
    };
  };

  const style = getBlockStyle();

  return (
    <div
      className={`
        rounded-lg border-2 p-2 h-full cursor-pointer transition-all
        hover:shadow-lg hover:scale-[1.02] ${style.textColor} ${className}
      `}
      style={{
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        opacity: style.opacity || 1
      }}
      onClick={onClick}
    >
      {/* Time header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1 text-xs font-medium">
          <Clock className="w-3 h-3" />
          <span>
            {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
          </span>
        </div>

        {/* Duration badge */}
        <span
          className="text-xs px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: booking.tierColor,
            color: 'white'
          }}
        >
          {booking.durationMinutes}m
        </span>
      </div>

      {showDetails && (
        <>
          {/* Admin block reason */}
          {booking.isAdminBlock ? (
            <div className="flex items-center gap-1 mt-1">
              <Lock className="w-3 h-3" />
              <span className="text-xs font-medium">
                {booking.blockReason || 'Blocked'}
              </span>
            </div>
          ) : (
            <>
              {/* Customer name or email */}
              <div className="text-sm font-semibold truncate">
                {booking.userName || booking.userEmail?.split('@')[0] || 'Guest'}
              </div>

              {/* Tier and location */}
              <div className="flex items-center justify-between mt-1">
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: `${booking.tierColor}40`,
                    color: booking.tierColor
                  }}
                >
                  {booking.tierName}
                </span>

                {/* Price if available */}
                {booking.totalAmount && (
                  <div className="flex items-center gap-0.5 text-xs">
                    <DollarSign className="w-3 h-3" />
                    <span>{booking.totalAmount.toFixed(0)}</span>
                  </div>
                )}
              </div>

              {/* Space names */}
              {booking.spaces && booking.spaces.length > 0 && (
                <div className="flex items-center gap-1 mt-1 text-xs text-[var(--text-secondary)]">
                  <Users className="w-3 h-3" />
                  <span className="truncate">
                    {booking.spaces.map(s => s.name).join(', ')}
                  </span>
                </div>
              )}

              {/* Status badges */}
              {booking.status === 'pending' && (
                <div className="flex items-center gap-1 mt-1 text-xs text-yellow-600">
                  <AlertCircle className="w-3 h-3" />
                  <span>Pending</span>
                </div>
              )}

              {/* Admin notes indicator */}
              {booking.adminNotes && (
                <div className="mt-1 text-xs text-[var(--text-secondary)] italic truncate">
                  Note: {booking.adminNotes}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Minimal view (just show colored bar with time) */}
      {!showDetails && !booking.isAdminBlock && (
        <div className="h-full flex items-center justify-center">
          <div
            className="w-1 h-full rounded-full mr-2"
            style={{ backgroundColor: booking.tierColor }}
          />
          <span className="text-xs font-medium truncate">
            {booking.userName || 'Booking'}
          </span>
        </div>
      )}
    </div>
  );
};

export default BookingBlock;