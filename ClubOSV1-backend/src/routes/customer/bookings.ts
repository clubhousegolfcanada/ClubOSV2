import { Router, Request, Response } from 'express';
import { pool } from '../../utils/db';
import { bookingLimiter } from '../../middleware/customerRateLimit';
import axios from 'axios';

interface CustomerRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
    sessionId?: string;
  };
}

const router = Router();

// Skedda API configuration (to be moved to env vars)
const SKEDDA_API_URL = process.env.SKEDDA_API_URL || 'https://api.skedda.com';
const SKEDDA_API_KEY = process.env.SKEDDA_API_KEY || '';

/**
 * Get user's bookings from Skedda
 * GET /api/v2/customer/bookings
 */
router.get('/', async (req: CustomerRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { start_date, end_date, location } = req.query;

    // TODO: Integrate with Skedda API
    // For now, return mock data
    const mockBookings = [
      {
        id: 'skedda-123',
        date: new Date().toISOString(),
        location: 'Bedford',
        bay: 'Bay 1',
        duration: 60,
        status: 'confirmed'
      }
    ];

    // Get shared bookings from database
    const sharedBookings = await pool.query(
      `SELECT 
        bs.*,
        u.name as shared_by_name,
        cp.display_name as shared_by_display_name
       FROM booking_shares bs
       JOIN users u ON bs.shared_by = u.id
       LEFT JOIN customer_profiles cp ON u.id = cp.user_id
       WHERE (bs.shared_with_user = $1 OR 
              bs.shared_with_team IN (
                SELECT team_id FROM team_members WHERE user_id = $1
              ))
       AND bs.booking_date >= CURRENT_DATE
       ORDER BY bs.booking_date ASC`,
      [userId]
    );

    res.json({
      personal_bookings: mockBookings,
      shared_bookings: sharedBookings.rows
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to get bookings' });
  }
});

/**
 * Share a booking
 * POST /api/v2/customer/bookings/share
 */
router.post('/share', bookingLimiter, async (req: CustomerRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const {
      skedda_booking_id,
      booking_date,
      bay_number,
      location,
      duration_minutes,
      shared_with_users,
      shared_with_teams,
      message,
      visibility,
      allow_join_requests,
      max_additional_players
    } = req.body;

    if (!skedda_booking_id || !booking_date) {
      return res.status(400).json({ error: 'Booking ID and date required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create booking share
      const shareResult = await client.query(
        `INSERT INTO booking_shares (
          skedda_booking_id, shared_by, booking_date, bay_number, location,
          duration_minutes, message, visibility, allow_join_requests,
          max_additional_players, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id`,
        [
          skedda_booking_id, userId, booking_date, bay_number, location,
          duration_minutes, message, visibility || 'friends', 
          allow_join_requests !== false, max_additional_players || 3,
          new Date(booking_date) // Expires when booking starts
        ]
      );

      const shareId = shareResult.rows[0].id;

      // Share with specific users
      if (shared_with_users && shared_with_users.length > 0) {
        for (const friendId of shared_with_users) {
          await client.query(
            `UPDATE booking_shares 
             SET shared_with_user = $1 
             WHERE id = $2`,
            [friendId, shareId]
          );
          
          // TODO: Send notification to user
        }
      }

      // Share with teams
      if (shared_with_teams && shared_with_teams.length > 0) {
        for (const teamId of shared_with_teams) {
          await client.query(
            `UPDATE booking_shares 
             SET shared_with_team = $1 
             WHERE id = $2`,
            [teamId, shareId]
          );
          
          // TODO: Send notification to team members
        }
      }

      // Add to activity feed
      await client.query(
        `INSERT INTO activity_feed (user_id, actor_id, type, title, description, metadata, visibility)
         VALUES ($1, $1, 'booking_shared', 'Shared a booking', $2, $3, $4)`,
        [
          userId,
          `Shared ${bay_number} at ${location} for ${new Date(booking_date).toLocaleDateString()}`,
          JSON.stringify({ booking_share_id: shareId, skedda_booking_id }),
          visibility || 'friends'
        ]
      );

      await client.query('COMMIT');

      res.json({ 
        message: 'Booking shared successfully',
        share_id: shareId 
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Share booking error:', error);
    res.status(500).json({ error: 'Failed to share booking' });
  }
});

/**
 * Accept booking share invitation
 * PUT /api/v2/customer/bookings/share/:shareId/accept
 */
router.put('/share/:shareId/accept', async (req: CustomerRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { shareId } = req.params;

    // Check if user is invited
    const shareResult = await pool.query(
      `SELECT * FROM booking_shares 
       WHERE id = $1 
       AND (shared_with_user = $2 OR 
            shared_with_team IN (
              SELECT team_id FROM team_members WHERE user_id = $2
            ))
       AND expires_at > CURRENT_TIMESTAMP`,
      [shareId, userId]
    );

    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking share not found or expired' });
    }

    // Check if already accepted
    const existing = await pool.query(
      `SELECT * FROM booking_share_participants 
       WHERE booking_share_id = $1 AND user_id = $2`,
      [shareId, userId]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Already accepted this booking' });
    }

    // Check max participants
    const participantCount = await pool.query(
      `SELECT COUNT(*) as count FROM booking_share_participants 
       WHERE booking_share_id = $1 AND status = 'confirmed'`,
      [shareId]
    );

    const share = shareResult.rows[0];
    if (participantCount.rows[0].count >= share.max_additional_players) {
      return res.status(409).json({ error: 'Booking is full' });
    }

    // Accept invitation
    await pool.query(
      `INSERT INTO booking_share_participants (booking_share_id, user_id, status, responded_at)
       VALUES ($1, $2, 'confirmed', CURRENT_TIMESTAMP)`,
      [shareId, userId]
    );

    res.json({ message: 'Booking accepted' });
  } catch (error) {
    console.error('Accept booking error:', error);
    res.status(500).json({ error: 'Failed to accept booking' });
  }
});

/**
 * Get upcoming shared bookings
 * GET /api/v2/customer/bookings/shared
 */
router.get('/shared', async (req: CustomerRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    // Get bookings shared with user or their teams
    const result = await pool.query(
      `SELECT 
        bs.*,
        u.name as shared_by_name,
        cp.display_name,
        cp.avatar_url,
        (SELECT COUNT(*) FROM booking_share_participants 
         WHERE booking_share_id = bs.id AND status = 'confirmed') as confirmed_count,
        bsp.status as my_status
       FROM booking_shares bs
       JOIN users u ON bs.shared_by = u.id
       LEFT JOIN customer_profiles cp ON u.id = cp.user_id
       LEFT JOIN booking_share_participants bsp ON bs.id = bsp.booking_share_id AND bsp.user_id = $1
       WHERE bs.booking_date >= CURRENT_DATE
       AND bs.expires_at > CURRENT_TIMESTAMP
       AND (
         bs.visibility = 'public' OR
         bs.shared_with_user = $1 OR
         bs.shared_with_team IN (
           SELECT team_id FROM team_members WHERE user_id = $1
         ) OR
         bs.shared_by IN (
           SELECT CASE 
             WHEN user_id = $1 THEN friend_id 
             ELSE user_id 
           END
           FROM friendships 
           WHERE (user_id = $1 OR friend_id = $1) 
           AND status = 'accepted'
         )
       )
       ORDER BY bs.booking_date ASC
       LIMIT 20`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get shared bookings error:', error);
    res.status(500).json({ error: 'Failed to get shared bookings' });
  }
});

export default router;