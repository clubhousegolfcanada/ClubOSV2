import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { pool } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/profile/stats/:userId?
 * Get comprehensive profile statistics for a user
 * If no userId provided, returns stats for authenticated user
 */
router.get('/stats/:userId?', authenticate, async (req, res) => {
  try {
    const userId = req.params.userId || (req as any).user?.id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID required'
      });
    }
    
    // Get comprehensive stats in a single query
    // Removed optional columns that may not exist yet (home_golf_course, previous_rank, rank_last_updated)
    const query = `
      SELECT 
        cp.user_id,
        u.name,
        u.email,
        u.phone,
        u.created_at as member_since,
        cp.cc_balance,
        cp.total_cc_earned,
        cp.total_cc_spent,
        cp.total_challenges_played,
        cp.total_challenges_won,
        cp.challenge_win_rate,
        cp.challenge_streak as current_streak,
        cp.max_win_streak as longest_win_streak,
        cp.max_loss_streak as longest_loss_streak,
        cp.current_rank,
        cp.highest_rank_achieved,
        cp.last_challenge_at,
        cp.credibility_score,
        cp.home_location,
        cp.handicap,
        cp.bio,
        cp.total_rounds,
        cp.average_score,
        cp.best_score,
        cp.favorite_course,
        cp.profile_visibility,
        cp.show_bookings,
        cp.show_stats,
        cp.show_friends,
        cp.preferred_tee_time,
        cp.preferred_bay_type,
        cp.last_active_at,
        -- Calculate friend count
        (SELECT COUNT(*) 
         FROM friendships f
         WHERE (f.user_id = $1 OR f.friend_id = $1) 
         AND f.status = 'accepted'
        ) as friend_count,
        -- Calculate total bookings
        (SELECT COUNT(*) 
         FROM bookings b
         WHERE b.customer_id = $1
        ) as total_bookings,
        -- Get recent challenge activity
        (SELECT json_agg(recent_challenges ORDER BY resolved_at DESC)
         FROM (
           SELECT 
             c.id,
             c.status,
             c.winner_user_id,
             c.total_pot,
             c.resolved_at,
             CASE 
               WHEN c.creator_id = $1 THEN u2.name
               ELSE u1.name
             END as opponent_name
           FROM challenges c
           LEFT JOIN users u1 ON u1.id = c.creator_id
           LEFT JOIN users u2 ON u2.id = c.acceptor_id
           WHERE (c.creator_id = $1 OR c.acceptor_id = $1)
           AND c.status = 'resolved'
           ORDER BY c.resolved_at DESC
           LIMIT 5
         ) recent_challenges
        ) as recent_challenges,
        -- Get badge count
        (SELECT COUNT(*) 
         FROM user_badges ub
         WHERE ub.user_id = $1
        ) as badge_count,
        -- Get active challenges count
        (SELECT COUNT(*) 
         FROM challenges c
         WHERE (c.creator_id = $1 OR c.acceptor_id = $1)
         AND c.status IN ('pending', 'accepted', 'playing')
        ) as active_challenges_count
      FROM customer_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.user_id = $1
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found'
      });
    }
    
    const stats = result.rows[0];
    
    // Format the response
    const formattedStats = {
      user: {
        id: stats.user_id,
        name: stats.name,
        email: stats.email,
        phone: stats.phone,
        memberSince: stats.member_since,
        lastActive: stats.last_active_at
      },
      clubcoins: {
        balance: parseFloat(stats.cc_balance || 0),
        totalEarned: parseFloat(stats.total_cc_earned || 0),
        totalSpent: parseFloat(stats.total_cc_spent || 0)
      },
      challenges: {
        totalPlayed: parseInt(stats.total_challenges_played || 0),
        totalWon: parseInt(stats.total_challenges_won || 0),
        winRate: parseFloat(stats.challenge_win_rate || 0),
        currentStreak: parseInt(stats.current_streak || 0),
        longestWinStreak: parseInt(stats.longest_win_streak || 0),
        longestLossStreak: parseInt(stats.longest_loss_streak || 0),
        lastChallengeAt: stats.last_challenge_at,
        activeCount: parseInt(stats.active_challenges_count || 0),
        recentChallenges: stats.recent_challenges || []
      },
      ranking: {
        currentRank: stats.current_rank || 'house',
        highestRank: stats.highest_rank_achieved || 'house',
        previousRank: null, // Column doesn't exist yet in production
        rankLastUpdated: null, // Column doesn't exist yet in production
        credibilityScore: parseInt(stats.credibility_score || 100)
      },
      profile: {
        homeLocation: stats.home_location,
        homeGolfCourse: null, // Column doesn't exist yet in production
        handicap: stats.handicap ? parseFloat(stats.handicap) : null,
        bio: stats.bio,
        totalRounds: parseInt(stats.total_rounds || 0),
        averageScore: stats.average_score ? parseFloat(stats.average_score) : null,
        bestScore: stats.best_score ? parseInt(stats.best_score) : null,
        favoriteCourse: stats.favorite_course,
        preferredTeeTime: stats.preferred_tee_time,
        preferredBayType: stats.preferred_bay_type
      },
      social: {
        friendCount: parseInt(stats.friend_count || 0),
        badgeCount: parseInt(stats.badge_count || 0),
        totalBookings: parseInt(stats.total_bookings || 0)
      },
      settings: {
        profileVisibility: stats.profile_visibility || 'friends',
        showBookings: stats.show_bookings !== false,
        showStats: stats.show_stats !== false,
        showFriends: stats.show_friends !== false
      }
    };
    
    res.json({
      success: true,
      data: formattedStats
    });
    
  } catch (error) {
    logger.error('Error fetching profile stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile statistics'
    });
  }
});

/**
 * GET /api/profile/stats-summary
 * Get a quick summary of stats for the authenticated user
 * Used for dashboard widgets and quick displays
 */
router.get('/stats-summary', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    
    const query = `
      SELECT 
        cp.cc_balance,
        cp.total_challenges_won,
        cp.total_challenges_played,
        cp.challenge_win_rate,
        cp.current_rank,
        cp.challenge_streak
      FROM customer_profiles cp
      WHERE cp.user_id = $1
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        ccBalance: parseFloat(result.rows[0].cc_balance || 0),
        wins: parseInt(result.rows[0].total_challenges_won || 0),
        played: parseInt(result.rows[0].total_challenges_played || 0),
        winRate: parseFloat(result.rows[0].challenge_win_rate || 0),
        rank: result.rows[0].current_rank || 'house',
        streak: parseInt(result.rows[0].challenge_streak || 0)
      }
    });
    
  } catch (error) {
    logger.error('Error fetching stats summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats summary'
    });
  }
});

export default router;