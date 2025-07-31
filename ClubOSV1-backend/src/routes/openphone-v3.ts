import { Router, Request, Response } from 'express';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { ensureOpenPhoneColumns } from '../utils/database-helpers';
import { insertOpenPhoneConversation, updateOpenPhoneConversation } from '../utils/openphone-db-helpers';

const router = Router();

// Temporary webhook handler for OpenPhone v3 wrapped structure
router.post('/webhook-v3', async (req: Request, res: Response) => {
  try {
    logger.info('OpenPhone v3 webhook received', {
      bodyKeys: Object.keys(req.body),
      hasObject: !!req.body.object
    });
    
    // Ensure columns exist
    await ensureOpenPhoneColumns();
    
    // HANDLE V3 WRAPPED STRUCTURE
    let webhookData = req.body;
    
    // If wrapped in object, unwrap it
    if (req.body.object && req.body.object.type) {
      webhookData = req.body.object;
      logger.info('Unwrapped v3 structure', {
        type: webhookData.type,
        hasData: !!webhookData.data
      });
    }
    
    const { type, data } = webhookData;
    
    if (!type || !data) {
      logger.warn('Missing type or data in webhook');
      return res.json({ received: true });
    }
    
    // Handle message events
    if (type.startsWith('message.')) {
      const messageData = data.object || data;
      
      // Extract phone number based on direction
      let phoneNumber;
      if (messageData.direction === 'incoming' || messageData.direction === 'inbound') {
        phoneNumber = messageData.from;
      } else {
        phoneNumber = Array.isArray(messageData.to) ? messageData.to[0] : messageData.to;
      }
      
      if (!phoneNumber) {
        logger.warn('No phone number in message data');
        return res.json({ received: true });
      }
      
      logger.info('Processing message', {
        phoneNumber,
        direction: messageData.direction,
        body: (messageData.body || '').substring(0, 50)
      });
      
      // Build message object
      const newMessage = {
        id: messageData.id,
        type: type,
        from: messageData.from,
        to: messageData.to,
        text: messageData.body || messageData.text || '',
        body: messageData.body || messageData.text || '',
        direction: messageData.direction || 'inbound',
        createdAt: messageData.createdAt || new Date().toISOString(),
        media: messageData.media || [],
        status: messageData.status,
        conversationId: messageData.conversationId
      };
      
      // Use phone number as conversation ID
      const conversationId = `conv_${phoneNumber.replace(/[^0-9]/g, '')}`;
      
      // Check for existing conversation
      const existingConv = await db.query(`
        SELECT id, messages
        FROM openphone_conversations 
        WHERE phone_number = $1
        ORDER BY created_at DESC 
        LIMIT 1
      `, [phoneNumber]);
      
      if (existingConv.rows.length > 0) {
        // Append to existing
        const existingMessages = existingConv.rows[0].messages || [];
        const updatedMessages = [...existingMessages, newMessage];
        
        await updateOpenPhoneConversation(existingConv.rows[0].id, {
          messages: updatedMessages,
          customerName: phoneNumber
        });
        
        logger.info('Message appended to existing conversation', {
          conversationId,
          phoneNumber,
          messageCount: updatedMessages.length
        });
      } else {
        // Create new conversation
        await insertOpenPhoneConversation({
          conversationId,
          phoneNumber,
          customerName: phoneNumber,
          employeeName: 'OpenPhone',
          messages: [newMessage],
          metadata: { 
            type,
            firstMessageAt: new Date().toISOString()
          }
        });
        
        logger.info('New conversation created', {
          conversationId,
          phoneNumber
        });
      }
    }
    
    res.json({ received: true, processed: true });
    
  } catch (error) {
    logger.error('OpenPhone v3 webhook error:', error);
    res.json({ 
      received: true, 
      error: 'Processing error - logged for review' 
    });
  }
});

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'OpenPhone v3 handler is working',
    timestamp: new Date().toISOString()
  });
});

export default router;