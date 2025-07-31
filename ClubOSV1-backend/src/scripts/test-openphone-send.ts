#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { openPhoneService } from '../services/openphoneService';
import { logger } from '../utils/logger';

dotenv.config();

async function testOpenPhoneSend() {
  console.log('🧪 Testing OpenPhone Send Message...\n');
  
  // Check required environment variables
  const required = ['OPENPHONE_API_KEY', 'OPENPHONE_DEFAULT_NUMBER'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    return;
  }
  
  // Test parameters - update these
  const testTo = '+1234567890'; // Replace with your test number
  const testFrom = process.env.OPENPHONE_DEFAULT_NUMBER!;
  const testMessage = 'Test message from ClubOS - OpenPhone integration test';
  
  console.log('📤 Sending test message:');
  console.log(`   From: ${testFrom}`);
  console.log(`   To: ${testTo}`);
  console.log(`   Message: ${testMessage}`);
  console.log('');
  
  try {
    const result = await openPhoneService.sendMessage(testTo, testFrom, testMessage);
    
    console.log('✅ Message sent successfully!');
    console.log('Response:', JSON.stringify(result, null, 2));
    
  } catch (error: any) {
    console.error('❌ Failed to send message:');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('\nAPI Response:');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      console.error('Headers:', error.response.headers);
    }
    
    console.error('\n💡 Common issues:');
    console.error('1. Check that OPENPHONE_API_KEY is valid');
    console.error('2. Verify the "from" number is associated with your OpenPhone account');
    console.error('3. Ensure the "to" number is in the correct format (+1XXXXXXXXXX)');
    console.error('4. Check if you need phoneNumberId instead of just the phone number');
  }
}

// Run test
testOpenPhoneSend().catch(console.error);