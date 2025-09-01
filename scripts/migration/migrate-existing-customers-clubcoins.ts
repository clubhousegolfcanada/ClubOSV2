#!/usr/bin/env npx tsx
/**
 * Migration script to grant 100 CC signup bonus to existing customers
 * who were created before the ClubCoin system was implemented.
 * 
 * This ensures all customers have the founding member bonus.
 */

import { pool } from '../ClubOSV1-backend/src/utils/database';
import { clubCoinService } from '../ClubOSV1-backend/src/services/clubCoinService';
import { logger } from '../ClubOSV1-backend/src/utils/logger';

interface CustomerToMigrate {
  id: string;
  email: string;
  name: string;
  created_at: Date;
  cc_balance: number;
  has_initial_grant: boolean;
}

async function findCustomersWithoutBonus(): Promise<CustomerToMigrate[]> {
  const query = `
    SELECT 
      u.id,
      u.email,
      u.name,
      u."createdAt" as created_at,
      COALESCE(cp.cc_balance, 0) as cc_balance,
      EXISTS(
        SELECT 1 FROM cc_transactions ct
        WHERE ct.user_id = u.id 
        AND ct.type = 'initial_grant'
      ) as has_initial_grant
    FROM "Users" u
    LEFT JOIN customer_profiles cp ON cp.user_id = u.id
    WHERE u.role = 'customer'
    AND u.status = 'active'
    ORDER BY u."createdAt" ASC
  `;

  const result = await pool.query(query);
  return result.rows.filter(row => !row.has_initial_grant);
}

async function grantFoundingMemberBonus(customer: CustomerToMigrate): Promise<boolean> {
  try {
    // First ensure customer profile exists
    await pool.query(
      `INSERT INTO customer_profiles (user_id, cc_balance, current_rank)
       VALUES ($1, 0, 'house')
       ON CONFLICT (user_id) DO NOTHING`,
      [customer.id]
    );

    // Grant the 100 CC bonus
    await clubCoinService.credit({
      userId: customer.id,
      type: 'initial_grant',
      amount: 100,
      description: 'Founding Member Bonus - Welcome to Clubhouse Challenges!'
    });

    // Add to current season if not already there
    const seasonResult = await pool.query(
      `SELECT id FROM seasons WHERE status = 'active' LIMIT 1`
    );

    if (seasonResult.rows.length > 0) {
      const seasonId = seasonResult.rows[0].id;
      await pool.query(
        `INSERT INTO seasonal_cc_earnings 
         (user_id, season_id, cc_from_bonuses, cc_net, challenges_completed) 
         VALUES ($1, $2, 100, 100, 0)
         ON CONFLICT (user_id, season_id) 
         DO UPDATE SET 
           cc_from_bonuses = seasonal_cc_earnings.cc_from_bonuses + 100,
           cc_net = seasonal_cc_earnings.cc_net + 100`,
        [customer.id, seasonId]
      );
    }

    return true;
  } catch (error) {
    logger.error(`Failed to grant bonus to ${customer.email}:`, error);
    return false;
  }
}

async function runMigration() {
  console.log('🚀 Starting ClubCoin Migration for Existing Customers');
  console.log('================================================\n');

  try {
    // Find customers needing migration
    console.log('🔍 Finding customers without initial CC grant...');
    const customersToMigrate = await findCustomersWithoutBonus();

    if (customersToMigrate.length === 0) {
      console.log('✅ All customers already have their initial CC grant!');
      return;
    }

    console.log(`📊 Found ${customersToMigrate.length} customers to migrate\n`);

    // Show preview
    console.log('Preview of customers to receive 100 CC:');
    console.log('----------------------------------------');
    customersToMigrate.slice(0, 5).forEach(c => {
      console.log(`  ${c.name} (${c.email}) - Current balance: ${c.cc_balance} CC`);
    });
    if (customersToMigrate.length > 5) {
      console.log(`  ... and ${customersToMigrate.length - 5} more`);
    }
    console.log('');

    // Confirm before proceeding
    if (process.env.AUTO_CONFIRM !== 'true') {
      console.log('⚠️  This will grant 100 CC to each customer listed above.');
      console.log('   To proceed automatically, set AUTO_CONFIRM=true');
      console.log('   Press Ctrl+C to cancel, or wait 10 seconds to continue...\n');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    // Process each customer
    console.log('💰 Granting founding member bonuses...\n');
    let successCount = 0;
    let failCount = 0;

    for (const customer of customersToMigrate) {
      process.stdout.write(`Processing ${customer.name}... `);
      const success = await grantFoundingMemberBonus(customer);
      
      if (success) {
        console.log('✅');
        successCount++;
      } else {
        console.log('❌');
        failCount++;
      }

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Summary
    console.log('\n📈 Migration Complete!');
    console.log('====================');
    console.log(`✅ Successfully granted: ${successCount} customers`);
    if (failCount > 0) {
      console.log(`❌ Failed: ${failCount} customers`);
    }
    console.log(`💰 Total CC granted: ${successCount * 100} CC`);

    // Verify results
    console.log('\n🔍 Verifying migration results...');
    const verifyQuery = `
      SELECT 
        COUNT(DISTINCT u.id) as total_customers,
        COUNT(DISTINCT ct.user_id) as customers_with_grant,
        SUM(CASE WHEN cp.cc_balance >= 100 THEN 1 ELSE 0 END) as customers_with_100cc
      FROM "Users" u
      LEFT JOIN customer_profiles cp ON cp.user_id = u.id
      LEFT JOIN cc_transactions ct ON ct.user_id = u.id AND ct.type = 'initial_grant'
      WHERE u.role = 'customer' AND u.status = 'active'
    `;

    const verifyResult = await pool.query(verifyQuery);
    const stats = verifyResult.rows[0];

    console.log(`Total active customers: ${stats.total_customers}`);
    console.log(`Customers with initial grant: ${stats.customers_with_grant}`);
    console.log(`Customers with 100+ CC: ${stats.customers_with_100cc}`);

    if (stats.total_customers === stats.customers_with_grant) {
      console.log('\n✅ SUCCESS: All active customers now have their founding member bonus!');
    } else {
      const missing = stats.total_customers - stats.customers_with_grant;
      console.log(`\n⚠️  WARNING: ${missing} customers still missing initial grant`);
      console.log('   Run the script again or check logs for errors');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n✨ Migration script completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { findCustomersWithoutBonus, grantFoundingMemberBonus };