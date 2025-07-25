import * as dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

async function testSmartAssist() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  
  console.log('Testing Smart Assist routing...\n');
  
  // Test with Smart Assist ON
  console.log('1. Testing with Smart Assist ENABLED:');
  try {
    const response = await axios.post(`${API_URL}/llm/request`, {
      requestDescription: 'Test request with Smart Assist ON',
      smartAssistEnabled: true,
      location: 'Test Location'
    });
    
    console.log('Response:', {
      status: response.data.data.status,
      botRoute: response.data.data.botRoute,
      hasSlackThreadTs: !!response.data.data.slackThreadTs
    });
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
  
  console.log('\n2. Testing with Smart Assist DISABLED:');
  try {
    const response = await axios.post(`${API_URL}/llm/request`, {
      requestDescription: 'Test request with Smart Assist OFF',
      smartAssistEnabled: false,
      location: 'Test Location'
    });
    
    console.log('Response:', {
      status: response.data.data.status,
      botRoute: response.data.data.botRoute,
      hasSlackThreadTs: !!response.data.data.slackThreadTs
    });
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
  
  // Check the debug endpoint
  console.log('\n3. Checking LLM service status:');
  try {
    const debugResponse = await axios.post(`${API_URL}/llm/debug-request`, {
      requestDescription: 'Test debug request'
    });
    
    console.log('Debug info:', debugResponse.data.debug);
  } catch (error: any) {
    console.error('Debug error:', error.response?.data || error.message);
  }
}

testSmartAssist().catch(console.error);