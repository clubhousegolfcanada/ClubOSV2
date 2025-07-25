import * as dotenv from 'dotenv';
dotenv.config();

interface ApiResponse {
  success: boolean;
  data?: {
    status?: string;
    botRoute?: string;
    llmResponse?: any;
    slackThreadTs?: string;
  };
  error?: string;
}

async function testAPI() {
  const API_URL = 'http://localhost:3001/api';
  
  console.log('Testing LLM API directly...\n');
  
  // Test 1: Smart Assist ON (should use LLM)
  console.log('=== TEST 1: Smart Assist ENABLED ===');
  try {
    const response = await fetch(`${API_URL}/llm/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestDescription: 'Equipment is making a loud noise in bay 3',
        location: 'Bay 3',
        smartAssistEnabled: true,
        routePreference: 'Auto'
      })
    });
    
    const data = await response.json() as ApiResponse;
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    console.log('Was sent to Slack?', data.data?.status === 'sent_to_slack');
    console.log('Bot route:', data.data?.botRoute);
    console.log('Has LLM response?', !!data.data?.llmResponse);
    console.log('\n');
  } catch (error) {
    console.error('Error:', error);
  }
  
  // Test 2: Smart Assist OFF (should go to Slack)
  console.log('=== TEST 2: Smart Assist DISABLED ===');
  try {
    const response = await fetch(`${API_URL}/llm/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestDescription: 'Equipment is making a loud noise in bay 3',
        location: 'Bay 3',
        smartAssistEnabled: false
      })
    });
    
    const data = await response.json() as ApiResponse;
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    console.log('Was sent to Slack?', data.data?.status === 'sent_to_slack');
    console.log('\n');
  } catch (error) {
    console.error('Error:', error);
  }
  
  // Test 3: Check what types the API expects
  console.log('=== TEST 3: Testing with string "true" ===');
  try {
    const response = await fetch(`${API_URL}/llm/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestDescription: 'Equipment is making a loud noise in bay 3',
        location: 'Bay 3',
        smartAssistEnabled: 'true' // String instead of boolean
      })
    });
    
    const data = await response.json() as ApiResponse;
    console.log('Response status:', response.status);
    console.log('Was sent to Slack?', data.data?.status === 'sent_to_slack');
    console.log('\n');
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPI().catch(console.error);
