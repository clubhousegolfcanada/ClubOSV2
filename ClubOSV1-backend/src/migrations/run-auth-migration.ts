import { db } from '../utils/database';
import fs from 'fs';
import path from 'path';

async function runAuthMigration() {
  try {
    console.log('🔄 Running auth refactor migration...');
    
    // Read the SQL file
    const sqlFile = path.join(__dirname, '001_auth_refactor_tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf-8');
    
    // Split by semicolons and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 50) + '...');
        await db.query(statement);
      }
    }
    
    console.log('✅ Auth migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runAuthMigration();