import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../../services/cacheService';

/**
 * Unified Messages API
 * Consolidates duplicate endpoints from:
 * - messages.ts
 * - openphone.ts
 * - openphone-v3.ts
 * - openphone-processing.ts
 */

const router = Router();

// Get all conversations (with caching)
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const cacheKey = CACHE_KEYS.CONVERSATIONS_RECENT;

    const conversations = await cacheService.getOrSet(
      cacheKey,
      async () => {
        // Fetch from database
        const { query } = require('../../utils/db');
        const result = await query(`
          SELECT DISTINCT ON (customer_phone_number)
            *,
            (SELECT COUNT(*) FROM openphone_messages om
             WHERE om.conversation_id = oc.conversation_id) as message_count
          FROM openphone_conversations oc
          ORDER BY customer_phone_number, created_at DESC
          LIMIT 100
        `);
        return result.rows;
      },
      { ttl: CACHE_TTL.SHORT }
    );

    res.json(conversations);
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get conversation by phone number (with caching)
router.get('/conversation/:phone', async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    const cacheKey = CACHE_KEYS.CONVERSATION_BY_PHONE(phone);

    const conversation = await cacheService.getOrSet(
      cacheKey,
      async () => {
        const { query } = require('../../utils/db');
        const result = await query(`
          SELECT * FROM openphone_conversations
          WHERE customer_phone_number = $1
          ORDER BY created_at DESC
        `, [phone]);

        const messages = await query(`
          SELECT * FROM openphone_messages
          WHERE conversation_id = ANY($1::text[])
          ORDER BY created_at ASC
        `, [result.rows.map(r => r.conversation_id)]);

        return {
          conversations: result.rows,
          messages: messages.rows
        };
      },
      { ttl: CACHE_TTL.SHORT }
    );

    res.json(conversation);
  } catch (error) {
    logger.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Send message (single unified endpoint)
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { to, text, conversationId } = req.body;

    if (!to || !text) {
      return res.status(400).json({ error: 'Missing required fields: to, text' });
    }

    // Invalidate cache for this conversation
    await cacheService.delete(CACHE_KEYS.CONVERSATION_BY_PHONE(to));
    await cacheService.delete(CACHE_KEYS.CONVERSATIONS_RECENT);

    // Send via OpenPhone service
    const openphonesService = require('../../services/openphoneService');
    const result = await openphonesService.sendMessage({
      to,
      text,
      conversationId
    });

    // Log the message to database
    const { query } = require('../../utils/db');
    await query(`
      INSERT INTO openphone_messages (
        id, conversation_id, direction, from_number, to_number,
        text, created_at, status
      ) VALUES ($1, $2, 'outgoing', $3, $4, $5, NOW(), 'sent')
      RETURNING *
    `, [
      result.id || require('uuid').v4(),
      conversationId || result.conversationId,
      process.env.OPENPHONE_DEFAULT_NUMBER,
      to,
      text
    ]);

    res.json({
      success: true,
      message: result
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark messages as read
router.put('/mark-read/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;

    const { query } = require('../../utils/db');
    await query(`
      UPDATE openphone_messages
      SET is_read = true, read_at = NOW()
      WHERE conversation_id = $1 AND is_read = false
    `, [conversationId]);

    // Invalidate cache
    await cacheService.invalidatePattern(`conversation:*`);

    res.json({ success: true });
  } catch (error) {
    logger.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// Get unread count (with short cache)
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const count = await cacheService.getOrSet(
      'messages:unread:count',
      async () => {
        const { query } = require('../../utils/db');
        const result = await query(`
          SELECT COUNT(DISTINCT conversation_id) as count
          FROM openphone_messages
          WHERE is_read = false AND direction = 'incoming'
        `);
        return result.rows[0].count;
      },
      { ttl: 30 } // Very short cache for unread count
    );

    res.json({ count });
  } catch (error) {
    logger.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

export default router;