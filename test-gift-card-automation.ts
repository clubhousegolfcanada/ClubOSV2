import dotenv from 'dotenv';
import { db } from './ClubOSV1-backend/src/utils/database';
import { aiAutomationService } from './ClubOSV1-backend/src/services/aiAutomationService';
import { logger } from './ClubOSV1-backend/src/utils/logger';
import { assistantService } from './ClubOSV1-backend/src/services/assistantService';
import { knowledgeSearchService } from './ClubOSV1-backend/src/services/knowledgeSearchService';
import { improvedKnowledgeSearch } from './ClubOSV1-backend/src/services/improvedKnowledgeSearch';

dotenv.config();

const TEST_PHONE = '9024783209';
const TEST_NAME = 'Mike Belair';
const TEST_MESSAGE = 'Do you sell gift cards?';

async function testGiftCardAutomation() {
  console.log('\n🧪 TESTING GIFT CARD AUTOMATION PIPELINE');
  console.log('=======================================\n');
  
  try {
    await db.initialize();
    
    // Step 1: Check gift card knowledge in database
    console.log('📚 STEP 1: Checking gift card knowledge in database...');
    const knowledgeResult = await db.query(`
      SELECT id, category, key, new_value, assistant_target, created_at 
      FROM knowledge_audit_log 
      WHERE LOWER(new_value) LIKE '%gift%' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log(`Found ${knowledgeResult.rows.length} gift card knowledge entries`);
    if (knowledgeResult.rows.length > 0) {
      console.log('Latest entry:', {
        category: knowledgeResult.rows[0].category,
        key: knowledgeResult.rows[0].key,
        value: knowledgeResult.rows[0].new_value.substring(0, 100) + '...',
        created: knowledgeResult.rows[0].created_at
      });
    }
    
    // Step 2: Test knowledge search services
    console.log('\n🔍 STEP 2: Testing knowledge search services...');
    
    // Test original knowledge search
    const searchResult1 = await knowledgeSearchService.searchKnowledge(TEST_MESSAGE, 'booking');
    console.log('Original search service:', {
      found: searchResult1.found,
      confidence: searchResult1.confidence,
      source: searchResult1.source
    });
    
    // Test improved knowledge search
    const searchResult2 = await improvedKnowledgeSearch.searchKnowledge(TEST_MESSAGE, 'booking');
    console.log('Improved search service:', {
      found: searchResult2.found,
      confidence: searchResult2.confidence,
      source: searchResult2.source
    });
    
    // Step 3: Check automation feature status
    console.log('\n⚙️ STEP 3: Checking automation feature status...');
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
    } else {
      console.log('❌ Gift card automation feature not found!');
    }
    
    // Step 4: Check LLM feature status
    const llmFeatureResult = await db.query(`
      SELECT * FROM ai_automation_features 
      WHERE feature_key = 'llm_initial_analysis'
    `);
    
    if (llmFeatureResult.rows.length > 0) {
      const llmFeature = llmFeatureResult.rows[0];
      console.log('\nLLM Initial Analysis:', {
        enabled: llmFeature.enabled,
        config: llmFeature.config
      });
    }
    
    // Step 5: Test AI automation service
    console.log('\n🤖 STEP 5: Testing AI automation service...');
    console.log(`Message: "${TEST_MESSAGE}" from ${TEST_NAME} (${TEST_PHONE})`);
    
    const automationResponse = await aiAutomationService.processMessage(
      TEST_PHONE,
      TEST_MESSAGE,
      'test-conversation-' + Date.now(),
      true // isInitialMessage
    );
    
    console.log('\nAutomation response:', {
      shouldRespond: automationResponse.shouldRespond,
      automationKey: automationResponse.automationKey,
      responseLength: automationResponse.response?.length || 0,
      hasResponse: !!automationResponse.response
    });
    
    if (automationResponse.response) {
      console.log('Response preview:', automationResponse.response.substring(0, 200) + '...');
    }
    
    // Step 6: Direct assistant test
    console.log('\n🎯 STEP 6: Testing assistant directly...');
    if (assistantService) {
      const assistantResponse = await assistantService.getAssistantResponse(
        'Booking & Access',
        TEST_MESSAGE,
        { isCustomerFacing: true }
      );
      
      console.log('Assistant response:', {
        hasResponse: !!assistantResponse.response,
        confidence: assistantResponse.confidence,
        source: assistantResponse.structured?.source || 'assistant',
        responseLength: assistantResponse.response?.length || 0
      });
      
      if (assistantResponse.response) {
        console.log('Response preview:', assistantResponse.response.substring(0, 200) + '...');
      }
    } else {
      console.log('❌ Assistant service not initialized');
    }
    
    // Step 7: Check for errors in automation usage
    console.log('\n📊 STEP 7: Checking recent automation errors...');
    const errorResult = await db.query(`
      SELECT au.*, af.feature_name, af.feature_key
      FROM ai_automation_usage au
      JOIN ai_automation_features af ON au.feature_id = af.id
      WHERE au.error_message IS NOT NULL
      ORDER BY au.created_at DESC
      LIMIT 5
    `);
    
    if (errorResult.rows.length > 0) {
      console.log(`Found ${errorResult.rows.length} recent errors:`);
      errorResult.rows.forEach((error, i) => {
        console.log(`\nError ${i + 1}:`, {
          feature: error.feature_name,
          key: error.feature_key,
          error: error.error_message,
          created: error.created_at
        });
      });
    } else {
      console.log('No recent errors found');
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
testGiftCardAutomation();