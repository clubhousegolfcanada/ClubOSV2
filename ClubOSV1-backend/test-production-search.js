/**
 * Test if the production service can actually connect and search
 */

const axios = require('axios');

async function testProductionSearch() {
  console.log('🧪 TESTING PRODUCTION SEARCH\n');
  console.log('=====================================\n');
  
  try {
    // Test the actual production endpoint
    console.log('1️⃣ Testing LLM endpoint with gift card query...\n');
    
    const response = await axios.post('https://clubosv2-production.up.railway.app/api/llm/process', {
      requestDescription: 'do we offer gift cards?',
      userId: 'test-user',
      context: {},
      location: 'test'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('Response received:');
    console.log('  Status:', response.status);
    console.log('  Bot Route:', response.data.data?.botRoute);
    console.log('  Data Source:', response.data.data?.llmResponse?.dataSource);
    console.log('  Is Local Knowledge:', response.data.data?.llmResponse?.isLocalKnowledge);
    console.log('  Processing Time:', response.data.data?.processingTime);
    console.log('  Response:', response.data.data?.llmResponse?.response?.substring(0, 100));
    
    if (response.data.data?.llmResponse?.dataSource === 'LOCAL_DATABASE') {
      console.log('\n✅ SUCCESS: Using local knowledge!');
    } else {
      console.log('\n❌ PROBLEM: Still using OpenAI');
      console.log('\nFull response data:', JSON.stringify(response.data.data?.llmResponse, null, 2));
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testProductionSearch();