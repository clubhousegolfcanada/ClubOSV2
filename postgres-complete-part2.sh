#!/bin/bash
echo "🚀 Full PostgreSQL Implementation - Part 2"
echo "========================================"

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

# First, let's add the missing types to types/index.ts
cat >> ClubOSV1-backend/src/types/index.ts << 'EOF'

// Add missing types for feedback and tickets
export interface FeedbackEntry {
  id: string;
  timestamp: string;
  userId?: string;
  userEmail?: string;
  requestDescription: string;
  location?: string;
  route?: string;
  response?: string;
  confidence?: number;
  isUseful: boolean;
  feedbackType?: string;
  feedbackSource?: string;
  slackThreadTs?: string;
  slackUserName?: string;
  slackUserId?: string;
  slackChannel?: string;
  originalRequestId?: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: 'facilities' | 'tech';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  location?: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  comments: any[];
}
EOF

# Create PostgreSQL-only feedback route
cat > ClubOSV1-backend/src/routes/feedback-postgres.ts << 'EOF'
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { slackFallback } from '../services/slackFallback';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// POST /api/feedback - Submit feedback for a response
router.post('/', authenticate, async (req, res) => {
  try {
    const { 
      timestamp, 
      requestDescription, 
      location, 
      route, 
      response, 
      confidence, 
      isUseful, 
      feedbackType,
      feedbackSource = 'user',
      slackThreadTs,
      slackUserName,
      slackUserId,
      slackChannel,
      originalRequestId
    } = req.body;

    // Create feedback in database
    const feedbackEntry = await db.createFeedback({
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      user_id: req.user?.id,
      user_email: req.user?.email,
      request_description: requestDescription,
      location,
      route,
      response,
      confidence,
      is_useful: isUseful,
      feedback_type: feedbackType,
      feedback_source: feedbackSource,
      slack_thread_ts: slackThreadTs,
      slack_user_name: slackUserName,
      slack_user_id: slackUserId,
      slack_channel: slackChannel,
      original_request_id: originalRequestId
    });

    // Log feedback
    logger.info('Feedback received', {
      feedbackType,
      isUseful,
      route,
      userId: req.user?.id,
      feedbackSource
    });

    // Send Slack notification for unhelpful responses
    if (!isUseful && slackFallback.isEnabled() && feedbackSource === 'user') {
      try {
        await slackFallback.sendUnhelpfulFeedbackNotification({
          id: feedbackEntry.id,
          timestamp: feedbackEntry.timestamp.toISOString(),
          userId: feedbackEntry.user_id,
          userEmail: feedbackEntry.user_email,
          requestDescription: feedbackEntry.request_description,
          location: feedbackEntry.location,
          route: feedbackEntry.route,
          response: feedbackEntry.response,
          confidence: feedbackEntry.confidence,
          isUseful: feedbackEntry.is_useful,
          feedbackType: feedbackEntry.feedback_type,
          feedbackSource: feedbackEntry.feedback_source,
          createdAt: feedbackEntry.created_at.toISOString()
        });
        logger.info('Slack notification sent for unhelpful feedback', { feedbackId: feedbackEntry.id });
      } catch (slackError) {
        logger.error('Failed to send Slack notification for feedback:', slackError);
      }
    }

    res.json({ 
      success: true, 
      message: 'Feedback recorded successfully',
      feedbackId: feedbackEntry.id
    });
  } catch (error) {
    logger.error('Error recording feedback:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to record feedback' 
    });
  }
});

// GET /api/feedback/not-useful - Get all not useful feedback (admin/operator only)
router.get('/not-useful', authenticate, async (req, res) => {
  try {
    // Check if user has appropriate role
    if (req.user?.role !== 'admin' && req.user?.role !== 'operator') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin or operator only.' 
      });
    }

    const feedback = await db.getNotUsefulFeedback();
    
    res.json({ 
      success: true, 
      data: feedback.map(f => ({
        id: f.id,
        timestamp: f.timestamp.toISOString(),
        userId: f.user_id,
        userEmail: f.user_email,
        requestDescription: f.request_description,
        location: f.location,
        route: f.route,
        response: f.response,
        confidence: f.confidence,
        isUseful: f.is_useful,
        feedbackType: f.feedback_type,
        feedbackSource: f.feedback_source,
        createdAt: f.created_at.toISOString()
      })),
      count: feedback.length
    });
  } catch (error) {
    logger.error('Error retrieving feedback:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve feedback' 
    });
  }
});

