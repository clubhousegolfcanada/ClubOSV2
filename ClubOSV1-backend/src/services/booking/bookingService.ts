import { db, pool } from '../../utils/database';
import { logger } from '../../utils/logger';

interface BookingData {
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
  maintenanceType?: 'cleaning' | 'repair' | 'inspection' | 'other';
  recurringPattern?: {
    frequency?: 'daily' | 'weekly' | 'monthly';
    interval?: number;
    endDate?: string;
    daysOfWeek?: number[];
  } | null;
  eventName?: string;
  expectedAttendees?: number;
  requiresDeposit?: boolean;
  photoUrls?: string[];
}

export class BookingService {
  /**
   * Create a booking with full transaction support
   * This prevents double bookings and ensures data consistency
   */
  static async createBookingWithTransaction(bookingData: BookingData) {
    const client = await pool.connect();

    try {
      // START TRANSACTION - All operations must succeed or all rollback
      await client.query('BEGIN');
      logger.info('Starting booking transaction for location:', bookingData.locationId);

      // Step 1: Lock the time slot for checking (SELECT FOR UPDATE)
      // This prevents other transactions from reading these rows until we commit/rollback
      const conflictCheck = await client.query(
        `SELECT id, customer_name, start_at, end_at
         FROM bookings
         WHERE location_id = $1
         AND status IN ('confirmed', 'pending')
         AND tstzrange(start_at, end_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
         FOR UPDATE`,
        [bookingData.locationId, bookingData.startAt, bookingData.endAt]
      );

      if (conflictCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        logger.warn('Booking conflict detected:', conflictCheck.rows[0]);
        return {
          success: false,
          error: 'This time slot has just been booked by another customer. Please select a different time.',
          errorCode: 'TIME_CONFLICT',
          conflictingBookings: conflictCheck.rows
        };
      }

      // Step 2: Check space-specific conflicts for multi-simulator bookings
      // First check if the function exists
      const functionCheck = await client.query(
        `SELECT EXISTS (
          SELECT 1 FROM pg_proc WHERE proname = 'check_space_availability'
        ) as function_exists`
      );

      let spaceConflictCheck = { rows: [] };

      if (functionCheck.rows[0].function_exists) {
        // Use the database function to check all spaces at once
        spaceConflictCheck = await client.query(
          `SELECT * FROM check_space_availability($1, $2, $3, $4)`,
          [bookingData.locationId, bookingData.spaceIds, bookingData.startAt, bookingData.endAt]
        );
      } else {
        // Fallback: Do a manual check if function doesn't exist
        logger.warn('check_space_availability function not found, using fallback query');
        spaceConflictCheck = await client.query(
          `SELECT
            UNNEST(space_ids) AS conflicting_space_id,
            id AS conflicting_booking_id,
            start_at AS conflict_start,
            end_at AS conflict_end
          FROM bookings
          WHERE location_id = $1
            AND status IN ('confirmed', 'pending')
            AND space_ids && $2
            AND tstzrange(start_at, end_at, '[)') && tstzrange($3::timestamptz, $4::timestamptz, '[)')
          LIMIT 1`,
          [bookingData.locationId, bookingData.spaceIds, bookingData.startAt, bookingData.endAt]
        );
      }

      if (spaceConflictCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        const conflictingSpaces = spaceConflictCheck.rows.map(r => r.conflicting_space_id).join(', ');
        logger.warn('Space conflict detected for spaces:', conflictingSpaces);
        return {
          success: false,
          error: `The following spaces are no longer available: ${conflictingSpaces}. Please select different simulators.`,
          errorCode: 'SPACE_CONFLICT',
          conflictingSpaces: spaceConflictCheck.rows
        };
      }

      // Step 3: Prepare admin notes with event/class metadata
      let adminNotesData: any = {};

      // Include original admin notes if provided
      if (bookingData.adminNotes) {
        adminNotesData.notes = bookingData.adminNotes;
      }

      // Add event/class specific data
      if (bookingData.eventName) {
        adminNotesData.eventName = bookingData.eventName;
        adminNotesData.bookingType = 'event';
      }
      if (bookingData.expectedAttendees) {
        adminNotesData.expectedAttendees = bookingData.expectedAttendees;
      }
      if (bookingData.requiresDeposit) {
        adminNotesData.requiresDeposit = bookingData.requiresDeposit;
      }
      if (bookingData.maintenanceType) {
        adminNotesData.maintenanceType = bookingData.maintenanceType;
        adminNotesData.bookingType = 'maintenance';
      }
      if (bookingData.recurringPattern) {
        adminNotesData.recurringPattern = bookingData.recurringPattern;
      }
      if (bookingData.photoUrls && bookingData.photoUrls.length > 0) {
        adminNotesData.photoUrls = bookingData.photoUrls;
      }
      if (bookingData.customPrice) {
        adminNotesData.customPrice = bookingData.customPrice;
      }

      // Convert to JSON string for storage
      const adminNotesJson = Object.keys(adminNotesData).length > 0
        ? JSON.stringify(adminNotesData)
        : bookingData.adminNotes || null;

      // Step 4: Check which columns exist in the database (defensive for production)
      const checkColumns = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'bookings'
      `);

      const existingColumns = new Set(checkColumns.rows.map(row => row.column_name));

      // Build INSERT query dynamically based on existing columns
      const columns = ['location_id', 'space_ids', 'user_id'];
      const values = [bookingData.locationId, bookingData.spaceIds, bookingData.userId || bookingData.customerId || null];
      let paramIndex = 4;

      // Add optional columns only if they exist
      if (existingColumns.has('customer_tier_id')) {
        columns.push('customer_tier_id');
        values.push(bookingData.customerTierId);
        paramIndex++;
      }

      columns.push('customer_name', 'customer_email', 'customer_phone', 'start_at', 'end_at');
      values.push(
        bookingData.customerName || null,
        bookingData.customerEmail || null,
        bookingData.customerPhone || null,
        bookingData.startAt,
        bookingData.endAt
      );
      paramIndex += 5;

      if (existingColumns.has('base_rate')) {
        columns.push('base_rate');
        values.push(bookingData.baseRate as any);
        paramIndex++;
      }

      columns.push('total_amount');
      values.push(bookingData.totalAmount as any);
      paramIndex++;

      columns.push('promo_code');
      values.push(bookingData.promoCode || null);
      paramIndex++;

      if (existingColumns.has('admin_notes')) {
        columns.push('admin_notes');
        values.push(adminNotesJson);
        paramIndex++;
      }

      if (existingColumns.has('is_admin_block')) {
        columns.push('is_admin_block');
        values.push((bookingData.isAdminBlock || false) as any);
        paramIndex++;
      }

      if (existingColumns.has('block_reason')) {
        columns.push('block_reason');
        values.push(bookingData.blockReason || null);
        paramIndex++;
      }

      columns.push('status', 'created_at');
      values.push(bookingData.isAdminBlock ? 'confirmed' : 'pending');

      // Build the query string
      const columnList = columns.join(', ');
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

      const bookingResult = await client.query(
        `INSERT INTO bookings (${columnList})
         VALUES (${placeholders}, NOW())
         RETURNING *`,
        values
      );

      const newBooking = bookingResult.rows[0];
      logger.info('Booking created successfully:', newBooking.id);

      // Step 5: Update loyalty tracking (if applicable)
      if (!bookingData.isAdminBlock && bookingData.userId) {
        const loyaltyResult = await client.query(
          `INSERT INTO loyalty_tracking (user_id, total_bookings, current_tier_id)
           VALUES ($1, 1, $2)
           ON CONFLICT (user_id)
           DO UPDATE SET
             total_bookings = loyalty_tracking.total_bookings + 1,
             points_balance = loyalty_tracking.points_balance + 10,
             updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [bookingData.userId, bookingData.customerTierId]
        );

        // Check for auto tier upgrade
        const loyaltyData = loyaltyResult.rows[0];
        if (loyaltyData) {
          // Check if eligible for tier upgrade
          const tierCheck = await client.query(
            `SELECT ct.id as current_tier, ct.auto_upgrade_after,
                    (SELECT id FROM customer_tiers WHERE auto_upgrade_after <= $2
                     ORDER BY auto_upgrade_after DESC LIMIT 1) as eligible_tier
             FROM customer_tiers ct
             WHERE ct.id = $1`,
            [loyaltyData.current_tier_id, loyaltyData.total_bookings]
          );

          if (tierCheck.rows[0]?.eligible_tier &&
              tierCheck.rows[0].eligible_tier !== tierCheck.rows[0].current_tier) {
            // Upgrade tier
            await client.query(
              `UPDATE loyalty_tracking
               SET current_tier_id = $2, last_tier_upgrade = CURRENT_TIMESTAMP
               WHERE user_id = $1`,
              [bookingData.userId, tierCheck.rows[0].eligible_tier]
            );

            // Log tier upgrade in history
            await client.query(
              `INSERT INTO customer_tier_history (user_id, old_tier_id, new_tier_id, change_reason)
               VALUES ($1, $2, $3, $4)`,
              [
                bookingData.userId,
                tierCheck.rows[0].current_tier,
                tierCheck.rows[0].eligible_tier,
                `Auto-upgrade after ${loyaltyData.total_bookings} bookings`
              ]
            );

            logger.info('Customer tier upgraded:', {
              userId: bookingData.userId,
              from: tierCheck.rows[0].current_tier,
              to: tierCheck.rows[0].eligible_tier
            });
          }

          // Check for loyalty rewards (free hour after 10 bookings)
          if (loyaltyData.total_bookings % 10 === 0) {
            await client.query(
              `INSERT INTO loyalty_rewards (user_id, reward_type, reward_value, expires_at)
               VALUES ($1, 'free_hour', 60, NOW() + INTERVAL '30 days')`,
              [bookingData.userId]
            );
            logger.info('Loyalty reward granted for user:', bookingData.userId);
          }
        }
      }

      // Step 5: Process promo code usage (if applicable)
      if (bookingData.promoCode) {
        const promoResult = await client.query(
          `UPDATE promo_codes
           SET use_count = use_count + 1,
               last_used = NOW(),
               last_used_by = $2
           WHERE code = $1
           AND is_active = true
           AND (max_uses IS NULL OR use_count < max_uses)
           AND (valid_until IS NULL OR valid_until > NOW())
           RETURNING *`,
          [bookingData.promoCode, bookingData.userId]
        );

        if (promoResult.rows.length === 0) {
          // Promo code was invalid or exhausted - rollback
          await client.query('ROLLBACK');
          return {
            success: false,
            error: 'Promo code is no longer valid or has reached its usage limit.',
            errorCode: 'INVALID_PROMO'
          };
        }

        // Track promo code usage
        await client.query(
          `INSERT INTO promo_code_usage (promo_code_id, user_id, booking_id, used_at)
           VALUES ((SELECT id FROM promo_codes WHERE code = $1), $2, $3, NOW())`,
          [bookingData.promoCode, bookingData.userId, newBooking.id]
        );
      }

      // Step 6: Create transaction record for payment tracking
      await client.query(
        `INSERT INTO transactions (
          booking_id, user_id, amount, type, status, payment_method
        ) VALUES ($1, $2, $3, 'booking', 'pending', 'pending')`,
        [newBooking.id, bookingData.userId, bookingData.totalAmount]
      );

      // COMMIT TRANSACTION - All operations succeeded!
      await client.query('COMMIT');
      logger.info('Booking transaction committed successfully:', newBooking.id);

      return {
        success: true,
        data: newBooking
      };

    } catch (error: any) {
      // ROLLBACK on any error
      await client.query('ROLLBACK');
      logger.error('Booking transaction failed:', error);

      // Check for specific PostgreSQL error codes
      if (error.code === '23P01') {
        // Exclusion constraint violation
        return {
          success: false,
          error: 'This time slot was just booked. Please refresh and select another time.',
          errorCode: 'BOOKING_CONFLICT'
        };
      } else if (error.code === '23505') {
        // Unique constraint violation
        return {
          success: false,
          error: 'A booking already exists for this time. Please choose a different slot.',
          errorCode: 'DUPLICATE_BOOKING'
        };
      } else if (error.code === '40001') {
        // Serialization failure - concurrent update
        return {
          success: false,
          error: 'Another booking is being processed. Please try again.',
          errorCode: 'CONCURRENT_UPDATE'
        };
      }

      // Generic error
      throw error;
    } finally {
      // Always release the client back to the pool
      client.release();
    }
  }

  /**
   * Cancel a booking with proper transaction handling
   */
  static async cancelBookingWithTransaction(bookingId: string, userId: string, reason?: string) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Lock the booking for update
      const booking = await client.query(
        `SELECT * FROM bookings WHERE id = $1 FOR UPDATE`,
        [bookingId]
      );

      if (!booking.rows[0]) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Booking not found', errorCode: 'NOT_FOUND' };
      }

      if (booking.rows[0].status === 'cancelled') {
        await client.query('ROLLBACK');
        return { success: false, error: 'Booking is already cancelled', errorCode: 'ALREADY_CANCELLED' };
      }

      // Update booking status
      await client.query(
        `UPDATE bookings
         SET status = 'cancelled',
             cancelled_at = NOW(),
             cancelled_by = $2,
             cancellation_reason = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [bookingId, userId, reason]
      );

      // Restore promo code usage if applicable
      if (booking.rows[0].promo_code) {
        await client.query(
          `UPDATE promo_codes
           SET use_count = GREATEST(0, use_count - 1)
           WHERE code = $1`,
          [booking.rows[0].promo_code]
        );

        // Mark promo code usage as cancelled
        await client.query(
          `UPDATE promo_code_usage
           SET cancelled_at = NOW()
           WHERE booking_id = $1`,
          [bookingId]
        );
      }

      // Update transaction status
      await client.query(
        `UPDATE transactions
         SET status = 'cancelled', updated_at = NOW()
         WHERE booking_id = $1`,
        [bookingId]
      );

      // Log the cancellation
      await client.query(
        `INSERT INTO booking_changes (
          booking_id, user_id, change_type, old_value, new_value, change_reason
        ) VALUES ($1, $2, 'cancellation', $3, 'cancelled', $4)`,
        [bookingId, userId, booking.rows[0].status, reason]
      );

      await client.query('COMMIT');
      logger.info('Booking cancelled successfully:', bookingId);

      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Cancel booking transaction failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reschedule a booking with conflict checking
   */
  static async rescheduleBookingWithTransaction(
    bookingId: string,
    newStartAt: string,
    newEndAt: string,
    userId: string
  ) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get current booking with lock
      const currentBooking = await client.query(
        `SELECT * FROM bookings WHERE id = $1 FOR UPDATE`,
        [bookingId]
      );

      if (!currentBooking.rows[0]) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Booking not found', errorCode: 'NOT_FOUND' };
      }

      const booking = currentBooking.rows[0];

      // Check for conflicts at new time
      const conflictCheck = await client.query(
        `SELECT id FROM bookings
         WHERE location_id = $1
         AND id != $2
         AND status IN ('confirmed', 'pending')
         AND tstzrange(start_at, end_at, '[)') && tstzrange($3::timestamptz, $4::timestamptz, '[)')
         FOR UPDATE`,
        [booking.location_id, bookingId, newStartAt, newEndAt]
      );

      if (conflictCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'The new time slot is not available. Please select a different time.',
          errorCode: 'TIME_CONFLICT'
        };
      }

      // Update the booking
      const updateResult = await client.query(
        `UPDATE bookings
         SET start_at = $2,
             end_at = $3,
             change_count = change_count + 1,
             last_changed_at = NOW(),
             last_changed_by = $4,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [bookingId, newStartAt, newEndAt, userId]
      );

      // Log the change
      await client.query(
        `INSERT INTO booking_changes (
          booking_id, user_id, change_type,
          old_value, new_value, change_reason
        ) VALUES ($1, $2, 'reschedule', $3, $4, 'Customer requested')`,
        [
          bookingId,
          userId,
          JSON.stringify({ start: booking.start_at, end: booking.end_at }),
          JSON.stringify({ start: newStartAt, end: newEndAt })
        ]
      );

      await client.query('COMMIT');
      logger.info('Booking rescheduled successfully:', bookingId);

      return {
        success: true,
        data: updateResult.rows[0]
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Reschedule booking transaction failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}