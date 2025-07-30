import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validation';
import { body, query } from 'express-validator';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { openPhoneService } from '../services/openphoneService';

const router = Router();

// Get all conversations
router.get('/conversations',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  async (req, res, next) => {
    try {
      const { limit = 50, offset = 0, search } = req.query;
      
      let query = `
        SELECT 
          id,
          phone_number,
          customer_name,
          employee_name,
          messages,
          unread_count,
          last_read_at,
          created_at,
          updated_at
        FROM openphone_conversations
      `;
      
      const params: any[] = [];
      
      if (search) {
        query += ` WHERE phone_number LIKE $1 OR customer_name ILIKE $1`;
        params.push(`%${search}%`);
      }
      
      query += ` ORDER BY updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
      
      const result = await db.query(query, params);
      
      res.json({
        success: true,
        data: result.rows.map(row => ({
          ...row,
          lastMessage: row.messages?.[row.messages.length - 1] || null,
          messageCount: row.messages?.length || 0
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
      
      // Mark as read
      await db.query(
        `UPDATE openphone_conversations 
         SET unread_count = 0, last_read_at = NOW() 
         WHERE phone_number = $1`,
        [phoneNumber]
      );
      
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
      
      await db.query(
        `UPDATE openphone_conversations 
         SET unread_count = 0, last_read_at = NOW() 
         WHERE phone_number = $1`,
        [phoneNumber]
      );
      
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
      const result = await db.query(
        `SELECT COALESCE(SUM(unread_count), 0) as total_unread 
         FROM openphone_conversations`
      );
      
      res.json({
        success: true,
        data: {
          totalUnread: parseInt(result.rows[0].total_unread) || 0
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;