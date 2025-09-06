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
  console.log('\n🔒 Testing V3-PLS Safety Controls\n');
  console.log('=' .repeat(60));
  
  let passedTests = 0;
  let failedTests = 0;
  
  // First, show current settings
  const settings = await patternSafetyService.getSettings();
  console.log('\n📋 Current Safety Settings:');
  console.log(`  Blacklist Topics (${settings.blacklistTopics.length}):`, 
    settings.blacklistTopics.slice(0, 5).join(', '), '...');
  console.log(`  Escalation Keywords (${settings.escalationKeywords.length}):`, 
    settings.escalationKeywords.slice(0, 5).join(', '), '...');
  console.log(`  Approval Required: ${settings.requireApprovalForNew}`);
  console.log(`  Min Examples: ${settings.minExamplesRequired}`);
  console.log('\n' + '=' .repeat(60));
  
  // Test each message
  for (const test of testMessages) {
    console.log(`\n📝 Test: ${test.description}`);
    console.log(`   Message: "${test.message}"`);
    console.log(`   Expected: ${test.expected}`);
    
    try {
      // Test with patternSafetyService directly
      const safetyResult = await patternSafetyService.checkMessageSafety(test.message);
      
      let actualResult = 'safe';
      if (!safetyResult.safe) {
        actualResult = safetyResult.alertType || 'blocked';
      }
      
      console.log(`   Actual: ${actualResult}`);
      
      if (actualResult === test.expected) {
        console.log(`   ✅ PASSED`);
        if (safetyResult.triggeredKeywords) {
          console.log(`   Triggered by: ${safetyResult.triggeredKeywords.join(', ')}`);
        }
        passedTests++;
      } else {
        console.log(`   ❌ FAILED`);
        console.log(`   Safety Result:`, safetyResult);
        failedTests++;
      }
      
      // Also test with aiAutomationService to ensure integration works
      if (!safetyResult.safe) {
        const automationResult = await aiAutomationService.processMessage(
          '+15551234567', 
          test.message,
          'test-conversation-' + Date.now()
        );
        
        console.log(`   AI Service handled: ${automationResult.handled}`);
        console.log(`   AI Service type: ${automationResult.assistantType}`);
        
        // Should not auto-handle blacklisted/escalated messages
        if (automationResult.handled) {
          console.log(`   ⚠️  WARNING: AI Service auto-handled a blocked message!`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR:`, error);
      failedTests++;
    }
  }
  
  // Check escalation alerts were created
  console.log('\n' + '=' .repeat(60));
  console.log('\n🚨 Checking Escalation Alerts:');
  
  const alerts = await db.query(`
    SELECT id, trigger_keyword, alert_type, created_at 
    FROM pattern_escalation_alerts 
    WHERE created_at > NOW() - INTERVAL '5 minutes'
    ORDER BY created_at DESC
    LIMIT 5
  `);
  
  console.log(`  Found ${alerts.rows.length} recent alerts`);
  alerts.rows.forEach(alert => {
    console.log(`  - Alert #${alert.id}: ${alert.alert_type} - Keywords: ${alert.trigger_keyword}`);
  });
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('\n📊 Test Summary:');
  console.log(`  Total Tests: ${passedTests + failedTests}`);
  console.log(`  ✅ Passed: ${passedTests}`);
  console.log(`  ❌ Failed: ${failedTests}`);
  console.log(`  Success Rate: ${Math.round(passedTests / (passedTests + failedTests) * 100)}%`);
  
  if (failedTests === 0) {
    console.log('\n🎉 All safety controls are working correctly!');
  } else {
    console.log('\n⚠️  Some safety controls are not working as expected.');
    console.log('Check the database configuration and service integration.');
  }
  
  console.log('\n' + '=' .repeat(60));
  process.exit(failedTests === 0 ? 0 : 1);
}

// Run the test
testSafetyControls().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});