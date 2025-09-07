import { query } from '../src/utils/db';
import fs from 'fs';
import path from 'path';

async function runMigration216() {
  console.log('Running migration 216: Fix pattern columns...\n');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../src/database/migrations/216_fix_pattern_columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Executing migration...');
    await query(migrationSQL);
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify the columns exist
    console.log('Verifying columns...');
    const schemaCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'decision_patterns' 
      AND column_name IN ('pattern', 'created_at')
    `);
    
    const hasPattern = schemaCheck.rows.some(r => r.column_name === 'pattern');
    const hasCreatedAt = schemaCheck.rows.some(r => r.column_name === 'created_at');
    
    console.log(`  pattern column: ${hasPattern ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`  created_at column: ${hasCreatedAt ? '✅ EXISTS' : '❌ MISSING'}`);
    
    if (hasPattern && hasCreatedAt) {
      console.log('\n✅ All columns successfully added!');
      
      // Test a sample query
      console.log('\nTesting patterns query...');
      const testQuery = await query(`
        SELECT id, pattern, created_at, updated_at 
        FROM decision_patterns 
        LIMIT 1
      `);
      
      if (testQuery.rows.length > 0) {
        console.log('✅ Query works! Sample data:');
        console.log('  ID:', testQuery.rows[0].id);
        console.log('  Pattern:', testQuery.rows[0].pattern?.substring(0, 50) + '...');
        console.log('  Created:', testQuery.rows[0].created_at);
      }
    } else {
      console.error('❌ Migration may have failed - columns still missing');
    }
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.detail) console.error('Details:', error.detail);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  }
  
  process.exit(0);
}

runMigration216();