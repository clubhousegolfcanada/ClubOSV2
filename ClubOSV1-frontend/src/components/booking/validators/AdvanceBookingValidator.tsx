import React from 'react';
import { AlertCircle, Calendar, Lock, TrendingUp } from 'lucide-react';

interface AdvanceBookingValidatorProps {
  selectedDate: Date;
  customerTier: string;
  maxAdvanceDays: number;
  className?: string;
}

const AdvanceBookingValidator: React.FC<AdvanceBookingValidatorProps> = ({
  selectedDate,
  customerTier,
  maxAdvanceDays,
  className = ''
}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selected = new Date(selectedDate);
  selected.setHours(0, 0, 0, 0);

  const daysDifference = Math.ceil((selected.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Validation states
  const isTooFarInAdvance = daysDifference > maxAdvanceDays;
  const isPastDate = daysDifference < 0;
  const isToday = daysDifference === 0;
  const isNearLimit = daysDifference >= maxAdvanceDays - 2 && daysDifference <= maxAdvanceDays;

  // Get tier-specific messages
  const getTierMessage = () => {
    const tierMessages: Record<string, { limit: number; upgrade?: string }> = {
      new: { limit: 14, upgrade: 'Become a member to book up to 30 days ahead!' },
      member: { limit: 30, upgrade: 'Upgrade to Frequent Player for 45-day advance booking!' },
      frequent: { limit: 45, upgrade: 'You have maximum advance booking privileges!' },
      promo: { limit: 21, upgrade: 'Convert to membership for extended booking windows!' }
    };

    return tierMessages[customerTier] || tierMessages.new;
  };

  const tierInfo = getTierMessage();

  // Format date for display
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isPastDate) {
    return (
      <div className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-red-700 dark:text-red-300">Invalid Date</h4>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              You cannot book dates in the past. Please select today or a future date.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isTooFarInAdvance) {
    return (
      <div className={`bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-orange-700 dark:text-orange-300">Booking Too Far in Advance</h4>
            <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
              As a <span className="font-medium">{customerTier}</span> customer, you can book up to {tierInfo.limit} days in advance.
            </p>
            <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
              This date is {daysDifference} days away. Maximum allowed: {formatDate(new Date(today.getTime() + maxAdvanceDays * 24 * 60 * 60 * 1000))}
            </p>
            {tierInfo.upgrade && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-orange-500" />
                <span className="text-orange-700 dark:text-orange-300 font-medium">
                  {tierInfo.upgrade}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isNearLimit) {
    return (
      <div className={`bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-yellow-700 dark:text-yellow-300">Near Booking Limit</h4>
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
              You're booking {daysDifference} days in advance (limit: {maxAdvanceDays} days).
            </p>
            {tierInfo.upgrade && !customerTier.includes('frequent') && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
                <span className="font-medium">Tip:</span> {tierInfo.upgrade}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isToday) {
    return (
      <div className={`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-blue-700 dark:text-blue-300">Same-Day Booking</h4>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              You're booking for today. Please ensure you can arrive on time for your selected slot.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Valid booking within limits
  return (
    <div className={`bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <Calendar className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="font-semibold text-green-700 dark:text-green-300">Valid Booking Date</h4>
          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
            Booking for {formatDate(selectedDate)} ({daysDifference} {daysDifference === 1 ? 'day' : 'days'} ahead)
          </p>
          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
            Your {customerTier} tier allows bookings up to {maxAdvanceDays} days in advance.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdvanceBookingValidator;