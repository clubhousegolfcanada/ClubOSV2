import { db } from '../../utils/database';
import { logger } from '../../utils/logger';

export interface BookingConfig {
  // Time Rules
  minDuration: number;           // 60 minutes default
  maxDuration: number;           // 360 minutes default
  incrementAfterFirstHour: number; // 30 minutes
  allowCrossMidnight: boolean;   // Allow 11 PM - 2 AM bookings
  maxAdvanceDaysDefault: number; // 14 days for new customers

  // Pricing Rules
  depositRequired: boolean;
  depositAmount: number;
  freeRescheduleCount: number;   // 1 free change
  rescheduleFee: number;          // $10 after free change

  // Smart Features
  upsellEnabled: boolean;
  upsellTriggerMinutes: number;  // 10 minutes before end
  upsellTriggerRate: number;     // 0.40 (40% of sessions)
  loyaltyRewardThreshold: number; // 10 bookings for free hour
  autoTierUpgrade: boolean;

  // Display Options
  showPricing: boolean;
  showPhotos: boolean;
  groupByLocation: boolean;
  showNotices: boolean;
}

class BookingConfigService {
  private static instance: BookingConfigService;
  private configCache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): BookingConfigService {
    if (!BookingConfigService.instance) {
      BookingConfigService.instance = new BookingConfigService();
    }
    return BookingConfigService.instance;
  }

  /**
   * Get all booking configuration as a single object
   */
  async getConfig(): Promise<BookingConfig> {
    try {
      const configs = await db.query(
        'SELECT key, value FROM booking_config'
      );

      const config: any = {};

      for (const row of configs.rows) {
        const key = this.toCamelCase(row.key);

        // Parse JSON values and convert types
        let value = row.value;

        // Handle different value types
        if (typeof value === 'string') {
          // Try to parse as JSON first
          try {
            value = JSON.parse(value);
          } catch {
            // If not JSON, check if it's a number or boolean
            if (value === 'true') value = true;
            else if (value === 'false') value = false;
            else if (!isNaN(Number(value))) value = Number(value);
          }
        }

        config[key] = value;
      }

      return config as BookingConfig;
    } catch (error) {
      logger.error('Failed to get booking config:', error);

      // Return defaults if database fails
      return this.getDefaultConfig();
    }
  }

  /**
   * Get a single configuration value
   */
  async getValue(key: string): Promise<any> {
    // Check cache first
    if (this.isCached(key)) {
      return this.configCache.get(key);
    }

    try {
      const result = await db.query(
        'SELECT value FROM booking_config WHERE key = $1',
        [key]
      );

      if (result.rows.length > 0) {
        let value = result.rows[0].value;

        // Parse value
        if (typeof value === 'string') {
          try {
            value = JSON.parse(value);
          } catch {
            if (value === 'true') value = true;
            else if (value === 'false') value = false;
            else if (!isNaN(Number(value))) value = Number(value);
          }
        }

        // Cache the value
        this.setCache(key, value);
        return value;
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get config value for ${key}:`, error);
      return null;
    }
  }

  /**
   * Update configuration value
   */
  async updateConfig(updates: Partial<BookingConfig>, updatedBy?: string): Promise<BookingConfig> {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      for (const [key, value] of Object.entries(updates)) {
        const dbKey = this.toSnakeCase(key);

        // Convert value to string for storage
        let dbValue: string;
        if (typeof value === 'boolean') {
          dbValue = value.toString();
        } else if (typeof value === 'number') {
          dbValue = value.toString();
        } else if (typeof value === 'object') {
          dbValue = JSON.stringify(value);
        } else {
          dbValue = String(value);
        }

        await client.query(
          `INSERT INTO booking_config (key, value, updated_by, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (key) DO UPDATE
           SET value = $2, updated_by = $3, updated_at = NOW()`,
          [dbKey, dbValue, updatedBy]
        );

        // Clear cache for this key
        this.clearCache(dbKey);
      }

      await client.query('COMMIT');

      logger.info('Booking config updated', { updates, updatedBy });

      // Return updated config
      return this.getConfig();
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update booking config:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Validate booking duration based on config
   */
  async isValidDuration(minutes: number): Promise<boolean> {
    const config = await this.getConfig();

    if (minutes < config.minDuration || minutes > config.maxDuration) {
      return false;
    }

    // Check if duration follows increment rules
    if (minutes > 60) {
      const additionalMinutes = minutes - 60;
      if (additionalMinutes % config.incrementAfterFirstHour !== 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate booking price based on tier and duration
   */
  async calculatePrice(
    tierId: string,
    durationMinutes: number,
    promoCode?: string
  ): Promise<{
    baseRate: number;
    discount: number;
    deposit: number;
    total: number;
  }> {
    try {
      // Get tier pricing
      const tierResult = await db.query(
        'SELECT hourly_rate, discount_percent, deposit_amount FROM customer_tiers WHERE id = $1',
        [tierId]
      );

      if (tierResult.rows.length === 0) {
        throw new Error(`Invalid tier: ${tierId}`);
      }

      const tier = tierResult.rows[0];
      const hours = durationMinutes / 60;
      const baseRate = tier.hourly_rate * hours;

      let discount = (baseRate * (tier.discount_percent || 0)) / 100;

      // Apply promo code if provided
      if (promoCode) {
        const promoResult = await db.query(
          `SELECT discount_type, discount_value
           FROM promo_codes
           WHERE code = $1
           AND is_active = true
           AND (valid_until IS NULL OR valid_until > NOW())`,
          [promoCode]
        );

        if (promoResult.rows.length > 0) {
          const promo = promoResult.rows[0];
          if (promo.discount_type === 'percentage') {
            discount += (baseRate * promo.discount_value) / 100;
          } else if (promo.discount_type === 'fixed_amount') {
            discount += promo.discount_value;
          }
        }
      }

      const config = await this.getConfig();
      const deposit = config.depositRequired ? (tier.deposit_amount || config.depositAmount) : 0;
      const total = Math.max(0, baseRate - discount);

      return {
        baseRate,
        discount,
        deposit,
        total
      };
    } catch (error) {
      logger.error('Failed to calculate price:', error);
      throw error;
    }
  }

  /**
   * Check if a reschedule should incur a fee
   */
  async getRescheduleFee(userId: string, bookingId: string): Promise<number> {
    try {
      const config = await this.getConfig();

      // Get current booking's change count
      const result = await db.query(
        'SELECT change_count FROM bookings WHERE id = $1 AND user_id = $2',
        [bookingId, userId]
      );

      if (result.rows.length === 0) {
        return 0;
      }

      const changeCount = result.rows[0].change_count || 0;

      // First reschedule(s) are free based on config
      if (changeCount < config.freeRescheduleCount) {
        return 0;
      }

      return config.rescheduleFee;
    } catch (error) {
      logger.error('Failed to calculate reschedule fee:', error);
      return 0;
    }
  }

  /**
   * Check if upsell should be triggered for a booking
   */
  async shouldTriggerUpsell(bookingId: string): Promise<boolean> {
    try {
      const config = await this.getConfig();

      if (!config.upsellEnabled) {
        return false;
      }

      // Random trigger based on configured rate
      if (Math.random() > config.upsellTriggerRate) {
        return false;
      }

      // Check if upsell was already sent
      const result = await db.query(
        'SELECT upsell_sent FROM bookings WHERE id = $1',
        [bookingId]
      );

      if (result.rows.length === 0 || result.rows[0].upsell_sent) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Failed to check upsell trigger:', error);
      return false;
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): BookingConfig {
    return {
      minDuration: 60,
      maxDuration: 360,
      incrementAfterFirstHour: 30,
      allowCrossMidnight: true,
      maxAdvanceDaysDefault: 14,
      depositRequired: true,
      depositAmount: 10.00,
      freeRescheduleCount: 1,
      rescheduleFee: 10.00,
      upsellEnabled: true,
      upsellTriggerMinutes: 10,
      upsellTriggerRate: 0.40,
      loyaltyRewardThreshold: 10,
      autoTierUpgrade: true,
      showPricing: true,
      showPhotos: true,
      groupByLocation: true,
      showNotices: true
    };
  }

  /**
   * Cache helpers
   */
  private isCached(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    if (!expiry || expiry < Date.now()) {
      return false;
    }
    return this.configCache.has(key);
  }

  private setCache(key: string, value: any): void {
    this.configCache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  private clearCache(key?: string): void {
    if (key) {
      this.configCache.delete(key);
      this.cacheExpiry.delete(key);
    } else {
      this.configCache.clear();
      this.cacheExpiry.clear();
    }
  }

  /**
   * Convert snake_case to camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Convert camelCase to snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

export default BookingConfigService.getInstance();