/**
 * Script to fix total_cc_earned and total_cc_spent for all users
 * This ensures the totals match the actual transaction history
 */

import { pool } from '../src/utils/database';
import { logger } from '../src/utils/logger';

async function fixCCTotals() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Starting CC totals fix...');
    
    // First, get all users with customer profiles
    const usersResult = await client.query(`
      SELECT u.id, u.name, u.email, cp.cc_balance, cp.total_cc_earned, cp.total_cc_spent
      FROM users u
      JOIN customer_profiles cp ON cp.user_id = u.id
      WHERE u.role = 'customer'
      ORDER BY u.name
    `);
    
    console.log(`Found ${usersResult.rows.length} customers to check`);
    
    let fixedCount = 0;
    
    for (const user of usersResult.rows) {
      // Calculate actual totals from transaction history
      const totalsResult = await client.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_earned,
          COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_spent,
          COALESCE(SUM(amount), 0) as net_amount
        FROM cc_transactions
        WHERE user_id = $1
      `, [user.id]);
      
      const actualTotals = totalsResult.rows[0];
      const calculatedBalance = parseFloat(actualTotals.net_amount);
      const currentBalance = parseFloat(user.cc_balance || 0);
      const currentEarned = parseFloat(user.total_cc_earned || 0);
      const currentSpent = parseFloat(user.total_cc_spent || 0);
      const actualEarned = parseFloat(actualTotals.total_earned);
      const actualSpent = parseFloat(actualTotals.total_spent);
      
      // Check if update is needed
      const needsUpdate = 
        Math.abs(currentEarned - actualEarned) > 0.01 ||
        Math.abs(currentSpent - actualSpent) > 0.01;
      
      if (needsUpdate) {
        console.log(`\n📊 ${user.name} (${user.email}):`);
        console.log(`   Current: Balance=${currentBalance}, Earned=${currentEarned}, Spent=${currentSpent}`);
        console.log(`   Actual:  Balance=${currentBalance}, Earned=${actualEarned}, Spent=${actualSpent}`);
        console.log(`   Net from transactions: ${calculatedBalance}`);
        
        // Update the totals
        await client.query(`
          UPDATE customer_profiles
          SET 
            total_cc_earned = $1,
            total_cc_spent = $2
          WHERE user_id = $3
        `, [actualEarned, actualSpent, user.id]);
        
        console.log(`   ✅ Fixed totals for ${user.name}`);
        fixedCount++;
      }
    }
    
    // Also check for any missing transactions that explain balance discrepancies
    const discrepanciesResult = await client.query(`
      SELECT 
        u.id,
        u.name,
        cp.cc_balance,
        COALESCE((
          SELECT SUM(amount) 
          FROM cc_transactions 
          WHERE user_id = u.id
        ), 0) as transaction_sum
      FROM users u
      JOIN customer_profiles cp ON cp.user_id = u.id
      WHERE u.role = 'customer'
        AND ABS(cp.cc_balance - COALESCE((
          SELECT SUM(amount) 
          FROM cc_transactions 
          WHERE user_id = u.id
        ), 0)) > 0.01
    `);
    
    if (discrepanciesResult.rows.length > 0) {
      console.log('\n⚠️ Found balance discrepancies (balance doesn\'t match transaction sum):');
      for (const row of discrepanciesResult.rows) {
        const balance = parseFloat(row.cc_balance);
        const txSum = parseFloat(row.transaction_sum);
        const diff = balance - txSum;
        console.log(`   ${row.name}: Balance=${balance}, Transactions=${txSum}, Difference=${diff}`);
        
        // Create a reconciliation transaction if needed
        if (Math.abs(diff) > 0.01) {
          console.log(`   Creating reconciliation transaction for ${diff} CC...`);
          await client.query(`
            INSERT INTO cc_transactions (
              user_id, type, amount, balance_before, balance_after,
              description, metadata, created_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, NOW()
            )
          `, [
            row.id,
            diff > 0 ? 'admin_credit' : 'admin_debit',
            diff,
            txSum,
            balance,
            'Balance reconciliation - historical adjustment',
            JSON.stringify({
              reason: 'Reconciling historical balance with transaction history',
              original_balance: balance,
              transaction_sum: txSum,
              adjustment: diff
            })
          ]);
          
          // Now update the totals again
          const newTotals = await client.query(`
            SELECT 
              COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_earned,
              COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_spent
            FROM cc_transactions
            WHERE user_id = $1
          `, [row.id]);
          
          await client.query(`
            UPDATE customer_profiles
            SET 
              total_cc_earned = $1,
              total_cc_spent = $2
            WHERE user_id = $3
          `, [newTotals.rows[0].total_earned, newTotals.rows[0].total_spent, row.id]);
          
          console.log(`   ✅ Reconciled ${row.name}`);
        }
      }
    }
    
    console.log(`\n✅ Fixed ${fixedCount} user profiles`);
    console.log('✅ All CC totals have been corrected!');
    
  } catch (error) {
    console.error('❌ Error fixing CC totals:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the fix
fixCCTotals()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });