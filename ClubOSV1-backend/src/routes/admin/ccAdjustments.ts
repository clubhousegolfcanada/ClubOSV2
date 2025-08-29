import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { roleGuard } from '../../middleware/roleGuard';
import { pool } from '../../utils/database';
import { logger } from '../../utils/logger';
import { clubCoinService } from '../../services/clubCoinService';

const router = Router();

// Only operators and admins can adjust CC
router.use(authenticate);
router.use(roleGuard(['admin', 'operator']));

/**
 * GET /api/admin/cc-adjustments/:userId/balance
 * Get a customer's current CC balance
 */
router.get('/:userId/balance', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verify the user is a customer
    const userResult = await pool.query(
      'SELECT id, email, name, role FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const user = userResult.rows[0];
    if (user.role !== 'customer') {
      return res.status(400).json({
        success: false,
        error: 'CC adjustments can only be made for customers'
      });
    }
    
    // Get current balance
    const balance = await clubCoinService.getBalance(userId);
    
    res.json({
      success: true,
      data: {
        userId: user.id,
        name: user.name,
        email: user.email,
        balance: balance.balance,
        totalEarned: balance.totalEarned,
        totalSpent: balance.totalSpent
      }
    });
  } catch (error) {
    logger.error('Error fetching CC balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch CC balance'
    });
  }
});

/**
 * POST /api/admin/cc-adjustments/:userId/adjust
 * Adjust a customer's CC balance
 */
router.post('/:userId/adjust', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { userId } = req.params;
    const { amount, type, reason } = req.body;
    const adminId = req.user?.id;
    
    // Validate input
    if (!amount || !type || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Amount, type, and reason are required'
      });
    }
    
    if (type !== 'credit' && type !== 'debit') {
      return res.status(400).json({
        success: false,
        error: 'Type must be either "credit" or "debit"'
      });
    }
    
    const adjustAmount = parseFloat(amount);
    if (isNaN(adjustAmount) || adjustAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a positive number'
      });
    }
    
    // Verify the user is a customer
    const userResult = await client.query(
      'SELECT id, email, name, role FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const user = userResult.rows[0];
    if (user.role !== 'customer') {
      return res.status(400).json({
        success: false,
        error: 'CC adjustments can only be made for customers'
      });
    }
    
    await client.query('BEGIN');
    
    // Get current balance
    const profileResult = await client.query(
      'SELECT cc_balance FROM customer_profiles WHERE user_id = $1',
      [userId]
    );
    
    if (profileResult.rows.length === 0) {
      // Create profile if doesn't exist
      await client.query(
        `INSERT INTO customer_profiles (user_id, cc_balance, total_cc_earned, rank_tier, total_challenges_won, total_challenges_played)
         VALUES ($1, 0, 0, 'house', 0, 0)`,
        [userId]
      );
    }
    
    const currentBalance = parseFloat(profileResult.rows[0]?.cc_balance || 0);
    
    // Check if debit would result in negative balance
    if (type === 'debit' && adjustAmount > currentBalance) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. Current balance: ${currentBalance} CC`
      });
    }
    
    // Calculate new balance
    const newBalance = type === 'credit' 
      ? currentBalance + adjustAmount 
      : currentBalance - adjustAmount;
    
    // Update balance AND total_cc_earned if it's a credit
    if (type === 'credit') {
      // When adding CC, also increase total_cc_earned
      await client.query(
        `UPDATE customer_profiles 
         SET cc_balance = $1,
             total_cc_earned = total_cc_earned + $2
         WHERE user_id = $3`,
        [newBalance, adjustAmount, userId]
      );
    } else {
      // When removing CC, only update balance (total_cc_earned stays the same)
      await client.query(
        'UPDATE customer_profiles SET cc_balance = $1 WHERE user_id = $2',
        [newBalance, userId]
      );
    }
    
    // Log the transaction
    await client.query(
      `INSERT INTO cc_transactions (
        user_id, type, amount, balance_before, balance_after,
        description, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [
        userId,
        type === 'credit' ? 'admin_credit' : 'admin_debit',
        type === 'credit' ? adjustAmount : -adjustAmount,
        currentBalance,
        newBalance,
        `Admin adjustment: ${reason}`,
        JSON.stringify({
          admin_id: adminId,
          admin_email: req.user?.email,
          reason: reason,
          type: type
        })
      ]
    );
    
    // Log admin action
    await client.query(
      `INSERT INTO admin_actions (
        admin_id, action_type, target_user_id, details, created_at
      ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [
        adminId,
        'cc_adjustment',
        userId,
        JSON.stringify({
          type: type,
          amount: adjustAmount,
          balance_before: currentBalance,
          balance_after: newBalance,
          reason: reason
        })
      ]
    );
    
    await client.query('COMMIT');
    
    logger.info(`CC adjustment made by ${req.user?.email}: ${type} ${adjustAmount} CC for user ${user.email}. Reason: ${reason}`);
    
    res.json({
      success: true,
      data: {
        userId: user.id,
        name: user.name,
        email: user.email,
        type: type,
        amount: adjustAmount,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        reason: reason,
        adjustedBy: req.user?.email,
        adjustedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error adjusting CC balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to adjust CC balance'
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/admin/cc-adjustments/:userId/history
 * Get CC adjustment history for a user
 */
router.get('/:userId/history', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const query = `
      SELECT 
        t.id,
        t.type,
        t.amount,
        t.balance_before,
        t.balance_after,
        t.description,
        t.metadata,
        t.created_at,
        u.name as user_name,
        u.email as user_email
      FROM cc_transactions t
      JOIN users u ON u.id = t.user_id
      WHERE t.user_id = $1
      AND t.type IN ('admin_credit', 'admin_debit')
      ORDER BY t.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [userId, limit, offset]);
    
    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        type: row.type.replace('admin_', ''),
        amount: Math.abs(parseFloat(row.amount)),
        balanceBefore: parseFloat(row.balance_before),
        balanceAfter: parseFloat(row.balance_after),
        description: row.description,
        adjustedBy: row.metadata?.admin_email || 'Unknown',
        reason: row.metadata?.reason || row.description,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    logger.error('Error fetching adjustment history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch adjustment history'
    });
  }
});

export default router;