/**
 * Centralized Booking Types for ClubOS
 * Version: 1.24.26
 *
 * This file contains all TypeScript interfaces and types for the booking system.
 * It serves as the single source of truth for booking-related data structures.
 */

// ============================================
// ENUMS
// ============================================

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  NO_SHOW = 'no-show'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  PARTIALLY_PAID = 'partially_paid',
  REFUNDED = 'refunded',
  FAILED = 'failed'
}

export enum CustomerTierType {
  NEW = 'new',
  MEMBER = 'member',
  PROMO = 'promo',
  FREQUENT = 'frequent'
}

export enum BookingType {
  SINGLE = 'single',
  RECURRING = 'recurring',
  EVENT = 'event',
  CLASS = 'class',
  MAINTENANCE = 'maintenance',
  ADMIN_BLOCK = 'admin_block'
}

export enum RecurringFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly'
}

export enum MaintenanceType {
  CLEANING = 'cleaning',
  REPAIR = 'repair',
  INSPECTION = 'inspection',
  OTHER = 'other'
}

// ============================================
// CORE INTERFACES
// ============================================

/**
 * Database booking record structure
 * Matches the actual database schema
 */
export interface DbBooking {
  // Primary fields
  id: number;
  user_id?: number;
  customer_id?: number;
  location_id: string | number;
  space_ids: number[];

  // Time fields
  start_at: Date;
  end_at: Date;

  // Customer info
  customer_tier_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;

  // Pricing
  base_rate?: number;
  total_amount?: number;
  deposit_amount?: number;
  promo_code?: string;
  promo_discount?: number;

  // Status fields
  status: BookingStatus;
  payment_status?: PaymentStatus;

  // Admin fields
  is_admin_block?: boolean;
  block_reason?: string;
  admin_notes?: string;

  // Tracking fields
  change_count?: number;
  change_fee_charged?: number;
  flagged_for_changes?: boolean;

  // Metadata
  created_at: Date;
  updated_at: Date;
  cancelled_at?: Date;
  created_by?: number;
  metadata?: any;
}

/**
 * API request structure for creating a booking
 */
export interface CreateBookingRequest {
  // Required fields
  locationId: string;
  spaceIds: string[];
  startAt: string; // ISO date string
  endAt: string;   // ISO date string

  // Customer fields (at least one required)
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  // Optional fields
  promoCode?: string;
  adminNotes?: string;

  // Admin block fields
  isAdminBlock?: boolean;
  blockReason?: string;
  maintenanceType?: MaintenanceType;

  // Event/Class fields
  eventName?: string;
  expectedAttendees?: number;
  requiresDeposit?: boolean;
  customPrice?: number;
  totalAmount?: number;
  photoUrls?: string[];

  // Recurring fields
  recurringPattern?: RecurringPattern;
}

/**
 * API response structure for a booking
 */
export interface BookingResponse extends Omit<DbBooking, 'start_at' | 'end_at' | 'created_at' | 'updated_at' | 'cancelled_at'> {
  startAt: string;
  endAt: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;

  // Computed fields
  duration?: number; // in minutes
  tierName?: string;
  tierColor?: string;
  locationName?: string;
  spaceNames?: string[];
}

/**
 * Recurring booking pattern
 */
export interface RecurringPattern {
  frequency: RecurringFrequency;
  interval: number; // e.g., every 2 weeks
  endDate?: string; // When recurring bookings should stop
  daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
  occurrences?: number; // Alternative to endDate
}

// ============================================
// SERVICE INTERFACES
// ============================================

/**
 * Internal booking data used by BookingService
 */
export interface BookingData {
  locationId: string;
  spaceIds: string[];
  userId?: string;
  customerId?: string;
  customerTierId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  startAt: string;
  endAt: string;
  baseRate: number;
  totalAmount: number;
  customPrice?: number;
  promoCode?: string;
  adminNotes?: string;
  isAdminBlock?: boolean;
  blockReason?: string;
  maintenanceType?: MaintenanceType;
  recurringPattern?: RecurringPattern | null;
  eventName?: string;
  expectedAttendees?: number;
  requiresDeposit?: boolean;
  photoUrls?: string[];
}

/**
 * Result from booking creation transaction
 */
export interface BookingTransactionResult {
  success: boolean;
  data?: DbBooking;
  error?: string;
  errorCode?: BookingErrorCode;
  conflictingBookings?: any[];
  conflictingSpaces?: any[];
}

// ============================================
// VALIDATION INTERFACES
// ============================================

/**
 * Booking validation result
 */
export interface BookingValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: BookingErrorCode;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

export enum BookingErrorCode {
  // Time conflicts
  TIME_CONFLICT = 'TIME_CONFLICT',
  SPACE_CONFLICT = 'SPACE_CONFLICT',
  BOOKING_CONFLICT = 'BOOKING_CONFLICT',

