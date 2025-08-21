const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway"
});

async function checkDuplicateAccounts() {
  const client = await pool.connect();
  
  try {
    console.log('=== Checking for Alanna Belair accounts ===\n');
    
    // Find all Alanna accounts
    const alanna = await client.query(`
      SELECT 
        id,
        email,
        name,
        role,
        created_at,
        last_login
      FROM users 
      WHERE LOWER(name) LIKE '%alanna%belair%' 
      OR LOWER(email) LIKE '%alanna%'
      ORDER BY created_at DESC
    `);
    
    console.log('Found Alanna accounts:');
    console.table(alanna.rows);
    
    // Check for duplicate emails (case variations)
    console.log('\n=== Checking for duplicate emails (case variations) ===\n');
    const duplicates = await client.query(`
      SELECT 
        LOWER(email) as normalized_email,
        COUNT(*) as count,
        array_agg(email ORDER BY created_at) as email_variations,
        array_agg(name ORDER BY created_at) as names,
        array_agg(id ORDER BY created_at) as user_ids
      FROM users
      GROUP BY LOWER(email)
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);
    
    if (duplicates.rows.length > 0) {
      console.log('Found duplicate emails:');
      console.table(duplicates.rows);
    } else {
      console.log('No duplicate emails found');
    }
    
    // Check unique constraint on email
    console.log('\n=== Checking email constraints ===\n');
    const constraints = await client.query(`
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'users'
      AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
      AND kcu.column_name = 'email'
    `);
    
    console.log('Email constraints:');
    console.table(constraints.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkDuplicateAccounts();
