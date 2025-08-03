#!/usr/bin/env node

const axios = require('axios');

const API_URL = 'https://clubosv2-production.up.railway.app/api';
const FRONTEND_URL = 'https://clubos-frontend.vercel.app';

async function testAIAutomations() {
  console.log('🤖 Testing AI Automations Deployment\n');

  try {
    // 1. Test backend health
    console.log('1. Checking backend health...');
    const healthResponse = await axios.get('https://clubosv2-production.up.railway.app/health');
    console.log('✅ Backend is healthy:', healthResponse.data);
    console.log('');

    // 2. Test if AI automations endpoint exists (should get 401 without auth)
    console.log('2. Checking AI automations endpoint...');
    try {
      await axios.get(`${API_URL}/ai-automations`);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ AI automations endpoint exists (got expected 401 without auth)');
      } else {
        console.log('❌ Unexpected error:', error.response?.data || error.message);
      }
    }
    console.log('');

    // 3. Test specific automation features endpoints
    console.log('3. Testing automation feature endpoints...');
    const features = ['gift_cards', 'trackman_reset', 'booking_change'];
    
    for (const feature of features) {
      try {
        await axios.get(`${API_URL}/ai-automations/${feature}`);
      } catch (error) {
        if (error.response && error.response.status === 401) {
          console.log(`✅ Feature endpoint /${feature} exists`);
        } else {
          console.log(`❌ Feature endpoint /${feature} error:`, error.response?.status);
        }
      }
    }
    console.log('');

    // 4. Test webhook endpoint
    console.log('4. Testing OpenPhone webhook endpoint...');
    try {
      await axios.post(`${API_URL}/openphone/webhook`, {});
    } catch (error) {
      if (error.response && (error.response.status === 401 || error.response.status === 400)) {
        console.log('✅ Webhook endpoint exists');
      } else {
        console.log('❌ Webhook error:', error.response?.status);
      }
    }
    console.log('');

    console.log('🎉 Summary: Backend deployment appears successful!');
    console.log('\nTo fully test AI automations:');
    console.log('1. Log into', FRONTEND_URL);
    console.log('2. Navigate to Operations → AI Automations');
    console.log('3. Check if features load and can be toggled');
    console.log('4. Test sending a message about "gift cards" via OpenPhone');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run the test
testAIAutomations();