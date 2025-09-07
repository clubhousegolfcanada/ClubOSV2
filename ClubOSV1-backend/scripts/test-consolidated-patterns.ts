/**
 * Test script for the consolidated V3-PLS pattern system
 * Tests both the new enhanced-patterns route and patternSystemService
 */

import { db } from '../src/utils/database';
import { PatternSystemService } from '../src/services/patternSystemService';
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_TOKEN = process.env.TEST_TOKEN || '';

async function testConsolidatedSystem() {
  console.log('\n=== TESTING CONSOLIDATED V3-PLS SYSTEM ===\n');
  
  const patternSystem = new PatternSystemService();
  
  // Test cases
  const testMessages = [
    { message: "Do you sell gift cards?", expected: "gift_cards" },
    { message: "The TV is not working", expected: "tech_issue" },
    { message: "Can I bring tequila?", expected: "food_drink" },
    { message: "What are your hours?", expected: "hours" },
    { message: "How much does it cost?", expected: "pricing" }
  ];
  
  console.log('1. Testing Pattern System Service\n');
  
  for (const test of testMessages) {
    console.log(`\nTesting: "${test.message}"`);
    
    try {
      // Test the service directly
      const result = await patternSystem.processMessage(test.message, {
        conversationId: 'test-123',
        phoneNumber: '+1234567890',
        customerName: 'Test User'
      });
      
      console.log(`  Action: ${result.action}`);
      console.log(`  Pattern: ${result.pattern?.pattern_type || 'none'}`);
      console.log(`  Confidence: ${result.confidence || 0}`);
      console.log(`  Response: "${result.response?.substring(0, 50)}..."`);
      
      if (result.pattern?.pattern_type === test.expected) {
        console.log(`  ✅ Matched expected pattern type`);
      } else {
        console.log(`  ⚠️ Expected ${test.expected}, got ${result.pattern?.pattern_type}`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n\n2. Testing Enhanced Patterns API Endpoint\n');
  
  // Test the new enhanced-patterns route
  try {
    const headers = TEST_TOKEN ? { Authorization: `Bearer ${TEST_TOKEN}` } : {};
    
    // Test GET /api/enhanced-patterns
    console.log('Testing GET /api/enhanced-patterns:');
    const getResponse = await axios.get(`${API_URL}/api/enhanced-patterns`, { headers });
    console.log(`  Found ${getResponse.data.patterns?.length || 0} patterns`);
    
    // Test pattern creation (dry run - don't actually create)
    console.log('\nTesting POST /api/enhanced-patterns (validation only):');
    const testPattern = {
      pattern_type: 'test',
      trigger_examples: ['test pattern please ignore'],
      response_template: 'This is a test response',
      confidence_score: 0.5,
      validate_only: true // Don't actually create
    };
    
    try {
      const postResponse = await axios.post(
        `${API_URL}/api/enhanced-patterns`,
        testPattern,
        { headers }
      );
      console.log('  Pattern validation successful');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('  ⚠️ Enhanced patterns endpoint not yet active');
      } else {
        console.log(`  Error: ${error.response?.data?.error || error.message}`);
      }
    }
  } catch (error) {
    console.log(`API test failed: ${error.message}`);
  }
  
  console.log('\n\n3. Testing Pattern Matching Performance\n');
  
  // Test matching speed
  const startTime = Date.now();
  const iterations = 10;
  
  for (let i = 0; i < iterations; i++) {
    await patternSystem.processMessage('Do you sell gift cards?', {
      conversationId: `perf-test-${i}`,
      phoneNumber: '+1234567890'
    });
  }
  
  const avgTime = (Date.now() - startTime) / iterations;
  console.log(`Average processing time: ${avgTime.toFixed(2)}ms per message`);
  
  console.log('\n\n4. Checking System Configuration\n');
  
  // Check pattern learning config
  const config = await db.query(`
    SELECT config_key, config_value 
    FROM pattern_learning_config 
    WHERE config_key IN (
      'enabled', 'shadow_mode', 'min_confidence_to_act',
      'min_confidence_to_suggest', 'use_semantic_search'
    )
    ORDER BY config_key
  `);
  
  console.log('Pattern Learning Configuration:');
  config.rows.forEach(c => {
    console.log(`  ${c.config_key}: ${c.config_value}`);
  });
  
  // Check pattern statistics
  const stats = await db.query(`
    SELECT 
      COUNT(*) as total_patterns,
      SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_patterns,
      SUM(CASE WHEN auto_executable THEN 1 ELSE 0 END) as auto_exec_patterns,
      SUM(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) as patterns_with_embeddings,
      AVG(confidence_score) as avg_confidence
    FROM decision_patterns
    WHERE COALESCE(is_deleted, FALSE) = FALSE
  `);
  
  console.log('\nPattern Statistics:');
  const s = stats.rows[0];
  console.log(`  Total Patterns: ${s.total_patterns}`);
  console.log(`  Active: ${s.active_patterns}`);
  console.log(`  Auto-executable: ${s.auto_exec_patterns}`);
  console.log(`  With Embeddings: ${s.patterns_with_embeddings}`);
  console.log(`  Avg Confidence: ${parseFloat(s.avg_confidence).toFixed(2)}`);
  
  console.log('\n=== TEST COMPLETE ===\n');
}

testConsolidatedSystem()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });