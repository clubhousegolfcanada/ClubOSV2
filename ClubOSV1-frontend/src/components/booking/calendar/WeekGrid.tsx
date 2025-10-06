import React from 'react';
import { Booking, Space } from './BookingCalendar';
import { BookingConfig } from '@/services/booking/bookingConfig';

interface WeekGridProps {
  startDate: Date;
  bookings: Booking[];
  spaces: Space[];
  config: BookingConfig;
  onBookingCreate?: (startTime: Date, endTime: Date, spaceId?: string) => void;
  onBookingSelect?: (booking: Booking) => void;
}

// Placeholder component - will be implemented in future iteration
const WeekGrid: React.FC<WeekGridProps> = ({
  startDate,
  bookings,
  spaces,
  config,
  onBookingCreate,
  onBookingSelect
}) => {
  return (
    <div className="text-center py-8 text-[var(--text-muted)]">
      <p className="text-lg font-medium mb-2 text-[var(--text-primary)]">Week View Coming Soon</p>
      <p className="text-sm text-[var(--text-secondary)]">The week view is under development and will be available in a future update.</p>
      <p className="text-sm mt-2 text-[var(--text-secondary)]">Please use the Day view for now.</p>
    </div>
  );
};

export default WeekGrid;