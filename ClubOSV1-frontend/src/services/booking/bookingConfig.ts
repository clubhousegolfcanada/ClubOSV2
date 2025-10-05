import { http } from '@/api/http';
import logger from '@/services/logger';

// Customer tier interface
export interface CustomerTier {
  id: string;
  name: string;
  color: string;  // Hex color for calendar display
  hourlyRate: number;
  discountPercent?: number;
  maxAdvanceDays: number;
  allowRecurring: boolean;
  requireDeposit: boolean;
  autoUpgradeAfter?: number;
}

// Smart features interfaces
export interface UpsellConfig {
  enabled: boolean;
  triggerMinutesBefore: number;
  triggerProbability: number;
  discountPercent?: number;
  messageTemplate: string;
}

export interface LoyaltyConfig {
  enabled: boolean;
  freeAfterSessions: number;
  surpriseRewards: boolean;
  badges: boolean;
}

// Main booking configuration interface
export interface BookingConfig {
  // Time settings
  minDuration: number;           // 60 minutes minimum
  incrementAfterFirst: number;   // 30 minute increments after 1st hour
  maxDuration: number;           // 360 minutes (6 hours)
  gridInterval: number;          // 30 minutes display grid
  snapInterval: number;          // 30 minutes snap

  // Door access buffers
  bufferBefore: number;          // 5 minutes before booking
  bufferAfter: number;           // 5 minutes after booking

  // Booking rules
  allowCrossMidnight: boolean;   // Enable 11 PM - 2 AM bookings
  maxAdvanceBooking: number;     // Days in advance
  requireDeposit: boolean;       // Payment required
  depositAmount: number;         // $10 deposit
  changeFee: number;            // $10 change fee after first
  cancellationWindow: number;    // Hours before booking
  allowMultiSimulator: boolean;  // Book multiple boxes at once
  dynamicPricing: boolean;

  // Display options
  showPricing: boolean;          // Show prices in UI
  showPhotos: boolean;          // Show space photos
  groupByLocation: boolean;      // Group view by location
  showNotices: boolean;         // Location-specific alerts

  // Smart features
  upsellPrompts?: UpsellConfig;
  loyaltyProgram?: LoyaltyConfig;
}

// Default configuration
const DEFAULT_CONFIG: BookingConfig = {
  minDuration: 60,
  incrementAfterFirst: 30,
  maxDuration: 360,
  gridInterval: 30,
  snapInterval: 30,
  bufferBefore: 5,
  bufferAfter: 5,
  allowCrossMidnight: true,
  maxAdvanceBooking: 30,
  requireDeposit: true,
  depositAmount: 10,
  changeFee: 10,
  cancellationWindow: 24,
  allowMultiSimulator: true,
  dynamicPricing: true,
  showPricing: true,
  showPhotos: true,
  groupByLocation: false,
  showNotices: true,
  upsellPrompts: {
    enabled: true,
    triggerMinutesBefore: 10,
    triggerProbability: 0.4,
    discountPercent: 20,
    messageTemplate: 'Having fun? Extend your session for 20% off!'
  },
  loyaltyProgram: {
    enabled: true,
    freeAfterSessions: 10,
    surpriseRewards: true,
    badges: true
  }
};

/**
 * Service for managing booking configuration
 */
export class BookingConfigService {
  private static config: BookingConfig | null = null;
  private static customerTiers: CustomerTier[] | null = null;

  /**
   * Get the current booking configuration
   */
  static async getConfig(): Promise<BookingConfig> {
    if (!this.config) {
      try {
        const { data } = await http.get('/api/settings/booking_config');
        this.config = { ...DEFAULT_CONFIG, ...(data.value || {}) };
      } catch (error) {
        logger.error('Failed to load booking config, using defaults:', error);
        this.config = DEFAULT_CONFIG;
      }
    }
    return this.config || this.getDefaultConfig();
  }

  /**
   * Update booking configuration (admin only)
   */
  static async updateConfig(updates: Partial<BookingConfig>): Promise<BookingConfig> {
    try {
      const { data } = await http.patch('/api/settings/booking_config', {
        value: updates
      });
      this.config = { ...DEFAULT_CONFIG, ...(data.value || {}) };
      return this.config || this.getDefaultConfig();
    } catch (error) {
      logger.error('Failed to update booking config:', error);
      throw error;
    }
  }

  /**
   * Get customer tiers with colors
   */
  static async getCustomerTiers(): Promise<CustomerTier[]> {
    if (!this.customerTiers) {
      try {
        const { data } = await http.get('/api/bookings/customer-tiers');
        this.customerTiers = data.data || [];
      } catch (error) {
        logger.error('Failed to load customer tiers:', error);
        this.customerTiers = [];
      }
    }
    return this.customerTiers || [];
  }

  /**
   * Reset cached configuration
   */
  static resetCache(): void {
    this.config = null;
    this.customerTiers = null;
  }

  /**
   * Helper methods for common configuration checks
   */
  static getMinDuration(): number {
    return this.config?.minDuration || 60;
  }

  static isValidDuration(minutes: number): boolean {
    const config = this.config || DEFAULT_CONFIG;

    // Must meet minimum duration
    if (minutes < config.minDuration) {
      return false;
    }

    // Must not exceed maximum
    if (minutes > config.maxDuration) {
      return false;
    }

    // After first hour, must be in 30-minute increments
    if (minutes > 60) {
      const additionalMinutes = minutes - 60;
      if (additionalMinutes % config.incrementAfterFirst !== 0) {
        return false;
      }
    }

    return true;
  }

  static getDurationOptions(): number[] {
    const config = this.config || DEFAULT_CONFIG;
    const options: number[] = [config.minDuration];

    // Add increments after first hour
    let current = config.minDuration + config.incrementAfterFirst;
    while (current <= config.maxDuration) {
      options.push(current);
      current += config.incrementAfterFirst;
    }

    return options;
  }

  static formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) {
      return `${mins} min`;
    } else if (mins === 0) {
      return `${hours} hr`;
    } else {
      return `${hours} hr ${mins} min`;
    }
  }

  static getTierColor(tierId: string): string {
    const tier = this.customerTiers?.find(t => t.id === tierId);
    return tier?.color || '#6B7280'; // Default gray
  }
}