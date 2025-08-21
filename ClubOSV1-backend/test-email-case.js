const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway"
});

async function testEmailCase() {
  const client = await pool.connect();
  
  try {
    // Test if we can create duplicate with different case
    console.log('Testing if email uniqueness is case-sensitive...\n');
    
    // Try different case variations of existing emails
    const testEmails = [
      'AlannaBELAIR@gmail.com',
      'Alanna.Belair@gmail.com',
      'ALANNA.BELAIR@GMAIL.COM',
      'mikebelair79@Gmail.com',
      'MIKEBELAIR79@gmail.com'
    ];
    
    for (const email of testEmails) {
      const result = await client.query(
        'SELECT id, email, name FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );
      
      if (result.rows.length > 0) {
        console.log(`Found match for ${email}:`);
        console.log(`  Stored as: ${result.rows[0].email}`);
        console.log(`  User: ${result.rows[0].name}\n`);
      }
    }
    
    // Check the auth route to see how it handles email
    console.log('Current emails in database:');
    const allEmails = await client.query(
      'SELECT email, name FROM users WHERE role = $1 ORDER BY created_at DESC',
      ['customer']
    );
    console.table(allEmails.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testEmailCase();
