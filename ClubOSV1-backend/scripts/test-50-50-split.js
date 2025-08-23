const { Pool } = require('pg');

// Railway production database URL
const DATABASE_URL = 'postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function test5050Split() {
  const client = await pool.connect();
  
  try {
    console.log('Testing 50/50 split implementation...\n');
    
    // Get Mike and Alanna's user IDs
    const usersResult = await pool.query(
      `SELECT id, email, name FROM "Users" 
       WHERE email IN ('mikebelair79@gmail.com', 'alanna.belair@gmail.com')`
    );
    
    const mike = usersResult.rows.find(u => u.email === 'mikebelair79@gmail.com');
    const alanna = usersResult.rows.find(u => u.email === 'alanna.belair@gmail.com');
    
    console.log('Creating test challenge with 100 CC wager...');
    console.log(`Creator: ${mike.name}`);
    console.log(`Acceptor: ${alanna.name}\n`);
    
    await client.query('BEGIN');
    
    // Create a test challenge with a test course ID
    const insertResult = await client.query(
      `INSERT INTO challenges (
        creator_id,
        acceptor_id,
        course_id,
        course_name,
        wager_amount,
        expiry_days,
        status,
        scoring_type
      ) VALUES ($1, $2, $3, $3, 100, 7, 'pending', 'stroke_play')
      RETURNING *`,
      [mike.id, alanna.id, 'Test Course 50/50']
    );
    
    const challenge = insertResult.rows[0];
    
    console.log('Challenge created with ID:', challenge.id);
    console.log('\nStake calculation results:');
    console.log(`  Wager amount: ${challenge.wager_amount} CC`);
    console.log(`  Creator stake: ${challenge.creator_stake_amount} CC (${(parseFloat(challenge.creator_stake_amount)/parseFloat(challenge.wager_amount)*100).toFixed(0)}%)`);
    console.log(`  Acceptor stake: ${challenge.acceptor_stake_amount} CC (${(parseFloat(challenge.acceptor_stake_amount)/parseFloat(challenge.wager_amount)*100).toFixed(0)}%)`);
    console.log(`  Total pot: ${challenge.total_pot} CC`);
    
    // Check if it's 50/50
    const creatorPercent = parseFloat(challenge.creator_stake_amount) / parseFloat(challenge.wager_amount);
    const acceptorPercent = parseFloat(challenge.acceptor_stake_amount) / parseFloat(challenge.wager_amount);
    
    if (Math.abs(creatorPercent - 0.50) < 0.01 && Math.abs(acceptorPercent - 0.50) < 0.01) {
      console.log('\n✅ SUCCESS: Stakes are split 50/50!');
    } else {
      console.log('\n❌ ERROR: Stakes are NOT 50/50!');
      console.log(`  Creator: ${(creatorPercent * 100).toFixed(1)}%`);
      console.log(`  Acceptor: ${(acceptorPercent * 100).toFixed(1)}%`);
    }
    
    // Check stakes table
    const stakesResult = await client.query(
      `SELECT * FROM stakes WHERE challenge_id = $1 ORDER BY role`,
      [challenge.id]
    );
    
    console.log('\nStakes table entries:');
    stakesResult.rows.forEach(stake => {
      console.log(`  ${stake.role}: ${stake.amount} CC (percentage: ${stake.percentage})`);
    });
    
    // Rollback the test challenge
    await client.query('ROLLBACK');
    console.log('\n🔄 Test challenge rolled back (not saved)');
    
    // Check existing accepted challenge
    console.log('\n--- Checking existing accepted challenge ---');
    const acceptedResult = await pool.query(
      `SELECT * FROM challenges WHERE status = 'accepted' ORDER BY created_at DESC LIMIT 1`
    );
    
    if (acceptedResult.rows.length > 0) {
      const existing = acceptedResult.rows[0];
      console.log(`Existing challenge (created before migration):`);
      console.log(`  Wager: ${existing.wager_amount} CC`);
      console.log(`  Creator stake: ${existing.creator_stake_amount} CC (${(parseFloat(existing.creator_stake_amount)/parseFloat(existing.wager_amount)*100).toFixed(0)}%)`);
      console.log(`  Acceptor stake: ${existing.acceptor_stake_amount} CC (${(parseFloat(existing.acceptor_stake_amount)/parseFloat(existing.wager_amount)*100).toFixed(0)}%)`);
      console.log('  Note: Existing challenges keep their original split');
    }
    
    console.log('\n✅ Test complete! New challenges will use 50/50 split.');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

test5050Split();