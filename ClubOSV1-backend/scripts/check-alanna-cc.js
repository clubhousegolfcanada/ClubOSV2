const { Pool } = require('pg');

// Railway production database URL
const DATABASE_URL = 'postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkAndFixAlannaCC() {
  try {
    console.log('Checking Alanna\'s account and CC balance...\n');
    
    // Get user ID
    const userResult = await pool.query(
      `SELECT id, email, name FROM "Users" WHERE LOWER(email) = LOWER($1)`,
      ['alanna.belair@gmail.com']
    );
    
    if (userResult.rows.length === 0) {
      console.log('User not found!');
      return;
    }
    
    const user = userResult.rows[0];
    console.log(`Found user: ${user.name} (${user.email})`);
    console.log(`User ID: ${user.id}\n`);
    
    // Check customer_profiles table
    const profileResult = await pool.query(
      `SELECT * FROM customer_profiles WHERE user_id = $1`,
      [user.id]
    );
    
    if (profileResult.rows.length === 0) {
      console.log('No customer profile found! Creating one...');
      
      await pool.query(
        `INSERT INTO customer_profiles (user_id, cc_balance, rank_tier, total_challenges_won, total_challenges_played)
         VALUES ($1, 100, 'house', 0, 0)`,
        [user.id]
      );
      
      console.log('✅ Created customer profile with 100 CC balance');
    } else {
      const profile = profileResult.rows[0];
      console.log('Customer Profile:');
      console.log(`  CC Balance: ${profile.cc_balance}`);
      console.log(`  Rank: ${profile.rank_tier}`);
      console.log(`  Challenges Won: ${profile.total_challenges_won}`);
      console.log(`  Challenges Played: ${profile.total_challenges_played}`);
      
      if (profile.cc_balance === 0 || profile.cc_balance === null) {
        console.log('\n⚠️ CC Balance is 0! Updating to 100...');
        
        await pool.query(
          `UPDATE customer_profiles SET cc_balance = 100 WHERE user_id = $1`,
          [user.id]
        );
        
        console.log('✅ Updated CC balance to 100');
      }
    }
    
    // Check challenges
    console.log('\n--- Checking Challenges ---');
    
    // Check pending challenges
    const pendingResult = await pool.query(
      `SELECT c.*, u1.name as creator_name, u2.name as acceptor_name
       FROM challenges c
       JOIN "Users" u1 ON c.creator_id = u1.id
       JOIN "Users" u2 ON c.acceptor_id = u2.id
       WHERE (c.creator_id = $1 OR c.acceptor_id = $1)
       AND c.status = 'pending'`,
      [user.id]
    );
    
    console.log(`\nPending challenges: ${pendingResult.rows.length}`);
    pendingResult.rows.forEach(c => {
      console.log(`  - ${c.creator_name} vs ${c.acceptor_name} (${c.wager_amount} CC)`);
    });
    
    // Check accepted/active challenges
    const activeResult = await pool.query(
      `SELECT c.*, u1.name as creator_name, u2.name as acceptor_name
       FROM challenges c
       JOIN "Users" u1 ON c.creator_id = u1.id
       JOIN "Users" u2 ON c.acceptor_id = u2.id
       WHERE (c.creator_id = $1 OR c.acceptor_id = $1)
       AND c.status IN ('accepted', 'active')`,
      [user.id]
    );
    
    console.log(`\nActive/Accepted challenges: ${activeResult.rows.length}`);
    activeResult.rows.forEach(c => {
      console.log(`  - ${c.creator_name} vs ${c.acceptor_name} (${c.wager_amount} CC) - Status: ${c.status}`);
    });
    
    // Check if there are challenges with wrong status
    const allChallengesResult = await pool.query(
      `SELECT c.*, u1.name as creator_name, u2.name as acceptor_name
       FROM challenges c
       JOIN "Users" u1 ON c.creator_id = u1.id
       JOIN "Users" u2 ON c.acceptor_id = u2.id
       WHERE (c.creator_id = $1 OR c.acceptor_id = $1)
       ORDER BY c.created_at DESC
       LIMIT 10`,
      [user.id]
    );
    
    console.log(`\nAll recent challenges (last 10):`);
    allChallengesResult.rows.forEach(c => {
      console.log(`  - ${c.creator_name} vs ${c.acceptor_name} (${c.wager_amount} CC)`);
      console.log(`    Status: ${c.status}, Created: ${c.created_at}`);
      console.log(`    Challenge ID: ${c.id}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAndFixAlannaCC();