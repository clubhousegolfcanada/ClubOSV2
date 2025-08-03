/**
 * Conversation Handlers
 * 
 * Handles OpenPhone conversation management
 */

import { Request, Response } from 'express';
import { db } from '../../../utils/database';
import { logger } from '../../../utils/logger';
import { AppError } from '../../../middleware/errorHandler';
import { openPhoneService } from '../../../services/openphoneService';

/**
 * List all conversations with pagination and filters
 */
export async function listConversations(req: Request, res: Response) {
  const { 
    page = 1, 
    limit = 50, 
    status = 'all',
    assigned_to,
    unread_only 
  } = req.query;

  const offset = (Number(page) - 1) * Number(limit);
  
  let query = `
    SELECT 
      oc.*,
      u.name as assigned_to_name,
      COALESCE(ms.last_read_at, '1970-01-01'::timestamp) as last_read_at,
      (oc.updated_at > COALESCE(ms.last_read_at, '1970-01-01'::timestamp)) as has_unread
    FROM openphone_conversations oc
    LEFT JOIN users u ON oc.assigned_to = u.id
    LEFT JOIN message_status ms ON ms.conversation_id = oc.conversation_id 
      AND ms.user_id = $1
    WHERE 1=1
  `;
  
  const params: any[] = [req.user!.id];
  let paramIndex = 2;

  // Apply filters
  if (status !== 'all') {
    query += ` AND oc.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (assigned_to) {
    query += ` AND oc.assigned_to = $${paramIndex}`;
    params.push(assigned_to);
    paramIndex++;
  }

  if (unread_only === 'true') {
    query += ` AND oc.updated_at > COALESCE(ms.last_read_at, '1970-01-01'::timestamp)`;
  }

  // Add sorting and pagination
  query += ` ORDER BY oc.updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(Number(limit), offset);

  try {
    // Get conversations
    const result = await db.query(query, params);
    
    // Get total count
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) FROM').replace(/ORDER BY.*$/, '');
    const countParams = params.slice(0, -2); // Remove limit and offset
    const countResult = await db.query(countQuery, countParams);
    
    res.json({
      conversations: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    throw new AppError('Failed to fetch conversations', 500);
  }
}

/**
 * Get single conversation with full message history
 */
export async function getConversation(req: Request, res: Response) {
  const { conversationId } = req.params;

  try {
    // Get conversation details
    const conversation = await db.query(`
      SELECT 
        oc.*,
        u.name as assigned_to_name,
        ms.last_read_at
      FROM openphone_conversations oc
      LEFT JOIN users u ON oc.assigned_to = u.id
      LEFT JOIN message_status ms ON ms.conversation_id = oc.conversation_id 
        AND ms.user_id = $2
      WHERE oc.conversation_id = $1
    `, [conversationId, req.user!.id]);

    if (conversation.rows.length === 0) {
      throw new AppError('Conversation not found', 404);
    }

    // Update last read timestamp
    await db.query(`
      INSERT INTO message_status (conversation_id, user_id, last_read_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (conversation_id, user_id) 
      DO UPDATE SET last_read_at = NOW(), updated_at = NOW()
    `, [conversationId, req.user!.id]);

    res.json(conversation.rows[0]);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error fetching conversation:', error);
    throw new AppError('Failed to fetch conversation', 500);
  }
}

/**
 * Update conversation status
 */
export async function updateConversationStatus(req: Request, res: Response) {
  const { conversationId } = req.params;
  const { status } = req.body;

  if (!['active', 'resolved', 'archived'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  try {
    const result = await db.query(`
      UPDATE openphone_conversations
      SET status = $2, updated_at = NOW()
      WHERE conversation_id = $1
      RETURNING *
    `, [conversationId, status]);

    if (result.rows.length === 0) {
      throw new AppError('Conversation not found', 404);
    }

    logger.info('Conversation status updated', {
      conversationId,
      status,
      updatedBy: req.user!.id
    });

    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error updating conversation status:', error);
    throw new AppError('Failed to update conversation status', 500);
  }
}

/**
 * Assign conversation to a user
 */
export async function assignConversation(req: Request, res: Response) {
  const { conversationId } = req.params;
  const { userId } = req.body;

  try {
    // Verify user exists and has appropriate role
    const userCheck = await db.query(`
      SELECT id, role FROM users 
      WHERE id = $1 AND role IN ('admin', 'operator', 'support')
    `, [userId]);

    if (userCheck.rows.length === 0) {
      throw new AppError('Invalid user or insufficient permissions', 400);
    }

    // Update assignment
    const result = await db.query(`
      UPDATE openphone_conversations
      SET assigned_to = $2, updated_at = NOW()
      WHERE conversation_id = $1
      RETURNING *
    `, [conversationId, userId]);

    if (result.rows.length === 0) {
      throw new AppError('Conversation not found', 404);
    }

    logger.info('Conversation assigned', {
      conversationId,
      assignedTo: userId,
      assignedBy: req.user!.id
    });

    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error assigning conversation:', error);
    throw new AppError('Failed to assign conversation', 500);
  }
}