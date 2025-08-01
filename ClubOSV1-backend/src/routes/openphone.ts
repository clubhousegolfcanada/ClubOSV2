import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { openPhoneService } from '../services/openphoneService';
import { notificationService } from '../services/notificationService';
import { ensureOpenPhoneColumns } from '../utils/database-helpers';
import { insertOpenPhoneConversation, updateOpenPhoneConversation } from '../utils/openphone-db-helpers';
import { hubspotService } from '../services/hubspotService';

const router = Router();

// Verify OpenPhone webhook signature
function verifyOpenPhoneSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// OpenPhone webhook handler
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Ensure database columns exist before processing webhook
    await ensureOpenPhoneColumns();
    
    // Get raw body for signature verification if available
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const signature = req.headers['x-openphone-signature'] as string;
    const webhookSecret = process.env.OPENPHONE_WEBHOOK_SECRET;

    // Verify signature if secret is configured
    if (webhookSecret && signature) {
      const isValid = verifyOpenPhoneSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        logger.warn('Invalid OpenPhone webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // CRITICAL FIX: Handle wrapped webhook structure from OpenPhone v3
    // OpenPhone sends: { object: { type, data } }
    // We need to unwrap this structure
    logger.info('Webhook received - checking structure', {
      hasObject: !!req.body.object,
      bodyKeys: Object.keys(req.body),
      objectKeys: req.body.object ? Object.keys(req.body.object) : []
    });
    
    // Handle OpenPhone v3 webhook structure
    // The entire webhook is wrapped in an "object" field
    let webhookData = req.body;
    let type, data;
    
    // Check if this is the v3 wrapped format
    if (req.body.object && req.body.object.type) {
      // V3 format: { object: { type, data, ... } }
      type = req.body.object.type;
      data = req.body.object.data;
    } else if (req.body.type) {
      // Direct format: { type, data, ... }
      type = req.body.type;
      data = req.body.data;
    } else {
      logger.warn('Unknown webhook format', { body: req.body });
      return res.status(200).json({ received: true });
    }
    
    // Enhanced logging for debugging
    logger.info('OpenPhone webhook received', { 
      type, 
      dataKeys: Object.keys(data || {}),
      rawBody: JSON.stringify(req.body).substring(0, 500),
      headers: req.headers,
      hasWrappedObject: !!req.body.object
    });
    console.log('OPENPHONE WEBHOOK [v2]:', JSON.stringify({ type, data }, null, 2));

    // Handle different webhook types
    switch (type) {
      case 'message.created':
      case 'message.received':
      case 'message.delivered':
      case 'message.updated':
      case 'conversation.updated':
        // OpenPhone v3 API has data nested in data.object
        const messageData = data.object || data;
        
        // Extract phone number based on direction
        let phoneNumber;
        if (messageData.direction === 'incoming' || messageData.direction === 'inbound') {
          // For incoming messages, the customer is the sender
          phoneNumber = messageData.from;
        } else {
          // For outgoing messages, the customer is the recipient
          // Note: 'to' can be either string or array depending on webhook version
          phoneNumber = Array.isArray(messageData.to) ? messageData.to[0] : messageData.to;
        }
        
        // Fallback to other fields if needed
        phoneNumber = phoneNumber || messageData.phoneNumber;
        
        // Log extraction for debugging
        logger.info('Phone number extraction:', {
          direction: messageData.direction,
          from: messageData.from,
          to: messageData.to,
          extracted: phoneNumber
        });
        
        // Try multiple fields for contact name, fallback to phone number
        let customerName = messageData.contactName || 
                           data.contactName || 
                           messageData.contact?.name ||
                           data.contact?.name ||
                           messageData.conversationPhoneNumberName ||
                           data.conversationPhoneNumberName ||
                           messageData.name ||
                           data.name ||
                           phoneNumber || // Use phone number as fallback
                           'Unknown';
                           
        const employeeName = messageData.userName || 
                           data.userName || 
                           messageData.user?.name ||
                           data.user?.name ||
                           'Unknown';

        // HubSpot lookup for inbound messages to get real customer name
        if ((messageData.direction === 'incoming' || messageData.direction === 'inbound') && phoneNumber) {
          try {
            const hubspotContact = await hubspotService.searchByPhone(phoneNumber);
            if (hubspotContact && hubspotContact.name && hubspotContact.name !== 'Unknown') {
              customerName = hubspotContact.name;
              logger.info('HubSpot contact found for inbound message', {
                phoneNumber,
                customerName: hubspotContact.name,
                company: hubspotContact.company
              });
            }
          } catch (hubspotError) {
            // Log but don't fail the webhook
            logger.warn('HubSpot lookup failed during webhook:', hubspotError);
          }
        }
        
        // Use phone number as primary identifier for time-based grouping
        if (!phoneNumber) {
          logger.warn('No phone number in webhook data', { type, data });
          break;
        }
        
        // Build message object (body is the field from webhook)
        const newMessage = {
          id: messageData.id,
          type: type,
          from: messageData.from,
          to: messageData.to, // Keep original format
          text: messageData.body || messageData.text || '', // body is primary field
          body: messageData.body || messageData.text || '', // Keep both for compatibility
          direction: (messageData.direction === 'incoming' || messageData.direction === 'inbound') ? 'inbound' : 'outbound',
          createdAt: messageData.createdAt || new Date().toISOString(),
          media: messageData.media || [],
          status: messageData.status,
          conversationId: messageData.conversationId
        };
        
        // Use phone number as the consistent conversation ID
        const conversationId = `conv_${phoneNumber.replace(/[^0-9]/g, '')}`;
        
        // Check if we have an existing conversation for this phone number
        const existingConv = await db.query(`
          SELECT id, messages, conversation_id
          FROM openphone_conversations 
          WHERE phone_number = $1
          ORDER BY created_at DESC 
          LIMIT 1
        `, [phoneNumber]);
        
        if (existingConv.rows.length > 0) {
          // Append to existing conversation
          const existingMessages = existingConv.rows[0].messages || [];
          const updatedMessages = [...existingMessages, newMessage];
          
          // Update conversation and increment unread count if inbound
          const unreadIncrement = (messageData.direction === 'incoming' || messageData.direction === 'inbound') ? 1 : 0;
          
          // Calculate new unread count
          const currentUnreadCount = existingConv.rows[0].unread_count || 0;
          const newUnreadCount = currentUnreadCount + unreadIncrement;
          
          await updateOpenPhoneConversation(existingConv.rows[0].id, {
            messages: updatedMessages,
            unreadCount: newUnreadCount,
            customerName,
            employeeName
          });
          
          logger.info('OpenPhone message appended to customer conversation', { 
            conversationId,
            phoneNumber,
            messageCount: updatedMessages.length,
            direction: messageData.direction
          });
          
          // Send push notification for inbound messages
          if (messageData.direction === 'incoming' || messageData.direction === 'inbound') {
            try {
              // Get all users with admin, operator, or support roles
              const users = await db.query(
                `SELECT id FROM users 
                 WHERE role IN ('admin', 'operator', 'support') 
                 AND active = true`
              );
              
              const userIds = users.rows.map(u => u.id);
              
              // Send notification to all eligible users
              await notificationService.sendToUsers(userIds, {
                title: `New message from ${customerName}`,
                body: (messageData.body || messageData.text || '').substring(0, 100) + 
                      (messageData.body?.length > 100 ? '...' : ''),
                icon: '/logo-192.png',
                badge: '/badge-72.png',
                tag: `message-${phoneNumber}`,
                data: {
                  type: 'messages',
                  phoneNumber: phoneNumber,
                  conversationId: existingConv.rows[0].id,
                  url: '/messages'
                }
              });
              
              logger.info('Push notifications sent for inbound message', {
                phoneNumber,
                userCount: userIds.length
              });
            } catch (notifError) {
              // Don't fail webhook if notification fails
              logger.error('Failed to send push notification:', notifError);
            }
          }
          
          break;
        }
        
        // First message from this phone number - create new record
        const newConversationId = conversationId;
        const initialUnreadCount = (messageData.direction === 'incoming' || messageData.direction === 'inbound') ? 1 : 0;
        
        // Use safe insert helper that handles missing columns
        await insertOpenPhoneConversation({
          conversationId: newConversationId,
          phoneNumber,
          customerName,
          employeeName,
          messages: [newMessage],
          metadata: { 
            openPhoneId: messageData.id,
            openPhoneConversationId: messageData.conversationId,
            type,
            firstMessageAt: new Date().toISOString()
          },
          unreadCount: initialUnreadCount
        });
        
        logger.info('OpenPhone new conversation created (time-based split)', { 
          conversationId: newConversationId, 
          phoneNumber 
        });
        
        // Send push notification for new inbound conversation
        if (messageData.direction === 'incoming' || messageData.direction === 'inbound') {
          try {
            const users = await db.query(
              `SELECT id FROM users 
               WHERE role IN ('admin', 'operator', 'support') 
               AND active = true`
            );
            
            const userIds = users.rows.map(u => u.id);
            
            await notificationService.sendToUsers(userIds, {
              title: `New conversation from ${customerName}`,
              body: (messageData.body || messageData.text || '').substring(0, 100) + 
                    (messageData.body?.length > 100 ? '...' : ''),
              icon: '/logo-192.png',
              badge: '/badge-72.png',
              tag: `message-${phoneNumber}`,
              data: {
                type: 'messages',
                phoneNumber: phoneNumber,
                conversationId: newConversationId,
                url: '/messages'
              }
            });
            
            logger.info('Push notifications sent for new conversation', {
              phoneNumber,
              userCount: userIds.length
            });
          } catch (notifError) {
            logger.error('Failed to send push notification:', notifError);
          }
        }
        
        break;

      case 'call.completed':
        // Store call information - append to existing conversation if exists
        const callPhoneNumber = data.phoneNumber || data.from || data.to;
        const callConversationId = `conv_${callPhoneNumber.replace(/[^0-9]/g, '')}`;
        
        const callMessage = {
          id: data.id,
          type: 'call',
          timestamp: data.timestamp || new Date().toISOString(),
          duration: data.duration,
          direction: data.direction,
          recording: data.recordingUrl
        };
        
        // Check for existing conversation
        const existingCallConv = await db.query(`
          SELECT id, messages FROM openphone_conversations 
          WHERE phone_number = $1
          LIMIT 1
        `, [callPhoneNumber]);
        
        if (existingCallConv.rows.length > 0) {
          // Append to existing
          const messages = existingCallConv.rows[0].messages || [];
          messages.push(callMessage);
          
          await updateOpenPhoneConversation(existingCallConv.rows[0].id, {
            messages,
            customerName: data.contactName || callPhoneNumber,
            employeeName: data.userName || 'Unknown'
          });
        } else {
          // Create new
          await insertOpenPhoneConversation({
            conversationId: callConversationId,
            phoneNumber: callPhoneNumber,
            customerName: data.contactName || callPhoneNumber,
            employeeName: data.userName || 'Unknown',
            messages: [callMessage],
            metadata: { 
              openPhoneId: data.id,
              type,
              callDetails: {
                duration: data.duration,
                direction: data.direction,
                recording: data.recordingUrl
              }
            },
            unreadCount: 0 // Calls start with 0 unread count
          });
        
        }
        
        logger.info('OpenPhone call stored', { 
          conversationId: callConversationId,
          phoneNumber: callPhoneNumber, 
          duration: data.duration 
        });
        break;

      case 'call.summary.completed':
        // Store AI-generated call summary
        await insertOpenPhoneConversation({
          phoneNumber: data.phoneNumber || data.to || data.from,
          customerName: data.contactName || 'Unknown',
          employeeName: data.userName || 'Unknown',
          messages: [{
            type: 'call_summary',
            summary: data.summary,
            timestamp: data.timestamp || new Date().toISOString()
          }],
          metadata: { 
            openPhoneId: data.id,
            callId: data.callId,
            type,
            aiGenerated: true
          },
          unreadCount: 0 // Summaries don't affect unread count
        });
        
        logger.info('OpenPhone AI call summary stored', { phoneNumber: data.phoneNumber });
        break;

      case 'call.transcript.completed':
        // Store call transcript
        await insertOpenPhoneConversation({
          phoneNumber: data.phoneNumber || data.to || data.from,
          customerName: data.contactName || 'Unknown',
          employeeName: data.userName || 'Unknown',
          messages: [{
            type: 'call_transcript',
            transcript: data.transcript,
            timestamp: data.timestamp || new Date().toISOString()
          }],
          metadata: { 
            openPhoneId: data.id,
            callId: data.callId,
            type,
            transcriptUrl: data.transcriptUrl
          },
          unreadCount: 0 // Transcripts don't affect unread count
        });
        
        logger.info('OpenPhone call transcript stored', { phoneNumber: data.phoneNumber });
        break;

      case 'call.recording.completed':
        // Store call recording URL
        await insertOpenPhoneConversation({
          phoneNumber: data.phoneNumber || data.to || data.from,
          customerName: data.contactName || 'Unknown',
          employeeName: data.userName || 'Unknown',
          messages: [{
            type: 'call_recording',
            recordingUrl: data.recordingUrl,
            duration: data.duration,
            timestamp: data.timestamp || new Date().toISOString()
          }],
          metadata: { 
            openPhoneId: data.id,
            callId: data.callId,
            type,
            recordingUrl: data.recordingUrl
          },
          unreadCount: 0 // Recordings don't affect unread count
        });
        
        logger.info('OpenPhone call recording stored', { phoneNumber: data.phoneNumber });
        break;

      default:
        logger.info('Unhandled OpenPhone webhook type', { type });
    }
    
    // Always respond quickly to webhooks
    res.json({ received: true });
    
  } catch (error) {
    logger.error('OpenPhone webhook error:', error);
    
    // Still respond with 200 to prevent retries
    res.json({ 
      received: true, 
      error: 'Processing error - logged for review' 
    });
  }
});

