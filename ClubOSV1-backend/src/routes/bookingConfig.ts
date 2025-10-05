import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import bookingConfigService from '../services/booking/bookingConfigService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/settings/booking_config
 * Get all booking configuration
 */
router.get('/booking_config', authenticate, async (req, res) => {
  try {
    const config = await bookingConfigService.getConfig();

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Failed to get booking config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve booking configuration'
    });
  }
});

/**
 * GET /api/settings/booking_config/:key
 * Get specific configuration value
 */
router.get('/booking_config/:key', authenticate, async (req, res) => {
  try {
    const { key } = req.params;
    const value = await bookingConfigService.getValue(key);

    if (value === null) {
      return res.status(404).json({
        success: false,
        message: `Configuration key '${key}' not found`
      });
    }

    res.json({
      success: true,
      data: {
        key,
        value
      }
    });
  } catch (error) {
    logger.error('Failed to get config value:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve configuration value'
    });
  }
});

/**
 * PATCH /api/settings/booking_config
 * Update booking configuration (admin only)
 */
router.patch('/booking_config', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const updates = req.body;
    const userId = req.user?.id;

    // Validate updates
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    const updatedConfig = await bookingConfigService.updateConfig(updates, userId);

    logger.info('Booking config updated', {
      updatedBy: req.user?.email,
      updates
    });

    res.json({
      success: true,
      data: updatedConfig,
      message: 'Booking configuration updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update booking config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking configuration'
    });
  }
});

/**
 * POST /api/settings/booking_config/validate-duration
 * Validate a booking duration based on config
 */
router.post('/booking_config/validate-duration', authenticate, async (req, res) => {
  try {
    const { duration } = req.body;

    if (!duration || typeof duration !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Duration (in minutes) is required'
      });
    }

    const isValid = await bookingConfigService.isValidDuration(duration);
    const config = await bookingConfigService.getConfig();

    res.json({
      success: true,
      data: {
        isValid,
        minDuration: config.minDuration,
        maxDuration: config.maxDuration,
        incrementAfterFirstHour: config.incrementAfterFirstHour
      }
    });
  } catch (error) {
    logger.error('Failed to validate duration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate duration'
    });
  }
});

/**
 * POST /api/settings/booking_config/calculate-price
 * Calculate booking price based on tier and duration
 */
router.post('/booking_config/calculate-price', authenticate, async (req, res) => {
  try {
    const { tierId, durationMinutes, promoCode } = req.body;

    if (!tierId || !durationMinutes) {
      return res.status(400).json({
        success: false,
        message: 'tierId and durationMinutes are required'
      });
    }

    const pricing = await bookingConfigService.calculatePrice(
      tierId,
      durationMinutes,
      promoCode
    );

    res.json({
      success: true,
      data: pricing
    });
  } catch (error) {
    logger.error('Failed to calculate price:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate booking price'
    });
  }
});

/**
 * POST /api/settings/booking_config/reschedule-fee
 * Calculate reschedule fee for a booking
 */
router.post('/booking_config/reschedule-fee', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user!.id;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'bookingId is required'
      });
    }

    const fee = await bookingConfigService.getRescheduleFee(userId, bookingId);

    res.json({
      success: true,
      data: {
        fee,
        message: fee > 0 ? `A reschedule fee of $${fee} will be charged` : 'No reschedule fee'
      }
    });
  } catch (error) {
    logger.error('Failed to calculate reschedule fee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate reschedule fee'
    });
  }
});

/**
 * GET /api/settings/booking_config/reset
 * Reset configuration to defaults (admin only)
 */
router.get('/booking_config/reset', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    // Get default config
    const defaultConfig = {
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

    const updatedConfig = await bookingConfigService.updateConfig(
      defaultConfig,
      req.user?.id
    );

    logger.info('Booking config reset to defaults', {
      resetBy: req.user?.email
    });

    res.json({
      success: true,
      data: updatedConfig,
      message: 'Configuration reset to defaults successfully'
    });
  } catch (error) {
    logger.error('Failed to reset booking config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset configuration'
    });
  }
});

export default router;