// GET /api/feedback/export - Export not useful feedback as downloadable file (admin only)
router.get('/export', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin only.' 
      });
    }

    const feedback = await db.getNotUsefulFeedback();
    
    const feedbackArray = feedback.map(item => ({
      request: item.request_description,
      location: item.location,
      route: item.route,
      response: item.response,
      confidence: item.confidence,
      timestamp: item.timestamp.toISOString()
    }));
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="clubos_feedback_${new Date().toISOString().split('T')[0]}.json"`);
    
    res.send(JSON.stringify(feedbackArray, null, 2));
  } catch (error) {
    logger.error('Error exporting feedback:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export feedback' 
    });
  }
});

// DELETE /api/feedback/clear - Clear all not useful feedback (admin only)
router.delete('/clear', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin only.' 
      });
    }

    const deletedCount = await db.clearNotUsefulFeedback();
    
    logger.info('Feedback cleared by admin', {
      userId: req.user.id,
      userEmail: req.user.email,
      deletedCount
    });
    
    res.json({ 
      success: true, 
      message: `${deletedCount} feedback entries cleared successfully` 
    });
  } catch (error) {
    logger.error('Error clearing feedback:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to clear feedback' 
    });
  }
});

export default router;
EOF

# Create PostgreSQL-only tickets route
cat > ClubOSV1-backend/src/routes/tickets-postgres.ts << 'EOF'
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { slackFallback } from '../services/slackFallback';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/tickets - Get tickets with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { category, status, assignedTo } = req.query;
    
    const tickets = await db.getTickets({
      category: category as string,
      status: status as string,
      assigned_to_id: assignedTo as string
    });
    
    res.json({
      success: true,
      data: tickets.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        status: t.status,
        priority: t.priority,
        location: t.location,
        createdBy: {
          id: t.created_by_id,
          name: t.created_by_name,
          email: t.created_by_email,
          phone: t.created_by_phone
        },
        assignedTo: t.assigned_to_id ? {
          id: t.assigned_to_id,
          name: t.assigned_to_name!,
          email: t.assigned_to_email!
        } : undefined,
        createdAt: t.created_at.toISOString(),
        updatedAt: t.updated_at.toISOString(),
        resolvedAt: t.resolved_at?.toISOString(),
        comments: []
      }))
    });
  } catch (error) {
    logger.error('Failed to get tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tickets'
    });
  }
});

// POST /api/tickets - Create a new ticket
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, description, category, priority, location } = req.body;
    
    // Validate required fields
    if (!title || !description || !category || !priority) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, description, category, priority'
      });
    }
    
    // Create ticket in database
    const newTicket = await db.createTicket({
      title,
      description,
      category,
      status: 'open',
      priority,
      location,
      created_by_id: req.user!.id,
      created_by_name: req.user!.name || req.user!.email.split('@')[0],
      created_by_email: req.user!.email,
      created_by_phone: req.user!.phone
    });
    
    logger.info('Ticket created', {
      ticketId: newTicket.id,
      category: newTicket.category,
      priority: newTicket.priority,
      createdBy: req.user!.email
    });
    
    // Send Slack notification if enabled
    try {
      if (slackFallback.isEnabled()) {
        await slackFallback.sendTicketNotification({
          id: newTicket.id,
          title: newTicket.title,
          description: newTicket.description,
          category: newTicket.category,
          status: newTicket.status,
          priority: newTicket.priority,
          location: newTicket.location,
          createdBy: {
            id: newTicket.created_by_id,
            name: newTicket.created_by_name,
            email: newTicket.created_by_email,
            phone: newTicket.created_by_phone
          },
          createdAt: newTicket.created_at.toISOString(),
          updatedAt: newTicket.updated_at.toISOString(),
          comments: []
        });
        logger.info('Slack notification sent for ticket', { ticketId: newTicket.id });
      }
    } catch (slackError) {
      logger.error('Failed to send Slack notification for ticket:', slackError);
    }
    
    res.json({
      success: true,
      data: {
        id: newTicket.id,
        title: newTicket.title,
        description: newTicket.description,
        category: newTicket.category,
        status: newTicket.status,
        priority: newTicket.priority,
        location: newTicket.location,
        createdBy: {
          id: newTicket.created_by_id,
          name: newTicket.created_by_name,
          email: newTicket.created_by_email,
          phone: newTicket.created_by_phone
        },
        createdAt: newTicket.created_at.toISOString(),
        updatedAt: newTicket.updated_at.toISOString(),
        comments: []
      }
    });
  } catch (error) {
    logger.error('Failed to create ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create ticket'
    });
  }
});

// PATCH /api/tickets/:id/status - Update ticket status
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }
    
    const updatedTicket = await db.updateTicketStatus(id, status);
    
    if (!updatedTicket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    logger.info('Ticket status updated', {
      ticketId: id,
      newStatus: status,
      updatedBy: req.user!.email
    });
    
    res.json({
      success: true,
      data: {
        id: updatedTicket.id,
        title: updatedTicket.title,
        description: updatedTicket.description,
        category: updatedTicket.category,
        status: updatedTicket.status,
        priority: updatedTicket.priority,
        location: updatedTicket.location,
        createdBy: {
          id: updatedTicket.created_by_id,
          name: updatedTicket.created_by_name,
          email: updatedTicket.created_by_email,
          phone: updatedTicket.created_by_phone
        },
        assignedTo: updatedTicket.assigned_to_id ? {
          id: updatedTicket.assigned_to_id,
          name: updatedTicket.assigned_to_name!,
          email: updatedTicket.assigned_to_email!
        } : undefined,
        createdAt: updatedTicket.created_at.toISOString(),
        updatedAt: updatedTicket.updated_at.toISOString(),
        resolvedAt: updatedTicket.resolved_at?.toISOString(),
        comments: []
      }
    });
  } catch (error) {
    logger.error('Failed to update ticket status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ticket status'
    });
  }
});

// DELETE /api/tickets/:id - Delete a ticket
router.delete('/:id', authenticate, authorize(['admin', 'operator']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = await db.deleteTicket(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    logger.info('Ticket deleted', {
      ticketId: id,
      deletedBy: req.user!.email
    });
    
    res.json({
      success: true,
      message: 'Ticket deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete ticket'
    });
  }
});

// GET /api/tickets/stats - Get ticket statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    const tickets = await db.getTickets();
    
    const stats = {
      total: tickets.length,
      byStatus: {
        open: tickets.filter(t => t.status === 'open').length,
        'in-progress': tickets.filter(t => t.status === 'in-progress').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
        closed: tickets.filter(t => t.status === 'closed').length
      },
      byCategory: {
        facilities: tickets.filter(t => t.category === 'facilities').length,
        tech: tickets.filter(t => t.category === 'tech').length
      },
      byPriority: {
        low: tickets.filter(t => t.priority === 'low').length,
        medium: tickets.filter(t => t.priority === 'medium').length,
        high: tickets.filter(t => t.priority === 'high').length,
        urgent: tickets.filter(t => t.priority === 'urgent').length
      }
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get ticket stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ticket statistics'
    });
  }
});

export default router;
EOF

# Replace the old routes with PostgreSQL-only versions
mv ClubOSV1-backend/src/routes/feedback-postgres.ts ClubOSV1-backend/src/routes/feedback.ts
mv ClubOSV1-backend/src/routes/tickets-postgres.ts ClubOSV1-backend/src/routes/tickets.ts

echo "✅ Updated feedback and tickets routes to PostgreSQL only"

# Build and deploy
cd ClubOSV1-backend
npm run build

cd ..
git add -A
git commit -m "Complete PostgreSQL implementation - Part 2

- Added missing FeedbackEntry and Ticket types
- Converted feedback.ts to PostgreSQL only (no JSON)
- Converted tickets.ts to PostgreSQL only (no JSON)
- Removed all JSON file operations from these routes
- All feedback and tickets now stored exclusively in PostgreSQL"

git push origin main

echo -e "\n✅ Part 2 Complete!"
echo "============================="
echo "Status:"
echo "✅ Auth routes - PostgreSQL only"
echo "✅ Feedback routes - PostgreSQL only"
echo "✅ Tickets routes - PostgreSQL only"
echo ""
echo "Next: Convert bookings and other routes to PostgreSQL"