// Get unprocessed conversations for knowledge extraction
router.get('/conversations/unprocessed', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    
    const result = await db.query(`
      SELECT * FROM openphone_conversations 
      WHERE processed = false 
      ORDER BY created_at DESC 
      LIMIT $1
    `, [limit]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    logger.error('Failed to get unprocessed conversations:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve conversations' 
    });
  }
});

// Mark conversation as processed
router.put('/conversations/:id/processed', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      UPDATE openphone_conversations 
      SET processed = true 
      WHERE id = $1
      RETURNING *
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Conversation not found' 
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    logger.error('Failed to mark conversation as processed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update conversation' 
    });
  }
});

// Health check endpoint (no auth required for debugging)
router.get('/health', async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'OpenPhone routes are working',
    timestamp: new Date().toISOString()
  });
});

// Simple webhook test (no auth, just logs)
router.post('/webhook-test', async (req: Request, res: Response) => {
  console.log('WEBHOOK TEST RECEIVED:', JSON.stringify(req.body, null, 2));
  logger.info('Webhook test received', { body: req.body });
  
  // Extract and analyze the data
  const { type, data } = req.body;
  const messageData = data?.object || data;
  
  const analysis = {
    type,
    hasData: !!data,
    hasObject: !!(data?.object),
    messageFields: messageData ? Object.keys(messageData) : [],
    from: messageData?.from,
    to: messageData?.to,
    toIsArray: Array.isArray(messageData?.to),
    text: messageData?.text,
    body: messageData?.body,
    direction: messageData?.direction,
    userId: messageData?.userId,
    phoneNumberId: messageData?.phoneNumberId
  };
  
  console.log('WEBHOOK ANALYSIS:', JSON.stringify(analysis, null, 2));
  
  // Test storing a properly formatted message
  if (messageData?.from && messageData?.body) {
    logger.info('Would store message with structure:', {
      from: messageData.from,
      to: messageData.to,
      body: messageData.body,
      direction: messageData.direction
    });
  }
  
  res.json({
    success: true,
    message: 'Webhook test received',
    receivedData: req.body,
    analysis
  });
});

