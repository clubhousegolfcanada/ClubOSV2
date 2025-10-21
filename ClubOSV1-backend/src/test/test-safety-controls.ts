#!/usr/bin/env npx tsx
/**
 * Test script to verify V3-PLS safety controls are working
 * Tests blacklist blocking, escalation alerts, and keyword management
 */

import { patternSafetyService } from '../services/patternSafetyService';
import { aiAutomationService } from '../services/aiAutomationService';
import { db } from '../utils/database';
import { logger } from '../utils/logger';

// Test messages
const testMessages = [
  {
    message: "I need a refund for my booking",
    expected: "blacklist",
    description: "Should be blocked - contains 'refund'"
  },
  {
    message: "I'm going to sue you!",
    expected: "escalation",
    description: "Should escalate - contains 'sue'"
  },
  {
    message: "My lawyer will be contacting you",
    expected: "blacklist", // lawyer is in both lists, blacklist takes priority
    description: "Should be blocked - contains 'lawyer'"
  },
  {
    message: "I'm really angry about the service",
    expected: "escalation",
    description: "Should escalate - contains 'angry'"
  },
  {
    message: "Can I book a bay for tomorrow?",
    expected: "safe",
    description: "Should be safe - normal booking inquiry"
  },
  {
    message: "There was an accident in the bay",
    expected: "blacklist",
    description: "Should be blocked - contains 'accident'"
  },
  {
    message: "This is urgent, please help!",
    expected: "escalation",
    description: "Should escalate - contains 'urgent'"
  },
  {
    message: "I have a medical emergency",
    expected: "blacklist",
    description: "Should be blocked - contains 'medical' and 'emergency'"
  }
];

async function testSafetyControls() {
  logger.debug('\n🔒 Testing V3-PLS Safety Controls\n');
  logger.debug('=' .repeat(60));
  
  let passedTests = 0;
  let failedTests = 0;
  
  // First, show current settings
  const settings = await patternSafetyService.getSettings();
  logger.debug('\n📋 Current Safety Settings:');
  logger.debug(`  Blacklist Topics (${settings.blacklistTopics.length}):`, 
    settings.blacklistTopics.slice(0, 5).join(', '), '...');
  logger.debug(`  Escalation Keywords (${settings.escalationKeywords.length}):`, 
    settings.escalationKeywords.slice(0, 5).join(', '), '...');
  logger.debug(`  Approval Required: ${settings.requireApprovalForNew}`);
  logger.debug(`  Min Examples: ${settings.minExamplesRequired}`);
  logger.debug('\n' + '=' .repeat(60));
  
  // Test each message
  for (const test of testMessages) {
    logger.debug(`\n📝 Test: ${test.description}`);
    logger.debug(`   Message: "${test.message}"`);
    logger.debug(`   Expected: ${test.expected}`);
    
    try {
      // Test with patternSafetyService directly
      const safetyResult = await patternSafetyService.checkMessageSafety(test.message);
      
      let actualResult = 'safe';
      if (!safetyResult.safe) {
        actualResult = safetyResult.alertType || 'blocked';
      }
      
      logger.debug(`   Actual: ${actualResult}`);
      
      if (actualResult === test.expected) {
        logger.debug(`   ✅ PASSED`);
        if (safetyResult.triggeredKeywords) {
          logger.debug(`   Triggered by: ${safetyResult.triggeredKeywords.join(', ')}`);
        }
        passedTests++;
      } else {
        logger.debug(`   ❌ FAILED`);
        logger.debug(`   Safety Result:`, safetyResult);
        failedTests++;
      }
      
      // Also test with aiAutomationService to ensure integration works
      if (!safetyResult.safe) {
        const automationResult = await aiAutomationService.processMessage(
          '+15551234567', 
          test.message,
          'test-conversation-' + Date.now()
        );
        
        logger.debug(`   AI Service handled: ${automationResult.handled}`);
        logger.debug(`   AI Service type: ${automationResult.assistantType}`);
        
        // Should not auto-handle blacklisted/escalated messages
        if (automationResult.handled) {
          logger.debug(`   ⚠️  WARNING: AI Service auto-handled a blocked message!`);
        }
      }
      
    } catch (error) {
      logger.debug(`   ❌ ERROR:`, error);
      failedTests++;
    }
  }
  
  // Check escalation alerts were created
  logger.debug('\n' + '=' .repeat(60));
  logger.debug('\n🚨 Checking Escalation Alerts:');
  
  const alerts = await db.query(`
    SELECT id, trigger_keyword, alert_type, created_at 
    FROM pattern_escalation_alerts 
    WHERE created_at > NOW() - INTERVAL '5 minutes'
    ORDER BY created_at DESC
    LIMIT 5
  `);
  
  logger.debug(`  Found ${alerts.rows.length} recent alerts`);
  alerts.rows.forEach(alert => {
    logger.debug(`  - Alert #${alert.id}: ${alert.alert_type} - Keywords: ${alert.trigger_keyword}`);
  });
  
  // Summary
  logger.debug('\n' + '=' .repeat(60));
  logger.debug('\n📊 Test Summary:');
  logger.debug(`  Total Tests: ${passedTests + failedTests}`);
  logger.debug(`  ✅ Passed: ${passedTests}`);
  logger.debug(`  ❌ Failed: ${failedTests}`);
  logger.debug(`  Success Rate: ${Math.round(passedTests / (passedTests + failedTests) * 100)}%`);
  
  if (failedTests === 0) {
    logger.debug('\n🎉 All safety controls are working correctly!');
  } else {
    logger.debug('\n⚠️  Some safety controls are not working as expected.');
    logger.debug('Check the database configuration and service integration.');
  }
  
  logger.debug('\n' + '=' .repeat(60));
  process.exit(failedTests === 0 ? 0 : 1);
}

// Run the test
testSafetyControls().catch(error => {
  logger.error('Test failed:', error);
  process.exit(1);
});