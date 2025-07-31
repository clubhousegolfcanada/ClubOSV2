import { db } from '../src/utils/database';
import { logger } from '../src/utils/logger';

async function verifyDatabaseSchema() {
  try {
    logger.info('Verifying database schema...');

    // Check if openphone_conversations table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'openphone_conversations'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      logger.error('openphone_conversations table does not exist!');
      return;
    }

    // Check columns in openphone_conversations table
    const columnCheck = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'openphone_conversations'
      ORDER BY ordinal_position;
    `);

    logger.info('Current columns in openphone_conversations table:');
    columnCheck.rows.forEach(col => {
      logger.info(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'none'})`);
    });

    // Check specifically for required columns
    const requiredColumns = ['conversation_id', 'unread_count', 'updated_at', 'last_read_at'];
    const existingColumns = columnCheck.rows.map(col => col.column_name);
    
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      logger.warn('Missing columns:', missingColumns);
      
      // Try to add missing columns
      for (const column of missingColumns) {
        try {
          if (column === 'unread_count') {
            await db.query('ALTER TABLE openphone_conversations ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0');
            logger.info('Added unread_count column');
          } else if (column === 'conversation_id') {
            await db.query('ALTER TABLE openphone_conversations ADD COLUMN IF NOT EXISTS conversation_id VARCHAR(255)');
            logger.info('Added conversation_id column');
          } else if (column === 'updated_at') {
            await db.query('ALTER TABLE openphone_conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()');
            logger.info('Added updated_at column');
          } else if (column === 'last_read_at') {
            await db.query('ALTER TABLE openphone_conversations ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE');
            logger.info('Added last_read_at column');
          }
        } catch (error) {
          logger.error(`Failed to add column ${column}:`, error);
        }
      }
    } else {
      logger.info('All required columns exist');
    }

    // Check indexes
    const indexCheck = await db.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'openphone_conversations';
    `);

    logger.info('Current indexes:');
    indexCheck.rows.forEach(idx => {
      logger.info(`  - ${idx.indexname}`);
    });

    // Check for feedback table issue
    const feedbackColumns = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'feedback'
      ORDER BY ordinal_position;
    `);

    logger.info('Feedback table columns:');
    feedbackColumns.rows.forEach(col => {
      logger.info(`  - ${col.column_name}`);
    });

    process.exit(0);
  } catch (error) {
    logger.error('Database verification failed:', error);
    process.exit(1);
  }
}

// Run verification
verifyDatabaseSchema();