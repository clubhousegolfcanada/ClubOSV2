import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import crypto from 'crypto';
import { authenticate, authorize } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { openPhoneService } from '../services/openphoneService';
import { notificationService } from '../services/notificationService';
import { ensureOpenPhoneColumns } from '../utils/database-helpers';
import { insertOpenPhoneConversation, updateOpenPhoneConversation } from '../utils/openphone-db-helpers';
import { hubspotService } from '../services/hubspotService';
import { aiAutomationService } from '../services/aiAutomationService';
import { patternLearningService } from '../services/patternLearningService';
import { patternSafetyService } from '../services/patternSafetyService';

const router = Router();

// Verify OpenPhone webhook signature
function verifyOpenPhoneSignature(payload: string, signature: string, secret: string): boolean {
  try {
    // CRITICAL FIX: The webhook secret from Railway is base64 encoded
    // We need to decode it first before using it for HMAC
    const decodedSecret = Buffer.from(secret, 'base64').toString('utf8');

    // Generate expected signature with decoded secret
    const expectedSignature = crypto
      .createHmac('sha256', decodedSecret)
      .update(payload)
      .digest('hex');

    // OpenPhone might send the signature in different formats
    // Try hex comparison first
    if (signature.toLowerCase() === expectedSignature.toLowerCase()) {
      return true;
    }

    // Try base64 comparison
    const expectedSignatureBase64 = crypto
      .createHmac('sha256', decodedSecret)
      .update(payload)
      .digest('base64');

    if (signature === expectedSignatureBase64) {
      return true;
    }

    // Also try with the raw secret (fallback for backward compatibility)
    const fallbackSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (signature.toLowerCase() === fallbackSignature.toLowerCase()) {
      return true;
    }

    // Log mismatch for debugging
    logger.warn('OpenPhone signature mismatch', {
      receivedSignature: signature.substring(0, 20) + '...',
      expectedHex: expectedSignature.substring(0, 20) + '...',
      expectedBase64: expectedSignatureBase64.substring(0, 20) + '...',
      fallbackHex: fallbackSignature.substring(0, 20) + '...',
      secretIsBase64: secret.match(/^[A-Za-z0-9+/]+=*$/) !== null
    });

    return false;
  } catch (error) {
    logger.error('Error verifying OpenPhone signature', error);
    return false;
  }
}

// Debug endpoint to capture raw webhook data
router.post('/webhook-debug', async (req: Request, res: Response) => {
  logger.info('=== RAW OPENPHONE WEBHOOK DEBUG ===', {
    headers: req.headers,
    bodyKeys: Object.keys(req.body || {}),
    body: JSON.stringify(req.body, null, 2).substring(0, 3000)
  });
  
  logger.debug('=== RAW WEBHOOK BODY ===');
  logger.debug(JSON.stringify(req.body, null, 2));
  
  res.status(200).json({ received: true, debug: true });
});

