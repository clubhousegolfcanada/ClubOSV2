#!/usr/bin/env tsx

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function testOpenPhoneV1API() {
  console.log('🧪 Testing OpenPhone V1 API directly...\n');
  
  const apiKey = process.env.OPENPHONE_API_KEY;
  const defaultNumber = process.env.OPENPHONE_DEFAULT_NUMBER;
  
  if (!apiKey || !defaultNumber) {
    console.error('❌ Missing required environment variables');
    console.error('OPENPHONE_API_KEY:', apiKey ? '✅' : '❌');
    console.error('OPENPHONE_DEFAULT_NUMBER:', defaultNumber ? '✅' : '❌');
    return;
  }
  
  console.log('📱 Default phone number:', defaultNumber);
  console.log('🔑 API Key:', apiKey.substring(0, 10) + '...');
  
  // Test parameters
  const testTo = '+19024070000'; // Replace with a test number
  const testMessage = 'Test message from ClubOS API v1 test script';
  
  try {
    console.log('\n1️⃣ Testing V1 API format...');
    
    const response = await axios.post(
      'https://api.openphone.com/v1/messages',
      {
        content: testMessage,
        from: defaultNumber,
        to: [testTo]
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ V1 API Success!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error: any) {
    console.error('❌ V1 API Failed');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('\nAPI Response:');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      
      // Check if it's an auth error
      if (error.response.status === 401) {
        console.error('\n⚠️  Authentication failed. Check your API key.');
      }
      
      // Check if it's a validation error
      if (error.response.status === 400) {
        console.error('\n⚠️  Validation error. Check the request format.');
        console.error('You might need additional fields like phoneNumberId or userId');
      }
    }
  }
  
  // Also test if we can get phone numbers
  console.log('\n2️⃣ Getting phone numbers from account...');
  
  try {
    const phoneResponse = await axios.get(
      'https://api.openphone.com/v1/phone-numbers',
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    
    console.log('✅ Phone numbers retrieved:');
    phoneResponse.data.data?.forEach((phone: any) => {
      console.log(`  - ${phone.phoneNumber} (ID: ${phone.id})`);
    });
    
  } catch (error: any) {
    console.error('❌ Failed to get phone numbers');
    console.error('Error:', error.response?.data || error.message);
  }
}

// Run the test
testOpenPhoneV1API().catch(console.error);