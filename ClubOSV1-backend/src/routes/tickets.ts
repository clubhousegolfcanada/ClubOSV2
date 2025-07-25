import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';
import { slackFallback } from '../services/slackFallback';
import { ticketDb } from '../utils/ticketDb';

const router = Router();

// GET /api/tickets - Get tickets with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { category, status, assignedTo } = req.query;
    
    const tickets = await ticketDb.getAll({
      category: category as string,
      status: status as string,
      assignedTo: assignedTo as string
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
    const newTicket = await ticketDb.create({
      title,
      description,
      category,
      status: 'open',
      priority,
      location,
      createdBy: {
        id: req.user!.id,
        name: req.user!.name || req.user!.email.split('@')[0],
        email: req.user!.email,
        phone: req.user!.phone
      }
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
        await slackFallback.sendTicketNotification(newTicket);
        logger.info('Slack notification sent for ticket', { ticketId: newTicket.id });
      }
    } catch (slackError) {
      logger.error('Failed to send Slack notification for ticket:', slackError);
      // Don't fail the ticket creation if Slack notification fails
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
    
    const updatedTicket = await ticketDb.updateStatus(id, status);
    
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

// POST /api/tickets/:id/comments - Add comment to ticket
router.post('/:id/comments', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required'
      });
    }
    
    // Create new comment
    const newComment = await ticketDb.addComment(id, {
      text,
      createdBy: {
        id: req.user!.id,
        name: req.user!.name || req.user!.email.split('@')[0],
        email: req.user!.email,
        phone: req.user!.phone
      }
    });
    
    logger.info('Comment added to ticket', {
      ticketId: id,
      commentId: newComment.id,
      createdBy: req.user!.email
    });
    
    res.json({
      success: true,
      data: newComment
    });
  } catch (error) {
    logger.error('Failed to add comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment'
    });
  }
});

// PATCH /api/tickets/:id/assign - Assign ticket to user
router.patch('/:id/assign', authenticate, authorize(['admin', 'operator']), async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userName, userEmail } = req.body;
    
    // For now, we'll just update the status since assignment isn't implemented in the DB util
    // This is a placeholder until we add the assignment functionality
    
    res.json({
      success: true,
      message: 'Assignment functionality coming soon'
    });
  } catch (error) {
    logger.error('Failed to update ticket assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ticket assignment'
    });
  }
});

// DELETE /api/tickets/:id - Delete a ticket
router.delete('/:id', authenticate, authorize(['admin', 'operator']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = await ticketDb.delete(id);
    
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

// DELETE /api/tickets/clear-all - Clear all tickets (admin only)
router.delete('/clear-all', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { category, status } = req.query;
    
    const deletedCount = await ticketDb.clearAll({
      category: category as string,
      status: status as string
    });
    
    logger.info('Tickets cleared', {
      deletedCount,
      category,
      status,
      clearedBy: req.user!.email
    });
    
    res.json({
      success: true,
      message: `${deletedCount} ticket(s) cleared successfully`,
      data: { deletedCount }
    });
  } catch (error) {
    logger.error('Failed to clear tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear tickets'
    });
  }
});

// GET /api/tickets/stats - Get ticket statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = await ticketDb.getStats();
    
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
