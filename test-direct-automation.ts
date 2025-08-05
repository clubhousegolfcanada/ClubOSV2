import dotenv from 'dotenv';
import path from 'path';

// Load environment from backend
dotenv.config({ path: path.join(__dirname, 'ClubOSV1-backend', '.env') });

// Import services after env is loaded
import { db } from './ClubOSV1-backend/src/utils/database';
import { aiAutomationService } from './ClubOSV1-backend/src/services/aiAutomationService';
import { logger } from './ClubOSV1-backend/src/utils/logger';

const TEST_PHONE = '9024783209';
const TEST_MESSAGE = 'Do you sell gift cards?';

async function testDirectAutomation() {
  console.log('\n🎯 TESTING GIFT CARD AUTOMATION DIRECTLY');
  console.log('=======================================\n');
  
  try {
    await db.initialize();
    
    // First, check if gift card automation is enabled
    console.log('📋 Checking automation status...');
    const featureResult = await db.query(`
      SELECT * FROM ai_automation_features 
      WHERE feature_key = 'gift_cards'
    `);
    
    if (featureResult.rows.length > 0) {
      const feature = featureResult.rows[0];
      console.log('Gift card automation:', {
        enabled: feature.enabled,
        name: feature.feature_name,
        config: feature.config
      });
      
      if (!feature.enabled) {
        console.log('⚠️  Gift card automation is DISABLED!');
        console.log('Enabling it now...');
        
        await db.query(`
          UPDATE ai_automation_features 
          SET enabled = true 
          WHERE feature_key = 'gift_cards'
        `);
        
        console.log('✅ Gift card automation enabled');
      }
    }
    
    // Check LLM initial analysis
    const llmResult = await db.query(`
      SELECT * FROM ai_automation_features 
      WHERE feature_key = 'llm_initial_analysis'
    `);
    
    if (llmResult.rows.length > 0) {
      const llmFeature = llmResult.rows[0];
      console.log('\nLLM Initial Analysis:', {
        enabled: llmFeature.enabled
      });
    }
    
    // Now test the automation
    console.log('\n🤖 Testing automation service...');
    console.log(`Message: "${TEST_MESSAGE}"`);
    console.log(`Phone: ${TEST_PHONE}`);
    console.log('Is initial message: true\n');
    
    const response = await aiAutomationService.processMessage(
      TEST_PHONE,
      TEST_MESSAGE,
      'test-conv-' + Date.now(),
      true // isInitialMessage
    );
    
    console.log('📊 Automation Response:');
    console.log(JSON.stringify({
      shouldRespond: response.shouldRespond,
      automationKey: response.automationKey,
      hasResponse: !!response.response,
      responseLength: response.response?.length || 0,
      handled: response.handled,
      error: response.error
    }, null, 2));
    
    if (response.response) {
      console.log('\n📝 Generated Response:');
      console.log(response.response);
    }
    
    if (!response.shouldRespond) {
      console.log('\n❌ Automation did not trigger. Checking why...');
      
      // Check if any patterns match
      const patterns = [
        'gift card', 'giftcard', 'gift cards', 'giftcards',
        'gift certificate', 'voucher', 'present card'
      ];
      
      const matchedPattern = patterns.find(p => 
        TEST_MESSAGE.toLowerCase().includes(p)
      );
      
      console.log('Pattern match:', matchedPattern || 'NONE');
    }
    
    // Check recent automation usage
    console.log('\n📊 Recent automation attempts:');
    const usageResult = await db.query(`
      SELECT au.*, af.feature_name
      FROM ai_automation_usage au
      JOIN ai_automation_features af ON au.feature_id = af.id
      WHERE af.feature_key = 'gift_cards'
      ORDER BY au.created_at DESC
      LIMIT 3
    `);
    
    if (usageResult.rows.length > 0) {
      usageResult.rows.forEach((row, i) => {
        console.log(`\nAttempt ${i + 1}:`, {
          success: row.success,
          trigger: row.trigger_type,
          error: row.error_message,
          created: row.created_at
        });
      });
    }
    
    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    logger.error('Test error:', error);
  } finally {
    await db.close();
  }
}

// Run the test
testDirectAutomation();