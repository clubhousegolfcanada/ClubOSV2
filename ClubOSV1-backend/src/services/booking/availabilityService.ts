import { db, pool } from '../../utils/database';
import { logger } from '../../utils/logger';
import { addMinutes, differenceInMinutes, format } from 'date-fns';

export interface AvailabilityCheckResult {
  isAvailable: boolean;
  maxAvailableDuration: number; // in minutes
  nextBookingTime: Date | null;
  availableDurations: number[]; // Available duration options in minutes
  conflictingBookings: Array<{
    id: string;
    startAt: Date;
    endAt: Date;
    customerName?: string;
  }>;
  suggestedAlternatives?: Array<{
    startTime: Date;
    endTime: Date;
    duration: number;
  }>;
}

export interface DurationValidationResult {
  isValid: boolean;
  maxAllowedDuration: number;
  reason?: string;
  availableOptions: Array<{
    duration: number; // in minutes
    label: string;
    price: number;
    available: boolean;
    disabledReason?: string;
  }>;
}

export class AvailabilityService {
  /**
   * Check availability for a specific space starting at a given time
   * Returns maximum available duration and conflict information
   */
  static async checkAvailability(
    locationId: string,
    spaceId: string,
    startTime: Date,
    customerTierId?: string
  ): Promise<AvailabilityCheckResult> {
    try {
      logger.info('Checking availability', { locationId, spaceId, startTime });

      // Get all bookings for this space on the same day
      const startOfDay = new Date(startTime);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startTime);
      endOfDay.setHours(23, 59, 59, 999);

      const bookingsQuery = await db.query(
        `SELECT id, start_at, end_at, customer_name, space_ids
         FROM bookings
         WHERE location_id = $1
         AND $2 = ANY(space_ids)
         AND status IN ('confirmed', 'pending')
         AND start_at >= $3 AND start_at <= $4
         ORDER BY start_at ASC`,
        [locationId, spaceId, startOfDay.toISOString(), endOfDay.toISOString()]
      );

      const bookings = bookingsQuery.rows.map(b => ({
        id: b.id,
        startAt: new Date(b.start_at),
        endAt: new Date(b.end_at),
        customerName: b.customer_name
      }));

      // Find the next booking after the requested start time
      const futureBookings = bookings.filter(b => b.startAt > startTime);
      const nextBooking = futureBookings.length > 0 ? futureBookings[0] : null;

      // Calculate maximum available duration
      let maxAvailableDuration = 360; // Default max 6 hours

      if (nextBooking) {
        const availableMinutes = differenceInMinutes(nextBooking.startAt, startTime);
        maxAvailableDuration = Math.min(maxAvailableDuration, availableMinutes);
      }

      // Check if there's a booking at the exact start time
      const conflictAtStart = bookings.find(b =>
        b.startAt <= startTime && b.endAt > startTime
      );

      if (conflictAtStart) {
        // Time slot is already booked
        const suggestedAlternatives = this.findAlternativeSlots(
          bookings,
          startTime,
          60, // Default 1 hour duration for suggestions
          startOfDay,
          endOfDay
        );

        return {
          isAvailable: false,
          maxAvailableDuration: 0,
          nextBookingTime: conflictAtStart.endAt,
          availableDurations: [],
          conflictingBookings: [conflictAtStart],
          suggestedAlternatives
        };
      }

      // Generate available duration options based on max available time
      const availableDurations = this.generateDurationOptions(maxAvailableDuration);

      return {
        isAvailable: true,
        maxAvailableDuration,
        nextBookingTime: nextBooking ? nextBooking.startAt : null,
        availableDurations,
        conflictingBookings: [],
        suggestedAlternatives: []
      };

    } catch (error) {
      logger.error('Error checking availability:', error);
      throw new Error('Failed to check availability');
    }
  }

  /**
   * Validate duration options for a booking with pricing
   */
  static async validateDuration(
    locationId: string,
    spaceId: string,
    startTime: Date,
    customerTierId: string
  ): Promise<DurationValidationResult> {
    try {
      // Get availability first
      const availability = await this.checkAvailability(
        locationId,
        spaceId,
        startTime,
        customerTierId
      );

      // Get tier pricing
      const tierQuery = await db.query(
        `SELECT hourly_rate, max_booking_duration, min_booking_duration
         FROM customer_tiers
         WHERE id = $1`,
        [customerTierId]
      );

      const tier = tierQuery.rows[0];
      const hourlyRate = tier?.hourly_rate || 30; // Default $30/hour
      const maxTierDuration = tier?.max_booking_duration || 360; // minutes
      const minTierDuration = tier?.min_booking_duration || 60;

      // Calculate actual max duration (minimum of tier limit and availability)
      const maxAllowedDuration = Math.min(
        availability.maxAvailableDuration,
        maxTierDuration
      );

      // Generate duration options with pricing
      const durations = [60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360];
      const availableOptions = durations.map(duration => {
        const hours = duration / 60;
        const price = hours * hourlyRate;
        const available = duration <= maxAllowedDuration && duration >= minTierDuration;

        let disabledReason: string | undefined;
        if (duration > availability.maxAvailableDuration) {
          const nextTime = availability.nextBookingTime
            ? format(availability.nextBookingTime, 'h:mm a')
            : '';
          disabledReason = nextTime
            ? `Another booking starts at ${nextTime}`
            : 'Exceeds available time';
        } else if (duration > maxTierDuration) {
          disabledReason = `Your tier allows maximum ${maxTierDuration / 60} hours`;
        } else if (duration < minTierDuration) {
          disabledReason = `Minimum booking is ${minTierDuration} minutes`;
        }

        return {
          duration,
          label: this.formatDurationLabel(duration),
          price,
          available,
          disabledReason
        };
      });

      return {
        isValid: availability.isAvailable,
        maxAllowedDuration,
        reason: availability.isAvailable ? undefined : 'Time slot not available',
        availableOptions
      };

    } catch (error) {
      logger.error('Error validating duration:', error);
      throw new Error('Failed to validate duration');
    }
  }

  /**
   * Check availability for multiple spaces at once
   */
  static async checkMultiSpaceAvailability(
    locationId: string,
    spaceIds: string[],
    startTime: Date,
    endTime: Date
  ): Promise<{
    allAvailable: boolean;
    unavailableSpaces: string[];
    spaceAvailability: Map<string, AvailabilityCheckResult>;
  }> {
    const spaceAvailability = new Map<string, AvailabilityCheckResult>();
    const unavailableSpaces: string[] = [];

    // Check each space
    for (const spaceId of spaceIds) {
      const availability = await this.checkAvailability(
        locationId,
        spaceId,
        startTime
      );

      spaceAvailability.set(spaceId, availability);

      const requestedDuration = differenceInMinutes(endTime, startTime);
      if (!availability.isAvailable || availability.maxAvailableDuration < requestedDuration) {
        unavailableSpaces.push(spaceId);
      }
    }

    return {
      allAvailable: unavailableSpaces.length === 0,
      unavailableSpaces,
      spaceAvailability
    };
  }

  /**
   * Find alternative time slots when requested time is unavailable
   */
  private static findAlternativeSlots(
    existingBookings: Array<{ startAt: Date; endAt: Date }>,
    requestedStart: Date,
    requestedDuration: number, // minutes
    dayStart: Date,
    dayEnd: Date
  ): Array<{ startTime: Date; endTime: Date; duration: number }> {
    const alternatives: Array<{ startTime: Date; endTime: Date; duration: number }> = [];
    const sortedBookings = [...existingBookings].sort((a, b) =>
      a.startAt.getTime() - b.startAt.getTime()
    );

    // Check slots between bookings
    let currentTime = dayStart;
    currentTime.setHours(6, 0, 0, 0); // Start from 6 AM

    for (const booking of sortedBookings) {
      const gapMinutes = differenceInMinutes(booking.startAt, currentTime);

      if (gapMinutes >= requestedDuration) {
        // Found a suitable gap
        alternatives.push({
          startTime: new Date(currentTime),
          endTime: addMinutes(currentTime, requestedDuration),
          duration: requestedDuration
        });
      }

      currentTime = new Date(booking.endAt);

      if (alternatives.length >= 3) break; // Limit to 3 suggestions
    }

    // Check after last booking
    const endTime = new Date(dayEnd);
    endTime.setHours(23, 0, 0, 0); // Until 11 PM

    const finalGap = differenceInMinutes(endTime, currentTime);
    if (finalGap >= requestedDuration && alternatives.length < 3) {
      alternatives.push({
        startTime: new Date(currentTime),
        endTime: addMinutes(currentTime, requestedDuration),
        duration: requestedDuration
      });
    }

    // Sort by proximity to requested time
    return alternatives.sort((a, b) => {
      const aDiff = Math.abs(a.startTime.getTime() - requestedStart.getTime());
      const bDiff = Math.abs(b.startTime.getTime() - requestedStart.getTime());
      return aDiff - bDiff;
    });
  }

  /**
   * Generate duration options based on maximum available time
   */
  private static generateDurationOptions(maxMinutes: number): number[] {
    const options: number[] = [];
    const standardDurations = [60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360];

    for (const duration of standardDurations) {
      if (duration <= maxMinutes) {
        options.push(duration);
      }
    }

    return options;
  }

  /**
   * Format duration for display
   */
  private static formatDurationLabel(minutes: number): string {
    if (minutes === 60) return '1 hour';
    if (minutes === 90) return '1.5 hours';
    if (minutes === 120) return '2 hours';
    if (minutes === 150) return '2.5 hours';
    if (minutes === 180) return '3 hours';
    if (minutes === 210) return '3.5 hours';
    if (minutes === 240) return '4 hours';
    if (minutes === 270) return '4.5 hours';
    if (minutes === 300) return '5 hours';
    if (minutes === 330) return '5.5 hours';
    if (minutes === 360) return '6 hours';

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours}h ${mins}m`;
  }
}