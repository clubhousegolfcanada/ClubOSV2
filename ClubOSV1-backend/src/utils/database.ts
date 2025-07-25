import { query, pool } from './db';
import { logger } from './logger';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export interface DbUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'operator' | 'support' | 'kiosk';
  phone?: string;
  created_at: Date;
  updated_at: Date;
  last_login?: Date;
  is_active: boolean;
}

export interface DbTicket {
  id: string;
  title: string;
  description: string;
  category: 'facilities' | 'tech';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  location?: string;
  created_by_id: string;
  created_by_name: string;
  created_by_email: string;
  created_by_phone?: string;
  assigned_to_id?: string;
  assigned_to_name?: string;
  assigned_to_email?: string;
  created_at: Date;
  updated_at: Date;
  resolved_at?: Date;
  metadata?: any;
}

export interface DbFeedback {
  id: string;
  timestamp: Date;
  user_id?: string;
  user_email?: string;
  request_description: string;
  location?: string;
  route?: string;
  response?: string;
  confidence?: number;
  is_useful: boolean;
  feedback_type?: string;
  feedback_source?: string;
  slack_thread_ts?: string;
  slack_user_name?: string;
  slack_user_id?: string;
  slack_channel?: string;
  original_request_id?: string;
  created_at: Date;
}

class DatabaseService {
  // Initialize database tables
  async initialize(): Promise<void> {
    try {
      // Check if we have a database connection
      const testResult = await query('SELECT 1 as test');
      if (!testResult.rows[0]?.test) {
        throw new Error('Database connection test failed');
      }
      
      logger.info('Database connection verified');
      
      // Create tables if they don't exist
      await this.createTables();
    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    try {
      // Create users table
      await query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(255),
          role VARCHAR(50) NOT NULL DEFAULT 'support',
          phone VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP,
          is_active BOOLEAN DEFAULT true,
          CONSTRAINT valid_role CHECK (role IN ('admin', 'operator', 'support', 'kiosk'))
        );
      `);

      // Create feedback table
      await query(`
        CREATE TABLE IF NOT EXISTS feedback (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          user_id UUID,
          user_email VARCHAR(255),
          request_description TEXT NOT NULL,
          location VARCHAR(255),
          route VARCHAR(50),
          response TEXT,
          confidence DECIMAL(3,2),
          is_useful BOOLEAN NOT NULL DEFAULT false,
          feedback_type VARCHAR(50),
          feedback_source VARCHAR(50) DEFAULT 'user',
          slack_thread_ts VARCHAR(255),
          slack_user_name VARCHAR(255),
          slack_user_id VARCHAR(255),
          slack_channel VARCHAR(255),
          original_request_id UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create tickets table
      await query(`
        CREATE TABLE IF NOT EXISTS tickets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          category VARCHAR(50) NOT NULL CHECK (category IN ('facilities', 'tech')),
          status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved', 'closed')),
          priority VARCHAR(50) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
          location VARCHAR(255),
          created_by_id UUID NOT NULL,
          created_by_name VARCHAR(255) NOT NULL,
          created_by_email VARCHAR(255) NOT NULL,
          created_by_phone VARCHAR(50),
          assigned_to_id UUID,
          assigned_to_name VARCHAR(255),
          assigned_to_email VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMP,
          metadata JSONB DEFAULT '{}'::jsonb
        );
      `);

      // Create ticket_comments table
      await query(`
        CREATE TABLE IF NOT EXISTS ticket_comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
          text TEXT NOT NULL,
          created_by_id UUID NOT NULL,
          created_by_name VARCHAR(255) NOT NULL,
          created_by_email VARCHAR(255) NOT NULL,
          created_by_phone VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create indexes
      await query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
      await query('CREATE INDEX IF NOT EXISTS idx_feedback_is_useful ON feedback(is_useful);');
      await query('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);');
      await query('CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);');
      await query('CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);');

      logger.info('All database tables created/verified');
    } catch (error) {
      logger.error('Failed to create tables:', error);
      throw error;
    }
  }

  // User operations
  async findUserByEmail(email: string): Promise<DbUser | null> {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  }

  async findUserById(id: string): Promise<DbUser | null> {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async createUser(user: {
    email: string;
    password: string;
    name: string;
    role: 'admin' | 'operator' | 'support' | 'kiosk';
    phone?: string;
  }): Promise<DbUser> {
    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(user.password, 10);
    
    const result = await query(
      `INSERT INTO users (id, email, password, name, role, phone) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [id, user.email, hashedPassword, user.name, user.role, user.phone]
    );
    
    return result.rows[0];
  }

  async updateUser(id: string, updates: Partial<DbUser>): Promise<DbUser | null> {
    const allowedFields = ['name', 'email', 'phone', 'role', 'is_active'];
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return this.findUserById(id);
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  async updateUserPassword(id: string, newPassword: string): Promise<boolean> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, id]
    );
    return result.rowCount > 0;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await query('DELETE FROM users WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  async getAllUsers(): Promise<DbUser[]> {
    const result = await query('SELECT * FROM users ORDER BY created_at DESC');
    return result.rows;
  }

  async updateLastLogin(id: string): Promise<void> {
    await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [id]);
  }

