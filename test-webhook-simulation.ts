// This script simulates what happens in the webhook handler
import { config } from 'dotenv';
config();

// Mock the webhook data
const webhookData = {
  type: 'message.created',
  data: {
    object: {
      id: 'test-msg-' + Date.now(),
      body: 'Do you sell gift cards?',
      from: '+19024783209',
      to: '+18337779449',
      direction: 'inbound',
      conversationId: 'test-conv-' + Date.now(),
      createdAt: new Date().toISOString()
    }
  }
};

console.log('🔍 SIMULATING WEBHOOK HANDLER');
console.log('============================\n');

// 1. Extract phone number
const messageData = webhookData.data.object;
const phoneNumber = messageData.from; // For inbound messages
console.log('📱 Phone number:', phoneNumber);

// 2. Check if it's an initial message (new conversation)
const isInitialMessage = true; // Simulating first message
console.log('💬 Is initial message:', isInitialMessage);

// 3. Message content
const messageText = messageData.body;
console.log('📝 Message:', messageText);

// 4. What the automation service would check:
console.log('\n🤖 AUTOMATION CHECKS:');

// Check 1: Is gift_cards automation enabled?
console.log('✓ Check if gift_cards automation is enabled');

// Check 2: Pattern matching
const giftCardPatterns = [
  /gift\s*cards?/i,
  /giftcards?/i,
  /do\s+you\s+sell\s+gift/i
];

const matches = giftCardPatterns.filter(pattern => pattern.test(messageText));
console.log('✓ Pattern matches:', matches.length > 0 ? 'YES' : 'NO');
if (matches.length > 0) {
  console.log('  Matched patterns:', matches.map(p => p.source));
}

// Check 3: LLM analysis (if enabled)
console.log('✓ Check if llm_initial_analysis is enabled');

// Check 4: Response generation
console.log('✓ Query assistant service for response');

// Check 5: Send response
console.log('✓ Check if OPENPHONE_DEFAULT_NUMBER is set:', !!process.env.OPENPHONE_DEFAULT_NUMBER);
if (process.env.OPENPHONE_DEFAULT_NUMBER) {
  console.log('  Default number:', process.env.OPENPHONE_DEFAULT_NUMBER);
}

// Check environment
console.log('\n🔧 ENVIRONMENT CHECK:');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set');
console.log('BOOKING_ACCESS_GPT_ID:', process.env.BOOKING_ACCESS_GPT_ID ? '✅ Set' : '❌ Not set');
console.log('OPENPHONE_DEFAULT_NUMBER:', process.env.OPENPHONE_DEFAULT_NUMBER ? '✅ Set' : '❌ Not set');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Not set');

console.log('\n📊 EXPECTED FLOW:');
console.log('1. Webhook receives message');
console.log('2. Identifies as initial message from new number');
console.log('3. Calls aiAutomationService.processMessage()');
console.log('4. Checks gift card patterns - should match');
console.log('5. Calls assistantService to get response');
console.log('6. If OPENPHONE_DEFAULT_NUMBER is set, sends response');

console.log('\n❓ POSSIBLE ISSUES:');
if (!process.env.OPENAI_API_KEY) {
  console.log('❌ OPENAI_API_KEY not set - assistant service disabled');
}
if (!process.env.BOOKING_ACCESS_GPT_ID) {
  console.log('❌ BOOKING_ACCESS_GPT_ID not set - no assistant to query');
}
if (!process.env.OPENPHONE_DEFAULT_NUMBER) {
  console.log('❌ OPENPHONE_DEFAULT_NUMBER not set - cannot send responses');
}

console.log('\n✅ Analysis complete');