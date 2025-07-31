const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testNotifications() {
  try {
    // Check if tables exist
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('push_subscriptions', 'notification_history', 'notification_preferences')
    `);
    
    console.log('Existing tables:', tables.rows.map(r => r.table_name));
    
    if (tables.rows.length < 3) {
      console.error('Missing notification tables! Found:', tables.rows.length, 'of 3');
      
      // Check migrations table
      const migrations = await pool.query(`
        SELECT * FROM migrations WHERE version = 19
      `);
      console.log('Migration 19 status:', migrations.rows[0] || 'NOT FOUND');
    } else {
      console.log('✓ All notification tables exist');
      
      // Test table structure
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'push_subscriptions'
        ORDER BY ordinal_position
      `);
      console.log('\nPush subscriptions columns:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });
    }
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await pool.end();
  }
}

testNotifications();