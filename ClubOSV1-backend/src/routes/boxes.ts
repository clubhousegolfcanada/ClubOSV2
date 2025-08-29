import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import db from '../utils/db';
import { AppError } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';

const pool = db.pool;

const router = Router();

// Reward configuration
const REWARDS = [
  { type: 'club_coins', name: '25 Club Coins', value: { amount: 25 }, weight: 18 },
  { type: 'club_coins', name: '50 Club Coins', value: { amount: 50 }, weight: 15 },
  { type: 'club_coins', name: '75 Club Coins', value: { amount: 75 }, weight: 12 },
  { type: 'club_coins', name: '100 Club Coins', value: { amount: 100 }, weight: 10 },
  { type: 'club_coins', name: '150 Club Coins', value: { amount: 150 }, weight: 8 },
  { type: 'club_coins', name: '200 Club Coins', value: { amount: 200 }, weight: 6 },
  { type: 'club_coins', name: '250 Club Coins', value: { amount: 250 }, weight: 4 },
  { type: 'club_coins', name: '300 Club Coins', value: { amount: 300 }, weight: 3 },
  { type: 'club_coins', name: '400 Club Coins', value: { amount: 400 }, weight: 2 },
  { type: 'club_coins', name: '500 Club Coins', value: { amount: 500 }, weight: 1.5 },
  { type: 'free_hour', name: 'Free Hour of Simulator Time', value: { hours: 1 }, weight: 30 },
  { type: 'merch', name: 'Clubhouse Merchandise', value: { item: 'T-Shirt' }, weight: 2 },
  { type: 'club_coins', name: '10,000 Club Coins MEGA JACKPOT!', value: { amount: 10000 }, weight: 0.5 }
];

// Helper function to select random reward based on weights
function selectRandomReward() {
  const totalWeight = REWARDS.reduce((sum, reward) => sum + reward.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const reward of REWARDS) {
    random -= reward.weight;
    if (random <= 0) {
      return reward;
    }
  }
  
  return REWARDS[0]; // Fallback
}

// Get user's box stats
router.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    
    // Get available boxes count
    const availableResult = await pool.query(
      'SELECT COUNT(*) as count FROM boxes WHERE user_id = $1 AND status = $2',
      [userId, 'available']
    );
    
    // Get box progress
    const progressResult = await pool.query(
      'SELECT current_progress, required_progress, total_boxes_earned FROM box_progress WHERE user_id = $1',
      [userId]
    );
    
    // Get recent rewards
    const rewardsResult = await pool.query(`
      SELECT br.*, b.opened_at 
      FROM box_rewards br
      JOIN boxes b ON br.box_id = b.id
      WHERE b.user_id = $1 AND b.status = 'opened'
      ORDER BY b.opened_at DESC
      LIMIT 5
    `, [userId]);
    
    const progress = progressResult.rows[0] || {
      current_progress: 0,
      required_progress: 5,
      total_boxes_earned: 0
    };
    
    res.json({
      availableCount: parseInt(availableResult.rows[0]?.count || '0'),
      progress: {
        current: progress.current_progress,
        required: progress.required_progress,
        percentage: Math.round((progress.current_progress / progress.required_progress) * 100)
      },
      totalEarned: progress.total_boxes_earned,
      recentRewards: rewardsResult.rows
    });
  } catch (error) {
    logger.error('Error fetching box stats:', error);
    next(error);
  }
});

// Get available boxes
router.get('/available', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    
    const result = await pool.query(
      `SELECT id, status, earned_at, expires_at 
       FROM boxes 
       WHERE user_id = $1 AND status = 'available' 
       ORDER BY earned_at DESC`,
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching available boxes:', error);
    next(error);
  }
});

// Get user's rewards history
router.get('/rewards', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    
    const result = await pool.query(`
      SELECT br.*, b.opened_at 
      FROM box_rewards br
      JOIN boxes b ON br.box_id = b.id
      WHERE b.user_id = $1
      ORDER BY b.opened_at DESC
      LIMIT 50
    `, [userId]);
    
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching rewards:', error);
    next(error);
  }
});

