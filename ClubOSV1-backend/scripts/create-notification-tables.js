const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createNotificationTables() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Creating push notification tables...');
    
    // Create push_subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        last_used_at TIMESTAMP DEFAULT NOW(),
        failed_attempts INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        UNIQUE(user_id, endpoint)
      )
    `);
    console.log('✓ Created push_subscriptions table');
    
    // Create notification_history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE SET NULL,
        type VARCHAR(50) NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        data JSONB,
        status VARCHAR(20) DEFAULT 'pending',
        error TEXT,
        sent_at TIMESTAMP DEFAULT NOW(),
        clicked_at TIMESTAMP
      )
    `);
    console.log('✓ Created notification_history table');
    
    // Create notification_preferences table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        messages_enabled BOOLEAN DEFAULT true,
        tickets_enabled BOOLEAN DEFAULT true,
        system_enabled BOOLEAN DEFAULT true,
        quiet_hours_enabled BOOLEAN DEFAULT false,
        quiet_hours_start TIME DEFAULT '22:00',
        quiet_hours_end TIME DEFAULT '08:00',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ Created notification_preferences table');
    
    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_push_subs_user_active ON push_subscriptions(user_id, is_active)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON push_subscriptions(endpoint)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_notification_history_user_date ON notification_history(user_id, sent_at)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_notification_history_status ON notification_history(status, sent_at)');
    console.log('✓ Created indexes');
    
    // Record migration
    await client.query(`
      INSERT INTO migrations (filename, executed_at) 
      VALUES ('019_push_notifications.sql', NOW()) 
      ON CONFLICT (filename) DO NOTHING
    `);
    console.log('✓ Recorded migration');
    
    await client.query('COMMIT');
    console.log('\n✅ All notification tables created successfully!');
    
    // Verify
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('push_subscriptions', 'notification_history', 'notification_preferences')
    `);
    console.log('\nVerified tables:', tables.rows.map(r => r.table_name));
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating tables:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
  } finally {
    client.release();
    await pool.end();
  }
}

createNotificationTables();