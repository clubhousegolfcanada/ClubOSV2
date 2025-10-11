import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validation';
import { body, query } from 'express-validator';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { openPhoneService } from '../services/openphoneService';
import { messageSendLimiter } from '../middleware/rateLimiter';
import { formatToE164, isValidE164 } from '../utils/phoneNumberFormatter';
import axios from 'axios';
import { messageAssistantService } from '../services/messageAssistantService';
import { anonymizePhoneNumber } from '../utils/encryption';
import { hubspotService } from '../services/hubspotService';
import { aiAutomationService } from '../services/aiAutomationService';
import { patternLearningService } from '../services/patternLearningService';
import { dbToApi, COMMON_DB_TO_API_OPTIONS } from '../utils/caseConverters';
import { successResponse, errorResponse } from '../utils/responseHelpers';

const router = Router();

// Simple in-memory cache for conversations
const conversationCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds TTL for cache

// Request deduplication to prevent concurrent identical requests
const pendingRequests = new Map<string, Promise<any>>();

// Helper to generate cache key
const getCacheKey = (userId: string, limit: number, offset: number, search?: string) => {
  return `${userId}-${limit}-${offset}-${search || ''}`;
};

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Test OpenPhone connection
    const openPhoneConnected = await openPhoneService.testConnection();
    
    res.json(successResponse({ 
      status: 'ok', 
      service: 'messages',
      timestamp: new Date().toISOString(),
      openPhone: {
        connected: openPhoneConnected,
        configured: !!process.env.OPENPHONE_API_KEY
      },
      hubspotConnected: hubspotService.isHubSpotConnected()
    }));
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
      const { limit = 25, offset = 0, search } = req.query;  // Reduced default from 50 to 25

      // Check cache first
      const cacheKey = getCacheKey(req.user!.id.toString(), Number(limit), Number(offset), search as string);
      const cached = conversationCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        logger.debug('Returning cached conversations', { cacheKey });
        return res.json(successResponse(cached.data));
      }

      // Check if there's already a pending request for the same data
      if (pendingRequests.has(cacheKey)) {
        logger.debug('Waiting for pending request', { cacheKey });
        const result = await pendingRequests.get(cacheKey);
        return res.json(successResponse(result));
      }

      // Create a promise for this request to enable deduplication
      const requestPromise = (async () => {
        try {
          // First check if table exists
          const tableExists = await db.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables
              WHERE table_name = 'openphone_conversations'
            ) as exists
          `);

          if (!tableExists.rows[0].exists) {
            logger.warn('openphone_conversations table does not exist');
            return [];
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
      
      // Optimized query - simpler and faster without DISTINCT ON
      // Get the most recent conversations, limited by pagination
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
        WHERE phone_number IS NOT NULL
          AND phone_number != ''
          AND phone_number != 'Unknown'
      `;

      const params: any[] = [];

      if (search) {
        query += ` AND (phone_number LIKE $1 OR customer_name ILIKE $1)`;
        params.push(`%${search}%`);
      }

      // Simple ORDER BY with pagination - much faster
      query += ` ORDER BY ${hasUpdatedAt ? 'updated_at' : 'created_at'} DESC`;
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
          return [];
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
      
      // PERFORMANCE FIX: Skip HubSpot enrichment for now - it's causing 5-10 second delays
      // TODO: Implement background job to enrich conversations asynchronously
      const enrichedConversations = validConversations;

      // OLD CODE (causing performance issues):
      // const enrichedConversations = await Promise.all(validConversations.map(async (row) => {
      //   try {
      //     // Only lookup if we don't already have a good name
      //     if (row.phone_number && row.phone_number !== 'Unknown' &&
      //         (!row.customer_name || row.customer_name === 'Unknown' || row.customer_name === row.phone_number)) {
      //       const hubspotContact = await hubspotService.searchByPhone(row.phone_number);
      //       if (hubspotContact && hubspotContact.name && hubspotContact.name !== 'Unknown') {
      //         // Update the customer name with HubSpot data
      //         row.customer_name = hubspotContact.name;
      //         row.hubspot_company = hubspotContact.company;
      //         row.hubspot_enriched = true;
      //       }
      //     }
      //   } catch (error) {
      //     // Don't let HubSpot errors break the conversation list
      //     logger.debug('HubSpot enrichment failed for phone:', row.phone_number);
      //   }
      //   return row;
      // }));
      
      // Don't transform - frontend expects snake_case for OpenPhone data
      const transformedConversations = enrichedConversations.map(row => {
        return {
          id: row.id,
          phone_number: row.phone_number,
          customer_name: row.customer_name,
          employee_name: row.employee_name,
          messages: row.messages,
          unread_count: row.unread_count || 0,
          last_read_at: row.last_read_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
          lastMessage: row.messages?.[row.messages.length - 1] || null,
          messageCount: row.messages?.length || 0,
          hubspotCompany: row.hubspot_company,
          hubspotEnriched: row.hubspot_enriched,
          _debug_invalid_phone: row._debug_invalid_phone
        };
      });
      
      // Cache the successful response
      conversationCache.set(cacheKey, {
        data: transformedConversations,
        timestamp: Date.now()
      });

      // Clean up old cache entries periodically (keep cache size reasonable)
      if (conversationCache.size > 100) {
        const now = Date.now();
        for (const [key, value] of conversationCache.entries()) {
          if (now - value.timestamp > CACHE_TTL) {
            conversationCache.delete(key);
          }
        }
      }

      return transformedConversations;
        } catch (error) {
          logger.error('Error in conversation fetch:', error);
          throw error;
        } finally {
          // Clean up pending request
          pendingRequests.delete(cacheKey);
        }
      })();

      // Store the promise for deduplication
      pendingRequests.set(cacheKey, requestPromise);

      try {
        const result = await requestPromise;
        res.json(successResponse(result));
      } catch (error) {
        logger.error('Messages route error:', error);
        next(error);
      }
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
        return res.status(404).json(errorResponse('Conversation not found', 404));
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
      
      // Don't transform - frontend expects snake_case
      const conversation = result.rows[0];
      res.json(successResponse(conversation));
    } catch (error) {
      next(error);
    }
  }
);

