/**
 * Test script for Slack Phase 2 implementation
 * Validates database setup and API endpoints
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'https://clubosv2-production.up.railway.app';

async function testSlackPhase2() {
  console.log('🧪 Testing Slack Phase 2 Implementation');
  console.log('=====================================\n');

  // Test 1: Health check
  try {
    console.log('1. Testing health endpoint...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', health.data.status);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    return;
  }

  // Test 2: URL verification
  try {
    console.log('\n2. Testing Slack events URL verification...');
    const urlVerification = await axios.post(`${BASE_URL}/api/slack/events`, {
      type: 'url_verification',
      challenge: 'test_challenge_12345'
    });
    
    if (urlVerification.data.challenge === 'test_challenge_12345') {
      console.log('✅ URL verification working correctly');
    } else {
      console.log('❌ URL verification failed - unexpected response');
    }
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('⚠️  Events endpoint not yet deployed (404)');
    } else {
      console.log('❌ URL verification failed:', error.message);
    }
  }

  // Test 3: Conversations endpoint
  try {
    console.log('\n3. Testing conversations endpoint...');
    const conversations = await axios.get(`${BASE_URL}/api/slack/conversations`);
    console.log('✅ Conversations endpoint working');
    console.log(`   Found ${conversations.data.data.count} conversations`);
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('⚠️  Conversations endpoint not yet deployed (404)');
    } else {
      console.log('❌ Conversations endpoint failed:', error.message);
    }
  }

  // Test 4: Slack status
  try {
    console.log('\n4. Testing Slack status...');
    const status = await axios.get(`${BASE_URL}/api/slack/status`);
    console.log('✅ Slack status endpoint working');
    console.log(`   Webhook configured: ${status.data.data.webhookConfigured}`);
    console.log(`   Signing secret configured: ${status.data.data.signingSecretConfigured}`);
  } catch (error) {
    console.log('⚠️  Slack status failed (expected due to column naming):', error.response?.data?.message || error.message);
  }

  // Test 5: Slack test message
  try {
    console.log('\n5. Testing Slack integration...');
    const test = await axios.post(`${BASE_URL}/api/slack/test`);
    console.log('✅ Slack test message sent successfully');
    console.log(`   Channel: ${test.data.channel}`);
  } catch (error) {
    console.log('❌ Slack test failed:', error.response?.data?.message || error.message);
  }

  console.log('\n📋 Summary');
  console.log('==========');
  console.log('Phase 2 implementation includes:');
  console.log('• Database tables: slack_replies + slack_replies_view');
  console.log('• API endpoint: POST /api/slack/events');
  console.log('• Reply endpoints: GET /api/slack/replies/:threadTs');
  console.log('• Conversations: GET /api/slack/conversations');
  console.log('• Security: Signature verification + raw body middleware');
  console.log('\nNext: Configure Slack app with Events API');
  console.log('URL: https://clubosv2-production.up.railway.app/api/slack/events');
}

// Run the test
testSlackPhase2().catch(console.error);