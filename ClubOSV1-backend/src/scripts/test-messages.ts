#!/usr/bin/env tsx

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function testMessagesAPI() {
  console.log('🧪 Testing Messages API...\n');

  const API_URL = process.env.API_URL || 'http://localhost:3001/api';
  
  // Test user credentials (update these)
  const testEmail = 'admin@clubhouse247golf.com';
  const testPassword = 'your-test-password';
  
  try {
    // 1. Login first
    console.log('1️⃣  Logging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: testEmail,
      password: testPassword
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Logged in successfully\n');
    
    // 2. Test conversations endpoint
    console.log('2️⃣  Testing GET /messages/conversations...');
    const convResponse = await axios.get(`${API_URL}/messages/conversations`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`✅ Found ${convResponse.data.data.length} conversations`);
    if (convResponse.data.data.length > 0) {
      console.log('   First conversation:', {
        customer: convResponse.data.data[0].customer_name,
        phone: convResponse.data.data[0].phone_number,
        unread: convResponse.data.data[0].unread_count
      });
    }
    console.log('');
    
    // 3. Test unread count
    console.log('3️⃣  Testing GET /messages/unread-count...');
    const unreadResponse = await axios.get(`${API_URL}/messages/unread-count`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`✅ Total unread: ${unreadResponse.data.data.totalUnread}\n`);
    
    // 4. Test send message (optional - uncomment to test)
    /*
    console.log('4️⃣  Testing POST /messages/send...');
    const sendResponse = await axios.post(`${API_URL}/messages/send`, {
      to: '+1234567890', // Replace with test number
      text: 'Test message from ClubOS Messages'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Message sent:', sendResponse.data.data);
    */
    
    console.log('✅ All tests passed!');
    console.log('\n📌 Environment variables:');
    console.log(`   OPENPHONE_DEFAULT_NUMBER: ${process.env.OPENPHONE_DEFAULT_NUMBER ? '✅ Set' : '❌ Not set'}`);
    console.log(`   OPENPHONE_API_KEY: ${process.env.OPENPHONE_API_KEY ? '✅ Set' : '❌ Not set'}`);
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.error('\nError details:', {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method
    });
  }
}

// Run tests
testMessagesAPI().catch(console.error);