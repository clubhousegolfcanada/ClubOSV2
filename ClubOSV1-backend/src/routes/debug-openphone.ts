import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { db } from '../utils/database';
import { openPhoneService } from '../services/openphoneService';
import { logger } from '../utils/logger';

const router = Router();

// Debug endpoint - Admin only
router.get('/database-check',
  authenticate,
  roleGuard(['admin']),
  async (req, res) => {
    try {
      // Get all conversations from database
      const allConversations = await db.query(`
        SELECT 
          id,
          phone_number,
          customer_name,
          employee_name,
          created_at,
          updated_at,
          jsonb_array_length(messages) as message_count
        FROM openphone_conversations
        ORDER BY created_at DESC
        LIMIT 20
      `);

      // Get count of invalid phone numbers
      const invalidCount = await db.query(`
        SELECT COUNT(*) as count
        FROM openphone_conversations
        WHERE phone_number IS NULL 
           OR phone_number = 'Unknown' 
           OR phone_number = ''
      `);

      // Get sample of messages
      const sampleMessages = await db.query(`
        SELECT 
          phone_number,
          messages->0 as first_message,
          messages->-1 as last_message
        FROM openphone_conversations
        WHERE messages IS NOT NULL
        LIMIT 5
      `);

      res.json({
        success: true,
        data: {
          totalConversations: allConversations.rows.length,
          conversations: allConversations.rows,
          invalidPhoneNumbers: invalidCount.rows[0].count,
          sampleMessages: sampleMessages.rows,
          databaseStatus: 'connected'
        }
      });
    } catch (error: any) {
      logger.error('Database check failed', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Test OpenPhone connection
router.get('/test-connection',
  authenticate,
  roleGuard(['admin']),
  async (req, res) => {
    try {
      // Test getting phone numbers from OpenPhone
      const phoneNumbers = await openPhoneService.getPhoneNumbers();
      
      res.json({
        success: true,
        data: {
          connected: true,
          phoneNumbers: phoneNumbers,
          defaultNumber: process.env.OPENPHONE_DEFAULT_NUMBER,
          hasApiKey: !!process.env.OPENPHONE_API_KEY
        }
      });
    } catch (error: any) {
      logger.error('OpenPhone connection test failed', error);
      res.status(500).json({
        success: false,
        error: error.message,
        hasApiKey: !!process.env.OPENPHONE_API_KEY,
        defaultNumber: process.env.OPENPHONE_DEFAULT_NUMBER
      });
    }
  }
);

// Sync conversations from OpenPhone
router.post('/sync-conversations',
  authenticate,
  roleGuard(['admin']),
  async (req, res) => {
    try {
      logger.info('Starting OpenPhone conversation sync');
      
      // Get recent conversations from OpenPhone
      const conversations = await openPhoneService.fetchRecentConversations(10);
      
      // Store each conversation
      let synced = 0;
      for (const conv of conversations) {
        try {
          // Extract phone number properly
          const phoneNumber = conv.phoneNumber || 
                            conv.participants?.find((p: any) => p.phoneNumber)?.phoneNumber ||
                            conv.contact?.phoneNumber;
          
          if (!phoneNumber || phoneNumber === 'Unknown') {
            logger.warn('Skipping conversation without valid phone number', conv);
            continue;
          }

          // Check if conversation exists
          const existing = await db.query(
            'SELECT id FROM openphone_conversations WHERE phone_number = $1',
            [phoneNumber]
          );

          if (existing.rows.length === 0) {
            // Insert new conversation
            await db.query(`
              INSERT INTO openphone_conversations 
              (phone_number, customer_name, messages, created_at, updated_at)
              VALUES ($1, $2, $3, NOW(), NOW())
            `, [
              phoneNumber,
              conv.contact?.name || phoneNumber,
              JSON.stringify(conv.messages || [])
            ]);
            synced++;
          }
        } catch (err) {
          logger.error('Failed to sync conversation', { conv, error: err });
        }
      }
      
      res.json({
        success: true,
        data: {
          conversationsFound: conversations.length,
          conversationsSynced: synced
        }
      });
    } catch (error: any) {
      logger.error('Sync failed', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Test sending a message
router.post('/test-send',
  authenticate,
  roleGuard(['admin']),
  async (req, res) => {
    try {
      const { to, text } = req.body;
      const from = process.env.OPENPHONE_DEFAULT_NUMBER;
      
      if (!from) {
        return res.status(400).json({
          success: false,
          error: 'No default phone number configured in OPENPHONE_DEFAULT_NUMBER'
        });
      }
      
      if (!to || !text) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: to, text'
        });
      }
      
      // Send test message
      const result = await openPhoneService.sendMessage(to, from, text);
      
      res.json({
        success: true,
        data: {
          message: 'Test message sent successfully',
          messageId: result.id,
          to,
          from,
          text
        }
      });
    } catch (error: any) {
      logger.error('Test send failed', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: error.response?.data || error
      });
    }
  }
);

export default router;