#!/usr/bin/env npx tsx
/**
 * Test V3-PLS Pattern Matching
 * Tests that patterns are working correctly
 */

import { query } from '../src/utils/db';
import { PatternLearningService } from '../src/services/patternLearningService';

async function testPatterns() {
  console.log('🧪 TESTING V3-PLS PATTERN MATCHING\n');
  
  const patternService = new PatternLearningService();
  
  // Test messages
  const testCases = [
    {
      message: "Do you sell gift cards?",
      expectedType: 'gift_cards',
      expectedAction: 'auto_execute'
    },
    {
      message: "Can I buy a gift card for my friend?",
      expectedType: 'gift_cards',
      expectedAction: 'auto_execute'
    },
    {
      message: "The trackman is frozen in bay 3",
      expectedType: 'tech_issue',
      expectedAction: 'auto_execute'
    },
    {
      message: "What are your hours today?",
      expectedType: 'hours',
      expectedAction: 'auto_execute'
    },
    {
      message: "How much does it cost to play?",
      expectedType: 'faq',
      expectedAction: 'auto_execute'
    }
  ];
  
  console.log('Testing pattern matching for common queries:\n');
  
  for (const test of testCases) {
    console.log(`📝 Testing: "${test.message}"`);
    
    try {
      // Test pattern matching directly
      const result = await patternService.processMessage(
        test.message,
        '555-1234',
        'test-conversation-' + Date.now(),
        'Test Customer'
      );
      
      if (result.pattern) {
        console.log(`  ✅ Matched: ${result.pattern.pattern_type} (ID: ${result.pattern.id})`);
        console.log(`  📊 Confidence: ${(result.pattern.confidence_score * 100).toFixed(0)}%`);
        console.log(`  🎯 Action: ${result.action}`);
        
        if (result.response) {
          console.log(`  💬 Response: "${result.response.substring(0, 100)}..."`);
        }
        
        if (result.action !== test.expectedAction) {
          console.log(`  ⚠️ Expected action: ${test.expectedAction}, got: ${result.action}`);
        }
      } else {
        console.log(`  ❌ No pattern matched (action: ${result.action})`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  // Check database patterns
  console.log('\n📊 DATABASE PATTERN CHECK:\n');
  
  const patterns = await query(`
    SELECT 
      pattern_type,
      COUNT(*) as count,
      COUNT(*) FILTER (WHERE is_active = TRUE AND is_deleted = FALSE) as active,
      COUNT(*) FILTER (WHERE auto_executable = TRUE AND is_active = TRUE) as auto_exec,
      AVG(confidence_score) as avg_confidence
    FROM decision_patterns
    GROUP BY pattern_type
    ORDER BY active DESC
  `);
  
  console.log('Pattern distribution by type:');
  patterns.rows.forEach(p => {
    console.log(`  ${p.pattern_type}: ${p.active} active / ${p.count} total (${p.auto_exec} auto-exec, avg conf: ${(p.avg_confidence * 100).toFixed(0)}%)`);
  });
  
  // Check configuration
  console.log('\n⚙️ CONFIGURATION CHECK:\n');
  
  const config = await query(`
    SELECT config_key, config_value 
    FROM pattern_learning_config 
    WHERE config_key IN ('enabled', 'shadow_mode', 'auto_send_enabled', 'min_confidence_to_act')
    ORDER BY config_key
  `);
  
  config.rows.forEach(c => {
    const icon = c.config_value === 'true' ? '✅' : c.config_value === 'false' ? '❌' : '📊';
    console.log(`  ${icon} ${c.config_key}: ${c.config_value}`);
  });
  
  // Test specific pattern retrieval
  console.log('\n🎁 GIFT CARD PATTERN CHECK:\n');
  
  const giftCardPattern = await query(`
    SELECT id, pattern, response_template, confidence_score, auto_executable, is_active
    FROM decision_patterns
    WHERE pattern_type = 'gift_cards' AND is_active = TRUE AND is_deleted = FALSE
    ORDER BY confidence_score DESC
    LIMIT 1
  `);
  
  if (giftCardPattern.rows.length > 0) {
    const gp = giftCardPattern.rows[0];
    console.log(`  ✅ Gift card pattern active (ID: ${gp.id})`);
    console.log(`  Pattern: "${gp.pattern}"`);
    console.log(`  Response: "${gp.response_template.substring(0, 100)}..."`);
    console.log(`  Confidence: ${(gp.confidence_score * 100).toFixed(0)}%`);
    console.log(`  Auto-executable: ${gp.auto_executable ? 'Yes' : 'No'}`);
  } else {
    console.log('  ❌ No active gift card pattern found!');
  }
  
  console.log('\n✅ Testing complete!');
}

testPatterns().catch(console.error);