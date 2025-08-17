import { Router, Request, Response } from 'express';
import { pool } from '../../config/database';

interface CustomerRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

const router = Router();

/**
 * Get user's TrackMan stats
 * GET /api/v2/customer/stats
 */
router.get('/', async (req: CustomerRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { start_date, end_date, location } = req.query;

    // Get TrackMan sessions
    const sessionsQuery = `
      SELECT 
        id, external_session_id, booking_id, location, bay_number,
        start_time, end_time, stats, highlights, is_public
      FROM trackman_sessions
      WHERE user_id = $1
    `;

    const params: any[] = [userId];
    let paramCount = 1;

    let dateFilter = '';
    if (start_date) {
      dateFilter += ` AND start_time >= $${++paramCount}`;
      params.push(start_date);
    }
    if (end_date) {
      dateFilter += ` AND end_time <= $${++paramCount}`;
      params.push(end_date);
    }
    if (location) {
      dateFilter += ` AND location = $${++paramCount}`;
      params.push(location);
    }

    const sessions = await pool.query(
      sessionsQuery + dateFilter + ' ORDER BY start_time DESC LIMIT 50',
      params
    );

    // Get profile stats
    const profileStats = await pool.query(
      'SELECT stats FROM customer_profiles WHERE user_id = $1',
      [userId]
    );

    res.json({
      profile_stats: profileStats.rows[0]?.stats || {},
      sessions: sessions.rows
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * Save TrackMan session
 * POST /api/v2/customer/stats/session
 */
router.post('/session', async (req: CustomerRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const {
      external_session_id,
      booking_id,
      location,
      bay_number,
      start_time,
      end_time,
      stats,
      highlights,
      is_public
    } = req.body;

    // Save session
    const result = await pool.query(
      `INSERT INTO trackman_sessions (
        user_id, external_session_id, booking_id, location, bay_number,
        start_time, end_time, stats, highlights, is_public
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        userId, external_session_id, booking_id, location, bay_number,
        start_time, end_time, stats || {}, highlights || [], is_public || false
      ]
    );

    // Update profile stats if better
    if (stats) {
      const profileResult = await pool.query(
        'SELECT stats FROM customer_profiles WHERE user_id = $1',
        [userId]
      );

      if (profileResult.rows.length > 0) {
        const currentStats = profileResult.rows[0].stats || {};
        const updatedStats = { ...currentStats };

        // Update stats if better
        if (stats.longest_drive && (!currentStats.longest_drive || stats.longest_drive > currentStats.longest_drive)) {
          updatedStats.longest_drive = stats.longest_drive;
        }
        if (stats.best_round && (!currentStats.best_round || stats.best_round < currentStats.best_round)) {
          updatedStats.best_round = stats.best_round;
        }

        // Increment rounds played
        updatedStats.rounds_played = (currentStats.rounds_played || 0) + 1;

        // Update average score
        if (stats.score) {
          const totalRounds = updatedStats.rounds_played;
          const currentAvg = currentStats.average_score || 0;
          updatedStats.average_score = ((currentAvg * (totalRounds - 1)) + stats.score) / totalRounds;
        }

        await pool.query(
          'UPDATE customer_profiles SET stats = $1 WHERE user_id = $2',
          [updatedStats, userId]
        );
      }
    }

    res.json({ 
      message: 'Session saved successfully',
      session_id: result.rows[0].id 
    });
  } catch (error) {
    console.error('Save session error:', error);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

/**
 * Get leaderboard
 * GET /api/v2/customer/stats/leaderboard
 */
router.get('/leaderboard', async (req: CustomerRequest, res: Response) => {
  try {
    const { metric, location, timeframe } = req.query;

    let query = `
      SELECT 
        u.id, u.name,
        cp.display_name, cp.avatar_url, cp.home_location, cp.stats
      FROM users u
      JOIN customer_profiles cp ON u.id = cp.user_id
      WHERE u.is_customer = true
      AND cp.privacy_settings->>'activity_visibility' != 'private'
    `;

    if (location) {
      query += ` AND cp.home_location = '${location}'`;
    }

    // Sort by metric
    switch (metric) {
      case 'longest_drive':
        query += ` AND cp.stats->>'longest_drive' IS NOT NULL
                   ORDER BY (cp.stats->>'longest_drive')::float DESC`;
        break;
      case 'best_round':
        query += ` AND cp.stats->>'best_round' IS NOT NULL
                   ORDER BY (cp.stats->>'best_round')::float ASC`;
        break;
      case 'rounds_played':
        query += ` ORDER BY (cp.stats->>'rounds_played')::int DESC`;
        break;
      default:
        query += ` ORDER BY (cp.stats->>'average_score')::float ASC`;
    }

    query += ` LIMIT 50`;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

/**
 * Share stats/achievement
 * POST /api/v2/customer/stats/share
 */
router.post('/share', async (req: CustomerRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { session_id, achievement, message, visibility } = req.body;

    // Add to activity feed
    await pool.query(
      `INSERT INTO activity_feed (user_id, actor_id, type, title, description, metadata, visibility)
       VALUES ($1, $1, 'achievement', $2, $3, $4, $5)`,
      [
        userId,
        achievement || 'Shared stats',
        message || '',
        JSON.stringify({ session_id }),
        visibility || 'friends'
      ]
    );

    res.json({ message: 'Stats shared successfully' });
  } catch (error) {
    console.error('Share stats error:', error);
    res.status(500).json({ error: 'Failed to share stats' });
  }
});

export default router;