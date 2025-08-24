const { Pool } = require('pg');

const DATABASE_URL = "postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway";
const pool = new Pool({ connectionString: DATABASE_URL });

async function removeGhostAccount() {
  const client = await pool.connect();
  
  try {
    console.log('=== REMOVING alannabelair@gmail.com COMPLETELY ===\n');
    
    await client.query('BEGIN');
    
    // Get the user ID
    const user = await client.query(
      'SELECT id FROM users WHERE email = $1',
      ['alannabelair@gmail.com']
    );
    
    if (user.rows.length === 0) {
      console.log('Account not found in users table');
      return;
    }
    
    const userId = user.rows[0].id;
    console.log('Found user ID:', userId);
    
    // Delete in correct order to avoid foreign key violations
    console.log('\nDeleting related data...');
    
    // 1. Delete request logs
    const reqLogs = await client.query('DELETE FROM request_logs WHERE user_id = $1', [userId]);
    console.log('  - Deleted', reqLogs.rowCount, 'request logs');
    
    // 2. Delete auth logs
    const authLogs = await client.query('DELETE FROM auth_logs WHERE user_id = $1', [userId]);
    console.log('  - Deleted', authLogs.rowCount, 'auth logs');
    
    // 3. Delete challenge winner selections
    const winnerSel = await client.query('DELETE FROM challenge_winner_selections WHERE user_id = $1', [userId]);
    console.log('  - Deleted', winnerSel.rowCount, 'challenge winner selections');
    
    // 4. Delete challenge audit
    const challAudit = await client.query('DELETE FROM challenge_audit WHERE user_id = $1', [userId]);
    console.log('  - Deleted', challAudit.rowCount, 'challenge audit records');
    
    // 5. Delete stakes
    const stakes = await client.query('DELETE FROM stakes WHERE user_id = $1', [userId]);
    console.log('  - Deleted', stakes.rowCount, 'stakes');
    
    // 6. Delete challenges (as creator or acceptor)
    const challenges = await client.query(
      'DELETE FROM challenges WHERE creator_id = $1 OR acceptor_id = $1',
      [userId]
    );
    console.log('  - Deleted', challenges.rowCount, 'challenges');
    
    // 7. Delete friendships
    const friendships = await client.query(
      'DELETE FROM friendships WHERE user_id = $1 OR friend_id = $1',
      [userId]
    );
    console.log('  - Deleted', friendships.rowCount, 'friendships');
    
    // 8. Delete seasonal CC earnings
    const seasonal = await client.query('DELETE FROM seasonal_cc_earnings WHERE user_id = $1', [userId]);
    console.log('  - Deleted', seasonal.rowCount, 'seasonal CC earnings');
    
    // 9. Delete CC transactions
    const ccTrans = await client.query('DELETE FROM cc_transactions WHERE user_id = $1', [userId]);
    console.log('  - Deleted', ccTrans.rowCount, 'CC transactions');
    
    // 10. Delete rank history
    const rankHist = await client.query('DELETE FROM rank_history WHERE user_id = $1', [userId]);
    console.log('  - Deleted', rankHist.rowCount, 'rank history records');
    
    // 11. Delete rank assignments
    const rankAssign = await client.query('DELETE FROM rank_assignments WHERE user_id = $1', [userId]);
    console.log('  - Deleted', rankAssign.rowCount, 'rank assignments');
    
    // 12. Delete customer profile
    const profile = await client.query('DELETE FROM customer_profiles WHERE user_id = $1', [userId]);
    console.log('  - Deleted', profile.rowCount, 'customer profile');
    
    // 13. Finally, delete the user from lowercase users table
    const userDel = await client.query('DELETE FROM users WHERE id = $1', [userId]);
    console.log('  - Deleted', userDel.rowCount, 'user record');
    
    // Check if exists in uppercase Users table
    const upperCheck = await client.query(
      'SELECT id FROM "Users" WHERE email = $1',
      ['alannabelair@gmail.com']
    );
    
    if (upperCheck.rows.length > 0) {
      const upperDel = await client.query(
        'DELETE FROM "Users" WHERE email = $1',
        ['alannabelair@gmail.com']
      );
      console.log('  - Also deleted from Users (uppercase) table');
    }
    
    await client.query('COMMIT');
    console.log('\n✅ Successfully removed alannabelair@gmail.com completely!');
    
    // Verify deletion
    console.log('\n=== VERIFICATION ===');
    const verifyLower = await client.query('SELECT * FROM users WHERE email = $1', ['alannabelair@gmail.com']);
    const verifyUpper = await client.query('SELECT * FROM "Users" WHERE email = $1', ['alannabelair@gmail.com']);
    
    console.log('Exists in users table:', verifyLower.rows.length > 0 ? 'YES ❌' : 'NO ✅');
    console.log('Exists in Users table:', verifyUpper.rows.length > 0 ? 'YES ❌' : 'NO ✅');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error removing account:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

removeGhostAccount().catch(console.error);