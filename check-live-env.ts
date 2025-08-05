import axios from 'axios';

const API_URL = 'https://clubosv2-production.up.railway.app';

async function checkLiveEnvironment() {
  console.log('🔍 CHECKING LIVE ENVIRONMENT');
  console.log('==========================\n');
  
  try {
    // Create a test endpoint that returns environment status
    const testEndpoint = `${API_URL}/api/debug/env-check`;
    
    console.log('Checking:', testEndpoint);
    
    // Try to fetch environment status
    const response = await axios.get(testEndpoint, {
      headers: {
        'X-Debug-Token': 'check-env-vars'
      }
    });
    
    console.log('Response:', response.data);
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log('Debug endpoint not found. Let me check the health endpoint...\n');
      
      try {
        const healthResponse = await axios.get(`${API_URL}/api/health`);
        console.log('Health check response:', healthResponse.data);
        
        // Check if assistant service is mentioned
        if (healthResponse.data.services) {
          console.log('\nService statuses:');
          Object.entries(healthResponse.data.services).forEach(([service, status]) => {
            console.log(`- ${service}: ${status}`);
          });
        }
      } catch (healthError: any) {
        console.log('Health check failed:', healthError.message);
      }
    } else {
      console.log('Error:', error.message);
    }
  }
  
  // Try to get AI automation status
  console.log('\n🤖 Checking AI Automation Status...');
  try {
    const automationResponse = await axios.get(`${API_URL}/api/ai-automations/status`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log('AI Automation status:', automationResponse.data);
  } catch (error: any) {
    console.log('Failed to get automation status:', error.response?.status || error.message);
  }
  
  console.log('\n✅ Check complete');
}

checkLiveEnvironment();