import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { hubspotService } from '../services/hubspotService';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../services/cacheService';

const router = Router();

// GET /api/customer-profile - Get current customer's profile with HubSpot data
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const userEmail = req.user!.email;
    const userPhone = req.user!.phone;

    // Use cache for the entire profile data
    const profileData = await cacheService.withCache(
      CACHE_KEYS.USER_BY_ID(userId),
      async () => {
        // Get customer profile from database
        const profileResult = await db.query(`
          SELECT
            cp.*,
            u.name as auth_name,
            u.email,
            u.phone
          FROM customer_profiles cp
          JOIN users u ON u.id = cp.user_id
          WHERE cp.user_id = $1
        `, [userId]);

        let profile = profileResult.rows[0] || null;

        // Try to get HubSpot data if we have phone or email
        let hubspotName = null;
        let hubspotCompany = null;

        if (userPhone || userEmail) {
          try {
            // Cache HubSpot data separately with longer TTL
            const hubspotCacheKey = `hubspot:${userPhone || userEmail}`;
            const hubspotData = await cacheService.withCache(
              hubspotCacheKey,
              async () => {
                // First check HubSpot cache in database
                const cacheResult = await db.query(`
                  SELECT customer_name, company, email, hubspot_contact_id
                  FROM hubspot_cache
                  WHERE phone_number = $1 OR email = $2
                  ORDER BY updated_at DESC
                  LIMIT 1
                `, [userPhone || '', userEmail || '']);

                if (cacheResult.rows.length > 0) {
                  return {
                    name: cacheResult.rows[0].customer_name,
                    company: cacheResult.rows[0].company
                  };
                } else if (hubspotService.isHubSpotConnected()) {
                  // If not in cache, try to fetch from HubSpot
                  const hubspotContacts = await hubspotService.searchContacts(userPhone || userEmail || '');
                  if (hubspotContacts && hubspotContacts.length > 0) {
                    const contact = hubspotContacts[0];
                    return {
                      name: contact.name,
                      company: contact.company
                    };
                  }
                }
                return { name: null, company: null };
              },
              { ttl: CACHE_TTL.LONG } // 15 minutes for HubSpot data
            );

            hubspotName = hubspotData.name;
            hubspotCompany = hubspotData.company;
          } catch (error) {
            logger.error('Error fetching HubSpot data:', error);
          }
        }

        // Determine the best name to use (prioritize HubSpot name)
        const displayName = hubspotName || profile?.display_name || profile?.auth_name || req.user!.name;

        // Return the complete profile data
        return {
          id: userId,
          displayName,
          hubspotName,
          company: hubspotCompany,
          email: userEmail,
          phone: userPhone,
          bio: profile?.bio,
          handicap: profile?.handicap,
          homeLocation: profile?.home_location,
          homeGolfCourse: profile?.home_golf_course,
          totalRounds: profile?.total_rounds || 0,
          averageScore: profile?.average_score || 0,
          bestScore: profile?.best_score || 0,
          favoriteCourse: profile?.favorite_course,
          profileVisibility: profile?.profile_visibility || 'friends',
          showBookings: profile?.show_bookings !== false,
          showStats: profile?.show_stats !== false,
          showFriends: profile?.show_friends !== false,
          preferredTeeTime: profile?.preferred_tee_time,
          preferredBayType: profile?.preferred_bay_type,
          createdAt: profile?.created_at,
          lastActiveAt: profile?.last_active_at
        };
      },
      { ttl: CACHE_TTL.MEDIUM } // 5 minutes cache for profile data
    );

    res.json({
      success: true,
      data: profileData
    });
  } catch (error) {
    logger.error('Failed to get customer profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve customer profile'
    });
  }
});

// PUT /api/customer-profile - Update customer profile
router.put('/', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const {
      displayName,
      bio,
      handicap,
      homeLocation,
      homeGolfCourse,
      profileVisibility,
      showBookings,
      showStats,
      showFriends,
      preferredTeeTime,
      preferredBayType
    } = req.body;
    
    // Update or create customer profile
    const result = await db.query(`
      INSERT INTO customer_profiles (
        user_id, display_name, bio, handicap, home_location, home_golf_course,
        profile_visibility, show_bookings, show_stats, show_friends,
        preferred_tee_time, preferred_bay_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (user_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        bio = EXCLUDED.bio,
        handicap = EXCLUDED.handicap,
        home_location = EXCLUDED.home_location,
        home_golf_course = EXCLUDED.home_golf_course,
        profile_visibility = EXCLUDED.profile_visibility,
        show_bookings = EXCLUDED.show_bookings,
        show_stats = EXCLUDED.show_stats,
        show_friends = EXCLUDED.show_friends,
        preferred_tee_time = EXCLUDED.preferred_tee_time,
        preferred_bay_type = EXCLUDED.preferred_bay_type,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      userId, displayName, bio, handicap, homeLocation, homeGolfCourse,
      profileVisibility, showBookings, showStats, showFriends,
      preferredTeeTime, preferredBayType
    ]);
    
    // Invalidate cache after profile update
    await cacheService.delete(CACHE_KEYS.USER_BY_ID(userId));
    logger.debug(`Cache invalidated for user profile: ${userId}`);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to update customer profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update customer profile'
    });
  }
});

// PUT /api/users/profile - Update user's basic information (name, email, phone)
router.put('/users/profile', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { name, email, phone } = req.body;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }
    
    // Check if email is already taken by another user
    if (email && email !== req.user!.email) {
      const emailCheck = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email.toLowerCase(), userId]
      );
      
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email address is already in use'
        });
      }
    }
    
    // Update user information
    const result = await db.query(`
      UPDATE users 
      SET 
        name = COALESCE($1, name),
        email = COALESCE(LOWER($2), email),
        phone = COALESCE($3, phone),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, name, email, phone, role, created_at
    `, [name, email, phone, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    logger.info(`User profile updated for user ${userId}`);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Profile updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

export default router;