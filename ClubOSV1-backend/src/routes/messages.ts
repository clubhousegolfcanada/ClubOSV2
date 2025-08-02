import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validation';
import { body, query } from 'express-validator';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { openPhoneService } from '../services/openphoneService';
import { messageSendLimiter } from '../middleware/rateLimiter';
import { formatToE164, isValidE164 } from '../utils/phoneNumberFormatter';
import { messageAssistantService } from '../services/messageAssistantService';
import { anonymizePhoneNumber } from '../utils/encryption';
import { hubspotService } from '../services/hubspotService';

const router = Router();

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Test OpenPhone connection
    const openPhoneConnected = await openPhoneService.testConnection();
    
    res.json({ 
      status: 'ok', 
      service: 'messages',
      timestamp: new Date().toISOString(),
      openPhone: {
        connected: openPhoneConnected,
        configured: !!process.env.OPENPHONE_API_KEY
      }
    });
  } catch (error) {
    res.json({ 
      status: 'degraded', 
      service: 'messages',
      timestamp: new Date().toISOString(),
      openPhone: {
        connected: false,
        configured: !!process.env.OPENPHONE_API_KEY,
        error: 'Connection test failed'
      }
    });
  }
});

// Get all conversations
router.get('/conversations',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  async (req, res, next) => {
    try {
      const { limit = 50, offset = 0, search } = req.query;
      
      // First check if table exists
      const tableExists = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'openphone_conversations'
        ) as exists
      `);
      
      if (!tableExists.rows[0].exists) {
        logger.warn('openphone_conversations table does not exist');
        return res.json({
          success: true,
          data: []
        });
      }
      
      // Then check which columns exist
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
      
      let result;
      try {
        result = await db.query(query, params);
      } catch (queryError: any) {
        logger.error('Failed to query conversations', {
          error: queryError.message,
          code: queryError.code,
          detail: queryError.detail
        });
        
        // If it's a column doesn't exist error, return empty array
        if (queryError.code === '42703') {
          return res.json({
            success: true,
            data: [],
            warning: 'Database schema issue - missing columns'
          });
        }
        
        throw queryError;
      }
      
      // TEMPORARILY DISABLED: Show ALL conversations for debugging
      // TODO: Re-enable filtering once we fix phone number extraction
      const validConversations = result.rows.map(row => {
        const isValid = row.phone_number && 
                       row.phone_number !== 'Unknown' && 
                       row.phone_number.trim() !== '';
        
        if (!isValid) {
          logger.warn('Found conversation with invalid phone number', {
            id: row.id,
            phone_number: row.phone_number,
            customer_name: row.customer_name
          });
        }
        
        // Return all conversations, but mark invalid ones
        return {
          ...row,
          _debug_invalid_phone: !isValid
        };
      });
      
      logger.info('Returning conversations', {
        total: result.rows.length,
        valid: validConversations.length,
        filtered: result.rows.length - validConversations.length
      });
      
      // Enrich conversations with HubSpot data if available
      const enrichedConversations = await Promise.all(validConversations.map(async (row) => {
        try {
          // Only lookup if we don't already have a good name
          if (row.phone_number && row.phone_number !== 'Unknown' && 
              (!row.customer_name || row.customer_name === 'Unknown' || row.customer_name === row.phone_number)) {
            const hubspotContact = await hubspotService.searchByPhone(row.phone_number);
            if (hubspotContact && hubspotContact.name && hubspotContact.name !== 'Unknown') {
              // Update the customer name with HubSpot data
              row.customer_name = hubspotContact.name;
              row.hubspot_company = hubspotContact.company;
              row.hubspot_enriched = true;
            }
          }
        } catch (error) {
          // Don't let HubSpot errors break the conversation list
          logger.debug('HubSpot enrichment failed for phone:', row.phone_number);
        }
        return row;
      }));
      
      res.json({
        success: true,
        data: enrichedConversations.map(row => ({
          ...row,
          lastMessage: row.messages?.[row.messages.length - 1] || null,
          messageCount: row.messages?.length || 0,
          // Ensure we always have updated_at for frontend
          updated_at: row.updated_at || row.created_at
        }))
      });
    } catch (error) {
      logger.error('Messages route error:', error);
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
    const { to, text, from, countryCode } = req.body;
    const fromNumber = from || process.env.OPENPHONE_DEFAULT_NUMBER;
    
    try {
      if (!fromNumber) {
        return res.status(400).json({
          success: false,
          error: 'No from number configured'
        });
      }
      
      // Format phone numbers to E.164
      const formattedTo = formatToE164(to, countryCode);
      if (!formattedTo || !isValidE164(formattedTo)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid recipient phone number format. Please use E.164 format (e.g., +1234567890) or provide a country code.'
        });
      }
      
      const formattedFrom = formatToE164(fromNumber, countryCode);
      if (!formattedFrom || !isValidE164(formattedFrom)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid sender phone number format'
        });
      }
      
      // Try to get OpenPhone user ID for the from number
      let userId: string | undefined;
      try {
        const user = await openPhoneService.getUserByPhoneNumber(formattedFrom);
        if (user?.id) {
          userId = user.id;
          logger.info('Found OpenPhone user for number', { phoneNumber: formattedFrom, userId });
        }
      } catch (error) {
        logger.warn('Could not fetch OpenPhone user', { phoneNumber: formattedFrom, error });
      }
      
      // Send via OpenPhone with optional userId
      const result = await openPhoneService.sendMessage(formattedTo, formattedFrom, text, { 
        userId,
        setInboxStatus: 'done' // Mark conversation as done after sending
      });
      
      // Log the action
      logger.info('Message sent via OpenPhone', {
        to: formattedTo,
        from: formattedFrom,
        userId: req.user?.id,
        messageId: result.id
      });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      logger.error('Failed to send message:', {
        error: error.message,
        stack: error.stack,
        response: error.response?.data,
        to,
        from: fromNumber,
        userId: req.user?.id
      });
      
      // Return more detailed error response
      if (error.response?.status) {
        // OpenPhone API error - use enhanced error message if available
        const userMessage = error.userMessage || 
                          error.response?.data?.message || 
                          error.response?.data?.error || 
                          'OpenPhone API error';
        
        // Map OpenPhone status codes to appropriate HTTP responses
        let responseStatus = error.response.status;
        if (responseStatus === 429) {
          // For rate limit, return 503 Service Unavailable
          responseStatus = 503;
        }
        
        return res.status(responseStatus).json({
          success: false,
          error: userMessage,
          code: error.response?.data?.code,
          details: process.env.NODE_ENV === 'development' ? error.response?.data : undefined
        });
      }
      
      // Other errors
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to send message',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
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

// Generate AI suggestion for a message response
router.post('/conversations/:phoneNumber/suggest-response',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  async (req, res, next) => {
    try {
      const { phoneNumber } = req.params;
      
      // Get conversation
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
      
      const conversation = result.rows[0];
      const messages = conversation.messages || [];
      
      if (messages.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No messages in conversation'
        });
      }
      
      // Generate suggestion
      const suggestion = await messageAssistantService.generateSuggestedResponse(
        conversation.id,
        phoneNumber,
        messages,
        req.user!.id
      );
      
      // Log access for security
      await db.createAuthLog({
        user_id: req.user!.id,
        action: 'generate_message_suggestion',
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        success: true
      });
      
      // Log anonymized phone number
      logger.info('Generated message suggestion', {
        conversationId: conversation.id,
        phoneNumber: anonymizePhoneNumber(phoneNumber),
        userId: req.user!.id,
        confidence: suggestion.confidence
      });
      
      res.json({
        success: true,
        data: suggestion
      });
    } catch (error) {
      logger.error('Failed to generate suggestion:', error);
      next(error);
    }
  }
);

// Approve and send a suggested response
router.post('/suggestions/:suggestionId/approve-and-send',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  async (req, res, next) => {
    try {
      const { suggestionId } = req.params;
      const { editedText } = req.body; // Allow editing before sending
      
      // Get the suggestion
      const suggestion = await messageAssistantService.getSuggestion(suggestionId);
      
      if (!suggestion) {
        return res.status(404).json({
          success: false,
          error: 'Suggestion not found'
        });
      }
      
      if (suggestion.sent) {
        return res.status(400).json({
          success: false,
          error: 'This suggestion has already been sent'
        });
      }
      
      // Get conversation to get phone number
      const convResult = await db.query(
        'SELECT phone_number FROM openphone_conversations WHERE id = $1',
        [suggestion.conversationId]
      );
      
      if (convResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }
      
      const phoneNumber = convResult.rows[0].phone_number;
      const textToSend = editedText || suggestion.suggestedText;
      const fromNumber = process.env.OPENPHONE_DEFAULT_NUMBER;
      
      if (!fromNumber) {
        return res.status(400).json({
          success: false,
          error: 'No default phone number configured'
        });
      }
      
      // Format phone numbers
      const formattedTo = formatToE164(phoneNumber);
      const formattedFrom = formatToE164(fromNumber);
      
      if (!formattedTo || !formattedFrom) {
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number format'
        });
      }
      
      // Approve the suggestion
      await messageAssistantService.approveSuggestion(suggestionId, req.user!.id);
      
      // Send the message via OpenPhone
      const result = await openPhoneService.sendMessage(formattedTo, formattedFrom, textToSend, {
        setInboxStatus: 'done'
      });
      
      // Mark as sent
      await messageAssistantService.markSuggestionAsSent(suggestionId);
      
      // Log the action
      await db.createAuthLog({
        user_id: req.user!.id,
        action: 'send_ai_suggested_message',
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        success: true
      });
      
      logger.info('AI suggested message sent', {
        suggestionId,
        conversationId: suggestion.conversationId,
        phoneNumber: anonymizePhoneNumber(phoneNumber),
        userId: req.user!.id,
        edited: !!editedText
      });
      
      res.json({
        success: true,
        data: {
          messageId: result.id,
          suggestionId,
          sent: true
        }
      });
    } catch (error) {
      logger.error('Failed to send suggested message:', error);
      next(error);
    }
  }
);

// Get AI assistance statistics
router.get('/ai-stats',
  authenticate,
  roleGuard(['admin']),
  async (req, res, next) => {
    try {
      const { days = 30 } = req.query;
      
      const stats = await messageAssistantService.getConversationStats(Number(days));
      
      res.json({
        success: true,
        data: {
          ...stats,
          period_days: Number(days)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;