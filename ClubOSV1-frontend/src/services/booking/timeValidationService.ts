/**
 * Time Validation Service for Booking System
 * Enforces business rules for booking durations and time slots
 */

import { addMinutes, differenceInMinutes, isBefore, isAfter, startOfDay, addDays } from 'date-fns';

export interface TimeValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string;
}

export interface BookingTimeRules {
  minDuration: number;           // Minimum booking duration in minutes (60)
  maxDuration: number;           // Maximum booking duration in minutes (360)
  incrementAfterFirst: number;   // Increment after first hour (30)
  bufferBefore: number;          // Minutes before booking starts that user can't book (60)
  maxAdvanceDays: {
    new: number;                  // New customers: 14 days
    member: number;               // Members: 30 days
    promo: number;                // Promo users: 14 days
    frequent: number;             // Frequent bookers: 30 days
  };
}

export class TimeValidationService {
  private static defaultRules: BookingTimeRules = {
    minDuration: 60,
    maxDuration: 360,
    incrementAfterFirst: 30,
    bufferBefore: 60,
    maxAdvanceDays: {
      new: 14,
      member: 30,
      promo: 14,
      frequent: 30
    }
  };

  /**
   * Validates booking duration against business rules
   * @param startTime - Booking start time
   * @param endTime - Booking end time
   * @param rules - Optional custom rules (defaults to business requirements)
   */
  static validateDuration(
    startTime: Date,
    endTime: Date,
    rules: Partial<BookingTimeRules> = {}
  ): TimeValidationResult {
    const config = { ...this.defaultRules, ...rules };
    const durationMinutes = differenceInMinutes(endTime, startTime);

    // Check minimum duration
    if (durationMinutes < config.minDuration) {
      return {
        isValid: false,
        error: `Minimum booking duration is ${config.minDuration} minutes (1 hour)`,
        suggestion: `Please book for at least ${config.minDuration} minutes`
      };
    }

    // Check maximum duration
    if (durationMinutes > config.maxDuration) {
      return {
        isValid: false,
        error: `Maximum booking duration is ${config.maxDuration} minutes (${config.maxDuration / 60} hours)`,
        suggestion: `Please book for ${config.maxDuration} minutes or less`
      };
    }

    // Check increment validation after first hour
    if (durationMinutes > config.minDuration) {
      const minutesAfterFirst = durationMinutes - config.minDuration;
      if (minutesAfterFirst % config.incrementAfterFirst !== 0) {
        const nextValidDuration = config.minDuration +
          Math.ceil(minutesAfterFirst / config.incrementAfterFirst) * config.incrementAfterFirst;
        const prevValidDuration = config.minDuration +
          Math.floor(minutesAfterFirst / config.incrementAfterFirst) * config.incrementAfterFirst;

        return {
          isValid: false,
          error: `After the first hour, bookings must be in ${config.incrementAfterFirst}-minute increments`,
          suggestion: `Try booking for ${prevValidDuration} or ${nextValidDuration} minutes instead`
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Validates advance booking limits based on customer tier
   * @param bookingDate - Date of the booking
   * @param customerTier - Customer tier (new, member, promo, frequent)
   * @param rules - Optional custom rules
   */
  static validateAdvanceBooking(
    bookingDate: Date,
    customerTier: 'new' | 'member' | 'promo' | 'frequent',
    rules: Partial<BookingTimeRules> = {}
  ): TimeValidationResult {
    const config = { ...this.defaultRules, ...rules };
    const today = startOfDay(new Date());
    const maxAdvanceDays = config.maxAdvanceDays[customerTier];
    const maxBookingDate = addDays(today, maxAdvanceDays);

    if (isAfter(bookingDate, maxBookingDate)) {
      return {
        isValid: false,
        error: `${customerTier === 'new' ? 'New customers' : 'Your tier'} can only book ${maxAdvanceDays} days in advance`,
        suggestion: `Please select a date within the next ${maxAdvanceDays} days`
      };
    }

    return { isValid: true };
  }

  /**
   * Validates that booking is not too close to current time
   * @param startTime - Booking start time
   * @param rules - Optional custom rules
   */
  static validateMinimumNotice(
    startTime: Date,
    rules: Partial<BookingTimeRules> = {}
  ): TimeValidationResult {
    const config = { ...this.defaultRules, ...rules };
    const now = new Date();
    const minimumStartTime = addMinutes(now, config.bufferBefore);

    if (isBefore(startTime, minimumStartTime)) {
      return {
        isValid: false,
        error: `Bookings must be made at least ${config.bufferBefore} minutes in advance`,
        suggestion: `Please select a time at least 1 hour from now`
      };
    }

    return { isValid: true };
  }

  /**
   * Gets valid duration options based on rules
   * @param rules - Optional custom rules
   * @returns Array of valid duration options in minutes
   */
  static getValidDurations(rules: Partial<BookingTimeRules> = {}): number[] {
    const config = { ...this.defaultRules, ...rules };
    const durations: number[] = [config.minDuration]; // Start with minimum (60)

    // Add increments after first hour
    let current = config.minDuration + config.incrementAfterFirst;
    while (current <= config.maxDuration) {
      durations.push(current);
      current += config.incrementAfterFirst;
    }

    return durations;
  }

  /**
   * Rounds a duration to the nearest valid increment
   * @param durationMinutes - Duration to round
   * @param rules - Optional custom rules
   * @returns Nearest valid duration
   */
  static roundToValidDuration(
    durationMinutes: number,
    rules: Partial<BookingTimeRules> = {}
  ): number {
    const config = { ...this.defaultRules, ...rules };

    if (durationMinutes <= config.minDuration) {
      return config.minDuration;
    }

    if (durationMinutes >= config.maxDuration) {
      return config.maxDuration;
    }

    const minutesAfterFirst = durationMinutes - config.minDuration;
    const rounded = Math.round(minutesAfterFirst / config.incrementAfterFirst) * config.incrementAfterFirst;
    return config.minDuration + rounded;
  }

  /**
   * Formats duration for display
   * @param minutes - Duration in minutes
   * @returns Formatted string (e.g., "1 hour", "1.5 hours", "2 hours")
   */
  static formatDuration(minutes: number): string {
    if (minutes === 60) return '1 hour';
    if (minutes < 60) return `${minutes} minutes`;

    const hours = minutes / 60;
    if (hours === Math.floor(hours)) {
      return `${hours} hours`;
    }
    return `${hours} hours`;
  }

  /**
   * Validates complete booking request
   * @param startTime - Booking start time
   * @param endTime - Booking end time
   * @param customerTier - Customer tier
   * @param rules - Optional custom rules
   * @returns Combined validation result
   */
  static validateBooking(
    startTime: Date,
    endTime: Date,
    customerTier: 'new' | 'member' | 'promo' | 'frequent',
    rules: Partial<BookingTimeRules> = {}
  ): TimeValidationResult {
    // Validate duration
    const durationResult = this.validateDuration(startTime, endTime, rules);
    if (!durationResult.isValid) return durationResult;

    // Validate advance booking
    const advanceResult = this.validateAdvanceBooking(startTime, customerTier, rules);
    if (!advanceResult.isValid) return advanceResult;

    // Validate minimum notice
    const noticeResult = this.validateMinimumNotice(startTime, rules);
    if (!noticeResult.isValid) return noticeResult;

    return { isValid: true };
  }
}

// Export convenience functions
export const validateBookingTime = TimeValidationService.validateBooking;
export const getValidDurations = TimeValidationService.getValidDurations;
export const formatDuration = TimeValidationService.formatDuration;