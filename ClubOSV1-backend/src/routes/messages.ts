import { Router, Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import { authenticate, verifyToken } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validation';
import { body } from 'express-validator';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { openPhoneService } from '../services/openphoneService';
import { messageSendLimiter } from '../middleware/rateLimiter';
import { formatToE164, isValidE164 } from '../utils/phoneNumberFormatter';
import { messageAssistantService } from '../services/messageAssistantService';
import { anonymizePhoneNumber } from '../utils/encryption';
import { hubspotService } from '../services/hubspotService';
import { aiAutomationService } from '../services/aiAutomationService';
import { successResponse, errorResponse } from '../utils/responseHelpers';
import { clubaiService } from '../services/clubaiService';
import { patternSafetyService } from '../services/patternSafetyService';

const router = Router();

// SSE event emitter for real-time message push
const messageEvents = new EventEmitter();
messageEvents.setMaxListeners(50); // Support up to 50 concurrent operator connections
export { messageEvents };

// Simple in-memory cache for conversations
// Exported so the openphone webhook can invalidate it when new messages arrive
export const conversationCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds TTL for cache - aligned with frontend polling interval

// Request deduplication to prevent concurrent identical requests
const pendingRequests = new Map<string, Promise<any>>();

// Helper to generate cache key
const getCacheKey = (userId: string, limit: number, offset: number, search?: string) => {
  return `${userId}-${limit}-${offset}-${search || ''}`;
};

// Schema check cache — avoids hitting information_schema on every request
let schemaChecked = false;
let schemaColumns = { hasUnreadCount: false, hasLastReadAt: false, hasUpdatedAt: false, hasClubaiEscalated: false, hasCustomerSentiment: false, hasConversationLocked: false };

async function ensureSchemaChecked(): Promise<typeof schemaColumns> {
  if (schemaChecked) return schemaColumns;

  const columnCheck = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'openphone_conversations'
    AND column_name IN ('unread_count', 'last_read_at', 'updated_at', 'clubai_escalated', 'customer_sentiment', 'conversation_locked')
  `);

  const cols = columnCheck.rows.map((row: any) => row.column_name);
  schemaColumns = {
    hasUnreadCount: cols.includes('unread_count'),
    hasLastReadAt: cols.includes('last_read_at'),
    hasUpdatedAt: cols.includes('updated_at'),
    hasClubaiEscalated: cols.includes('clubai_escalated'),
    hasCustomerSentiment: cols.includes('customer_sentiment'),
    hasConversationLocked: cols.includes('conversation_locked'),
  };
  schemaChecked = true;
  logger.info('Schema check cached', { schemaColumns });
  return schemaColumns;
}

// Cached column existence check for denormalized columns
const columnExistsCache = new Map<string, boolean>();
async function columnExistsCached(table: string, column: string): Promise<boolean> {
  const key = `${table}.${column}`;
  if (columnExistsCache.has(key)) return columnExistsCache.get(key)!;

  const result = await db.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = $1 AND column_name = $2
    )
  `, [table, column]);
  const exists = result.rows[0]?.exists ?? false;
  columnExistsCache.set(key, exists);
  return exists;
}

