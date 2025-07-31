import { db } from './database';
import { logger } from './logger';

// Cache for column existence checks to avoid repeated queries
const columnExistsCache: Record<string, boolean> = {};

/**
 * Check if a column exists in a table
 */
export async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const cacheKey = `${tableName}.${columnName}`;
  
  // Check cache first
  if (cacheKey in columnExistsCache) {
    return columnExistsCache[cacheKey];
  }

  try {
    const result = await db.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = $1 
        AND column_name = $2
      )
    `, [tableName, columnName]);
    
    const exists = result.rows[0].exists;
    columnExistsCache[cacheKey] = exists;
    
    return exists;
  } catch (error) {
    logger.error(`Error checking if column ${columnName} exists in ${tableName}:`, error);
    return false;
  }
}

/**
 * Get safe INSERT query for openphone_conversations table
 * that handles missing columns gracefully
 */
export async function getSafeOpenPhoneInsertQuery(): Promise<{
  query: string;
  hasUnreadCount: boolean;
  hasConversationId: boolean;
}> {
  const hasUnreadCount = await columnExists('openphone_conversations', 'unread_count');
  const hasConversationId = await columnExists('openphone_conversations', 'conversation_id');
  
  let columns = ['phone_number', 'customer_name', 'employee_name', 'messages', 'metadata'];
  let placeholders = ['$1', '$2', '$3', '$4', '$5'];
  let paramOffset = 5;
  
  if (hasConversationId) {
    columns.unshift('conversation_id');
    placeholders.unshift('$1');
    placeholders = placeholders.map((p, i) => `$${i + 1}`);
  }
  
  if (hasUnreadCount) {
    columns.push('unread_count');
    placeholders.push(`$${columns.length}`);
  }
  
  const query = `
    INSERT INTO openphone_conversations 
    (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
  `;
  
  return { query, hasUnreadCount, hasConversationId };
}

/**
 * Build parameters array for safe INSERT based on available columns
 */
export function buildOpenPhoneInsertParams(
  data: {
    conversationId?: string;
    phoneNumber: string;
    customerName: string;
    employeeName: string;
    messages: any;
    metadata: any;
    unreadCount?: number;
  },
  hasConversationId: boolean,
  hasUnreadCount: boolean
): any[] {
  const params: any[] = [];
  
  if (hasConversationId) {
    params.push(data.conversationId || null);
  }
  
  params.push(
    data.phoneNumber,
    data.customerName,
    data.employeeName,
    JSON.stringify(data.messages),
    JSON.stringify(data.metadata)
  );
  
  if (hasUnreadCount) {
    params.push(data.unreadCount || 0);
  }
  
  return params;
}

/**
 * Ensure required columns exist in openphone_conversations table
 */
export async function ensureOpenPhoneColumns(): Promise<void> {
  try {
    logger.info('Ensuring OpenPhone table has required columns...');
    
    // Check and add unread_count
    if (!(await columnExists('openphone_conversations', 'unread_count'))) {
      logger.warn('unread_count column missing, adding it now...');
      await db.query('ALTER TABLE openphone_conversations ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0');
      delete columnExistsCache['openphone_conversations.unread_count'];
      logger.info('✓ Added unread_count column');
    }
    
    // Check and add conversation_id
    if (!(await columnExists('openphone_conversations', 'conversation_id'))) {
      logger.warn('conversation_id column missing, adding it now...');
      await db.query('ALTER TABLE openphone_conversations ADD COLUMN IF NOT EXISTS conversation_id VARCHAR(255)');
      delete columnExistsCache['openphone_conversations.conversation_id'];
      logger.info('✓ Added conversation_id column');
    }
    
    // Check and add updated_at
    if (!(await columnExists('openphone_conversations', 'updated_at'))) {
      logger.warn('updated_at column missing, adding it now...');
      await db.query('ALTER TABLE openphone_conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()');
      delete columnExistsCache['openphone_conversations.updated_at'];
      logger.info('✓ Added updated_at column');
    }
    
    // Check and add last_read_at
    if (!(await columnExists('openphone_conversations', 'last_read_at'))) {
      logger.warn('last_read_at column missing, adding it now...');
      await db.query('ALTER TABLE openphone_conversations ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE');
      delete columnExistsCache['openphone_conversations.last_read_at'];
      logger.info('✓ Added last_read_at column');
    }
    
  } catch (error) {
    logger.error('Failed to ensure OpenPhone columns:', error);
  }
}