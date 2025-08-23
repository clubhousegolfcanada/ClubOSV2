const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Railway production database URL
const DATABASE_URL = 'postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function resetAlannaPassword() {
  try {
    console.log('Connecting to Railway production database...\n');
    
    // Check if account exists
    const checkResult = await pool.query(
      `SELECT id, email, name, status, "isActive" 
       FROM "Users" 
       WHERE LOWER(email) = LOWER($1)`,
      ['alanna.belair@gmail.com']
    );
    
    if (checkResult.rows.length === 0) {
      console.log('Account not found for alanna.belair@gmail.com');
      console.log('Creating account...');
      
      // Create with simple password
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      const insertResult = await pool.query(
        `INSERT INTO "Users" (email, password, name, role, "isActive", status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, email`,
        ['alanna.belair@gmail.com', hashedPassword, 'Alanna Belair', 'customer', true, 'active']
      );
      
      const newUserId = insertResult.rows[0].id;
      console.log(`Created user with ID: ${newUserId}`);
      
      // Create customer profile
      await pool.query(
        `INSERT INTO customer_profiles (user_id, cc_balance, rank_tier, total_challenges_won, total_challenges_played)
         VALUES ($1, 100, 'house', 0, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [newUserId]
      );
      
      console.log('Account created successfully!');
    } else {
      const user = checkResult.rows[0];
      console.log(`Found account: ${user.email}`);
      console.log(`Status: ${user.status}, Active: ${user.isActive}`);
      
      // Update to ensure account is active and reset password
      const simplePassword = await bcrypt.hash('password123', 10);
      
      await pool.query(
        `UPDATE "Users" 
         SET password = $1, 
             status = 'active', 
             "isActive" = true,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [simplePassword, user.id]
      );
      
      console.log('\nPassword reset and account activated!');
    }
    
    console.log('\n✅ SUCCESS!');
    console.log('Email: alanna.belair@gmail.com');
    console.log('Password: password123');
    console.log('\nAlanna can now login with this simple password.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

resetAlannaPassword();