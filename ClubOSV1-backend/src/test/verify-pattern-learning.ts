#!/usr/bin/env npx tsx
/**
 * Verify V3-PLS Pattern Learning is Active and Working
 */

import { db } from '../utils/database';
import { logger } from '../utils/logger';

async function verifyPatternLearning() {
  console.log('\n✅ V3-PLS Pattern Learning Status Check\n');
  console.log('=' .repeat(60));
  
  const issues = [];
  const successes = [];
  
  // 1. Check if pattern learning is enabled
  console.log('\n1️⃣ Checking Pattern Learning Configuration...');
  const configResult = await db.query(`
    SELECT config_key, config_value 
    FROM pattern_learning_config 
    WHERE config_key IN ('enabled', 'shadow_mode', 'min_occurrences_to_learn')
    ORDER BY config_key
  `);
  
  const config: any = {};
  configResult.rows.forEach(row => {
    config[row.config_key] = row.config_value;
    console.log(`   ${row.config_key}: ${row.config_value}`);
  });
  
  if (config.enabled === 'true') {
    successes.push('✅ Pattern learning is ENABLED');
  } else {
    issues.push('❌ Pattern learning is DISABLED - needs to be enabled');
  }
  
  if (config.shadow_mode === 'false') {
    successes.push('✅ Shadow mode is OFF (patterns will be active)');
  } else {
    console.log('   ⚠️  Shadow mode is ON (patterns will not execute)');
  }
  
  // 2. Check if OpenAI is configured
  console.log('\n2️⃣ Checking OpenAI Configuration...');
  if (process.env.OPENAI_API_KEY) {
    successes.push('✅ OpenAI API key is configured');
    console.log('   API Key: sk-....' + process.env.OPENAI_API_KEY?.slice(-4));
  } else {
    issues.push('❌ OpenAI API key not configured - GPT-4o will not work');
  }
  
  // 3. Check recent pattern creation
  console.log('\n3️⃣ Checking Recent Pattern Activity...');
  const recentPatterns = await db.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE pattern_type = 'learned') as learned,
      COUNT(*) FILTER (WHERE created_by IS NOT NULL) as from_operators,
      MAX(id) as latest_id
    FROM decision_patterns
    WHERE is_active = TRUE
  `);
  
  const stats = recentPatterns.rows[0];
  console.log(`   Total active patterns: ${stats.total}`);
  console.log(`   Learned patterns: ${stats.learned}`);
  console.log(`   From operators: ${stats.from_operators}`);
  
  if (stats.learned > 0) {
    successes.push(`✅ ${stats.learned} learned patterns exist`);
  } else {
    console.log('   ⚠️  No learned patterns yet (will be created as operators respond)');
  }
  
  // 4. Check pattern learning examples
  console.log('\n4️⃣ Checking Pattern Learning Examples...');
  const examples = await db.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT pattern_signature) as unique_patterns,
      MAX(created_at) as latest
    FROM pattern_learning_examples
  `);
  
  const exampleStats = examples.rows[0];
  console.log(`   Total examples: ${exampleStats.total}`);
  console.log(`   Unique patterns: ${exampleStats.unique_patterns}`);
  if (exampleStats.latest) {
    console.log(`   Latest example: ${exampleStats.latest}`);
  }
  
  // 5. Check if messages table exists and has data
  console.log('\n5️⃣ Checking Message Storage...');
  const messages = await db.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE direction = 'inbound') as inbound,
      COUNT(*) FILTER (WHERE direction = 'outbound') as outbound,
      MAX(created_at) as latest
    FROM messages
    WHERE created_at > NOW() - INTERVAL '7 days'
  `);
  
  const msgStats = messages.rows[0];
  console.log(`   Messages (last 7 days): ${msgStats.total}`);
  console.log(`   Inbound: ${msgStats.inbound}, Outbound: ${msgStats.outbound}`);
  
  if (msgStats.total > 0) {
    successes.push('✅ Message storage is working');
  } else {
    issues.push('❌ No recent messages found - pattern learning needs message history');
  }
  
  // 6. Test if pattern learning service is importable
  console.log('\n6️⃣ Testing Pattern Learning Service...');
  try {
    const { patternLearningService } = await import('../services/patternLearningService');
    if (patternLearningService) {
      successes.push('✅ Pattern learning service is available');
      console.log('   Service loaded successfully');
    }
  } catch (error) {
    issues.push('❌ Pattern learning service failed to load');
    console.error('   Error:', error);
  }
  
  // 7. Test if conversation analyzer is available
  console.log('\n7️⃣ Testing Conversation Analyzer...');
  try {
    const { ConversationAnalyzer } = await import('../services/conversationAnalyzer');
    const analyzer = new ConversationAnalyzer();
    if (analyzer) {
      successes.push('✅ Conversation analyzer is available');
      console.log('   Analyzer loaded successfully');
    }
  } catch (error) {
    issues.push('❌ Conversation analyzer failed to load');
    console.error('   Error:', error);
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('\n📊 SUMMARY\n');
  
  if (successes.length > 0) {
    console.log('✅ Working Components:');
    successes.forEach(s => console.log('   ' + s));
  }
  
  if (issues.length > 0) {
    console.log('\n❌ Issues Found:');
    issues.forEach(i => console.log('   ' + i));
    
    console.log('\n🔧 How to Fix:');
    if (issues.some(i => i.includes('DISABLED'))) {
      console.log('   - Go to V3-PLS → Stats & Settings → Enable pattern learning');
    }
    if (issues.some(i => i.includes('OpenAI'))) {
      console.log('   - Add OPENAI_API_KEY to environment variables');
    }
  } else {
    console.log('\n🎉 ALL SYSTEMS GO! Pattern learning is fully operational.');
    console.log('\nNext operator response will:');
    console.log('1. Capture the last 6 messages');
    console.log('2. Analyze with GPT-4o for context');
    console.log('3. Create a smart pattern if it\'s a complete Q&A');
    console.log('4. Display in V3-PLS patterns page');
  }
  
  console.log('\n' + '=' .repeat(60));
  process.exit(issues.length > 0 ? 1 : 0);
}

verifyPatternLearning().catch(error => {
  console.error('Verification failed:', error);
  process.exit(1);
});