#!/usr/bin/env npx tsx
/**
 * Check booking rewards on Railway production database
 * Run: cd ClubOSV1-backend && npx tsx ../scripts/check-railway-booking-rewards.ts
 */

import pkg from '../ClubOSV1-backend/node_modules/pg/lib/index.js';
const { Client } = pkg;

const DATABASE_URL = "postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway";

async function checkRailway() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Railway production database\n');

    // Check if table exists
    console.log('1️⃣ Checking if booking_rewards table exists...');
    const tableResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'booking_rewards'
      );
    `);

    if (tableResult.rows[0].exists) {
      console.log('✅ booking_rewards table EXISTS on Railway!\n');

      // Check columns
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'booking_rewards'
        ORDER BY ordinal_position;
      `);

      console.log('Table columns:');
      columnsResult.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(required)' : ''}`);
      });

      // Check for any rewards
      const countResult = await client.query(`
        SELECT 
          status, 
          COUNT(*) as count
        FROM booking_rewards
        GROUP BY status;
      `);

      console.log('\n2️⃣ Current rewards status:');
      if (countResult.rows.length > 0) {
        countResult.rows.forEach(row => {
          console.log(`  - ${row.status}: ${row.count} rewards`);
        });
      } else {
        console.log('  No rewards in the system yet');
      }

      // Check indexes
      const indexResult = await client.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'booking_rewards';
      `);

      console.log('\n3️⃣ Indexes:');
      indexResult.rows.forEach(idx => {
        console.log(`  - ${idx.indexname}`);
      });

    } else {
      console.log('❌ booking_rewards table DOES NOT EXIST on Railway!');
      console.log('   Migration needs to run on production');
    }

    // Check if booking_reward transaction type exists
    console.log('\n4️⃣ Checking transaction types...');
    const enumResult = await client.query(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'transaction_type'
      );
    `);

    if (enumResult.rows.length > 0) {
      const types = enumResult.rows.map(r => r.enumlabel);
      if (types.includes('booking_reward')) {
        console.log('✅ booking_reward transaction type EXISTS');
      } else {
        console.log('⚠️  booking_reward transaction type NOT FOUND');
        console.log('   Available types:', types.join(', '));
      }
    }

    // Check for users with hubspot_contact_id
    console.log('\n5️⃣ Checking for HubSpot-linked users...');
    const hubspotResult = await client.query(`
      SELECT COUNT(*) as count
      FROM customer_profiles
      WHERE hubspot_contact_id IS NOT NULL;
    `);

    console.log(`  Found ${hubspotResult.rows[0].count} users with HubSpot contact IDs`);

    console.log('\n✅ Railway database audit complete!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkRailway();