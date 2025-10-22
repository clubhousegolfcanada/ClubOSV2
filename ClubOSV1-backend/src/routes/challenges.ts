import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { challengeService } from '../services/challengeService';
import { clubCoinService } from '../services/clubCoinService';
import { pool } from '../utils/database';
import { logger } from '../utils/logger';
import { cacheService, CACHE_TTL } from '../services/cacheService';
import {
  challengeRateLimiters,
  challengeCreationRateLimiters,
  challengeAcceptanceRateLimiters
} from '../middleware/challengeRateLimiter';

const router = Router();

// All routes require authentication and customer role
router.use(authenticate);
router.use(roleGuard(['customer', 'admin', 'operator']));

// Apply general rate limiting to all challenge routes
router.use(challengeRateLimiters);

/**
 * GET /api/challenges
 * Get user's challenges
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { status, limit = 50 } = req.query;

    // Cache user challenges for 60 seconds
    const cacheKey = `challenges:${userId}:${status || 'all'}:${limit}`;
    const challenges = await cacheService.withCache(
      cacheKey,
      async () => {
        return await challengeService.getUserChallenges(
          userId,
          status as string,
          parseInt(limit as string)
        );
      },
      { ttl: 60 } // 60 second cache for challenge lists
    );

    res.json({
      success: true,
      data: challenges
    });
  } catch (error) {
    logger.error('Error fetching challenges:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch challenges'
    });
  }
});

/**
 * GET /api/challenges/pending
 * Get pending challenge invites
 */
router.get('/pending', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    const query = `
      SELECT 
        c.*,
        u.name as creator_name,
        cp.current_rank as creator_rank
      FROM challenges c
      JOIN users u ON u.id = c.creator_id
      LEFT JOIN customer_profiles cp ON cp.user_id = c.creator_id
      WHERE c.acceptor_id = $1 AND c.status = 'pending'
      ORDER BY c.created_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching pending challenges:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending challenges'
    });
  }
});

/**
 * GET /api/challenges/active
 * Get active challenges
 */
router.get('/active', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    const query = `
      SELECT 
        c.*,
        u1.name as creator_name,
        u2.name as acceptor_name,
        cp1.score as creator_score,
        cp2.score as acceptor_score,
        CASE 
          WHEN c.expires_at < CURRENT_TIMESTAMP THEN 'expired'
          WHEN cp1.played_at IS NOT NULL AND cp2.played_at IS NOT NULL THEN 'ready_resolve'
          WHEN cp1.played_at IS NOT NULL OR cp2.played_at IS NOT NULL THEN 'awaiting_sync'
          ELSE 'active'
        END as play_status
      FROM challenges c
      JOIN users u1 ON u1.id = c.creator_id
      JOIN users u2 ON u2.id = c.acceptor_id
      LEFT JOIN challenge_plays cp1 ON cp1.challenge_id = c.id AND cp1.user_id = c.creator_id
      LEFT JOIN challenge_plays cp2 ON cp2.challenge_id = c.id AND cp2.user_id = c.acceptor_id
      WHERE (c.creator_id = $1 OR c.acceptor_id = $1)
      AND c.status IN ('accepted', 'active', 'awaiting_sync')
      ORDER BY c.expires_at ASC
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching active challenges:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active challenges'
    });
  }
});

/**
 * GET /api/challenges/history
 * Get challenge history
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { limit = 50, offset = 0 } = req.query;
    
    const query = `
      SELECT 
        c.*,
        cr.winner_user_id,
        cr.final_payout,
        cr.total_bonus,
        u1.name as creator_name,
        u2.name as acceptor_name,
        CASE 
          WHEN cr.winner_user_id = $1 THEN 'won'
          ELSE 'lost'
        END as result
      FROM challenges c
      JOIN challenge_results cr ON cr.challenge_id = c.id
      JOIN users u1 ON u1.id = c.creator_id
      JOIN users u2 ON u2.id = c.acceptor_id
      WHERE (c.creator_id = $1 OR c.acceptor_id = $1)
      AND c.status = 'resolved'
      ORDER BY c.resolved_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [userId, limit, offset]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching challenge history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch challenge history'
    });
  }
});

/**
 * GET /api/challenges/balance
 * Get user's CC balance
 */
