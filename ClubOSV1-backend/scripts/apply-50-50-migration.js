const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Railway production database URL
const DATABASE_URL = 'postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function apply5050Migration() {
  const client = await pool.connect();
  
  try {
    console.log('Applying 50/50 split migration...\n');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../src/database/migrations/067_challenge_50_50_split.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await client.query('BEGIN');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration applied successfully!');
    
    // Verify the changes
    console.log('\nVerifying changes...');
    
    // Check a pending challenge if exists
    const pendingResult = await client.query(
      `SELECT id, wager_amount, creator_stake_amount, acceptor_stake_amount, total_pot
       FROM challenges
       WHERE status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1`
    );
    
    if (pendingResult.rows.length > 0) {
      const c = pendingResult.rows[0];
      console.log('\nPending challenge after migration:');
      console.log(`  Wager: ${c.wager_amount} CC`);
      console.log(`  Creator stake: ${c.creator_stake_amount} CC (${(parseFloat(c.creator_stake_amount)/parseFloat(c.wager_amount)*100).toFixed(0)}%)`);
      console.log(`  Acceptor stake: ${c.acceptor_stake_amount} CC (${(parseFloat(c.acceptor_stake_amount)/parseFloat(c.wager_amount)*100).toFixed(0)}%)`);
      console.log(`  Total pot: ${c.total_pot} CC`);
    }
    
    // Check stakes table
    const stakesResult = await client.query(
      `SELECT s.*, c.status
       FROM stakes s
       JOIN challenges c ON s.challenge_id = c.id
       WHERE c.status IN ('pending', 'draft')
       ORDER BY s.created_at DESC
       LIMIT 2`
    );
    
    if (stakesResult.rows.length > 0) {
      console.log('\nStakes table after migration:');
      stakesResult.rows.forEach(stake => {
        console.log(`  ${stake.role}: ${stake.amount} CC (${(stake.percentage * 100).toFixed(0)}%)`);
      });
    }
    
    await client.query('COMMIT');
    
    console.log('\n✅ Migration completed and verified!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error applying migration:', error);
    console.error('Details:', error.detail || error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

apply5050Migration();