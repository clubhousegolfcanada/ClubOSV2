import * as dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

async function debugSmartAssist() {
  const API_URL = 'http://localhost:3001/api';
  
  console.log('\n=== Testing Smart Assist Bug ===\n');
  
  // Create a test request that should use LLM
  const testRequest = {
    requestDescription: 'The screen in Bay 3 is not turning on',
    location: 'Bay 3',
    smartAssistEnabled: true,
    routePreference: 'Auto'
  };
  
  console.log('Sending request:', JSON.stringify(testRequest, null, 2));
  
  try {
    const response = await axios.post(`${API_URL}/llm/request`, testRequest);
    
    console.log('\nResponse received:');
    console.log('- Status:', response.data.data.status);
    console.log('- Bot Route:', response.data.data.botRoute);
    console.log('- Has LLM Response:', !!response.data.data.llmResponse);
    console.log('- Slack Thread ID:', response.data.data.slackThreadTs);
    
    if (response.data.data.status === 'sent_to_slack') {
      console.log('\n❌ ERROR: Request was sent to Slack despite Smart Assist being enabled!');
    } else {
      console.log('\n✅ SUCCESS: Request was processed by LLM as expected');
    }
    
    // Check debug endpoint
    console.log('\n=== Checking LLM Service Status ===\n');
    const debugResponse = await axios.post(`${API_URL}/llm/debug-request`, {
      requestDescription: testRequest.requestDescription
    });
    
    console.log('LLM Service Debug Info:');
    console.log('- LLM Enabled:', debugResponse.data.debug.llmEnabled);
    console.log('- System Config LLM Enabled:', debugResponse.data.debug.systemConfig.llmEnabled);
    console.log('- OpenAI Provider:', debugResponse.data.debug.systemConfig.provider);
    console.log('- LLM Error (if any):', debugResponse.data.debug.llmError);
    
  } catch (error: any) {
    console.error('\nError occurred:', error.response?.data || error.message);
  }
}

debugSmartAssist().catch(console.error);
