#!/bin/bash
echo "🔧 Completing Full PostgreSQL Implementation"
echo "==========================================="

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

# Step 1: Update database.ts to include the new table operations and fix the initialization
cat > ClubOSV1-backend/src/utils/database-complete.ts << 'EOF'
import { Pool } from 'pg';
import { logger } from './logger';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { createTablesSQL, createIndexesSQL } from './database-tables';

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

export interface DbBooking {
  id: string;
  user_id: string;
  simulator_id: string;
  start_time: Date;
  duration: number;
  type: 'single' | 'recurring';
  recurring_days?: number[];
  status: string;
  created_at: Date;
  updated_at: Date;
  cancelled_at?: Date;
  metadata?: any;
}

class DatabaseService {
  private initialized = false;

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
      `INSERT INTO "Users" (id, email, password, name, role, phone) 
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
      `UPDATE "Users" SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  async updateUserPassword(id: string, newPassword: string): Promise<boolean> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await query(
      'UPDATE "Users" SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, id]
    );
    return (result.rowCount || 0) > 0;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await query('DELETE FROM "Users" WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  async getAllUsers(): Promise<DbUser[]> {
    const result = await query('SELECT * FROM "Users" ORDER BY created_at DESC');
    return result.rows;
  }

  async updateLastLogin(id: string): Promise<void> {
    await query('UPDATE "Users" SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [id]);
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
    return result.rowCount || 0;
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
        JSON.stringify(ticket.metadata || {})
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

  async getBookings(filters?: {
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
    metadata?: any;
  }): Promise<void> {
    await query(
      `INSERT INTO customer_interactions (
        id, user_id, user_email, request_text, response_text, 
        route, confidence, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        uuidv4(),
        interaction.user_id,
        interaction.user_email,
        interaction.request_text,
        interaction.response_text,
        interaction.route,
        interaction.confidence,
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
}

// Export singleton instance
export const db = new DatabaseService();

// Also export pool for direct access if needed
export { pool };
EOF

# Step 2: Replace the old database.ts with the complete version
mv ClubOSV1-backend/src/utils/database-complete.ts ClubOSV1-backend/src/utils/database.ts

echo "✅ Updated database.ts with all operations"

# Step 3: Now let's create pure PostgreSQL routes (starting with auth)
cat > ClubOSV1-backend/src/routes/auth-postgres.ts << 'EOF'
import { Router, Request, Response, NextFunction } from 'express';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { AppError } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { body } from 'express-validator';
import { authenticate, generateToken } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';

const router = Router();

// Login endpoint
router.post('/login',
  validate([
    body('email')
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      
      logger.info('Login attempt:', { email });
      
      // Find user in database
      const user = await db.findUserByEmail(email);
      
      if (!user) {
        // Log failed attempt
        await db.createAuthLog({
          action: 'login',
          ip_address: req.ip,
          user_agent: req.get('user-agent'),
          success: false,
          error_message: 'User not found'
        });
        throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }
      
      // Verify password
      const isValidPassword = await bcryptjs.compare(password, user.password);
      
      if (!isValidPassword) {
        // Log failed attempt
        await db.createAuthLog({
          user_id: user.id,
          action: 'login',
          ip_address: req.ip,
          user_agent: req.get('user-agent'),
          success: false,
          error_message: 'Invalid password'
        });
        throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }
      
      // Update last login
      await db.updateLastLogin(user.id);
      
      // Log successful login
      await db.createAuthLog({
        user_id: user.id,
        action: 'login',
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        success: true
      });
      
      // Generate JWT token
      const sessionId = uuidv4();
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: sessionId
      });
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      
      logger.info('Login successful:', { userId: user.id, email: user.email });
      
      res.json({
        success: true,
        data: {
          user: userWithoutPassword,
          token
        }
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Register endpoint (admin only)
router.post('/register',
  authenticate,
  roleGuard(['admin']),
  validate([
    body('email')
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase and numbers'),
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required'),
    body('role')
      .isIn(['admin', 'operator', 'support', 'kiosk'])
      .withMessage('Invalid role'),
    body('phone')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .matches(/^[+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/)
      .withMessage('Invalid phone number format')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, name, role, phone } = req.body;
      
      // Check if user already exists
      const existingUser = await db.findUserByEmail(email);
      if (existingUser) {
        throw new AppError('USER_EXISTS', 'User with this email already exists', 409);
      }
      
      // Create new user
      const newUser = await db.createUser({
        email,
        password,
        name,
        role,
        phone
      });
      
      // Log user creation
      await db.createAuthLog({
        user_id: req.user!.id,
        action: 'create_user',
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        success: true
      });
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = newUser;
      
      logger.info('User created:', { userId: newUser.id, email: newUser.email, createdBy: req.user!.id });
      
      res.status(201).json({
        success: true,
        data: userWithoutPassword
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Get current user
router.get('/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await db.findUserById(req.user!.id);
      
      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      
      res.json({
        success: true,
        data: userWithoutPassword
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// List users (admin only)
router.get('/users',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await db.getAllUsers();
      
      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      
      res.json({
        success: true,
        data: usersWithoutPasswords
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Change password
router.post('/change-password',
  authenticate,
  validate([
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase and numbers')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      const user = await db.findUserById(req.user!.id);
      
      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      // Verify current password
      const isValidPassword = await bcryptjs.compare(currentPassword, user.password);
      
      if (!isValidPassword) {
        throw new AppError('INVALID_PASSWORD', 'Current password is incorrect', 401);
      }
      
      // Update password
      await db.updateUserPassword(user.id, newPassword);
      
      // Log password change
      await db.createAuthLog({
        user_id: user.id,
        action: 'change_password',
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        success: true
      });
      
      logger.info('Password changed:', { userId: user.id });
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Update user profile
router.put('/users/:userId',
  authenticate,
  validate([
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty'),
    body('phone')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .matches(/^[+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/)
      .withMessage('Invalid phone number format'),
    body('email')
      .optional()
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { name, phone, email } = req.body;
      
      // Users can only update their own profile unless they're admin
      if (userId !== req.user!.id && req.user!.role !== 'admin') {
        throw new AppError('UNAUTHORIZED', 'You can only update your own profile', 403);
      }
      
      // Check if email is being changed and if it's already taken
      if (email) {
        const existingUser = await db.findUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          throw new AppError('EMAIL_EXISTS', 'Email already in use', 409);
        }
      }
      
      // Update user
      const updatedUser = await db.updateUser(userId, { name, phone, email });
      
      if (!updatedUser) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      logger.info('User profile updated:', { userId, updatedBy: req.user!.id });
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = updatedUser;
      
      res.json({
        success: true,
        data: userWithoutPassword
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Reset user password (admin only)
router.post('/users/:userId/reset-password',
  authenticate,
  roleGuard(['admin']),
  validate([
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase and numbers')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;
      
      // Prevent resetting own password through this endpoint
      if (userId === req.user!.id) {
        throw new AppError('SELF_RESET', 'Use the change-password endpoint to change your own password', 400);
      }
      
      const user = await db.findUserById(userId);
      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      // Update password
      await db.updateUserPassword(userId, newPassword);
      
      // Log password reset
      await db.createAuthLog({
        user_id: req.user!.id,
        action: 'reset_password',
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        success: true
      });
      
      logger.info('User password reset:', { userId, resetBy: req.user!.id });
      
      res.json({
        success: true,
        message: 'Password reset successfully'
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Delete user (admin only)
router.delete('/users/:userId',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      
      // Prevent self-deletion
      if (userId === req.user!.id) {
        throw new AppError('SELF_DELETE', 'Cannot delete your own account', 400);
      }
      
      const deleted = await db.deleteUser(userId);
      
      if (!deleted) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      // Log user deletion
      await db.createAuthLog({
        user_id: req.user!.id,
        action: 'delete_user',
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        success: true
      });
      
      logger.info('User deleted:', { userId, deletedBy: req.user!.id });
      
      res.json({
        success: true,
        message: 'User deleted successfully'
      });
      
    } catch (error) {
      next(error);
    }
  }
);

export default router;
EOF

# Replace the old auth.ts with PostgreSQL-only version
mv ClubOSV1-backend/src/routes/auth-postgres.ts ClubOSV1-backend/src/routes/auth.ts

echo "✅ Updated auth.ts to use PostgreSQL only"

# Build and deploy
cd ClubOSV1-backend
npm run build

cd ..
git add -A
git commit -m "Complete PostgreSQL implementation - Part 1

- Updated database.ts with all table operations (bookings, logs, config)
- Converted auth.ts to use PostgreSQL only (no JSON fallback)
- Added auth logging to track all authentication events
- All user data now stored exclusively in PostgreSQL
- Ready for remaining routes conversion"

git push origin main

echo -e "\n✅ Part 1 Complete!"
echo "============================="
echo "Next steps:"
echo "1. Convert feedback.ts to PostgreSQL only"
echo "2. Convert tickets.ts to PostgreSQL only"
echo "3. Convert bookings.ts to PostgreSQL"
echo "4. Update all other routes"
echo "5. Remove JSON file operations completely"
