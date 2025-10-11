import { query } from '../utils/db';
import { logger } from '../utils/logger';

// Ticket types
export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: 'facilities' | 'tech';
  status: 'open' | 'in-progress' | 'resolved' | 'closed' | 'archived';
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
  archivedAt?: string;
  archivedBy?: string;
  comments?: TicketComment[];
}

export interface TicketComment {
  id: string;
  ticketId: string;
  text: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  createdAt: string;
}

// Ticket database operations
export const ticketDb = {
  // Get all tickets with optional filters
  async getAll(filters?: { category?: string; status?: string; assignedTo?: string }): Promise<Ticket[]> {
    try {
      let queryText = `
        SELECT 
          t.*,
          json_agg(
            DISTINCT jsonb_build_object(
              'id', tc.id,
              'text', tc.text,
              'createdBy', jsonb_build_object(
                'id', tc.created_by_id,
                'name', tc.created_by_name,
                'email', tc.created_by_email,
                'phone', tc.created_by_phone
              ),
              'createdAt', tc.created_at
            ) ORDER BY tc.created_at DESC
          ) FILTER (WHERE tc.id IS NOT NULL) as comments
        FROM tickets t
        LEFT JOIN ticket_comments tc ON t.id = tc.ticket_id
      `;
      
      const conditions: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      if (filters?.category) {
        paramCount++;
        conditions.push(`t.category = $${paramCount}`);
        values.push(filters.category);
      }

      if (filters?.status) {
        paramCount++;
        conditions.push(`t.status = $${paramCount}`);
        values.push(filters.status);
      }

      if (filters?.assignedTo) {
        paramCount++;
        conditions.push(`t.assigned_to_id = $${paramCount}`);
        values.push(filters.assignedTo);
      }

      if (conditions.length > 0) {
        queryText += ` WHERE ${conditions.join(' AND ')}`;
      }

      queryText += ` GROUP BY t.id ORDER BY t.created_at DESC`;

      const result = await query(queryText, values);
      
      return result.rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        status: row.status,
        priority: row.priority,
        location: row.location,
        createdBy: {
          id: row.created_by_id,
          name: row.created_by_name,
          email: row.created_by_email,
          phone: row.created_by_phone
        },
        assignedTo: row.assigned_to_id ? {
          id: row.assigned_to_id,
          name: row.assigned_to_name,
          email: row.assigned_to_email
        } : undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        resolvedAt: row.resolved_at,
        comments: row.comments || []
      }));
    } catch (error) {
      logger.error('Failed to get tickets from database:', error);
      throw error;
    }
  },

  // Create a new ticket
  async create(ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'comments'>): Promise<Ticket> {
    try {
      const result = await query(
        `INSERT INTO tickets 
        (title, description, category, status, priority, location,
         created_by_id, created_by_name, created_by_email, created_by_phone)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          ticket.title,
          ticket.description,
          ticket.category,
          ticket.status || 'open',
          ticket.priority,
          ticket.location,
          ticket.createdBy.id,
          ticket.createdBy.name,
          ticket.createdBy.email,
          ticket.createdBy.phone
        ]
      );

      const row = result.rows[0];
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        status: row.status,
        priority: row.priority,
        location: row.location,
        createdBy: {
          id: row.created_by_id,
          name: row.created_by_name,
          email: row.created_by_email,
          phone: row.created_by_phone
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        comments: []
      };
    } catch (error) {
      logger.error('Failed to create ticket in database:', error);
      throw error;
    }
  },

  // Update ticket status
  async updateStatus(id: string, status: string): Promise<Ticket | null> {
    try {
      const result = await query(
        `UPDATE tickets 
        SET status = $1, updated_at = CURRENT_TIMESTAMP,
        resolved_at = CASE WHEN $1 IN ('resolved', 'closed') THEN CURRENT_TIMESTAMP ELSE NULL END
        WHERE id = $2
        RETURNING *`,
        [status, id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        status: row.status,
        priority: row.priority,
        location: row.location,
        createdBy: {
          id: row.created_by_id,
          name: row.created_by_name,
          email: row.created_by_email,
          phone: row.created_by_phone
        },
        assignedTo: row.assigned_to_id ? {
          id: row.assigned_to_id,
          name: row.assigned_to_name,
          email: row.assigned_to_email
        } : undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        resolvedAt: row.resolved_at
      };
    } catch (error) {
      logger.error('Failed to update ticket status:', error);
      throw error;
    }
  },

  // Add comment to ticket
  async addComment(ticketId: string, comment: Omit<TicketComment, 'id' | 'ticketId' | 'createdAt'>): Promise<TicketComment> {
    try {
      const result = await query(
        `INSERT INTO ticket_comments 
        (ticket_id, text, created_by_id, created_by_name, created_by_email, created_by_phone)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          ticketId,
          comment.text,
          comment.createdBy.id,
          comment.createdBy.name,
          comment.createdBy.email,
          comment.createdBy.phone
        ]
      );

      const row = result.rows[0];
      return {
        id: row.id,
        ticketId: row.ticket_id,
        text: row.text,
        createdBy: {
          id: row.created_by_id,
          name: row.created_by_name,
          email: row.created_by_email,
          phone: row.created_by_phone
        },
        createdAt: row.created_at
      };
    } catch (error) {
      logger.error('Failed to add comment to ticket:', error);
      throw error;
    }
  },

  // Delete ticket
  async delete(id: string): Promise<boolean> {
    try {
      const result = await query('DELETE FROM tickets WHERE id = $1', [id]);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error('Failed to delete ticket:', error);
      throw error;
    }
  },

  // Clear tickets with optional filters
  async clearAll(filters?: { category?: string; status?: string }): Promise<number> {
    try {
      let queryText = 'DELETE FROM tickets';
      const conditions: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      if (filters?.category) {
        paramCount++;
        conditions.push(`category = $${paramCount}`);
        values.push(filters.category);
      }

      if (filters?.status) {
        paramCount++;
        conditions.push(`status = $${paramCount}`);
        values.push(filters.status);
      }

      if (conditions.length > 0) {
        queryText += ` WHERE ${conditions.join(' AND ')}`;
      }

      const result = await query(queryText, values);
      return result.rowCount ?? 0;
    } catch (error) {
      logger.error('Failed to clear tickets:', error);
      throw error;
    }
  },

  // Get ticket statistics
  async getStats() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'open') as open,
          COUNT(*) FILTER (WHERE status = 'in-progress') as in_progress,
          COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
          COUNT(*) FILTER (WHERE status = 'closed') as closed,
          COUNT(*) FILTER (WHERE category = 'facilities') as facilities,
          COUNT(*) FILTER (WHERE category = 'tech') as tech,
          COUNT(*) FILTER (WHERE priority = 'low') as low,
          COUNT(*) FILTER (WHERE priority = 'medium') as medium,
          COUNT(*) FILTER (WHERE priority = 'high') as high,
          COUNT(*) FILTER (WHERE priority = 'urgent') as urgent
        FROM tickets
      `);

      const row = result.rows[0];
      return {
        total: parseInt(row.total),
        byStatus: {
          open: parseInt(row.open),
          'in-progress': parseInt(row.in_progress),
          resolved: parseInt(row.resolved),
          closed: parseInt(row.closed)
        },
        byCategory: {
          facilities: parseInt(row.facilities),
          tech: parseInt(row.tech)
        },
        byPriority: {
          low: parseInt(row.low),
          medium: parseInt(row.medium),
          high: parseInt(row.high),
          urgent: parseInt(row.urgent)
        }
      };
    } catch (error) {
      logger.error('Failed to get ticket stats:', error);
      throw error;
    }
  }
};

// Run migrations
export async function runMigrations() {
  try {
    // Check if tickets table exists
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tickets'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      logger.info('Running tickets table migration...');
      
      // Read and execute migration file
      const fs = require('fs').promises;
      const path = require('path');
      const migrationPath = path.join(__dirname, '../database/migrations/002_create_tickets_table.sql');
      const migrationSQL = await fs.readFile(migrationPath, 'utf8');
      
      await query(migrationSQL);
      logger.info('Tickets table migration completed successfully');
    }
  } catch (error) {
    logger.error('Failed to run migrations:', error);
    throw error;
  }
}
