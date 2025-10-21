import { http } from '@/api/http';
import logger from '@/services/logger';

export interface BookingConfig {
  // Time Settings
  minDuration: number;           // 60 minutes REQUIRED
  incrementAfterFirst: number;   // 30 minute increments after 1st hour
  maxDuration: number;           // 360 minutes (6 hours)
  gridInterval: number;          // 30 minutes display grid
  snapInterval: number;          // 30 minutes snap

  // Customer Tiers & Colors
  autoTierUpgrade: boolean;

  // Pricing & Deposits
  depositAmount: number;         // $10 deposit
  changeFee: number;            // $10 change fee after first
  dynamicPricing: boolean;

  // Door Access Buffers
  bufferBefore: number;          // 5 minutes before booking
  bufferAfter: number;           // 5 minutes after booking

  // Booking Rules
  allowCrossMidnight: boolean;   // Enable 11 PM - 2 AM bookings
  requireDeposit: boolean;       // Payment required
  cancellationWindow: number;    // Hours before booking
  allowMultiSimulator: boolean;  // Book multiple boxes at once

  // Smart Features
  upsellPrompts: {
    enabled: boolean;
    triggerMinutesBefore: number;
    triggerProbability: number;
    discountPercent?: number;
    messageTemplate: string;
  };
  loyaltyProgram: {
    freeAfterSessions: number;
    surpriseRewards: boolean;
    badges: boolean;
  };

  // Display Options
  showPricing: boolean;          // Show prices in UI
  showPhotos: boolean;          // Show space photos
  groupByLocation: boolean;      // Group view by location
  showNotices: boolean;         // Location-specific alerts
}

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

export interface BookingLocation {
  id: string;
  name: string;
  timezone: string;
  hours: {
    open: string;
    close: string;
  };
  address?: string;
  phone?: string;
  photo_url?: string;
  is_active: boolean;
  theme?: {
    primary: string;
    secondary?: string;
  };
}

export interface BookingSpace {
  id: string;
  location_id: string;
  name: string;
  description?: string;
  capacity: number;
  photo_url?: string;
  features?: string[];
  is_active: boolean;
  display_order: number;
}

class BookingConfigService {
  private static config: BookingConfig | null = null;
  private static tiers: CustomerTier[] | null = null;
  private static locations: BookingLocation[] | null = null;
  private static configPromise: Promise<BookingConfig> | null = null;

  /**
   * Get booking configuration
   */
  static async getConfig(): Promise<BookingConfig> {
    // Return cached config if available
    if (this.config) {
      return this.config;
    }

    // Return existing promise if already fetching
    if (this.configPromise) {
      return this.configPromise;
    }

    // Fetch config
    this.configPromise = http.get('/settings/booking_config')
      .then(response => {
        this.config = response.data.value || this.getDefaultConfig();
        this.configPromise = null;
        return this.config!;
      })
      .catch(error => {
        logger.error('Failed to load booking config:', error);
        this.config = this.getDefaultConfig();
        this.configPromise = null;
        return this.config!;
      });

    return this.configPromise;
  }

  /**
   * Update booking configuration (admin only)
   */
  static async updateConfig(updates: Partial<BookingConfig>): Promise<BookingConfig> {
    const response = await http.patch('/settings/booking_config', {
      value: { ...this.config, ...updates }
    });
    this.config = response.data.value;
    return this.config || this.getDefaultConfig();
  }

  /**
   * Get all customer tiers
   */
  static async getCustomerTiers(): Promise<CustomerTier[]> {
    if (this.tiers) {
      return this.tiers;
    }

    try {
      const response = await http.get('/bookings/customer-tiers');
      this.tiers = response.data.data;
      return this.tiers || [];
    } catch (error) {
      logger.error('Failed to load customer tiers:', error);
      return [];
    }
  }

  /**
   * Alias for getCustomerTiers for backward compatibility
   */
  static async getTiers(): Promise<CustomerTier[]> {
    return this.getCustomerTiers();
  }

  /**
   * Get all booking locations
   */
  static async getLocations(): Promise<BookingLocation[]> {
    if (this.locations) {
      return this.locations;
    }

    try {
      const response = await http.get('/bookings/locations');
      this.locations = response.data.data;
      return this.locations || [];
    } catch (error) {
      logger.error('Failed to load booking locations:', error);
      return [];
    }
  }

  /**
   * Get spaces for a location
   */
  static async getSpaces(locationId: string): Promise<BookingSpace[]> {
    try {
      const response = await http.get('/api/bookings/spaces', {
        params: { locationId }
      });
      return response.data.data;
    } catch (error) {
      logger.error('Failed to load booking spaces:', error);
      return [];
    }
  }

  /**
   * Clear cached data
   */
  static clearCache(): void {
    this.config = null;
    this.tiers = null;
    this.locations = null;
    this.configPromise = null;
  }

  /**
   * Get default configuration
   */
  private static getDefaultConfig(): BookingConfig {
    return {
      minDuration: 60,
      incrementAfterFirst: 30,
      maxDuration: 360,
      gridInterval: 30,
      snapInterval: 30,
      autoTierUpgrade: true,
      depositAmount: 10,
      changeFee: 10,
      dynamicPricing: true,
      bufferBefore: 5,
      bufferAfter: 5,
      allowCrossMidnight: true,
      requireDeposit: true,
      cancellationWindow: 24,
      allowMultiSimulator: true,
      upsellPrompts: {
        enabled: true,
        triggerMinutesBefore: 10,
        triggerProbability: 0.4,
        discountPercent: 20,
        messageTemplate: 'Enjoying your session? Extend for another hour at 20% off!'
      },
      loyaltyProgram: {
        freeAfterSessions: 10,
        surpriseRewards: true,
        badges: true
      },
      showPricing: true,
      showPhotos: true,
      groupByLocation: true,
      showNotices: true
    };
  }

  // Helper methods

  /**
   * Get minimum booking duration
   */
  static async getMinDuration(): Promise<number> {
    const config = await this.getConfig();
    return config.minDuration;
  }

  /**
   * Check if duration is valid
   */
  static async isValidDuration(minutes: number): Promise<boolean> {
    const config = await this.getConfig();

    // Check minimum
    if (minutes < config.minDuration) {
      return false;
    }

    // Check maximum
    if (minutes > config.maxDuration) {
      return false;
    }

    // Check increments after first hour
    if (minutes > 60) {
      const extraMinutes = minutes - 60;
      if (extraMinutes % config.incrementAfterFirst !== 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get valid duration options
   */
  static async getDurationOptions(): Promise<number[]> {
    const config = await this.getConfig();
    const options: number[] = [];

    // Start with minimum (usually 60 minutes)
    options.push(config.minDuration);

    // Add increments after first hour
    let current = config.minDuration + config.incrementAfterFirst;
    while (current <= config.maxDuration) {
      options.push(current);
      current += config.incrementAfterFirst;
    }

    return options;
  }

  /**
   * Format duration for display
   */
  static formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) {
      return `${mins} min`;
    } else if (mins === 0) {
      return hours === 1 ? '1 hour' : `${hours} hours`;
    } else {
      return `${hours}h ${mins}min`;
    }
  }

  /**
   * Calculate booking price
   */
  static calculatePrice(
    tier: CustomerTier,
    durationMinutes: number,
    promoDiscount: number = 0
  ): {
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
}

export default BookingConfigService;