// Open a box
router.post('/:boxId/open', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { boxId } = req.params;
    
    // Start transaction
    await pool.query('BEGIN');
    
    try {
      // Verify box belongs to user and is available
      const boxResult = await pool.query(
        'SELECT * FROM boxes WHERE id = $1 AND user_id = $2 AND status = $3 FOR UPDATE',
        [boxId, userId, 'available']
      );
      
      if (boxResult.rows.length === 0) {
        await pool.query('ROLLBACK');
        throw new AppError('Box not found or already opened', 404, 'BOX_NOT_FOUND');
      }
      
      // Select random reward
      const reward = selectRandomReward();
      
      // Generate voucher code for certain rewards
      let voucherCode = null;
      if (reward.type === 'free_hour' || reward.type === 'merch') {
        voucherCode = `CH${Date.now().toString(36).toUpperCase()}`;
      }
      
      // Get catalog_id based on reward name (fallback to a default if not found)
      let catalogId = null;
      try {
        const catalogResult = await pool.query(
          'SELECT id FROM box_reward_catalog WHERE name = $1 LIMIT 1',
          [reward.name]
        );
        if (catalogResult.rows.length > 0) {
          catalogId = catalogResult.rows[0].id;
        } else {
          // Fallback to first catalog item if exact match not found
          const fallbackResult = await pool.query('SELECT id FROM box_reward_catalog LIMIT 1');
          catalogId = fallbackResult.rows[0]?.id;
        }
      } catch (e) {
        // If catalog table doesn't exist or is empty, use a placeholder UUID
        catalogId = 'd9f00f3a-e488-464e-a78e-151310d268cf'; // 25 Club Coins as default
      }
      
      // Create reward record with required columns
      const rewardResult = await pool.query(`
        INSERT INTO box_rewards (
          box_id, user_id, catalog_id, reward_type, reward_name, reward_value, voucher_code, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        boxId,
        userId,
        catalogId,
        reward.type,
        reward.name,
        JSON.stringify(reward.value),
        voucherCode,
        reward.type === 'free_hour' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null
      ]);
      
      // Update box status
      await pool.query(
        'UPDATE boxes SET status = $1, opened_at = $2, reward_type = $3, reward_value = $4 WHERE id = $5',
        ['opened', new Date(), reward.type, JSON.stringify(reward.value), boxId]
      );
      
      // If club coins, update user balance
      if (reward.type === 'club_coins') {
        const amount = reward.value.amount;
        
        // Get current balance before update
        const balanceResult = await pool.query(
          'SELECT cc_balance FROM customer_profiles WHERE user_id = $1',
          [userId]
        );
        const balanceBefore = balanceResult.rows[0]?.cc_balance || 0;
        const balanceAfter = balanceBefore + amount;
        
        // Update or create customer profile with CC balance
        await pool.query(`
          INSERT INTO customer_profiles (user_id, cc_balance, total_cc_earned)
          VALUES ($1, $2, $2)
          ON CONFLICT (user_id) 
          DO UPDATE SET 
            cc_balance = customer_profiles.cc_balance + $2,
            total_cc_earned = customer_profiles.total_cc_earned + $2,
            updated_at = CURRENT_TIMESTAMP
        `, [userId, amount]);
        
        // Log CC transaction with balance_before and balance_after
        await pool.query(`
          INSERT INTO cc_transactions (
            user_id, amount, type, balance_before, balance_after, description, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          userId,
          amount,
          'earned',
          balanceBefore,
          balanceAfter,
          `Box Reward: ${reward.name}`,
          JSON.stringify({ box_id: boxId, reward_type: reward.type })
        ]);
      }
      
      await pool.query('COMMIT');
      
      // Return the reward details
      res.json({
        success: true,
        data: {
          id: rewardResult.rows[0].id,
          rewardType: reward.type,
          rewardName: reward.name,
          rewardValue: reward.value,
          voucherCode: voucherCode,
          expiresAt: rewardResult.rows[0].expires_at
        }
      });
      
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    logger.error('Error opening box:', error);
    next(error);
  }
});

// Grant boxes to user (admin only)
router.post('/grant', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, quantity = 1 } = req.body;
    const adminUser = (req as any).user;
    
    // Check if admin
    if (adminUser.role !== 'admin' && adminUser.role !== 'operator') {
      throw new AppError('Unauthorized', 403, 'UNAUTHORIZED');
    }
    
    const boxes = [];
    for (let i = 0; i < quantity; i++) {
      const result = await pool.query(`
        INSERT INTO boxes (user_id, status)
        VALUES ($1, 'available')
        RETURNING *
      `, [userId]);
      boxes.push(result.rows[0]);
    }
    
    // Update total boxes earned
    await pool.query(`
      UPDATE box_progress 
      SET total_boxes_earned = total_boxes_earned + $1
      WHERE user_id = $2
    `, [quantity, userId]);
    
    res.json({
      success: true,
      message: `Granted ${quantity} box(es) to user`,
      data: boxes
    });
    
  } catch (error) {
    logger.error('Error granting boxes:', error);
    next(error);
  }
});

export default router;