import React, { useState, useEffect } from 'react';
import { AlertCircle, Calendar, CheckCircle, Info, XCircle } from 'lucide-react';
import { differenceInDays, differenceInHours, isBefore, isAfter, startOfDay, addDays } from 'date-fns';
import { CustomerTier } from '@/services/booking/bookingConfig';

interface ValidationResult {
  isValid: boolean;
  message?: string;
  severity?: 'error' | 'warning' | 'info';
  suggestions?: string[];
}

interface AdvanceBookingValidatorProps {
  bookingDate: Date;
  customerTier?: CustomerTier;
  existingBookings?: Date[];
  maxBookingsPerWeek?: number;
  onValidation?: (result: ValidationResult) => void;
  className?: string;
}

const AdvanceBookingValidator: React.FC<AdvanceBookingValidatorProps> = ({
  bookingDate,
  customerTier,
  existingBookings = [],
  maxBookingsPerWeek = 5,
  onValidation,
  className = ''
}) => {
  const [validationResult, setValidationResult] = useState<ValidationResult>({ isValid: true });

  // Tier-based advance booking limits (in days)
  const getAdvanceLimit = (tier?: CustomerTier): number => {
    if (!tier) return 14; // Default for new customers

    switch (tier.name?.toLowerCase()) {
      case 'member':
      case 'standard':
        return 30;
      case 'promo':
        return 21;
      case 'frequent':
      case 'premium':
        return 60;
      case 'new':
      default:
        return 14;
    }
  };

  // Validate the booking date
  const validateBooking = (): ValidationResult => {
    const now = new Date();
    const today = startOfDay(now);
    const bookingDay = startOfDay(bookingDate);

    // Check if booking is in the past
    if (isBefore(bookingDate, now)) {
      return {
        isValid: false,
        message: 'Cannot book a time in the past',
        severity: 'error'
      };
    }

    // Check minimum advance notice (1 hour)
    const hoursUntilBooking = differenceInHours(bookingDate, now);
    if (hoursUntilBooking < 1) {
      return {
        isValid: false,
        message: 'Bookings must be made at least 1 hour in advance',
        severity: 'error',
        suggestions: ['Try booking for a later time today', 'Book for tomorrow']
      };
    }

    // Check maximum advance booking based on tier
    const daysInAdvance = differenceInDays(bookingDay, today);
    const maxAdvanceDays = getAdvanceLimit(customerTier);

    if (daysInAdvance > maxAdvanceDays) {
      const tierName = customerTier?.name || 'New customers';
      return {
        isValid: false,
        message: `${tierName} can only book ${maxAdvanceDays} days in advance`,
        severity: 'error',
        suggestions: [
          `Select a date within ${maxAdvanceDays} days`,
          customerTier?.name === 'new' ? 'Upgrade to Member tier for 30-day advance booking' : undefined
        ].filter(Boolean) as string[]
      };
    }

    // Warning for same-day bookings
    if (daysInAdvance === 0 && hoursUntilBooking < 2) {
      return {
        isValid: true,
        message: 'Last-minute booking - subject to availability',
        severity: 'warning'
      };
    }

    // Check weekly booking limit
    if (existingBookings.length > 0) {
      const weekStart = addDays(today, -7);
      const bookingsThisWeek = existingBookings.filter(date =>
        isAfter(date, weekStart) && isBefore(date, addDays(today, 1))
      );

      if (bookingsThisWeek.length >= maxBookingsPerWeek) {
        return {
          isValid: false,
          message: `You've reached the weekly limit of ${maxBookingsPerWeek} bookings`,
          severity: 'error',
          suggestions: ['Try booking for next week', 'Cancel an existing booking']
        };
      }

      if (bookingsThisWeek.length >= maxBookingsPerWeek - 1) {
        return {
          isValid: true,
          message: `This will be your last booking for the week (${bookingsThisWeek.length + 1}/${maxBookingsPerWeek})`,
          severity: 'warning'
        };
      }
    }

    // Optimal booking window (3-7 days advance)
    if (daysInAdvance >= 3 && daysInAdvance <= 7) {
      return {
        isValid: true,
        message: 'Perfect timing! Best availability',
        severity: 'info'
      };
    }

    // Valid booking
    return {
      isValid: true
    };
  };

  // Validate on mount and when inputs change
  useEffect(() => {
    const result = validateBooking();
    setValidationResult(result);
    onValidation?.(result);
  }, [bookingDate, customerTier, existingBookings]);

  // Get icon based on validation state
  const getIcon = () => {
    switch (validationResult.severity) {
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return validationResult.isValid
          ? <CheckCircle className="w-5 h-5 text-green-500" />
          : <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  // Get background color based on severity
  const getBackgroundClass = () => {
    if (!validationResult.message) return '';

    switch (validationResult.severity) {
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'info':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  // Get text color based on severity
  const getTextClass = () => {
    switch (validationResult.severity) {
      case 'error':
        return 'text-red-700 dark:text-red-300';
      case 'warning':
        return 'text-yellow-700 dark:text-yellow-300';
      case 'info':
        return 'text-green-700 dark:text-green-300';
      default:
        return 'text-blue-700 dark:text-blue-300';
    }
  };

  if (!validationResult.message) {
    return null; // Don't show anything if there's no message
  }

  return (
    <div className={`rounded-lg border p-4 ${getBackgroundClass()} ${className}`}>
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1">
          <div className={`text-sm font-medium ${getTextClass()}`}>
            {validationResult.message}
          </div>

          {validationResult.suggestions && validationResult.suggestions.length > 0 && (
            <ul className={`mt-2 text-xs space-y-1 ${getTextClass()} opacity-80`}>
              {validationResult.suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-1">
                  <span>"</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Tier upgrade prompt for new customers */}
      {customerTier?.name === 'new' && validationResult.isValid && (
        <div className="mt-3 pt-3 border-t border-current opacity-20">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span className="text-xs">
              {3 - (existingBookings?.length || 0)} more bookings until Member tier (30-day advance booking)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvanceBookingValidator;