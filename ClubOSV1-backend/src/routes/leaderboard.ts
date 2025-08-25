import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { pool } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/leaderboard/alltime
 * Get all-time leaderboard with proper ordering and null handling
 */
router.get('/alltime', async (req, res) => {
  try {
    const { limit = 100, sort = 'cc_earned' } = req.query;
    const userId = (req as any).user?.id || null;
    
    // Validate sort parameter
    const validSorts = ['cc_earned', 'cc_balance', 'wins', 'win_rate'];
    const sortBy = validSorts.includes(sort as string) ? sort as string : 'cc_earned';
    
    // Build ORDER BY clause based on sort parameter
    let orderByClause = '';
    let sortDescription = '';
    
    switch (sortBy) {
      case 'cc_balance':
        orderByClause = `COALESCE(cp.cc_balance, 0) DESC, COALESCE(cp.total_cc_earned, 0) DESC, u.name ASC`;
        sortDescription = 'Current Balance';
        break;
      case 'wins':
        orderByClause = `COALESCE(cp.total_challenges_won, 0) DESC, COALESCE(cp.challenge_win_rate, 0) DESC, u.name ASC`;
        sortDescription = 'Total Wins';
        break;
      case 'win_rate':
        // Minimum 10 games for win rate sorting
        orderByClause = `
          CASE 
            WHEN COALESCE(cp.total_challenges_played, 0) < 10 THEN -1
            ELSE COALESCE(cp.challenge_win_rate, 0)
          END DESC,
          COALESCE(cp.total_challenges_won, 0) DESC,
          u.name ASC`;
        sortDescription = 'Win Rate (min 10 games)';
        break;
      case 'cc_earned':
      default:
        orderByClause = `COALESCE(cp.total_cc_earned, 0) DESC, COALESCE(cp.cc_balance, 0) DESC, u.name ASC`;
        sortDescription = 'Total ClubCoins Earned';
        break;
    }
    
    // Fixed query with proper NULL handling and guaranteed ordering
    const query = `
      WITH ranked_users AS (
        SELECT 
          u.id,
          u.name,
          cp.current_rank,
          COALESCE(cp.cc_balance, 0) as cc_balance,
          COALESCE(cp.total_cc_earned, 0) as total_cc_earned,
          COALESCE(cp.total_challenges_won, 0) as total_challenges_won,
          COALESCE(cp.total_challenges_played, 0) as total_challenges_played,
          COALESCE(cp.challenge_win_rate, 0) as win_rate,
          cp.highest_rank_achieved,
          cp.previous_rank,
          COALESCE(cp.achievement_count, 0) as achievement_count,
          COALESCE(cp.achievement_points, 0) as achievement_points,
          -- Use ROW_NUMBER for guaranteed unique ranking
          ROW_NUMBER() OVER (
            ORDER BY ${orderByClause}
          ) as position
        FROM users u
        LEFT JOIN customer_profiles cp ON cp.user_id = u.id
        WHERE u.role = 'customer'
          AND u.is_active = true
      )
      SELECT 
        ru.*,
        EXISTS(
          SELECT 1 FROM champion_markers cm 
          WHERE cm.user_id = ru.id AND cm.is_active = true
        ) as has_champion_marker,
        CASE 
          WHEN $2::uuid IS NULL THEN false
          ELSE EXISTS(
            SELECT 1 FROM friendships f 
            WHERE ((f.user_id = $2 AND f.friend_id = ru.id) 
            OR (f.friend_id = $2 AND f.user_id = ru.id))
            AND f.status = 'accepted'
          )
        END as is_friend,
        CASE 
          WHEN $2::uuid IS NULL THEN false
          ELSE EXISTS(
            SELECT 1 FROM friendships f
            WHERE ((f.user_id = $2 AND f.friend_id = ru.id) 
            OR (f.friend_id = $2 AND f.user_id = ru.id))
            AND f.status = 'pending'
          )
        END as has_pending_request,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id', a.id,
            'code', a.code,
            'name', a.name,
            'icon', a.icon,
            'rarity', a.rarity,
            'category', a.category
          ) ORDER BY 
            CASE a.rarity 
              WHEN 'legendary' THEN 4
              WHEN 'epic' THEN 3
              WHEN 'rare' THEN 2
              WHEN 'common' THEN 1
              ELSE 0
            END DESC,
            ua.awarded_at DESC
          ), '[]'::json)
          FROM user_achievements ua
          JOIN achievements a ON a.id = ua.achievement_id
          WHERE ua.user_id = ru.id 
            AND ua.is_featured = true
            AND (ua.expires_at IS NULL OR ua.expires_at > NOW())
          LIMIT 3
        ) as featured_achievements
      FROM ranked_users ru
      ORDER BY ru.position ASC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit, userId]);
    
    // Process and validate results
    const leaderboard = result.rows.map(row => {
      const currentRank = parseInt(row.position) || 0;
      const previousRank = row.previous_rank ? parseInt(row.previous_rank) : null;
      
      // Calculate rank change (positive = moved up, negative = moved down)
      let rankChange = 0;
      if (previousRank !== null && previousRank !== currentRank) {
        rankChange = previousRank - currentRank;
      }
      
      return {
        user_id: row.id,
        name: row.name || 'Unknown Player',
        rank: currentRank,
        rank_tier: row.current_rank || 'house',
        cc_balance: parseFloat(row.cc_balance || 0),
        total_cc_earned: parseFloat(row.total_cc_earned || 0),
        total_challenges_won: parseInt(row.total_challenges_won || 0),
        total_challenges_played: parseInt(row.total_challenges_played || 0),
        win_rate: parseFloat(row.win_rate || 0),
        has_champion_marker: row.has_champion_marker || false,
        is_friend: row.is_friend || false,
        has_pending_request: row.has_pending_request || false,
        rank_change: rankChange,
        achievement_count: parseInt(row.achievement_count || 0),
        achievement_points: parseInt(row.achievement_points || 0),
        featured_achievements: Array.isArray(row.featured_achievements) 
          ? row.featured_achievements 
          : []
      };
    });
    
    // Log sample for debugging
    if (leaderboard.length > 0) {
      logger.info('Leaderboard sample (top 3):', {
        top3: leaderboard.slice(0, 3).map(p => ({
          rank: p.rank,
          name: p.name,
          total_cc: p.total_cc_earned,
          current_cc: p.cc_balance
        }))
      });
    }
    
    res.json({
      success: true,
      data: leaderboard,
      metadata: {
        total_players: leaderboard.length,
        requested_limit: limit,
        sort_by: sortBy,
        sort_description: sortDescription,
        ordered_by: orderByClause.replace(/\s+/g, ' ').trim()
      }
    });
  } catch (error) {
    logger.error('Error fetching all-time leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/leaderboard/seasonal
 * Get current season leaderboard
 */
router.get('/seasonal', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    const query = `
      WITH ranked_users AS (
        SELECT 
          u.id,
          u.name,
          cp.current_rank,
          COALESCE(sce.cc_net, 0) as cc_net,
          COALESCE(sce.challenges_completed, 0) as challenges_completed,
          COALESCE(ra.percentile, 0) as percentile,
          COALESCE(ra.win_rate, 0) as win_rate,
          ROW_NUMBER() OVER (ORDER BY COALESCE(sce.cc_net, 0) DESC) as position
        FROM users u
        LEFT JOIN customer_profiles cp ON cp.user_id = u.id
        LEFT JOIN seasonal_cc_earnings sce ON sce.user_id = u.id 
          AND sce.season_id = (SELECT id FROM seasons WHERE status = 'active' LIMIT 1)
        LEFT JOIN rank_assignments ra ON ra.user_id = u.id 
          AND ra.season_id = sce.season_id
        WHERE u.role = 'customer'
          AND u.is_active = true
      )
      SELECT 
        ru.*,
        EXISTS(
          SELECT 1 FROM champion_markers cm 
          WHERE cm.user_id = ru.id AND cm.is_active = true
        ) as has_champion_marker
      FROM ranked_users ru
      WHERE ru.cc_net > 0
      ORDER BY ru.position ASC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    
    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        name: row.name || 'Unknown Player',
        position: parseInt(row.position) || 0,
        currentRank: row.current_rank || 'house',
        ccNet: parseFloat(row.cc_net || 0),
        challengesCompleted: parseInt(row.challenges_completed || 0),
        winRate: parseFloat(row.win_rate || 0),
        hasChampionMarker: row.has_champion_marker || false
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
 * GET /api/leaderboard/user/:userId
 * Get specific user's leaderboard stats
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const query = `
      WITH user_rank AS (
        SELECT 
          COUNT(*) + 1 as position
        FROM customer_profiles cp2
        JOIN users u2 ON u2.id = cp2.user_id
        WHERE u2.role = 'customer'
          AND u2.is_active = true
          AND COALESCE(cp2.total_cc_earned, 0) > (
            SELECT COALESCE(cp.total_cc_earned, 0)
            FROM customer_profiles cp
            WHERE cp.user_id = $1
          )
      )
      SELECT 
        u.id,
        u.name,
        cp.current_rank,
        cp.highest_rank_achieved,
        COALESCE(cp.cc_balance, 0) as cc_balance,
        COALESCE(cp.total_cc_earned, 0) as total_cc_earned,
        COALESCE(cp.total_challenges_won, 0) as total_challenges_won,
        COALESCE(cp.total_challenges_played, 0) as total_challenges_played,
        COALESCE(cp.challenge_win_rate, 0) as win_rate,
        ur.position,
        (
          SELECT COUNT(*) 
          FROM users u3 
          JOIN customer_profiles cp3 ON cp3.user_id = u3.id
          WHERE u3.role = 'customer' AND u3.is_active = true
        ) as total_players
      FROM users u
      LEFT JOIN customer_profiles cp ON cp.user_id = u.id
      CROSS JOIN user_rank ur
      WHERE u.id = $1
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const userData = result.rows[0];
    
    res.json({
      success: true,
      data: {
        id: userData.id,
        name: userData.name || 'Unknown Player',
        position: parseInt(userData.position) || 0,
        totalPlayers: parseInt(userData.total_players) || 0,
        currentRank: userData.current_rank || 'house',
        highestRank: userData.highest_rank_achieved,
        ccBalance: parseFloat(userData.cc_balance || 0),
        totalCCEarned: parseFloat(userData.total_cc_earned || 0),
        challengesWon: parseInt(userData.total_challenges_won || 0),
        challengesPlayed: parseInt(userData.total_challenges_played || 0),
        winRate: parseFloat(userData.win_rate || 0)
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

export default router;