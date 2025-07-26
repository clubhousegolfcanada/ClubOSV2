#!/bin/bash
echo "🚀 Full PostgreSQL Implementation - Part 3"
echo "========================================"

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

# Create PostgreSQL-only bookings route
cat > ClubOSV1-backend/src/routes/bookings-postgres.ts << 'EOF'
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/bookings - Get bookings for user or all (admin/operator)
router.get('/', authenticate, async (req, res) => {
  try {
    const { simulator_id, date, status } = req.query;
    
    // Admin/operator can see all bookings
    const userId = (req.user?.role === 'admin' || req.user?.role === 'operator') 
      ? undefined 
      : req.user?.id;
    
    const bookings = await db.getBookings({
      user_id: userId,
      simulator_id: simulator_id as string,
      date: date ? new Date(date as string) : undefined,
      status: status as string
    });
    
    res.json({
      success: true,
      data: bookings.map(b => ({
        id: b.id,
        userId: b.user_id,
        simulatorId: b.simulator_id,
        startTime: b.start_time.toISOString(),
        duration: b.duration,
        type: b.type,
        recurringDays: b.recurring_days,
        status: b.status,
        createdAt: b.created_at.toISOString(),
        updatedAt: b.updated_at.toISOString(),
        cancelledAt: b.cancelled_at?.toISOString(),
        metadata: b.metadata
      }))
    });
  } catch (error) {
    logger.error('Failed to get bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve bookings'
    });
  }
});

// POST /api/bookings - Create a new booking
router.post('/', authenticate, async (req, res) => {
  try {
    const { 
      simulatorId, 
      startTime, 
      duration, 
      type = 'single', 
      recurringDays 
    } = req.body;
    
    // Validate required fields
    if (!simulatorId || !startTime || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: simulatorId, startTime, duration'
      });
    }
    
    // Validate duration (30-240 minutes)
    if (duration < 30 || duration > 240) {
      return res.status(400).json({
        success: false,
        message: 'Duration must be between 30 and 240 minutes'
      });
    }
    
    // Check for conflicts
    const existingBookings = await db.getBookings({
      simulator_id: simulatorId,
      date: new Date(startTime)
    });
    
    const newStart = new Date(startTime);
    const newEnd = new Date(newStart.getTime() + duration * 60000);
    
    const hasConflict = existingBookings.some(booking => {
      if (booking.status === 'cancelled') return false;
      
      const bookingEnd = new Date(booking.start_time.getTime() + booking.duration * 60000);
      return (newStart < bookingEnd && newEnd > booking.start_time);
    });
    
    if (hasConflict) {
      return res.status(409).json({
        success: false,
        message: 'Time slot is already booked'
      });
    }
    
    // Create booking
    const newBooking = await db.createBooking({
      user_id: req.user!.id,
      simulator_id: simulatorId,
      start_time: new Date(startTime),
      duration,
      type,
      recurring_days: recurringDays,
      status: 'confirmed'
    });
    
    logger.info('Booking created', {
      bookingId: newBooking.id,
      userId: req.user!.id,
      simulatorId,
      startTime
    });
    
    res.json({
      success: true,
      data: {
        id: newBooking.id,
        userId: newBooking.user_id,
        simulatorId: newBooking.simulator_id,
        startTime: newBooking.start_time.toISOString(),
        duration: newBooking.duration,
        type: newBooking.type,
        recurringDays: newBooking.recurring_days,
        status: newBooking.status,
        createdAt: newBooking.created_at.toISOString(),
        updatedAt: newBooking.updated_at.toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to create booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking'
    });
  }
});

// PATCH /api/bookings/:id/cancel - Cancel a booking
router.patch('/:id/cancel', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get booking to check ownership
    const bookings = await db.getBookings({ user_id: req.user!.id });
    const booking = bookings.find(b => b.id === id);
    
    if (!booking) {
      // Check if admin/operator
      if (req.user?.role === 'admin' || req.user?.role === 'operator') {
        // Admin/operator can cancel any booking
        const allBookings = await db.getBookings({});
        const adminBooking = allBookings.find(b => b.id === id);
        
        if (!adminBooking) {
          return res.status(404).json({
            success: false,
            message: 'Booking not found'
          });
        }
      } else {
        return res.status(404).json({
          success: false,
          message: 'Booking not found or unauthorized'
        });
      }
    }
    
    // Cancel booking
    const cancelled = await db.cancelBooking(id);
    
    if (!cancelled) {
      return res.status(500).json({
        success: false,
        message: 'Failed to cancel booking'
      });
    }
    
    logger.info('Booking cancelled', {
      bookingId: id,
      cancelledBy: req.user!.email
    });
    
    res.json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    logger.error('Failed to cancel booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking'
    });
  }
});

