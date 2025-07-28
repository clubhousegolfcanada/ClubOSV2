import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { openPhoneService } from '../services/openphoneService';

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

    const { type, data } = req.body;
    
    // Enhanced logging for debugging
    logger.info('OpenPhone webhook received', { 
      type, 
      dataKeys: Object.keys(data || {}),
      rawBody: JSON.stringify(req.body).substring(0, 500),
      headers: req.headers
    });
    console.log('OPENPHONE WEBHOOK:', JSON.stringify({ type, data }, null, 2));

    // Handle different webhook types
    switch (type) {
      case 'message.created':
      case 'message.received':
      case 'message.delivered':
      case 'message.updated':
      case 'conversation.updated':
        // Extract data - handle both direct data and nested object structure
        const messageData = data.object || data;
        const phoneNumber = messageData.from || messageData.to || messageData.phoneNumber;
        const customerName = messageData.contactName || data.contactName || 'Unknown';
        const employeeName = messageData.userName || data.userName || 'Unknown';
        
        // Use phone number as primary identifier for time-based grouping
        if (!phoneNumber) {
          logger.warn('No phone number in webhook data', { type, data });
          break;
        }
        
        // Time-based conversation grouping (1 hour gap = new conversation)
        const ONE_HOUR = 60 * 60 * 1000; // milliseconds
        
        // Build message object
        const newMessage = {
          id: messageData.id,
          type: type,
          from: messageData.from,
          to: messageData.to,
          body: messageData.body || messageData.text || '',
          direction: messageData.direction,
          createdAt: messageData.createdAt || new Date().toISOString(),
          media: messageData.media || []
        };
        
        // Find recent conversation from same phone number within 1 hour
        const recentConv = await db.query(`
          SELECT id, messages, conversation_id, updated_at 
          FROM openphone_conversations 
          WHERE phone_number = $1 
            AND updated_at > NOW() - INTERVAL '1 hour'
            AND processed = false
          ORDER BY updated_at DESC 
          LIMIT 1
        `, [phoneNumber]);
        
        if (recentConv.rows.length > 0) {
          // Check if last message was within 1 hour
          const lastUpdate = new Date(recentConv.rows[0].updated_at);
          const now = new Date();
          const timeDiff = now.getTime() - lastUpdate.getTime();
          
          if (timeDiff < ONE_HOUR) {
            // Update existing conversation - append new message
            const existingMessages = recentConv.rows[0].messages || [];
            const updatedMessages = [...existingMessages, newMessage];
            
            await db.query(`
              UPDATE openphone_conversations 
              SET messages = $1,
                  updated_at = CURRENT_TIMESTAMP,
                  customer_name = COALESCE(customer_name, $2),
                  employee_name = COALESCE(employee_name, $3)
              WHERE id = $4
            `, [
              JSON.stringify(updatedMessages),
              customerName,
              employeeName,
              recentConv.rows[0].id
            ]);
            
            logger.info('OpenPhone message added to recent conversation', { 
              conversationId: recentConv.rows[0].conversation_id,
              phoneNumber,
              messageCount: updatedMessages.length,
              timeSinceLastMessage: Math.round(timeDiff / 1000 / 60) + ' minutes'
            });
            break;
          }
        }
        
        // Create new conversation (either no recent conv or > 1 hour gap)
        const newConversationId = `conv_${phoneNumber}_${Date.now()}`;
        
        await db.query(`
          INSERT INTO openphone_conversations 
          (conversation_id, phone_number, customer_name, employee_name, messages, metadata)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          newConversationId,
          phoneNumber,
          customerName,
          employeeName,
          JSON.stringify([newMessage]),
          { 
            openPhoneId: messageData.id,
            openPhoneConversationId: messageData.conversationId,
            type,
            firstMessageAt: new Date().toISOString()
          }
        ]);
        
        logger.info('OpenPhone new conversation created (time-based split)', { 
          conversationId: newConversationId, 
          phoneNumber 
        });
        break;

      case 'call.completed':
        // Store call information
        await db.query(`
          INSERT INTO openphone_conversations 
          (phone_number, customer_name, employee_name, messages, metadata)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          data.phoneNumber,
          data.contactName || 'Unknown',
          data.userName || 'Unknown',
          JSON.stringify([{
            type: 'call',
            duration: data.duration,
            direction: data.direction,
            timestamp: data.timestamp
          }]),
          { 
            openPhoneId: data.id,
            type,
            callDetails: {
              duration: data.duration,
              direction: data.direction,
              recording: data.recordingUrl
            }
          }
        ]);
        
        logger.info('OpenPhone call stored', { phoneNumber: data.phoneNumber, duration: data.duration });
        break;

      case 'call.summary.completed':
        // Store AI-generated call summary
        await db.query(`
          INSERT INTO openphone_conversations 
          (phone_number, customer_name, employee_name, messages, metadata)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          data.phoneNumber || data.to || data.from,
          data.contactName || 'Unknown',
          data.userName || 'Unknown',
          JSON.stringify([{
            type: 'call_summary',
            summary: data.summary,
            timestamp: data.timestamp || new Date().toISOString()
          }]),
          { 
            openPhoneId: data.id,
            callId: data.callId,
            type,
            aiGenerated: true
          }
        ]);
        
        logger.info('OpenPhone AI call summary stored', { phoneNumber: data.phoneNumber });
        break;

      case 'call.transcript.completed':
        // Store call transcript
        await db.query(`
          INSERT INTO openphone_conversations 
          (phone_number, customer_name, employee_name, messages, metadata)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          data.phoneNumber || data.to || data.from,
          data.contactName || 'Unknown',
          data.userName || 'Unknown',
          JSON.stringify([{
            type: 'call_transcript',
            transcript: data.transcript,
            timestamp: data.timestamp || new Date().toISOString()
          }]),
          { 
            openPhoneId: data.id,
            callId: data.callId,
            type,
            transcriptUrl: data.transcriptUrl
          }
        ]);
        
        logger.info('OpenPhone call transcript stored', { phoneNumber: data.phoneNumber });
        break;

      case 'call.recording.completed':
        // Store call recording URL
        await db.query(`
          INSERT INTO openphone_conversations 
          (phone_number, customer_name, employee_name, messages, metadata)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          data.phoneNumber || data.to || data.from,
          data.contactName || 'Unknown',
          data.userName || 'Unknown',
          JSON.stringify([{
            type: 'call_recording',
            recordingUrl: data.recordingUrl,
            duration: data.duration,
            timestamp: data.timestamp || new Date().toISOString()
          }]),
          { 
            openPhoneId: data.id,
            callId: data.callId,
            type,
            recordingUrl: data.recordingUrl
          }
        ]);
        
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
  
  res.json({
    success: true,
    message: 'Webhook test received',
    receivedData: req.body
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

export default router;