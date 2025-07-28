import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_URL = 'http://localhost:3001/api';
const OPENPHONE_WEBHOOK_SECRET = process.env.OPENPHONE_WEBHOOK_SECRET || 'test-secret';

/**
 * Test OpenPhone Integration Locally
 * Run with: npm run test:openphone
 */

// Generate webhook signature
function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

// Test webhook payloads
const testPayloads = {
  messageCreated: {
    type: 'message.created',
    data: {
      id: 'msg_test_123',
      conversationId: 'conv_test_456',
      from: '+14165551234',
      to: '+14165555678',
      direction: 'inbound',
      text: 'Hi, I need help with my TrackMan. The screen is frozen and I cannot restart it.',
      createdAt: new Date().toISOString(),
      contact: {
        id: 'cont_test_789',
        name: 'Test Customer',
        phoneNumber: '+14165551234'
      },
      user: {
        id: 'user_test_321',
        name: 'Support Agent',
        email: 'agent@clubhouse.com'
      }
    }
  },

  conversationWithHistory: {
    type: 'conversation.updated',
    data: {
      id: 'conv_test_789',
      phoneNumber: '+14165551234',
      contactName: 'Test Customer',
      userName: 'Support Agent',
      messages: [
        {
          id: 'msg_1',
          direction: 'inbound',
          text: 'My booking for tomorrow disappeared from the app',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          from: '+14165551234'
        },
        {
          id: 'msg_2',
          direction: 'outbound',
          text: 'I can help you with that. Let me check your booking.',
          timestamp: new Date(Date.now() - 3000000).toISOString(),
          from: '+14165555678'
        },
        {
          id: 'msg_3',
          direction: 'outbound',
          text: 'I found your booking. It was accidentally cancelled. I have rebooked you for the same time tomorrow at Bay 3.',
          timestamp: new Date(Date.now() - 2400000).toISOString(),
          from: '+14165555678'
        },
        {
          id: 'msg_4',
          direction: 'inbound',
          text: 'Thank you so much! That solved my problem.',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          from: '+14165551234'
        }
      ]
    }
  },

  callCompleted: {
    type: 'call.completed',
    data: {
      id: 'call_test_123',
      phoneNumber: '+14165551234',
      contactName: 'Emergency Caller',
      userName: 'Support Agent',
      direction: 'inbound',
      duration: 245,
      startedAt: new Date(Date.now() - 300000).toISOString(),
      endedAt: new Date().toISOString(),
      recordingUrl: 'https://recordings.openphone.com/test-recording.mp3',
      messages: [{
        type: 'call',
        duration: 245,
        direction: 'inbound',
        timestamp: new Date().toISOString(),
        summary: 'Customer reported water leak in Bay 5. Agent dispatched maintenance.'
      }]
    }
  }
};

// Test functions
async function testWebhook(payload: any, testName: string) {
  console.log(`\n🧪 Testing: ${testName}`);
  console.log('━'.repeat(50));
  
  try {
    const payloadString = JSON.stringify(payload);
    const signature = generateSignature(payloadString, OPENPHONE_WEBHOOK_SECRET);
    
    console.log('📤 Sending webhook payload...');
    console.log(`   Type: ${payload.type}`);
    console.log(`   Signature: ${signature.substring(0, 20)}...`);
    
    const response = await axios.post(
      `${API_URL}/openphone/webhook`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-openphone-signature': signature
        }
      }
    );
    
    console.log('✅ Webhook accepted:', response.data);
    
    // Give it a moment to process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if conversation was stored
    await checkStoredConversations();
    
  } catch (error: any) {
    console.error('❌ Webhook test failed:', error.response?.data || error.message);
  }
}

