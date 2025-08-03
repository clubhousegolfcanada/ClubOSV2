/**
 * Message Handlers
 * 
 * Handles message operations including sending, receiving, and AI suggestions
 */

import { Request, Response } from 'express';
import { db } from '../../../utils/database';
import { logger } from '../../../utils/logger';
import { AppError } from '../../../middleware/errorHandler';
import { openPhoneService } from '../../../services/openphoneService';
import { messageAssistantService } from '../../../services/messageAssistantService';
import { notificationService } from '../../../services/notificationService';

/**
 * List messages with filters
 */
export async function listMessages(req: Request, res: Response) {
  const { conversationId, limit = 50, before } = req.query;

  if (!conversationId) {
    throw new AppError('conversationId is required', 400);
  }

  try {
    const conversation = await db.query(
      'SELECT messages FROM openphone_conversations WHERE conversation_id = $1',
      [conversationId]
    );

    if (conversation.rows.length === 0) {
      throw new AppError('Conversation not found', 404);
    }

    let messages = conversation.rows[0].messages || [];

    // Apply before filter if provided
    if (before) {
      const beforeDate = new Date(before as string);
      messages = messages.filter((msg: any) => 
        new Date(msg.createdAt) < beforeDate
      );
    }

    // Sort by date descending and limit
    messages = messages
      .sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, Number(limit));

    res.json({ messages });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error fetching messages:', error);
    throw new AppError('Failed to fetch messages', 500);
  }
}

/**
 * Send a message via OpenPhone
 */
export async function sendMessage(req: Request, res: Response) {
  const { to, body, conversationId } = req.body;

  if (!to || !body) {
    throw new AppError('Missing required fields: to, body', 400);
  }

  try {
    // Send via OpenPhone
    const result = await openPhoneService.sendMessage(
      to,
      body,
      process.env.OPENPHONE_DEFAULT_NUMBER
    );

    // Update conversation if provided
    if (conversationId) {
      await db.query(`
        UPDATE openphone_conversations
        SET 
          messages = messages || $2::jsonb,
          updated_at = NOW(),
          last_message_at = NOW()
        WHERE conversation_id = $1
      `, [conversationId, JSON.stringify([{
        id: result.id,
        body,
        direction: 'outgoing',
        from: process.env.OPENPHONE_DEFAULT_NUMBER,
        to,
        createdAt: new Date().toISOString(),
        userId: req.user!.id,
        userName: req.user!.name
      }])]);
    }

    logger.info('Message sent', {
      to,
      conversationId,
      userId: req.user!.id
    });

    res.json({
      success: true,
      messageId: result.id,
      message: result
    });
  } catch (error: any) {
    logger.error('Error sending message:', error);
    throw new AppError(
      error.message || 'Failed to send message',
      error.statusCode || 500
    );
  }
}

/**
 * Get unread message count
 */
export async function getUnreadCount(req: Request, res: Response) {
  try {
    const result = await db.query(`
      SELECT COUNT(*) as unread_count
      FROM openphone_conversations oc
      LEFT JOIN message_status ms ON ms.conversation_id = oc.conversation_id 
        AND ms.user_id = $1
      WHERE oc.updated_at > COALESCE(ms.last_read_at, '1970-01-01'::timestamp)
        AND oc.status = 'active'
    `, [req.user!.id]);

    res.json({
      unreadCount: parseInt(result.rows[0].unread_count)
    });
  } catch (error) {
    logger.error('Error getting unread count:', error);
    throw new AppError('Failed to get unread count', 500);
  }
}

/**
 * Mark messages as read
 */
export async function markAsRead(req: Request, res: Response) {
  const { messageId } = req.params;
  const { conversationId } = req.body;

  if (!conversationId) {
    throw new AppError('conversationId is required', 400);
  }

  try {
    await db.query(`
      INSERT INTO message_status (conversation_id, user_id, last_read_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (conversation_id, user_id) 
      DO UPDATE SET last_read_at = NOW(), updated_at = NOW()
    `, [conversationId, req.user!.id]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Error marking as read:', error);
    throw new AppError('Failed to mark as read', 500);
  }
}

/**
 * Get AI suggestion for message response
 */
export async function getAISuggestion(req: Request, res: Response) {
  const { conversationId, context } = req.body;

  if (!conversationId) {
    throw new AppError('conversationId is required', 400);
  }

  try {
    // Get conversation history
    const conversation = await db.query(
      'SELECT * FROM openphone_conversations WHERE conversation_id = $1',
      [conversationId]
    );

    if (conversation.rows.length === 0) {
      throw new AppError('Conversation not found', 404);
    }

    // Get AI suggestion
    const conversationData = conversation.rows[0];
    const suggestion = await messageAssistantService.generateSuggestedResponse(
      conversationData.conversation_id,
      conversationData.phone_number,
      conversationData.messages || [],
      req.user!.id
    );

    res.json({
      suggestion: suggestion.suggestedText,
      confidence: suggestion.confidence,
      alternatives: []
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error getting AI suggestion:', error);
    throw new AppError('Failed to generate suggestion', 500);
  }
}

/**
 * Get debug status for messaging system
 */
export async function getDebugStatus(req: Request, res: Response) {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_conversations,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_conversations,
        COUNT(CASE WHEN assigned_to IS NOT NULL THEN 1 END) as assigned_conversations,
        MAX(updated_at) as last_activity
      FROM openphone_conversations
    `);

    const messageStats = await db.query(`
      SELECT 
        SUM(jsonb_array_length(messages)) as total_messages
      FROM openphone_conversations
    `);

    const userStats = await db.query(`
      SELECT 
        u.name,
        COUNT(oc.id) as assigned_conversations
      FROM users u
      LEFT JOIN openphone_conversations oc ON oc.assigned_to = u.id
      WHERE u.role IN ('admin', 'operator', 'support')
      GROUP BY u.id, u.name
    `);

    res.json({
      status: 'healthy',
      stats: {
        ...stats.rows[0],
        total_messages: messageStats.rows[0].total_messages || 0
      },
      userStats: userStats.rows,
      services: {
        openphone: await openPhoneService.testConnection(),
        notifications: (notificationService as any).initialized || false
      }
    });
  } catch (error) {
    logger.error('Error getting debug status:', error);
    throw new AppError('Failed to get debug status', 500);
  }
}

/**
 * Refresh message cache
 */
export async function refreshCache(req: Request, res: Response) {
  try {
    // Clear any in-memory caches
    // This is a placeholder - implement based on your caching strategy
    
    logger.info('Message cache refreshed', {
      refreshedBy: req.user!.id
    });

    res.json({
      success: true,
      message: 'Cache refreshed successfully'
    });
  } catch (error) {
    logger.error('Error refreshing cache:', error);
    throw new AppError('Failed to refresh cache', 500);
  }
}