// Debug endpoint to check all OpenPhone data (no auth for debugging)
router.get('/debug/all', async (req: Request, res: Response) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        conversation_id,
        phone_number,
        customer_name,
        employee_name,
        jsonb_array_length(messages) as message_count,
        messages,
        created_at,
        updated_at,
        processed,
        metadata
      FROM openphone_conversations 
      ORDER BY updated_at DESC 
      LIMIT 100
    `);
    
    const count = await db.query(`
      SELECT 
        COUNT(DISTINCT conversation_id) as total_conversations,
        COUNT(*) as total_records,
        SUM(jsonb_array_length(messages)) as total_messages
      FROM openphone_conversations
    `);
    
    res.json({
      success: true,
      stats: {
        totalConversations: count.rows[0].total_conversations || 0,
        totalRecords: count.rows[0].total_records || 0,
        totalMessages: count.rows[0].total_messages || 0
      },
      conversations: result.rows.map(row => ({
        ...row,
        messages: row.messages || []
      })),
      message: `Found ${count.rows[0].total_conversations || 0} conversations with ${count.rows[0].total_messages || 0} total messages`
    });
    
  } catch (error) {
    logger.error('Failed to get OpenPhone debug data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve debug data',
      details: error.message
    });
  }
});

// Test OpenPhone connection
router.get('/test-connection', authenticate, roleGuard(['admin']), async (req: Request, res: Response) => {
  try {
    const connected = await openPhoneService.testConnection();
    const phoneNumbers = await openPhoneService.getPhoneNumbers();
    
    res.json({
      success: true,
      data: {
        connected,
        phoneNumbers: phoneNumbers.map(p => ({
          number: p.phoneNumber,
          name: p.name
        }))
      }
    });
    
  } catch (error) {
    logger.error('OpenPhone connection test failed:', error);
    res.status(500).json({ 
      success: false,
      data: { connected: false },
      error: 'Connection test failed'
    });
  }
});

// Import historical conversations (admin only)
router.post('/import-history', authenticate, roleGuard(['admin']), async (req: Request, res: Response) => {
  try {
    const { daysBack = 30 } = req.body;
    
    logger.info(`Starting OpenPhone historical import for ${daysBack} days`);
    
    const stats = await openPhoneService.importHistoricalConversations(daysBack);
    
    res.json({
      success: true,
      message: `Import complete: ${stats.imported} imported, ${stats.skipped} skipped, ${stats.errors} errors`,
      data: stats
    });
    
  } catch (error) {
    logger.error('Failed to import OpenPhone history:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to import historical conversations' 
    });
  }
});

// Test OpenPhone connection (admin only)
router.get('/test-connection', authenticate, roleGuard(['admin']), async (req: Request, res: Response) => {
  try {
    const isConnected = await openPhoneService.testConnection();
    const phoneNumbers = await openPhoneService.getPhoneNumbers();
    
    res.json({
      success: true,
      data: {
        connected: isConnected,
        phoneNumbers: phoneNumbers.map(p => ({
          number: p.phoneNumber,
          name: p.name
        }))
      }
    });
    
  } catch (error) {
    logger.error('OpenPhone connection test failed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Connection test failed' 
    });
  }
});

// Get conversation statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_conversations,
        COUNT(CASE WHEN processed = false THEN 1 END) as unprocessed_count,
        COUNT(CASE WHEN processed = true THEN 1 END) as processed_count,
        COUNT(DISTINCT phone_number) as unique_customers,
        COUNT(DISTINCT employee_name) as unique_employees
      FROM openphone_conversations
    `);
    
    const recentActivity = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as conversation_count
      FROM openphone_conversations
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    
    res.json({
      success: true,
      data: {
        overview: stats.rows[0],
        recentActivity: recentActivity.rows
      }
    });
    
  } catch (error) {
    logger.error('Failed to get OpenPhone stats:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve statistics' 
    });
  }
});

