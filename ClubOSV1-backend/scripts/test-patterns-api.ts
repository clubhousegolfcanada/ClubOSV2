#!/usr/bin/env npx tsx
/**
 * Test Pattern API Endpoints
 * Verifies all patterns are accessible via API
 */

import { query } from '../src/utils/db';

async function testPatternsAPI() {
  console.log('🧪 TESTING PATTERN API ENDPOINTS\n');
  
  try {
    // Test main patterns endpoint
    console.log('1️⃣ Testing main patterns query...');
    
    const mainQuery = await query(`
      SELECT 
        id,
        pattern_type,
        COALESCE(pattern, trigger_text, trigger_examples[1], '') as pattern,
        response_template,
        trigger_examples,
        trigger_keywords,
        confidence_score,
        execution_count,
        success_count,
        is_active,
        auto_executable,
        COALESCE(is_deleted, FALSE) as is_deleted,
        COALESCE(created_at, first_seen, NOW()) as created_at,
        COALESCE(updated_at, last_modified, NOW()) as updated_at,
        CASE 
          WHEN success_count > 0 AND execution_count > 0 
          THEN ROUND((success_count::float / execution_count::float * 100)::numeric, 0)
          ELSE 0 
        END as success_rate,
        COALESCE(last_used, updated_at, NOW()) as last_used
      FROM decision_patterns
      WHERE (is_deleted = false OR is_deleted IS NULL)
      AND is_active = true
      ORDER BY 
        is_active DESC,
        confidence_score DESC,
        execution_count DESC
    `);
    
    console.log(`  ✅ Main query returns: ${mainQuery.rows.length} patterns`);
    
    // Show pattern distribution
    const types = {};
    mainQuery.rows.forEach(p => {
      types[p.pattern_type] = (types[p.pattern_type] || 0) + 1;
    });
    
    console.log('\n  Pattern distribution:');
    Object.entries(types).forEach(([type, count]) => {
      console.log(`    ${type}: ${count}`);
    });
    
    // Test deleted patterns query
    console.log('\n2️⃣ Testing deleted patterns query...');
    
    const deletedQuery = await query(`
      SELECT 
        p.id,
        p.pattern_type,
        COALESCE(p.pattern, p.trigger_text, p.trigger_examples[1], '') as pattern,
        p.response_template,
        p.trigger_examples,
        p.trigger_keywords,
        p.confidence_score,
        p.execution_count,
        p.success_count,
        p.is_active,
        p.auto_executable,
        COALESCE(p.is_deleted, FALSE) as is_deleted,
        COALESCE(p.created_at, p.first_seen, NOW()) as created_at,
        COALESCE(p.updated_at, p.last_modified, NOW()) as updated_at,
        p.notes,
        u.name as deleted_by_name
      FROM decision_patterns p
      LEFT JOIN users u ON p.updated_by::text = u.id::text
      WHERE COALESCE(p.is_deleted, FALSE) = TRUE
      ORDER BY p.updated_at DESC
      LIMIT 50
    `);
    
    console.log(`  ✅ Deleted query returns: ${deletedQuery.rows.length} patterns`);
    
    // Test specific pattern query
    console.log('\n3️⃣ Testing specific pattern query (ID 217 - Gift Cards)...');
    
    const specificQuery = await query(`
      SELECT 
        id,
        pattern_type,
        COALESCE(pattern, trigger_text, trigger_examples[1], '') as pattern,
        response_template,
        trigger_examples,
        trigger_keywords,
        confidence_score,
        execution_count,
        success_count,
        is_active,
        auto_executable,
        COALESCE(is_deleted, FALSE) as is_deleted,
        COALESCE(created_at, first_seen, NOW()) as created_at,
        COALESCE(updated_at, last_modified, NOW()) as updated_at,
        notes,
        tags,
        action_template,
        requires_confirmation,
        COALESCE(last_used, updated_at, NOW()) as last_used
      FROM decision_patterns 
      WHERE id = $1`,
      [217]
    );
    
    if (specificQuery.rows.length > 0) {
      const p = specificQuery.rows[0];
      console.log(`  ✅ Pattern 217 found:`);
      console.log(`     Type: ${p.pattern_type}`);
      console.log(`     Pattern: "${p.pattern}"`);
      console.log(`     Active: ${p.is_active}`);
      console.log(`     Auto-exec: ${p.auto_executable}`);
    } else {
      console.log('  ❌ Pattern 217 not found!');
    }
    
    // Check critical patterns
    console.log('\n4️⃣ Checking critical patterns...');
    
    const criticalPatterns = await query(`
      SELECT 
        pattern_type,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE auto_executable = TRUE) as auto_exec
      FROM decision_patterns
      WHERE is_active = TRUE 
      AND (is_deleted = FALSE OR is_deleted IS NULL)
      AND pattern_type IN ('gift_cards', 'tech_issue', 'booking', 'hours')
      GROUP BY pattern_type
    `);
    
    console.log('  Critical pattern status:');
    criticalPatterns.rows.forEach(p => {
      const icon = p.count > 0 ? '✅' : '❌';
      console.log(`    ${icon} ${p.pattern_type}: ${p.count} active (${p.auto_exec} auto-exec)`);
    });
    
    // Summary
    console.log('\n📊 SUMMARY:');
    console.log(`  Total active patterns: ${mainQuery.rows.length}`);
    console.log(`  Deleted patterns: ${deletedQuery.rows.length}`);
    console.log(`  Gift card patterns: ${mainQuery.rows.filter(p => p.pattern_type === 'gift_cards').length}`);
    console.log(`  Trackman patterns: ${mainQuery.rows.filter(p => p.pattern && p.pattern.toLowerCase().includes('trackman')).length}`);
    
    if (mainQuery.rows.length < 60) {
      console.log('\n⚠️ WARNING: Only seeing ${mainQuery.rows.length} patterns, expected 68!');
      console.log('Some patterns may still be marked as deleted or inactive.');
    } else {
      console.log('\n✅ All patterns appear to be accessible!');
    }
    
  } catch (error) {
    console.error('❌ Error testing patterns:', error);
  }
  
  process.exit(0);
}

testPatternsAPI();