import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { pool } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/seasons/current
 * Get current active season
 */
router.get('/current', async (req, res) => {
  try {
    const query = `
      SELECT 
        s.*,
        (
          SELECT COUNT(DISTINCT user_id) 
          FROM seasonal_cc_earnings 
          WHERE season_id = s.id
        ) as total_players,
        (
          SELECT COUNT(*) 
          FROM challenges 
          WHERE season_id = s.id AND status = 'resolved'
        ) as total_challenges,
        (
          SELECT SUM(cc_net) 
          FROM seasonal_cc_earnings 
          WHERE season_id = s.id
        ) as total_cc_circulated
      FROM seasons s
      WHERE s.status = 'active'
      AND CURRENT_TIMESTAMP BETWEEN s.start_date AND s.end_date
      ORDER BY s.start_date DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active season found'
      });
    }
    
    const season = result.rows[0];
    
    res.json({
      success: true,
      data: {
        id: season.id,
        name: season.name,
        startDate: season.start_date,
        endDate: season.end_date,
        durationType: season.duration_type,
        status: season.status,
        totalPlayers: parseInt(season.total_players || 0),
        totalChallenges: parseInt(season.total_challenges || 0),
        totalCCCirculated: parseFloat(season.total_cc_circulated || 0),
        rankCutLines: season.rank_cut_lines,
        daysRemaining: Math.ceil((new Date(season.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      }
    });
  } catch (error) {
    logger.error('Error fetching current season:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch current season'
    });
  }
});

/**
 * GET /api/seasons
 * Get all seasons
 */
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        s.*,
        (
          SELECT COUNT(DISTINCT user_id) 
          FROM seasonal_cc_earnings 
          WHERE season_id = s.id
        ) as total_players
      FROM seasons s
      ORDER BY s.start_date DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      data: result.rows.map(season => ({
        id: season.id,
        name: season.name,
        startDate: season.start_date,
        endDate: season.end_date,
        durationType: season.duration_type,
        status: season.status,
        totalPlayers: parseInt(season.total_players || 0)
      }))
    });
  } catch (error) {
    logger.error('Error fetching seasons:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch seasons'
    });
  }
});

/**
 * GET /api/seasons/:id
 * Get specific season details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        s.*,
        (
          SELECT COUNT(DISTINCT user_id) 
          FROM seasonal_cc_earnings 
          WHERE season_id = s.id
        ) as total_players,
        (
          SELECT COUNT(*) 
          FROM challenges 
          WHERE season_id = s.id AND status = 'resolved'
        ) as total_challenges,
        (
          SELECT SUM(cc_net) 
          FROM seasonal_cc_earnings 
          WHERE season_id = s.id
        ) as total_cc_circulated
      FROM seasons s
      WHERE s.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Season not found'
      });
    }
    
    const season = result.rows[0];
    
    res.json({
      success: true,
      data: {
        id: season.id,
        name: season.name,
        startDate: season.start_date,
        endDate: season.end_date,
        durationType: season.duration_type,
        status: season.status,
        totalPlayers: parseInt(season.total_players || 0),
        totalChallenges: parseInt(season.total_challenges || 0),
        totalCCCirculated: parseFloat(season.total_cc_circulated || 0),
        rankCutLines: season.rank_cut_lines
      }
    });
  } catch (error) {
    logger.error('Error fetching season:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch season'
    });
  }
});

/**
 * GET /api/seasons/:id/leaderboard
 * Get leaderboard for specific season
 */
router.get('/:id/leaderboard', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 100 } = req.query;
    
    const query = `
      SELECT 
        u.id,
        u.name,
        ra.rank as season_rank,
        sce.cc_net,
        sce.challenges_completed,
        ra.win_rate,
        ra.percentile,
        RANK() OVER (ORDER BY sce.cc_net DESC) as position
      FROM seasonal_cc_earnings sce
      JOIN users u ON u.id = sce.user_id
      LEFT JOIN rank_assignments ra ON ra.user_id = u.id AND ra.season_id = sce.season_id
      WHERE sce.season_id = $1
      AND sce.cc_net > 0
      ORDER BY sce.cc_net DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [id, limit]);
    
    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        position: parseInt(row.position),
        seasonRank: row.season_rank,
        ccNet: parseFloat(row.cc_net || 0),
        challengesCompleted: parseInt(row.challenges_completed || 0),
        winRate: parseFloat(row.win_rate || 0),
        percentile: parseFloat(row.percentile || 1)
      }))
    });
  } catch (error) {
    logger.error('Error fetching season leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch season leaderboard'
    });
  }
});

export default router;