// Get recent conversations for live display (admin only)
router.get('/recent-conversations', authenticate, roleGuard(['admin']), async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    logger.info('Fetching recent conversations', { limit });
    
    const result = await db.query(`
      SELECT 
        id,
        conversation_id,
        phone_number,
        customer_name,
        employee_name,
        messages,
        created_at,
        updated_at,
        processed,
        metadata
      FROM openphone_conversations 
      ORDER BY updated_at DESC 
      LIMIT $1
    `, [limit]);
    
    logger.info('Recent conversations fetched', { count: result.rows.length });
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    logger.error('Failed to get recent conversations:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve recent conversations' 
    });
  }
});

// Debug endpoint for recent conversations (no auth required)
router.get('/debug/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    const result = await db.query(`
      SELECT 
        id,
        conversation_id,
        phone_number,
        customer_name,
        employee_name,
        messages,
        created_at,
        updated_at,
        processed,
        metadata
      FROM openphone_conversations 
      ORDER BY updated_at DESC 
      LIMIT $1
    `, [limit]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      message: `Found ${result.rows.length} recent conversations`
    });
    
  } catch (error) {
    logger.error('Debug recent conversations error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve recent conversations',
      details: error.message
    });
  }
});

// Get conversation count for display
router.get('/conversations/count', authenticate, roleGuard(['admin']), async (req: Request, res: Response) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(DISTINCT phone_number) as unique_customers,
        COUNT(*) as total_conversations,
        COALESCE(SUM(jsonb_array_length(messages)), 0) as total_messages,
        COUNT(CASE WHEN processed = false THEN 1 END) as unprocessed_count
      FROM openphone_conversations
    `);
    
    res.json({
      success: true,
      data: {
        uniqueCustomers: parseInt(result.rows[0].unique_customers) || 0,
        totalConversations: parseInt(result.rows[0].total_conversations) || 0,
        totalMessages: parseInt(result.rows[0].total_messages) || 0,
        unprocessedCount: parseInt(result.rows[0].unprocessed_count) || 0
      }
    });
  } catch (error) {
    logger.error('Failed to get conversation count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation statistics'
    });
  }
});

