import { db } from '../../utils/database';
import { logger } from '../../utils/logger';
import bookingConfigService from './bookingConfigService';
import { sendNotification } from '../notificationService';

export interface UpsellOffer {
  bookingId: string;
  userId: string;
  originalDuration: number;
  suggestedDuration: number;
  additionalCost: number;
  discountPercent?: number;
  expiresAt: Date;
  message: string;
  accepted?: boolean;
  respondedAt?: Date;
}

class SmartUpsellService {
  private static instance: SmartUpsellService;
  private activeUpsells: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {}

  public static getInstance(): SmartUpsellService {
    if (!SmartUpsellService.instance) {
      SmartUpsellService.instance = new SmartUpsellService();
    }
    return SmartUpsellService.instance;
  }

  /**
   * Schedule an upsell for a booking
   */
  async scheduleUpsell(bookingId: string): Promise<void> {
    try {
      const config = await bookingConfigService.getConfig();

      if (!config.upsellEnabled) {
        logger.info(`Upsell disabled by config for booking ${bookingId}`);
        return;
      }

      // Get booking details
      const bookingResult = await db.query(`
        SELECT
          b.*,
          u.name as user_name,
          u.email as user_email,
          u.phone as user_phone,
          ct.hourly_rate,
          ct.discount_percent
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        LEFT JOIN customer_tiers ct ON b.customer_tier_id = ct.id
        WHERE b.id = $1 AND b.status = 'confirmed'
      `, [bookingId]);

      if (bookingResult.rows.length === 0) {
        logger.warn(`Booking ${bookingId} not found or not confirmed`);
        return;
      }

      const booking = bookingResult.rows[0];
      const startTime = new Date(booking.start_at);
      const endTime = new Date(booking.end_at);
      const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);

      // Don't upsell if already at max duration
      if (durationMinutes >= 360) {
        logger.info(`Booking ${bookingId} already at max duration`);
        return;
      }

      // Calculate when to send the upsell (default: 10 minutes before end)
      const upsellTime = new Date(endTime);
      upsellTime.setMinutes(upsellTime.getMinutes() - (config.upsellTriggerMinutes || 10));

      // Only schedule if upsell time is in the future
      const now = new Date();
      if (upsellTime <= now) {
        logger.info(`Upsell time has passed for booking ${bookingId}`);
        return;
      }

      // Calculate delay until upsell time
      const delay = upsellTime.getTime() - now.getTime();

      // Schedule the upsell
      const timeout = setTimeout(() => {
        this.sendUpsellOffer(bookingId);
      }, delay);

      // Store timeout reference for cleanup
      this.activeUpsells.set(bookingId, timeout);

      logger.info(`Upsell scheduled for booking ${bookingId} at ${upsellTime.toISOString()}`);

      // Record that upsell is scheduled
      await db.query(
        'UPDATE bookings SET upsell_scheduled = true WHERE id = $1',
        [bookingId]
      );
    } catch (error) {
      logger.error(`Failed to schedule upsell for booking ${bookingId}:`, error);
    }
  }

  /**
   * Send upsell offer to customer
   */
  private async sendUpsellOffer(bookingId: string): Promise<void> {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Get current booking details
      const bookingResult = await client.query(`
        SELECT
          b.*,
          u.name as user_name,
          u.email as user_email,
          u.phone as user_phone,
          ct.hourly_rate,
          ct.discount_percent,
          bs.name as space_name
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        LEFT JOIN customer_tiers ct ON b.customer_tier_id = ct.id
        LEFT JOIN booking_spaces bs ON bs.id = ANY(b.space_ids)
        WHERE b.id = $1
      `, [bookingId]);

      if (bookingResult.rows.length === 0) {
        throw new Error(`Booking ${bookingId} not found`);
      }

      const booking = bookingResult.rows[0];

      // Check if already sent
      if (booking.upsell_sent) {
        logger.info(`Upsell already sent for booking ${bookingId}`);
        return;
      }

      // Apply random trigger rate
      const config = await bookingConfigService.getConfig();
      if (Math.random() > (config.upsellTriggerRate || 0.4)) {
        logger.info(`Upsell skipped by random rate for booking ${bookingId}`);
        return;
      }

      // Calculate current and suggested durations
      const startTime = new Date(booking.start_at);
      const endTime = new Date(booking.end_at);
      const currentDuration = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);

      // Suggest next increment (30 minutes more)
      const suggestedDuration = currentDuration + 30;
      const additionalMinutes = 30;

      // Check if new end time would be available
      const newEndTime = new Date(endTime);
      newEndTime.setMinutes(newEndTime.getMinutes() + additionalMinutes);

      // Check for conflicts
      const conflictResult = await client.query(`
        SELECT id FROM bookings
        WHERE location_id = $1
          AND $2 = ANY(space_ids)
          AND status IN ('confirmed', 'pending')
          AND id != $3
          AND (
            (start_at <= $4 AND end_at > $4) OR
            (start_at < $5 AND end_at >= $5) OR
            (start_at >= $4 AND end_at <= $5)
          )
      `, [
        booking.location_id,
        booking.space_ids[0],
        bookingId,
        endTime.toISOString(),
        newEndTime.toISOString()
      ]);

      if (conflictResult.rows.length > 0) {
        logger.info(`Cannot upsell booking ${bookingId} - time slot not available`);
        return;
      }

      // Calculate pricing
      const hourlyRate = booking.hourly_rate || 30;
      const additionalCost = (hourlyRate * additionalMinutes) / 60;

      // Apply special discount for upsell (10% off additional time)
      const upsellDiscount = 10;
      const discountedCost = additionalCost * (1 - upsellDiscount / 100);

      // Create upsell offer
      const offerResult = await client.query(`
        INSERT INTO booking_upsells (
          booking_id, user_id, original_duration, suggested_duration,
          additional_cost, discount_percent, expires_at, message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        bookingId,
        booking.user_id,
        currentDuration,
        suggestedDuration,
        discountedCost,
        upsellDiscount,
        new Date(Date.now() + 5 * 60000), // Expires in 5 minutes
        `Enjoying your session? Extend for just $${discountedCost.toFixed(2)} more! (10% off)`
      ]);

      const offerId = offerResult.rows[0].id;

      // Mark upsell as sent
      await client.query(
        'UPDATE bookings SET upsell_sent = true, upsell_sent_at = NOW() WHERE id = $1',
        [bookingId]
      );

      await client.query('COMMIT');

      // Send notification to user
      await sendNotification({
        userId: booking.user_id,
        type: 'booking_upsell',
        title: '⏰ Extend Your Session?',
        message: `Hi ${booking.user_name}! Enjoying ${booking.space_name}? Add 30 more minutes for just $${discountedCost.toFixed(2)} (10% off). Offer expires in 5 minutes!`,
        metadata: {
          bookingId,
          offerId,
          additionalMinutes,
          additionalCost: discountedCost,
          expiresAt: new Date(Date.now() + 5 * 60000).toISOString()
        }
      });

      logger.info(`Upsell offer sent for booking ${bookingId}`, {
        currentDuration,
        suggestedDuration,
        additionalCost: discountedCost
      });

      // Set timeout to expire the offer
      setTimeout(() => {
        this.expireUpsellOffer(offerId);
      }, 5 * 60000);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Failed to send upsell for booking ${bookingId}:`, error);
    } finally {
      client.release();
      // Clean up from active upsells
      this.activeUpsells.delete(bookingId);
    }
  }

  /**
   * Accept an upsell offer
   */
  async acceptUpsell(offerId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Get offer details
      const offerResult = await client.query(`
        SELECT * FROM booking_upsells
        WHERE id = $1 AND user_id = $2 AND accepted IS NULL
      `, [offerId, userId]);

      if (offerResult.rows.length === 0) {
        return {
          success: false,
          message: 'Offer not found or already processed'
        };
      }

      const offer = offerResult.rows[0];

      // Check if expired
      if (new Date() > new Date(offer.expires_at)) {
        return {
          success: false,
          message: 'This offer has expired'
        };
      }

      // Get booking details
      const bookingResult = await client.query(
        'SELECT * FROM bookings WHERE id = $1',
        [offer.booking_id]
      );

      const booking = bookingResult.rows[0];

      // Calculate new end time
      const newEndTime = new Date(booking.end_at);
      newEndTime.setMinutes(newEndTime.getMinutes() + 30);

      // Update booking
      await client.query(`
        UPDATE bookings
        SET
          end_at = $1,
          total_amount = total_amount + $2,
          upsell_accepted = true,
          updated_at = NOW()
        WHERE id = $3
      `, [newEndTime.toISOString(), offer.additional_cost, offer.booking_id]);

      // Update offer
      await client.query(`
        UPDATE booking_upsells
        SET accepted = true, responded_at = NOW()
        WHERE id = $1
      `, [offerId]);

      // Record transaction
      await client.query(`
        INSERT INTO transactions (
          user_id, booking_id, type, amount, description, status
        ) VALUES ($1, $2, 'upsell', $3, $4, 'completed')
      `, [
        userId,
        offer.booking_id,
        offer.additional_cost,
        `30-minute extension with ${offer.discount_percent}% discount`
      ]);

      await client.query('COMMIT');

      // Send confirmation
      await sendNotification({
        userId,
        type: 'booking_extended',
        title: '✅ Session Extended!',
        message: `Great! Your session has been extended by 30 minutes. New end time: ${newEndTime.toLocaleTimeString()}`,
        metadata: {
          bookingId: offer.booking_id,
          newEndTime: newEndTime.toISOString()
        }
      });

      logger.info(`Upsell accepted for booking ${offer.booking_id}`);

      return {
        success: true,
        message: 'Session successfully extended!'
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to accept upsell:', error);
      return {
        success: false,
        message: 'Failed to extend session. Please try again.'
      };
    } finally {
      client.release();
    }
  }

  /**
   * Decline an upsell offer
   */
  async declineUpsell(offerId: string, userId: string): Promise<void> {
    try {
      await db.query(`
        UPDATE booking_upsells
        SET accepted = false, responded_at = NOW()
        WHERE id = $1 AND user_id = $2
      `, [offerId, userId]);

      logger.info(`Upsell declined for offer ${offerId}`);
    } catch (error) {
      logger.error('Failed to decline upsell:', error);
    }
  }

  /**
   * Expire an upsell offer
   */
  private async expireUpsellOffer(offerId: string): Promise<void> {
    try {
      await db.query(`
        UPDATE booking_upsells
        SET accepted = false, responded_at = NOW()
        WHERE id = $1 AND accepted IS NULL
      `, [offerId]);

      logger.info(`Upsell offer ${offerId} expired`);
    } catch (error) {
      logger.error(`Failed to expire upsell offer ${offerId}:`, error);
    }
  }

  /**
   * Get upsell analytics
   */
  async getUpsellAnalytics(startDate?: Date, endDate?: Date): Promise<{
    totalOffers: number;
    acceptedOffers: number;
    declinedOffers: number;
    acceptanceRate: number;
    additionalRevenue: number;
    avgExtensionMinutes: number;
  }> {
    try {
      let query = `
        SELECT
          COUNT(*) as total_offers,
          COUNT(CASE WHEN accepted = true THEN 1 END) as accepted_offers,
          COUNT(CASE WHEN accepted = false THEN 1 END) as declined_offers,
          SUM(CASE WHEN accepted = true THEN additional_cost ELSE 0 END) as additional_revenue,
          AVG(CASE WHEN accepted = true THEN suggested_duration - original_duration ELSE NULL END) as avg_extension
        FROM booking_upsells
        WHERE 1=1
      `;

      const params: any[] = [];
      if (startDate) {
        params.push(startDate.toISOString());
        query += ` AND created_at >= $${params.length}`;
      }
      if (endDate) {
        params.push(endDate.toISOString());
        query += ` AND created_at <= $${params.length}`;
      }

      const result = await db.query(query, params);
      const stats = result.rows[0];

      const totalOffers = parseInt(stats.total_offers) || 0;
      const acceptedOffers = parseInt(stats.accepted_offers) || 0;
      const acceptanceRate = totalOffers > 0 ? (acceptedOffers / totalOffers) * 100 : 0;

      return {
        totalOffers,
        acceptedOffers,
        declinedOffers: parseInt(stats.declined_offers) || 0,
        acceptanceRate: Math.round(acceptanceRate * 100) / 100,
        additionalRevenue: parseFloat(stats.additional_revenue) || 0,
        avgExtensionMinutes: parseFloat(stats.avg_extension) || 0
      };
    } catch (error) {
      logger.error('Failed to get upsell analytics:', error);
      throw error;
    }
  }

  /**
   * Cancel scheduled upsell
   */
  cancelScheduledUpsell(bookingId: string): void {
    const timeout = this.activeUpsells.get(bookingId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeUpsells.delete(bookingId);
      logger.info(`Cancelled scheduled upsell for booking ${bookingId}`);
    }
  }
}

export default SmartUpsellService.getInstance();