// Handle GET requests for webhook verification
router.get('/webhook', async (req: Request, res: Response) => {
  logger.info('OpenPhone webhook verification request received', {
    query: req.query,
    headers: req.headers
  });

  // OpenPhone may send a verification challenge
  if (req.query.challenge) {
    return res.status(200).send(req.query.challenge);
  }

  // Default response for GET requests
  res.status(200).json({
    status: 'ok',
    message: 'OpenPhone webhook endpoint ready'
  });
});

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
        logger.warn('Invalid OpenPhone webhook signature - ALLOWING FOR DEBUG', {
          hasRawBody: !!rawBody,
          rawBodyLength: rawBody?.length,
          signatureLength: signature?.length,
          webhookSecretLength: webhookSecret?.length,
          secretFormat: webhookSecret?.match(/^[A-Za-z0-9+/]+=*$/) ? 'base64' : 'plain',
          headers: req.headers,
          bodyPreview: JSON.stringify(req.body).substring(0, 200)
        });
        // TEMPORARILY DISABLED for debugging - OpenPhone might not be sending signatures correctly
        // return res.status(401).json({ error: 'Invalid signature' });
      }
    } else {
      logger.info('OpenPhone webhook NO SIGNATURE - allowing for debug', {
        hasWebhookSecret: !!webhookSecret,
        hasSignature: !!signature,
        headers: req.headers,
        bodyPreview: JSON.stringify(req.body).substring(0, 200)
      });
    }

    // CRITICAL FIX: Handle wrapped webhook structure from OpenPhone v3
    // OpenPhone sends: { object: { type, data } }
    // We need to unwrap this structure
    logger.info('Webhook received - checking structure', {
      hasObject: !!req.body.object,
      bodyKeys: Object.keys(req.body),
      objectKeys: req.body.object ? Object.keys(req.body.object) : [],
      headers: {
        'x-openphone-signature': !!req.headers['x-openphone-signature'],
        'x-openphone-delivery-attempt': req.headers['x-openphone-delivery-attempt'],
        'x-openphone-webhook-id': req.headers['x-openphone-webhook-id']
      }
    });
    
    // Handle OpenPhone v3 webhook structure
    // The entire webhook is wrapped in an "object" field
    let webhookData = req.body;
    let type, data;

    // Check if this is the v3 wrapped format with triple nesting
    // Format: { object: { type, data: { object: {...} } } }
    if (req.body.object && req.body.object.type) {
      // V3 format detected
      type = req.body.object.type;

      // Check if data contains another nested object
      if (req.body.object.data && req.body.object.data.object) {
        // Triple nested: { object: { type, data: { object: {...} } } }
        data = req.body.object.data.object;
        logger.info('OpenPhone V3 triple-nested webhook detected', {
          type,
          hasNestedObject: true,
          messageId: data.id
        });
      } else if (req.body.object.data) {
        // Double nested: { object: { type, data: {...} } }
        data = req.body.object.data;
      } else {
        // Data is directly in object
        data = req.body.object;
      }
    } else if (req.body.type) {
      // Direct format: { type, data, ... }
      type = req.body.type;
      data = req.body.data || req.body;
    } else {
      logger.warn('Unknown webhook format', { body: req.body });
      return res.status(200).json({ received: true });
    }
    
    // Enhanced logging for debugging webhook payloads
    logger.info('OpenPhone webhook received - FULL DETAILS', {
      type,
      eventType: type, // Explicit event type
      hasDirection: !!data.direction,
      directionValue: data.direction,
      hasStatus: !!data.status,
      statusValue: data.status,
      from: data.from,
      to: data.to,
      bodyPreview: (data.body || data.text || '').substring(0, 50),
      allFields: Object.keys(data || {}),
      isDeliveredEvent: type === 'message.delivered',
      isReceivedEvent: type === 'message.received',
      rawBody: JSON.stringify(req.body).substring(0, 500),
      headers: req.headers,
      hasWrappedObject: !!req.body.object
    });

    // Special logging for message.delivered events to debug operator messages
    if (type === 'message.delivered') {
      logger.info('🔍 MESSAGE.DELIVERED EVENT DETAILS', {
        type,
        from: data.from,
        to: data.to,
        toType: typeof data.to,
        toIsArray: Array.isArray(data.to),
        toContent: JSON.stringify(data.to),
        body: (data.body || data.text || '').substring(0, 100),
        direction: data.direction,
        status: data.status,
        userId: data.userId,
        userName: data.userName,
        phoneNumberId: data.phoneNumberId,
        allDataKeys: Object.keys(data || {}),
        timestamp: new Date().toISOString()
      });
      logger.debug('📤 OPERATOR MESSAGE DELIVERED:', {
        from: data.from,
        to: data.to,
        text: (data.body || data.text || '').substring(0, 50)
      });
    }

    logger.debug('OPENPHONE WEBHOOK [v2]:', JSON.stringify({ type, data }, null, 2));

    // Handle different webhook types
    switch (type) {
      case 'message.created':
      case 'message.sent':      // Handle outbound messages sent from OpenPhone
      case 'message.received':
      case 'message.delivered':
      case 'message.updated':
      case 'conversation.updated':
        // The message data might be nested in data.object for some webhook versions
        let messageData = data || {};
        
        // Check if the actual message data is nested inside a data.object property
        if (data && data.object && (data.object.from || data.object.to || data.object.body)) {
          messageData = data.object;
        }
        
        // Debug log the entire messageData structure
        logger.info('Message data structure:', {
          hasDirection: !!messageData.direction,
          hasFrom: !!messageData.from,
          hasTo: !!messageData.to,
          hasBody: !!messageData.body,
          hasText: !!messageData.text,
          messageDataKeys: Object.keys(messageData).slice(0, 20), // First 20 keys
          sampleData: JSON.stringify(messageData).substring(0, 500)
        });
        
        // Determine if message is outbound based on event type and fields
        let isOutbound = false;
        let messageDirection = messageData.direction;

        // message.delivered events are ALWAYS outbound (operator sent them)
        // message.received events are ALWAYS inbound (customer sent them)
        if (type === 'message.delivered' || type === 'message.sent') {
          isOutbound = true;
          messageDirection = 'outbound';
        } else if (type === 'message.received') {
          isOutbound = false;
          messageDirection = 'inbound';
        } else if (messageData.direction) {
          // Fallback to direction field if present (for message.created events)
          isOutbound = messageData.direction === 'outgoing' || messageData.direction === 'outbound';
          messageDirection = isOutbound ? 'outbound' : 'inbound';
        } else {
          // Default to inbound if we can't determine
          isOutbound = false;
          messageDirection = 'inbound';
        }

        // Extract phone number based on determined direction
        let phoneNumber;
        if (!isOutbound) {
          // For incoming messages, the customer is the sender
          phoneNumber = messageData.from;
        } else {
          // For outgoing messages, the customer is the recipient
          // Handle various formats OpenPhone might send for 'to' field
          if (Array.isArray(messageData.to)) {
            // Array format: ["phoneNumber"] or [{phoneNumber: "..."}]
            phoneNumber = typeof messageData.to[0] === 'string'
              ? messageData.to[0]
              : messageData.to[0]?.phoneNumber || messageData.to[0]?.number;
          } else if (typeof messageData.to === 'string') {
            // Simple string format
            phoneNumber = messageData.to;
          } else if (messageData.to && typeof messageData.to === 'object') {
            // Object format: {phoneNumber: "..."} or {number: "..."}
            phoneNumber = messageData.to.phoneNumber || messageData.to.number || messageData.to.to;
          }

          // Special handling for message.delivered events
          if (type === 'message.delivered' && !phoneNumber) {
            logger.warn('Failed to extract phone number from message.delivered event', {
              to: messageData.to,
              toType: typeof messageData.to,
              toKeys: messageData.to ? Object.keys(messageData.to) : []
            });
          }
        }
        
        // Fallback to other fields if needed
        phoneNumber = phoneNumber || 
                     messageData.phoneNumber || 
                     messageData.phone ||
                     messageData.conversationPhoneNumber ||
                     messageData.participant?.phoneNumber;
        
        // If still no phone number, try to extract from conversation or participants
        if (!phoneNumber && messageData.conversation) {
          phoneNumber = messageData.conversation.phoneNumber || 
                       messageData.conversation.participant?.phoneNumber;
        }
        
        // Log extraction for debugging
        logger.info('Phone number extraction:', {
          direction: messageData.direction,
          from: messageData.from,
          to: messageData.to,
          extracted: phoneNumber,
          allFields: {
            phoneNumber: messageData.phoneNumber,
            phone: messageData.phone,
            conversationPhoneNumber: messageData.conversationPhoneNumber,
            participantPhone: messageData.participant?.phoneNumber
          }
        });
        
        // Log the webhook data structure to understand what fields are available
        logger.info('OpenPhone webhook data fields:', {
          hasContactName: !!messageData.contactName,
          hasDataContactName: !!data.contactName,
          hasContactObject: !!messageData.contact,
          contactFields: messageData.contact ? Object.keys(messageData.contact) : [],
          hasConversation: !!messageData.conversation,
          conversationFields: messageData.conversation ? Object.keys(messageData.conversation) : [],
          allMessageDataKeys: Object.keys(messageData || {}),
          allDataKeys: Object.keys(data || {})
        });

        // Try multiple fields for contact name, including conversation participant info
        let customerName = messageData.contactName || 
                           data.contactName || 
                           messageData.contact?.name ||
                           messageData.contact?.firstName ||
                           messageData.contact?.lastName ||
                           messageData.contact?.displayName ||
                           data.contact?.name ||
                           data.contact?.firstName ||
                           data.contact?.lastName ||
                           data.contact?.displayName ||
                           messageData.conversation?.participant?.name ||
                           messageData.conversation?.participant?.firstName ||
                           messageData.conversation?.participant?.lastName ||
                           messageData.conversationPhoneNumberName ||
                           data.conversationPhoneNumberName ||
                           messageData.name ||
                           data.name;
        
        // Combine first and last name if available
        if (!customerName && (messageData.contact?.firstName || messageData.contact?.lastName)) {
          customerName = `${messageData.contact.firstName || ''} ${messageData.contact.lastName || ''}`.trim();
        }
        if (!customerName && (data.contact?.firstName || data.contact?.lastName)) {
          customerName = `${data.contact.firstName || ''} ${data.contact.lastName || ''}`.trim();
        }
        
        // Default to Unknown if no name found
        if (!customerName || customerName === '') {
          customerName = 'Unknown';
        }
                           
        const employeeName = messageData.userName || 
                           data.userName || 
                           messageData.user?.name ||
                           data.user?.name ||
                           'Unknown';

        // HubSpot lookup for ALL messages to get real customer name (not just inbound)
        // This ensures we get names for all contacts that exist in HubSpot
        if (phoneNumber && customerName === 'Unknown') {
          try {
            const hubspotContact = await hubspotService.searchByPhone(phoneNumber);
            if (hubspotContact && hubspotContact.name && hubspotContact.name !== 'Unknown') {
              customerName = hubspotContact.name;
              logger.info('HubSpot contact found - updating customer name', {
                phoneNumber,
                previousName: 'Unknown',
                newName: hubspotContact.name,
                company: hubspotContact.company
              });
            } else {
              logger.debug('No HubSpot contact found for phone:', phoneNumber);
            }
          } catch (hubspotError) {
            // Log but don't fail the webhook
            logger.warn('HubSpot lookup failed during webhook:', hubspotError);
          }
        }
        
        // Use phone number as primary identifier for time-based grouping
        if (!phoneNumber || phoneNumber === 'Unknown') {
          logger.error('Failed to extract phone number from webhook', { 
            type, 
            messageDataKeys: Object.keys(messageData),
            direction: messageData.direction,
            from: messageData.from,
            to: messageData.to,
            fullWebhook: JSON.stringify(req.body).substring(0, 2000),
            dataStructure: JSON.stringify(data).substring(0, 1000)
          });
          // Don't break - still try to process with 'Unknown' to not lose messages
          phoneNumber = phoneNumber || 'Unknown';
        }
        
        // Log what we're about to save
        logger.info('Preparing to save conversation data:', {
          phoneNumber,
          customerName,
          employeeName,
          originalDirection: messageData.direction,
          determinedDirection: messageDirection,
          isOutbound: isOutbound,
          eventType: type,
          hasMessageBody: !!messageData.body || !!messageData.text,
          from: messageData.from,
          to: messageData.to,
          messageId: messageData.id
        });

        // Special logging for outbound message processing
        if (isOutbound && type === 'message.delivered') {
          logger.info('📤 PROCESSING OUTBOUND MESSAGE (message.delivered)', {
            phoneNumber,
            from: messageData.from,
            to: messageData.to,
            direction: messageDirection,
            messagePreview: (messageData.body || messageData.text || '').substring(0, 50),
            willStoreTo: phoneNumber,
            timestamp: new Date().toISOString()
          });
        }
        
        // Build message object (body is the field from webhook)
        const newMessage = {
          id: messageData.id,
          type: type,
          from: messageData.from,
          to: messageData.to, // Keep original format
          text: messageData.body || messageData.text || '', // body is primary field
          body: messageData.body || messageData.text || '', // Keep both for compatibility
          direction: messageDirection, // Use our determined direction from event type
          createdAt: messageData.createdAt || new Date().toISOString(),
          media: messageData.media || [],
          status: messageData.status,
          conversationId: messageData.conversationId
        };

        // Use phone number as the consistent conversation ID (moved up to fix reference)
        const conversationId = `conv_${phoneNumber.replace(/[^0-9]/g, '')}`;

        // CHECK FOR OPERATOR ACTIVITY (outbound messages without ClubAI signature)
        if (newMessage.direction === 'outbound' &&
            !newMessage.text.includes('- ClubAI') &&
            !newMessage.text.includes('-ClubAI')) {

          logger.info('[Operator] Detected operator message, marking conversation as operator-handled', {
            phoneNumber,
            messagePreview: newMessage.text.substring(0, 50)
          });

          // Mark operator as active in conversation
          await db.query(`
            UPDATE openphone_conversations
            SET operator_active = true,
                operator_last_message = NOW(),
                conversation_locked = true,
                lockout_until = NOW() + INTERVAL '4 hours'
            WHERE phone_number = $1`,
            [phoneNumber]
          );

          // Track operator intervention (skip if table doesn't exist)
          try {
            await db.query(`
              INSERT INTO operator_interventions
              (phone_number, conversation_id, operator_id, intervention_type, message_sent, created_at)
              VALUES ($1, $2, NULL, 'manual_response', $3, NOW())`,
              [phoneNumber, conversationId, newMessage.text]
            );
          } catch (error: any) {
            // Table might not exist - log but don't fail
            if (error.code === '42P01') {
              logger.warn('operator_interventions table does not exist - skipping tracking');
            } else {
              logger.error('Failed to track operator intervention:', error);
            }
          }

          // LEARNING: Capture operator response as a learning example
          // Look for the last customer message to learn from
          const lastCustomerMessage = await db.query(`
            SELECT message_text, pattern_id
            FROM conversation_messages
            WHERE conversation_id = $1
            AND sender_type = 'customer'
            ORDER BY created_at DESC
            LIMIT 1`,
            [conversationId]
          );

          if (lastCustomerMessage.rows.length > 0) {
            const customerMsg = lastCustomerMessage.rows[0].message_text;
            const patternId = lastCustomerMessage.rows[0].pattern_id;

            // Store this as a learning example
            await patternLearningService.recordOperatorResponse(
              customerMsg,
              newMessage.text,
              phoneNumber,
              patternId
            );

            logger.info('[Learning] Captured operator response for pattern learning', {
              customerMessage: customerMsg.substring(0, 50),
              operatorResponse: newMessage.text.substring(0, 50),
              patternId
            });
          }
        }

        // Determine conversation window based on message content
        const getConversationWindow = (text: string): number => {
          if (/book|reservation|tee\s+time|schedule|appointment/i.test(text)) {
            return 240; // 4 hours for bookings
          }
          if (/broken|stuck|frozen|not\s+working|issue|problem|help/i.test(text)) {
            return 120; // 2 hours for tech support
          }
          return 60; // 1 hour default
        };

        const conversationWindowMinutes = getConversationWindow(newMessage.text);

        // Check if we have an existing conversation for this phone number
        const existingConv = await db.query(`
          SELECT id, messages, conversation_id, created_at, updated_at,
            operator_active, operator_last_message, conversation_locked, lockout_until,
            rapid_message_count, ai_response_count,
            CASE
              WHEN jsonb_array_length(messages) > 0
              THEN EXTRACT(EPOCH FROM (NOW() - (messages->-1->>'createdAt')::timestamp)) / 60
              ELSE EXTRACT(EPOCH FROM (NOW() - created_at)) / 60
            END as minutes_since_last_message
          FROM openphone_conversations
          WHERE phone_number = $1
          ORDER BY updated_at DESC
          LIMIT 1
        `, [phoneNumber]);
        
        // Group messages within 1-hour timeframe from last message
        const ONE_HOUR_IN_MINUTES = 60;
        
        if (existingConv.rows.length > 0 && existingConv.rows[0].minutes_since_last_message < ONE_HOUR_IN_MINUTES) {
          // Within 1 hour of last message - append to existing conversation
          const existingMessages = existingConv.rows[0].messages || [];
          
          // Enhanced deduplication: Check by ID or by content+timestamp for recently sent messages
          const messageAlreadyExists = existingMessages.some(msg => {
            // Check by ID first (most reliable)
            if (msg.id && messageData.id && msg.id === messageData.id) {
              return true;
            }

            // For outbound messages sent in last 5 seconds, check by content
            // This handles the case where we send via API and webhook arrives quickly
            if (newMessage.direction === 'outbound' && msg.direction === 'outbound') {
              const msgTime = new Date(msg.createdAt || msg.timestamp || 0).getTime();
              const newMsgTime = new Date(newMessage.createdAt).getTime();
              const timeDiff = Math.abs(newMsgTime - msgTime);

              // If same content and within 5 seconds, it's likely a duplicate
              if (timeDiff < 5000 && msg.body === newMessage.body) {
                return true;
              }
            }

            return false;
          });

          if (messageAlreadyExists) {
            logger.info('Duplicate message detected, skipping', {
              messageId: messageData.id,
              phoneNumber,
              direction: messageData.direction,
              body: newMessage.body.substring(0, 50)
            });
            return res.json({ success: true, message: 'Duplicate message ignored' });
          }
          
          const updatedMessages = [...existingMessages, newMessage];
          
          // Update conversation and increment unread count if inbound
          // FIX: Use our determined direction, not the raw webhook data
          const unreadIncrement = (messageDirection === 'inbound') ? 1 : 0;
          
          // Calculate new unread count
          const currentUnreadCount = existingConv.rows[0].unread_count || 0;
          const newUnreadCount = currentUnreadCount + unreadIncrement;
          
          // Update using the actual database ID
          await db.query(`
            UPDATE openphone_conversations
            SET messages = $1,
                unread_count = $2,
                customer_name = $3,
                employee_name = $4,
                updated_at = NOW()
            WHERE id = $5
          `, [JSON.stringify(updatedMessages), newUnreadCount, customerName, employeeName, existingConv.rows[0].id]);
          
          logger.info('OpenPhone message appended to existing conversation', { 
            conversationId,
            phoneNumber,
            messageCount: updatedMessages.length,
            direction: messageData.direction,
            minutesSinceLastMessage: Math.round(existingConv.rows[0].minutes_since_last_message)
          });
          
          // Send push notification for inbound messages
          // FIX: Use our determined direction, not the raw webhook data
          if (messageDirection === 'inbound') {
            try {
              // Get all users with admin, operator, or support roles
              const users = await db.query(
                `SELECT id FROM users
                 WHERE role IN ('admin', 'operator', 'support')
                 AND is_active = true`
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
                vibrate: [200, 100, 200, 100, 200], // Enhanced vibration pattern
                sound: 'default',
                actions: [
                  { action: 'view-message', title: 'View' },
                  { action: 'mark-read', title: 'Mark Read' }
                ],
                requireInteraction: true, // Keep notification visible
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

              // SAFEGUARD: Check if operator is active or conversation is locked
              if (existingConv.rows[0].operator_active ||
                  existingConv.rows[0].conversation_locked ||
                  (existingConv.rows[0].lockout_until && new Date(existingConv.rows[0].lockout_until) > new Date())) {

                logger.info('[Safeguard] Skipping AI - operator is active or conversation locked', {
                  phoneNumber,
                  operatorActive: existingConv.rows[0].operator_active,
                  conversationLocked: existingConv.rows[0].conversation_locked,
                  lockoutUntil: existingConv.rows[0].lockout_until
                });

                return res.json({ success: true, message: 'Operator handling conversation' });
              }

              // SAFEGUARD: Check if AI response limit reached (max 3)
              if (existingConv.rows[0].ai_response_count && existingConv.rows[0].ai_response_count >= 3) {
                logger.info('[Safeguard] Max AI responses reached, escalating to human', {
                  phoneNumber,
                  responseCount: existingConv.rows[0].ai_response_count
                });

                const escalationMsg = "I understand you need more help than I can provide. I'm connecting you with a human operator who will assist you shortly.\n\nA member of our team will respond as soon as possible.\n\n- ClubAI";
                const defaultNumber = process.env.OPENPHONE_DEFAULT_NUMBER;

                if (defaultNumber) {
                  await openPhoneService.sendMessage(phoneNumber, defaultNumber, escalationMsg);
                }

                await db.query(`
                  UPDATE openphone_conversations
                  SET conversation_locked = true, customer_sentiment = 'escalated'
                  WHERE id = $1`, [existingConv.rows[0].id]);

                return res.json({ success: true, escalated: true, reason: 'max_responses_reached' });
              }

              // SAFEGUARD: Detect rapid messages - ONLY count CUSTOMER messages
              // FIX: Count only inbound messages (customer), never our AI responses
              const recentCustomerMessages = updatedMessages.filter((m: any) =>
                m.direction === 'inbound' && // Only customer messages
                new Date(m.createdAt) > new Date(Date.now() - 60000) // Last 60 seconds
              );

              // If 3+ rapid customer messages, escalate (conversation lock above prevents duplicates)
              if (recentCustomerMessages.length >= 3) {
                logger.warn('[Safeguard] Multiple rapid CUSTOMER messages detected - escalating', {
                  phoneNumber,
                  customerMessageCount: recentCustomerMessages.length
                });

                // Send escalation message
                const defaultNumber = process.env.OPENPHONE_DEFAULT_NUMBER;
                if (defaultNumber) {
                  await openPhoneService.sendMessage(
                    phoneNumber,
                    defaultNumber,
                    `I notice you've sent multiple messages. Let me connect you with a human operator who can better assist you.\n\nOur team will respond shortly.\n\n- ClubAI`
                  );
                }

                // Lock conversation to prevent any further AI responses
                await db.query(`
                  UPDATE openphone_conversations
                  SET conversation_locked = true,
                      customer_sentiment = 'escalated',
                      rapid_message_count = $2
                  WHERE id = $1`,
                  [existingConv.rows[0].id, recentCustomerMessages.length]
                );

                return res.json({ success: true, message: 'Escalated due to rapid messages' });
              }

              // Process with V3-PLS FIRST (unified pattern system), then AI automations as fallback
              const messageText = messageData.body || messageData.text || '';

              // SAFEGUARD: Check for negative sentiment BEFORE pattern processing
              const safetyCheck = await patternSafetyService.checkMessageSafety(
                messageText,
                existingConv.rows[0].id,
                phoneNumber
              );

              if (!safetyCheck.safe && safetyCheck.alertType === 'escalation') {
                logger.info('[Safeguard] Negative sentiment detected, escalating to human', {
                  phoneNumber,
                  triggeredKeywords: safetyCheck.triggeredKeywords
                });

                const defaultNumber = process.env.OPENPHONE_DEFAULT_NUMBER;
                if (defaultNumber && safetyCheck.suggestedResponse) {
                  await openPhoneService.sendMessage(phoneNumber, defaultNumber, safetyCheck.suggestedResponse);
                }

                await db.query(`
                  UPDATE openphone_conversations
                  SET conversation_locked = true, customer_sentiment = 'escalated'
                  WHERE id = $1`, [existingConv.rows[0].id]);

                return res.json({ success: true, escalated: true, reason: 'negative_sentiment' });
              }

              // FIRST: Try V3-PLS Pattern Learning System
              try {
                const patternResult = await patternLearningService.processMessage(
                  messageText,
                  phoneNumber,
                  existingConv.rows[0].id,
                  customerName
                );
                
                // Store message in conversation history
                await db.query(`
                  INSERT INTO conversation_messages 
                  (conversation_id, sender_type, message_text, pattern_id, pattern_confidence, ai_reasoning)
                  VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                  existingConv.rows[0].id,
                  'customer',
                  messageText,
                  patternResult.patternId || null,
                  patternResult.confidence || null,
                  patternResult.reasoning ? JSON.stringify(patternResult.reasoning) : null
                ]);
                
                // Handle pattern result based on action
                if (patternResult.action === 'auto_execute' && patternResult.response) {
                  logger.info('[Pattern Learning] AUTO-EXECUTING', {
                    confidence: patternResult.confidence,
                    pattern: patternResult.pattern?.pattern_type,
                    reasoning: patternResult.reasoning?.thought_process
                  });

                  // Send automated response
                  const defaultNumber = process.env.OPENPHONE_DEFAULT_NUMBER;
                  if (defaultNumber) {
                    await openPhoneService.sendMessage(
                      phoneNumber,
                      defaultNumber,
                      patternResult.response
                    );

                    // Store AI response in history
                    await db.query(`
                      INSERT INTO conversation_messages
                      (conversation_id, sender_type, message_text, pattern_id)
                      VALUES ($1, 'ai', $2, $3)
                    `, [existingConv.rows[0].id, patternResult.response, patternResult.patternId]);
                  }

                  // Pattern handled it, we're done
                  return res.json({ success: true, message: 'V3-PLS pattern handled' });
                } else if (patternResult.action === 'suggest' || patternResult.action === 'queue') {
                  logger.info('[Pattern Learning] SUGGESTION READY', {
                    action: patternResult.action,
                    confidence: patternResult.confidence,
                    pattern: patternResult.pattern?.pattern_type
                  });
                  
                  // Store suggestion for operator review (both 'suggest' and 'queue' actions)
                  try {
                    await db.query(`
                      INSERT INTO pattern_suggestions_queue 
                      (conversation_id, approved_pattern_id, pattern_type, trigger_text, suggested_response, 
                       confidence_score, reasoning, phone_number, status, created_at)
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
                    `, [
                      existingConv.rows[0].id,
                      patternResult.patternId || null,  // Add null safety
                      patternResult.pattern?.pattern_type || 'general',
                      messageText,
                      patternResult.response || '',  // Ensure response is not null
                      patternResult.confidence || 0,
                      JSON.stringify(patternResult.reasoning || {}),
                      phoneNumber
                    ]);
                    logger.info('[Pattern Learning] Suggestion queued successfully', {
                      conversationId: existingConv.rows[0].id,
                      patternId: patternResult.patternId
                    });
                  } catch (queueError) {
                    logger.error('[Pattern Learning] Failed to queue suggestion', {
                      error: queueError,
                      conversationId: existingConv.rows[0].id,
                      patternId: patternResult.patternId
                    });
                    // Don't fail the webhook - just log the error
                  }
                } else if (patternResult.action === 'escalate') {
                  // Handle escalation from pattern learning
                  logger.info('[Pattern Learning] Escalating to human', {
                    reason: patternResult.reason,
                    phoneNumber
                  });

                  const escalationMsg = "I see you're still having trouble. Let me connect you with one of our team members who can help you directly. Someone will be with you shortly.\n\n- ClubAI";
                  const defaultNumber = process.env.OPENPHONE_DEFAULT_NUMBER;

                  if (defaultNumber) {
                    await openPhoneService.sendMessage(phoneNumber, defaultNumber, escalationMsg);
                  }

                  await db.query(`
                    UPDATE openphone_conversations
                    SET conversation_locked = true, customer_sentiment = 'escalated'
                    WHERE id = $1`, [existingConv.rows[0].id]);

                  return res.json({ success: true, escalated: true, reason: patternResult.reason });
                } else {
                  logger.info('[Pattern Learning] Result:', {
                    action: patternResult.action,
                    confidence: patternResult.confidence,
                    reason: patternResult.reason
                  });
                }
                
                // Update conversation with pattern info
                const assistantType = patternResult.pattern?.pattern_type || 'general';
                await db.query(`
                  UPDATE openphone_conversations
                  SET last_assistant_type = $1,
                      assistant_type = COALESCE(assistant_type, $1)
                  WHERE id = $2
                `, [assistantType, existingConv.rows[0].id]);
                
              } catch (err) {
                logger.error('[Pattern Learning] Error:', err);
              }

              // FALLBACK: If V3-PLS didn't auto-execute, try AI Automation Service
              // This preserves existing working patterns (gift cards, trackman) while we migrate
              try {
                const automationResponse = await aiAutomationService.processMessage(
                  phoneNumber,
                  messageText,
                  existingConv.rows[0].id,
                  false // Not initial message
                );

                if (automationResponse.handled && automationResponse.response) {
                  logger.info('[AI Automation] Fallback response for existing conversation', {
                    phoneNumber,
                    response: automationResponse.response.substring(0, 100)
                  });

                  const defaultNumber = process.env.OPENPHONE_DEFAULT_NUMBER;
                  if (defaultNumber) {
                    await openPhoneService.sendMessage(
                      phoneNumber,
                      defaultNumber,
                      automationResponse.response
                    );
                  }

                  // AI automation handled it as fallback
                  return res.json({ success: true, message: 'AI automation fallback handled' });
                }
              } catch (automationError) {
                logger.error('AI automation fallback error:', automationError);
              }
            } catch (notifError) {
              // Don't fail webhook if notification fails
              logger.error('Failed to send push notification:', notifError);
            }
          } else if (messageDirection === 'outbound') {
            // PATTERN LEARNING: Learn from operator responses
            try {
              // Get the last inbound message to learn the pattern
              const lastInboundMsg = updatedMessages
                .filter(msg => msg.direction === 'inbound')
                .slice(-1)[0];
              
              if (lastInboundMsg) {
                const operatorResponse = messageData.body || messageData.text || '';
                
                // Only learn if this appears to be a human operator response
                // (not an automated response from ClubOS)
                const isHumanResponse = !operatorResponse.includes('[Automated Response]') &&
                                       !operatorResponse.includes('🤖');
                
                if (isHumanResponse) {
                  await patternLearningService.learnFromHumanResponse(
                    lastInboundMsg.text || lastInboundMsg.body,
                    operatorResponse,
                    [], // TODO: Extract any actions taken
                    existingConv.rows[0].id,
                    phoneNumber,
                    undefined // We don't know which operator sent via OpenPhone
                  );
                  
                  logger.info('[Pattern Learning] Learned from OpenPhone operator response', {
                    conversationId: existingConv.rows[0].id,
                    phoneNumber,
                    responseLength: operatorResponse.length
                  });
                }
              }
            } catch (learningError) {
              logger.error('[Pattern Learning] Failed to learn from outbound message:', learningError);
            }
          }
          
          break;
        }
        
        // Create new conversation (either first message or > 1 hour gap)
        // But first check if this exact message was already processed in a recent conversation
        // (in case of webhook retries that arrive after the 1-hour window)
        if (existingConv.rows.length > 0) {
          const existingMessages = existingConv.rows[0].messages || [];
          const messageAlreadyExists = existingMessages.some(msg => msg.id === messageData.id);
          
          if (messageAlreadyExists) {
            logger.info('Duplicate message detected in recent conversation, skipping', {
              messageId: messageData.id,
              phoneNumber,
              direction: messageData.direction,
              minutesSinceLastMessage: Math.round(existingConv.rows[0].minutes_since_last_message)
            });
            return res.json({ success: true, message: 'Duplicate message ignored' });
          }
        }
        
        // Add timestamp to conversation ID to make it unique for time-based splits
        const timestamp = Date.now();
        const newConversationId = `conv_${phoneNumber.replace(/[^0-9]/g, '')}_${timestamp}`;
        // FIX: Use our determined direction, not the raw webhook data
        const initialUnreadCount = (messageDirection === 'inbound') ? 1 : 0;
        
        // Determine assistant type for new conversation
        const messageText = messageData.body || messageData.text || '';
        const assistantType = aiAutomationService.getAssistantType(messageText);
        
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
          unreadCount: initialUnreadCount,
          assistantType,
          lastAssistantType: assistantType
        });
        
        // Log why we created a new conversation
        const reason = existingConv.rows.length === 0 
          ? 'first message from customer' 
          : `${Math.round(existingConv.rows[0].minutes_since_last_message)} minutes since last message (> 1 hour)`;
        
        logger.info('OpenPhone new conversation created', { 
          conversationId: newConversationId, 
          phoneNumber,
          reason,
          assistantType
        });
        
        // Send push notification for new inbound conversation
        // FIX: Use our determined direction, not the raw webhook data
        if (messageDirection === 'inbound') {
          try {
            const users = await db.query(
              `SELECT id FROM users 
               WHERE role IN ('admin', 'operator', 'support') 
               AND is_active = true`
            );
            
            const userIds = users.rows.map(u => u.id);
            
            await notificationService.sendToUsers(userIds, {
              title: `New conversation from ${customerName}`,
              body: (messageData.body || messageData.text || '').substring(0, 100) + 
                    (messageData.body?.length > 100 ? '...' : ''),
              icon: '/logo-192.png',
              badge: '/badge-72.png',
              tag: `message-${phoneNumber}`,
              vibrate: [200, 100, 200, 100, 200], // Enhanced vibration pattern
              sound: 'default',
              actions: [
                { action: 'view-message', title: 'View' },
                { action: 'mark-read', title: 'Mark Read' }
              ],
              requireInteraction: true, // Keep notification visible
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
            
            // Process AI automations for new inbound conversation
            const messageText = messageData.body || messageData.text || '';
            const automationResponse = await aiAutomationService.processMessage(
              phoneNumber, 
              messageText,
              newConversationId,
              true // This is an initial message
            );
            
            // PATTERN LEARNING: Process new conversation message
            try {
              const patternResult = await patternLearningService.processMessage(
                messageText,
                phoneNumber,
                newConversationId,
                customerName
              );
              
              // Handle pattern result based on action
              if (patternResult.action === 'auto_execute' && patternResult.response) {
                logger.info('[Pattern Learning] AUTO-EXECUTING (new conv)', {
                  confidence: patternResult.confidence,
                  pattern: patternResult.pattern?.pattern_type
                });
                
                // Send automated response
                const defaultNumber = process.env.OPENPHONE_DEFAULT_NUMBER;
                if (defaultNumber) {
                  await openPhoneService.sendMessage(
                    phoneNumber,
                    defaultNumber,
                    patternResult.response
                  );
                }
              } else if (patternResult.action === 'suggest' || patternResult.action === 'queue') {
                logger.info('[Pattern Learning] SUGGESTION READY (new conv)', {
                  action: patternResult.action,
                  confidence: patternResult.confidence,
                  pattern: patternResult.pattern?.pattern_type
                });
                
                // Store suggestion for operator review
                try {
                  await db.query(`
                    INSERT INTO pattern_suggestions_queue 
                    (conversation_id, approved_pattern_id, pattern_type, trigger_text, suggested_response, 
                     confidence_score, reasoning, phone_number, status, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
                  `, [
                    newConversationId,
                    patternResult.patternId || null,  // Add null safety
                    patternResult.pattern?.pattern_type || 'general',
                    messageText,
                    patternResult.response || '',  // Ensure response is not null
                    patternResult.confidence || 0,
                    JSON.stringify(patternResult.reasoning || {}),
                    phoneNumber
                  ]);
                  logger.info('[Pattern Learning] Suggestion queued successfully (new conv)', {
                    conversationId: newConversationId,
                    patternId: patternResult.patternId
                  });
                } catch (queueError) {
                  logger.error('[Pattern Learning] Failed to queue suggestion (new conv)', {
                    error: queueError,
                    conversationId: newConversationId,
                    patternId: patternResult.patternId
                  });
                  // Don't fail the webhook - just log the error
                }
              } else if (patternResult.action === 'shadow') {
                logger.info('[Pattern Learning] SHADOW MODE (new conv)', {
                  confidence: patternResult.confidence,
                  pattern: patternResult.pattern?.pattern_type
                });
              } else {
                logger.info('[Pattern Learning] Result (new conv):', {
                  action: patternResult.action,
                  confidence: patternResult.confidence,
                  reason: patternResult.reason
                });
              }
            } catch (err) {
              logger.error('[Pattern Learning] Error (new conv):', err);
            }
            
            if (automationResponse.handled && automationResponse.response) {
              // Send automated response
              logger.info('Sending automated response for new conversation', {
                phoneNumber,
                response: automationResponse.response.substring(0, 100)
              });
              
              const defaultNumber = process.env.OPENPHONE_DEFAULT_NUMBER;
              if (defaultNumber) {
                await openPhoneService.sendMessage(
                  phoneNumber,
                  defaultNumber,
                  automationResponse.response
                );
              }
            }
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
          
          // Update using the actual database ID
          await db.query(`
            UPDATE openphone_conversations
            SET messages = $1,
                customer_name = $2,
                employee_name = $3,
                updated_at = NOW()
            WHERE id = $4
          `, [JSON.stringify(messages), data.contactName || callPhoneNumber, data.userName || 'Unknown', existingCallConv.rows[0].id]);
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
  logger.debug('WEBHOOK TEST RECEIVED:', JSON.stringify(req.body, null, 2));
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
  
  logger.debug('WEBHOOK ANALYSIS:', JSON.stringify(analysis, null, 2));
  
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

// Manual sync endpoint for customer names
router.post('/sync-names', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (phoneNumber) {
      // Sync specific phone number
      const { customerNameSyncService } = await import('../services/syncCustomerNames');
      const success = await customerNameSyncService.syncPhoneNumber(phoneNumber);
      
      res.json({
        success,
        message: success ? `Name synced for ${phoneNumber}` : `No HubSpot contact found for ${phoneNumber}`
      });
    } else {
      // Trigger full sync
      const { customerNameSyncService } = await import('../services/syncCustomerNames');
      customerNameSyncService.syncCustomerNames();
      
      res.json({
        success: true,
        message: 'Full name sync started in background'
      });
    }
  } catch (error: any) {
    logger.error('Name sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;