import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { hubspotService } from '../services/hubspotService';

const router = Router();

// GET /api/customer-profile - Get current customer's profile with HubSpot data
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const userEmail = req.user!.email;
    const userPhone = req.user!.phone;
    
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
        // First check HubSpot cache
        const cacheResult = await db.query(`
          SELECT customer_name, company, email, hubspot_contact_id
          FROM hubspot_cache
          WHERE phone_number = $1 OR email = $2
          ORDER BY updated_at DESC
          LIMIT 1
        `, [userPhone || '', userEmail || '']);
        
        if (cacheResult.rows.length > 0) {
          hubspotName = cacheResult.rows[0].customer_name;
          hubspotCompany = cacheResult.rows[0].company;
        } else if (hubspotService.isHubSpotConnected()) {
          // If not in cache, try to fetch from HubSpot
          const hubspotContacts = await hubspotService.searchContacts(userPhone || userEmail || '');
          if (hubspotContacts && hubspotContacts.length > 0) {
            const contact = hubspotContacts[0];
            hubspotName = contact.name;
            hubspotCompany = contact.company;
          }
        }
      } catch (error) {
        logger.error('Error fetching HubSpot data:', error);
      }
    }
    
    // Determine the best name to use (prioritize HubSpot name)
    const displayName = hubspotName || profile?.display_name || profile?.auth_name || req.user!.name;
    
    res.json({
      success: true,
      data: {
        id: userId,
        displayName,
        hubspotName,
        company: hubspotCompany,
        email: userEmail,
        phone: userPhone,
        bio: profile?.bio,
        handicap: profile?.handicap,
        homeLocation: profile?.home_location,
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
      }
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
        user_id, display_name, bio, handicap, home_location,
        profile_visibility, show_bookings, show_stats, show_friends,
        preferred_tee_time, preferred_bay_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (user_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        bio = EXCLUDED.bio,
        handicap = EXCLUDED.handicap,
        home_location = EXCLUDED.home_location,
        profile_visibility = EXCLUDED.profile_visibility,
        show_bookings = EXCLUDED.show_bookings,
        show_stats = EXCLUDED.show_stats,
        show_friends = EXCLUDED.show_friends,
        preferred_tee_time = EXCLUDED.preferred_tee_time,
        preferred_bay_type = EXCLUDED.preferred_bay_type,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      userId, displayName, bio, handicap, homeLocation,
      profileVisibility, showBookings, showStats, showFriends,
      preferredTeeTime, preferredBayType
    ]);
    
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

export default router;