const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway"
  });

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'src/database/migrations/054_knowledge_store.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running migration 054_knowledge_store.sql...');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the table was created
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('knowledge_store', 'knowledge_patterns', 'knowledge_extraction_log')
    `);
    
    console.log('\nCreated tables:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();