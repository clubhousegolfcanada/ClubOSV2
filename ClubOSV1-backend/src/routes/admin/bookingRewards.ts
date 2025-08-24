import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { roleGuard } from '../../middleware/roleGuard';
import { db } from '../../utils/database';
import { logger } from '../../utils/logger';

const router = Router();

// Get pending rewards
router.get('/pending', authenticate, roleGuard(['admin', 'operator']), async (req, res) => {
  try {
    const pending = await db.query(`
      SELECT br.*, u.name, u.email
      FROM booking_rewards br
      JOIN users u ON u.id = br.user_id
      WHERE status = 'pending'
      ORDER BY reward_date ASC
    `);
    
    res.json({
      success: true,
      count: pending.rows.length,
      rewards: pending.rows
    });
  } catch (error) {
    logger.error('Failed to fetch pending rewards:', error);
    res.status(500).json({ error: 'Failed to fetch pending rewards' });
  }
});

// Get reward statistics
router.get('/stats', authenticate, roleGuard(['admin', 'operator']), async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(cc_awarded) as total_cc
      FROM booking_rewards
      GROUP BY status
    `);
    
    const totalByLocation = await db.query(`
      SELECT 
        location,
        COUNT(*) as count,
        SUM(cc_awarded) as total_cc
      FROM booking_rewards
      WHERE status = 'awarded'
      GROUP BY location
    `);
    
    res.json({
      success: true,
      byStatus: stats.rows,
      byLocation: totalByLocation.rows
    });
  } catch (error) {
    logger.error('Failed to fetch stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get recent rewards
router.get('/recent', authenticate, roleGuard(['admin', 'operator']), async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const recent = await db.query(`
      SELECT br.*, u.name, u.email
      FROM booking_rewards br
      JOIN users u ON u.id = br.user_id
      ORDER BY br.created_at DESC
      LIMIT $1
    `, [limit]);
    
    res.json({
      success: true,
      rewards: recent.rows
    });
  } catch (error) {
    logger.error('Failed to fetch recent rewards:', error);
    res.status(500).json({ error: 'Failed to fetch recent rewards' });
  }
});

// Manually trigger reward processing
router.post('/process', authenticate, roleGuard(['admin']), async (req, res) => {
  try {
    const { processBookingRewards } = require('../../jobs/bookingRewards');
    await processBookingRewards();
    res.json({ success: true, message: 'Processing triggered' });
  } catch (error) {
    logger.error('Failed to process rewards:', error);
    res.status(500).json({ error: 'Failed to process rewards' });
  }
});

// Manually award a reward (for testing or corrections)
router.post('/award/:id', authenticate, roleGuard(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the reward details
    const rewardResult = await db.query(
      'SELECT * FROM booking_rewards WHERE id = $1',
      [id]
    );
    
    if (rewardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Reward not found' });
    }
    
    const reward = rewardResult.rows[0];
    
    if (reward.status === 'awarded') {
      return res.status(400).json({ error: 'Reward already awarded' });
    }
    
    // Award the coins
    const { clubCoinService } = require('../../services/clubCoinService');
    await clubCoinService.credit({
      userId: reward.user_id,
      type: 'booking_reward' as any,
      amount: reward.cc_awarded,
      description: `Manual award - Booking reward for ${reward.location}`,
      metadata: { 
        hubspot_deal_id: reward.hubspot_deal_id,
        booking_date: reward.booking_date,
        manual_award: true,
        awarded_by: (req as any).userId
      }
    });
    
    // Update the reward status
    await db.query(`
      UPDATE booking_rewards 
      SET status = 'awarded', 
          awarded_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `, [id]);
    
    logger.info(`Manually awarded booking reward ${id} by user ${(req as any).userId}`);
    
    res.json({ success: true, message: 'Reward awarded successfully' });
  } catch (error) {
    logger.error('Failed to manually award reward:', error);
    res.status(500).json({ error: 'Failed to award reward' });
  }
});

// Cancel a pending reward
router.post('/cancel/:id', authenticate, roleGuard(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    await db.query(`
      UPDATE booking_rewards 
      SET status = 'cancelled',
          error_message = $2,
          updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
    `, [id, reason || 'Manually cancelled by admin']);
    
    logger.info(`Cancelled booking reward ${id} by user ${(req as any).userId}`);
    
    res.json({ success: true, message: 'Reward cancelled' });
  } catch (error) {
    logger.error('Failed to cancel reward:', error);
    res.status(500).json({ error: 'Failed to cancel reward' });
  }
});

export default router;