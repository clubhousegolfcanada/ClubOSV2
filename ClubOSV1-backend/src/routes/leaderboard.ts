import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { pool } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/leaderboard/seasonal
 * Get current season leaderboard
 */
router.get('/seasonal', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    const query = `
      SELECT 
        u.id,
        u.name,
        cp.current_rank,
        sce.cc_net,
        sce.challenges_completed,
        ra.percentile,
        ra.win_rate,
        RANK() OVER (ORDER BY sce.cc_net DESC) as position,
        EXISTS(
          SELECT 1 FROM champion_markers cm 
          WHERE cm.user_id = u.id AND cm.is_active = true
        ) as has_champion_marker
      FROM seasonal_cc_earnings sce
      JOIN users u ON u.id = sce.user_id
      JOIN customer_profiles cp ON cp.user_id = u.id
      LEFT JOIN rank_assignments ra ON ra.user_id = u.id AND ra.season_id = sce.season_id
      WHERE sce.season_id = get_current_season()
      AND sce.cc_net > 0
      ORDER BY sce.cc_net DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    
    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        position: parseInt(row.position),
        currentRank: row.current_rank,
        ccNet: parseFloat(row.cc_net || 0),
        challengesCompleted: parseInt(row.challenges_completed || 0),
        winRate: parseFloat(row.win_rate || 0),
        hasChampionMarker: row.has_champion_marker
      }))
    });
  } catch (error) {
    logger.error('Error fetching seasonal leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard'
    });
  }
});

/**
 * GET /api/leaderboard/alltime
 * Get all-time leaderboard
 */
router.get('/alltime', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const userId = (req as any).user?.id || null;
    
    const query = `
      SELECT 
        u.id,
        u.name,
        cp.current_rank,
        cp.cc_balance,
        cp.total_cc_earned,
        cp.total_challenges_won,
        cp.total_challenges_played,
        cp.challenge_win_rate as win_rate,
        cp.highest_rank_achieved,
        RANK() OVER (ORDER BY cp.total_cc_earned DESC) as position,
        EXISTS(
          SELECT 1 FROM champion_markers cm 
          WHERE cm.user_id = u.id AND cm.is_active = true
        ) as has_champion_marker,
        CASE 
          WHEN $2::uuid IS NULL THEN false
          ELSE EXISTS(
            SELECT 1 FROM friendships f 
            WHERE ((f.user_id = $2 AND f.friend_id = u.id) 
            OR (f.friend_id = $2 AND f.user_id = u.id))
            AND f.status = 'accepted'
          )
        END as is_friend,
        CASE 
          WHEN $2::uuid IS NULL THEN false
          ELSE EXISTS(
            SELECT 1 FROM friendships f
            WHERE ((f.user_id = $2 AND f.friend_id = u.id) 
            OR (f.friend_id = $2 AND f.user_id = u.id))
            AND f.status = 'pending'
          )
        END as has_pending_request
      FROM customer_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.total_cc_earned > 0 OR cp.cc_balance > 0
      ORDER BY cp.total_cc_earned DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit, userId]);
    
    res.json({
      success: true,
      data: result.rows.map(row => ({
        user_id: row.id,
        name: row.name,
        rank: parseInt(row.position),
        rank_tier: row.current_rank || 'house',
        cc_balance: parseFloat(row.cc_balance || 0),
        total_challenges_won: parseInt(row.total_challenges_won || 0),
        total_challenges_played: parseInt(row.total_challenges_played || 0),
        win_rate: parseFloat(row.win_rate || 0),
        has_champion_marker: row.has_champion_marker || false,
        is_friend: row.is_friend || false,
        has_pending_request: row.has_pending_request || false
      }))
    });
  } catch (error) {
    logger.error('Error fetching all-time leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard'
    });
  }
});

/**
 * GET /api/leaderboard/activity
 * Get recent challenge activity
 */
router.get('/activity', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const query = `
      SELECT 
        cr.resolved_at as activity_time,
        'challenge_complete' as activity_type,
        u1.name as winner_name,
        u2.name as loser_name,
        cr.winner_score,
        cr.loser_score,
        cr.final_payout,
        c.course_name
      FROM challenge_results cr
      JOIN challenges c ON c.id = cr.challenge_id
      JOIN users u1 ON u1.id = cr.winner_user_id
      JOIN users u2 ON u2.id = cr.loser_user_id
      ORDER BY cr.resolved_at DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    
    res.json({
      success: true,
      data: result.rows.map(row => ({
        activityTime: row.activity_time,
        activityType: row.activity_type,
        winnerName: row.winner_name,
        loserName: row.loser_name,
        winnerScore: parseFloat(row.winner_score || 0),
        loserScore: parseFloat(row.loser_score || 0),
        payout: parseFloat(row.final_payout || 0),
        courseName: row.course_name
      }))
    });
  } catch (error) {
    logger.error('Error fetching activity feed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity'
    });
  }
});

/**
 * GET /api/leaderboard/user/:userId
 * Get specific user's leaderboard stats
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const query = `
      SELECT 
        u.id,
        u.name,
        cp.current_rank,
        cp.highest_rank_achieved,
        cp.cc_balance,
        cp.total_cc_earned,
        cp.total_challenges_played,
        cp.total_challenges_won,
        cp.challenge_win_rate,
        cp.max_win_streak,
        cp.max_loss_streak,
        cp.challenge_streak,
        sce.cc_net as season_cc,
        sce.challenges_completed as season_challenges,
        ra.percentile as season_percentile,
        ra.season_rank,
        (
          SELECT COUNT(*) + 1 
          FROM seasonal_cc_earnings sce2 
          WHERE sce2.season_id = get_current_season() 
          AND sce2.cc_net > sce.cc_net
        ) as season_position,
        EXISTS(
          SELECT 1 FROM champion_markers cm 
          WHERE cm.user_id = u.id AND cm.is_active = true
        ) as has_champion_marker
      FROM users u
      JOIN customer_profiles cp ON cp.user_id = u.id
      LEFT JOIN seasonal_cc_earnings sce ON sce.user_id = u.id AND sce.season_id = get_current_season()
      LEFT JOIN rank_assignments ra ON ra.user_id = u.id AND ra.season_id = get_current_season()
      WHERE u.id = $1
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const user = result.rows[0];
    
    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        currentRank: user.current_rank,
        highestRank: user.highest_rank_achieved,
        ccBalance: parseFloat(user.cc_balance || 0),
        totalCCEarned: parseFloat(user.total_cc_earned || 0),
        totalChallenges: parseInt(user.total_challenges_played || 0),
        totalWins: parseInt(user.total_challenges_won || 0),
        winRate: parseFloat(user.challenge_win_rate || 0),
        maxWinStreak: parseInt(user.max_win_streak || 0),
        maxLossStreak: parseInt(user.max_loss_streak || 0),
        currentStreak: parseInt(user.challenge_streak || 0),
        seasonCC: parseFloat(user.season_cc || 0),
        seasonChallenges: parseInt(user.season_challenges || 0),
        seasonPercentile: parseFloat(user.season_percentile || 1),
        seasonPosition: parseInt(user.season_position || 0),
        hasChampionMarker: user.has_champion_marker
      }
    });
  } catch (error) {
    logger.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user stats'
    });
  }
});

// Get user's current rank
router.get('/rank', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    const result = await db.query(`
      SELECT rank_tier, points, challenges_played, challenges_won
      FROM rank_assignments
      WHERE user_id = $1 AND season_id = get_current_season()
    `, [userId]);
    
    if (result.rows.length === 0) {
      // Return default if no rank assignment
      return res.json({
        success: true,
        data: {
          rank_tier: 'house',
          points: 0,
          challenges_played: 0,
          challenges_won: 0
        }
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to fetch user rank:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rank'
    });
  }
});

export default router;