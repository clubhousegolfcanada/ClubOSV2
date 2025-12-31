import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { ticketDb } from '../utils/ticketDb';
import { slackFallback } from '../services/slackFallback';
import { v4 as uuidv4 } from 'uuid';
import { transformTicket } from '../utils/transformers';

const router = Router();

// GET /api/tickets - Get tickets with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { category, status, assignedTo, location } = req.query;

    const tickets = await db.getTickets({
      category: category as string,
      status: status as string,
      assigned_to_id: assignedTo as string,
      location: location as string
    });

    res.json({
      success: true,
      data: tickets.map(t => transformTicket(t))
    });
  } catch (error) {
    logger.error('Failed to get tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tickets'
    });
  }
});

// GET /api/tickets/active-count - Get active ticket count (must be before /:id)
router.get('/active-count', authenticate, async (req, res) => {
  try {
    const tickets = await db.getTickets({ status: 'open' });
    const inProgressTickets = await db.getTickets({ status: 'in-progress' });
    const activeCount = tickets.length + inProgressTickets.length;

    res.json({
      success: true,
      count: activeCount
    });
  } catch (error) {
    logger.error('Failed to get active ticket count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active ticket count',
      count: 0
    });
  }
});

// GET /api/tickets/stats - Get ticket statistics (must be before /:id)
router.get('/stats', authenticate, async (req, res) => {
  try {
    const tickets = await db.getTickets();

    const stats = {
      total: tickets.length,
      byStatus: {
        open: tickets.filter(t => t.status === 'open').length,
        'in-progress': tickets.filter(t => t.status === 'in-progress').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
        closed: tickets.filter(t => t.status === 'closed').length,
        archived: tickets.filter(t => t.status === 'archived').length
      },
      byCategory: {
        facilities: tickets.filter(t => t.category === 'facilities').length,
        tech: tickets.filter(t => t.category === 'tech').length,
        orders: tickets.filter(t => t.category === 'orders').length
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

// GET /api/tickets/:id - Get single ticket with comments
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await db.getTicketById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    res.json({
      success: true,
      data: transformTicket(ticket)
    });
  } catch (error) {
    logger.error('Failed to get ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve ticket'
    });
  }
});

// POST /api/tickets - Create a new ticket
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, description, category, priority, location, photo_urls } = req.body;

    // Validate required fields
    if (!title || !description || !category || !priority) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, description, category, priority'
      });
    }

    // Define valid values for validation
    const validLocations = ['Bedford', 'Dartmouth', 'Halifax', 'Bayers Lake', 'River Oaks', 'Stratford', 'Truro'];
    const validCategories = ['facilities', 'tech', 'orders'];
    const validPriorities = ['low', 'medium', 'high', 'urgent'];

    // Validate category
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
    }

    // Validate priority
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority. Must be one of: ${validPriorities.join(', ')}`
      });
    }

    // Validate and normalize location if provided (case-insensitive)
    let normalizedLocation = location;
    if (location) {
      const matchedLocation = validLocations.find(
        loc => loc.toLowerCase() === location.toLowerCase()
      );

      if (!matchedLocation) {
        return res.status(400).json({
          success: false,
          message: `Invalid location. Must be one of: ${validLocations.join(', ')}`
        });
      }

      // Use the properly capitalized version
      normalizedLocation = matchedLocation;
    }

    // Validate photo_urls if provided
    if (photo_urls) {
      if (!Array.isArray(photo_urls)) {
        return res.status(400).json({
          success: false,
          message: 'photo_urls must be an array'
        });
      }

      // Check each photo size (5MB limit per photo when base64 encoded)
      for (const photo of photo_urls) {
        if (typeof photo !== 'string') {
          return res.status(400).json({
            success: false,
            message: 'Each photo URL must be a string'
          });
        }
        if (photo.length > 5_000_000) {
          return res.status(400).json({
            success: false,
            message: 'Photo size exceeds 5MB limit'
          });
        }
      }
    }

    // Create ticket in database
    const newTicket = await db.createTicket({
      title,
      description,
      category,
      status: 'open',
      priority,
      location: normalizedLocation,
      photo_urls: photo_urls || [],
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
          ...transformTicket(newTicket),
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
        ...transformTicket(newTicket),
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
        ...transformTicket(updatedTicket),
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

// PATCH /api/tickets/:id - Update ticket fields (status, priority, category, location)
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, category, location } = req.body;

    // Build updates object with only provided fields
    const updates: Partial<{
      status: string;
      priority: string;
      category: string;
      location: string;
    }> = {};

    // Only include fields that were provided in the request
    if (status !== undefined) updates.status = status;
    if (priority !== undefined) updates.priority = priority;
    if (category !== undefined) updates.category = category;
    if (location !== undefined) updates.location = location;

    // Check if any fields were provided
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    // Validate field values
    const validStatuses = ['open', 'in-progress', 'resolved', 'closed', 'archived'];
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    const validCategories = ['facilities', 'tech', 'orders'];
    // Correct Clubhouse 24/7 locations - using proper capitalization with spaces
    const validLocations = ['Bedford', 'Dartmouth', 'Halifax', 'Bayers Lake', 'River Oaks', 'Stratford', 'Truro'];

    if (updates.status && !validStatuses.includes(updates.status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    if (updates.priority && !validPriorities.includes(updates.priority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority. Must be one of: ${validPriorities.join(', ')}`
      });
    }

    if (updates.category && !validCategories.includes(updates.category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
    }

    // Case-insensitive location validation
    if (updates.location) {
      const normalizedLocation = validLocations.find(
        loc => loc.toLowerCase() === updates.location.toLowerCase()
      );

      if (!normalizedLocation) {
        return res.status(400).json({
          success: false,
          message: `Invalid location. Must be one of: ${validLocations.join(', ')}`
        });
      }

      // Normalize the location to proper capitalization
      updates.location = normalizedLocation;
    }

    // Update the ticket
    const updatedTicket = await db.updateTicket(id, updates);

    if (!updatedTicket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    logger.info('Ticket updated', {
      ticketId: id,
      updates,
      updatedBy: req.user!.email
    });

    res.json({
      success: true,
      data: {
        ...transformTicket(updatedTicket),
        comments: []
      }
    });
  } catch (error) {
    logger.error('Failed to update ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ticket'
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

// POST /api/tickets/:id/comments - Add comment to ticket
router.post('/:id/comments', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required'
      });
    }

    // Check if ticket exists
    const ticket = await db.getTicketById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Add comment
    const comment = await db.addTicketComment(id, {
      text: text.trim(),
      created_by_id: req.user!.id,
      created_by_name: req.user!.name || req.user!.email.split('@')[0],
      created_by_email: req.user!.email,
      created_by_phone: req.user!.phone
    });

    logger.info('Comment added to ticket', {
      ticketId: id,
      commentId: comment.id,
      addedBy: req.user!.email
    });

    // Format the comment for response
    const formattedComment = {
      id: comment.id,
      text: comment.text,
      createdBy: {
        id: comment.created_by_id,
        name: comment.created_by_name,
        email: comment.created_by_email,
        phone: comment.created_by_phone
      },
      createdAt: comment.created_at
    };

    res.json({
      success: true,
      data: formattedComment
    });
  } catch (error) {
    logger.error('Failed to add comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment'
    });
  }
});

// DELETE /api/tickets/clear-all - Clear all tickets (admin only)
router.delete('/clear-all', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { category, status } = req.query;
    
    const deletedCount = await ticketDb.clearAll({
      category: category as string,
      status: status as string
    });
    
    logger.info('Tickets cleared', {
      count: deletedCount,
      category,
      status,
      clearedBy: req.user!.email
    });
    
    res.json({
      success: true,
      message: `Cleared ${deletedCount} ticket${deletedCount !== 1 ? 's' : ''}`
    });
  } catch (error) {
    logger.error('Failed to clear tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear tickets'
    });
  }
});

export default router;
