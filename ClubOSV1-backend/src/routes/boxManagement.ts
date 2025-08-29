import { Router, Request, Response } from 'express';
import { pool } from '../utils/db';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get user's boxes (for admin/operator)
router.get('/user/:userId', authenticate, authorize(['admin', 'operator']), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(
      `SELECT 
        id,
        status,
        created_at,
        opened_at,
        expires_at,
        reward_type,
        reward_value
      FROM boxes 
      WHERE user_id = $1
      ORDER BY created_at DESC`,
      [userId]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching user boxes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user boxes'
    });
  }
});

// Grant boxes to user
router.post('/grant', authenticate, authorize(['admin', 'operator']), async (req: Request, res: Response) => {
  try {
    const { userId, count = 3 } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    if (count < 1 || count > 20) {
      return res.status(400).json({
        success: false,
        message: 'Count must be between 1 and 20'
      });
    }
    
    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Create boxes
    const boxes = [];
    for (let i = 0; i < count; i++) {
      boxes.push({
        id: uuidv4(),
        userId,
        status: 'available',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      });
    }
    
    // Insert boxes
    const insertQuery = `
      INSERT INTO boxes (id, user_id, status, expires_at, created_at, updated_at)
      VALUES ${boxes.map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, NOW(), NOW())`).join(', ')}
    `;
    
    const insertValues = boxes.flatMap(box => [
      box.id,
      box.userId,
      box.status,
      box.expiresAt
    ]);
    
    await pool.query(insertQuery, insertValues);
    
    // Log the action
    logger.info('Boxes granted to user', {
      userId,
      count,
      grantedBy: req.user?.id,
      grantedByEmail: req.user?.email
    });
    
    res.json({
      success: true,
      message: `Successfully granted ${count} box${count > 1 ? 'es' : ''} to user`,
      data: {
        count,
        userId
      }
    });
  } catch (error) {
    logger.error('Error granting boxes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to grant boxes'
    });
  }
});

// Clear available boxes for user
router.delete('/user/:userId/available', authenticate, authorize(['admin', 'operator']), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Delete only available (unopened) boxes
    const result = await pool.query(
      `DELETE FROM boxes 
       WHERE user_id = $1 
         AND status = 'available' 
         AND opened_at IS NULL
       RETURNING id`,
      [userId]
    );
    
    const deletedCount = result.rows.length;
    
    logger.info('Available boxes cleared for user', {
      userId,
      deletedCount,
      clearedBy: req.user?.id,
      clearedByEmail: req.user?.email
    });
    
    res.json({
      success: true,
      message: `Cleared ${deletedCount} available box${deletedCount !== 1 ? 'es' : ''}`,
      data: {
        deletedCount,
        userId
      }
    });
  } catch (error) {
    logger.error('Error clearing boxes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear boxes'
    });
  }
});

// Get box statistics for all users (admin only)
router.get('/stats', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const stats = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        COUNT(b.id) as total_boxes,
        COUNT(CASE WHEN b.status = 'available' THEN 1 END) as available_boxes,
        COUNT(CASE WHEN b.status = 'opened' THEN 1 END) as opened_boxes,
        MAX(b.opened_at) as last_opened_at
      FROM users u
      LEFT JOIN boxes b ON u.id = b.user_id
      WHERE u.role = 'customer'
      GROUP BY u.id, u.name, u.email
      ORDER BY total_boxes DESC
    `);
    
    res.json({
      success: true,
      data: stats.rows
    });
  } catch (error) {
    logger.error('Error fetching box statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch box statistics'
    });
  }
});

export default router;