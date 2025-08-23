const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Railway production database URL
const DATABASE_URL = 'postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Applying admin actions audit migration...\n');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../src/database/migrations/068_admin_actions_audit.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await client.query('BEGIN');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration applied successfully!');
    
    // Verify the table was created
    const tableCheck = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_actions'
      )`
    );
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ admin_actions table created successfully');
    }
    
    // Check if view was created
    const viewCheck = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'cc_adjustment_history'
      )`
    );
    
    if (viewCheck.rows[0].exists) {
      console.log('✅ cc_adjustment_history view created successfully');
    }
    
    await client.query('COMMIT');
    
    console.log('\n✅ Admin actions audit system is ready!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error applying migration:', error);
    console.error('Details:', error.detail || error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();