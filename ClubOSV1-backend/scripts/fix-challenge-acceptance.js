const { Pool } = require('pg');

// Railway production database URL
const DATABASE_URL = 'postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixChallengeAcceptance() {
  const client = await pool.connect();
  
  try {
    console.log('Fixing challenge acceptance...\n');
    
    await client.query('BEGIN');
    
    // Get the pending challenge
    const challengeResult = await client.query(
      `SELECT * FROM challenges 
       WHERE status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1`
    );
    
    if (challengeResult.rows.length === 0) {
      console.log('No pending challenges found');
      return;
    }
    
    const challenge = challengeResult.rows[0];
    console.log(`Found challenge: ${challenge.id}`);
    console.log(`Creator: ${challenge.creator_id}`);
    console.log(`Acceptor: ${challenge.acceptor_id}`);
    console.log(`Wager: ${challenge.wager_amount} CC\n`);
    
    // Check current balances
    const creatorBalanceResult = await client.query(
      `SELECT cc_balance FROM customer_profiles WHERE user_id = $1`,
      [challenge.creator_id]
    );
    
    const acceptorBalanceResult = await client.query(
      `SELECT cc_balance FROM customer_profiles WHERE user_id = $1`,
      [challenge.acceptor_id]
    );
    
    const creatorBalance = parseFloat(creatorBalanceResult.rows[0].cc_balance);
    const acceptorBalance = parseFloat(acceptorBalanceResult.rows[0].cc_balance);
    const creatorStake = parseFloat(challenge.creator_stake_amount);
    const acceptorStake = parseFloat(challenge.acceptor_stake_amount);
    
    console.log('Balances before:');
    console.log(`  Creator: ${creatorBalance} CC (needs ${creatorStake} CC)`);
    console.log(`  Acceptor: ${acceptorBalance} CC (needs ${acceptorStake} CC)\n`);
    
    // Deduct stakes from balances
    const newCreatorBalance = creatorBalance - creatorStake;
    const newAcceptorBalance = acceptorBalance - acceptorStake;
    
    console.log('Deducting stakes...');
    
    // Update creator balance
    await client.query(
      `UPDATE customer_profiles SET cc_balance = $1 WHERE user_id = $2`,
      [newCreatorBalance, challenge.creator_id]
    );
    console.log(`  Creator new balance: ${newCreatorBalance} CC`);
    
    // Update acceptor balance
    await client.query(
      `UPDATE customer_profiles SET cc_balance = $1 WHERE user_id = $2`,
      [newAcceptorBalance, challenge.acceptor_id]
    );
    console.log(`  Acceptor new balance: ${newAcceptorBalance} CC\n`);
    
    // Log CC transactions
    await client.query(
      `INSERT INTO cc_transactions (
        user_id, type, amount, balance_before, balance_after,
        challenge_id, description, created_at
      ) VALUES 
        ($1, 'stake_lock', $2, $3, $4, $5, 'Challenge stake locked (creator)', CURRENT_TIMESTAMP),
        ($6, 'stake_lock', $7, $8, $9, $10, 'Challenge stake locked (acceptor)', CURRENT_TIMESTAMP)`,
      [
        challenge.creator_id, -creatorStake, creatorBalance, newCreatorBalance, challenge.id,
        challenge.acceptor_id, -acceptorStake, acceptorBalance, newAcceptorBalance, challenge.id
      ]
    );
    console.log('CC transactions logged');
    
    // Update stakes table
    await client.query(
      `UPDATE stakes 
       SET is_locked = true, locked_at = CURRENT_TIMESTAMP
       WHERE challenge_id = $1`,
      [challenge.id]
    );
    console.log('Stakes locked');
    
    // Update challenge status to accepted
    await client.query(
      `UPDATE challenges 
       SET status = 'accepted', 
           accepted_at = CURRENT_TIMESTAMP,
           sent_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [challenge.id]
    );
    console.log('Challenge status updated to accepted');
    
    // Log audit
    await client.query(
      `INSERT INTO challenge_audit (
        challenge_id, event_type, user_id, old_status, new_status, created_at
      ) VALUES ($1, 'accepted', $2, 'pending', 'accepted', CURRENT_TIMESTAMP)`,
      [challenge.id, challenge.acceptor_id]
    );
    console.log('Audit logged\n');
    
    await client.query('COMMIT');
    
    console.log('✅ Challenge accepted successfully!');
    console.log('The challenge should now appear in the active challenges list.');
    
    // Verify the challenge is now accepted
    const verifyResult = await client.query(
      `SELECT status, accepted_at FROM challenges WHERE id = $1`,
      [challenge.id]
    );
    
    console.log(`\nVerification: Status = ${verifyResult.rows[0].status}`);
    console.log(`Accepted at: ${verifyResult.rows[0].accepted_at}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixChallengeAcceptance();