import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { AppError } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { body, query, param } from 'express-validator';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

const router = Router();

// Apply auth to all routes
router.use(authenticate);

// Rate limiting for friend requests
const friendRequestLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10, // 10 friend requests per day
  message: 'Too many friend requests. Please try again tomorrow.'
});

// Helper to hash contact info for privacy
const hashContact = (contact: string, type: 'email' | 'phone'): string => {
  const normalized = type === 'email' 
    ? contact.toLowerCase().trim()
    : contact.replace(/\D/g, ''); // Remove non-digits from phone
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

// GET /api/friends - Get user's friends list
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { status = 'accepted', include_stats = false } = req.query;

    const query = `
      SELECT 
        f.*,
        u.id as friend_user_id,
        u.email as friend_email,
        u.name as friend_name,
        u.phone as friend_phone,
        u.last_login as friend_last_login,
        cp.display_name as friend_display_name,
        cp.bio as friend_bio,
        cp.avatar_url as friend_avatar,
        cp.handicap as friend_handicap,
        cp.home_location as friend_home_location,
        cp.total_rounds as friend_total_rounds,
        cp.profile_visibility as friend_visibility,
        cp.current_rank as friend_rank,
        cp.cc_balance as friend_cc_balance,
        cp.total_challenges_won as friend_challenges_won,
        cp.total_challenges_played as friend_challenges_played,
        CASE 
          WHEN cp.total_challenges_played > 0 
          THEN ROUND((cp.total_challenges_won::numeric / cp.total_challenges_played::numeric) * 100, 1)
          ELSE 0 
        END as friend_win_rate,
        COALESCE((SELECT COUNT(*) FROM user_achievements WHERE user_id = u.id), 0) as friend_achievement_count,
        COALESCE((SELECT SUM(a.points) FROM user_achievements ua JOIN achievements a ON a.id = ua.achievement_id WHERE ua.user_id = u.id), 0) as friend_achievement_points,
        (
          SELECT json_agg(json_build_object(
            'id', a.id,
            'code', a.code,
            'name', a.name,
            'icon', a.icon,
            'rarity', a.rarity,
            'category', a.category
          ) ORDER BY 
            CASE a.rarity 
              WHEN 'legendary' THEN 4
              WHEN 'epic' THEN 3
              WHEN 'rare' THEN 2
              WHEN 'common' THEN 1
            END DESC,
            ua.awarded_at DESC
          )
          FROM user_achievements ua
          JOIN achievements a ON a.id = ua.achievement_id
          WHERE ua.user_id = u.id 
            AND ua.is_featured = true
            AND (ua.expires_at IS NULL OR ua.expires_at > NOW())
          LIMIT 3
        ) as friend_featured_achievements,
        EXISTS(
          SELECT 1 FROM champion_markers cm 
          WHERE cm.user_id = u.id 
          AND cm.is_active = true 
          AND (cm.expires_at IS NULL OR cm.expires_at > CURRENT_TIMESTAMP)
        ) as has_champion_marker
        ${include_stats ? `, 
          f.clubcoin_wagers_count,
          f.clubcoin_wagers_total,
          f.last_wager_date,
          (SELECT COUNT(*) FROM friendships f2 
           WHERE (f2.user_id = u.id OR f2.friend_id = u.id) 
           AND f2.status = 'accepted') as friend_count
        ` : ''}
      FROM friendships f
      JOIN users u ON (
        CASE 
          WHEN f.user_id = $1 THEN f.friend_id = u.id
          ELSE f.user_id = u.id
        END
      )
      LEFT JOIN customer_profiles cp ON cp.user_id = u.id
      WHERE (f.user_id = $1 OR f.friend_id = $1)
        AND f.status = $2
      ORDER BY f.accepted_at DESC NULLS LAST, f.requested_at DESC
    `;

    const result = await db.query(query, [userId, status]);
    
    // Filter based on privacy settings
    const friends = result.rows.map(row => {
      const isPrivate = row.friend_visibility === 'private';
      return {
        id: row.friend_user_id,
        friendship_id: row.id,
        user_id: row.friend_user_id,
        email: row.friend_email,
        name: row.friend_display_name || row.friend_name,
        avatar_url: isPrivate ? null : row.friend_avatar,
        bio: isPrivate ? null : row.friend_bio,
        handicap: isPrivate ? null : row.friend_handicap,
        home_location: row.friend_home_location,
        rank: row.friend_rank,
        rank_tier: row.friend_rank || 'House', // Add for compatibility
        ccBalance: row.friend_cc_balance,
        cc_balance: parseFloat(row.friend_cc_balance || 0), // Add for compatibility
        clubcoin_balance: parseFloat(row.friend_cc_balance || 0), // Add for compete page
        hasChampionMarker: row.has_champion_marker,
        has_champion_marker: row.has_champion_marker, // Add for compatibility
        status: row.status,
        requested_at: row.requested_at,
        accepted_at: row.accepted_at,
        mutual_friends_count: row.mutual_friends_count || 0,
        friendship_source: row.friendship_source,
        last_active: row.friend_last_login,
        is_friend: true, // They are friends if in this list
        has_pending_request: false, // Not pending if accepted
        // Actual challenge stats from database
        total_challenges_won: parseInt(row.friend_challenges_won || 0),
        total_challenges_played: parseInt(row.friend_challenges_played || 0),
        win_rate: parseFloat(row.friend_win_rate || 0),
        // Achievement data
        achievement_count: parseInt(row.friend_achievement_count || 0),
        achievement_points: parseInt(row.friend_achievement_points || 0),
        featured_achievements: row.friend_featured_achievements || [],
        // Wager stats if requested
        ...(include_stats && !isPrivate ? {
          wagers_together: row.clubcoin_wagers_count || 0,
          wagers_won: 0, // Would need additional query
          total_wagered: row.clubcoin_wagers_total || 0,
          last_wager: row.last_wager_date,
          total_friends: row.friend_count || 0
        } : {})
      };
    });

    res.json({
      success: true,
      data: {
        friends,
        total: friends.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/friends/pending - Get pending friend requests
router.get('/pending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { direction = 'both' } = req.query; // incoming, outgoing, both

    let whereClause = '';
    if (direction === 'incoming') {
      whereClause = 'f.friend_id = $1';
    } else if (direction === 'outgoing') {
      whereClause = 'f.user_id = $1';
    } else {
      whereClause = '(f.user_id = $1 OR f.friend_id = $1)';
    }

    const query = `
      SELECT 
        f.*,
        requester.id as requester_id,
        requester.email as requester_email,
        requester.name as requester_name,
        cp.display_name as requester_display_name,
        cp.avatar_url as requester_avatar,
        cp.bio as requester_bio,
        cp.home_location as requester_location,
        CASE 
          WHEN f.user_id = $1 THEN 'outgoing'
          ELSE 'incoming'
        END as request_direction
      FROM friendships f
      JOIN Users requester ON (
        CASE 
          WHEN f.friend_id = $1 THEN f.user_id = requester.id
          ELSE f.friend_id = requester.id
        END
      )
      LEFT JOIN customer_profiles cp ON cp.user_id = requester.id
      WHERE ${whereClause}
        AND f.status = 'pending'
      ORDER BY f.requested_at DESC
    `;

    const result = await db.query(query, [userId]);
    
    const requests = result.rows.map(row => ({
      id: row.id,
      user_id: row.requester_id,
      email: row.requester_email,
      name: row.requester_display_name || row.requester_name,
      avatar_url: row.requester_avatar,
      bio: row.requester_bio,
      location: row.requester_location,
      direction: row.request_direction,
      message: row.invitation_message,
      requested_at: row.requested_at,
      mutual_friends: row.mutual_friends_count || 0
    }));

    res.json({
      success: true,
      data: {
        requests,
        incoming: requests.filter(r => r.direction === 'incoming').length,
        outgoing: requests.filter(r => r.direction === 'outgoing').length
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/friends/request - Send friend request
router.post('/request',
  friendRequestLimiter,
  validate([
    body('target_email').optional().isEmail().normalizeEmail(),
    body('target_phone').optional().isMobilePhone('any'),
    body('target_user_id').optional().isUUID(),
    body('message').optional().isString().isLength({ max: 500 })
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { target_email, target_phone, target_user_id, message } = req.body;

      // Must provide one identifier
      if (!target_email && !target_phone && !target_user_id) {
        throw new AppError('Must provide email, phone, or user ID', 400);
      }

      let targetUserId = target_user_id;
      
      // Prevent self-friending early
      if (targetUserId && targetUserId === userId) {
        throw new AppError('You cannot send a friend request to yourself', 400);
      }

      // Find user by email or phone if not provided directly
      if (!targetUserId) {
        let query = '';
        let params: any[] = [];

        if (target_email) {
          query = 'SELECT id FROM users WHERE email = $1 AND role = $2';
          params = [target_email.toLowerCase(), 'customer'];
        } else if (target_phone) {
          const normalizedPhone = target_phone.replace(/\D/g, '');
          query = 'SELECT id FROM users WHERE phone = $1 AND role = $2';
          params = [normalizedPhone, 'customer'];
        }

        const result = await db.query(query, params);
        
        if (result.rows.length === 0) {
          // User doesn't exist - create invitation
          const invitationId = uuidv4();
          await db.query(
            `INSERT INTO friend_invitations 
            (id, inviter_id, invitee_email, invitee_phone, message, sent_via)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [invitationId, userId, target_email, target_phone, message, target_email ? 'email' : 'sms']
          );

          // TODO: Send email/SMS invitation

          return res.json({
            success: true,
            data: {
              type: 'invitation',
              invitation_id: invitationId,
              message: 'Friend invitation sent. They will receive an invite to join ClubOS.'
            }
          });
        }

        targetUserId = result.rows[0].id;
      }

      // Check for self-friending after email/phone lookup
      if (targetUserId === userId) {
        throw new AppError('You cannot send a friend request to yourself', 400);
      }

      // Check if already friends or request exists
      const existingCheck = await db.query(
        `SELECT * FROM friendships 
         WHERE ((user_id = $1 AND friend_id = $2) 
            OR (user_id = $2 AND friend_id = $1))`,
        [userId, targetUserId]
      );

      if (existingCheck.rows.length > 0) {
        const existing = existingCheck.rows[0];
        if (existing.status === 'accepted') {
          throw new AppError('Already friends with this user', 400);
        } else if (existing.status === 'pending') {
          throw new AppError('Friend request already pending', 400);
        } else if (existing.status === 'blocked') {
          throw new AppError('Cannot send friend request to this user', 403);
        }
      }

      // Check if user is blocked
      const blockCheck = await db.query(
        `SELECT * FROM user_blocks 
         WHERE (user_id = $1 AND blocked_user_id = $2)
            OR (user_id = $2 AND blocked_user_id = $1)`,
        [userId, targetUserId]
      );

      if (blockCheck.rows.length > 0) {
        throw new AppError('Cannot send friend request to this user', 403);
      }

      // Calculate mutual friends
      const mutualFriendsCount = await db.query(
        `SELECT calculate_mutual_friends($1, $2) as count`,
        [userId, targetUserId]
      );

      // Create friend request
      const requestId = uuidv4();
      await db.query(
        `INSERT INTO friendships 
        (id, user_id, friend_id, status, invitation_message, 
         invitation_method, mutual_friends_count, friendship_source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [requestId, userId, targetUserId, 'pending', message, 
         'in_app', mutualFriendsCount.rows[0].count, 'direct_request']
      );

      // TODO: Send push notification to target user

      res.json({
        success: true,
        data: {
          type: 'request',
          request_id: requestId,
          message: 'Friend request sent successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/friends/:id/accept - Accept friend request
router.put('/:id/accept',
  validate([
    param('id').isUUID()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const requestId = req.params.id;

      // Find the request
      const request = await db.query(
        `SELECT * FROM friendships 
         WHERE id = $1 AND friend_id = $2 AND status = 'pending'`,
        [requestId, userId]
      );

      if (request.rows.length === 0) {
        throw new AppError('Friend request not found', 404);
      }

      // Accept the request
      await db.query(
        `UPDATE friendships 
         SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [requestId]
      );

      // TODO: Send notification to requester

      res.json({
        success: true,
        message: 'Friend request accepted'
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/friends/:id/reject - Reject friend request
router.put('/:id/reject',
  validate([
    param('id').isUUID()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const requestId = req.params.id;

      // Delete the request (rejection = deletion)
      const result = await db.query(
        `DELETE FROM friendships 
         WHERE id = $1 AND friend_id = $2 AND status = 'pending'
         RETURNING *`,
        [requestId, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Friend request not found', 404);
      }

      res.json({
        success: true,
        message: 'Friend request rejected'
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/friends/:id - Remove friend
router.delete('/:id',
  validate([
    param('id').isUUID()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const friendshipId = req.params.id;

      // Delete the friendship
      const result = await db.query(
        `DELETE FROM friendships 
         WHERE id = $1 
           AND (user_id = $2 OR friend_id = $2)
           AND status = 'accepted'
         RETURNING *`,
        [friendshipId, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Friendship not found', 404);
      }

      res.json({
        success: true,
        message: 'Friend removed successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/friends/search - Search for friends
router.post('/search',
  validate([
    body('query').notEmpty().isString(),
    body('type').optional().isIn(['email', 'phone', 'name'])
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { query: searchQuery, type = 'all' } = req.body;

      let whereClause = '';
      let params: any[] = [userId];
      let paramIndex = 2;

      if (type === 'email') {
        whereClause = `u.email = $${paramIndex}`;
        params.push(searchQuery.toLowerCase());
      } else if (type === 'phone') {
        const normalizedPhone = searchQuery.replace(/\D/g, '');
        whereClause = `u.phone = $${paramIndex}`;
        params.push(normalizedPhone);
      } else if (type === 'name') {
        whereClause = `(LOWER(u.name) LIKE $${paramIndex} OR LOWER(cp.display_name) LIKE $${paramIndex})`;
        params.push(`%${searchQuery.toLowerCase()}%`);
      } else {
        // Search all fields
        const normalizedPhone = searchQuery.replace(/\D/g, '');
        whereClause = `(
          u.email = $${paramIndex} OR 
          u.phone = $${paramIndex + 1} OR
          LOWER(u.name) LIKE $${paramIndex + 2} OR 
          LOWER(cp.display_name) LIKE $${paramIndex + 2}
        )`;
        params.push(searchQuery.toLowerCase(), normalizedPhone, `%${searchQuery.toLowerCase()}%`);
      }

      const query = `
        SELECT 
          u.id,
          u.email,
          u.name,
          u.phone,
          cp.display_name,
          cp.avatar_url,
          cp.bio,
          cp.home_location,
          cp.profile_visibility,
          f.status as friendship_status,
          calculate_mutual_friends($1, u.id) as mutual_friends
        FROM users u
        LEFT JOIN customer_profiles cp ON cp.user_id = u.id
        LEFT JOIN friendships f ON 
          ((f.user_id = $1 AND f.friend_id = u.id) OR 
           (f.user_id = u.id AND f.friend_id = $1))
        WHERE u.role = 'customer' 
          AND u.id != $1
          AND ${whereClause}
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks 
            WHERE (user_id = $1 AND blocked_user_id = u.id)
               OR (user_id = u.id AND blocked_user_id = $1)
          )
        LIMIT 20
      `;

      const result = await db.query(query, params);
      
      const users = result.rows.map(row => ({
        id: row.id,
        email: row.email,
        name: row.display_name || row.name,
        avatar_url: row.profile_visibility !== 'private' ? row.avatar_url : null,
        bio: row.profile_visibility === 'public' ? row.bio : null,
        location: row.home_location,
        friendship_status: row.friendship_status,
        mutual_friends: row.mutual_friends || 0,
        can_add: !row.friendship_status || row.friendship_status === 'blocked'
      }));

      res.json({
        success: true,
        data: {
          users,
          total: users.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/friends/suggestions - Get friend suggestions
router.get('/suggestions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { limit = 10 } = req.query;

    // Get suggestions based on mutual friends and location
    const query = `
      WITH user_location AS (
        SELECT home_location FROM customer_profiles WHERE user_id = $1
      ),
      potential_friends AS (
        SELECT 
          u.id,
          u.email,
          u.name,
          cp.display_name,
          cp.avatar_url,
          cp.bio,
          cp.home_location,
          cp.profile_visibility,
          calculate_mutual_friends($1, u.id) as mutual_friends,
          CASE 
            WHEN cp.home_location = (SELECT home_location FROM user_location) THEN 1
            ELSE 0
          END as same_location
        FROM users u
        JOIN customer_profiles cp ON cp.user_id = u.id
        WHERE u.role = 'customer'
          AND u.id != $1
          AND NOT EXISTS (
            SELECT 1 FROM friendships f
            WHERE (f.user_id = $1 AND f.friend_id = u.id)
               OR (f.user_id = u.id AND f.friend_id = $1)
          )
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks
            WHERE (user_id = $1 AND blocked_user_id = u.id)
               OR (user_id = u.id AND blocked_user_id = $1)
          )
          AND NOT EXISTS (
            SELECT 1 FROM friend_suggestions fs
            WHERE fs.user_id = $1 AND fs.suggested_user_id = u.id
              AND fs.dismissed = true
          )
      )
      SELECT * FROM potential_friends
      WHERE mutual_friends > 0 OR same_location = 1
      ORDER BY mutual_friends DESC, same_location DESC
      LIMIT $2
    `;

    const result = await db.query(query, [userId, parseInt(limit as string)]);
    
    const suggestions = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      name: row.display_name || row.name,
      avatar_url: row.profile_visibility !== 'private' ? row.avatar_url : null,
      bio: row.profile_visibility === 'public' ? row.bio : null,
      location: row.home_location,
      mutual_friends: row.mutual_friends || 0,
      same_location: row.same_location === 1,
      reason: row.mutual_friends > 0 ? 'mutual_friends' : 'same_location'
    }));

    // Store suggestions for tracking
    for (const suggestion of suggestions) {
      await db.query(
        `INSERT INTO friend_suggestions 
        (user_id, suggested_user_id, reason, mutual_friends_count, relevance_score)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, suggested_user_id) 
        DO UPDATE SET updated_at = CURRENT_TIMESTAMP`,
        [userId, suggestion.id, suggestion.reason, suggestion.mutual_friends, 
         (suggestion.mutual_friends * 0.7 + suggestion.same_location * 0.3)]
      );
    }

    res.json({
      success: true,
      data: {
        suggestions,
        total: suggestions.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/friends/:id/block - Block user
router.put('/:id/block',
  validate([
    param('id').isUUID(),
    body('reason').optional().isString()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const blockUserId = req.params.id;
      const { reason } = req.body;

      // Remove any existing friendship
      await db.query(
        `DELETE FROM friendships 
         WHERE (user_id = $1 AND friend_id = $2)
            OR (user_id = $2 AND friend_id = $1)`,
        [userId, blockUserId]
      );

      // Create block record
      await db.query(
        `INSERT INTO user_blocks 
        (user_id, blocked_user_id, reason)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, blocked_user_id) DO NOTHING`,
        [userId, blockUserId, reason]
      );

      res.json({
        success: true,
        message: 'User blocked successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/friends/blocked - Get blocked users
router.get('/blocked', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const result = await db.query(
      `SELECT 
        ub.*,
        u.email,
        u.name,
        cp.display_name
      FROM user_blocks ub
      JOIN Users u ON u.id = ub.blocked_user_id
      LEFT JOIN customer_profiles cp ON cp.user_id = u.id
      WHERE ub.user_id = $1
      ORDER BY ub.blocked_at DESC`,
      [userId]
    );

    const blocked = result.rows.map(row => ({
      id: row.id,
      user_id: row.blocked_user_id,
      email: row.email,
      name: row.display_name || row.name,
      reason: row.reason,
      blocked_at: row.blocked_at
    }));

    res.json({
      success: true,
      data: {
        blocked,
        total: blocked.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/friends/blocked/:id - Unblock user
router.delete('/blocked/:id',
  validate([
    param('id').isUUID()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const unblockUserId = req.params.id;

      const result = await db.query(
        `DELETE FROM user_blocks 
         WHERE user_id = $1 AND blocked_user_id = $2
         RETURNING *`,
        [userId, unblockUserId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Block record not found', 404);
      }

      res.json({
        success: true,
        message: 'User unblocked successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/friends/sync-contacts - Sync phone contacts
router.post('/sync-contacts',
  validate([
    body('contacts').isArray(),
    body('contacts.*.email').optional().isEmail(),
    body('contacts.*.phone').optional().isMobilePhone('any'),
    body('contacts.*.name').optional().isString()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { contacts } = req.body;

      const matches = [];
      
      for (const contact of contacts) {
        if (!contact.email && !contact.phone) continue;

        // Hash the contact info
        const hashes = [];
        if (contact.email) {
          hashes.push({
            hash: hashContact(contact.email, 'email'),
            type: 'email'
          });
        }
        if (contact.phone) {
          hashes.push({
            hash: hashContact(contact.phone, 'phone'),
            type: 'phone'
          });
        }

        // Check for matches in database
        for (const { hash, type } of hashes) {
          // Store the sync record
          await db.query(
            `INSERT INTO contact_sync 
            (user_id, contact_hash, contact_type, contact_name, source)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id, contact_hash) 
            DO UPDATE SET synced_at = CURRENT_TIMESTAMP`,
            [userId, hash, type, contact.name, 'manual']
          );

          // Check for matching user
          let matchQuery = '';
          let matchValue = '';
          
          if (type === 'email' && contact.email) {
            matchQuery = 'SELECT id, name FROM users WHERE email = $1 AND role = $2';
            matchValue = contact.email.toLowerCase();
          } else if (type === 'phone' && contact.phone) {
            matchQuery = 'SELECT id, name FROM users WHERE phone = $1 AND role = $2';
            matchValue = contact.phone.replace(/\D/g, '');
          }

          if (matchQuery) {
            const matchResult = await db.query(matchQuery, [matchValue, 'customer']);
            
            if (matchResult.rows.length > 0) {
              const matchedUser = matchResult.rows[0];
              
              // Update sync record with match
              await db.query(
                `UPDATE contact_sync 
                 SET matched_user_id = $1, match_confidence = 1.0
                 WHERE user_id = $2 AND contact_hash = $3`,
                [matchedUser.id, userId, hash]
              );

              // Check friendship status
              const friendshipCheck = await db.query(
                `SELECT status FROM friendships 
                 WHERE (user_id = $1 AND friend_id = $2)
                    OR (user_id = $2 AND friend_id = $1)`,
                [userId, matchedUser.id]
              );

              matches.push({
                contact_name: contact.name,
                matched_user: matchedUser.name,
                is_friend: friendshipCheck.rows.length > 0 && 
                          friendshipCheck.rows[0].status === 'accepted',
                friendship_status: friendshipCheck.rows[0]?.status || 'none'
              });
            }
          }
        }
      }

      res.json({
        success: true,
        data: {
          synced: contacts.length,
          matched: matches.length,
          matches
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;