// Health check endpoint
router.get('/health', async (_req, res) => {
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

// SSE endpoint for real-time message updates
router.get('/events', (req: Request, res: Response) => {
  // Auth via query param (SSE doesn't support custom headers)
  const token = req.query.token as string;
  if (!token) {
    res.status(401).json({ error: 'Token required' });
    return;
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  if (!decoded.role || !['admin', 'operator', 'support'].includes(decoded.role)) {
    res.status(403).json({ error: 'Insufficient permissions' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

  // Heartbeat every 30s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  const onNewMessage = (data: any) => {
    res.write(`event: new_message\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const onConversationUpdate = (data: any) => {
    res.write(`event: conversation_update\ndata: ${JSON.stringify(data)}\n\n`);
  };

  messageEvents.on('new_message', onNewMessage);
  messageEvents.on('conversation_update', onConversationUpdate);

  req.on('close', () => {
    clearInterval(heartbeat);
    messageEvents.off('new_message', onNewMessage);
    messageEvents.off('conversation_update', onConversationUpdate);
    logger.debug('SSE client disconnected');
  });
});

// Get all conversations
router.get('/conversations',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  async (req, res, next) => {
    try {
      const { limit = 15, offset = 0, search } = req.query;  // Optimized: reduced from 25 to 15 for faster initial load

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
      // Use cached schema check instead of querying information_schema every time
      const { hasUnreadCount, hasLastReadAt, hasUpdatedAt, hasClubaiEscalated, hasCustomerSentiment, hasConversationLocked } = await ensureSchemaChecked();

      // OPTIMIZED v2: Use denormalized last_message columns to avoid JSONB operations.
      // Falls back to JSONB ops if columns don't exist yet (pre-migration 366).
      const orderCol = hasUpdatedAt ? 'updated_at' : 'created_at';
      const params: any[] = [];

      let whereClause = `WHERE phone_number IS NOT NULL AND phone_number != '' AND phone_number != 'Unknown'`;
      if (search) {
        whereClause += ` AND (phone_number LIKE $1 OR customer_name ILIKE $1)`;
        params.push(`%${search}%`);
      }

      // Check if denormalized columns exist (cached after first check)
      const hasDenormalized = await columnExistsCached('openphone_conversations', 'last_message_text');

      let query: string;
      if (hasDenormalized) {
        // Fast path: use denormalized columns, no JSONB ops
        query = `
          SELECT DISTINCT ON (phone_number)
            id,
            phone_number,
            customer_name,
            employee_name,
            COALESCE(message_count, 0) as message_count,
            last_message_text,
            last_message_direction,
            last_message_at,
            ${hasUnreadCount ? 'unread_count,' : '0 as unread_count,'}
            ${hasLastReadAt ? 'last_read_at,' : 'NULL as last_read_at,'}
            ${hasClubaiEscalated ? 'COALESCE(clubai_escalated, false) as clubai_escalated,' : 'false as clubai_escalated,'}
            ${hasCustomerSentiment ? "COALESCE(customer_sentiment, 'neutral') as customer_sentiment," : "'neutral' as customer_sentiment,"}
            ${hasConversationLocked ? 'COALESCE(conversation_locked, false) as conversation_locked,' : 'false as conversation_locked,'}
            created_at${hasUpdatedAt ? ', updated_at' : ''}
          FROM openphone_conversations
          ${whereClause}
          ORDER BY phone_number, ${orderCol} DESC
        `;
      } else {
        // Legacy fallback: use JSONB operations
        query = `
          SELECT DISTINCT ON (phone_number)
            id,
            phone_number,
            customer_name,
            employee_name,
            jsonb_array_length(messages) as message_count,
            messages->-1->>'body' as last_message_text,
            messages->-1->>'direction' as last_message_direction,
            NULL::timestamptz as last_message_at,
            ${hasUnreadCount ? 'unread_count,' : '0 as unread_count,'}
            ${hasLastReadAt ? 'last_read_at,' : 'NULL as last_read_at,'}
            ${hasClubaiEscalated ? 'COALESCE(clubai_escalated, false) as clubai_escalated,' : 'false as clubai_escalated,'}
            ${hasCustomerSentiment ? "COALESCE(customer_sentiment, 'neutral') as customer_sentiment," : "'neutral' as customer_sentiment,"}
            ${hasConversationLocked ? 'COALESCE(conversation_locked, false) as conversation_locked,' : 'false as conversation_locked,'}
            created_at${hasUpdatedAt ? ', updated_at' : ''}
          FROM openphone_conversations
          ${whereClause}
          ORDER BY phone_number, ${orderCol} DESC
        `;
      }

      // Wrap in subquery to apply global ordering + pagination
      // (DISTINCT ON requires ORDER BY phone_number first, but we want ORDER BY updated_at DESC)
      query = `
        SELECT * FROM (${query}) AS latest
        ORDER BY ${orderCol} DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
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

        if (queryError.code === '42703') {
          // Column doesn't exist — reset schema cache so next request re-checks
          schemaChecked = false;
          logger.warn('Schema cache reset due to missing column error — will re-check on next request');

          // Retry once with a fresh schema check using DISTINCT ON
          try {
            const freshSchema = await ensureSchemaChecked();
            const retryOrderCol = freshSchema.hasUpdatedAt ? 'updated_at' : 'created_at';
            const safeQuery = `
              SELECT * FROM (
                SELECT DISTINCT ON (phone_number)
                  id, phone_number, customer_name, employee_name,
                  jsonb_array_length(messages) as message_count,
                  messages->-1 as last_message,
                  CASE
                    WHEN jsonb_array_length(messages) >= 3
                    THEN jsonb_build_array(messages->-3, messages->-2, messages->-1)
                    WHEN jsonb_array_length(messages) >= 1 THEN messages
                    ELSE '[]'::jsonb
                  END as message_history,
                  ${freshSchema.hasUnreadCount ? 'unread_count,' : '0 as unread_count,'}
                  ${freshSchema.hasLastReadAt ? 'last_read_at,' : 'NULL as last_read_at,'}
                  ${freshSchema.hasClubaiEscalated ? 'COALESCE(clubai_escalated, false) as clubai_escalated,' : 'false as clubai_escalated,'}
                  ${freshSchema.hasCustomerSentiment ? "COALESCE(customer_sentiment, 'neutral') as customer_sentiment," : "'neutral' as customer_sentiment,"}
                  ${freshSchema.hasConversationLocked ? 'COALESCE(conversation_locked, false) as conversation_locked,' : 'false as conversation_locked,'}
                  created_at${freshSchema.hasUpdatedAt ? ', updated_at' : ''}
                FROM openphone_conversations
                WHERE phone_number IS NOT NULL AND phone_number != '' AND phone_number != 'Unknown'
                ORDER BY phone_number, ${retryOrderCol} DESC
              ) AS latest
              ORDER BY ${retryOrderCol} DESC
              LIMIT $1 OFFSET $2
            `;
            result = await db.query(safeQuery, [limit, offset]);
          } catch (retryErr) {
            logger.error('Retry query also failed:', retryErr);
            return [];
          }
        } else {
          throw queryError;
        }
      }

      logger.info('Returning conversations', {
        total: result.rows.length
      });

      // Transform DB rows to API response — lightweight, no message arrays
      const transformedConversations = result.rows.map((row: any) => {
        // Build lastMessage from denormalized columns (or JSONB fallback)
        let lastMessage: any = null;
        if (row.last_message_text !== undefined && row.last_message_text !== null) {
          // New denormalized path
          lastMessage = {
            body: row.last_message_text,
            text: row.last_message_text,
            direction: row.last_message_direction || 'unknown',
            createdAt: row.last_message_at || row.updated_at,
          };
        } else if (row.last_message) {
          // Legacy JSONB fallback
          lastMessage = row.last_message;
        }

        return {
          id: row.id,
          phone_number: row.phone_number,
          customer_name: row.customer_name,
          employee_name: row.employee_name,
          messageHistory: [],  // No longer sent in list — full history loaded on conversation select
          unread_count: row.unread_count || 0,
          last_read_at: row.last_read_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
          lastMessage,
          messageCount: row.message_count || 0,
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
        return res.json(successResponse(result));
      } catch (error) {
        logger.error('Messages route error:', error);
        return next(error);
      }
    } catch (error) {
      logger.error('Messages route error:', error);
      return next(error);
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
      return res.json(successResponse(conversation));
    } catch (error) {
      return next(error);
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
      const messageLimit = Math.min(Number(req.query.limit) || 100, 500);
      const before = req.query.before as string | undefined;

      // OPTIMIZED: Single SQL query that merges, deduplicates, and paginates messages
      // across all conversation records for this phone number.
      // Uses lateral unnest instead of loading full JSONB arrays into Node.js.
      const params: any[] = [phoneNumber, messageLimit];
      let beforeClause = '';
      if (before) {
        beforeClause = `AND COALESCE(msg->>'createdAt', msg->>'timestamp', '') < $3`;
        params.push(before);
      }

      const messagesResult = await db.query(`
        WITH all_msgs AS (
          SELECT DISTINCT ON (COALESCE(msg->>'id', msg::text))
            c.id as conv_id,
            msg,
            COALESCE(msg->>'createdAt', msg->>'timestamp', c.created_at::text) as msg_time
          FROM openphone_conversations c,
               jsonb_array_elements(c.messages) AS msg
          WHERE c.phone_number = $1
            ${beforeClause}
          ORDER BY COALESCE(msg->>'id', msg::text), msg_time DESC
        ),
        sorted AS (
          SELECT * FROM all_msgs ORDER BY msg_time DESC LIMIT $2
        )
        SELECT msg, conv_id FROM sorted ORDER BY msg_time ASC
      `, params);

      // Get conversation metadata (lightweight — no messages loaded)
      const metaResult = await db.query(`
        SELECT id, phone_number, customer_name, employee_name, created_at, updated_at,
               (SELECT COUNT(*) FROM openphone_conversations WHERE phone_number = $1) as total_conversations
        FROM openphone_conversations
        WHERE phone_number = $1
        ORDER BY COALESCE(updated_at, created_at) DESC
        LIMIT 1
      `, [phoneNumber]);

      if (metaResult.rows.length === 0) {
        return res.status(404).json(errorResponse('No conversations found for this phone number', 404));
      }

      const mostRecentConv = metaResult.rows[0];
      const firstContactResult = await db.query(`
        SELECT created_at FROM openphone_conversations WHERE phone_number = $1 ORDER BY created_at ASC LIMIT 1
      `, [phoneNumber]);

      // Build messages array from SQL results
      const limitedMessages = messagesResult.rows.map((row: any) => ({
        ...row.msg,
        conversationId: row.conv_id,
      }));

      const totalMessageCount = limitedMessages.length;
      const hasMore = totalMessageCount >= messageLimit; // If we hit the limit, there are probably more
      const oldestTimestamp = limitedMessages.length > 0
        ? (limitedMessages[0].createdAt || limitedMessages[0].timestamp)
        : null;

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

      const responseData = {
        phone_number: phoneNumber,
        customer_name: mostRecentConv.customer_name,
        employee_name: mostRecentConv.employee_name,
        total_conversations: parseInt(mostRecentConv.total_conversations) || 1,
        total_messages: totalMessageCount,
        first_contact: firstContactResult.rows[0]?.created_at || mostRecentConv.created_at,
        last_contact: mostRecentConv.updated_at || mostRecentConv.created_at
      };

      logger.info('Fetched conversation history', {
        phoneNumber: anonymizePhoneNumber(phoneNumber),
        totalConversations: responseData.total_conversations,
        totalMessages: totalMessageCount,
        returnedMessages: limitedMessages.length,
        hasMore
      });

      return res.json(successResponse({
        ...responseData,
        messages: limitedMessages,
        hasMore,
        oldestTimestamp,
      }));

    } catch (error) {
      logger.error('Failed to fetch full conversation history:', error);
      return next(error);
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
  async (req, res, _next) => {
    const { to, text, from, countryCode, skipPatternLearning } = req.body;
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

      // Invalidate conversation cache so next poll returns fresh data
      conversationCache.clear();

      // OPERATOR LOCKOUT: Immediately deactivate ClubAI for this conversation.
      // Don't wait for the OpenPhone webhook -- by then the customer may have already
      // replied and ClubAI would respond before the lockout is set.
      try {
        const safetyThresholds = await patternSafetyService.getSafetyThresholds();
        const lockoutHours = safetyThresholds.operatorLockoutHours || 4;
        const globalCooldownMinutes = safetyThresholds.globalCooldownMinutes || 60;

        const convForLockout = await db.query(
          `SELECT id FROM openphone_conversations WHERE phone_number = $1 ORDER BY updated_at DESC LIMIT 1`,
          [formattedTo]
        );
        if (convForLockout.rows.length > 0) {
          const lockConvId = convForLockout.rows[0].id;
          await db.query(`
            UPDATE openphone_conversations
            SET operator_active = true,
                operator_last_message = NOW(),
                clubai_active = false,
                conversation_locked = false,
                global_cooldown_until = NOW() + INTERVAL '${globalCooldownMinutes} minutes',
                topic_lockout_until = NOW() + INTERVAL '${lockoutHours} hours'
            WHERE id = $1`,
            [lockConvId]
          );
          logger.info('[Operator Lockout] Set via /messages/send', {
            phoneNumber: formattedTo,
            conversationId: lockConvId,
            globalCooldownMinutes,
            lockoutHours
          });
        }
      } catch (lockoutErr) {
        logger.error('[Operator Lockout] Failed to set lockout in /messages/send:', lockoutErr);
      }

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
        
        let conversationMessages: { rows: any[] } = { rows: [] };
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
            
            // Check if this is a receipt-related conversation
            const isReceiptRelated = (firstQuestion?.body || '').toLowerCase().includes('receipt') ||
                                    (mainResponse?.body || '').toLowerCase().includes('receipt') ||
                                    (text || '').toLowerCase().includes('receipt');

            // Only learn patterns if not explicitly skipped (e.g., for system messages, receipts)
            if (firstQuestion && mainResponse && !skipPatternLearning && !isReceiptRelated) {
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
            } else if (skipPatternLearning) {
              logger.info('[Pattern Learning] Skipped pattern learning for system message', {
                to: formattedTo,
                reason: 'skipPatternLearning flag set'
              });
            } else if (isReceiptRelated) {
              logger.info('[Pattern Learning] Skipped pattern learning for receipt-related conversation', {
                to: formattedTo,
                reason: 'Receipt-related content detected'
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
              `UPDATE openphone_conversations
               SET messages = $1, updated_at = NOW(),
                   last_message_text = $3, last_message_direction = 'outbound',
                   last_message_at = NOW(), message_count = $4
               WHERE id = $2`,
              [JSON.stringify(messages), existing.rows[0].id,
               (tempMessage.body || tempMessage.text || '').substring(0, 500), messages.length]
            );

            logger.info('Message stored immediately as fallback', {
              messageId: tempMessage.id,
              phoneNumber: formattedTo,
              conversationId: existing.rows[0].id
            });
          }
        } else {
          // Create new conversation
          const msgBody = (tempMessage.body || tempMessage.text || '').substring(0, 500);
          await db.query(
            `INSERT INTO openphone_conversations (phone_number, messages, customer_name, employee_name, conversation_id, created_at, updated_at, unread_count,
             last_message_text, last_message_direction, last_message_at, message_count)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 0, $6, 'outbound', NOW(), 1)`,
            [formattedTo, JSON.stringify([tempMessage]), 'Customer', req.user?.name || 'Operator', result.conversationId || `conv_${formattedTo.replace(/\D/g, '')}`, msgBody]
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
      
      return res.json(successResponse(result));
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
  async (_req, res, next) => {
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
      
      return res.json(successResponse(suggestion));
    } catch (error) {
      logger.error('Failed to generate suggestion:', error);
      return next(error);
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

      // Invalidate conversation cache so next poll returns fresh data
      conversationCache.clear();

      // OPERATOR LOCKOUT: Immediately deactivate ClubAI when operator approves/sends
      try {
        const safetyThresholds = await patternSafetyService.getSafetyThresholds();
        const lockoutHours = safetyThresholds.operatorLockoutHours || 4;
        const globalCooldownMinutes = safetyThresholds.globalCooldownMinutes || 60;

        await db.query(`
          UPDATE openphone_conversations
          SET operator_active = true,
              operator_last_message = NOW(),
              clubai_active = false,
              conversation_locked = false,
              global_cooldown_until = NOW() + INTERVAL '${globalCooldownMinutes} minutes',
              topic_lockout_until = NOW() + INTERVAL '${lockoutHours} hours'
          WHERE id = $1`,
          [suggestion.conversationId]
        );
        logger.info('[Operator Lockout] Set via approve-and-send', {
          phoneNumber: formattedTo,
          conversationId: suggestion.conversationId,
          globalCooldownMinutes,
          lockoutHours
        });
      } catch (lockoutErr) {
        logger.error('[Operator Lockout] Failed to set lockout in approve-and-send:', lockoutErr);
      }

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
      
      return res.json(successResponse({
        messageId: result.id,
        suggestionId,
        sent: true
      }));
    } catch (error) {
      logger.error('Failed to send suggested message:', error);
      return next(error);
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
router.get('/stats/today', authenticate, async (_req, res) => {
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