router.get('/balance', async (req, res) => {
  try {
    const userId = req.user?.id;
    const balance = await clubCoinService.getBalance(userId);
    
    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    logger.error('Error fetching CC balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch balance'
    });
  }
});

/**
 * GET /api/challenges/settings-catalog
 * Get available challenge settings
 */
router.get('/settings-catalog', async (req, res) => {
  try {
    const query = `
      SELECT * FROM challenge_settings_catalog 
      WHERE is_active = true 
      ORDER BY times_used DESC, category
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      data: result.rows
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
 * GET /api/challenges/my-challenges
 * Get all user's challenges (pending, active, and recent history)
 */
router.get('/my-challenges', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }
    
    // Get all challenges for the user
    const query = `
      SELECT 
        c.*,
        u1.name as creator_name,
        u2.name as acceptor_name,
        cp1.current_rank as creator_rank,
        cp2.current_rank as acceptor_rank,
        CASE 
          WHEN c.creator_id = $1 THEN u2.name
          ELSE u1.name
        END as opponent_name,
        play1.score as creator_played_score,
        play2.score as acceptor_played_score,
        play1.played_at as creator_played_at,
        play2.played_at as acceptor_played_at,
        CASE 
          WHEN c.expires_at < CURRENT_TIMESTAMP AND c.status = 'pending' THEN 'expired'
          WHEN play1.played_at IS NOT NULL AND play2.played_at IS NOT NULL THEN 'ready_resolve'
          WHEN play1.played_at IS NOT NULL OR play2.played_at IS NOT NULL THEN 'awaiting_sync'
          ELSE c.status
        END as display_status
      FROM challenges c
      JOIN users u1 ON u1.id = c.creator_id
      JOIN users u2 ON u2.id = c.acceptor_id
      LEFT JOIN customer_profiles cp1 ON cp1.user_id = c.creator_id
      LEFT JOIN customer_profiles cp2 ON cp2.user_id = c.acceptor_id
      LEFT JOIN challenge_plays play1 ON play1.challenge_id = c.id AND play1.user_id = c.creator_id
      LEFT JOIN challenge_plays play2 ON play2.challenge_id = c.id AND play2.user_id = c.acceptor_id
      WHERE (c.creator_id = $1 OR c.acceptor_id = $1)
      ORDER BY 
        CASE 
          WHEN c.status = 'pending' THEN 1
          WHEN c.status IN ('accepted', 'active') THEN 2
          ELSE 3
        END,
        c.created_at DESC
      LIMIT 100
    `;
    
    const result = await pool.query(query, [userId]);
    
    // Format the data for frontend
    const formattedChallenges = result.rows.map(challenge => ({
      id: challenge.id,
      status: challenge.display_status || challenge.status,
      creatorId: challenge.creator_id,
      acceptorId: challenge.acceptor_id,
      creatorName: challenge.creator_name,
      acceptorName: challenge.acceptor_name,
      creatorRank: challenge.creator_rank || 'house',
      acceptorRank: challenge.acceptor_rank || 'house',
      opponent_name: challenge.opponent_name,
      wagerAmount: parseFloat(challenge.wager_amount),
      wager_amount: parseFloat(challenge.wager_amount),
      totalPot: parseFloat(challenge.total_pot),
      expiresAt: challenge.expires_at,
      expires_at: challenge.expires_at,
      courseName: challenge.course_name,
      creatorScore: challenge.creator_played_score,
      acceptorScore: challenge.acceptor_played_score,
      createdAt: challenge.created_at,
      settings: challenge.trackman_settings
    }));
    
    res.json({
      success: true,
      data: formattedChallenges
    });
  } catch (error) {
    logger.error('Error in my-challenges endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch challenges'
    });
  }
});

/**
 * GET /api/challenges/cc-balance
 * Get user's CC balance
 */
router.get('/cc-balance', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }
    
    // Get actual balance from customer_profiles table
    const result = await pool.query(
      `SELECT cc_balance FROM customer_profiles WHERE user_id = $1`,
      [userId]
    );
    
    let balance = 0;
    
    if (result.rows.length === 0) {
      // Create profile if it doesn't exist
      await pool.query(
        `INSERT INTO customer_profiles (user_id, cc_balance, rank_tier, total_challenges_won, total_challenges_played)
         VALUES ($1, 100, 'house', 0, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
      balance = 100;
    } else {
      balance = parseFloat(result.rows[0].cc_balance) || 0;
    }
    
    res.json({
      success: true,
      data: {
        balance: balance,
        totalEarned: 0,
        totalSpent: 0,
        lastTransaction: null
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
 * GET /api/challenges/cc-balance/:userId
 * Get a specific user's CC balance
 */
router.get('/cc-balance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get actual balance from customer_profiles table
    const result = await pool.query(
      `SELECT cc_balance FROM customer_profiles WHERE user_id = $1`,
      [userId]
    );
    
    let balance = 0;
    
    if (result.rows.length === 0) {
      // Create profile if it doesn't exist
      await pool.query(
        `INSERT INTO customer_profiles (user_id, cc_balance, rank_tier, total_challenges_won, total_challenges_played)
         VALUES ($1, 100, 'house', 0, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
      balance = 100;
    } else {
      balance = parseFloat(result.rows[0].cc_balance) || 0;
    }
    
    res.json({
      success: true,
      data: {
        balance: balance,
        totalEarned: 0,
        totalSpent: 0,
        lastTransaction: null
      }
    });
  } catch (error) {
    logger.error('Error fetching user CC balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch CC balance'
    });
  }
});

/**
 * GET /api/challenges/:id
 * Get challenge details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    const query = `
      SELECT 
        c.*,
        u1.name as creator_name,
        u2.name as acceptor_name,
        cp1.current_rank as creator_rank,
        cp2.current_rank as acceptor_rank,
        cp1.cc_balance as creator_balance,
        cp2.cc_balance as acceptor_balance,
        play1.score as creator_played_score,
        play2.score as acceptor_played_score,
        play1.played_at as creator_played_at,
        play2.played_at as acceptor_played_at
      FROM challenges c
      JOIN users u1 ON u1.id = c.creator_id
      JOIN users u2 ON u2.id = c.acceptor_id
      LEFT JOIN customer_profiles cp1 ON cp1.user_id = c.creator_id
      LEFT JOIN customer_profiles cp2 ON cp2.user_id = c.acceptor_id
      LEFT JOIN challenge_plays play1 ON play1.challenge_id = c.id AND play1.user_id = c.creator_id
      LEFT JOIN challenge_plays play2 ON play2.challenge_id = c.id AND play2.user_id = c.acceptor_id
      WHERE c.id = $1
      AND (c.creator_id = $2 OR c.acceptor_id = $2)
    `;
    
    const result = await pool.query(query, [id, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Challenge not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching challenge:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch challenge'
    });
  }
});

/**
 * POST /api/challenges
 * Create a new challenge
 */
router.post('/', challengeCreationRateLimiters, async (req, res) => {
  try {
    const userId = req.user?.id;
    const {
      acceptorId,
      courseId,
      courseName,
      settingsCatalogId,
      wagerAmount,
      expiryDays,
      creatorNote,
      trackmanSettings
    } = req.body;
    
    // Validate input - courseId is optional when deciding outside of challenge
    // courseName can be 'DECIDE_LATER' when players decide settings outside the system
    if (!acceptorId || !courseName || !wagerAmount || !expiryDays) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: acceptorId, courseName, wagerAmount, or expiryDays'
      });
    }
    
    // Validate expiry days
    if (![7, 14, 30].includes(expiryDays)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid expiry days. Must be 7, 14, or 30'
      });
    }
    
    // Validate wager amount
    if (wagerAmount < 10 || wagerAmount > 10000) {
      return res.status(400).json({
        success: false,
        error: 'Wager must be between 10 and 10,000 CC'
      });
    }
    
    const challenge = await challengeService.createChallenge({
      creatorId: userId,
      acceptorId,
      courseId,
      courseName,
      settingsCatalogId,
      wagerAmount,
      expiryDays,
      creatorNote,
      trackmanSettings: trackmanSettings || {}
    });
    
    res.json({
      success: true,
      data: challenge
    });
  } catch (error: any) {
    logger.error('Error creating challenge:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create challenge'
    });
  }
});

/**
 * POST /api/challenges/:id/accept
 * Accept a challenge
 */
router.post('/:id/accept', challengeAcceptanceRateLimiters, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    await challengeService.acceptChallenge(id, userId);
    
    res.json({
      success: true,
      message: 'Challenge accepted successfully'
    });
  } catch (error: any) {
    logger.error('Error accepting challenge:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to accept challenge'
    });
  }
});

/**
 * POST /api/challenges/:id/decline
 * Decline a challenge
 */
router.post('/:id/decline', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { reason } = req.body;
    
    await challengeService.declineChallenge(id, userId, reason);
    
    res.json({
      success: true,
      message: 'Challenge declined'
    });
  } catch (error: any) {
    logger.error('Error declining challenge:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to decline challenge'
    });
  }
});

/**
 * POST /api/challenges/:id/play-sync
 * Record play session
 */
router.post('/:id/play-sync', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { trackmanRoundId, score, trackmanData } = req.body;
    
    if (!trackmanRoundId || score === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required play data'
      });
    }
    
    await challengeService.recordPlay(
      id,
      userId,
      trackmanRoundId,
      score,
      trackmanData || {}
    );
    
    res.json({
      success: true,
      message: 'Play recorded successfully'
    });
  } catch (error: any) {
    logger.error('Error recording play:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to record play'
    });
  }
});

/**
 * POST /api/challenges/:id/select-winner
 * Select who won the challenge (both players must select the same winner)
 */
router.post('/:id/select-winner', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { winnerId } = req.body;
    
    if (!winnerId) {
      return res.status(400).json({
        success: false,
        error: 'Winner ID is required'
      });
    }
    
    // Start transaction
    await client.query('BEGIN');
    
    // Verify challenge exists and user is a participant
    const challengeQuery = `
      SELECT id, creator_id, acceptor_id, status
      FROM challenges
      WHERE id = $1
      AND (creator_id = $2 OR acceptor_id = $2)
      AND status IN ('active', 'accepted')
    `;
    
    const challengeResult = await client.query(challengeQuery, [id, userId]);
    
    if (challengeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Challenge not found or you are not a participant'
      });
    }
    
    const challenge = challengeResult.rows[0];
    
    // Verify winnerId is one of the participants
    if (winnerId !== challenge.creator_id && winnerId !== challenge.acceptor_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Winner must be one of the challenge participants'
      });
    }
    
    // Insert or update the user's selection
    const selectionQuery = `
      INSERT INTO challenge_winner_selections (
        challenge_id, user_id, selected_winner_id
      ) VALUES ($1, $2, $3)
      ON CONFLICT (challenge_id, user_id) 
      DO UPDATE SET 
        selected_winner_id = $3,
        selected_at = CURRENT_TIMESTAMP
      RETURNING id
    `;
    
    await client.query(selectionQuery, [id, userId, winnerId]);
    
    // Check if both players have selected - specifically checking for creator and acceptor
    const selectionsQuery = `
      SELECT 
        COUNT(DISTINCT ws.user_id) as selection_count,
        COUNT(DISTINCT ws.selected_winner_id) as unique_selections,
        ARRAY_AGG(DISTINCT ws.selected_winner_id) as winner_ids,
        bool_and(ws.user_id IN (c.creator_id, c.acceptor_id)) as valid_users,
        bool_or(ws.user_id = c.creator_id) as creator_selected,
        bool_or(ws.user_id = c.acceptor_id) as acceptor_selected,
        ARRAY_AGG(DISTINCT ws.user_id) as user_ids
      FROM challenge_winner_selections ws
      JOIN challenges c ON c.id = ws.challenge_id
      WHERE ws.challenge_id = $1 
        AND ws.user_id IN (c.creator_id, c.acceptor_id)
      GROUP BY c.id
    `;
    
    const selectionsResult = await client.query(selectionsQuery, [id]);
    const selections = selectionsResult.rows[0] || { 
      selection_count: 0, 
      unique_selections: 0, 
      winner_ids: [], 
      valid_users: true,
      creator_selected: false,
      acceptor_selected: false,
      user_ids: []
    };
    
    // Log for debugging
    logger.info('Winner selection check:', {
      challengeId: id,
      userId,
      winnerId,
      selections: selections.selection_count,
      uniqueWinners: selections.unique_selections,
      creatorSelected: selections.creator_selected,
      acceptorSelected: selections.acceptor_selected,
      winnerIds: selections.winner_ids,
      userIds: selections.user_ids
    });
    
    let message = 'Winner selection recorded. Waiting for other player.';
    let status = 'pending';
    let agreedWinner = null;
    
    // If both players have selected (creator AND acceptor must have both selected)
    if (selections.creator_selected && selections.acceptor_selected) {
      if (selections.unique_selections === 1) {
        // Both agree on the winner - trigger resolution
        message = 'Both players agree! Challenge will be resolved.';
        status = 'agreed';
        agreedWinner = selections.winner_ids[0]; // Get the single agreed winner
        
        // The trigger will handle updating the challenge status
      } else {
        // Players disagree
        message = 'Players disagree on winner. Please discuss or file a dispute.';
        status = 'disagreement';
      }
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message,
      data: {
        status,
        selections: selections.selection_count,
        agreedWinner: agreedWinner
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error selecting winner:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record winner selection'
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/challenges/:id/winner-selections
 * Get current winner selections for a challenge
 */
router.get('/:id/winner-selections', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    // Verify user is a participant
    const verifyQuery = `
      SELECT id FROM challenges
      WHERE id = $1
      AND (creator_id = $2 OR acceptor_id = $2)
    `;
    
    const verifyResult = await pool.query(verifyQuery, [id, userId]);
    
    if (verifyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Challenge not found or you are not a participant'
      });
    }
    
    // Get selections
    const query = `
      SELECT 
        ws.user_id,
        ws.selected_winner_id,
        ws.selected_at,
        u1.name as selector_name,
        u2.name as selected_winner_name
      FROM challenge_winner_selections ws
      JOIN users u1 ON ws.user_id = u1.id
      JOIN users u2 ON ws.selected_winner_id = u2.id
      WHERE ws.challenge_id = $1
      ORDER BY ws.selected_at DESC
    `;
    
    const result = await pool.query(query, [id]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching winner selections:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch winner selections'
    });
  }
});

/**
 * POST /api/challenges/:id/dispute
 * File a dispute
 */
router.post('/:id/dispute', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { type, description, evidence } = req.body;
    
    if (!type || !description) {
      return res.status(400).json({
        success: false,
        error: 'Dispute type and description are required'
      });
    }
    
    const query = `
      INSERT INTO challenge_disputes (
        challenge_id, filed_by, dispute_type, description, evidence
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    
    const result = await pool.query(query, [
      id,
      userId,
      type,
      description,
      JSON.stringify(evidence || [])
    ]);
    
    res.json({
      success: true,
      data: { disputeId: result.rows[0].id }
    });
  } catch (error) {
    logger.error('Error filing dispute:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to file dispute'
    });
  }
});

export default router;