import { Router, Request, Response } from 'express';
import { pool } from '../../utils/db';
import { eventLimiter } from '../../middleware/customerRateLimit';

interface CustomerRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

const router = Router();

/**
 * Get upcoming events
 * GET /api/v2/customer/events
 */
router.get('/', async (req: CustomerRequest, res: Response) => {
  try {
    const { type, location, status } = req.query;

    let query = `
      SELECT 
        e.*,
        u.name as creator_name,
        cp.display_name,
        (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id AND status = 'confirmed') as participant_count
      FROM events e
      JOIN users u ON e.created_by = u.id
      LEFT JOIN customer_profiles cp ON u.id = cp.user_id
      WHERE e.is_public = true
      AND e.start_date >= CURRENT_DATE
    `;

    const params: any[] = [];
    let paramCount = 0;

    if (type) {
      query += ` AND e.type = $${++paramCount}`;
      params.push(type);
    }

    if (location) {
      query += ` AND e.location = $${++paramCount}`;
      params.push(location);
    }

    if (status) {
      query += ` AND e.status = $${++paramCount}`;
      params.push(status);
    } else {
      query += ` AND e.status IN ('open', 'in_progress')`;
    }

    query += ` ORDER BY e.start_date ASC LIMIT 50`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

/**
 * Create event
 * POST /api/v2/customer/events
 */
router.post('/', eventLimiter, async (req: CustomerRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const {
      name, description, type, location, start_date, end_date,
      registration_deadline, max_participants, min_participants,
      entry_fee, format, rules, scoring_system, is_public,
      requires_approval, team_event
    } = req.body;

    if (!name || !type || !start_date) {
      return res.status(400).json({ error: 'Name, type, and start date required' });
    }

    const result = await pool.query(
      `INSERT INTO events (
        name, description, type, location, start_date, end_date,
        registration_deadline, max_participants, min_participants,
        entry_fee, format, rules, scoring_system, status, is_public,
        requires_approval, created_by, team_event
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'open', $14, $15, $16, $17)
      RETURNING *`,
      [
        name, description, type, location, start_date, end_date,
        registration_deadline, max_participants, min_participants || 2,
        entry_fee, format || {}, rules || {}, scoring_system,
        is_public !== false, requires_approval || false, userId, team_event || false
      ]
    );

    // Auto-register creator
    await pool.query(
      `INSERT INTO event_participants (event_id, user_id, status)
       VALUES ($1, $2, 'confirmed')`,
      [result.rows[0].id, userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

/**
 * Register for event
 * POST /api/v2/customer/events/:eventId/register
 */
router.post('/:eventId/register', eventLimiter, async (req: CustomerRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { eventId } = req.params;
    const { team_id } = req.body;

    // Get event details
    const eventResult = await pool.query(
      'SELECT * FROM events WHERE id = $1 AND status = $2',
      [eventId, 'open']
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found or registration closed' });
    }

    const event = eventResult.rows[0];

    // Check if already registered
    const existing = await pool.query(
      'SELECT * FROM event_participants WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Already registered for this event' });
    }

    // Check participant limit
    const participantCount = await pool.query(
      `SELECT COUNT(*) as count FROM event_participants 
       WHERE event_id = $1 AND status IN ('confirmed', 'registered')`,
      [eventId]
    );

    if (event.max_participants && participantCount.rows[0].count >= event.max_participants) {
      // Add to waitlist
      await pool.query(
        `INSERT INTO event_participants (event_id, user_id, team_id, status)
         VALUES ($1, $2, $3, 'waitlist')`,
        [eventId, userId, team_id]
      );
      return res.json({ message: 'Added to waitlist', status: 'waitlist' });
    }

    // Register for event
    const status = event.requires_approval ? 'registered' : 'confirmed';
    await pool.query(
      `INSERT INTO event_participants (event_id, user_id, team_id, status)
       VALUES ($1, $2, $3, $4)`,
      [eventId, userId, team_id, status]
    );

    res.json({ message: 'Registration successful', status });
  } catch (error) {
    console.error('Register for event error:', error);
    res.status(500).json({ error: 'Failed to register for event' });
  }
});

/**
 * Get my events
 * GET /api/v2/customer/events/my
 */
router.get('/my', async (req: CustomerRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    const result = await pool.query(
      `SELECT 
        e.*,
        ep.status as registration_status,
        ep.placement,
        ep.score
       FROM events e
       JOIN event_participants ep ON e.id = ep.event_id
       WHERE ep.user_id = $1
       ORDER BY e.start_date DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get my events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

export default router;