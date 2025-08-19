import { Router } from 'express';
import { trackmanIntegrationService } from '../services/trackmanIntegrationService';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const router = Router();

/**
 * POST /api/trackman/webhook
 * Handle TrackMan webhook events
 */
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-trackman-signature'] as string;
    
    if (!signature) {
      return res.status(401).json({
        success: false,
        error: 'Missing signature'
      });
    }

    await trackmanIntegrationService.handleWebhook(req.body, signature);
    
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('TrackMan webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Webhook processing failed'
    });
  }
});

/**
 * POST /api/trackman/sync/:challengeId
 * Manually sync round data for a challenge
 */
router.post('/sync/:challengeId', async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { userId } = req.body;
    
    const success = await trackmanIntegrationService.syncRoundData(challengeId, userId);
    
    if (success) {
      res.json({
        success: true,
        message: 'Round data synced successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to sync round data'
      });
    }
  } catch (error) {
    logger.error('TrackMan sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Sync failed'
    });
  }
});

/**
 * GET /api/trackman/settings-catalog
 * Get available TrackMan course settings
 */
router.get('/settings-catalog', async (req, res) => {
  try {
    const catalog = await trackmanIntegrationService.getSettingsCatalog();
    
    res.json({
      success: true,
      data: catalog
    });
  } catch (error) {
    logger.error('Error fetching settings catalog:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings catalog'
    });
  }
});

/**
 * GET /api/trackman/verify/:roundId
 * Verify a specific round
 */
router.get('/verify/:roundId', async (req, res) => {
  try {
    const { roundId } = req.params;
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID required'
      });
    }
    
    const round = await trackmanIntegrationService.verifyRound(roundId, userId as string);
    
    if (round) {
      res.json({
        success: true,
        data: round
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Round not found or not verified'
      });
    }
  } catch (error) {
    logger.error('Error verifying round:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed'
    });
  }
});

export default router;