import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import axios from 'axios';

const router = Router();

interface Booking {
  id: string;
  date: string;
  time: string;
  box: string;
  location: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  friends?: string[];
  duration?: number;
}

/**
 * Get customer bookings from HubSpot
 * Uses the customer's phone number or email to match with HubSpot deals/engagements
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    // Get customer profile with phone number
    const profileResult = await db.query(`
      SELECT cp.*, u.email, u.phone 
      FROM customer_profiles cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.user_id = $1
    `, [userId]);
    
    if (!profileResult.rows[0]) {
      return res.json({ 
        success: true, 
        bookings: [],
        message: 'Customer profile not found'
      });
    }
    
    const customer = profileResult.rows[0];
    const apiKey = process.env.HUBSPOT_API_KEY;
    
    if (!apiKey) {
      logger.warn('HubSpot API key not configured for bookings');
      return res.json({ 
        success: true, 
        bookings: [],
        source: 'mock'
      });
    }
    
    try {
      // First, find the contact in HubSpot
      let contactId = customer.hubspot_contact_id;
      
      if (!contactId && (customer.phone || customer.email)) {
        // Search for contact by phone or email
        const searchQuery = customer.phone || customer.email;
        const searchUrl = `https://api.hubapi.com/crm/v3/objects/contacts/search`;
        
        const searchResponse = await axios.post(searchUrl, {
          filterGroups: [{
            filters: [
              ...(customer.phone ? [{
                propertyName: 'phone',
                operator: 'CONTAINS_TOKEN',
                value: customer.phone.replace(/\D/g, '').slice(-10)
              }] : []),
              ...(customer.email ? [{
                propertyName: 'email',
                operator: 'EQ',
                value: customer.email
              }] : [])
            ]
          }],
          limit: 1
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (searchResponse.data.results && searchResponse.data.results.length > 0) {
          contactId = searchResponse.data.results[0].id;
          
          // Save contact ID for future use
          await db.query(`
            UPDATE customer_profiles 
            SET hubspot_contact_id = $1, updated_at = NOW()
            WHERE user_id = $2
          `, [contactId, userId]);
        }
      }
      
      if (!contactId) {
        return res.json({ 
          success: true, 
          bookings: [],
          message: 'No HubSpot contact found'
        });
      }
      
      // Fetch deals associated with this contact
      // In HubSpot, bookings are typically stored as deals
      const dealsUrl = `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}/associations/deals`;
      
      const dealsResponse = await axios.get(dealsUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      const bookings: Booking[] = [];
      
      if (dealsResponse.data.results && dealsResponse.data.results.length > 0) {
        // Fetch deal details for each associated deal
        const dealIds = dealsResponse.data.results.map((r: any) => r.id).join(',');
        const dealDetailsUrl = `https://api.hubapi.com/crm/v3/objects/deals`;
        
        const dealDetailsResponse = await axios.get(dealDetailsUrl, {
          params: {
            properties: 'dealname,closedate,amount,dealstage,booking_date,booking_time,location,box_number,participants',
            ids: dealIds
          },
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });
        
        // Transform HubSpot deals into bookings
        for (const deal of dealDetailsResponse.data.results || []) {
          const properties = deal.properties || {};
          
          // Parse booking details from deal properties
          // These field names may vary based on your HubSpot setup
          const bookingDate = properties.booking_date || properties.closedate;
          const bookingTime = properties.booking_time || '6:00 PM';
          const location = properties.location || 'Bedford';
          const boxNumber = properties.box_number || properties.dealname || 'Box 1';
          
          if (bookingDate) {
            const date = new Date(bookingDate);
            const isUpcoming = date > new Date();
            
            bookings.push({
              id: deal.id,
              date: formatBookingDate(date),
              time: bookingTime,
              box: boxNumber.includes('Box') ? boxNumber : `Box ${boxNumber}`,
              location: location,
              status: isUpcoming ? 'upcoming' : 'completed',
              friends: properties.participants ? properties.participants.split(',').map((p: string) => p.trim()) : []
            });
          }
        }
      }
      
      // Sort bookings by date (upcoming first)
      bookings.sort((a, b) => {
        const dateA = parseBookingDate(a.date);
        const dateB = parseBookingDate(b.date);
        return dateA.getTime() - dateB.getTime();
      });
      
      return res.json({
        success: true,
        bookings: bookings,
        source: 'hubspot'
      });
      
    } catch (hubspotError: any) {
      logger.error('HubSpot API error fetching bookings:', hubspotError.response?.data || hubspotError.message);
      
      // Return mock data as fallback
      return res.json({
        success: true,
        bookings: getMockBookings(),
        source: 'mock',
        error: 'HubSpot temporarily unavailable'
      });
    }
    
  } catch (error: any) {
    logger.error('Error fetching customer bookings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch bookings' 
    });
  }
});

/**
 * Get booking history for a customer
 */
router.get('/history', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { limit = 10, offset = 0 } = req.query;
    
    // For now, return mock historical data
    // This would be expanded to fetch from HubSpot's deals with filters
    const history = [
      {
        id: 'h1',
        date: '2024-01-10',
        time: '7:00 PM',
        box: 'Box 3',
        location: 'Bedford',
        status: 'completed' as const,
        score: 82,
        friends: ['Mike S.', 'Sarah K.']
      },
      {
        id: 'h2',
        date: '2024-01-08',
        time: '6:00 PM',
        box: 'Box 1',
        location: 'Dartmouth',
        status: 'completed' as const,
        score: 78,
        friends: []
      }
    ];
    
    res.json({
      success: true,
      history,
      total: history.length
    });
    
  } catch (error: any) {
    logger.error('Error fetching booking history:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch booking history' 
    });
  }
});

// Helper functions
function formatBookingDate(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  }
}

function parseBookingDate(dateStr: string): Date {
  if (dateStr === 'Today') {
    return new Date();
  } else if (dateStr === 'Tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  } else {
    return new Date(dateStr);
  }
}

function getMockBookings(): Booking[] {
  return [
    {
      id: '1',
      date: 'Today',
      time: '6:00 PM',
      box: 'Box 2',
      location: 'Bedford',
      status: 'upcoming',
      friends: ['John D.', 'Mike S.']
    },
    {
      id: '2',
      date: 'Tomorrow',
      time: '7:00 PM',
      box: 'Box 4',
      location: 'Bedford',
      status: 'upcoming',
      friends: []
    }
  ];
}

export default router;