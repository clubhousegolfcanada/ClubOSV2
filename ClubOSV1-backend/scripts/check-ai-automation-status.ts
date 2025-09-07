import { query } from '../src/utils/db';

async function checkAIAutomationStatus() {
  console.log('=== AI AUTOMATION FEATURES INVESTIGATION ===\n');
  
  try {
    // 1. Check ai_automation_features table
    console.log('1. AI Automation Features Status:');
    const features = await query(`
      SELECT 
        key,
        name,
        enabled,
        confidence_threshold,
        max_uses_per_day,
        current_uses_today,
        total_uses,
        last_used,
        updated_at
      FROM ai_automation_features
      ORDER BY key
    `);
    
    console.log('\nFeatures in ai_automation_features table:');
    features.rows.forEach(f => {
      console.log(`\n   ${f.key}: ${f.name}`);
      console.log(`      Enabled: ${f.enabled}`);
      console.log(`      Confidence: ${f.confidence_threshold}`);
      console.log(`      Uses today: ${f.current_uses_today}/${f.max_uses_per_day}`);
      console.log(`      Total uses: ${f.total_uses}`);
      console.log(`      Last used: ${f.last_used || 'Never'}`);
    });
    
    // 2. Check if there's a link between patterns and features
    console.log('\n\n2. Patterns linked to AI automation features:');
    const linkedPatterns = await query(`
      SELECT 
        p.id,
        p.pattern_type,
        p.related_feature_key,
        p.is_active,
        p.is_deleted,
        p.confidence_score,
        p.execution_count,
        SUBSTRING(p.pattern, 1, 50) as pattern_preview,
        af.name as feature_name,
        af.enabled as feature_enabled
      FROM decision_patterns p
      LEFT JOIN ai_automation_features af ON p.related_feature_key = af.key
      WHERE p.related_feature_key IS NOT NULL
      ORDER BY p.related_feature_key, p.id
    `);
    
    if (linkedPatterns.rows.length === 0) {
      console.log('   No patterns are linked to AI automation features');
    } else {
      linkedPatterns.rows.forEach(p => {
        console.log(`\n   Pattern ID ${p.id}: ${p.pattern_preview}...`);
        console.log(`      Feature: ${p.related_feature_key} (${p.feature_name})`);
        console.log(`      Pattern active: ${p.is_active}, deleted: ${p.is_deleted}`);
        console.log(`      Feature enabled: ${p.feature_enabled}`);
      });
    }
    
    // 3. Check for gift card specific patterns
    console.log('\n\n3. Gift Card Patterns:');
    const giftCardPatterns = await query(`
      SELECT 
        id,
        pattern_type,
        SUBSTRING(pattern, 1, 60) as pattern_preview,
        is_active,
        is_deleted,
        confidence_score,
        execution_count,
        success_count,
        related_feature_key
      FROM decision_patterns
      WHERE 
        pattern_type = 'gift_cards'
        OR pattern ILIKE '%gift%card%'
        OR trigger_text ILIKE '%gift%card%'
        OR response_template ILIKE '%clubhouse247golf.com/gift-cards%'
      ORDER BY is_active DESC, confidence_score DESC
    `);
    
    console.log(`Found ${giftCardPatterns.rows.length} gift card related patterns:`);
    giftCardPatterns.rows.forEach(p => {
      console.log(`\n   ID ${p.id} [${p.pattern_type}]: "${p.pattern_preview}"`);
      console.log(`      Active: ${p.is_active}, Deleted: ${p.is_deleted}`);
      console.log(`      Confidence: ${p.confidence_score}, Executions: ${p.execution_count}, Successes: ${p.success_count}`);
      console.log(`      Linked feature: ${p.related_feature_key || 'None'}`);
    });
    
    // 4. Check for trackman reset patterns
    console.log('\n\n4. Trackman Reset Patterns:');
    const trackmanPatterns = await query(`
      SELECT 
        id,
        pattern_type,
        SUBSTRING(pattern, 1, 60) as pattern_preview,
        is_active,
        is_deleted,
        confidence_score,
        execution_count,
        success_count,
        related_feature_key
      FROM decision_patterns
      WHERE 
        pattern ILIKE '%trackman%'
        OR pattern ILIKE '%frozen%'
        OR pattern ILIKE '%stuck%'
        OR pattern ILIKE '%restart%'
        OR pattern ILIKE '%reset%'
        OR trigger_text ILIKE '%trackman%'
        OR trigger_text ILIKE '%simulator%'
        OR response_template ILIKE '%reset%'
      ORDER BY is_active DESC, confidence_score DESC
    `);
    
    console.log(`Found ${trackmanPatterns.rows.length} trackman/reset related patterns:`);
    trackmanPatterns.rows.forEach(p => {
      console.log(`\n   ID ${p.id} [${p.pattern_type}]: "${p.pattern_preview}"`);
      console.log(`      Active: ${p.is_active}, Deleted: ${p.is_deleted}`);
      console.log(`      Confidence: ${p.confidence_score}, Executions: ${p.execution_count}, Successes: ${p.success_count}`);
      console.log(`      Linked feature: ${p.related_feature_key || 'None'}`);
    });
    
    // 5. Check pattern learning config
    console.log('\n\n5. Pattern Learning Configuration:');
    const config = await query(`
      SELECT config_key, config_value, description
      FROM pattern_learning_config
      WHERE config_key IN ('enabled', 'shadow_mode', 'auto_execute_threshold')
      ORDER BY config_key
    `);
    
    config.rows.forEach(c => {
      console.log(`   ${c.config_key}: ${c.config_value} (${c.description})`);
    });
    
    // 6. Check if patterns and features are properly synced
    console.log('\n\n6. Sync Check - Features that should have patterns:');
    const shouldHavePatterns = await query(`
      SELECT 
        af.key,
        af.name,
        af.enabled,
        COUNT(p.id) as pattern_count,
        COUNT(p.id) FILTER (WHERE p.is_active = true AND (p.is_deleted = false OR p.is_deleted IS NULL)) as active_patterns
      FROM ai_automation_features af
      LEFT JOIN decision_patterns p ON p.related_feature_key = af.key
      WHERE af.enabled = true
      GROUP BY af.key, af.name, af.enabled
      ORDER BY af.key
    `);
    
    shouldHavePatterns.rows.forEach(f => {
      console.log(`\n   ${f.key}: ${f.name}`);
      console.log(`      Feature enabled: ${f.enabled}`);
      console.log(`      Total patterns: ${f.pattern_count}`);
      console.log(`      Active patterns: ${f.active_patterns}`);
      if (f.enabled && f.active_patterns === '0') {
        console.log(`      ⚠️ WARNING: Feature is enabled but has no active patterns!`);
      }
    });
    
  } catch (error) {
    console.error('Error checking AI automation status:', error);
  }
  
  process.exit(0);
}

checkAIAutomationStatus();