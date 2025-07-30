import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validation';
import { body, query } from 'express-validator';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { openPhoneService } from '../services/openphoneService';
import { messageSendLimiter } from '../middleware/rateLimiter';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'messages',
    timestamp: new Date().toISOString() 
  });
});

// Get all conversations
router.get('/conversations',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  async (req, res, next) => {
    try {
      const { limit = 50, offset = 0, search } = req.query;
      
      // First check which columns exist
      const columnCheck = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'openphone_conversations' 
        AND column_name IN ('unread_count', 'last_read_at', 'updated_at')
      `);
      
      const existingColumns = columnCheck.rows.map(row => row.column_name);
      const hasUnreadCount = existingColumns.includes('unread_count');
      const hasLastReadAt = existingColumns.includes('last_read_at');
      const hasUpdatedAt = existingColumns.includes('updated_at');
      
      let query = `
        SELECT 
          id,
          phone_number,
          customer_name,
          employee_name,
          messages,
          ${hasUnreadCount ? 'unread_count,' : '0 as unread_count,'}
          ${hasLastReadAt ? 'last_read_at,' : 'NULL as last_read_at,'}
          created_at${hasUpdatedAt ? ',\n          updated_at' : ''}
        FROM openphone_conversations
      `;
      
      const params: any[] = [];
      
      if (search) {
        query += ` WHERE phone_number LIKE $1 OR customer_name ILIKE $1`;
        params.push(`%${search}%`);
      }
      
      // Order by updated_at if it exists, otherwise by created_at
      query += ` ORDER BY ${hasUpdatedAt ? 'updated_at' : 'created_at'} DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
      
      const result = await db.query(query, params);
      
      // Filter out conversations without valid phone numbers
      const validConversations = result.rows.filter(row => {
        const isValid = row.phone_number && 
                       row.phone_number !== 'Unknown' && 
                       row.phone_number.trim() !== '';
        
        if (!isValid) {
          logger.warn('Filtering out conversation with invalid phone number', {
            id: row.id,
            phone_number: row.phone_number,
            customer_name: row.customer_name
          });
        }
        
        return isValid;
      });
      
      res.json({
        success: true,
        data: validConversations.map(row => ({
          ...row,
          lastMessage: row.messages?.[row.messages.length - 1] || null,
          messageCount: row.messages?.length || 0,
          // Ensure we always have updated_at for frontend
          updated_at: row.updated_at || row.created_at
        }))
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get single conversation with messages
router.get('/conversations/:phoneNumber',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  async (req, res, next) => {
    try {
      const { phoneNumber } = req.params;
      
      const result = await db.query(
        `SELECT * FROM openphone_conversations WHERE phone_number = $1`,
        [phoneNumber]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }
      
      // Mark as read (check if columns exist first)
      try {
        await db.query(
          `UPDATE openphone_conversations 
           SET unread_count = 0, last_read_at = NOW() 
           WHERE phone_number = $1`,
          [phoneNumber]
        );
      } catch (error: any) {
        // If columns don't exist, just log and continue
        logger.warn('Could not update unread_count/last_read_at - columns may not exist', {
          error: error.message,
          phoneNumber
        });
      }
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// Send a message
router.post('/send',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  messageSendLimiter,
  validate([
    body('to').isMobilePhone('any').withMessage('Invalid phone number'),
    body('text').notEmpty().withMessage('Message text is required'),
    body('from').optional().isMobilePhone('any')
  ]),
  async (req, res, next) => {
    try {
      const { to, text, from } = req.body;
      const fromNumber = from || process.env.OPENPHONE_DEFAULT_NUMBER;
      
      if (!fromNumber) {
        return res.status(400).json({
          success: false,
          error: 'No from number configured'
        });
      }
      
      // Send via OpenPhone
      const result = await openPhoneService.sendMessage(to, fromNumber, text);
      
      // Log the action
      logger.info('Message sent via OpenPhone', {
        to,
        from: fromNumber,
        userId: req.user?.id,
        messageId: result.id
      });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// Mark messages as read
router.put('/conversations/:phoneNumber/read',
  authenticate,
  async (req, res, next) => {
    try {
      const { phoneNumber } = req.params;
      
      try {
        await db.query(
          `UPDATE openphone_conversations 
           SET unread_count = 0, last_read_at = NOW() 
           WHERE phone_number = $1`,
          [phoneNumber]
        );
      } catch (error: any) {
        logger.warn('Could not update unread_count/last_read_at', {
          error: error.message,
          phoneNumber
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// Get unread count across all conversations
router.get('/unread-count',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  async (req, res, next) => {
    try {
      // Check if unread_count column exists
      const columnExists = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'openphone_conversations' 
          AND column_name = 'unread_count'
        ) as exists
      `);
      
      let totalUnread = 0;
      if (columnExists.rows[0].exists) {
        const result = await db.query(
          `SELECT COALESCE(SUM(unread_count), 0) as total_unread 
           FROM openphone_conversations`
        );
        totalUnread = parseInt(result.rows[0].total_unread) || 0;
      }
      
      res.json({
        success: true,
        data: { totalUnread }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;