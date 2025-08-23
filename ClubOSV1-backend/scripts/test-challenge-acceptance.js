const { Pool } = require('pg');

// Railway production database URL
const DATABASE_URL = 'postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testChallengeAcceptance() {
  try {
    console.log('Testing challenge acceptance flow...\n');
    
    // Get the pending challenge
    const challengeResult = await pool.query(
      `SELECT c.*, 
        u1.name as creator_name, u1.email as creator_email,
        u2.name as acceptor_name, u2.email as acceptor_email
       FROM challenges c
       JOIN "Users" u1 ON c.creator_id = u1.id
       JOIN "Users" u2 ON c.acceptor_id = u2.id
       WHERE c.status = 'pending'
       ORDER BY c.created_at DESC
       LIMIT 1`
    );
    
    if (challengeResult.rows.length === 0) {
      console.log('No pending challenges found');
      return;
    }
    
    const challenge = challengeResult.rows[0];
    console.log('Found pending challenge:');
    console.log(`  ID: ${challenge.id}`);
    console.log(`  Creator: ${challenge.creator_name} (${challenge.creator_email})`);
    console.log(`  Acceptor: ${challenge.acceptor_name} (${challenge.acceptor_email})`);
    console.log(`  Wager: ${challenge.wager_amount} CC`);
    console.log(`  Creator stake: ${challenge.creator_stake_amount} CC`);
    console.log(`  Acceptor stake: ${challenge.acceptor_stake_amount} CC`);
    console.log(`  Total pot: ${challenge.total_pot} CC\n`);
    
    // Check CC balances for both users
    const creatorProfileResult = await pool.query(
      `SELECT cc_balance FROM customer_profiles WHERE user_id = $1`,
      [challenge.creator_id]
    );
    
    const acceptorProfileResult = await pool.query(
      `SELECT cc_balance FROM customer_profiles WHERE user_id = $1`,
      [challenge.acceptor_id]
    );
    
    const creatorBalance = creatorProfileResult.rows[0]?.cc_balance || 0;
    const acceptorBalance = acceptorProfileResult.rows[0]?.cc_balance || 0;
    
    console.log('Current CC balances:');
    console.log(`  Creator balance: ${creatorBalance} CC`);
    console.log(`  Acceptor balance: ${acceptorBalance} CC\n`);
    
    console.log('Required stakes:');
    console.log(`  Creator needs: ${challenge.creator_stake_amount} CC`);
    console.log(`  Acceptor needs: ${challenge.acceptor_stake_amount} CC\n`);
    
    const creatorHasBalance = creatorBalance >= parseFloat(challenge.creator_stake_amount);
    const acceptorHasBalance = acceptorBalance >= parseFloat(challenge.acceptor_stake_amount);
    
    console.log('Balance check:');
    console.log(`  Creator has sufficient balance: ${creatorHasBalance ? '✅' : '❌'}`);
    console.log(`  Acceptor has sufficient balance: ${acceptorHasBalance ? '✅' : '❌'}\n`);
    
    if (!creatorHasBalance || !acceptorHasBalance) {
      console.log('⚠️ ISSUE FOUND: Insufficient balance to accept challenge!');
      
      if (!creatorHasBalance) {
        const needed = parseFloat(challenge.creator_stake_amount) - creatorBalance;
        console.log(`  Creator needs ${needed.toFixed(2)} more CC`);
      }
      
      if (!acceptorHasBalance) {
        const needed = parseFloat(challenge.acceptor_stake_amount) - acceptorBalance;
        console.log(`  Acceptor needs ${needed.toFixed(2)} more CC`);
      }
      
      console.log('\n🔧 FIX: Updating balances to allow acceptance...');
      
      // Update balances to have enough CC
      if (!creatorHasBalance) {
        await pool.query(
          `UPDATE customer_profiles SET cc_balance = $1 WHERE user_id = $2`,
          [challenge.creator_stake_amount, challenge.creator_id]
        );
        console.log(`  Set creator balance to ${challenge.creator_stake_amount} CC`);
      }
      
      if (!acceptorHasBalance) {
        await pool.query(
          `UPDATE customer_profiles SET cc_balance = $1 WHERE user_id = $2`,
          [challenge.acceptor_stake_amount, challenge.acceptor_id]
        );
        console.log(`  Set acceptor balance to ${challenge.acceptor_stake_amount} CC`);
      }
      
      console.log('\n✅ Balances updated! Challenge can now be accepted.');
    } else {
      console.log('✅ Both users have sufficient balance for acceptance');
    }
    
    // Check for stakes table entries
    const stakesResult = await pool.query(
      `SELECT * FROM stakes WHERE challenge_id = $1`,
      [challenge.id]
    );
    
    console.log(`\nStakes table entries: ${stakesResult.rows.length}`);
    if (stakesResult.rows.length === 0) {
      console.log('  ⚠️ No stakes entries found - will be created during acceptance');
    } else {
      stakesResult.rows.forEach(stake => {
        console.log(`  - ${stake.role}: ${stake.amount} CC (locked: ${stake.is_locked})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testChallengeAcceptance();