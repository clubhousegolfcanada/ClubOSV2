import { Router, Request, Response } from 'express';
import { pool } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';
import { Parser } from 'json2csv';

const router = Router();

// ============================================
// Configuration & Event Endpoints
// ============================================

// Get golf tour configuration (divisions, UI settings, sponsor info)
router.get('/config', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT key, value FROM golf_config');

    const config = result.rows.reduce((acc, row) => ({
      ...acc,
      [row.key]: row.value
    }), {});

    res.json(config);
  } catch (error) {
    console.error('Error fetching golf config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

// Get all events or specific event by code
router.get('/events/:eventCode?', async (req: Request, res: Response) => {
  try {
    const { eventCode } = req.params;

    let query = `
      SELECT id, event_code, event_name, course_name, event_date,
             hole_pars, course_par, is_active
      FROM golf_events
    `;

    if (eventCode) {
      query += ' WHERE event_code = $1';
      const result = await pool.query(query, [eventCode]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }

      res.json(result.rows[0]);
    } else {
      query += ' WHERE is_active = true ORDER BY event_date';
      const result = await pool.query(query);
      res.json(result.rows);
    }
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// ============================================
// Scorecard & Scoring Endpoints
// ============================================

// Submit score (creates player on first submission)
router.post('/score', async (req: Request, res: Response) => {
  try {
    const {
      sessionToken,
      eventCode,
      hole,
      score,
      playerInfo
    } = req.body;

    // Validate inputs
    if (!eventCode || !hole || score === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (hole < 1 || hole > 18) {
      return res.status(400).json({ error: 'Invalid hole number' });
    }

    if (score < 1 || score > 10) {
      return res.status(400).json({ error: 'Invalid score' });
    }

    // Get event ID
    const eventResult = await pool.query(
      'SELECT id FROM golf_events WHERE event_code = $1',
      [eventCode]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const eventId = eventResult.rows[0].id;

    let scorecardId;
    let newSessionToken = sessionToken;

    if (!sessionToken) {
      // First score submission - create new scorecard
      if (!playerInfo?.firstName || !playerInfo?.lastName || !playerInfo?.division) {
        return res.status(400).json({
          error: 'Player information required for first submission'
        });
      }

      // Generate new session token
      newSessionToken = uuidv4();

      // Create scorecard with first score
      const insertResult = await pool.query(
        `INSERT INTO golf_scorecards
         (event_id, first_name, last_name, division, home_club, email, phone,
          session_token, hole_scores)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         RETURNING id`,
        [
          eventId,
          playerInfo.firstName.trim(),
          playerInfo.lastName.trim(),
          playerInfo.division,
          playerInfo.homeClub || null,
          playerInfo.email || null,
          playerInfo.phone || null,
          newSessionToken,
          JSON.stringify({ [hole]: score })
        ]
      );

      scorecardId = insertResult.rows[0].id;

    } else {
      // Update existing scorecard
      const updateResult = await pool.query(
        `UPDATE golf_scorecards
         SET hole_scores = hole_scores || $1::jsonb
         WHERE session_token = $2
         RETURNING id, first_name, last_name`,
        [
          JSON.stringify({ [hole]: score }),
          sessionToken
        ]
      );

      if (updateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Scorecard not found' });
      }

      scorecardId = updateResult.rows[0].id;
    }

    // Get updated scorecard data
    const scorecardResult = await pool.query(
      `SELECT hole_scores, holes_completed, front_nine, back_nine,
              total_score, to_par, status
       FROM golf_scorecards WHERE id = $1`,
      [scorecardId]
    );

    res.json({
      success: true,
      sessionToken: newSessionToken,
      scorecardId,
      scorecard: scorecardResult.rows[0]
    });

  } catch (error) {
    console.error('Error saving score:', error);
    res.status(500).json({ error: 'Failed to save score' });
  }
});

// Get scorecard by session token
router.get('/scorecard/:sessionToken', async (req: Request, res: Response) => {
  try {
    const { sessionToken } = req.params;

    const result = await pool.query(
      `SELECT s.*, e.event_code, e.event_name, e.course_name, e.hole_pars
       FROM golf_scorecards s
       JOIN golf_events e ON s.event_id = e.id
       WHERE s.session_token = $1`,
      [sessionToken]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scorecard not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching scorecard:', error);
    res.status(500).json({ error: 'Failed to fetch scorecard' });
  }
});

// Find player by name (for returning users)
router.get('/find-player', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, eventCode } = req.query;

    if (!firstName || !lastName || !eventCode) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const result = await pool.query(
      `SELECT s.session_token, s.hole_scores, s.holes_completed,
              s.total_score, s.to_par, s.division, s.home_club
       FROM golf_scorecards s
       JOIN golf_events e ON s.event_id = e.id
       WHERE e.event_code = $1
         AND lower(s.first_name) = lower($2)
         AND lower(s.last_name) = lower($3)
       ORDER BY s.last_saved DESC
       LIMIT 1`,
      [eventCode, firstName, lastName]
    );

    if (result.rows.length > 0) {
      res.json({
        found: true,
        scorecard: result.rows[0]
      });
    } else {
      res.json({
        found: false,
        message: 'No scorecard found for this player'
      });
    }
  } catch (error) {
    console.error('Error finding player:', error);
    res.status(500).json({ error: 'Failed to find player' });
  }
});

// Complete round
router.post('/complete', async (req: Request, res: Response) => {
  try {
    const { sessionToken } = req.body;

    if (!sessionToken) {
      return res.status(400).json({ error: 'Session token required' });
    }

    const result = await pool.query(
      `UPDATE golf_scorecards
       SET status = 'completed', completed_at = NOW()
       WHERE session_token = $1 AND holes_completed = 18
       RETURNING id, total_score, to_par`,
      [sessionToken]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: 'Cannot complete - round not found or not all holes completed'
      });
    }

    res.json({
      success: true,
      finalScore: result.rows[0].total_score,
      toPar: result.rows[0].to_par
    });
  } catch (error) {
    console.error('Error completing round:', error);
    res.status(500).json({ error: 'Failed to complete round' });
  }
});

// ============================================
// Leaderboard Endpoints
// ============================================

// Get leaderboard for an event
router.get('/leaderboard/:eventCode', async (req: Request, res: Response) => {
  try {
    const { eventCode } = req.params;
    const { division = 'all' } = req.query;

    let query = `
      SELECT
        player_name,
        first_name,
        last_name,
        division,
        home_club,
        holes_completed,
        thru,
        front_nine,
        back_nine,
        total_score,
        to_par,
        status,
        CASE
          WHEN $1 = 'all' THEN position_overall
          ELSE position_in_division
        END as position
      FROM golf_leaderboard
      WHERE event_code = $2
    `;

    const params: any[] = [division, eventCode];

    if (division !== 'all') {
      query += ' AND division = $3';
      params.push(division);
    }

    query += ` ORDER BY position`;

    const result = await pool.query(query, params);

    // Format positions for ties
    const leaderboard = result.rows.map((row, index, arr) => {
      let displayPosition = row.position.toString();

      // Check for ties
      if (index > 0 && row.total_score === arr[index - 1].total_score &&
          row.holes_completed === arr[index - 1].holes_completed) {
        displayPosition = 'T' + arr[index - 1].position;
      } else if (index < arr.length - 1 && row.total_score === arr[index + 1].total_score &&
                 row.holes_completed === arr[index + 1].holes_completed) {
        displayPosition = 'T' + row.position;
      }

      return {
        ...row,
        displayPosition,
        scoreDisplay: row.to_par === 0 ? 'E' :
                      row.to_par > 0 ? `+${row.to_par}` :
                      row.to_par.toString()
      };
    });

    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get player count by division for an event
router.get('/player-counts/:eventCode', async (req: Request, res: Response) => {
  try {
    const { eventCode } = req.params;

    const result = await pool.query(
      `SELECT division, COUNT(*) as count
       FROM golf_scorecards s
       JOIN golf_events e ON s.event_id = e.id
       WHERE e.event_code = $1 AND s.status != 'withdrawn'
       GROUP BY division`,
      [eventCode]
    );

    const counts = result.rows.reduce((acc, row) => ({
      ...acc,
      [row.division]: parseInt(row.count)
    }), {
      all: result.rows.reduce((sum, row) => sum + parseInt(row.count), 0)
    });

    res.json(counts);
  } catch (error) {
    console.error('Error fetching player counts:', error);
    res.status(500).json({ error: 'Failed to fetch player counts' });
  }
});

// ============================================
// Export Endpoints (Admin)
// ============================================

// Simple admin authentication middleware
const adminAuth = (req: Request, res: Response, next: Function) => {
  const { password } = req.headers;

  // Simple password check - in production, use proper authentication
  if (password !== 'NSGolf2024Admin') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// Export event results as CSV
router.get('/export/:eventCode', adminAuth, async (req: Request, res: Response) => {
  try {
    const { eventCode } = req.params;
    const { format = 'csv' } = req.query;

    const result = await pool.query(
      `SELECT
        e.event_name,
        e.course_name,
        e.event_date,
        s.first_name,
        s.last_name,
        s.division,
        s.home_club,
        s.email,
        s.phone,
        s.hole_scores,
        s.front_nine,
        s.back_nine,
        s.total_score,
        s.to_par,
        s.status,
        s.started_at,
        s.completed_at
       FROM golf_scorecards s
       JOIN golf_events e ON s.event_id = e.id
       WHERE e.event_code = $1
       ORDER BY s.division, s.total_score`,
      [eventCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No data found for this event' });
    }

    // Format data for export
    const exportData = result.rows.map(row => ({
      'Event': row.event_name,
      'Course': row.course_name,
      'Date': row.event_date,
      'First Name': row.first_name,
      'Last Name': row.last_name,
      'Division': row.division,
      'Home Club': row.home_club || '',
      'Email': row.email || '',
      'Phone': row.phone || '',
      'Front Nine': row.front_nine || '',
      'Back Nine': row.back_nine || '',
      'Total Score': row.total_score || '',
      'To Par': row.to_par || '',
      'Status': row.status,
      'Started': row.started_at,
      'Completed': row.completed_at || ''
    }));

    if (format === 'csv') {
      const parser = new Parser();
      const csv = parser.parse(exportData);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${eventCode}-results.csv"`);
      res.send(csv);
    } else {
      res.json(exportData);
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Get summary statistics for all events
router.get('/stats', adminAuth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        e.event_code,
        e.event_name,
        COUNT(DISTINCT s.id) as total_players,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'completed') as completed_rounds,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'in_progress') as in_progress,
        AVG(s.total_score) FILTER (WHERE s.status = 'completed') as avg_score,
        MIN(s.total_score) FILTER (WHERE s.status = 'completed') as best_score,
        MAX(s.total_score) FILTER (WHERE s.status = 'completed') as worst_score
      FROM golf_events e
      LEFT JOIN golf_scorecards s ON e.id = s.event_id
      GROUP BY e.id, e.event_code, e.event_name
      ORDER BY e.event_date
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;