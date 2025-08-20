const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway"
});

async function fixSeasonsTable() {
  const client = await pool.connect();
  
  try {
    console.log('Adding is_active column to seasons table...');
    
    // Add column
    await client.query(`
      ALTER TABLE seasons 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false
    `);
    
    // Update existing seasons
    await client.query(`UPDATE seasons SET is_active = false`);
    
    // Mark most recent as active
    await client.query(`
      UPDATE seasons 
      SET is_active = true 
      WHERE id = (
        SELECT id FROM seasons 
        ORDER BY created_at DESC 
        LIMIT 1
      )
    `);
    
    // Create index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_seasons_is_active 
      ON seasons(is_active) 
      WHERE is_active = true
    `);
    
    console.log('✅ Successfully added is_active column to seasons table');
    
    // Check current active season
    const result = await client.query('SELECT id, name, is_active FROM seasons WHERE is_active = true');
    if (result.rows.length > 0) {
      console.log('Active season:', result.rows[0]);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixSeasonsTable();