// Get full conversation history for a phone number (all conversations merged)
router.get('/conversations/:phoneNumber/full-history',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  async (req, res, next) => {
    try {
      const { phoneNumber } = req.params;
      
      // Get ALL conversations for this phone number to merge messages
      // Multiple conversations can exist due to webhook timing issues
      const allConversations = await db.query(
        `SELECT * FROM openphone_conversations 
         WHERE phone_number = $1 
         ORDER BY created_at ASC`,  // ASC to maintain chronological order
        [phoneNumber]
      );
      
      if (allConversations.rows.length === 0) {
        return res.status(404).json(errorResponse('No conversations found for this phone number', 404));
      }
      
      // Merge all messages from all conversation records
      const messageIds = new Set(); // Track unique message IDs
      const allMessages: any[] = [];
      
      for (const conv of allConversations.rows) {
        const messages = conv.messages || [];
        for (const msg of messages) {
          // Avoid duplicates by tracking message IDs
          if (msg.id && !messageIds.has(msg.id)) {
            messageIds.add(msg.id);
            allMessages.push({
              ...msg,
              conversationId: conv.id,
              conversationIndex: allConversations.rows.indexOf(conv)
            });
          } else if (!msg.id) {
            // Include messages without IDs (shouldn't happen but be safe)
            allMessages.push({
              ...msg,
              conversationId: conv.id,
              conversationIndex: allConversations.rows.indexOf(conv)
            });
          }
        }
      }
      
      // Sort merged messages by timestamp
      allMessages.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.timestamp || 0);
        const dateB = new Date(b.createdAt || b.timestamp || 0);
        return dateA.getTime() - dateB.getTime();
      });
      
      const totalMessageCount = allMessages.length;
      
      // Use the most recent conversation for metadata
      const mostRecentConv = allConversations.rows[allConversations.rows.length - 1];
      
      // Mark all conversations as read
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
      
      // Don't transform - frontend expects snake_case
      const responseData = {
        phone_number: phoneNumber,
        customer_name: mostRecentConv.customer_name,
        employee_name: mostRecentConv.employee_name,
        total_conversations: allConversations.rows.length,
        total_messages: totalMessageCount,
        first_contact: allConversations.rows[0].created_at,
        last_contact: mostRecentConv.updated_at || mostRecentConv.created_at
      };
      
      res.json(successResponse({
        ...responseData,
        messages: allMessages,
        conversations: allConversations.rows.map(conv => ({
          id: conv.id,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          message_count: conv.messages?.length || 0
        }))
      }));
      
      logger.info('Fetched full conversation history', {
        phoneNumber: anonymizePhoneNumber(phoneNumber),
        totalConversations: allConversations.rows.length,
        totalMessages: totalMessageCount
      });
      
    } catch (error) {
      logger.error('Failed to fetch full conversation history:', error);
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
        return res.status(400).json(errorResponse('No from number configured', 400));
      }
      
      // Format phone numbers to E.164
      const formattedTo = formatToE164(to, countryCode);
      if (!formattedTo || !isValidE164(formattedTo)) {
        return res.status(400).json(errorResponse('Invalid recipient phone number format. Please use E.164 format (e.g., +1234567890) or provide a country code.', 400));
      }
      
      const formattedFrom = formatToE164(fromNumber, countryCode);
      if (!formattedFrom || !isValidE164(formattedFrom)) {
        return res.status(400).json(errorResponse('Invalid sender phone number format', 400));
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
      
      // PATTERN LEARNING: Analyze full conversation when marked as done
      try {
        // Import services
        const { patternLearningService } = await import('../services/patternLearningService');
        const { ConversationAnalyzer } = await import('../services/conversationAnalyzer');
        const analyzer = new ConversationAnalyzer();
        
        // Get recent conversation history from OpenPhone conversations
        const conversationResult = await db.query(`
          SELECT messages
          FROM openphone_conversations 
          WHERE phone_number = $1
            AND created_at > NOW() - INTERVAL '24 hours'
          ORDER BY created_at DESC 
          LIMIT 1
        `, [formattedTo]);
        
        let conversationMessages = { rows: [] };
        if (conversationResult.rows.length > 0 && conversationResult.rows[0].messages) {
          // Extract last 6 messages from JSON array
          const allMessages = conversationResult.rows[0].messages || [];
          const recentMessages = allMessages.slice(-6).map((msg: any) => ({
            body: msg.body || msg.text,
            direction: msg.direction,
            created_at: msg.createdAt || msg.created_at,
            conversation_id: msg.conversationId
          }));
          conversationMessages.rows = recentMessages;
        }
        
        if (conversationMessages.rows.length > 0) {
          // Reverse to get chronological order
          const messages = conversationMessages.rows.reverse();
          
          // Extract conversation context with AI
          const context = await analyzer.extractConversationContext(messages);
          
          // Check if this looks like a complete Q&A exchange
          const hasQuestion = messages.some(m => 
            m.direction === 'inbound' && 
            (m.body.includes('?') || m.body.toLowerCase().match(/do you|can i|how|what|where|when/))
          );
          
          const hasAnswer = messages.some(m => m.direction === 'outbound');
          const hasResolution = context.isComplete || 
                               text.toLowerCase().includes('you\'re welcome') ||
                               text.toLowerCase().includes('no problem') ||
                               text.toLowerCase().includes('happy to help');
          
          // Only create pattern if it's a complete Q&A that should be automated
          if (hasQuestion && hasAnswer && (hasResolution || context.category)) {
            // Find the initial customer question
            const firstQuestion = messages.find(m => 
              m.direction === 'inbound' && 
              (m.body.includes('?') || m.body.toLowerCase().match(/do you|can i|how|what|where|when/))
            );
            
            // Get the main operator response (not just acknowledgments)
            const mainResponse = messages.find(m => 
              m.direction === 'outbound' && 
              m.body.length > 20 && // Skip short acknowledgments
              !m.body.toLowerCase().match(/^(sure|ok|okay|yes|no problem|you're welcome)\.?$/)
            ) || { body: text }; // Fallback to current message
            
            if (firstQuestion && mainResponse) {
              // Use pattern learning with full context
              await patternLearningService.learnFromHumanResponse(
                firstQuestion.body,     // The actual question
                mainResponse.body,      // The substantive answer
                [],                     // actionsTaken
                result.conversationId || messages[0].conversation_id,
                formattedTo,           // customer's number
                req.user?.id?.toString()
              );
              
              logger.info('[Pattern Learning] Created pattern from complete conversation', {
                category: context.category,
                intent: context.intent,
                isComplete: context.isComplete,
                questionPreview: firstQuestion.body.substring(0, 50),
                answerPreview: mainResponse.body.substring(0, 50)
              });
            }
          } else {
            logger.info('[Pattern Learning] Skipped - not a complete automatable Q&A', {
              hasQuestion,
              hasAnswer,
              hasResolution,
              category: context.category
            });
          }
        }
      } catch (error) {
        logger.error('[Pattern Learning] Failed to analyze conversation', error);
        // Don't fail the send if pattern learning fails
      }

      // Store message immediately as fallback (webhook will deduplicate if it arrives)
      const tempMessage = {
        id: result.id || `temp_${Date.now()}`,
        body: text,
        text: text,
        direction: 'outbound',
        from: formattedFrom,
        to: formattedTo,
        createdAt: new Date().toISOString(),
        status: 'sent'
      };

      try {
        // Check if conversation exists
        const existing = await db.query(
          'SELECT id, messages FROM openphone_conversations WHERE phone_number = $1 ORDER BY updated_at DESC LIMIT 1',
          [formattedTo]
        );

        if (existing.rows.length > 0) {
          // Append to existing conversation
          const messages = existing.rows[0].messages || [];

          // Check if message already exists (deduplication)
          const messageExists = messages.some((msg: any) =>
            msg.id === tempMessage.id ||
            (msg.body === tempMessage.body &&
             new Date(msg.createdAt).getTime() > Date.now() - 5000)
          );

          if (!messageExists) {
            messages.push(tempMessage);

            await db.query(
              'UPDATE openphone_conversations SET messages = $1, updated_at = NOW() WHERE id = $2',
              [JSON.stringify(messages), existing.rows[0].id]
            );

            logger.info('Message stored immediately as fallback', {
              messageId: tempMessage.id,
              phoneNumber: formattedTo,
              conversationId: existing.rows[0].id
            });
          }
        } else {
          // Create new conversation
          await db.query(
            `INSERT INTO openphone_conversations (phone_number, messages, customer_name, employee_name, conversation_id, created_at, updated_at, unread_count)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 0)`,
            [formattedTo, JSON.stringify([tempMessage]), 'Customer', req.user?.name || 'Operator', result.conversationId || `conv_${formattedTo.replace(/\D/g, '')}`]
          );

          logger.info('New conversation created with message', {
            messageId: tempMessage.id,
            phoneNumber: formattedTo
          });
        }
      } catch (storageError) {
        logger.error('Failed to store message immediately:', storageError);
        // Don't fail the send - webhook might still work
      }

      logger.info('Message sent via OpenPhone, stored locally', {
        to: formattedTo,
        messageId: result.id,
        temporaryId: tempMessage.id
      });

      // Track staff response for learning
      await aiAutomationService.learnFromStaffResponse(
        formattedTo,
        text,
        req.user?.id
      );
      
      // Log the action
      logger.info('Message sent via OpenPhone', {
        to: formattedTo,
        from: formattedFrom,
        userId: req.user?.id,
        messageId: result.id
      });
      
      res.json(successResponse(result));
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
        
        return res.status(responseStatus).json(errorResponse(
          userMessage,
          responseStatus,
          error.response?.data?.code,
          process.env.NODE_ENV === 'development' ? error.response?.data : undefined
        ));
      }
      
      // Other errors
      return res.status(500).json(errorResponse(
        error.message || 'Failed to send message',
        500,
        undefined,
        process.env.NODE_ENV === 'development' ? error.stack : undefined
      ));
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
      
      res.json(successResponse(null));
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
      
      res.json(successResponse({ totalUnread }));
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
        return res.status(404).json(errorResponse('Conversation not found', 404));
      }
      
      const conversation = result.rows[0];
      const messages = conversation.messages || [];
      
      if (messages.length === 0) {
        return res.status(400).json(errorResponse('No messages in conversation', 400));
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
      
      res.json(successResponse(suggestion));
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
        return res.status(404).json(errorResponse('Suggestion not found', 404));
      }
      
      if (suggestion.sent) {
        return res.status(400).json(errorResponse('This suggestion has already been sent', 400));
      }
      
      // Get conversation to get phone number
      const convResult = await db.query(
        'SELECT phone_number FROM openphone_conversations WHERE id = $1',
        [suggestion.conversationId]
      );
      
      if (convResult.rows.length === 0) {
        return res.status(404).json(errorResponse('Conversation not found', 404));
      }
      
      const phoneNumber = convResult.rows[0].phone_number;
      const textToSend = editedText || suggestion.suggestedText;
      const fromNumber = process.env.OPENPHONE_DEFAULT_NUMBER;
      
      if (!fromNumber) {
        return res.status(400).json(errorResponse('No default phone number configured', 400));
      }
      
      // Format phone numbers
      const formattedTo = formatToE164(phoneNumber);
      const formattedFrom = formatToE164(fromNumber);
      
      if (!formattedTo || !formattedFrom) {
        return res.status(400).json(errorResponse('Invalid phone number format', 400));
      }
      
      // Approve the suggestion
      await messageAssistantService.approveSuggestion(suggestionId, req.user!.id);
      
      // Send the message via OpenPhone
      const result = await openPhoneService.sendMessage(formattedTo, formattedFrom, textToSend, {
        setInboxStatus: 'done'
      });
      
      // Track staff response for learning (even AI-assisted responses)
      await aiAutomationService.learnFromStaffResponse(
        formattedTo,
        textToSend,
        req.user?.id
      );
      
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
      
      res.json(successResponse({
        messageId: result.id,
        suggestionId,
        sent: true
      }));
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
      
      res.json(successResponse({
        ...stats,
        periodDays: Number(days)
      }));
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/messages/recent - Get recent messages for dashboard
router.get('/recent', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit = 5 } = req.query;
    
    // Get recent messages - prioritize unread and unanswered
    const messages = await db.query(`
      SELECT 
        m.id,
        m.conversation_id,
        m.from_number,
        m.to_number,
        m.body,
        m.direction,
        m.status,
        m.created_at,
        c.name as customer_name,
        c.email as customer_email,
        COUNT(m2.id) as message_count
      FROM messages m
      LEFT JOIN customers c ON c.phone = m.from_number
      LEFT JOIN messages m2 ON m2.conversation_id = m.conversation_id 
        AND m2.created_at < m.created_at
      WHERE m.direction = 'inbound'
        AND m.created_at > NOW() - INTERVAL '24 hours'
      GROUP BY m.id, c.name, c.email
      ORDER BY 
        CASE WHEN m.status = 'unread' THEN 0 ELSE 1 END,
        m.created_at DESC
      LIMIT $1
    `, [limit]);
    
    res.json({
      success: true,
      data: messages.rows
    });
  } catch (error) {
    logger.error('Error fetching recent messages:', error);
    next(error);
  }
});

