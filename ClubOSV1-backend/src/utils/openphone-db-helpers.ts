import { db } from './database';
import { logger } from './logger';
import { getSafeOpenPhoneInsertQuery, buildOpenPhoneInsertParams } from './database-helpers';

/**
 * Safely insert a new OpenPhone conversation, handling missing columns
 */
export async function insertOpenPhoneConversation(data: {
  conversationId?: string;
  phoneNumber: string;
  customerName: string;
  employeeName: string;
  messages: any;
  metadata: any;
  unreadCount?: number;
}) {
  try {
    const { query, hasUnreadCount, hasConversationId } = await getSafeOpenPhoneInsertQuery();
    const params = buildOpenPhoneInsertParams(data, hasConversationId, hasUnreadCount);
    
    await db.query(query, params);
    
    logger.info('OpenPhone conversation inserted successfully', {
      phoneNumber: data.phoneNumber,
      hasConversationId,
      hasUnreadCount
    });
  } catch (error: any) {
    // If it still fails, try without the problematic columns
    if (error.code === '42703') { // column does not exist
      logger.warn('Column missing error, trying minimal insert', error.message);
      
      // Fallback to minimal insert
      await db.query(`
        INSERT INTO openphone_conversations 
        (phone_number, customer_name, employee_name, messages, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        data.phoneNumber,
        data.customerName,
        data.employeeName,
        JSON.stringify(data.messages),
        JSON.stringify(data.metadata)
      ]);
      
      logger.info('OpenPhone conversation inserted with minimal columns');
    } else {
      throw error;
    }
  }
}

/**
 * Safely update an existing OpenPhone conversation
 */
export async function updateOpenPhoneConversation(
  conversationId: string,
  updates: {
    messages?: any;
    unreadCount?: number;
    customerName?: string;
    employeeName?: string;
    lastReadAt?: Date | null;
  }
) {
  try {
    // Build dynamic UPDATE query based on what columns exist
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramCount = 0;
    
    // Always update these
    if (updates.messages !== undefined) {
      setClauses.push(`messages = $${++paramCount}`);
      params.push(JSON.stringify(updates.messages));
    }
    
    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    
    if (updates.customerName !== undefined) {
      setClauses.push(`customer_name = COALESCE(customer_name, $${++paramCount})`);
      params.push(updates.customerName);
    }
    
    if (updates.employeeName !== undefined) {
      setClauses.push(`employee_name = COALESCE(employee_name, $${++paramCount})`);
      params.push(updates.employeeName);
    }
    
    // Check if unread_count column exists
    const hasUnreadCount = await db.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'openphone_conversations' 
        AND column_name = 'unread_count'
      )
    `);
    
    if (hasUnreadCount.rows[0].exists && updates.unreadCount !== undefined) {
      setClauses.push(`unread_count = $${++paramCount}`);
      params.push(updates.unreadCount);
    }
    
    // Check if last_read_at column exists
    const hasLastReadAt = await db.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'openphone_conversations' 
        AND column_name = 'last_read_at'
      )
    `);
    
    if (hasLastReadAt.rows[0].exists && updates.lastReadAt !== undefined) {
      setClauses.push(`last_read_at = $${++paramCount}`);
      params.push(updates.lastReadAt);
    }
    
    // Add WHERE clause
    params.push(conversationId);
    
    const query = `
      UPDATE openphone_conversations
      SET ${setClauses.join(', ')}
      WHERE id = $${params.length}
    `;
    
    await db.query(query, params);
    
  } catch (error) {
    logger.error('Failed to update OpenPhone conversation:', error);
    throw error;
  }
}