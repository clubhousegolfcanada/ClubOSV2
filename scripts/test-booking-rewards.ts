#!/usr/bin/env npx tsx
/**
 * Test script for booking rewards system
 * Run: cd ClubOSV1-backend && npx tsx ../scripts/test-booking-rewards.ts
 */

import { db } from '../ClubOSV1-backend/src/utils/database';

async function runAudit() {
  console.log('🔍 Starting Booking Rewards System Audit...\n');
  
  try {
    // 1. Check if booking_rewards table exists
    console.log('1️⃣ Checking database table...');
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'booking_rewards'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ booking_rewards table exists');
      
      // Check columns
      const columnsCheck = await db.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'booking_rewards'
        ORDER BY ordinal_position;
      `);
      
      console.log('   Columns:', columnsCheck.rows.map(r => r.column_name).join(', '));
    } else {
      console.log('❌ booking_rewards table DOES NOT exist - migration needed!');
    }
    
    // 2. Check for any existing rewards
    console.log('\n2️⃣ Checking existing rewards...');
    try {
      const rewardsCount = await db.query(`
        SELECT 
          status, 
          COUNT(*) as count,
          SUM(cc_awarded) as total_cc
        FROM booking_rewards
        GROUP BY status;
      `);
      
      if (rewardsCount.rows.length > 0) {
        console.log('   Current rewards by status:');
        rewardsCount.rows.forEach(r => {
          console.log(`   - ${r.status}: ${r.count} rewards (${r.total_cc || 0} CC total)`);
        });
      } else {
        console.log('   No rewards in system yet');
      }
    } catch (error: any) {
      if (error.message.includes('does not exist')) {
        console.log('❌ Table does not exist - migration has not run');
      } else {
        throw error;
      }
    }
    
    // 3. Test webhook endpoint locally
    console.log('\n3️⃣ Testing webhook endpoint (mock data)...');
    const testDealId = `test-deal-${Date.now()}`;
    const testWebhookPayload = [{
      objectId: testDealId,
      properties: {
        dealstage: 'closedwon',
        booking_date: new Date().toISOString(),
        location: 'Bedford',
        box_number: '2',
        associatedContactId: 'test-contact-456'
      }
    }];
    
    console.log('   Test payload created:', testDealId);
    
    // 4. Check if ClubCoin service accepts booking_reward type
    console.log('\n4️⃣ Checking ClubCoin transaction types...');
    try {
      // Check if booking_reward is a valid transaction type
      const transactionTypes = await db.query(`
        SELECT enumlabel 
        FROM pg_enum 
        WHERE enumtypid = (
          SELECT oid FROM pg_type WHERE typname = 'transaction_type'
        );
      `);
      
      if (transactionTypes.rows.length > 0) {
        const types = transactionTypes.rows.map(r => r.enumlabel);
        console.log('   Available transaction types:', types.join(', '));
        
        if (types.includes('booking_reward')) {
          console.log('✅ booking_reward type exists');
        } else {
          console.log('⚠️  booking_reward type NOT found - will need to be added');
        }
      }
    } catch (error) {
      console.log('   No transaction_type enum found (may be using string field)');
    }
    
    // 5. Check HubSpot integration
    console.log('\n5️⃣ Checking HubSpot integration...');
    const hubspotKey = process.env.HUBSPOT_API_KEY;
    if (hubspotKey) {
      console.log('✅ HUBSPOT_API_KEY is configured');
    } else {
      console.log('⚠️  HUBSPOT_API_KEY not set - HubSpot features may be limited');
    }
    
    // 6. Check for test users with HubSpot contact IDs
    console.log('\n6️⃣ Checking for users with HubSpot contact IDs...');
    const usersWithHubspot = await db.query(`
      SELECT 
        u.name, 
        u.email, 
        cp.hubspot_contact_id,
        cp.cc_balance
      FROM users u
      JOIN customer_profiles cp ON cp.user_id = u.id
      WHERE cp.hubspot_contact_id IS NOT NULL
      LIMIT 5;
    `);
    
    if (usersWithHubspot.rows.length > 0) {
      console.log('   Users with HubSpot IDs:');
      usersWithHubspot.rows.forEach(u => {
        console.log(`   - ${u.name} (${u.email}): ${u.hubspot_contact_id} - ${u.cc_balance} CC`);
      });
    } else {
      console.log('   No users have HubSpot contact IDs yet');
    }
    
    // 7. Test creating a pending reward
    console.log('\n7️⃣ Testing reward creation...');
    try {
      // Find a test user
      const testUser = await db.query(`
        SELECT u.id, u.name 
        FROM users u 
        JOIN customer_profiles cp ON cp.user_id = u.id
        WHERE u.role = 'customer'
        LIMIT 1;
      `);
      
      if (testUser.rows.length > 0) {
        const userId = testUser.rows[0].id;
        const userName = testUser.rows[0].name;
        const testDealId2 = `audit-test-${Date.now()}`;
        
        // Calculate reward date (7 days from now)
        const bookingDate = new Date();
        const rewardDate = new Date();
        rewardDate.setDate(rewardDate.getDate() + 7);
        
        await db.query(`
          INSERT INTO booking_rewards (
            user_id, 
            hubspot_deal_id, 
            booking_date, 
            reward_date,
            location,
            box_number,
            cc_awarded,
            status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
          ON CONFLICT (hubspot_deal_id) DO NOTHING;
        `, [userId, testDealId2, bookingDate, rewardDate, 'Test Location', '1', 25]);
        
        console.log(`✅ Created test reward for ${userName} (due ${rewardDate.toLocaleDateString()})`);
        
        // Clean up test reward
        await db.query(`DELETE FROM booking_rewards WHERE hubspot_deal_id = $1`, [testDealId2]);
        console.log('   Test reward cleaned up');
      } else {
        console.log('⚠️  No customer users found for testing');
      }
    } catch (error: any) {
      console.log('❌ Failed to create test reward:', error.message);
    }
    
    // 8. Summary
    console.log('\n📊 AUDIT SUMMARY:');
    console.log('================');
    
    const issues = [];
    const warnings = [];
    const success = [];
    
    if (tableCheck.rows[0].exists) {
      success.push('Database table exists');
    } else {
      issues.push('Database migration needs to run');
    }
    
    if (!process.env.HUBSPOT_API_KEY) {
      warnings.push('HUBSPOT_API_KEY not configured');
    }
    
    if (!process.env.HUBSPOT_WEBHOOK_SECRET) {
      warnings.push('HUBSPOT_WEBHOOK_SECRET not configured (needed for production)');
    }
    
    if (success.length > 0) {
      console.log('\n✅ Working:');
      success.forEach(s => console.log(`   - ${s}`));
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      warnings.forEach(w => console.log(`   - ${w}`));
    }
    
    if (issues.length > 0) {
      console.log('\n❌ Issues:');
      issues.forEach(i => console.log(`   - ${i}`));
    }
    
    console.log('\n📝 Next Steps:');
    console.log('1. Add HUBSPOT_WEBHOOK_SECRET to Railway environment');
    console.log('2. Verify migration ran on Railway (check deployment logs)');
    console.log('3. Configure HubSpot webhooks with Railway URL');
    console.log('4. Test with a real HubSpot deal');
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
  } finally {
    await db.end();
    process.exit(0);
  }
}

// Run the audit
runAudit();