// GET /api/messages/conversation/:id - Get conversation history
router.get('/conversation/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const messages = await db.query(`
      SELECT 
        id,
        conversation_id,
        from_number,
        to_number,
        body,
        direction,
        status,
        created_at
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
    `, [id]);
    
    res.json({
      success: true,
      data: messages.rows
    });
  } catch (error) {
    logger.error('Error fetching conversation:', error);
    next(error);
  }
});

// REMOVED DUPLICATE /send endpoint - using the proper one above that updates openphone_conversations table
// The duplicate was using the old 'messages' table instead of 'openphone_conversations'
/* router.post('/send', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to, content, conversationId, isAiGenerated } = req.body;
    
    if (!to || !content) {
      return res.status(400).json({
        success: false,
        message: 'Recipient and content are required'
      });
    }
    
    // Check if OpenPhone API key exists
    const openphoneKey = process.env.OPENPHONE_API_KEY;
    if (!openphoneKey) {
      // Store locally without sending
      await db.query(`
        INSERT INTO messages (
          conversation_id, from_number, to_number, body, 
          direction, status, is_ai_generated, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        conversationId || require('uuid').v4(),
        'ClubOS',
        to,
        content,
        'outbound',
        'pending',
        isAiGenerated || false
      ]);
      
      return res.json({
        success: true,
        message: 'Message queued (OpenPhone not configured)'
      });
    }
    
    try {
      // Send via OpenPhone API
      const openphoneResponse = await axios.post(
        'https://api.openphone.com/v1/messages',
        {
          to: [to],
          text: content
        },
        {
          headers: {
            'Authorization': `Bearer ${openphoneKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Store message in database
      await db.query(`
        INSERT INTO messages (
          conversation_id, from_number, to_number, body, 
          direction, status, is_ai_generated, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        conversationId || openphoneResponse.data.conversationId,
        'ClubOS',
        to,
        content,
        'outbound',
        'sent',
        isAiGenerated || false
      ]);
    } catch (apiError) {
      logger.error('OpenPhone API error:', apiError);
      // Store message as failed
      await db.query(`
        INSERT INTO messages (
          conversation_id, from_number, to_number, body, 
          direction, status, is_ai_generated, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        conversationId || require('uuid').v4(),
        'ClubOS',
        to,
        content,
        'outbound',
        'failed',
        isAiGenerated || false
      ]);
    }
    
    // Update conversation status if exists
    if (conversationId) {
      await db.query(`
        UPDATE messages 
        SET status = 'replied' 
        WHERE conversation_id = $1 AND direction = 'inbound'
      `, [conversationId]);
      
      // PATTERN LEARNING: Learn from this operator response
      try {
        // Get the last customer message from this conversation
        const lastCustomerMessage = await db.query(`
          SELECT body, from_number 
          FROM messages 
          WHERE conversation_id = $1 
            AND direction = 'inbound'
          ORDER BY created_at DESC 
          LIMIT 1
        `, [conversationId]);
        
        if (lastCustomerMessage.rows[0] && !isAiGenerated) {
          // Only learn from human operator responses, not AI-generated ones
          await patternLearningService.learnFromHumanResponse(
            lastCustomerMessage.rows[0].body,
            content,
            [], // TODO: Extract any actions taken (tickets created, etc.)
            conversationId,
            to, // phone number
            req.user?.id
          );
          
          logger.info('[Pattern Learning] Learned from operator response', {
            conversationId,
            phoneNumber: to,
            operatorId: req.user?.id
          });
        }
      } catch (learningError) {
        // Don't fail the message send if learning fails
        logger.error('[Pattern Learning] Failed to learn from response:', learningError);
      }
    }
    
    res.json({
      success: true,
      message: 'Message sent successfully'
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
}); */

// GET /api/messages/stats/today - Get today's message statistics
router.get('/stats/today', authenticate, async (req, res) => {
  try {
    // Get today's messages count
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const messagesResult = await db.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN is_ai_generated = true THEN 1 END) as ai_count
      FROM messages 
      WHERE created_at >= $1
    `, [todayStart]);
    
    const totalMessages = parseInt(messagesResult.rows[0]?.total_count || '0');
    const aiMessages = parseInt(messagesResult.rows[0]?.ai_count || '0');
    const aiResponseRate = totalMessages > 0 ? (aiMessages / totalMessages) * 100 : 0;
    
    res.json({
      success: true,
      count: totalMessages,
      aiMessages: aiMessages,
      aiResponseRate: Math.round(aiResponseRate * 10) / 10
    });
  } catch (error) {
    logger.error('Error getting message stats:', error);
    res.status(500).json({
      success: false,
      count: 0,
      aiResponseRate: 0
    });
  }
});

export default router;