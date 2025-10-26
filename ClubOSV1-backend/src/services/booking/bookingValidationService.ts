/**
 * BookingValidationService
 *
 * Centralized validation service for all booking operations.
 * Ensures business rules are consistently applied across the system.
 */

import { logger } from '../../utils/logger';
import { db } from '../../utils/database';
import {
  BookingData,
  BookingValidationResult,
  ValidationError,
  ValidationWarning,
  BookingErrorCode,
  CustomerTierType,
  BookingConfig,
  CustomerTier
} from '../../types/booking';
import { addMinutes, differenceInMinutes, differenceInHours, isAfter, isBefore, format, parse } from 'date-fns';

export class BookingValidationService {
  private static config: BookingConfig | null = null;
  private static customerTiers: Map<string, CustomerTier> = new Map();

  /**
   * Initialize the service with configuration
   */
  static async initialize(): Promise<void> {
    try {
      // Load booking configuration
      const configResult = await db.query(
        "SELECT value FROM system_settings WHERE key = 'booking_config'"
      );
      this.config = configResult.rows[0]?.value || this.getDefaultConfig();

      // Load customer tiers
      const tiersResult = await db.query('SELECT * FROM customer_tiers');
      tiersResult.rows.forEach((tier: CustomerTier) => {
        this.customerTiers.set(tier.id, tier);
      });

      logger.info('BookingValidationService initialized', {
        tiersLoaded: this.customerTiers.size,
        configLoaded: !!this.config
      });
    } catch (error) {
      logger.error('Failed to initialize BookingValidationService:', error);
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * Get default configuration
   */
  private static getDefaultConfig(): BookingConfig {
    return {
      minDuration: 60, // 1 hour minimum
      maxDuration: 360, // 6 hours maximum
      incrementMinutes: 30,
      incrementAfterFirst: 30,
      businessHours: {
        monday: { open: '06:00', close: '23:00' },
        tuesday: { open: '06:00', close: '23:00' },
        wednesday: { open: '06:00', close: '23:00' },
        thursday: { open: '06:00', close: '23:00' },
        friday: { open: '06:00', close: '23:00' },
        saturday: { open: '06:00', close: '23:00' },
        sunday: { open: '06:00', close: '23:00' }
      },
      advanceBookingDays: {
        [CustomerTierType.NEW]: 14,
        [CustomerTierType.MEMBER]: 30,
        [CustomerTierType.PROMO]: 14,
        [CustomerTierType.FREQUENT]: 30
      },
      cancellationPolicy: {
        hoursNotice: 24,
        fee: 10,
        allowedChanges: 2
      },
      pricing: {
        currency: 'USD',
        taxRate: 0.0825,
        depositPercent: 50
      }
    };
  }

  /**
   * Validate a booking request
   */
  static async validateBooking(bookingData: BookingData): Promise<BookingValidationResult> {
    // Ensure service is initialized
    if (!this.config) {
      await this.initialize();
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Skip validation for admin blocks
    if (bookingData.isAdminBlock) {
      return { isValid: true, errors: [], warnings: [] };
    }

    // Validate required fields
    this.validateRequiredFields(bookingData, errors);

    // Validate time constraints
    await this.validateTimeConstraints(bookingData, errors, warnings);

    // Validate customer tier permissions
    this.validateCustomerTier(bookingData, errors, warnings);

    // Validate pricing
    this.validatePricing(bookingData, errors, warnings);

    // Validate business hours
    this.validateBusinessHours(bookingData, errors, warnings);

    // Validate space availability (this is done in BookingService transaction)
    // Just add a warning if checking outside business hours
    const startHour = new Date(bookingData.startAt).getHours();
    if (startHour < 6 || startHour >= 23) {
      warnings.push({
        field: 'startAt',
        message: 'Booking is outside typical business hours',
        code: 'OUTSIDE_TYPICAL_HOURS'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate required fields
   */
  private static validateRequiredFields(bookingData: BookingData, errors: ValidationError[]): void {
    if (!bookingData.locationId) {
      errors.push({
        field: 'locationId',
        message: 'Location is required',
        code: BookingErrorCode.CONFIGURATION_ERROR
      });
    }

    if (!bookingData.spaceIds || bookingData.spaceIds.length === 0) {
      errors.push({
        field: 'spaceIds',
        message: 'At least one space must be selected',
        code: BookingErrorCode.CONFIGURATION_ERROR
      });
    }

    if (!bookingData.startAt) {
      errors.push({
        field: 'startAt',
        message: 'Start time is required',
        code: BookingErrorCode.INVALID_TIME_SLOT
      });
    }

    if (!bookingData.endAt) {
      errors.push({
        field: 'endAt',
        message: 'End time is required',
        code: BookingErrorCode.INVALID_TIME_SLOT
      });
    }

    // Customer information validation
    if (!bookingData.customerEmail && !bookingData.customerId && !bookingData.userId) {
      errors.push({
        field: 'customer',
        message: 'Customer information is required',
        code: BookingErrorCode.CUSTOMER_NOT_FOUND
      });
    }
  }

  /**
   * Validate time constraints
   */
  private static async validateTimeConstraints(
    bookingData: BookingData,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const startTime = new Date(bookingData.startAt);
    const endTime = new Date(bookingData.endAt);
    const now = new Date();
    const durationMinutes = differenceInMinutes(endTime, startTime);

    // Check if end time is after start time
    if (!isAfter(endTime, startTime)) {
      errors.push({
        field: 'endAt',
        message: 'End time must be after start time',
        code: BookingErrorCode.INVALID_TIME_SLOT
      });
      return;
    }

    // Check minimum duration
    const minDuration = this.config?.minDuration || 60;
    if (durationMinutes < minDuration) {
      errors.push({
        field: 'duration',
        message: `Minimum booking duration is ${minDuration} minutes`,
        code: BookingErrorCode.INVALID_DURATION
      });
    }

    // Check maximum duration
    const maxDuration = this.config?.maxDuration || 360;
    if (durationMinutes > maxDuration) {
      errors.push({
        field: 'duration',
        message: `Maximum booking duration is ${maxDuration} minutes`,
        code: BookingErrorCode.INVALID_DURATION
      });
    }

    // Check duration increments (after first hour)
    if (durationMinutes > 60) {
      const incrementAfterFirst = this.config?.incrementAfterFirst || 30;
      const minutesAfterFirst = durationMinutes - 60;
      if (minutesAfterFirst % incrementAfterFirst !== 0) {
        errors.push({
          field: 'duration',
          message: `After the first hour, bookings must be in ${incrementAfterFirst}-minute increments`,
          code: BookingErrorCode.INVALID_DURATION
        });
      }
    }

    // Check minimum advance booking time (1 hour)
    const hoursInAdvance = differenceInHours(startTime, now);
    if (hoursInAdvance < 1) {
      errors.push({
        field: 'startAt',
        message: 'Bookings must be made at least 1 hour in advance',
        code: BookingErrorCode.MINIMUM_ADVANCE_TIME
      });
    }

    // Warn if booking far in advance
    if (hoursInAdvance > 24 * 30) {
      warnings.push({
        field: 'startAt',
        message: 'Booking is more than 30 days in advance',
        code: 'FAR_ADVANCE_BOOKING'
      });
    }
  }

  /**
   * Validate customer tier permissions
   */
  private static validateCustomerTier(
    bookingData: BookingData,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const customerTier = this.customerTiers.get(bookingData.customerTierId);
    if (!customerTier) {
      warnings.push({
        field: 'customerTierId',
        message: 'Unknown customer tier, using default restrictions',
        code: 'UNKNOWN_TIER'
      });
      return;
    }

    // Check advance booking limits
    const startTime = new Date(bookingData.startAt);
    const now = new Date();
    const daysInAdvance = Math.floor(differenceInHours(startTime, now) / 24);
    const maxAdvanceDays = customerTier.maxAdvanceDays;

    if (daysInAdvance > maxAdvanceDays) {
      errors.push({
        field: 'startAt',
        message: `${customerTier.name} can only book ${maxAdvanceDays} days in advance`,
        code: BookingErrorCode.ADVANCE_LIMIT_EXCEEDED
      });
    }

    // Check recurring booking permission
    if (bookingData.recurringPattern && !customerTier.allowRecurring) {
      errors.push({
        field: 'recurringPattern',
        message: `${customerTier.name} tier does not allow recurring bookings`,
        code: BookingErrorCode.TIER_RESTRICTION
      });
    }

    // Add tier info as warning for transparency
    warnings.push({
      field: 'tier',
      message: `Booking as ${customerTier.name} tier (${customerTier.discountPercent}% discount)`,
      code: 'TIER_INFO'
    });
  }

  /**
   * Validate pricing
   */
  private static validatePricing(
    bookingData: BookingData,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check if pricing is reasonable
    if (bookingData.totalAmount < 0) {
      errors.push({
        field: 'totalAmount',
        message: 'Total amount cannot be negative',
        code: BookingErrorCode.CONFIGURATION_ERROR
      });
    }

    // Warn if custom price is significantly different from calculated
    if (bookingData.customPrice) {
      const expectedPrice = this.calculateExpectedPrice(bookingData);
      const priceDifference = Math.abs(bookingData.customPrice - expectedPrice);
      const percentDifference = (priceDifference / expectedPrice) * 100;

      if (percentDifference > 50) {
        warnings.push({
          field: 'customPrice',
          message: `Custom price differs by ${percentDifference.toFixed(0)}% from standard pricing`,
          code: 'SIGNIFICANT_PRICE_OVERRIDE'
        });
      }
    }

    // Validate promo code if provided
    if (bookingData.promoCode) {
      // This would normally check against a promo codes table
      warnings.push({
        field: 'promoCode',
        message: 'Promo code validation not yet implemented',
        code: 'PROMO_VALIDATION_PENDING'
      });
    }
  }

  /**
   * Validate business hours
   */
  private static validateBusinessHours(
    bookingData: BookingData,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const startTime = new Date(bookingData.startAt);
    const endTime = new Date(bookingData.endAt);
    const dayOfWeek = format(startTime, 'EEEE').toLowerCase();

    const businessHours = this.config?.businessHours[dayOfWeek];
    if (!businessHours || businessHours.closed) {
      errors.push({
        field: 'startAt',
        message: `Facility is closed on ${dayOfWeek}`,
        code: BookingErrorCode.OUTSIDE_BUSINESS_HOURS
      });
      return;
    }

    // Parse business hours
    const openTime = parse(businessHours.open, 'HH:mm', startTime);
    const closeTime = parse(businessHours.close, 'HH:mm', startTime);

    // Check if booking is within business hours
    if (isBefore(startTime, openTime)) {
      errors.push({
        field: 'startAt',
        message: `Facility opens at ${businessHours.open}`,
        code: BookingErrorCode.OUTSIDE_BUSINESS_HOURS
      });
    }

    if (isAfter(endTime, closeTime)) {
      errors.push({
        field: 'endAt',
        message: `Facility closes at ${businessHours.close}`,
        code: BookingErrorCode.OUTSIDE_BUSINESS_HOURS
      });
    }
  }

  /**
   * Calculate expected price for a booking
   */
  private static calculateExpectedPrice(bookingData: BookingData): number {
    const durationMinutes = differenceInMinutes(
      new Date(bookingData.endAt),
      new Date(bookingData.startAt)
    );
    const durationHours = durationMinutes / 60;

    const customerTier = this.customerTiers.get(bookingData.customerTierId);
    const hourlyRate = customerTier?.hourlyRate || bookingData.baseRate || 30;
    const discountPercent = customerTier?.discountPercent || 0;

    const basePrice = hourlyRate * durationHours;
    const discount = (basePrice * discountPercent) / 100;
    const subtotal = basePrice - discount;

    // Apply tax if configured
    const taxRate = this.config?.pricing?.taxRate || 0;
    const tax = subtotal * taxRate;

    return Math.round((subtotal + tax) * 100) / 100; // Round to cents
  }

  /**
   * Validate a booking update
   */
  static async validateBookingUpdate(
    bookingId: string,
    updates: Partial<BookingData>,
    userId: string
  ): Promise<BookingValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Get existing booking
      const bookingResult = await db.query(
        'SELECT * FROM bookings WHERE id = $1',
        [bookingId]
      );

      if (!bookingResult.rows[0]) {
        errors.push({
          field: 'bookingId',
          message: 'Booking not found',
          code: BookingErrorCode.SYSTEM_ERROR
        });
        return { isValid: false, errors, warnings };
      }

      const existingBooking = bookingResult.rows[0];

      // Check if user has permission to update
      if (existingBooking.user_id !== userId && existingBooking.customer_id !== userId) {
        // Check if user is admin/operator (would need role check here)
        warnings.push({
          field: 'permission',
          message: 'Updating booking for another user',
          code: 'CROSS_USER_UPDATE'
        });
      }

      // Check cancellation policy if changing time
      if (updates.startAt || updates.endAt) {
        const hoursUntilBooking = differenceInHours(
          new Date(existingBooking.start_at),
          new Date()
        );

        const cancellationHours = this.config?.cancellationPolicy?.hoursNotice || 24;
        if (hoursUntilBooking < cancellationHours) {
          warnings.push({
            field: 'timing',
            message: `Changes within ${cancellationHours} hours may incur fees`,
            code: 'LATE_CHANGE_FEE'
          });
        }

        // Check change count
        if (existingBooking.change_count >= (this.config?.cancellationPolicy?.allowedChanges || 2)) {
          warnings.push({
            field: 'changes',
            message: 'Maximum number of free changes exceeded',
            code: 'CHANGE_LIMIT_EXCEEDED'
          });
        }
      }

      // Validate the updated booking data
      const mergedData: BookingData = {
        ...existingBooking,
        ...updates,
        // Ensure dates are strings
        startAt: updates.startAt || existingBooking.start_at.toISOString(),
        endAt: updates.endAt || existingBooking.end_at.toISOString()
      };

      const validationResult = await this.validateBooking(mergedData);
      errors.push(...validationResult.errors);
      warnings.push(...validationResult.warnings);

    } catch (error) {
      logger.error('Error validating booking update:', error);
      errors.push({
        field: 'system',
        message: 'Failed to validate booking update',
        code: BookingErrorCode.SYSTEM_ERROR
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate a booking cancellation
   */
  static async validateCancellation(
    bookingId: string,
    userId: string,
    reason?: string
  ): Promise<BookingValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Get existing booking
      const bookingResult = await db.query(
        'SELECT * FROM bookings WHERE id = $1',
        [bookingId]
      );

      if (!bookingResult.rows[0]) {
        errors.push({
          field: 'bookingId',
          message: 'Booking not found',
          code: BookingErrorCode.SYSTEM_ERROR
        });
        return { isValid: false, errors, warnings };
      }

      const booking = bookingResult.rows[0];

      // Check if already cancelled
      if (booking.status === 'cancelled') {
        errors.push({
          field: 'status',
          message: 'Booking is already cancelled',
          code: BookingErrorCode.SYSTEM_ERROR
        });
        return { isValid: false, errors, warnings };
      }

      // Check cancellation timing
      const hoursUntilBooking = differenceInHours(
        new Date(booking.start_at),
        new Date()
      );

      const cancellationHours = this.config?.cancellationPolicy?.hoursNotice || 24;
      if (hoursUntilBooking < cancellationHours) {
        warnings.push({
          field: 'timing',
          message: `Cancellation within ${cancellationHours} hours may incur a fee`,
          code: 'LATE_CANCELLATION_FEE'
        });
      }

      // Check if reason is provided for late cancellations
      if (hoursUntilBooking < 2 && !reason) {
        warnings.push({
          field: 'reason',
          message: 'Please provide a reason for last-minute cancellation',
          code: 'REASON_RECOMMENDED'
        });
      }

    } catch (error) {
      logger.error('Error validating cancellation:', error);
      errors.push({
        field: 'system',
        message: 'Failed to validate cancellation',
        code: BookingErrorCode.SYSTEM_ERROR
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Initialize the service on module load
BookingValidationService.initialize().catch(error => {
  logger.error('Failed to initialize BookingValidationService on load:', error);
});