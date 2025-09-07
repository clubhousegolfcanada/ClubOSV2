import { query } from '../src/utils/db';

async function checkV3PLSStatus() {
  console.log('=== V3-PLS PATTERN LEARNING SYSTEM STATUS ===\n');
  
  try {
    // 1. Check pattern learning config
    console.log('1. Pattern Learning Configuration:');
    const config = await query(`
      SELECT * FROM pattern_learning_config
      ORDER BY config_key
    `);
    
    console.log('\nPattern Learning Settings:');
    config.rows.forEach(c => {
      console.log(`  ${c.config_key}: ${c.config_value}`);
      if (c.description) console.log(`    (${c.description})`);
    });
    
    // 2. Check what happened on Sep 6 when patterns were mass-deleted
    console.log('\n\n2. What happened on September 6th?');
    const sep6Activity = await query(`
      SELECT 
        'patterns' as table_name,
        COUNT(*) as records_affected,
        MIN(updated_at) as first_update,
        MAX(updated_at) as last_update
      FROM decision_patterns
      WHERE DATE(updated_at) = '2025-09-06'
    `);
    
    sep6Activity.rows.forEach(row => {
      if (row.records_affected > 0) {
        console.log(`  ${row.table_name}: ${row.records_affected} records updated`);
        console.log(`    Between ${row.first_update} and ${row.last_update}`);
      }
    });
    
    // 3. Check for cleanup scripts or migrations that might have run
    console.log('\n\n3. Recent migrations that might have affected patterns:');
    const migrations = await query(`
      SELECT name, executed_at 
      FROM migrations 
      WHERE executed_at >= '2025-09-06'
      ORDER BY executed_at DESC
      LIMIT 10
    `);
    
    if (migrations.rows.length === 0) {
      console.log('  No recent migrations found');
    } else {
      migrations.rows.forEach(m => {
        console.log(`  ${m.name} - executed at ${m.executed_at}`);
      });
    }
    
    // 4. Check pattern statistics
    console.log('\n\n4. Pattern Statistics by Type and Status:');
    const stats = await query(`
      SELECT 
        pattern_type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE is_deleted = true) as deleted,
        COUNT(*) FILTER (WHERE confidence_score >= 0.85) as high_confidence,
        COUNT(*) FILTER (WHERE execution_count > 0) as executed,
        COUNT(*) FILTER (WHERE success_count > 0) as successful
      FROM decision_patterns
      GROUP BY pattern_type
      ORDER BY total DESC
    `);
    
    console.log('\n  Type       | Total | Active | Deleted | High Conf | Executed | Successful');
    console.log('  -----------|-------|--------|---------|-----------|----------|------------');
    stats.rows.forEach(s => {
      console.log(`  ${s.pattern_type.padEnd(10)} | ${String(s.total).padStart(5)} | ${String(s.active).padStart(6)} | ${String(s.deleted).padStart(7)} | ${String(s.high_confidence).padStart(9)} | ${String(s.executed).padStart(8)} | ${String(s.successful).padStart(10)}`);
    });
    
    // 5. Check for patterns that were working before Sep 6
    console.log('\n\n5. Patterns that were executed successfully before deactivation:');
    const previouslyWorking = await query(`
      SELECT 
        id,
        pattern_type,
        SUBSTRING(pattern, 1, 50) as pattern_preview,
        confidence_score,
        execution_count,
        success_count,
        is_active,
        is_deleted,
        last_used,
        updated_at
      FROM decision_patterns
      WHERE execution_count > 0
      AND success_count > 0
      AND (is_active = false OR is_deleted = true)
      ORDER BY success_count DESC
      LIMIT 10
    `);
    
    previouslyWorking.rows.forEach(p => {
      console.log(`\n  ID ${p.id} [${p.pattern_type}]: "${p.pattern_preview}..."`);
      console.log(`    Executions: ${p.execution_count}, Successes: ${p.success_count}`);
      console.log(`    Currently: active=${p.is_active}, deleted=${p.is_deleted}`);
      console.log(`    Last used: ${p.last_used}, Updated: ${p.updated_at}`);
    });
    
    // 6. Check if cleanup-patterns script might have done this
    console.log('\n\n6. Checking for pattern cleanup impact:');
    const lowPerformers = await query(`
      SELECT COUNT(*) as count
      FROM decision_patterns
      WHERE execution_count >= 2 
      AND (success_count::float / NULLIF(execution_count, 0) * 100) < 50
      AND is_deleted = true
    `);
    
    const unused = await query(`
      SELECT COUNT(*) as count
      FROM decision_patterns
      WHERE execution_count = 0
      AND is_deleted = true
    `);
    
    console.log(`  Low performers (< 50% success) marked deleted: ${lowPerformers.rows[0].count}`);
    console.log(`  Unused patterns (0 executions) marked deleted: ${unused.rows[0].count}`);
    
    // 7. List patterns that should definitely be active
    console.log('\n\n7. High-value patterns that should be reactivated:');
    const shouldBeActive = await query(`
      SELECT 
        id,
        pattern_type,
        SUBSTRING(pattern, 1, 60) as pattern_preview,
        confidence_score,
        execution_count,
        success_count,
        ROUND((success_count::float / NULLIF(execution_count, 0) * 100)::numeric, 0) as success_rate
      FROM decision_patterns
      WHERE (
        -- Gift card patterns
        (pattern_type = 'gift_cards' OR pattern ILIKE '%gift%card%')
        -- Trackman reset patterns  
        OR (pattern ILIKE '%trackman%' OR pattern ILIKE '%frozen%' OR pattern ILIKE '%stuck%')
        -- High confidence patterns
        OR (confidence_score >= 0.90)
        -- Successful patterns
        OR (execution_count >= 2 AND success_count >= 2)
        -- Common FAQs
        OR (pattern_type IN ('hours', 'booking', 'membership') AND confidence_score >= 0.80)
      )
      AND (is_active = false OR is_deleted = true)
      ORDER BY 
        CASE pattern_type
          WHEN 'gift_cards' THEN 1
          WHEN 'tech_issue' THEN 2
          WHEN 'hours' THEN 3
          WHEN 'booking' THEN 4
          ELSE 5
        END,
        confidence_score DESC
      LIMIT 20
    `);
    
    console.log(`\nFound ${shouldBeActive.rows.length} patterns that should be active:\n`);
    shouldBeActive.rows.forEach(p => {
      console.log(`  ID ${p.id} [${p.pattern_type}]: "${p.pattern_preview}"`);
      console.log(`    Confidence: ${p.confidence_score}, Success rate: ${p.success_rate || 0}% (${p.success_count}/${p.execution_count})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

checkV3PLSStatus();