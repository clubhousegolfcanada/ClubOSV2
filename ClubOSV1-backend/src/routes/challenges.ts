import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import challengeService from '../services/challengeService';
import clubCoinService from '../services/clubCoinService';
import pool from '../config/database';
import logger from '../utils/logger';
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
    
    const challenges = await challengeService.getUserChallenges(
      userId,
      status as string,
      parseInt(limit as string)
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
    
    // Validate input
    if (!acceptorId || !courseId || !courseName || !wagerAmount || !expiryDays) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
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