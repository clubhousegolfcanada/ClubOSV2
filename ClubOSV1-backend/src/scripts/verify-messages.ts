#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { db } from '../utils/database';
import { openPhoneService } from '../services/openphoneService';
import { logger } from '../utils/logger';

dotenv.config();

async function verifyMessagesSetup() {
  console.log('🔍 Verifying OpenPhone Messages Setup...\n');

  let hasErrors = false;

  // 1. Check environment variables
  console.log('1️⃣  Checking environment variables...');
  const requiredEnvVars = [
    'OPENPHONE_API_KEY',
    'OPENPHONE_DEFAULT_NUMBER'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`   ❌ Missing: ${envVar}`);
      hasErrors = true;
    } else {
      console.log(`   ✅ Found: ${envVar}`);
    }
  }

  // 2. Test database connection and tables
  console.log('\n2️⃣  Checking database...');
  try {
    await db.initialize();
    console.log('   ✅ Database connected');

    // Check if migrations have been run
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'openphone_conversations' 
        AND column_name = 'unread_count'
      ) as has_column
    `);

    if (tableCheck.rows[0].has_column) {
      console.log('   ✅ Messages migration applied');
    } else {
      console.error('   ❌ Messages migration not applied - run migration 017');
      hasErrors = true;
    }

    // Check message_status table
    const statusTableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'message_status'
      ) as exists
    `);

    if (statusTableCheck.rows[0].exists) {
      console.log('   ✅ Message status table exists');
    } else {
      console.error('   ❌ Message status table missing');
      hasErrors = true;
    }

  } catch (error) {
    console.error('   ❌ Database error:', error.message);
    hasErrors = true;
  }

  // 3. Test OpenPhone API connection
  console.log('\n3️⃣  Testing OpenPhone API...');
  try {
    const isConnected = await openPhoneService.testConnection();
    if (isConnected) {
      console.log('   ✅ OpenPhone API connected');
      
      const phoneNumbers = await openPhoneService.getPhoneNumbers();
      console.log(`   ✅ Found ${phoneNumbers.length} phone number(s)`);
      
      if (phoneNumbers.length > 0) {
        phoneNumbers.forEach(p => {
          console.log(`      📞 ${p.phoneNumber} (${p.name || 'Default'})`);
        });
      }
    } else {
      console.error('   ❌ OpenPhone API connection failed');
      hasErrors = true;
    }
  } catch (error) {
    console.error('   ❌ OpenPhone API error:', error.message);
    hasErrors = true;
  }

  // 4. Check existing conversations
  console.log('\n4️⃣  Checking existing data...');
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(DISTINCT phone_number) as unique_numbers,
        COUNT(*) as total_conversations,
        COALESCE(SUM(jsonb_array_length(messages)), 0) as total_messages,
        COALESCE(SUM(unread_count), 0) as total_unread
      FROM openphone_conversations
    `);

    const data = stats.rows[0];
    console.log(`   📊 Statistics:`);
    console.log(`      • Unique phone numbers: ${data.unique_numbers}`);
    console.log(`      • Total conversations: ${data.total_conversations}`);
    console.log(`      • Total messages: ${data.total_messages}`);
    console.log(`      • Unread messages: ${data.total_unread}`);

  } catch (error) {
    console.error('   ❌ Error checking data:', error.message);
  }

  // 5. Test webhook endpoint
  console.log('\n5️⃣  Webhook configuration...');
  if (process.env.OPENPHONE_WEBHOOK_SECRET) {
    console.log('   ✅ Webhook secret configured');
  } else {
    console.log('   ⚠️  No webhook secret set (optional but recommended)');
  }

  const apiUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : process.env.API_URL || 'http://localhost:3001';
  
  console.log(`   📌 Webhook URL: ${apiUrl}/api/openphone/webhook`);

  // Summary
  console.log('\n' + '='.repeat(50));
  if (hasErrors) {
    console.log('❌ Setup incomplete - please fix the issues above');
    process.exit(1);
  } else {
    console.log('✅ Messages feature is ready to use!');
    console.log('\nNext steps:');
    console.log('1. Configure webhook in OpenPhone dashboard');
    console.log('2. Test by sending an SMS to your OpenPhone number');
    console.log('3. Check the Messages page in ClubOS');
  }

  await db.close();
}

// Run verification
verifyMessagesSetup().catch(error => {
  console.error('Verification failed:', error);
  process.exit(1);
});