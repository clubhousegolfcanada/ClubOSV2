import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';
import { slackFallback } from '../services/slackFallback';

const router = Router();

// Directory for ticket storage
const TICKETS_DIR = path.join(process.cwd(), 'data', 'tickets');

// Ensure tickets directory exists
const ensureTicketsDir = async () => {
  try {
    await fs.access(TICKETS_DIR);
  } catch {
    await fs.mkdir(TICKETS_DIR, { recursive: true });
  }
};

// Initialize tickets file
const initializeTicketsFile = async () => {
  await ensureTicketsDir();
  const ticketsFile = path.join(TICKETS_DIR, 'tickets.json');
  
  try {
    await fs.access(ticketsFile);
  } catch {
    // File doesn't exist, create it
    await fs.writeFile(ticketsFile, JSON.stringify([], null, 2));
  }
};

// Read tickets from file
const readTickets = async () => {
  await initializeTicketsFile();
  const ticketsFile = path.join(TICKETS_DIR, 'tickets.json');
  const data = await fs.readFile(ticketsFile, 'utf-8');
  return JSON.parse(data);
};

// Write tickets to file
const writeTickets = async (tickets: any[]) => {
  const ticketsFile = path.join(TICKETS_DIR, 'tickets.json');
  await fs.writeFile(ticketsFile, JSON.stringify(tickets, null, 2));
};

// GET /api/tickets - Get tickets with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { category, status, assignedTo } = req.query;
    
    let tickets = await readTickets();
    
    // Apply filters
    if (category) {
      tickets = tickets.filter((t: any) => t.category === category);
    }
    
    if (status) {
      tickets = tickets.filter((t: any) => t.status === status);
    }
    
    if (assignedTo) {
      tickets = tickets.filter((t: any) => t.assignedTo?.id === assignedTo);
    }
    
    // Sort by creation date (newest first)
    tickets.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
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
    
    // Fetch full user info
    let fullUser = null;
    try {
      const users = await readTickets(); // This should be reading from users.json
      const usersFile = path.join(process.cwd(), 'data', 'users.json');
      const usersData = await fs.readFile(usersFile, 'utf-8');
      const usersList = JSON.parse(usersData);
      fullUser = usersList.find((u: any) => u.id === req.user!.id);
    } catch (err) {
      logger.warn('Failed to fetch user info for ticket', { userId: req.user!.id });
    }
    
    // Create new ticket
    const newTicket = {
      id: uuidv4(),
      title,
      description,
      category,
      status: 'open',
      priority,
      location,
      createdBy: {
        id: req.user!.id,
        name: fullUser?.name || req.user!.email.split('@')[0], // Use actual name or email prefix
        email: req.user!.email,
        phone: fullUser?.phone || undefined
      },
      assignedTo: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resolvedAt: null,
      comments: []
    };
    
    // Add to tickets
    const tickets = await readTickets();
    tickets.push(newTicket);
    await writeTickets(tickets);
    
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
    
    const tickets = await readTickets();
    const ticketIndex = tickets.findIndex((t: any) => t.id === id);
    
    if (ticketIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    // Update ticket
    tickets[ticketIndex] = {
      ...tickets[ticketIndex],
      status,
      updatedAt: new Date().toISOString(),
      ...(status === 'resolved' || status === 'closed' 
        ? { resolvedAt: new Date().toISOString() } 
        : {})
    };
    
    await writeTickets(tickets);
    
    logger.info('Ticket status updated', {
      ticketId: id,
      newStatus: status,
      updatedBy: req.user!.email
    });
    
    res.json({
      success: true,
      data: tickets[ticketIndex]
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
    
    const tickets = await readTickets();
    const ticketIndex = tickets.findIndex((t: any) => t.id === id);
    
    if (ticketIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    // Fetch full user info
    let fullUser = null;
    try {
      const usersFile = path.join(process.cwd(), 'data', 'users.json');
      const usersData = await fs.readFile(usersFile, 'utf-8');
      const usersList = JSON.parse(usersData);
      fullUser = usersList.find((u: any) => u.id === req.user!.id);
    } catch (err) {
      logger.warn('Failed to fetch user info for comment', { userId: req.user!.id });
    }
    
    // Create new comment
    const newComment = {
      id: uuidv4(),
      text,
      createdBy: {
        id: req.user!.id,
        name: fullUser?.name || req.user!.email.split('@')[0],
        email: req.user!.email,
        phone: fullUser?.phone || undefined
      },
      createdAt: new Date().toISOString()
    };
    
    // Add comment to ticket
    tickets[ticketIndex].comments.push(newComment);
    tickets[ticketIndex].updatedAt = new Date().toISOString();
    
    await writeTickets(tickets);
    
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
    
    const tickets = await readTickets();
    const ticketIndex = tickets.findIndex((t: any) => t.id === id);
    
    if (ticketIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    // Update assignment
    tickets[ticketIndex] = {
      ...tickets[ticketIndex],
      assignedTo: userId ? {
        id: userId,
        name: userName || userEmail.split('@')[0],
        email: userEmail
      } : null,
      updatedAt: new Date().toISOString()
    };
    
    await writeTickets(tickets);
    
    logger.info('Ticket assignment updated', {
      ticketId: id,
      assignedTo: userEmail || 'unassigned',
      updatedBy: req.user!.email
    });
    
    res.json({
      success: true,
      data: tickets[ticketIndex]
    });
  } catch (error) {
    logger.error('Failed to update ticket assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ticket assignment'
    });
  }
});

// GET /api/tickets/stats - Get ticket statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    const tickets = await readTickets();
    
    const stats = {
      total: tickets.length,
      byStatus: {
        open: tickets.filter((t: any) => t.status === 'open').length,
        'in-progress': tickets.filter((t: any) => t.status === 'in-progress').length,
        resolved: tickets.filter((t: any) => t.status === 'resolved').length,
        closed: tickets.filter((t: any) => t.status === 'closed').length
      },
      byCategory: {
        facilities: tickets.filter((t: any) => t.category === 'facilities').length,
        tech: tickets.filter((t: any) => t.category === 'tech').length
      },
      byPriority: {
        low: tickets.filter((t: any) => t.priority === 'low').length,
        medium: tickets.filter((t: any) => t.priority === 'medium').length,
        high: tickets.filter((t: any) => t.priority === 'high').length,
        urgent: tickets.filter((t: any) => t.priority === 'urgent').length
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
