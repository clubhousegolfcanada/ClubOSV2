import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { pool } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Get all badges for a specific user
 */
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get all badges earned by user
    const badgesQuery = `
      SELECT 
        ub.id,
        b.key,
        b.name,
        b.description,
        b.category,
        b.tier,
        b.icon_url,
        ub.earned_at,
        ub.is_featured,
        ub.metadata
      FROM user_badges ub
      JOIN badges b ON b.key = ub.badge_key
      WHERE ub.user_id = $1
      ORDER BY 
        ub.is_featured DESC,
        CASE b.tier
          WHEN 'legendary' THEN 1
          WHEN 'epic' THEN 2
          WHEN 'rare' THEN 3
          WHEN 'uncommon' THEN 4
          WHEN 'common' THEN 5
        END,
        ub.earned_at DESC
    `;
    
    const result = await pool.query(badgesQuery, [userId]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching user badges:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch badges'
    });
  }
});

/**
 * Get all available badges in the system
 */
router.get('/catalog', authenticate, async (req, res) => {
  try {
    const catalogQuery = `
      SELECT 
        key,
        name,
        description,
        category,
        tier,
        icon_url,
        requirements,
        is_active,
        created_at
      FROM badges
      WHERE is_active = true
      ORDER BY 
        CASE tier
          WHEN 'legendary' THEN 1
          WHEN 'epic' THEN 2
          WHEN 'rare' THEN 3
          WHEN 'uncommon' THEN 4
          WHEN 'common' THEN 5
        END,
        category,
        name
    `;
    
    const result = await pool.query(catalogQuery);
    
    // Group by category for better organization
    const grouped = result.rows.reduce((acc: any, badge: any) => {
      if (!acc[badge.category]) {
        acc[badge.category] = [];
      }
      acc[badge.category].push(badge);
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: {
        all: result.rows,
        byCategory: grouped
      }
    });
  } catch (error) {
    logger.error('Error fetching badge catalog:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch badge catalog'
    });
  }
});

/**
 * Get badge progress for a user
 */
router.get('/progress/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user's current stats
    const statsQuery = `
      SELECT 
        cp.user_id,
        cp.cc_balance,
        cp.total_cc_earned,
        cp.credibility_score,
        (SELECT COUNT(*) FROM challenges WHERE creator_id = $1 OR acceptor_id = $1) as total_challenges,
        (SELECT COUNT(*) FROM challenges WHERE (creator_id = $1 OR acceptor_id = $1) AND winner_user_id = $1) as total_wins,
        (SELECT COUNT(*) FROM challenges WHERE creator_id = $1) as challenges_created,
        (SELECT COUNT(*) FROM challenges WHERE acceptor_id = $1 AND status = 'accepted') as challenges_accepted,
        cp.max_win_streak,
        cp.current_streak,
        ra.rank_tier as current_rank
      FROM customer_profiles cp
      LEFT JOIN rank_assignments ra ON ra.user_id = cp.user_id 
        AND ra.season_id = (SELECT id FROM seasons WHERE is_active = true LIMIT 1)
      WHERE cp.user_id = $1
    `;
    
    const stats = await pool.query(statsQuery, [userId]);
    const userStats = stats.rows[0];
    
    if (!userStats) {
      return res.json({
        success: true,
        data: { progress: [] }
      });
    }
    
    // Calculate progress for each badge
    const progressData = [];
    
    // Serial Challenger - 10 challenges created
    progressData.push({
      badge_key: 'serial_challenger',
      current: userStats.challenges_created || 0,
      required: 10,
      percentage: Math.min(100, ((userStats.challenges_created || 0) / 10) * 100)
    });
    
    // Acceptance Speech - 10 challenges accepted
    progressData.push({
      badge_key: 'acceptance_speech',
      current: userStats.challenges_accepted || 0,
      required: 10,
      percentage: Math.min(100, ((userStats.challenges_accepted || 0) / 10) * 100)
    });
    
    // Winning Formula - 25 victories
    progressData.push({
      badge_key: 'winning_formula',
      current: userStats.total_wins || 0,
      required: 25,
      percentage: Math.min(100, ((userStats.total_wins || 0) / 25) * 100)
    });
    
    // Hot Streak - 5 wins in a row
    progressData.push({
      badge_key: 'hot_streak',
      current: userStats.max_win_streak || 0,
      required: 5,
      percentage: Math.min(100, ((userStats.max_win_streak || 0) / 5) * 100)
    });
    
    // Century Club - 100 CC earned
    progressData.push({
      badge_key: 'century_club',
      current: userStats.total_cc_earned || 0,
      required: 100,
      percentage: Math.min(100, ((userStats.total_cc_earned || 0) / 100) * 100)
    });
    
    // Rich Uncle - 1000 CC balance
    progressData.push({
      badge_key: 'rich_uncle',
      current: userStats.cc_balance || 0,
      required: 1000,
      percentage: Math.min(100, ((userStats.cc_balance || 0) / 1000) * 100)
    });
    
    res.json({
      success: true,
      data: {
        stats: userStats,
        progress: progressData
      }
    });
  } catch (error) {
    logger.error('Error fetching badge progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch badge progress'
    });
  }
});

/**
 * Toggle featured status for a user's badge
 */
router.put('/:badgeId/feature', authenticate, async (req, res) => {
  try {
    const { badgeId } = req.params;
    const userId = req.user?.id;
    
    // First unfeatured all badges for this user
    await pool.query(
      'UPDATE user_badges SET is_featured = false WHERE user_id = $1',
      [userId]
    );
    
    // Then feature the selected badge
    const result = await pool.query(
      'UPDATE user_badges SET is_featured = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [badgeId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Badge not found or not owned by user'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error featuring badge:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to feature badge'
    });
  }
});

/**
 * Award a badge to a user (admin only)
 */
router.post('/award', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const { userId, badgeKey, metadata } = req.body;
    
    // Check if badge exists
    const badgeCheck = await pool.query(
      'SELECT * FROM badges WHERE key = $1',
      [badgeKey]
    );
    
    if (badgeCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Badge not found'
      });
    }
    
    // Check if user already has this badge
    const existingCheck = await pool.query(
      'SELECT * FROM user_badges WHERE user_id = $1 AND badge_key = $2',
      [userId, badgeKey]
    );
    
    if (existingCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'User already has this badge'
      });
    }
    
    // Award the badge
    const result = await pool.query(
      `INSERT INTO user_badges (user_id, badge_key, metadata)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, badgeKey, metadata || {}]
    );
    
    // Log the award
    await pool.query(
      `INSERT INTO badge_audit (user_id, badge_key, action, admin_id)
       VALUES ($1, $2, 'awarded_manually', $3)`,
      [userId, badgeKey, req.user.id]
    );
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Badge awarded successfully'
    });
  } catch (error) {
    logger.error('Error awarding badge:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to award badge'
    });
  }
});

/**
 * Get recent badge activity (feed)
 */
router.get('/activity', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    
    const activityQuery = `
      SELECT 
        ub.earned_at,
        u.name as user_name,
        u.id as user_id,
        b.name as badge_name,
        b.key as badge_key,
        b.tier,
        b.category
      FROM user_badges ub
      JOIN badges b ON b.key = ub.badge_key
      JOIN users u ON u.id = ub.user_id
      ORDER BY ub.earned_at DESC
      LIMIT $1
    `;
    
    const result = await pool.query(activityQuery, [limit]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching badge activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch badge activity'
    });
  }
});

export default router;