  // Feedback operations
  async createFeedback(feedback: Omit<DbFeedback, 'id' | 'created_at'>): Promise<DbFeedback> {
    const id = uuidv4();
    const result = await query(
      `INSERT INTO feedback (
        id, timestamp, user_id, user_email, request_description, 
        location, route, response, confidence, is_useful, 
        feedback_type, feedback_source, slack_thread_ts, 
        slack_user_name, slack_user_id, slack_channel, original_request_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        id,
        feedback.timestamp || new Date(),
        feedback.user_id,
        feedback.user_email,
        feedback.request_description,
        feedback.location,
        feedback.route,
        feedback.response,
        feedback.confidence,
        feedback.is_useful,
        feedback.feedback_type,
        feedback.feedback_source,
        feedback.slack_thread_ts,
        feedback.slack_user_name,
        feedback.slack_user_id,
        feedback.slack_channel,
        feedback.original_request_id
      ]
    );
    return result.rows[0];
  }

  async getNotUsefulFeedback(): Promise<DbFeedback[]> {
    const result = await query(
      'SELECT * FROM feedback WHERE is_useful = false ORDER BY created_at DESC'
    );
    return result.rows;
  }

  async clearNotUsefulFeedback(): Promise<number> {
    const result = await query('DELETE FROM feedback WHERE is_useful = false');
    return result.rowCount;
  }

  // Ticket operations
  async createTicket(ticket: Omit<DbTicket, 'id' | 'created_at' | 'updated_at'>): Promise<DbTicket> {
    const id = uuidv4();
    const result = await query(
      `INSERT INTO tickets (
        id, title, description, category, status, priority, location,
        created_by_id, created_by_name, created_by_email, created_by_phone,
        assigned_to_id, assigned_to_name, assigned_to_email, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        id,
        ticket.title,
        ticket.description,
        ticket.category,
        ticket.status || 'open',
        ticket.priority,
        ticket.location,
        ticket.created_by_id,
        ticket.created_by_name,
        ticket.created_by_email,
        ticket.created_by_phone,
        ticket.assigned_to_id,
        ticket.assigned_to_name,
        ticket.assigned_to_email,
        ticket.metadata || {}
      ]
    );
    return result.rows[0];
  }

  async getTickets(filters?: {
    status?: string;
    category?: string;
    assigned_to_id?: string;
  }): Promise<DbTicket[]> {
    let queryText = 'SELECT * FROM tickets';
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (filters?.status) {
      paramCount++;
      conditions.push(`status = $${paramCount}`);
      values.push(filters.status);
    }

    if (filters?.category) {
      paramCount++;
      conditions.push(`category = $${paramCount}`);
      values.push(filters.category);
    }

    if (filters?.assigned_to_id) {
      paramCount++;
      conditions.push(`assigned_to_id = $${paramCount}`);
      values.push(filters.assigned_to_id);
    }

    if (conditions.length > 0) {
      queryText += ` WHERE ${conditions.join(' AND ')}`;
    }

    queryText += ' ORDER BY created_at DESC';

    const result = await query(queryText, values);
    return result.rows;
  }

  async updateTicketStatus(id: string, status: string): Promise<DbTicket | null> {
    const result = await query(
      `UPDATE tickets 
       SET status = $1, 
           updated_at = CURRENT_TIMESTAMP,
           resolved_at = CASE WHEN $1 IN ('resolved', 'closed') THEN CURRENT_TIMESTAMP ELSE resolved_at END
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    return result.rows[0] || null;
  }

  async deleteTicket(id: string): Promise<boolean> {
    const result = await query('DELETE FROM tickets WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  // Migration helpers
  async ensureDefaultAdmin(): Promise<void> {
    const admin = await this.findUserByEmail('admin@clubhouse247golf.com');
    if (!admin) {
      await this.createUser({
        email: 'admin@clubhouse247golf.com',
        password: 'admin123',
        name: 'Admin User',
        role: 'admin'
      });
      logger.info('Default admin user created');
    }
  }
}

// Export singleton instance
export const db = new DatabaseService();
