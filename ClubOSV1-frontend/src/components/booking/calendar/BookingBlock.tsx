import React from 'react';
import { format } from 'date-fns';
import { Clock, User, AlertTriangle } from 'lucide-react';
import { Booking } from './BookingCalendar';
import { BookingConfig, BookingConfigService } from '@/services/booking/bookingConfig';

interface BookingBlockProps {
  booking: Booking;
  onClick?: () => void;
  config: BookingConfig | null;
  compact?: boolean;
}

const BookingBlock: React.FC<BookingBlockProps> = ({
  booking,
  onClick,
  config,
  compact = false
}) => {
  const startTime = new Date(booking.startAt);
  const endTime = new Date(booking.endAt);
  const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
  const durationBlocks = Math.ceil(durationMinutes / (config?.gridInterval || 30));

  // Determine block styles based on booking type
  const getBlockStyles = () => {
    if (booking.isAdminBlock) {
      return {
        backgroundColor: 'var(--text-muted)', // Muted for admin blocks
        borderColor: 'var(--text-disabled)',
        textColor: 'text-white'
      };
    }

    // Use tier color or default accent
    return {
      backgroundColor: booking.tierColor || 'var(--accent)',
      borderColor: booking.tierColor || 'var(--accent-hover)',
      textColor: 'text-white'
    };
  };

  const styles = getBlockStyles();

  return (
    <div
      className={`absolute inset-x-0 top-0 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${styles.textColor}`}
      style={{
        backgroundColor: styles.backgroundColor,
        borderColor: styles.borderColor,
        height: `${durationBlocks * 40}px`,
        minHeight: '40px',
        zIndex: 10
      }}
      onClick={onClick}
    >
      <div className={`p-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
        {/* Header with time */}
        <div className="flex items-center gap-1 font-medium">
          <Clock className="h-3 w-3" />
          <span>
            {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
          </span>
        </div>

        {/* Content based on type */}
        {booking.isAdminBlock ? (
          <div className="mt-1">
            <div className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              <span className="text-xs">{booking.blockReason || 'Blocked'}</span>
            </div>
          </div>
        ) : (
          <div className="mt-1">
            {/* Customer info */}
            {(booking.customerName || booking.customerEmail) && (
              <div className="flex items-center gap-1 text-xs">
                <User className="h-3 w-3" />
                <span className="truncate">
                  {booking.customerName || booking.customerEmail?.split('@')[0]}
                </span>
              </div>
            )}

            {/* Tier badge */}
            {booking.tierName && !compact && (
              <div className="mt-1">
                <span className="inline-block px-1.5 py-0.5 text-xs font-medium bg-white/20 rounded">
                  {booking.tierName}
                </span>
              </div>
            )}

            {/* Duration */}
            <div className="text-xs opacity-90 mt-0.5">
              {BookingConfigService.formatDuration(durationMinutes)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingBlock;