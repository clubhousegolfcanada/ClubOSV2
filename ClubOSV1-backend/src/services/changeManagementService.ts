import { db } from '../utils/database';
import { logger } from '../utils/logger';

export interface BookingChange {
  id: string;
  booking_id: string;
  user_id: string;
  change_type: 'reschedule' | 'cancel' | 'modify';
  previous_start_at?: Date;
  previous_end_at?: Date;
  new_start_at?: Date;
  new_end_at?: Date;
  fee_charged: number;
  reason?: string;
  created_at: Date;
}

export interface ChangeValidationResult {
  allowed: boolean;
  requiresFee: boolean;
  feeAmount: number;
  reason?: string;
  shouldFlag: boolean;
}

class ChangeManagementService {
  /**
   * Check if a booking change is allowed and calculate fees
   */
  async validateBookingChange(bookingId: string, userId: string): Promise<ChangeValidationResult> {
    try {
      // Get booking details with tier info
      const bookingResult = await db.query(`
        SELECT b.*, ct.change_limit, ct.change_fee
        FROM bookings b
        LEFT JOIN customer_tiers ct ON b.customer_tier_id = ct.id
        WHERE b.id = $1 AND b.user_id = $2
      `, [bookingId, userId]);

      if (bookingResult.rows.length === 0) {
        return {
          allowed: false,
          requiresFee: false,
          feeAmount: 0,
          reason: 'Booking not found or unauthorized',
          shouldFlag: false
        };
      }

      const booking = bookingResult.rows[0];
      const changeLimit = booking.change_limit || 1;
      const changeFee = booking.change_fee || 10;

      // Check if booking has already been flagged
      if (booking.flagged_for_changes && booking.change_count >= 2) {
        return {
          allowed: false,
          requiresFee: false,
          feeAmount: 0,
          reason: 'This booking has been flagged due to excessive changes. Please contact support.',
          shouldFlag: true
        };
      }

      // First change is free (if within limit)
      if (booking.change_count < changeLimit) {
        return {
          allowed: true,
          requiresFee: false,
          feeAmount: 0,
          shouldFlag: false
        };
      }

      // Second change requires fee
      if (booking.change_count === changeLimit) {
        return {
          allowed: true,
          requiresFee: true,
          feeAmount: changeFee,
          shouldFlag: false
        };
      }

      // Third+ changes are blocked and user is flagged
      return {
        allowed: false,
        requiresFee: false,
        feeAmount: 0,
        reason: 'Maximum number of changes exceeded. Please contact support for assistance.',
        shouldFlag: true
      };
    } catch (error) {
      logger.error('Failed to validate booking change:', error);
      return {
        allowed: false,
        requiresFee: false,
        feeAmount: 0,
        reason: 'Error validating change',
        shouldFlag: false
      };
    }
  }

  /**
   * Record a booking change
   */
  async recordBookingChange(
    bookingId: string,
    userId: string,
    changeType: 'reschedule' | 'cancel' | 'modify',
    changeDetails: {
      previousStartAt?: Date;
      previousEndAt?: Date;
      newStartAt?: Date;
      newEndAt?: Date;
      feeCharged?: number;
      reason?: string;
    }
  ): Promise<void> {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Insert change record
      await client.query(`
        INSERT INTO booking_changes (
          booking_id, user_id, change_type,
          previous_start_at, previous_end_at,
          new_start_at, new_end_at,
          fee_charged, reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        bookingId,
        userId,
        changeType,
        changeDetails.previousStartAt,
        changeDetails.previousEndAt,
        changeDetails.newStartAt,
        changeDetails.newEndAt,
        changeDetails.feeCharged || 0,
        changeDetails.reason
      ]);

      // Update booking change count and fee
      const updateResult = await client.query(`
        UPDATE bookings
        SET
          change_count = change_count + 1,
          change_fee_charged = change_fee_charged + $1,
          flagged_for_changes = CASE WHEN change_count >= 2 THEN true ELSE false END,
          updated_at = NOW()
        WHERE id = $2
        RETURNING change_count, flagged_for_changes
      `, [changeDetails.feeCharged || 0, bookingId]);

      const { change_count, flagged_for_changes } = updateResult.rows[0];

      await client.query('COMMIT');

      logger.info(`Booking change recorded`, {
        bookingId,
        userId,
        changeType,
        changeCount: change_count,
        flagged: flagged_for_changes
      });

      // If user is flagged, add CRM note
      if (flagged_for_changes) {
        await this.addCRMNote(bookingId, `User has been flagged for excessive changes (${change_count} total changes)`);
      }
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to record booking change:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get change history for a booking
   */
  async getChangeHistory(bookingId: string): Promise<BookingChange[]> {
    try {
      const result = await db.query(`
        SELECT bc.*, u.name as user_name
        FROM booking_changes bc
        LEFT JOIN users u ON bc.user_id = u.id
        WHERE bc.booking_id = $1
        ORDER BY bc.created_at DESC
      `, [bookingId]);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get change history:', error);
      return [];
    }
  }

  /**
   * Add CRM note to booking
   */
  async addCRMNote(bookingId: string, note: string): Promise<void> {
    try {
      await db.query(`
        UPDATE bookings
        SET
          crm_notes = COALESCE(crm_notes, '') || E'\n' || $1 || ' - ' || NOW()::text,
          updated_at = NOW()
        WHERE id = $2
      `, [note, bookingId]);

      logger.info(`CRM note added to booking ${bookingId}`);
    } catch (error) {
      logger.error('Failed to add CRM note:', error);
    }
  }

  /**
   * Get flagged users
   */
  async getFlaggedUsers(): Promise<any[]> {
    try {
      const result = await db.query(`
        SELECT DISTINCT
          u.id,
          u.name,
          u.email,
          COUNT(DISTINCT b.id) as flagged_bookings,
          SUM(b.change_count) as total_changes,
          SUM(b.change_fee_charged) as total_fees_charged
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        WHERE b.flagged_for_changes = true
        GROUP BY u.id, u.name, u.email
        ORDER BY total_changes DESC
      `);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get flagged users:', error);
      return [];
    }
  }

  /**
   * Check if user is flagged for excessive changes
   */
  async isUserFlagged(userId: string): Promise<boolean> {
    try {
      const result = await db.query(`
        SELECT COUNT(*) as flagged_count
        FROM bookings
        WHERE user_id = $1 AND flagged_for_changes = true
      `, [userId]);

      return result.rows[0].flagged_count > 0;
    } catch (error) {
      logger.error('Failed to check if user is flagged:', error);
      return false;
    }
  }

  /**
   * Override change restrictions (admin only)
   */
  async overrideChangeRestriction(bookingId: string, adminId: string, reason: string): Promise<void> {
    try {
      await db.query(`
        UPDATE bookings
        SET
          flagged_for_changes = false,
          admin_notes = COALESCE(admin_notes, '') || E'\n' ||
            'Change restriction overridden by admin: ' || $1 || ' - ' || NOW()::text,
          updated_at = NOW()
        WHERE id = $2
      `, [reason, bookingId]);

      logger.info(`Change restriction overridden for booking ${bookingId} by admin ${adminId}`);
    } catch (error) {
      logger.error('Failed to override change restriction:', error);
      throw error;
    }
  }
}

export const changeManagementService = new ChangeManagementService();