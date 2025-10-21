import axios from 'axios';
import dotenv from 'dotenv';
import { db } from '../utils/database';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:5000';
const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = 'testpassword';

async function getAuthToken() {
  try {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    return response.data.token;
  } catch (error) {
    logger.error('Failed to login:', error);
    throw error;
  }
}

async function enableGiftCardAutomation(token: string, responseSource: 'database' | 'hardcoded') {
  try {
    // First, get the current config
    const features = await axios.get(`${API_URL}/api/ai-automations`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const giftCardFeature = features.data.features.find((f: any) => f.feature_key === 'gift_cards');
    if (!giftCardFeature) {
      throw new Error('Gift card feature not found');
    }
    
    // Enable the feature
    await axios.put(`${API_URL}/api/ai-automations/gift_cards/toggle`, 
      { enabled: true },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    // Update config
    const config = {
      ...giftCardFeature.config,
      responseSource,
      maxResponses: 2,
      hardcodedResponse: responseSource === 'hardcoded' 
        ? 'You can purchase gift cards at www.clubhouse247golf.com/giftcard/purchase. They make great gifts!'
        : undefined
    };
    
    await axios.put(`${API_URL}/api/ai-automations/gift_cards/config`,
      { config },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    logger.debug(`✅ Gift card automation enabled with ${responseSource} response`);
  } catch (error) {
    logger.error('Failed to enable gift card automation:', error);
    throw error;
  }
}

async function simulateWebhook(message: string, phoneNumber: string = '+15551234567') {
  try {
    const webhookData = {
      object: {
        type: 'message.created',
        data: {
          object: {
            id: `msg_${Date.now()}`,
            direction: 'incoming',
            from: phoneNumber,
            to: process.env.OPENPHONE_DEFAULT_NUMBER || '+15559876543',
            body: message,
            createdAt: new Date().toISOString(),
            conversationId: `conv_${phoneNumber}`
          }
        }
      }
    };
    
    logger.debug(`\n📱 Simulating inbound message: "${message}"`);
    
    const response = await axios.post(`${API_URL}/api/openphone/webhook`, webhookData);
    logger.debug('Webhook response:', response.status);
    
    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if automation was triggered
    const result = await db.query(`
      SELECT * FROM ai_automation_usage 
      WHERE feature_id = (SELECT id FROM ai_automation_features WHERE feature_key = 'gift_cards')
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (result.rows.length > 0) {
      const usage = result.rows[0];
      logger.debug('\n🤖 Automation triggered:');
      logger.debug('- Success:', usage.success);
      logger.debug('- Response:', usage.output_data?.response);
      logger.debug('- Execution time:', usage.execution_time_ms, 'ms');
    } else {
      logger.debug('\n❌ No automation triggered');
    }
    
  } catch (error) {
    logger.error('Webhook simulation failed:', error);
  }
}

async function runTests() {
  logger.debug('🧪 Testing Gift Card Automation System\n');
  
  try {
    // Get auth token
    logger.debug('1️⃣ Getting auth token...');
    const token = await getAuthToken();
    logger.debug('✅ Authenticated');
    
    // Test 1: Database response mode
    logger.debug('\n2️⃣ Testing DATABASE response mode...');
    await enableGiftCardAutomation(token, 'database');
    await simulateWebhook('Do you sell gift cards?');
    
    // Test 2: Hardcoded response mode
    logger.debug('\n3️⃣ Testing HARDCODED response mode...');
    await enableGiftCardAutomation(token, 'hardcoded');
    await simulateWebhook('I want to buy a gift certificate');
    
    // Test 3: Pattern matching variations
    logger.debug('\n4️⃣ Testing pattern matching...');
    const testMessages = [
      'how can I purchase a gift card?',
      'Looking for a birthday gift',
      'Do you have gift certificates available?',
      'I need a present for someone who loves golf'
    ];
    
    for (const msg of testMessages) {
      await simulateWebhook(msg);
    }
    
    // Test 4: Negative patterns (should NOT trigger)
    logger.debug('\n5️⃣ Testing negative patterns (should NOT trigger)...');
    await simulateWebhook('I received a gift card, how do I use it?');
    await simulateWebhook('What is my gift card balance?');
    
    // Test 5: Response limit
    logger.debug('\n6️⃣ Testing response limit (max 2)...');
    const testPhone = '+15551111111';
    await simulateWebhook('Do you have gift cards?', testPhone);
    await simulateWebhook('Thank you!', testPhone);
    await simulateWebhook('One more question about gift cards', testPhone); // Should not respond
    
    logger.debug('\n✅ All tests completed!');
    
  } catch (error) {
    logger.error('Test failed:', error);
  } finally {
    // Clean up
    await db.end();
    process.exit(0);
  }
}

// Run the tests
runTests();