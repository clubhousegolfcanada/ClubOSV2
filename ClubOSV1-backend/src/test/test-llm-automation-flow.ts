import { aiAutomationService } from '../services/aiAutomationService';
import { assistantService } from '../services/assistantService';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testLLMAutomationFlow() {
  logger.debug('\n=== Testing LLM Automation Flow ===\n');

  // Test message that should trigger gift card automation
  const testMessage = "Hi, I'd like to buy a gift card for my friend. How do I purchase one?";
  const phoneNumber = '+1234567890';
  const conversationId = 'test-conv-123';

  logger.debug('Test Message:', testMessage);
  logger.debug('Phone Number:', phoneNumber);
  logger.debug('\n--- Environment Check ---');
  logger.debug('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Missing');
  logger.debug('BOOKING_ACCESS_GPT_ID:', process.env.BOOKING_ACCESS_GPT_ID || '✗ Missing');
  logger.debug('EMERGENCY_GPT_ID:', process.env.EMERGENCY_GPT_ID || '✗ Missing');
  logger.debug('TECH_SUPPORT_GPT_ID:', process.env.TECH_SUPPORT_GPT_ID || '✗ Missing');
  logger.debug('BRAND_MARKETING_GPT_ID:', process.env.BRAND_MARKETING_GPT_ID || '✗ Missing');

  try {
    logger.debug('\n--- Step 1: Process Message with AI Automation Service ---');
    const automationResponse = await aiAutomationService.processMessage(
      phoneNumber,
      testMessage,
      conversationId,
      true // isInitialMessage
    );

    logger.debug('Automation Response:', {
      handled: automationResponse.handled,
      hasResponse: !!automationResponse.response,
      responseLength: automationResponse.response?.length || 0,
      assistantType: automationResponse.assistantType
    });

    if (automationResponse.response) {
      logger.debug('\nGenerated Response:');
      logger.debug(automationResponse.response);
    }

    // Test directly calling the assistant service
    logger.debug('\n--- Step 2: Direct Assistant Service Test ---');
    const directResponse = await assistantService.getAssistantResponse(
      'Booking & Access',
      testMessage,
      { isCustomerFacing: true, conversationId }
    );

    logger.debug('Direct Assistant Response:', {
      hasResponse: !!directResponse.response,
      responseLength: directResponse.response?.length || 0,
      assistantId: directResponse.assistantId,
      confidence: directResponse.confidence
    });

    if (directResponse.response) {
      logger.debug('\nDirect Response:');
      logger.debug(directResponse.response);
    }

  } catch (error) {
    logger.error('\n❌ Error during test:', error);
  }
}

// Run the test
testLLMAutomationFlow().then(() => {
  logger.debug('\n=== Test Complete ===\n');
  process.exit(0);
}).catch(error => {
  logger.error('Test failed:', error);
  process.exit(1);
});