  // Validation errors
  INVALID_DURATION = 'INVALID_DURATION',
  INVALID_TIME_SLOT = 'INVALID_TIME_SLOT',
  ADVANCE_LIMIT_EXCEEDED = 'ADVANCE_LIMIT_EXCEEDED',
  MINIMUM_ADVANCE_TIME = 'MINIMUM_ADVANCE_TIME',
  OUTSIDE_BUSINESS_HOURS = 'OUTSIDE_BUSINESS_HOURS',

  // Customer errors
  CUSTOMER_NOT_FOUND = 'CUSTOMER_NOT_FOUND',
  CUSTOMER_BLOCKED = 'CUSTOMER_BLOCKED',
  TIER_RESTRICTION = 'TIER_RESTRICTION',

  // Payment errors
  PAYMENT_REQUIRED = 'PAYMENT_REQUIRED',
  INSUFFICIENT_DEPOSIT = 'INSUFFICIENT_DEPOSIT',
  PROMO_CODE_INVALID = 'PROMO_CODE_INVALID',

  // System errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR'
}

// ============================================
// AVAILABILITY INTERFACES
// ============================================

/**
 * Availability check request
 */
export interface AvailabilityCheckRequest {
  locationId: string;
  spaceIds?: string[];
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  duration?: number; // minutes
  customerTierId?: string;
}

/**
 * Availability check response
 */
export interface AvailabilityResponse {
  available: boolean;
  slots: TimeSlot[];
  conflicts?: ConflictInfo[];
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  spaceIds: string[];
  price?: number;
  reason?: string; // If not available
}

export interface ConflictInfo {
  bookingId: string;
  spaceId: string;
  startTime: string;
  endTime: string;
  customerName?: string; // Only for staff
}

// ============================================
// CONFIGURATION INTERFACES
// ============================================

/**
 * Booking system configuration
 */
export interface BookingConfig {
  minDuration: number; // minutes
  maxDuration: number; // minutes
  incrementMinutes: number; // 15, 30, 60
  incrementAfterFirst?: number; // Different increment after first hour

  businessHours: {
    [key: string]: { // day of week (monday, tuesday, etc.)
      open: string; // HH:MM
      close: string; // HH:MM
      closed?: boolean;
    }
  };

  advanceBookingDays: {
    [key in CustomerTierType]: number;
  };

  cancellationPolicy: {
    hoursNotice: number;
    fee: number;
    allowedChanges: number;
  };

  pricing: {
    currency: string;
    taxRate: number;
    depositPercent: number;
  };
}

/**
 * Customer tier configuration
 */
export interface CustomerTier {
  id: string;
  name: string;
  color: string;
  hourlyRate: number;
  discountPercent: number;
  maxAdvanceDays: number;
  allowRecurring: boolean;
  requireDeposit: boolean;
  autoUpgradeAfter?: number; // Number of bookings
  perks?: string[];
}

// ============================================
// NOTIFICATION INTERFACES
// ============================================

/**
 * Booking notification data
 */
export interface BookingNotification {
  type: NotificationType;
  bookingId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  templateData: any;
  scheduledFor?: Date;
  priority: NotificationPriority;
}

export enum NotificationType {
  CONFIRMATION = 'confirmation',
  REMINDER = 'reminder',
  CANCELLATION = 'cancellation',
  MODIFICATION = 'modification',
  NO_SHOW = 'no_show',
  FEEDBACK = 'feedback'
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

// ============================================
// AUDIT INTERFACES
// ============================================

/**
 * Booking audit log entry
 */
export interface BookingAudit {
  id: string;
  bookingId: string;
  userId: string;
  action: AuditAction;
  oldValues?: any;
  newValues?: any;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  CANCEL = 'cancel',
  COMPLETE = 'complete',
  NO_SHOW = 'no_show',
  REFUND = 'refund',
  CHANGE_TIME = 'change_time',
  CHANGE_SPACE = 'change_space',
  ADD_NOTE = 'add_note'
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Partial booking update
 */
export type UpdateBookingRequest = Partial<
  Pick<DbBooking,
    'start_at' |
    'end_at' |
    'space_ids' |
    'status' |
    'admin_notes' |
    'customer_name' |
    'customer_email' |
    'customer_phone'
  >
>;

/**
 * Booking filter options for queries
 */
export interface BookingFilter {
  locationId?: string;
  spaceIds?: string[];
  customerId?: string;
  status?: BookingStatus[];
  startDate?: Date;
  endDate?: Date;
  customerTierId?: string;
  isAdminBlock?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: 'start_at' | 'created_at' | 'total_amount';
  orderDir?: 'ASC' | 'DESC';
}

/**
 * Booking statistics
 */
export interface BookingStats {
  totalBookings: number;
  totalRevenue: number;
  averageDuration: number;
  utilizationRate: number;
  popularTimes: Array<{ hour: number; count: number }>;
  popularSpaces: Array<{ spaceId: string; count: number }>;
  customerStats: {
    new: number;
    returning: number;
    noShows: number;
  };
}

// Export all types as a namespace for convenience
export type Booking = DbBooking;
export type CreateBooking = CreateBookingRequest;
export type UpdateBooking = UpdateBookingRequest;