async function checkStoredConversations() {
  try {
    console.log('\n📊 Checking stored conversations...');
    
    // This would normally require auth, but for testing we'll check the database directly
    const { db } = await import('../utils/database');
    
    if (db.initialized) {
      const result = await db.query(`
        SELECT 
          id, 
          phone_number, 
          customer_name, 
          employee_name,
          processed,
          created_at,
          jsonb_array_length(messages) as message_count
        FROM openphone_conversations 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      
      console.log(`   Found ${result.rows.length} recent conversations:`);
      result.rows.forEach(row => {
        console.log(`   - ${row.customer_name} (${row.phone_number}): ${row.message_count} messages, processed: ${row.processed}`);
      });
    }
  } catch (error) {
    console.error('   Could not check database:', error);
  }
}

async function testKnowledgeExtraction() {
  console.log('\n🧠 Testing Knowledge Extraction...');
  console.log('━'.repeat(50));
  
  try {
    // First, ensure we have some unprocessed conversations
    await testWebhook(testPayloads.conversationWithHistory, 'Conversation for Knowledge Extraction');
    
    // Get a simple auth token (you'll need to have an admin user)
    const token = process.env.TEST_AUTH_TOKEN || '';
    
    if (!token) {
      console.log('⚠️  No TEST_AUTH_TOKEN found, skipping authenticated tests');
      return;
    }
    
    // Trigger knowledge extraction
    console.log('\n🔄 Triggering knowledge extraction...');
    const response = await axios.post(
      `${API_URL}/knowledge/extract`,
      { limit: 5 },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('✅ Extraction complete:', response.data);
    
    // Check extracted knowledge
    const knowledgeResponse = await axios.get(
      `${API_URL}/knowledge/unapplied?limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log(`\n📚 Found ${knowledgeResponse.data.count} knowledge items:`);
    knowledgeResponse.data.data.forEach((item: any) => {
      console.log(`   - [${item.category}] ${item.problem.substring(0, 50)}...`);
      console.log(`     Confidence: ${(item.confidence * 100).toFixed(1)}%`);
    });
    
  } catch (error: any) {
    console.error('❌ Knowledge extraction test failed:', error.response?.data || error.message);
  }
}

async function testOpenPhoneAPI() {
  console.log('\n🔌 Testing OpenPhone API Integration...');
  console.log('━'.repeat(50));
  
  const apiKey = process.env.OPENPHONE_API_KEY;
  
  if (!apiKey) {
    console.log('⚠️  No OPENPHONE_API_KEY found, skipping API tests');
    console.log('   Add OPENPHONE_API_KEY to your .env file to test API integration');
    return;
  }
  
  try {
    // Test API connection
    console.log('📞 Connecting to OpenPhone API...');
    const response = await axios.get(
      'https://api.openphone.com/v1/phone-numbers',
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    
    console.log('✅ API connection successful!');
    console.log(`   Found ${response.data.data?.length || 0} phone numbers`);
    
    // Test fetching conversations
    console.log('\n📥 Fetching recent conversations...');
    const conversationsResponse = await axios.get(
      'https://api.openphone.com/v1/conversations?limit=5',
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    
    const conversations = conversationsResponse.data.data || [];
    console.log(`   Found ${conversations.length} recent conversations`);
    
    // Show summary
    conversations.forEach((conv: any) => {
      console.log(`   - ${conv.contact?.name || 'Unknown'}: ${conv.lastMessage?.text?.substring(0, 50) || 'No message'}...`);
    });
    
  } catch (error: any) {
    console.error('❌ OpenPhone API test failed:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.log('   Check that your OPENPHONE_API_KEY is valid');
    }
  }
}

async function runAllTests() {
  console.log('🚀 OpenPhone Integration Test Suite');
  console.log('═'.repeat(50));
  console.log(`📍 API URL: ${API_URL}`);
  console.log(`🔐 Webhook Secret: ${OPENPHONE_WEBHOOK_SECRET.substring(0, 10)}...`);
  console.log('═'.repeat(50));
  
  // Test webhooks
  await testWebhook(testPayloads.messageCreated, 'Simple Message Created');
  await testWebhook(testPayloads.conversationWithHistory, 'Conversation with History');
  await testWebhook(testPayloads.callCompleted, 'Call Completed');
  
  // Test knowledge extraction
  await testKnowledgeExtraction();
  
  // Test OpenPhone API
  await testOpenPhoneAPI();
  
  console.log('\n✅ All tests completed!');
  console.log('\n📋 Next Steps:');
  console.log('1. Configure OpenPhone webhook URL in their dashboard');
  console.log('2. Set OPENPHONE_API_KEY in your .env file');
  console.log('3. Generate and set OPENPHONE_WEBHOOK_SECRET');
  console.log('4. Run shadow mode to compare responses');
  console.log('5. Extract knowledge from real conversations');
  
  process.exit(0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});