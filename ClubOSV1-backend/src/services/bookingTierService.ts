import { db, pool } from '../utils/database';
import { logger } from '../utils/logger';

export interface CustomerTier {
  id: string;
  name: string;
  color: string;
  hourly_rate: number;
  discount_percent?: number;
  max_advance_days: number;
  allow_recurring: boolean;
  require_deposit: boolean;
  change_limit: number;
  change_fee: number;
  auto_upgrade_after?: number;
}

export interface TierUpgradeResult {
  upgraded: boolean;
  previousTier: string;
  newTier: string;
  reason: string;
}

class BookingTierService {
  /**
   * Get customer tier for a user
   */
  async getUserTier(userId: string): Promise<CustomerTier> {
    try {
      const result = await db.query(`
        SELECT ct.*
        FROM users u
        LEFT JOIN customer_tiers ct ON u.customer_tier_id = ct.id
        WHERE u.id = $1
      `, [userId]);

      if (result.rows.length === 0 || !result.rows[0].id) {
        // Return default tier if user not found or no tier set
        return this.getDefaultTier();
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get user tier:', error);
      return this.getDefaultTier();
    }
  }

  /**
   * Get all available tiers
   */
  async getAllTiers(): Promise<CustomerTier[]> {
    try {
      const result = await db.query(`
        SELECT * FROM customer_tiers
        ORDER BY hourly_rate DESC
      `);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get all tiers:', error);
      return [];
    }
  }

  /**
   * Get default tier for new customers
   */
  async getDefaultTier(): Promise<CustomerTier> {
    try {
      const result = await db.query(`
        SELECT * FROM customer_tiers WHERE id = 'new' LIMIT 1
      `);

      if (result.rows.length === 0) {
        // Fallback if database is not set up
        return {
          id: 'new',
          name: 'New Customer',
          color: '#3B82F6',
          hourly_rate: 30,
          max_advance_days: 14,
          allow_recurring: false,
          require_deposit: true,
          change_limit: 1,
          change_fee: 10,
          auto_upgrade_after: 3
        };
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get default tier:', error);
      throw error;
    }
  }

  /**
   * Check if user should be auto-upgraded based on booking count
   */
  async checkAutoUpgrade(userId: string): Promise<TierUpgradeResult> {
    try {
      // Get user's current tier and booking count
      const userResult = await db.query(`
        SELECT u.customer_tier_id, u.total_bookings, ct.auto_upgrade_after
        FROM users u
        LEFT JOIN customer_tiers ct ON u.customer_tier_id = ct.id
        WHERE u.id = $1
      `, [userId]);

      if (userResult.rows.length === 0) {
        return { upgraded: false, previousTier: '', newTier: '', reason: 'User not found' };
      }

      const user = userResult.rows[0];

      // Check if auto-upgrade criteria is met
      if (user.customer_tier_id === 'new' &&
          user.auto_upgrade_after &&
          user.total_bookings >= user.auto_upgrade_after) {

        // Upgrade to Standard Member
        await this.upgradeUserTier(userId, 'member', 'auto_upgrade');

        return {
          upgraded: true,
          previousTier: 'new',
          newTier: 'member',
          reason: `Reached ${user.auto_upgrade_after} bookings`
        };
      }

      return { upgraded: false, previousTier: user.customer_tier_id, newTier: user.customer_tier_id, reason: 'No upgrade needed' };
    } catch (error) {
      logger.error('Failed to check auto upgrade:', error);
      return { upgraded: false, previousTier: '', newTier: '', reason: 'Error checking upgrade' };
    }
  }

  /**
   * Manually upgrade/downgrade user tier
   */
  async upgradeUserTier(userId: string, newTierId: string, reason: string = 'admin_override'): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get current tier
      const currentResult = await client.query(
        'SELECT customer_tier_id, total_bookings FROM users WHERE id = $1',
        [userId]
      );

      const currentTier = currentResult.rows[0]?.customer_tier_id || 'new';
      const bookingCount = currentResult.rows[0]?.total_bookings || 0;

      // Update user tier
      await client.query(
        'UPDATE users SET customer_tier_id = $1, updated_at = NOW() WHERE id = $2',
        [newTierId, userId]
      );

      // Record tier change history
      await client.query(`
        INSERT INTO customer_tier_history (
          user_id, previous_tier_id, new_tier_id, reason, booking_count
        ) VALUES ($1, $2, $3, $4, $5)
      `, [userId, currentTier, newTierId, reason, bookingCount]);

      await client.query('COMMIT');

      logger.info(`User ${userId} tier upgraded from ${currentTier} to ${newTierId}`, { reason });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to upgrade user tier:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Calculate booking price based on tier and duration
   */
  calculatePrice(tier: CustomerTier, durationMinutes: number, promoDiscount: number = 0): {
    basePrice: number;
    discountAmount: number;
    depositAmount: number;
    totalAmount: number;
  } {
    const hours = durationMinutes / 60;
    const basePrice = tier.hourly_rate * hours;

    // Apply tier discount if any
    let discountAmount = 0;
    if (tier.discount_percent) {
      discountAmount = basePrice * (tier.discount_percent / 100);
    }

    // Apply promo discount
    discountAmount += promoDiscount;

    const depositAmount = tier.require_deposit ? 10 : 0;
    const totalAmount = Math.max(0, basePrice - discountAmount);

    return {
      basePrice: Number(basePrice.toFixed(2)),
      discountAmount: Number(discountAmount.toFixed(2)),
      depositAmount: Number(depositAmount.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2))
    };
  }

  /**
   * Get tier by ID
   */
  async getTierById(tierId: string): Promise<CustomerTier | null> {
    try {
      const result = await db.query(
        'SELECT * FROM customer_tiers WHERE id = $1',
        [tierId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get tier by ID:', error);
      return null;
    }
  }
}

export const bookingTierService = new BookingTierService();