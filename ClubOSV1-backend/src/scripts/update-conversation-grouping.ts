import { db } from '../utils/database';
import { logger } from '../utils/logger';

async function updateConversationGrouping() {
  try {
    await db.initialize();
    logger.info('Updating conversation grouping...');

    // Add conversation_id column if it doesn't exist
    await db.query(`
      ALTER TABLE openphone_conversations 
      ADD COLUMN IF NOT EXISTS conversation_id VARCHAR(255);
    `);

    // Add updated_at column if it doesn't exist
    await db.query(`
      ALTER TABLE openphone_conversations 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    `);

    // Add unique constraint on conversation_id
    await db.query(`
      ALTER TABLE openphone_conversations 
      DROP CONSTRAINT IF EXISTS openphone_conversations_conversation_id_key;
      
      ALTER TABLE openphone_conversations 
      ADD CONSTRAINT openphone_conversations_conversation_id_key 
      UNIQUE (conversation_id);
    `);

    // Update existing records to extract conversation_id from metadata
    await db.query(`
      UPDATE openphone_conversations 
      SET conversation_id = metadata->>'conversationId'
      WHERE conversation_id IS NULL 
      AND metadata->>'conversationId' IS NOT NULL;
    `);

    logger.info('✅ Conversation grouping update completed!');
    
    // Show current conversations
    const conversations = await db.query(`
      SELECT 
        conversation_id,
        phone_number,
        customer_name,
        jsonb_array_length(messages) as message_count,
        created_at,
        updated_at
      FROM openphone_conversations
      ORDER BY updated_at DESC
    `);

    logger.info(`Found ${conversations.rows.length} conversations:`);
    conversations.rows.forEach(conv => {
      logger.info(`  - ${conv.conversation_id}: ${conv.message_count} messages from ${conv.phone_number}`);
    });

    process.exit(0);
  } catch (error) {
    logger.error('Update failed:', error);
    process.exit(1);
  }
}

updateConversationGrouping();