import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

const router = Router();

// GET /api/history/interactions - Get user's interaction history
router.get('/interactions', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    
    // Get feedback entries
    const feedback = await db.query(
      `SELECT * FROM feedback 
       WHERE user_id = $1 OR user_email = $2 
       ORDER BY created_at DESC 
       LIMIT $3 OFFSET $4`,
      [userId, userEmail, Number(limit), Number(offset)]
    );
    
    // Get customer interactions
    const interactions = await db.query(
      `SELECT * FROM customer_interactions 
       WHERE user_id = $1 OR user_email = $2 
       ORDER BY created_at DESC 
       LIMIT $3 OFFSET $4`,
      [userId, userEmail, Number(limit), Number(offset)]
    );
    
    // Combine and sort by date
    const combined = [
      ...feedback.rows.map(f => ({
        type: 'feedback',
        id: f.id,
        timestamp: f.created_at,
        request: f.request_description,
        response: f.response,
        route: f.route,
        confidence: f.confidence,
        isUseful: f.is_useful,
        metadata: {
          location: f.location,
          feedbackType: f.feedback_type
        }
      })),
      ...interactions.rows.map(i => ({
        type: 'interaction',
        id: i.id,
        timestamp: i.created_at,
        request: i.request_text,
        response: i.response_text,
        route: i.route,
        confidence: i.confidence,
        metadata: i.metadata
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
     .slice(0, Number(limit));
    
    res.json({
      success: true,
      data: combined,
      pagination: {
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error) {
    logger.error('Failed to get interaction history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve interaction history'
    });
  }
});

// GET /api/history/bookings - Get user's booking history
router.get('/bookings', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0, includeRecurring = 'true' } = req.query;
    
    const bookings = await db.getBookings({
      user_id: req.user!.id
    });
    
    // Sort by start time descending
    const sorted = bookings.sort((a, b) => 
      b.start_time.getTime() - a.start_time.getTime()
    );
    
    // Apply pagination
    const paginated = sorted.slice(Number(offset), Number(offset) + Number(limit));
    
    res.json({
      success: true,
      data: paginated.map(b => ({
        id: b.id,
        simulatorId: b.simulator_id,
        startTime: b.start_time.toISOString(),
        duration: b.duration,
        type: b.type,
        recurringDays: b.recurring_days,
        status: b.status,
        createdAt: b.created_at.toISOString(),
        cancelledAt: b.cancelled_at?.toISOString()
      })),
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: sorted.length
      }
    });
  } catch (error) {
    logger.error('Failed to get booking history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve booking history'
    });
  }
});

// GET /api/history/tickets - Get user's ticket history
router.get('/tickets', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const tickets = await db.getTickets({
      created_by_id: req.user!.id
    });
    
    // Sort by created date descending
    const sorted = tickets.sort((a, b) => 
      b.created_at.getTime() - a.created_at.getTime()
    );
    
    // Apply pagination
    const paginated = sorted.slice(Number(offset), Number(offset) + Number(limit));
    
    res.json({
      success: true,
      data: paginated.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        status: t.status,
        priority: t.priority,
        location: t.location,
        createdAt: t.created_at.toISOString(),
        updatedAt: t.updated_at.toISOString(),
        resolvedAt: t.resolved_at?.toISOString()
      })),
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: sorted.length
      }
    });
  } catch (error) {
    logger.error('Failed to get ticket history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve ticket history'
    });
  }
});

export default router;
