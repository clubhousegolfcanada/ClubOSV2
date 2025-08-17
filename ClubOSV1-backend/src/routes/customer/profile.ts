import { Router, Request, Response } from 'express';
import { pool } from '../../utils/db';
import { body, validationResult } from 'express-validator';

interface CustomerRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
    sessionId?: string;
  };
}

const router = Router();

/**
 * Get current user's profile
 * GET /api/v2/customer/profile
 */
router.get('/', async (req: CustomerRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const result = await pool.query(
      `SELECT 
        u.id, u.email, u.name, u.phone, u.membership_type, u.membership_expires_at,
        cp.display_name, cp.avatar_url, cp.bio, cp.handicap, cp.home_location,
        cp.favorite_bay, cp.privacy_settings, cp.stats, cp.social_links,
        cp.notification_preferences, cp.created_at
       FROM users u
       LEFT JOIN customer_profiles cp ON u.id = cp.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * Update profile
 * PUT /api/v2/customer/profile
 */
router.put('/', [
  body('display_name').optional().trim().isLength({ min: 2, max: 50 }),
  body('bio').optional().trim().isLength({ max: 500 }),
  body('handicap').optional().isFloat({ min: -10, max: 54 }),
  body('home_location').optional().isIn(['Bedford', 'Dartmouth', 'Stratford', 'Bayers Lake', 'Truro']),
  body('favorite_bay').optional().matches(/^Bay \d+$/),
], async (req: CustomerRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user?.id;
    const {
      display_name,
      bio,
      handicap,
      home_location,
      favorite_bay,
      avatar_url,
      social_links
    } = req.body;

    // Update profile
    const result = await pool.query(
      `UPDATE customer_profiles 
       SET 
         display_name = COALESCE($2, display_name),
         bio = COALESCE($3, bio),
         handicap = COALESCE($4, handicap),
         home_location = COALESCE($5, home_location),
         favorite_bay = COALESCE($6, favorite_bay),
         avatar_url = COALESCE($7, avatar_url),
         social_links = COALESCE($8, social_links),
         updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING *`,
      [userId, display_name, bio, handicap, home_location, favorite_bay, avatar_url, social_links]
    );

    if (result.rows.length === 0) {
      // Create profile if it doesn't exist
      const createResult = await pool.query(
        `INSERT INTO customer_profiles 
         (user_id, display_name, bio, handicap, home_location, favorite_bay, avatar_url, social_links)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [userId, display_name, bio, handicap, home_location, favorite_bay, avatar_url, social_links]
      );
      return res.json(createResult.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * Update privacy settings
 * PUT /api/v2/customer/profile/privacy
 */
router.put('/privacy', async (req: CustomerRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { privacy_settings } = req.body;

    // Validate privacy settings
    const validVisibility = ['public', 'friends', 'private'];
    if (privacy_settings) {
      for (const [key, value] of Object.entries(privacy_settings)) {
        if (!validVisibility.includes(value as string)) {
          return res.status(400).json({ 
            error: `Invalid visibility setting for ${key}` 
          });
        }
      }
    }

    const result = await pool.query(
      `UPDATE customer_profiles 
       SET privacy_settings = $2, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING privacy_settings`,
      [userId, privacy_settings]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update privacy settings error:', error);
    res.status(500).json({ error: 'Failed to update privacy settings' });
  }
});

/**
 * Update notification preferences
 * PUT /api/v2/customer/profile/notifications
 */
router.put('/notifications', async (req: CustomerRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { notification_preferences } = req.body;

    const result = await pool.query(
      `UPDATE customer_profiles 
       SET notification_preferences = $2, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING notification_preferences`,
      [userId, notification_preferences]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

/**
 * Get public profile by user ID
 * GET /api/v2/customer/profile/:userId
 */
router.get('/:userId', async (req: CustomerRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const requesterId = req.user?.id;

    // Get profile with privacy check
    const result = await pool.query(
      `SELECT 
        u.id, u.name,
        cp.display_name, cp.avatar_url, cp.bio, cp.handicap, cp.home_location,
        cp.stats, cp.social_links, cp.privacy_settings
       FROM users u
       LEFT JOIN customer_profiles cp ON u.id = cp.user_id
       WHERE u.id = $1 AND u.is_customer = true`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = result.rows[0];
    const privacySettings = profile.privacy_settings || {};

    // Check if profiles are public or if users are friends
    if (privacySettings.profile_visibility === 'private' && userId !== requesterId) {
      // Check if they're friends
      const friendCheck = await pool.query(
        `SELECT 1 FROM friendships 
         WHERE status = 'accepted'
         AND ((user_id = $1 AND friend_id = $2) 
         OR (user_id = $2 AND friend_id = $1))`,
        [requesterId, userId]
      );

      if (friendCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Profile is private' });
      }
    }

    // Filter out private information based on privacy settings
    if (userId !== requesterId) {
      if (privacySettings.activity_visibility === 'private') {
        delete profile.stats;
      }
      delete profile.privacy_settings;
    }

    res.json(profile);
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * Delete account
 * DELETE /api/v2/customer/profile
 */
router.delete('/', async (req: CustomerRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password required to delete account' });
    }

    // Verify password
    const userResult = await pool.query(
      'SELECT password FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // TODO: Verify password with bcrypt
    // const validPassword = await bcrypt.compare(password, userResult.rows[0].password);
    // if (!validPassword) {
    //   return res.status(401).json({ error: 'Invalid password' });
    // }

    // Soft delete - mark as inactive
    await pool.query(
      'UPDATE users SET is_active = false WHERE id = $1',
      [userId]
    );

    // Revoke all tokens
    await pool.query(
      'DELETE FROM customer_auth_tokens WHERE user_id = $1',
      [userId]
    );

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;