import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';
import { readJsonFile, writeJsonFile, appendToJsonArray } from '../utils/fileUtils';
import { Ticket } from '../types';
import { db } from '../utils/database';
import { slackFallback } from '../services/slackFallback';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Helper to get tickets (database first, then JSON)
async function getTickets(filters?: { status?: string; category?: string; assignedTo?: string }): Promise<Ticket[]> {
  let tickets: Ticket[] = [];
  
  if (db.isEnabled()) {
    try {
      const dbTickets = await db.getTickets({
        status: filters?.status,
        category: filters?.category,
        assigned_to_id: filters?.assignedTo
      });
      
      tickets = dbTickets.map(t => ({
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
      }));
    } catch (error) {
      logger.error('Database error, falling back to JSON:', error);
    }
  }
  
  // Fall back to JSON if no database results
  if (tickets.length === 0) {
    const allTickets = await readJsonFile<Ticket[]>('tickets.json');
    tickets = allTickets;
    
    // Apply filters
    if (filters?.status) {
      tickets = tickets.filter(t => t.status === filters.status);
    }
    if (filters?.category) {
      tickets = tickets.filter(t => t.category === filters.category);
    }
    if (filters?.assignedTo) {
      tickets = tickets.filter(t => t.assignedTo?.id === filters.assignedTo);
    }
  }
  
  return tickets;
}

// GET /api/tickets - Get tickets with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { category, status, assignedTo } = req.query;
    
    const tickets = await getTickets({
      category: category as string,
      status: status as string,
      assignedTo: assignedTo as string
    });
    
    res.json({
      success: true,
      data: tickets,
      source: db.isEnabled() ? 'database' : 'json'
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
    
    const newTicket: Ticket = {
      id: uuidv4(),
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
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: []
    };
    
    // Try to save to database first
    if (db.isEnabled()) {
      try {
        const dbTicket = await db.createTicket({
          title: newTicket.title,
          description: newTicket.description,
          category: newTicket.category,
          status: newTicket.status,
          priority: newTicket.priority,
          location: newTicket.location,
          created_by_id: newTicket.createdBy.id,
          created_by_name: newTicket.createdBy.name,
          created_by_email: newTicket.createdBy.email,
          created_by_phone: newTicket.createdBy.phone
        });
        
        // Update ticket with database values
        newTicket.id = dbTicket.id;
        newTicket.createdAt = dbTicket.created_at.toISOString();
        newTicket.updatedAt = dbTicket.updated_at.toISOString();
      } catch (error) {
        logger.error('Database error, saving to JSON only:', error);
      }
    }
    
    // Always save to JSON as backup
    const tickets = await readJsonFile<Ticket[]>('tickets.json');
    tickets.push(newTicket);
    await writeJsonFile('tickets.json', tickets);
    
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
    }
    
    res.json({
      success: true,
      data: newTicket,
      storage: db.isEnabled() ? 'database' : 'json'
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
    
    let updatedTicket: Ticket | null = null;
    
    // Try to update in database first
    if (db.isEnabled()) {
      try {
        const dbTicket = await db.updateTicketStatus(id, status);
        if (dbTicket) {
          updatedTicket = {
            id: dbTicket.id,
            title: dbTicket.title,
            description: dbTicket.description,
            category: dbTicket.category,
            status: dbTicket.status,
            priority: dbTicket.priority,
            location: dbTicket.location,
            createdBy: {
              id: dbTicket.created_by_id,
              name: dbTicket.created_by_name,
              email: dbTicket.created_by_email,
              phone: dbTicket.created_by_phone
            },
            assignedTo: dbTicket.assigned_to_id ? {
              id: dbTicket.assigned_to_id,
              name: dbTicket.assigned_to_name!,
              email: dbTicket.assigned_to_email!
            } : undefined,
            createdAt: dbTicket.created_at.toISOString(),
            updatedAt: dbTicket.updated_at.toISOString(),
            resolvedAt: dbTicket.resolved_at?.toISOString(),
            comments: []
          };
        }
      } catch (error) {
        logger.error('Database error:', error);
      }
    }
    
    // Also update in JSON
    const tickets = await readJsonFile<Ticket[]>('tickets.json');
    const ticketIndex = tickets.findIndex(t => t.id === id);
    
    if (ticketIndex !== -1) {
      tickets[ticketIndex] = {
        ...tickets[ticketIndex],
        status,
        updatedAt: new Date().toISOString(),
        ...(status === 'resolved' || status === 'closed' ? { resolvedAt: new Date().toISOString() } : {})
      };
      await writeJsonFile('tickets.json', tickets);
      
      if (!updatedTicket) {
        updatedTicket = tickets[ticketIndex];
      }
    }
    
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
    
    let deleted = false;
    
    // Try to delete from database first
    if (db.isEnabled()) {
      try {
        deleted = await db.deleteTicket(id);
      } catch (error) {
        logger.error('Database error:', error);
      }
    }
    
    // Also delete from JSON
    const tickets = await readJsonFile<Ticket[]>('tickets.json');
    const ticketIndex = tickets.findIndex(t => t.id === id);
    
    if (ticketIndex !== -1) {
      tickets.splice(ticketIndex, 1);
      await writeJsonFile('tickets.json', tickets);
      deleted = true;
    }
    
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
    const tickets = await getTickets();
    
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
      data: stats,
      source: db.isEnabled() ? 'database' : 'json'
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
