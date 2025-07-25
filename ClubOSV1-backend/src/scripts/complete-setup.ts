import * as dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

async function completeSetup() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    console.log('=== Completing Database Setup ===\n');
    
    // Create indexes for feedback table
    console.log('Creating indexes for feedback table...');
    const feedbackIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_feedback_source ON feedback(feedback_source)',
      'CREATE INDEX IF NOT EXISTS idx_feedback_slack_thread ON feedback(slack_thread_ts)',
      'CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id)'
    ];
    
    for (const indexSQL of feedbackIndexes) {
      try {
        await pool.query(indexSQL);
        console.log(`✓ ${indexSQL.match(/idx_\w+/)?.[0]}`);
      } catch (error: any) {
        console.error(`✗ Failed: ${error.message}`);
      }
    }
    
    // Create indexes for slack_messages table
    console.log('\nCreating indexes for slack_messages table...');
    const slackIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_slack_messages_user_id ON slack_messages(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_slack_messages_thread_ts ON slack_messages(slack_thread_ts)',
      'CREATE INDEX IF NOT EXISTS idx_slack_messages_created_at ON slack_messages(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_slack_messages_request_id ON slack_messages(request_id)'
    ];
    
    for (const indexSQL of slackIndexes) {
      try {
        await pool.query(indexSQL);
        console.log(`✓ ${indexSQL.match(/idx_\w+/)?.[0]}`);
      } catch (error: any) {
        console.error(`✗ Failed: ${error.message}`);
      }
    }
    
    // Create the view
    console.log('\nCreating slack_replies_view...');
    try {
      await pool.query(`
        CREATE OR REPLACE VIEW slack_replies_view AS
        SELECT 
          f.id,
          f.timestamp,
          f.slack_user_name,
          f.slack_user_id,
          f.response as slack_reply,
          f.slack_channel,
          f.slack_thread_ts,
          sm.request_description,
          sm.location,
          sm.route,
          sm.user_id as original_user_id,
          sm.created_at as original_message_time,
          f.created_at as reply_time
        FROM feedback f
        JOIN slack_messages sm ON f.slack_thread_ts = sm.slack_thread_ts
        WHERE f.feedback_source = 'slack_reply'
        ORDER BY f.created_at DESC
      `);
      console.log('✓ View created successfully');
    } catch (error: any) {
      console.error('✗ Failed to create view:', error.message);
    }
    
    // Verify everything
    console.log('\n=== Final Verification ===');
    
    // Check tables
    const tables = await pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\nTables and Views:');
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name} (${row.table_type})`);
    });
    
    // Check indexes
    const indexes = await pool.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename IN ('feedback', 'slack_messages')
      ORDER BY tablename, indexname
    `);
    
    console.log('\nIndexes:');
    let currentTable = '';
    indexes.rows.forEach(row => {
      if (row.tablename !== currentTable) {
        currentTable = row.tablename;
        console.log(`  ${currentTable}:`);
      }
      console.log(`    - ${row.indexname}`);
    });
    
    // Test the setup
    console.log('\n=== Testing Setup ===');
    
    // Test insert into slack_messages
    console.log('\nTesting slack_messages insert...');
    try {
      await pool.query(`
        INSERT INTO slack_messages (
          slack_thread_ts, 
          slack_channel, 
          original_message,
          request_description,
          location,
          route
        ) VALUES (
          'test_thread_${Date.now()}',
          '#clubos-assistants',
          '{"text": "Test message"}',
          'Test request',
          'Test location',
          'Test'
        )
      `);
      console.log('✓ Successfully inserted test message');
      
      // Clean up
      await pool.query(`DELETE FROM slack_messages WHERE route = 'Test'`);
      console.log('✓ Cleaned up test data');
    } catch (error: any) {
      console.error('✗ Insert test failed:', error.message);
    }
    
    console.log('\n✅ Database setup complete!');
    console.log('\nYou can now:');
    console.log('1. Commit and push your changes');
    console.log('2. Slack messages will be tracked in the slack_messages table');
    console.log('3. Feedback (including Slack replies) will be stored in the feedback table');
    console.log('4. Use the slack_replies_view to query Slack replies easily');
    
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

completeSetup().catch(console.error);