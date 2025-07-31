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
      // First check if table exists
      const tableExists = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'openphone_conversations'
        )
      `);
      
      if (!tableExists.rows[0].exists) {
        return res.json({
          success: false,
          error: 'Table openphone_conversations does not exist',
          data: {
            databaseStatus: 'connected',
            tableExists: false,
            needsMigration: true
          }
        });
      }
      
      // First check what columns exist
      const columnCheck = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'openphone_conversations'
      `);
      
      const columns = columnCheck.rows.map(r => r.column_name);
      logger.info('OpenPhone table columns:', columns);
      
      // Build dynamic query based on existing columns
      const selectColumns = ['id'];
      
      if (columns.includes('phone_number')) selectColumns.push('phone_number');
      if (columns.includes('customer_name')) selectColumns.push('customer_name');
      if (columns.includes('employee_name')) selectColumns.push('employee_name');
      if (columns.includes('created_at')) selectColumns.push('created_at');
      if (columns.includes('updated_at')) selectColumns.push('updated_at');
      if (columns.includes('messages')) selectColumns.push('jsonb_array_length(messages) as message_count');
      
      // Get all conversations from database
      const allConversations = await db.query(`
        SELECT ${selectColumns.join(', ')}
        FROM openphone_conversations
        ORDER BY ${columns.includes('created_at') ? 'created_at' : 'id'} DESC
        LIMIT 20
      `);

      // Get count of invalid phone numbers only if column exists
      let invalidCount = { rows: [{ count: 0 }] };
      if (columns.includes('phone_number')) {
        invalidCount = await db.query(`
          SELECT COUNT(*) as count
          FROM openphone_conversations
          WHERE phone_number IS NULL 
             OR phone_number = 'Unknown' 
             OR phone_number = ''
        `);
      }

      // Get sample of messages only if columns exist
      let sampleMessages = { rows: [] };
      if (columns.includes('messages') && columns.includes('phone_number')) {
        sampleMessages = await db.query(`
          SELECT 
            phone_number,
            messages->0 as first_message,
            messages->-1 as last_message
          FROM openphone_conversations
          WHERE messages IS NOT NULL
          LIMIT 5
        `);
      }

      res.json({
        success: true,
        data: {
          totalConversations: allConversations.rows.length,
          conversations: allConversations.rows,
          invalidPhoneNumbers: invalidCount.rows[0]?.count || 0,
          sampleMessages: sampleMessages.rows,
          databaseStatus: 'connected',
          tableColumns: columns,
          missingColumns: ['phone_number', 'customer_name', 'employee_name', 'messages', 'created_at', 'updated_at']
            .filter(col => !columns.includes(col))
        }
      });
    } catch (error: any) {
      logger.error('Database check failed', error);
      
      // Check if it's a column doesn't exist error
      if (error.code === '42703') {
        return res.json({
          success: false,
          error: `Column missing: ${error.message}`,
          data: {
            databaseStatus: 'connected',
            tableExists: true,
            missingColumn: true,
            errorCode: error.code,
            detail: error.detail || 'Column missing in openphone_conversations table'
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: error.message,
        errorCode: error.code,
        detail: error.detail
      });
    }
  }
);

// NEW: Get raw conversation data without filtering
router.get('/raw-conversations',
  authenticate,
  roleGuard(['admin']),
  async (req, res) => {
    try {
      // Get ALL conversations without any filtering
      const result = await db.query(`
        SELECT 
          id,
          phone_number,
          customer_name,
          employee_name,
          messages,
          created_at,
          updated_at,
          metadata
        FROM openphone_conversations
        ORDER BY created_at DESC
        LIMIT 50
      `);
      
      // Also get a count of different phone number states
      const phoneStats = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN phone_number IS NULL THEN 1 END) as null_phones,
          COUNT(CASE WHEN phone_number = 'Unknown' THEN 1 END) as unknown_phones,
          COUNT(CASE WHEN phone_number = '' THEN 1 END) as empty_phones,
          COUNT(CASE WHEN phone_number IS NOT NULL AND phone_number != 'Unknown' AND phone_number != '' THEN 1 END) as valid_phones
        FROM openphone_conversations
      `);
      
      res.json({
        success: true,
        data: {
          conversations: result.rows,
          stats: phoneStats.rows[0],
          totalFound: result.rows.length,
          rawData: result.rows.map(row => ({
            id: row.id,
            phone_number: row.phone_number,
            customer_name: row.customer_name,
            hasMessages: Array.isArray(row.messages) && row.messages.length > 0,
            messageCount: Array.isArray(row.messages) ? row.messages.length : 0,
            firstMessage: Array.isArray(row.messages) && row.messages.length > 0 ? row.messages[0] : null,
            metadata: row.metadata
          }))
        }
      });
    } catch (error: any) {
      logger.error('Raw conversations query failed', error);
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
          const phoneNumber = conv.phoneNumber || conv.contact?.phoneNumber;
          
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