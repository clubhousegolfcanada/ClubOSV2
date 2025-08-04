import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

const router = Router();

// GET /api/history - Get combined history (for backward compatibility)
router.get('/', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    
    // Get feedback entries
    const feedback = await db.query(
      `SELECT * FROM feedback 
       WHERE user_id = $1 OR user_email = $2 
       ORDER BY "createdAt" DESC 
       LIMIT $3 OFFSET $4`,
      [userId, userEmail, Number(limit), Number(offset)]
    );
    
    // Get customer interactions
    const interactions = await db.query(
      `SELECT * FROM customer_interactions 
       WHERE user_id = $1 OR user_email = $2 
       ORDER BY "createdAt" DESC 
       LIMIT $3 OFFSET $4`,
      [userId, userEmail, Number(limit), Number(offset)]
    );
    
    // Get recent tickets
    const tickets = await db.query(
      `SELECT * FROM tickets 
       WHERE created_by_id = $1 
       ORDER BY "createdAt" DESC 
       LIMIT $3 OFFSET $4`,
      [userId, Number(limit), Number(offset)]
    );
    
    // Combine and sort by date
    const combined = [
      ...feedback.rows.map(f => ({
        type: 'feedback',
        id: f.id,
        timestamp: f.createdAt,
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
        timestamp: i.createdAt,
        request: i.request_text,
        response: i.response_text,
        route: i.route,
        confidence: i.confidence,
        metadata: i.metadata
      })),
      ...tickets.rows.map(t => ({
        type: 'ticket',
        id: t.id,
        timestamp: t.createdAt,
        title: t.title,
        description: t.description,
        category: t.category,
        status: t.status,
        priority: t.priority,
        location: t.location
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
     .slice(0, Number(limit));
    
    res.json({
      success: true,
      data: combined,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: combined.length
      }
    });
  } catch (error) {
    logger.error('Failed to get history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve history'
    });
  }
});

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
       ORDER BY "createdAt" DESC 
       LIMIT $3 OFFSET $4`,
      [userId, userEmail, Number(limit), Number(offset)]
    );
    
    // Get customer interactions
    const interactions = await db.query(
      `SELECT * FROM customer_interactions 
       WHERE user_id = $1 OR user_email = $2 
       ORDER BY "createdAt" DESC 
       LIMIT $3 OFFSET $4`,
      [userId, userEmail, Number(limit), Number(offset)]
    );
    
    // Combine and sort by date
    const combined = [
      ...feedback.rows.map(f => ({
        type: 'feedback',
        id: f.id,
        timestamp: f.createdAt,
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
        timestamp: i.createdAt,
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
        createdAt: b.createdAt.toISOString(),
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
      b.createdAt.getTime() - a.createdAt.getTime()
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
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
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

// GET /api/history/stats/overview - Get statistics overview
router.get('/stats/overview', authenticate, async (req, res) => {
  try {
    const { period = '24h', endDate } = req.query;
    
    // Calculate date range based on period
    let startDate: Date;
    const end = endDate ? new Date(endDate as string) : new Date();
    
    switch(period) {
      case '24h':
        startDate = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    }
    
    // Get statistics from various tables
    const [
      totalRequestsResult,
      uniqueUsersResult,
      feedbackStatsResult,
      ticketStatsResult,
      bookingStatsResult
    ] = await Promise.all([
      // Total requests
      db.query(
        `SELECT COUNT(*) as count FROM customer_interactions 
         WHERE "createdAt" >= $1 AND "createdAt" <= $2`,
        [startDate, end]
      ),
      
      // Unique users
      db.query(
        `SELECT COUNT(DISTINCT COALESCE(user_id::text, user_email)) as count 
         FROM customer_interactions 
         WHERE "createdAt" >= $1 AND "createdAt" <= $2`,
        [startDate, end]
      ),
      
      // Feedback stats
      db.query(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN is_useful THEN 1 ELSE 0 END) as useful,
           AVG(confidence) as avg_confidence
         FROM feedback 
         WHERE "createdAt" >= $1 AND "createdAt" <= $2`,
        [startDate, end]
      ),
      
      // Ticket stats
      db.query(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN status = 'resolved' OR status = 'closed' THEN 1 ELSE 0 END) as resolved
         FROM tickets 
         WHERE "createdAt" >= $1 AND "createdAt" <= $2`,
        [startDate, end]
      ),
      
      // Booking stats
      db.query(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
         FROM bookings 
         WHERE "createdAt" >= $1 AND "createdAt" <= $2`,
        [startDate, end]
      )
    ]);
    
    const totalRequests = parseInt(totalRequestsResult.rows[0]?.count || '0');
    const uniqueUsers = parseInt(uniqueUsersResult.rows[0]?.count || '0');
    const feedbackStats = feedbackStatsResult.rows[0];
    const ticketStats = ticketStatsResult.rows[0];
    const bookingStats = bookingStatsResult.rows[0];
    
    res.json({
      success: true,
      data: {
        totalRequests,
        uniqueUsers,
        averageConfidence: parseFloat(feedbackStats?.avg_confidence || '0'),
        totalFeedback: parseInt(feedbackStats?.total || '0'),
        usefulFeedback: parseInt(feedbackStats?.useful || '0'),
        totalTickets: parseInt(ticketStats?.total || '0'),
        resolvedTickets: parseInt(ticketStats?.resolved || '0'),
        totalBookings: parseInt(bookingStats?.total || '0'),
        cancelledBookings: parseInt(bookingStats?.cancelled || '0'),
        period,
        dateRange: {
          start: startDate.toISOString(),
          end: end.toISOString()
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get stats overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve statistics'
    });
  }
});

export default router;
