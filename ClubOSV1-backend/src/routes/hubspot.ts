import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

const router = express.Router();

// HubSpot API configuration
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY || '';
const HUBSPOT_BASE_URL = 'https://api.hubapi.com/crm/v3';

// Cache for HubSpot data (5 minutes)
const contactCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/hubspot/search
 * Search for customers in HubSpot CRM
 */
router.get('/search', authenticate, async (req: Request, res: Response) => {
  try {
    const { query, type = 'contact' } = req.query;

    if (!query || typeof query !== 'string' || query.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 3 characters'
      });
    }

    // Check cache first
    const cacheKey = `search:${type}:${query}`;
    const cached = contactCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json({
        success: true,
        contacts: cached.data,
        source: 'cache'
      });
    }

    // If HubSpot is not configured, fall back to local database
    if (!HUBSPOT_API_KEY) {
      logger.warn('HubSpot API key not configured, using local database');

      // Search local users database
      const localQuery = `
        SELECT
          u.id,
          u.name,
          u.email,
          u.phone,
          COUNT(b.id) as total_bookings,
          MAX(b.created_at) as last_booking_date,
          COALESCE(SUM(b.total_amount), 0) as lifetime_value,
          lt.current_tier_id as tier
        FROM users u
        LEFT JOIN bookings b ON b.user_id = u.id
        LEFT JOIN loyalty_tracking lt ON lt.user_id = u.id
        WHERE
          u.name ILIKE $1 OR
          u.email ILIKE $1 OR
          u.phone ILIKE $1
        GROUP BY u.id, lt.current_tier_id
        LIMIT 20
      `;

      const searchPattern = `%${query}%`;
      const result = await db.query(localQuery, [searchPattern]);

      return res.json({
        success: true,
        contacts: result.rows,
        source: 'local'
      });
    }

    // Search HubSpot API
    const searchBody = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'firstname',
              operator: 'CONTAINS_TOKEN',
              value: query
            }
          ]
        },
        {
          filters: [
            {
              propertyName: 'lastname',
              operator: 'CONTAINS_TOKEN',
              value: query
            }
          ]
        },
        {
          filters: [
            {
              propertyName: 'email',
              operator: 'CONTAINS_TOKEN',
              value: query
            }
          ]
        },
        {
          filters: [
            {
              propertyName: 'phone',
              operator: 'CONTAINS_TOKEN',
              value: normalizePhone(query)
            }
          ]
        }
      ],
      properties: [
        'firstname',
        'lastname',
        'email',
        'phone',
        'mobilephone',
        'total_bookings',
        'last_booking_date',
        'lifetime_value',
        'customer_tier',
        'notes',
        'favorite_location',
        'preferred_simulator',
        'tags'
      ],
      limit: 20
    };

    const response = await fetch(`${HUBSPOT_BASE_URL}/objects/contacts/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(searchBody)
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.status}`);
    }

    const data: any = await response.json();

    // Cache the results
    contactCache.set(cacheKey, {
      data: data.results || [],
      timestamp: Date.now()
    });

    res.json({
      success: true,
      contacts: data.results || [],
      source: 'hubspot'
    });

  } catch (error) {
    logger.error('HubSpot search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search customers'
    });
  }
});

/**
 * GET /api/hubspot/contact/:id
 * Get a specific contact from HubSpot
 */
router.get('/contact/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check cache
    const cacheKey = `contact:${id}`;
    const cached = contactCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json({
        success: true,
        contact: cached.data,
        source: 'cache'
      });
    }

    if (!HUBSPOT_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'HubSpot integration not configured'
      });
    }

    const response = await fetch(`${HUBSPOT_BASE_URL}/objects/contacts/${id}`, {
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.status}`);
    }

    const contact = await response.json();

    // Cache the result
    contactCache.set(cacheKey, {
      data: contact,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      contact,
      source: 'hubspot'
    });

  } catch (error) {
    logger.error('HubSpot contact fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contact'
    });
  }
});

/**
 * POST /api/hubspot/sync-booking
 * Sync a booking to HubSpot as a deal
 */
router.post('/sync-booking', authenticate, async (req: Request, res: Response) => {
  try {
    const { bookingId, customerId, amount, locationName } = req.body;

    if (!HUBSPOT_API_KEY) {
      logger.warn('HubSpot sync skipped - not configured');
      return res.json({
        success: true,
        message: 'HubSpot sync not configured'
      });
    }

    // Create or update deal in HubSpot
    const dealBody = {
      properties: {
        dealname: `Booking at ${locationName}`,
        amount: amount.toString(),
        dealstage: 'contractsent', // Or appropriate stage
        pipeline: 'default', // Or your custom pipeline ID
        closedate: new Date().toISOString(),
        booking_id: bookingId,
        location: locationName
      }
    };

    const response = await fetch(`${HUBSPOT_BASE_URL}/objects/deals`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dealBody)
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.status}`);
    }

    const deal: any = await response.json();

    // Associate deal with contact if customerId provided
    if (customerId && deal.id) {
      await fetch(`${HUBSPOT_BASE_URL}/objects/deals/${deal.id}/associations/contacts/${customerId}/deal_to_contact`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`
        }
      });
    }

    // Update local database with HubSpot deal ID if we got one
    if (deal.id) {
      await db.query(
        'UPDATE bookings SET hubspot_deal_id = $1 WHERE id = $2',
        [deal.id, bookingId]
      );
    }

    res.json({
      success: true,
      dealId: deal.id || null
    });

  } catch (error) {
    logger.error('HubSpot sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync with HubSpot'
    });
  }
});

/**
 * Helper function to normalize phone numbers
 */
function normalizePhone(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Handle different formats
  if (digits.length === 10) {
    // US number without country code
    return `+1${digits}`;
  } else if (digits.length === 11 && digits[0] === '1') {
    // US number with country code
    return `+${digits}`;
  } else if (digits.length > 0) {
    // Other format, return as is with +
    return `+${digits}`;
  }

  return phone;
}

export default router;