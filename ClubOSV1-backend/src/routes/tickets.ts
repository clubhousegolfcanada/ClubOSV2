import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { slackFallback } from '../services/slackFallback';

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
      data: tickets
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
    
    // Create new ticket
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
      data: newTicket
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
      data: updatedTicket
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
