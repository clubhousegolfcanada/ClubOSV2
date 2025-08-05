import axios from 'axios';

const API_URL = 'https://clubosv2-production.up.railway.app';
const TEST_MESSAGE = 'Do you sell gift cards?';

async function testGiftCardAPI() {
  console.log('\n🧪 TESTING GIFT CARD AUTOMATION VIA API');
  console.log('======================================\n');
  
  try {
    // Step 1: Check AI automation features
    console.log('📋 Step 1: Checking AI automation features...');
    try {
      const featuresResponse = await axios.get(`${API_URL}/api/ai-automations/features`);
      const features = featuresResponse.data;
      
      const giftCardFeature = features.find((f: any) => f.feature_key === 'gift_cards');
      const llmFeature = features.find((f: any) => f.feature_key === 'llm_initial_analysis');
      
      console.log('Gift card automation:', {
        found: !!giftCardFeature,
        enabled: giftCardFeature?.enabled,
        name: giftCardFeature?.feature_name
      });
      
      console.log('LLM initial analysis:', {
        found: !!llmFeature,
        enabled: llmFeature?.enabled
      });
    } catch (error: any) {
      console.log('❌ Failed to fetch features:', error.message);
    }
    
    // Step 2: Test knowledge search
    console.log('\n🔍 Step 2: Testing knowledge search...');
    try {
      const searchResponse = await axios.post(`${API_URL}/api/knowledge/search`, {
        query: TEST_MESSAGE,
        category: 'gift_cards'
      });
      
      console.log('Knowledge search result:', {
        found: searchResponse.data.found,
        confidence: searchResponse.data.confidence,
        hasAnswer: !!searchResponse.data.answer
      });
      
      if (searchResponse.data.answer) {
        console.log('Answer preview:', searchResponse.data.answer.substring(0, 100) + '...');
      }
    } catch (error: any) {
      console.log('❌ Knowledge search failed:', error.message);
    }
    
    // Step 3: Test LLM analysis
    console.log('\n🤖 Step 3: Testing LLM analysis...');
    try {
      const llmResponse = await axios.post(`${API_URL}/api/llm/analyze`, {
        message: TEST_MESSAGE,
        context: {
          isCustomerFacing: true,
          phoneNumber: '9024783209'
        }
      });
      
      console.log('LLM analysis result:', {
        shouldRespond: llmResponse.data.shouldRespond,
        confidence: llmResponse.data.confidence,
        detectedIntent: llmResponse.data.detectedIntent,
        hasResponse: !!llmResponse.data.response
      });
      
      if (llmResponse.data.response) {
        console.log('Response preview:', llmResponse.data.response.substring(0, 100) + '...');
      }
    } catch (error: any) {
      console.log('❌ LLM analysis failed:', error.message);
    }
    
    // Step 4: Simulate webhook call
    console.log('\n📱 Step 4: Simulating OpenPhone webhook...');
    try {
      const webhookPayload = {
        type: 'message.created',
        data: {
          object: {
            id: 'test-msg-' + Date.now(),
            body: TEST_MESSAGE,
            from: '+19024783209',
            to: '+18337779449',
            direction: 'inbound',
            conversationId: 'test-conv-' + Date.now(),
            createdAt: new Date().toISOString()
          }
        }
      };
      
      const webhookResponse = await axios.post(
        `${API_URL}/api/openphone/webhook`,
        webhookPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-OpenPhone-Signature': 'test-signature'
          }
        }
      );
      
      console.log('Webhook response:', {
        status: webhookResponse.status,
        automated: webhookResponse.data.automated,
        shouldRespond: webhookResponse.data.shouldRespond,
        hasResponse: !!webhookResponse.data.response
      });
      
      if (webhookResponse.data.response) {
        console.log('Automated response:', webhookResponse.data.response);
      }
    } catch (error: any) {
      console.log('❌ Webhook simulation failed:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
    }
    
    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Run the test
testGiftCardAPI();