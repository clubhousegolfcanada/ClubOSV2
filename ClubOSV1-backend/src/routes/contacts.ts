import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { hubspotService } from '../services/hubspotService';

const router = Router();

/**
 * GET /api/contacts/search
 * Search HubSpot contacts by name or phone number
 */
router.get('/search', authenticate, async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({ 
        contacts: [],
        message: 'Query must be at least 2 characters' 
      });
    }

    logger.info('Contact search requested', {
      query: q,
      userId: req.user?.id,
      userRole: req.user?.role
    });

    // Search HubSpot
    const contacts = await hubspotService.searchContacts(q);
    
    res.json({ 
      contacts,
      cached: false, // Could extend to show if results came from cache
      hubspotConnected: hubspotService.isHubSpotConnected()
    });

  } catch (error: any) {
    logger.error('Contact search error:', error);
    res.status(500).json({ 
      error: 'Failed to search contacts',
      message: error.message 
    });
  }
});

/**
 * GET /api/contacts/lookup/:phone
 * Lookup a single contact by phone number
 */
router.get('/lookup/:phone', authenticate, async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    
    if (!phone) {
      return res.status(400).json({ 
        error: 'Phone number required' 
      });
    }

    const contact = await hubspotService.searchByPhone(phone);
    
    res.json({ 
      contact,
      found: !!contact 
    });

  } catch (error: any) {
    logger.error('Contact lookup error:', error);
    res.status(500).json({ 
      error: 'Failed to lookup contact',
      message: error.message 
    });
  }
});

/**
 * POST /api/contacts/cache/clear
 * Clear the HubSpot cache (admin only)
 */
router.post('/cache/clear', authenticate, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Admin access required' 
      });
    }

    hubspotService.clearCache();
    
    logger.info('HubSpot cache cleared', {
      userId: req.user.id
    });

    res.json({ 
      success: true,
      message: 'Cache cleared successfully' 
    });

  } catch (error: any) {
    logger.error('Cache clear error:', error);
    res.status(500).json({ 
      error: 'Failed to clear cache',
      message: error.message 
    });
  }
});

/**
 * GET /api/contacts/cache/stats
 * Get cache statistics (admin only)
 */
router.get('/cache/stats', authenticate, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Admin access required' 
      });
    }

    const stats = hubspotService.getCacheStats();
    
    res.json({ 
      ...stats,
      hubspotConnected: hubspotService.isHubSpotConnected()
    });

  } catch (error: any) {
    logger.error('Cache stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get cache stats',
      message: error.message 
    });
  }
});

export default router;