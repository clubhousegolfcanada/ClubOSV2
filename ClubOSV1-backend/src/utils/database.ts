import { logger } from './logger';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { createTablesSQL, createIndexesSQL } from './database-tables';
import { runMigrations as runHardcodedMigrations } from './database-migrations';
import { runMigrations as runSqlMigrations } from '../scripts/runMigrations';

// Import the pool and query from db.ts
import { pool, query } from './db';

// All database interfaces
export interface DbUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'operator' | 'support' | 'kiosk';
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  isActive: boolean;
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
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
}

export interface DbBooking {
  id: string;
  user_id: string;
  simulator_id: string;
  start_time: Date;
  duration: number;
  type: 'single' | 'recurring';
  recurring_days?: number[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
  cancelled_at?: Date;
  metadata?: any;
}

class DatabaseService {
  public initialized = false;

  // Create all tables
  private async createAllTables(): Promise<void> {
    logger.info('Creating/verifying all database tables...');
    
    // Create tables
    for (const [tableName, sql] of Object.entries(createTablesSQL)) {
      try {
        await query(sql);
        logger.info(`✅ Table ${tableName} ready`);
      } catch (error) {
        logger.error(`❌ Failed to create table ${tableName}:`, error);
        throw error;
      }
    }
    
    // Create indexes
    for (const indexSQL of createIndexesSQL) {
      try {
        await query(indexSQL);
      } catch (error) {
        logger.error(`Failed to create index:`, error);
        // Don't throw on index errors
      }
    }
    
    logger.info('✅ All database tables created/verified');
  }

  // Initialize database connection
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Test connection
      const result = await query('SELECT 1 as test');
      if (!result.rows[0]?.test) {
        throw new Error('Database connection test failed');
      }
      
      logger.info('Database connection verified');
      
      // Create all tables
      await this.createAllTables();
      
      // Run hardcoded migrations first to update existing tables
      await runHardcodedMigrations();
      
      // Run SQL migrations from files
      try {
        logger.info('Running SQL migrations...');
        await runSqlMigrations();
      } catch (error) {
        logger.error('SQL migrations failed:', error);
        // Don't throw - allow app to start even if migrations fail
      }
      
      this.initialized = true;
      
      // Ensure default admin exists
      await this.ensureDefaultAdmin();
    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  // User operations
  async findUserByEmail(email: string): Promise<DbUser | null> {
    try {
      const result = await query('SELECT * FROM "Users" WHERE email = $1', [email]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  async findUserById(id: string): Promise<DbUser | null> {
    try {
      const result = await query('SELECT * FROM "Users" WHERE id = $1', [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by id:', error);
      throw error;
    }
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
      `INSERT INTO "Users" (id, email, password, name, role, phone, "createdAt", "updatedAt", "isActive") 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true) 
       RETURNING *`,
      [id, user.email, hashedPassword, user.name, user.role, user.phone]
    );
    return result.rows[0];
  }

  async updateUser(id: string, updates: Partial<DbUser>): Promise<DbUser | null> {
    const allowedFields = ['name', 'email', 'phone', 'role', 'isActive'];
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updateFields.push(`"${key}" = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return this.findUserById(id);
    }

    updateFields.push(`"updatedAt" = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(
      `UPDATE "Users" SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  async updateUserPassword(id: string, newPassword: string): Promise<boolean> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await query(
      'UPDATE "Users" SET password = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, id]
    );
    return (result.rowCount || 0) > 0;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await query('DELETE FROM "Users" WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  async getAllUsers(): Promise<DbUser[]> {
    const result = await query('SELECT * FROM "Users" ORDER BY "createdAt" DESC');
    return result.rows;
  }

  async updateLastLogin(id: string): Promise<void> {
    await query('UPDATE "Users" SET "lastLogin" = CURRENT_TIMESTAMP WHERE id = $1', [id]);
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
      'SELECT * FROM feedback WHERE is_useful = false ORDER BY "createdAt" DESC'
    );
    return result.rows;
  }

  async clearNotUsefulFeedback(): Promise<number> {
    const result = await query('DELETE FROM feedback WHERE is_useful = false');
    return result.rowCount || 0;
  }

  // Ticket operations
  async createTicket(ticket: Omit<DbTicket, 'id' | 'createdAt' | 'updatedAt'>): Promise<DbTicket> {
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
        JSON.stringify(ticket.metadata || {})
      ]
    );
    return result.rows[0];
  }

  async getTickets(filters?: {
    status?: string;
    category?: string;
    assigned_to_id?: string;
    created_by_id?: string;
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

    if (filters?.created_by_id) {
      paramCount++;
      conditions.push(`created_by_id = $${paramCount}`);
      values.push(filters.created_by_id);
    }

    if (conditions.length > 0) {
      queryText += ` WHERE ${conditions.join(' AND ')}`;
    }

    queryText += ' ORDER BY "createdAt" DESC';

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
    return (result.rowCount || 0) > 0;
  }

  // Booking operations
  async createBooking(booking: Omit<DbBooking, 'id' | 'created_at' | 'updated_at'>): Promise<DbBooking> {
    const id = uuidv4();
    const result = await query(
      `INSERT INTO bookings (
        id, user_id, simulator_id, start_time, duration, type, 
        recurring_days, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        id,
        booking.user_id,
        booking.simulator_id,
        booking.start_time,
        booking.duration,
        booking.type,
        booking.recurring_days,
        booking.status || 'confirmed',
        JSON.stringify(booking.metadata || {})
      ]
    );
    return result.rows[0];
  }

  async getBookings(filters?: { status?: string;
    user_id?: string;
    simulator_id?: string;
    date?: Date;
  }): Promise<DbBooking[]> {
    let queryText = 'SELECT * FROM bookings';
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (filters?.user_id) {
      paramCount++;
      conditions.push(`user_id = $${paramCount}`);
      values.push(filters.user_id);
    }

    if (filters?.simulator_id) {
      paramCount++;
      conditions.push(`simulator_id = $${paramCount}`);
      values.push(filters.simulator_id);
    }

    if (filters?.date) {
      paramCount++;
      conditions.push(`DATE(start_time) = DATE($${paramCount})`);
      values.push(filters.date);
    }

    if (conditions.length > 0) {
      queryText += ` WHERE ${conditions.join(' AND ')}`;
    }

    queryText += ' ORDER BY start_time DESC';

    const result = await query(queryText, values);
    return result.rows;
  }

  async updateBookingStatus(id: string, status: string): Promise<DbBooking | null> {
    const result = await query(
      `UPDATE bookings 
       SET status = $1, 
           updated_at = CURRENT_TIMESTAMP,
           cancelled_at = CASE WHEN $1 = 'cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    return result.rows[0] || null;
  }

  // Auth log operations
  async createAuthLog(log: {
    user_id?: string;
    action: string;
    ip_address?: string;
    user_agent?: string;
    success?: boolean;
    error_message?: string;
  }): Promise<void> {
    await query(
      `INSERT INTO auth_logs (id, user_id, action, ip_address, user_agent, success, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        uuidv4(),
        log.user_id,
        log.action,
        log.ip_address,
        log.user_agent,
        log.success !== false,
        log.error_message
      ]
    );
  }

  // Access log operations
  async createAccessLog(log: {
    user_id?: string;
    user_email?: string;
    action: string;
    resource?: string;
    ip_address?: string;
    user_agent?: string;
    success?: boolean;
    error_message?: string;
    metadata?: any;
  }): Promise<void> {
    await query(
      `INSERT INTO access_logs (
        id, user_id, user_email, action, resource, ip_address, 
        user_agent, success, error_message, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        uuidv4(),
        log.user_id,
        log.user_email,
        log.action,
        log.resource,
        log.ip_address,
        log.user_agent,
        log.success !== false,
        log.error_message,
        JSON.stringify(log.metadata || {})
      ]
    );
  }

  // Request log operations
  async createRequestLog(log: {
    method: string;
    path: string;
    status_code?: number;
    response_time?: number;
    user_id?: string;
    ip_address?: string;
    user_agent?: string;
    error?: string;
  }): Promise<void> {
    await query(
      `INSERT INTO request_logs (
        id, method, path, status_code, response_time, 
        user_id, ip_address, user_agent, error
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        uuidv4(),
        log.method,
        log.path,
        log.status_code,
        log.response_time,
        log.user_id,
        log.ip_address,
        log.user_agent,
        log.error
      ]
    );
  }

  // System config operations
  async getConfig(key: string): Promise<any> {
    const result = await query(
      'SELECT value FROM system_config WHERE key = $1',
      [key]
    );
    return result.rows[0]?.value;
  }

  async setConfig(key: string, value: any, description?: string): Promise<void> {
    await query(
      `INSERT INTO system_config (key, value, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) 
       DO UPDATE SET value = $2, description = COALESCE($3, system_config.description), updated_at = CURRENT_TIMESTAMP`,
      [key, JSON.stringify(value), description]
    );
  }

  // Customer interaction operations
  async createCustomerInteraction(interaction: {
    user_id?: string;
    user_email?: string;
    request_text: string;
    response_text?: string;
    route?: string;
    confidence?: number;
    suggested_priority?: string;
    session_id?: string;
    metadata?: any;
  }): Promise<void> {
    await query(
      `INSERT INTO customer_interactions (
        id, user_id, user_email, request_text, response_text, 
        route, confidence, suggested_priority, session_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        uuidv4(),
        interaction.user_id,
        interaction.user_email,
        interaction.request_text,
        interaction.response_text,
        interaction.route,
        interaction.confidence,
        interaction.suggested_priority,
        interaction.session_id,
        JSON.stringify(interaction.metadata || {})
      ]
    );
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

  // Always return true since we're fully committed to PostgreSQL
  isEnabled(): boolean {
    return this.initialized;
  }

  // Direct query access
  async query(text: string, params?: any[]): Promise<any> {
    return await query(text, params);
  }

  // Request logging
  async logRequest(log: {
    method: string;
    path: string;
    status_code?: number;
    response_time?: number;
    user_id?: string;
    ip_address?: string;
    user_agent?: string;
    error?: string | null;
  }): Promise<void> {
    try {
      await query(
        `INSERT INTO request_logs 
         (method, path, status_code, response_time, user_id, ip_address, user_agent, error)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [log.method, log.path, log.status_code, log.response_time, 
         log.user_id, log.ip_address, log.user_agent, log.error]
      );
    } catch (error) {
      logger.error('Failed to log request:', error);
    }
  }

  // Get access logs with filters
  async getAccessLogs(filters?: {
    user_id?: string;
    action?: string;
    success?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    let queryText = 'SELECT * FROM access_logs WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (filters?.user_id) {
      queryText += ` AND user_id = $${++paramCount}`;
      params.push(filters.user_id);
    }
    if (filters?.action) {
      queryText += ` AND action = $${++paramCount}`;
      params.push(filters.action);
    }
    if (filters?.success !== undefined) {
      queryText += ` AND success = $${++paramCount}`;
      params.push(filters.success);
    }

    queryText += ' ORDER BY "createdAt" DESC';
    
    if (filters?.limit) {
      queryText += ` LIMIT $${++paramCount}`;
      params.push(filters.limit);
    }
    if (filters?.offset) {
      queryText += ` OFFSET $${++paramCount}`;
      params.push(filters.offset);
    }

    const result = await query(queryText, params);
    return result.rows;
  }

  // Get auth logs with filters
  async getAuthLogs(filters?: {
    user_id?: string;
    action?: string;
    success?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    let queryText = 'SELECT * FROM auth_logs WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (filters?.user_id) {
      queryText += ` AND user_id = $${++paramCount}`;
      params.push(filters.user_id);
    }
    if (filters?.action) {
      queryText += ` AND action = $${++paramCount}`;
      params.push(filters.action);
    }
    if (filters?.success !== undefined) {
      queryText += ` AND success = $${++paramCount}`;
      params.push(filters.success);
    }

    queryText += ' ORDER BY "createdAt" DESC';
    
    if (filters?.limit) {
      queryText += ` LIMIT $${++paramCount}`;
      params.push(filters.limit);
    }
    if (filters?.offset) {
      queryText += ` OFFSET $${++paramCount}`;
      params.push(filters.offset);
    }

    const result = await query(queryText, params);
    return result.rows;
  }

  // Get request logs with filters
  async getRequestLogs(filters?: {
    path?: string;
    status_code?: number;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    let queryText = 'SELECT * FROM request_logs WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (filters?.path) {
      queryText += ` AND path LIKE $${++paramCount}`;
      params.push(`%${filters.path}%`);
    }
    if (filters?.status_code) {
      queryText += ` AND status_code = $${++paramCount}`;
      params.push(filters.status_code);
    }

    queryText += ' ORDER BY "createdAt" DESC';
    
    if (filters?.limit) {
      queryText += ` LIMIT $${++paramCount}`;
      params.push(filters.limit);
    }
    if (filters?.offset) {
      queryText += ` OFFSET $${++paramCount}`;
      params.push(filters.offset);
    }

    const result = await query(queryText, params);
    return result.rows;
  }

  // Cancel booking
  async cancelBooking(id: string): Promise<boolean> {
    try {
      const result = await query(
        `UPDATE bookings 
         SET status = 'cancelled', 
             cancelled_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error('Failed to cancel booking:', error);
      return false;
    }
  }

  // Log access
  async logAccess(log: {
    user_id?: string;
    user_email?: string;
    action: string;
    resource?: string;
    ip_address?: string;
    user_agent?: string;
    success?: boolean;
    error_message?: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await query(
        `INSERT INTO access_logs 
         (user_id, user_email, action, resource, ip_address, user_agent, success, error_message, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [log.user_id, log.user_email, log.action, log.resource, 
         log.ip_address, log.user_agent, log.success ?? true, 
         log.error_message, log.metadata || {}]
      );
    } catch (error) {
      logger.error('Failed to log access:', error);
    }
  }

  // Log auth event
  async logAuth(log: {
    user_id?: string;
    action: string;
    ip_address?: string;
    user_agent?: string;
    success?: boolean;
    error_message?: string;
  }): Promise<void> {
    try {
      await query(
        `INSERT INTO auth_logs 
         (user_id, action, ip_address, user_agent, success, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true)`,
        [log.user_id, log.action, log.ip_address, 
         log.user_agent, log.success ?? true, log.error_message]
      );
    } catch (error) {
      logger.error('Failed to log auth event:', error);
    }
  }

  // Close database connections
  async end(): Promise<void> {
    try {
      await pool.end();
      logger.info('Database pool closed');
    } catch (error) {
      logger.error('Error closing database pool:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const db = new DatabaseService();

// Also export pool for direct access if needed
export { pool };
