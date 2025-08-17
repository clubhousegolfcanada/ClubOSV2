import { Router, Request, Response } from 'express';
import { pool } from '../../config/database';
import { socialActionLimiter } from '../../middleware/customerRateLimit';

interface CustomerRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

const router = Router();

/**
 * Get friends list
 * GET /api/v2/customer/social/friends
 */
router.get('/friends', async (req: CustomerRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    const result = await pool.query(
      `SELECT 
        f.id, f.status, f.requested_at, f.accepted_at,
        u.id as friend_id, u.name, u.email,
        cp.display_name, cp.avatar_url, cp.home_location
       FROM friendships f
       JOIN users u ON (
         CASE 
           WHEN f.user_id = $1 THEN f.friend_id = u.id
           ELSE f.user_id = u.id
         END
       )
       LEFT JOIN customer_profiles cp ON u.id = cp.user_id
       WHERE (f.user_id = $1 OR f.friend_id = $1)
       AND f.status = 'accepted'
       ORDER BY f.accepted_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Failed to get friends' });
  }
});

/**
 * Send friend request
 * POST /api/v2/customer/social/friends/request
 */
router.post('/friends/request', socialActionLimiter, async (req: CustomerRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({ error: 'Friend ID required' });
    }

    if (userId === friendId) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    // Check if friendship already exists
    const existing = await pool.query(
      `SELECT status FROM friendships 
       WHERE (user_id = $1 AND friend_id = $2) 
       OR (user_id = $2 AND friend_id = $1)`,
      [userId, friendId]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Friend request already exists',
        status: existing.rows[0].status 
      });
    }

    // Create friend request
    await pool.query(
      `INSERT INTO friendships (user_id, friend_id, status)
       VALUES ($1, $2, 'pending')`,
      [userId, friendId]
    );

    // TODO: Send notification to friend

    res.json({ message: 'Friend request sent' });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

/**
 * Accept friend request
 * PUT /api/v2/customer/social/friends/accept/:requestId
 */
router.put('/friends/accept/:requestId', async (req: CustomerRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { requestId } = req.params;

    const result = await pool.query(
      `UPDATE friendships 
       SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND friend_id = $2 AND status = 'pending'
       RETURNING *`,
      [requestId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    res.json({ message: 'Friend request accepted' });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

/**
 * Get teams
 * GET /api/v2/customer/social/teams
 */
router.get('/teams', async (req: CustomerRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    const result = await pool.query(
      `SELECT 
        t.*,
        tm.role as member_role,
        tm.joined_at,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count
       FROM teams t
       JOIN team_members tm ON t.id = tm.team_id
       WHERE tm.user_id = $1 AND tm.is_active = true
       ORDER BY tm.joined_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Failed to get teams' });
  }
});

/**
 * Create team
 * POST /api/v2/customer/social/teams
 */
router.post('/teams', socialActionLimiter, async (req: CustomerRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { name, description, type, is_public, max_members } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name required' });
    }

    // Generate join code
    const joinCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create team
      const teamResult = await client.query(
        `INSERT INTO teams (name, description, owner_id, type, is_public, max_members, join_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [name, description, userId, type || 'casual', is_public || false, max_members || 20, joinCode]
      );

      const team = teamResult.rows[0];

      // Add creator as owner
      await client.query(
        `INSERT INTO team_members (team_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [team.id, userId]
      );

      await client.query('COMMIT');

      res.json(team);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

export default router;