// Export all conversations for AI processing
router.get('/export/all', authenticate, roleGuard(['admin']), async (req: Request, res: Response) => {
  try {
    const format = req.query.format as string || 'json';
    
    // Get all conversations ordered by phone number and created date
    const result = await db.query(`
      SELECT 
        id,
        conversation_id,
        phone_number,
        customer_name,
        employee_name,
        messages,
        created_at,
        updated_at,
        processed,
        metadata
      FROM openphone_conversations
      ORDER BY phone_number, created_at
    `);
    
    if (format === 'llm') {
      // Format optimized for LLM processing
      const formattedData = result.rows.map(conv => ({
        conversationId: conv.conversation_id,
        customer: {
          phone: conv.phone_number,
          name: conv.customer_name
        },
        employee: conv.employee_name,
        messages: conv.messages.map((msg: any) => ({
          timestamp: msg.createdAt || msg.timestamp,
          type: msg.type,
          from: msg.from === conv.phone_number ? 'customer' : 'employee',
          content: msg.body || msg.summary || msg.transcript || '[Call]',
          metadata: {
            duration: msg.duration,
            direction: msg.direction,
            mediaCount: msg.media?.length || 0
          }
        })),
        conversationStart: conv.created_at,
        lastActivity: conv.updated_at,
        processed: conv.processed
      }));
      
      res.json({
        success: true,
        exportDate: new Date().toISOString(),
        conversationCount: formattedData.length,
        data: formattedData
      });
    } else {
      // Raw JSON export
      res.json({
        success: true,
        exportDate: new Date().toISOString(),
        conversationCount: result.rows.length,
        data: result.rows
      });
    }
  } catch (error) {
    logger.error('Failed to export conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export conversations'
    });
  }
});

// Export as CSV for spreadsheet analysis
router.get('/export/csv', authenticate, roleGuard(['admin']), async (req: Request, res: Response) => {
  try {
    const result = await db.query(`
      SELECT 
        conversation_id,
        phone_number,
        customer_name,
        employee_name,
        json_array_length(messages) as message_count,
        created_at,
        updated_at,
        processed
      FROM openphone_conversations
      ORDER BY created_at DESC
    `);
    
    // Create CSV header
    let csv = 'Conversation ID,Phone Number,Customer Name,Employee Name,Message Count,First Contact,Last Contact,Processed\n';
    
    // Add data rows
    result.rows.forEach(row => {
      csv += `"${row.conversation_id}","${row.phone_number}","${row.customer_name}","${row.employee_name}",${row.message_count},"${row.created_at}","${row.updated_at}",${row.processed}\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=openphone_export_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    logger.error('Failed to export CSV:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export CSV'
    });
  }
});

export default router;