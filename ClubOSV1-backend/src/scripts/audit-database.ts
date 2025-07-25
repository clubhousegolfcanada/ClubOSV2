import * as dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

async function auditDatabase() {
  console.log('=== DATABASE AUDIT ===\n');
  
  // Check environment
  console.log('1. Environment Variables:');
  console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '✓ Set' : '✗ Missing');
  console.log('   NODE_ENV:', process.env.NODE_ENV || 'Not set');
  console.log('');
  
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set!');
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Test connection
    console.log('2. Testing Database Connection...');
    const testResult = await pool.query('SELECT NOW()');
    console.log('   ✓ Connected successfully');
    console.log('   Current time:', testResult.rows[0].now);
    console.log('');
    
    // Check existing tables
    console.log('3. Existing Tables:');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length === 0) {
      console.log('   No tables found in public schema');
    } else {
      tablesResult.rows.forEach(row => {
        console.log('   -', row.table_name);
      });
    }
    console.log('');
    
    // Check if feedback table exists
    console.log('4. Checking for feedback table specifically:');
    const feedbackExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'feedback'
      )
    `);
    console.log('   Feedback table exists:', feedbackExists.rows[0].exists ? 'YES' : 'NO');
    console.log('');
    
    // Try to create a simple test table
    console.log('5. Testing CREATE TABLE capability:');
    try {
      await pool.query('DROP TABLE IF EXISTS test_table_temp');
      await pool.query('CREATE TABLE test_table_temp (id INT PRIMARY KEY)');
      console.log('   ✓ Successfully created test table');
      
      // Check if it exists
      const testExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'test_table_temp'
        )
      `);
      console.log('   ✓ Test table verified:', testExists.rows[0].exists ? 'EXISTS' : 'NOT FOUND');
      
      // Clean up
      await pool.query('DROP TABLE test_table_temp');
      console.log('   ✓ Test table cleaned up');
    } catch (error: any) {
      console.error('   ✗ Failed to create test table:', error.message);
    }
    console.log('');
    
    // Check user permissions
    console.log('6. Checking User Permissions:');
    const permissionsResult = await pool.query(`
      SELECT current_user, 
             has_database_privilege(current_database(), 'CREATE') as can_create,
             has_table_privilege('information_schema.tables', 'SELECT') as can_query_schema
    `);
    const perms = permissionsResult.rows[0];
    console.log('   Current user:', perms.current_user);
    console.log('   Can CREATE:', perms.can_create ? 'YES' : 'NO');
    console.log('   Can query schema:', perms.can_query_schema ? 'YES' : 'NO');
    console.log('');
    
    // Try to create feedback table directly
    console.log('7. Attempting to create feedback table directly:');
    try {
      const createResult = await pool.query(`
        CREATE TABLE IF NOT EXISTS feedback (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          test_column VARCHAR(50)
        )
      `);
      console.log('   ✓ CREATE TABLE command executed');
      
      // Check if it was created
      const checkResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'feedback'
      `);
      
      if (checkResult.rows.length > 0) {
        console.log('   ✓ Feedback table created with columns:');
        checkResult.rows.forEach(row => {
          console.log('     -', row.column_name);
        });
      } else {
        console.log('   ✗ Table not found after creation attempt');
      }
    } catch (error: any) {
      console.error('   ✗ Failed to create feedback table:', error.message);
      console.error('   Error code:', error.code);
      console.error('   Error detail:', error.detail);
    }
    
  } catch (error: any) {
    console.error('Database error:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the audit
auditDatabase().catch(console.error);