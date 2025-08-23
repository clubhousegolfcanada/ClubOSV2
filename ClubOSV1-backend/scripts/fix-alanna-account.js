const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const readline = require('readline');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Create readline interface for password input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function checkAndFixAlanna() {
  try {
    console.log('Checking Alanna accounts...\n');
    
    // Check for both email variations
    const emails = ['alanna.belair@gmail.com', 'alannabelair@gmail.com'];
    
    for (const email of emails) {
      const result = await pool.query(
        `SELECT id, email, name, role, status, "isActive", "createdAt" 
         FROM "Users" 
         WHERE LOWER(email) = LOWER($1)`,
        [email]
      );
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        console.log(`Found account: ${email}`);
        console.log(`  ID: ${user.id}`);
        console.log(`  Name: ${user.name}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Status: ${user.status || 'N/A'}`);
        console.log(`  Is Active: ${user.isActive}`);
        console.log(`  Created: ${user.createdAt}`);
        console.log('');
      } else {
        console.log(`No account found for: ${email}`);
      }
    }
    
    // Check if we need to create alanna.belair@gmail.com account
    const checkDot = await pool.query(
      `SELECT id FROM "Users" WHERE LOWER(email) = LOWER($1)`,
      ['alanna.belair@gmail.com']
    );
    
    if (checkDot.rows.length === 0) {
      console.log('\nAccount does not exist for alanna.belair@gmail.com');
      const createAccount = await askQuestion('Do you want to create the account? (yes/no): ');
      
      if (createAccount.toLowerCase() === 'yes') {
        // Prompt for password
        const password = await askQuestion('Enter password for new account: ');
        
        if (!password || password.length < 6) {
          console.log('Password must be at least 6 characters. Aborting.');
          return;
        }
        
        console.log('\nCreating account for alanna.belair@gmail.com...');
        
        // Create the account with the provided password
        const hashedPassword = await bcrypt.hash(password, 10);
        
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
        
        console.log('Created customer profile with 100 CC balance');
        console.log('\nAccount created successfully!');
        console.log('Email: alanna.belair@gmail.com');
        console.log('Password: [hidden for security]');
      }
    } else {
      // Account exists, let's fix its status if needed
      const user = await pool.query(
        `SELECT id, status, "isActive" FROM "Users" WHERE LOWER(email) = LOWER($1)`,
        ['alanna.belair@gmail.com']
      );
      
      if (user.rows[0].status !== 'active' || !user.rows[0].isActive) {
        console.log('\nFixing account status for alanna.belair@gmail.com...');
        
        await pool.query(
          `UPDATE "Users" 
           SET status = 'active', "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [user.rows[0].id]
        );
        
        console.log('Account status updated to active');
      }
      
      // Ask if password reset is needed
      const resetPassword = await askQuestion('\nDo you want to reset the password? (yes/no): ');
      
      if (resetPassword.toLowerCase() === 'yes') {
        const newPassword = await askQuestion('Enter new password: ');
        
        if (!newPassword || newPassword.length < 6) {
          console.log('Password must be at least 6 characters. Skipping password reset.');
        } else {
          console.log('\nResetting password for alanna.belair@gmail.com...');
          const hashedPassword = await bcrypt.hash(newPassword, 10);
          
          await pool.query(
            `UPDATE "Users" 
             SET password = $1, "updatedAt" = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [hashedPassword, user.rows[0].id]
          );
          
          console.log('Password reset successfully');
          console.log('\nAccount ready for login:');
          console.log('Email: alanna.belair@gmail.com');
          console.log('Password: [hidden for security]');
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    rl.close();
    await pool.end();
  }
}

checkAndFixAlanna();