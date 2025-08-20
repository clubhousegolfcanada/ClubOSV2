#!/usr/bin/env npx tsx
/**
 * Check specific users for ClubCoin status and leaderboard presence
 */

import { pool } from '../ClubOSV1-backend/src/utils/database';

async function checkUsers() {
  const emails = ['mikebelair79@gmail.com', 'alanna.belair@gmail.com'];
  
  console.log('🔍 Checking User Status and ClubCoins\n');
  console.log('=' .repeat(60));

  for (const email of emails) {
    console.log(`\n📧 Checking: ${email}`);
    console.log('-'.repeat(40));

    try {
      // 1. Check if user exists
      const userResult = await pool.query(
        `SELECT 
          u.id, 
          u.name, 
          u.email,
          u.role,
          u.status,
          u."createdAt" as created_at
        FROM "Users" u 
        WHERE LOWER(u.email) = LOWER($1)`,
        [email]
      );

      if (userResult.rows.length === 0) {
        console.log('❌ User not found in database');
        continue;
      }

      const user = userResult.rows[0];
      console.log('✅ User found:');
      console.log(`   Name: ${user.name}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);

      // 2. Check customer profile and CC balance
      const profileResult = await pool.query(
        `SELECT 
          cc_balance,
          total_cc_earned,
          total_cc_spent,
          current_rank,
          highest_rank_achieved,
          total_challenges_played,
          total_challenges_won
        FROM customer_profiles 
        WHERE user_id = $1`,
        [user.id]
      );

      if (profileResult.rows.length > 0) {
        const profile = profileResult.rows[0];
        console.log('\n💰 ClubCoin Status:');
        console.log(`   Balance: ${profile.cc_balance} CC`);
        console.log(`   Total Earned: ${profile.total_cc_earned} CC`);
        console.log(`   Total Spent: ${profile.total_cc_spent} CC`);
        console.log(`   Current Rank: ${profile.current_rank}`);
        console.log(`   Challenges: ${profile.total_challenges_played} played, ${profile.total_challenges_won} won`);
      } else {
        console.log('\n⚠️  No customer profile found');
      }

      // 3. Check for initial grant transaction
      const transactionResult = await pool.query(
        `SELECT 
          type,
          amount,
          balance_after,
          description,
          created_at
        FROM cc_transactions 
        WHERE user_id = $1 AND type = 'initial_grant'
        ORDER BY created_at DESC LIMIT 1`,
        [user.id]
      );

      if (transactionResult.rows.length > 0) {
        const tx = transactionResult.rows[0];
        console.log('\n✅ Initial Grant Transaction:');
        console.log(`   Amount: ${tx.amount} CC`);
        console.log(`   Balance After: ${tx.balance_after} CC`);
        console.log(`   Date: ${new Date(tx.created_at).toLocaleString()}`);
      } else {
        console.log('\n❌ No initial grant transaction found');
      }

      // 4. Check season leaderboard
      const seasonResult = await pool.query(
        `SELECT 
          s.name as season_name,
          sce.cc_net,
          sce.cc_from_bonuses,
          sce.cc_from_wins,
          sce.challenges_completed,
          (SELECT COUNT(*) + 1 
           FROM seasonal_cc_earnings sce2 
           WHERE sce2.season_id = sce.season_id 
           AND sce2.cc_net > sce.cc_net) as position
        FROM seasonal_cc_earnings sce
        JOIN seasons s ON s.id = sce.season_id
        WHERE sce.user_id = $1 AND s.status = 'active'`,
        [user.id]
      );

      if (seasonResult.rows.length > 0) {
        const season = seasonResult.rows[0];
        console.log('\n🏆 Season Leaderboard:');
        console.log(`   Season: ${season.season_name}`);
        console.log(`   Position: #${season.position}`);
        console.log(`   Net CC: ${season.cc_net}`);
        console.log(`   From Bonuses: ${season.cc_from_bonuses} CC`);
        console.log(`   From Wins: ${season.cc_from_wins} CC`);
      } else {
        console.log('\n⚠️  Not found in current season leaderboard');
      }

      // 5. Check all-time leaderboard visibility
      const allTimeResult = await pool.query(
        `SELECT 
          cp.total_cc_earned,
          (SELECT COUNT(*) + 1 
           FROM customer_profiles cp2 
           WHERE cp2.total_cc_earned > cp.total_cc_earned) as all_time_position
        FROM customer_profiles cp
        WHERE cp.user_id = $1`,
        [user.id]
      );

      if (allTimeResult.rows.length > 0 && allTimeResult.rows[0].total_cc_earned > 0) {
        console.log('\n🌟 All-Time Leaderboard:');
        console.log(`   Position: #${allTimeResult.rows[0].all_time_position}`);
        console.log(`   Total Earned: ${allTimeResult.rows[0].total_cc_earned} CC`);
      } else {
        console.log('\n⚠️  Not visible in all-time leaderboard (0 CC earned)');
      }

    } catch (error) {
      console.error(`\n❌ Error checking ${email}:`, error);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Check complete\n');
}

// Run the check
checkUsers()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });