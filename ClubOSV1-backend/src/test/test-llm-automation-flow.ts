import { aiAutomationService } from '../services/aiAutomationService';
import { assistantService } from '../services/assistantService';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testLLMAutomationFlow() {
  console.log('\n=== Testing LLM Automation Flow ===\n');

  // Test message that should trigger gift card automation
  const testMessage = "Hi, I'd like to buy a gift card for my friend. How do I purchase one?";
  const phoneNumber = '+1234567890';
  const conversationId = 'test-conv-123';

  console.log('Test Message:', testMessage);
  console.log('Phone Number:', phoneNumber);
  console.log('\n--- Environment Check ---');
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Missing');
  console.log('BOOKING_ACCESS_GPT_ID:', process.env.BOOKING_ACCESS_GPT_ID || '✗ Missing');
  console.log('EMERGENCY_GPT_ID:', process.env.EMERGENCY_GPT_ID || '✗ Missing');
  console.log('TECH_SUPPORT_GPT_ID:', process.env.TECH_SUPPORT_GPT_ID || '✗ Missing');
  console.log('BRAND_MARKETING_GPT_ID:', process.env.BRAND_MARKETING_GPT_ID || '✗ Missing');

  try {
    console.log('\n--- Step 1: Process Message with AI Automation Service ---');
    const automationResponse = await aiAutomationService.processMessage(
      phoneNumber,
      testMessage,
      conversationId,
      true // isInitialMessage
    );

    console.log('Automation Response:', {
      handled: automationResponse.handled,
      hasResponse: !!automationResponse.response,
      responseLength: automationResponse.response?.length || 0,
      assistantType: automationResponse.assistantType
    });

    if (automationResponse.response) {
      console.log('\nGenerated Response:');
      console.log(automationResponse.response);
    }

    // Test directly calling the assistant service
    console.log('\n--- Step 2: Direct Assistant Service Test ---');
    const directResponse = await assistantService.getAssistantResponse(
      'Booking & Access',
      testMessage,
      { isCustomerFacing: true, conversationId }
    );

    console.log('Direct Assistant Response:', {
      hasResponse: !!directResponse.response,
      responseLength: directResponse.response?.length || 0,
      assistantId: directResponse.assistantId,
      confidence: directResponse.confidence
    });

    if (directResponse.response) {
      console.log('\nDirect Response:');
      console.log(directResponse.response);
    }

  } catch (error) {
    console.error('\n❌ Error during test:', error);
  }
}

// Run the test
testLLMAutomationFlow().then(() => {
  console.log('\n=== Test Complete ===\n');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});