// GET /api/bookings/availability - Check availability for a time slot
router.get('/availability', authenticate, async (req, res) => {
  try {
    const { simulatorId, date, duration = 60 } = req.query;
    
    if (!simulatorId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: simulatorId, date'
      });
    }
    
    const bookings = await db.getBookings({
      simulator_id: simulatorId as string,
      date: new Date(date as string)
    });
    
    // Generate available time slots (6 AM to 10 PM)
    const slots = [];
    const startDate = new Date(date as string);
    startDate.setHours(6, 0, 0, 0);
    
    for (let hour = 6; hour < 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotStart = new Date(startDate);
        slotStart.setHours(hour, minute, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + Number(duration) * 60000);
        
        // Check if slot conflicts with any booking
        const isAvailable = !bookings.some(booking => {
          if (booking.status === 'cancelled') return false;
          
          const bookingEnd = new Date(booking.start_time.getTime() + booking.duration * 60000);
          return (slotStart < bookingEnd && slotEnd > booking.start_time);
        });
        
        if (isAvailable && slotEnd.getHours() <= 22) {
          slots.push({
            startTime: slotStart.toISOString(),
            endTime: slotEnd.toISOString(),
            available: true
          });
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        simulatorId,
        date: date as string,
        duration: Number(duration),
        availableSlots: slots
      }
    });
  } catch (error) {
    logger.error('Failed to check availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check availability'
    });
  }
});

export default router;
EOF

# Create PostgreSQL-only access logs route
cat > ClubOSV1-backend/src/routes/access-postgres.ts << 'EOF'
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

const router = Router();

// GET /api/access/logs - Get access logs (admin only)
router.get('/logs', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { userId, action, success, limit = 100, offset = 0 } = req.query;
    
    const logs = await db.getAccessLogs({
      user_id: userId as string,
      action: action as string,
      success: success === 'true' ? true : success === 'false' ? false : undefined,
      limit: Number(limit),
      offset: Number(offset)
    });
    
    res.json({
      success: true,
      data: logs.map(log => ({
        id: log.id,
        userId: log.user_id,
        userEmail: log.user_email,
        action: log.action,
        resource: log.resource,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        success: log.success,
        errorMessage: log.error_message,
        metadata: log.metadata,
        createdAt: log.created_at.toISOString()
      })),
      pagination: {
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error) {
    logger.error('Failed to get access logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve access logs'
    });
  }
});

// GET /api/access/auth-logs - Get authentication logs (admin only)
router.get('/auth-logs', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { userId, action, success, limit = 100, offset = 0 } = req.query;
    
    const logs = await db.getAuthLogs({
      user_id: userId as string,
      action: action as string,
      success: success === 'true' ? true : success === 'false' ? false : undefined,
      limit: Number(limit),
      offset: Number(offset)
    });
    
    res.json({
      success: true,
      data: logs.map(log => ({
        id: log.id,
        userId: log.user_id,
        action: log.action,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        success: log.success,
        errorMessage: log.error_message,
        createdAt: log.created_at.toISOString()
      })),
      pagination: {
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error) {
    logger.error('Failed to get auth logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve authentication logs'
    });
  }
});

// GET /api/access/request-logs - Get request logs (admin only)
router.get('/request-logs', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { path, statusCode, limit = 100, offset = 0 } = req.query;
    
    const logs = await db.getRequestLogs({
      path: path as string,
      status_code: statusCode ? Number(statusCode) : undefined,
      limit: Number(limit),
      offset: Number(offset)
    });
    
    res.json({
      success: true,
      data: logs.map(log => ({
        id: log.id,
        method: log.method,
        path: log.path,
        statusCode: log.status_code,
        responseTime: log.response_time,
        userId: log.user_id,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        error: log.error,
        createdAt: log.created_at.toISOString()
      })),
      pagination: {
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error) {
    logger.error('Failed to get request logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve request logs'
    });
  }
});

export default router;
EOF

# Create PostgreSQL-only history route
cat > ClubOSV1-backend/src/routes/history-postgres.ts << 'EOF'
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

