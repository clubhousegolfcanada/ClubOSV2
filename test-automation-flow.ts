// Manual test to trace the gift card automation flow
import { aiAutomationService } from './ClubOSV1-backend/src/services/aiAutomationService';
import { calculateConfidence } from './ClubOSV1-backend/src/services/aiAutomationPatterns';

console.log('🧪 Testing Gift Card Automation Flow\n');

// Test 1: Pattern matching
console.log('1️⃣ Testing pattern matching for various gift card queries:\n');

const testMessages = [
  'Do you sell gift cards?',
  'how can I purchase a gift card?',
  'I want to buy a gift certificate',
  'Looking for a birthday gift',
  'Do you have gift certificates available?',
  'I need a present for someone who loves golf',
  // Negative cases
  'I received a gift card, how do I use it?',
  'What is my gift card balance?'
];

for (const message of testMessages) {
  const result = calculateConfidence(message, 'gift_cards');
  console.log(`Message: "${message}"`);
  console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  console.log(`Matches: ${result.matches.join(', ') || 'none'}`);
  console.log(`Negatives: ${result.negatives.join(', ') || 'none'}`);
  console.log(`Would trigger: ${result.confidence >= 0.7 ? '✅ YES' : '❌ NO'}`);
  console.log('---');
}

// Test 2: Assistant routing
console.log('\n2️⃣ Testing assistant type detection:\n');

const routingTests = [
  'Do you sell gift cards?',
  'My trackman is frozen',
  'How do I book a bay?',
  'What are your hours?',
  'There is a fire!',
];

for (const message of routingTests) {
  const assistantType = aiAutomationService.getAssistantType(message);
  console.log(`Message: "${message}" → Assistant: ${assistantType}`);
}

console.log('\n✅ Pattern testing complete!');
console.log('\nTo test the full flow with webhook, run:');
console.log('npm run test:automation');