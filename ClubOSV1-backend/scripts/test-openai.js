#!/usr/bin/env node

/**
 * Test OpenAI Connection on Railway
 * This tests if OpenAI is configured and working
 */

console.log('Testing OpenAI configuration...\n');

// Check for API key
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY is not set in environment');
  console.log('\nTo set it on Railway:');
  console.log('1. Go to Railway Dashboard → Backend Service');
  console.log('2. Click Variables tab');
  console.log('3. Add: OPENAI_API_KEY = sk-...');
  process.exit(1);
}

console.log('✅ OPENAI_API_KEY is configured');
console.log(`   Key starts with: ${process.env.OPENAI_API_KEY.substring(0, 10)}...`);

// Test OpenAI connection
const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testOpenAI() {
  try {
    console.log('\nTesting OpenAI API connection...');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a test.' },
        { role: 'user', content: 'Say "OpenAI is working!"' }
      ],
      max_tokens: 10
    });
    
    console.log('✅ OpenAI API is working!');
    console.log(`   Response: ${response.choices[0].message.content}`);
    console.log('\n🎯 Ready to run pattern upgrade!');
    console.log('   Run: npx tsx scripts/upgrade-patterns-gpt4.ts');
    
  } catch (error) {
    console.error('❌ OpenAI API test failed:', error.message);
    if (error.message.includes('401')) {
      console.log('\n⚠️  Invalid API key. Please check your OPENAI_API_KEY.');
    } else if (error.message.includes('429')) {
      console.log('\n⚠️  Rate limit exceeded or quota issue.');
    }
  }
}

testOpenAI();