const router = Router();

// GET /api/history/interactions - Get user's interaction history
router.get('/interactions', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    
    // Get feedback entries
    const feedback = await db.query(
      `SELECT * FROM feedback 
       WHERE user_id = $1 OR user_email = $2 
       ORDER BY created_at DESC 
       LIMIT $3 OFFSET $4`,
      [userId, userEmail, Number(limit), Number(offset)]
    );
    
    // Get customer interactions
    const interactions = await db.query(
      `SELECT * FROM customer_interactions 
       WHERE user_id = $1 OR user_email = $2 
       ORDER BY created_at DESC 
       LIMIT $3 OFFSET $4`,
      [userId, userEmail, Number(limit), Number(offset)]
    );
    
    // Combine and sort by date
    const combined = [
      ...feedback.rows.map(f => ({
        type: 'feedback',
        id: f.id,
        timestamp: f.created_at,
        request: f.request_description,
        response: f.response,
        route: f.route,
        confidence: f.confidence,
        isUseful: f.is_useful,
        metadata: {
          location: f.location,
          feedbackType: f.feedback_type
        }
      })),
      ...interactions.rows.map(i => ({
        type: 'interaction',
        id: i.id,
        timestamp: i.created_at,
        request: i.request_text,
        response: i.response_text,
        route: i.route,
        confidence: i.confidence,
        metadata: i.metadata
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
     .slice(0, Number(limit));
    
    res.json({
      success: true,
      data: combined,
      pagination: {
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error) {
    logger.error('Failed to get interaction history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve interaction history'
    });
  }
});

// GET /api/history/bookings - Get user's booking history
router.get('/bookings', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0, includeRecurring = 'true' } = req.query;
    
    const bookings = await db.getBookings({
      user_id: req.user!.id
    });
    
    // Sort by start time descending
    const sorted = bookings.sort((a, b) => 
      b.start_time.getTime() - a.start_time.getTime()
    );
    
    // Apply pagination
    const paginated = sorted.slice(Number(offset), Number(offset) + Number(limit));
    
    res.json({
      success: true,
      data: paginated.map(b => ({
        id: b.id,
        simulatorId: b.simulator_id,
        startTime: b.start_time.toISOString(),
        duration: b.duration,
        type: b.type,
        recurringDays: b.recurring_days,
        status: b.status,
        createdAt: b.created_at.toISOString(),
        cancelledAt: b.cancelled_at?.toISOString()
      })),
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: sorted.length
      }
    });
  } catch (error) {
    logger.error('Failed to get booking history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve booking history'
    });
  }
});

// GET /api/history/tickets - Get user's ticket history
router.get('/tickets', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const tickets = await db.getTickets({
      created_by_id: req.user!.id
    });
    
    // Sort by created date descending
    const sorted = tickets.sort((a, b) => 
      b.created_at.getTime() - a.created_at.getTime()
    );
    
    // Apply pagination
    const paginated = sorted.slice(Number(offset), Number(offset) + Number(limit));
    
    res.json({
      success: true,
      data: paginated.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        status: t.status,
        priority: t.priority,
        location: t.location,
        createdAt: t.created_at.toISOString(),
        updatedAt: t.updated_at.toISOString(),
        resolvedAt: t.resolved_at?.toISOString()
      })),
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: sorted.length
      }
    });
  } catch (error) {
    logger.error('Failed to get ticket history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve ticket history'
    });
  }
});

export default router;
EOF

# Create PostgreSQL-only backup route
cat > ClubOSV1-backend/src/routes/backup-postgres.ts << 'EOF'
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const router = Router();
const execAsync = promisify(exec);

