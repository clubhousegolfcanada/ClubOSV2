import { query } from '../src/utils/db';

async function restoreV3PLSPatterns() {
  console.log('=== RESTORING V3-PLS PATTERNS ===\n');
  console.log('Based on the mass deletion on Sep 6 at 18:07:33, restoring quality patterns...\n');
  
  try {
    // The config shows:
    // - min_confidence_to_act: 0.85 (for auto-execution)
    // - min_confidence_to_suggest: 0.70 (for suggestions)
    // - min_confidence_for_activation: 0.70 (minimum to activate)
    // - min_executions_for_auto: 3 (successful executions before auto-send)
    
    // 1. Restore all high-quality patterns that were wrongly deleted
    console.log('1. Restoring high-quality patterns...');
    const restored = await query(`
      UPDATE decision_patterns
      SET 
        is_active = true,
        is_deleted = false,
        updated_at = NOW()
      WHERE (
        -- High confidence patterns (meet activation threshold)
        confidence_score >= 0.70
        
        -- OR patterns with successful execution history
        OR (execution_count > 0 AND success_count > 0)
        
        -- OR specific important pattern types
        OR pattern_type IN ('gift_cards', 'hours', 'booking', 'membership')
        
        -- OR patterns with good success rate
        OR (execution_count >= 2 AND (success_count::float / execution_count) >= 0.5)
      )
      AND (is_active = false OR is_deleted = true)
      RETURNING 
        id,
        pattern_type,
        SUBSTRING(pattern, 1, 50) as pattern_preview,
        confidence_score,
        execution_count,
        success_count
    `);
    
    console.log(`\nRestored ${restored.rows.length} patterns:\n`);
    
    // Group by type for summary
    const byType: Record<string, number> = {};
    restored.rows.forEach(p => {
      byType[p.pattern_type] = (byType[p.pattern_type] || 0) + 1;
      console.log(`  ✓ ID ${p.id} [${p.pattern_type}]: conf=${p.confidence_score}, exec=${p.execution_count}, success=${p.success_count}`);
      console.log(`    "${p.pattern_preview}..."`);
    });
    
    console.log('\nSummary by type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} patterns restored`);
    });
    
    // 2. Specifically ensure gift card patterns are active
    console.log('\n2. Ensuring gift card patterns are active...');
    const giftCards = await query(`
      UPDATE decision_patterns
      SET 
        is_active = true,
        is_deleted = false,
        confidence_score = GREATEST(confidence_score, 0.85), -- Boost confidence if needed
        updated_at = NOW()
      WHERE (
        pattern_type = 'gift_cards'
        OR pattern ILIKE '%gift%card%'
        OR response_template ILIKE '%clubhouse247golf.com/gift-cards%'
      )
      RETURNING id, pattern_type, SUBSTRING(pattern, 1, 60) as pattern_preview
    `);
    
    console.log(`  Gift card patterns activated: ${giftCards.rows.length}`);
    
    // 3. Ensure trackman reset patterns are active
    console.log('\n3. Ensuring trackman/tech issue patterns are active...');
    const techPatterns = await query(`
      UPDATE decision_patterns
      SET 
        is_active = true,
        is_deleted = false,
        updated_at = NOW()
      WHERE pattern_type = 'tech_issue'
      AND (
        pattern ILIKE '%trackman%'
        OR pattern ILIKE '%frozen%'
        OR pattern ILIKE '%stuck%'
        OR pattern ILIKE '%reset%'
        OR pattern ILIKE '%restart%'
        OR pattern ILIKE '%not working%'
      )
      RETURNING id, SUBSTRING(pattern, 1, 60) as pattern_preview
    `);
    
    console.log(`  Tech/trackman patterns activated: ${techPatterns.rows.length}`);
    
    // 4. Final statistics
    console.log('\n4. Final Pattern Statistics:');
    const finalStats = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true AND (is_deleted = false OR is_deleted IS NULL)) as active,
        COUNT(*) FILTER (WHERE is_active = false) as inactive,
        COUNT(*) FILTER (WHERE is_deleted = true) as deleted,
        COUNT(*) FILTER (WHERE confidence_score >= 0.85 AND is_active = true) as auto_executable,
        COUNT(*) FILTER (WHERE confidence_score >= 0.70 AND confidence_score < 0.85 AND is_active = true) as suggestable
      FROM decision_patterns
    `);
    
    const stats = finalStats.rows[0];
    console.log(`\n  Total patterns: ${stats.total}`);
    console.log(`  Active patterns: ${stats.active} ✅`);
    console.log(`  Auto-executable (≥0.85 conf): ${stats.auto_executable}`);
    console.log(`  Suggestable (0.70-0.84 conf): ${stats.suggestable}`);
    console.log(`  Inactive: ${stats.inactive}`);
    console.log(`  Deleted: ${stats.deleted}`);
    
    // 5. List all active patterns by category
    console.log('\n5. Active Patterns by Category:');
    const activeByType = await query(`
      SELECT 
        pattern_type,
        COUNT(*) as count,
        AVG(confidence_score)::numeric(3,2) as avg_confidence,
        SUM(execution_count) as total_executions,
        SUM(success_count) as total_successes
      FROM decision_patterns
      WHERE is_active = true 
      AND (is_deleted = false OR is_deleted IS NULL)
      GROUP BY pattern_type
      ORDER BY count DESC
    `);
    
    console.log('\n  Type         | Count | Avg Conf | Executions | Successes');
    console.log('  -------------|-------|----------|------------|----------');
    activeByType.rows.forEach(row => {
      console.log(`  ${row.pattern_type.padEnd(12)} | ${String(row.count).padStart(5)} | ${String(row.avg_confidence).padStart(8)} | ${String(row.total_executions).padStart(10)} | ${String(row.total_successes).padStart(9)}`);
    });
    
    console.log('\n✅ V3-PLS patterns have been restored based on quality metrics!');
    console.log('   Patterns with confidence ≥ 0.70 are now active');
    console.log('   Patterns with successful execution history are active');
    console.log('   Gift card and trackman patterns are specifically activated');
    
  } catch (error) {
    console.error('Error restoring patterns:', error);
  }
  
  process.exit(0);
}

restoreV3PLSPatterns();