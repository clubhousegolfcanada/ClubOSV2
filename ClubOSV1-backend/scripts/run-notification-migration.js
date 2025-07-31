const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  try {
    // First check migrations table structure
    const migrationTable = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'migrations'
    `);
    
    console.log('Migration table columns:', migrationTable.rows.map(r => r.column_name));
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../src/database/migrations/019_push_notifications.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running push notification migration...');
    
    // Run the migration
    await pool.query(migrationSQL);
    
    console.log('✓ Migration completed successfully');
    
    // Verify tables were created
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('push_subscriptions', 'notification_history', 'notification_preferences')
    `);
    
    console.log('\nCreated tables:', tables.rows.map(r => r.table_name));
    
  } catch (error) {
    console.error('Migration error:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
  } finally {
    await pool.end();
  }
}

runMigration();