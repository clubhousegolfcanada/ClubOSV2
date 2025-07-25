import { query } from '../utils/db';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

async function runTicketsMigration() {
  try {
    logger.info('Running tickets table migration...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migrations/002_create_tickets_table.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    // Execute migration
    await query(migrationSQL);
    
    logger.info('✅ Tickets table migration completed successfully');
    
    // Check tables
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('tickets', 'ticket_comments', 'feedback', 'slack_messages')
      ORDER BY table_name;
    `);
    
    logger.info('Current tables:', tables.rows.map(r => r.table_name));
    
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runTicketsMigration();
}

export { runTicketsMigration };
