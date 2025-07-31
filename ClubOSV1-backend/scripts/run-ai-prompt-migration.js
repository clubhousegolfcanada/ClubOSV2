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
    // Read the migration file
    const migrationPath = path.join(__dirname, '../src/database/migrations/021_ai_prompt_templates.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running AI prompt templates migration...');
    
    // Run the migration
    await pool.query(migrationSQL);
    
    console.log('✓ Migration completed successfully');
    
    // Verify tables were created
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('ai_prompt_templates', 'ai_prompt_template_history')
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