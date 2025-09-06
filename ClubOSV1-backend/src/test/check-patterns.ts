#!/usr/bin/env npx tsx
/**
 * Check what patterns exist in the database
 */

import { db } from '../utils/database';
import { logger } from '../utils/logger';

async function checkPatterns() {
  console.log('\n🔍 Checking Pattern Learning Status\n');
  console.log('=' .repeat(60));
  
  // Check if pattern learning is enabled
  const configResult = await db.query(`
    SELECT config_key, config_value 
    FROM pattern_learning_config 
    WHERE config_key IN ('enabled', 'shadow_mode', 'min_occurrences_to_learn')
  `);
  
  console.log('\n📋 Configuration:');
  configResult.rows.forEach(row => {
    console.log(`  ${row.config_key}: ${row.config_value}`);
  });
  
  // Check how many patterns exist
  const patternsResult = await db.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_active = TRUE) as active,
      COUNT(*) FILTER (WHERE pattern_type = 'learned') as learned,
      COUNT(*) FILTER (WHERE pattern_type = 'manual') as manual
    FROM decision_patterns
  `);
  
  console.log('\n📊 Pattern Statistics:');
  const stats = patternsResult.rows[0];
  console.log(`  Total patterns: ${stats.total}`);
  console.log(`  Active patterns: ${stats.active}`);
  console.log(`  Learned patterns: ${stats.learned}`);
  console.log(`  Manual patterns: ${stats.manual}`);
  
  // Check recent patterns
  const recentPatterns = await db.query(`
    SELECT 
      id,
      pattern_type,
      trigger_text,
      response_template,
      confidence_score,
      is_active
    FROM decision_patterns
    ORDER BY id DESC
    LIMIT 5
  `);
  
  console.log('\n📝 Recent Patterns:');
  if (recentPatterns.rows.length === 0) {
    console.log('  No patterns found');
  } else {
    recentPatterns.rows.forEach(p => {
      console.log(`\n  Pattern #${p.id} (${p.pattern_type})`);
      console.log(`  Trigger: ${p.trigger_text?.substring(0, 50)}...`);
      console.log(`  Response: ${p.response_template?.substring(0, 50)}...`);
      console.log(`  Confidence: ${p.confidence_score}`);
      console.log(`  Active: ${p.is_active}`);
    });
  }
  
  // Check pattern learning examples
  const examplesResult = await db.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT pattern_signature) as unique_patterns,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as recent
    FROM pattern_learning_examples
  `);
  
  console.log('\n📚 Learning Examples:');
  const examples = examplesResult.rows[0];
  console.log(`  Total examples: ${examples.total}`);
  console.log(`  Unique patterns: ${examples.unique_patterns}`);
  console.log(`  Added in last 24h: ${examples.recent}`);
  
  // Check recent conversations with messages
  const conversationsResult = await db.query(`
    SELECT 
      c.id,
      c.phone_number,
      c.created_at,
      c.last_message_at,
      COUNT(cm.id) as message_count,
      COUNT(cm.id) FILTER (WHERE cm.direction = 'inbound') as inbound_count,
      COUNT(cm.id) FILTER (WHERE cm.direction = 'outbound') as outbound_count
    FROM conversations c
    LEFT JOIN conversation_messages cm ON c.id = cm.conversation_id
    WHERE c.last_message_at > NOW() - INTERVAL '1 hour'
    GROUP BY c.id
    ORDER BY c.last_message_at DESC
    LIMIT 5
  `);
  
  console.log('\n💬 Recent Conversations (last hour):');
  if (conversationsResult.rows.length === 0) {
    console.log('  No recent conversations');
  } else {
    conversationsResult.rows.forEach(c => {
      console.log(`\n  Conversation: ${c.id}`);
      console.log(`  Phone: ${c.phone_number?.slice(-4) || 'Unknown'}`);
      console.log(`  Messages: ${c.message_count} (${c.inbound_count} in, ${c.outbound_count} out)`);
      console.log(`  Last message: ${c.last_message_at}`);
    });
  }
  
  // Check if webhook is recording messages
  const webhookMessages = await db.query(`
    SELECT 
      direction,
      COUNT(*) as count
    FROM conversation_messages
    WHERE created_at > NOW() - INTERVAL '1 hour'
    GROUP BY direction
  `);
  
  console.log('\n🔄 Webhook Activity (last hour):');
  if (webhookMessages.rows.length === 0) {
    console.log('  No webhook messages recorded');
  } else {
    webhookMessages.rows.forEach(m => {
      console.log(`  ${m.direction}: ${m.count} messages`);
    });
  }
  
  // Check pattern execution history
  const executionResult = await db.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as recent,
      COUNT(*) FILTER (WHERE execution_mode = 'auto_executed') as auto_executed,
      COUNT(*) FILTER (WHERE execution_mode = 'suggested') as suggested
    FROM pattern_execution_history
  `);
  
  console.log('\n⚡ Pattern Execution:');
  const exec = executionResult.rows[0];
  console.log(`  Total executions: ${exec.total}`);
  console.log(`  Last 24h: ${exec.recent}`);
  console.log(`  Auto-executed: ${exec.auto_executed}`);
  console.log(`  Suggested: ${exec.suggested}`);
  
  console.log('\n' + '=' .repeat(60));
  
  // Check specific conversation example
  console.log('\n🔎 Looking for your specific conversation about clubs...');
  const clubsConvo = await db.query(`
    SELECT 
      cm.*,
      c.phone_number
    FROM conversation_messages cm
    JOIN conversations c ON cm.conversation_id = c.id
    WHERE cm.body ILIKE '%clubs%available%'
       OR cm.body ILIKE '%benefit%bringing%friend%'
    ORDER BY cm.created_at DESC
    LIMIT 5
  `);
  
  if (clubsConvo.rows.length > 0) {
    console.log(`  Found ${clubsConvo.rows.length} messages about clubs:`);
    clubsConvo.rows.forEach(m => {
      console.log(`\n  Message ID: ${m.id}`);
      console.log(`  Direction: ${m.direction}`);
      console.log(`  Text: ${m.body?.substring(0, 100)}...`);
      console.log(`  Phone: ${m.phone_number?.slice(-4)}`);
      console.log(`  Time: ${m.created_at}`);
    });
  } else {
    console.log('  No messages found about clubs availability');
  }
  
  process.exit(0);
}

checkPatterns().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});