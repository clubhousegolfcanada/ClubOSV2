/**
 * Debug script to test why certain patterns aren't matching
 */

import { db } from '../src/utils/database';
import { logger } from '../src/utils/logger';

async function debugPatternMatching() {
  try {
    console.log('\n=== PATTERN MATCHING DEBUG ===\n');
    
    // 1. Check what patterns exist for tech support/TV issues
    const techPatterns = await db.query(`
      SELECT 
        id, 
        pattern_type, 
        pattern,
        trigger_text,
        trigger_keywords,
        trigger_examples,
        response_template,
        confidence_score,
        is_active,
        auto_executable,
        semantic_search_enabled,
        embedding IS NOT NULL as has_embedding
      FROM decision_patterns
      WHERE 
        pattern_type IN ('tech_support', 'trackman_reset', 'technical')
        OR response_template ILIKE '%trackman%'
        OR response_template ILIKE '%reset%'
        OR response_template ILIKE '%tv%'
        OR EXISTS (
          SELECT 1 FROM unnest(trigger_keywords) AS keyword
          WHERE keyword IN ('tv', 'trackman', 'reset', 'frozen', 'not working')
        )
      ORDER BY pattern_type, confidence_score DESC
    `);
    
    console.log(`Found ${techPatterns.rows.length} tech/TV related patterns:\n`);
    
    techPatterns.rows.forEach(p => {
      console.log(`Pattern #${p.id} (${p.pattern_type}):`);
      console.log(`  Active: ${p.is_active} | Auto-exec: ${p.auto_executable}`);
      console.log(`  Trigger: "${p.trigger_text || p.pattern}"`);
      console.log(`  Keywords: ${p.trigger_keywords?.join(', ') || 'none'}`);
      console.log(`  Examples: ${p.trigger_examples?.slice(0, 2).join(' | ') || 'none'}`);
      console.log(`  Response: "${p.response_template?.substring(0, 100)}..."`);
      console.log(`  Confidence: ${p.confidence_score} | Has embedding: ${p.has_embedding}`);
      console.log('');
    });
    
    // 2. Test what would match "The tv is not working"
    const testMessage = 'The tv is not working';
    console.log(`\n=== Testing message: "${testMessage}" ===\n`);
    
    // Test keyword matching
    const keywordMatches = await db.query(`
      SELECT 
        id,
        pattern_type,
        trigger_text,
        trigger_keywords,
        confidence_score,
        is_active
      FROM decision_patterns
      WHERE is_active = TRUE
        AND EXISTS (
          SELECT 1 FROM unnest(trigger_keywords) AS keyword
          WHERE $1 ILIKE '%' || keyword || '%'
        )
      ORDER BY confidence_score DESC
      LIMIT 5
    `, [testMessage]);
    
    console.log(`Keyword matches: ${keywordMatches.rows.length}`);
    keywordMatches.rows.forEach(p => {
      console.log(`  - #${p.id} (${p.pattern_type}): ${p.trigger_text} [${p.trigger_keywords?.join(', ')}]`);
    });
    
    // 3. Check gift card pattern for comparison
    console.log('\n=== Gift Card Pattern (working) ===\n');
    const giftCardPattern = await db.query(`
      SELECT 
        id,
        pattern_type,
        trigger_text,
        trigger_keywords,
        trigger_examples,
        confidence_score,
        is_active,
        auto_executable
      FROM decision_patterns
      WHERE pattern_type = 'gift_cards'
        OR response_template ILIKE '%gift%card%'
      LIMIT 1
    `);
    
    if (giftCardPattern.rows[0]) {
      const p = giftCardPattern.rows[0];
      console.log(`Pattern #${p.id}:`);
      console.log(`  Active: ${p.is_active} | Auto-exec: ${p.auto_executable}`);
      console.log(`  Keywords: ${p.trigger_keywords?.join(', ') || 'none'}`);
      console.log(`  Examples: ${p.trigger_examples?.slice(0, 2).join(' | ') || 'none'}`);
      console.log(`  Confidence: ${p.confidence_score}`);
    }
    
    // 4. Check pattern learning config
    console.log('\n=== Pattern Learning Config ===\n');
    const config = await db.query(`
      SELECT config_key, config_value 
      FROM pattern_learning_config 
      WHERE config_key IN ('enabled', 'shadow_mode', 'min_confidence_to_act')
    `);
    
    config.rows.forEach(c => {
      console.log(`  ${c.config_key}: ${c.config_value}`);
    });
    
  } catch (error) {
    console.error('Debug failed:', error);
  } finally {
    process.exit(0);
  }
}

debugPatternMatching();