// GET /api/backup/export - Export database backup (admin only)
router.get('/export', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `clubos_backup_${timestamp}.sql`;
    
    // Get database connection details
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!dbUrl) {
      throw new Error('Database URL not configured');
    }
    
    // Create temporary file path
    const tempPath = path.join('/tmp', filename);
    
    // Use pg_dump to export database
    try {
      await execAsync(`pg_dump "${dbUrl}" > "${tempPath}"`);
    } catch (error) {
      logger.error('pg_dump failed:', error);
      
      // Fallback: Export as JSON
      const backup = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        tables: {} as any
      };
      
      // Export all tables
      const tables = [
        'Users', 'feedback', 'tickets', 'bookings', 
        'access_logs', 'auth_logs', 'request_logs', 
        'system_config', 'customer_interactions'
      ];
      
      for (const table of tables) {
        try {
          const result = await db.query(`SELECT * FROM ${table}`);
          backup.tables[table] = result.rows;
        } catch (err) {
          logger.error(`Failed to export table ${table}:`, err);
        }
      }
      
      // Send as JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="clubos_backup_${timestamp}.json"`);
      return res.send(JSON.stringify(backup, null, 2));
    }
    
    // Read the backup file
    const backupData = await fs.readFile(tempPath, 'utf-8');
    
    // Clean up temp file
    await fs.unlink(tempPath).catch(() => {});
    
    // Send backup
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(backupData);
    
    logger.info('Database backup exported', {
      exportedBy: req.user!.email,
      filename
    });
  } catch (error) {
    logger.error('Failed to export backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export database backup'
    });
  }
});

// GET /api/backup/stats - Get database statistics (admin only)
router.get('/stats', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const stats = {
      tables: {} as any,
      totalSize: 0
    };
    
    // Get row counts for each table
    const tables = [
      { name: 'Users', displayName: 'Users' },
      { name: 'feedback', displayName: 'Feedback' },
      { name: 'tickets', displayName: 'Tickets' },
      { name: 'bookings', displayName: 'Bookings' },
      { name: 'access_logs', displayName: 'Access Logs' },
      { name: 'auth_logs', displayName: 'Auth Logs' },
      { name: 'request_logs', displayName: 'Request Logs' },
      { name: 'system_config', displayName: 'System Config' },
      { name: 'customer_interactions', displayName: 'Customer Interactions' }
    ];
    
    for (const table of tables) {
      try {
        const result = await db.query(`SELECT COUNT(*) as count FROM ${table.name}`);
        stats.tables[table.displayName] = {
          count: parseInt(result.rows[0].count),
          tableName: table.name
        };
        stats.totalSize += parseInt(result.rows[0].count);
      } catch (err) {
        logger.error(`Failed to get count for table ${table.name}:`, err);
        stats.tables[table.displayName] = {
          count: 0,
          error: 'Failed to retrieve count'
        };
      }
    }
    
    // Get database size if possible
    try {
      const sizeResult = await db.query(`
        SELECT pg_database_size(current_database()) as size
      `);
      stats.databaseSize = {
        bytes: parseInt(sizeResult.rows[0].size),
        formatted: formatBytes(parseInt(sizeResult.rows[0].size))
      };
    } catch (err) {
      logger.error('Failed to get database size:', err);
    }
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get backup stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve backup statistics'
    });
  }
});

// Helper function to format bytes
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default router;
EOF

# Replace the old routes with PostgreSQL-only versions
echo "Replacing routes with PostgreSQL-only versions..."
mv ClubOSV1-backend/src/routes/bookings-postgres.ts ClubOSV1-backend/src/routes/bookings.ts
mv ClubOSV1-backend/src/routes/access-postgres.ts ClubOSV1-backend/src/routes/access.ts
mv ClubOSV1-backend/src/routes/history-postgres.ts ClubOSV1-backend/src/routes/history.ts
mv ClubOSV1-backend/src/routes/backup-postgres.ts ClubOSV1-backend/src/routes/backup.ts

echo "✅ Updated bookings, access, history, and backup routes to PostgreSQL only"

# Build and deploy
cd ClubOSV1-backend
npm run build

cd ..
git add -A
git commit -m "Complete PostgreSQL implementation - Part 3

- Converted bookings.ts to PostgreSQL only (no JSON)
- Converted access.ts to PostgreSQL only (no JSON)
- Converted history.ts to PostgreSQL only (no JSON)
- Converted backup.ts to use pg_dump and PostgreSQL export
- Removed all JSON file operations from these routes
- All data now stored exclusively in PostgreSQL"

git push origin main

echo -e "\n✅ Part 3 Complete!"
echo "============================="
echo "Status:"
echo "✅ Auth routes - PostgreSQL only"
echo "✅ Feedback routes - PostgreSQL only"
echo "✅ Tickets routes - PostgreSQL only"
echo "✅ Bookings routes - PostgreSQL only"
echo "✅ Access/Auth/Request logs - PostgreSQL only"
echo "✅ History routes - PostgreSQL only"
echo "✅ Backup routes - PostgreSQL export"
echo ""
echo "Next: Remove JSON dependencies and cleanup code"