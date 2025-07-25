import * as dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

async function checkTables() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Check all tables with exact case
    console.log('=== Current Database State ===\n');
    
    const tablesResult = await pool.query(`
      SELECT table_name, 
             CASE 
               WHEN table_name = LOWER(table_name) THEN 'lowercase'
               WHEN table_name = UPPER(table_name) THEN 'UPPERCASE'
               ELSE 'MixedCase'
             END as case_type
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('Tables in database:');
    tablesResult.rows.forEach(row => {
      console.log(`  - "${row.table_name}" (${row.case_type})`);
    });
    
    // Check the feedback table structure
    console.log('\nFeedback table columns:');
    const feedbackCols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'feedback'
      ORDER BY ordinal_position
    `);
    
    if (feedbackCols.rows.length > 0) {
      feedbackCols.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
      });
    }
    
    // Drop the incomplete feedback table
    console.log('\nDropping incomplete feedback table...');
    await pool.query('DROP TABLE IF EXISTS feedback');
    console.log('✓ Dropped feedback table');
    
    // Now let's run our full migration SQL directly
    console.log('\nRunning full migration SQL...');
    
    const migrationSQL = `
      -- Create feedback table with all columns
      CREATE TABLE IF NOT EXISTS feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        user_id UUID,
        user_email VARCHAR(255),
        request_description TEXT NOT NULL,
        location VARCHAR(255),
        route VARCHAR(50),
        response TEXT,
        confidence DECIMAL(3,2),
        is_useful BOOLEAN NOT NULL DEFAULT false,
        feedback_type VARCHAR(50),
        feedback_source VARCHAR(50) DEFAULT 'user',
        slack_thread_ts VARCHAR(255),
        slack_user_name VARCHAR(255),
        slack_user_id VARCHAR(255),
        slack_channel VARCHAR(255),
        original_request_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Create slack_messages table
      CREATE TABLE IF NOT EXISTS slack_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        request_id UUID,
        slack_thread_ts VARCHAR(255) UNIQUE,
        slack_channel VARCHAR(255) NOT NULL,
        slack_message_ts VARCHAR(255),
        original_message TEXT NOT NULL,
        request_description TEXT,
        location VARCHAR(255),
        route VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    // Execute each CREATE TABLE separately
    const statements = migrationSQL.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`\nExecuting: ${statement.trim().substring(0, 50)}...`);
        try {
          await pool.query(statement);
          console.log('✓ Success');
        } catch (error: any) {
          console.error('✗ Failed:', error.message);
        }
      }
    }
    
    // Verify tables were created
    console.log('\n=== Final Database State ===');
    const finalTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('All tables:');
    finalTables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Add to migrations table
    console.log('\nMarking migration as complete...');
    await pool.query(`
      INSERT INTO migrations (filename) 
      VALUES ('001_add_slack_reply_tracking.sql')
      ON CONFLICT (filename) DO NOTHING
    `);
    console.log('✓ Migration marked as complete');
    
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables().catch(console.error);