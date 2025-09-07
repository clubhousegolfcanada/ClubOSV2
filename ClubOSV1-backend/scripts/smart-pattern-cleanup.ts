import { query } from '../src/utils/db';

async function smartPatternCleanup() {
  console.log('=== SMART V3-PLS PATTERN CLEANUP ===\n');
  console.log('Keeping only valuable patterns, deactivating the rest...\n');
  
  try {
    // 1. First, mark patterns to KEEP as active
    console.log('1. Keeping valuable patterns:');
    const keepPatterns = await query(`
      UPDATE decision_patterns
      SET 
        is_active = true,
        is_deleted = false,
        updated_at = NOW()
      WHERE (
        -- Has been executed in last 30 days
        EXISTS (
          SELECT 1 FROM pattern_execution_history 
          WHERE pattern_id = decision_patterns.id 
          AND created_at >= NOW() - INTERVAL '30 days'
        )
        
        -- OR has proven high success rate
        OR (execution_count >= 2 AND (success_count::float / execution_count) >= 0.80)
        
        -- OR is essential type with very high confidence
        OR (pattern_type IN ('gift_cards', 'hours', 'booking', 'membership') 
            AND confidence_score >= 0.90)
        
        -- OR is critical trackman reset pattern
        OR (pattern ILIKE '%trackman%' AND pattern_type = 'tech_issue')
        
        -- OR specific high-value patterns we know work
        OR id IN (217, 216, 215, 220, 214, 218) -- Gift cards, trackman, hours, food/drinks, booking, membership
      )
      RETURNING id, pattern_type, SUBSTRING(pattern, 1, 50) as pattern_preview
    `);
    
    console.log(`  Keeping ${keepPatterns.rows.length} valuable patterns active\n`);
    
    // 2. Deactivate/delete the low-value patterns
    console.log('2. Deactivating low-value patterns:');
    const deactivatePatterns = await query(`
      UPDATE decision_patterns
      SET 
        is_active = false,
        is_deleted = true,
        updated_at = NOW()
      WHERE 
        -- Never been used
        execution_count = 0
        
        -- AND not a critical pattern type or low confidence
        AND NOT (
          pattern_type IN ('gift_cards', 'hours', 'booking', 'membership') 
          AND confidence_score >= 0.90
        )
        
        -- AND not a trackman pattern
        AND NOT (pattern ILIKE '%trackman%')
        
        -- AND not recently executed
        AND NOT EXISTS (
          SELECT 1 FROM pattern_execution_history 
          WHERE pattern_id = decision_patterns.id 
          AND created_at >= NOW() - INTERVAL '30 days'
        )
      RETURNING id, pattern_type, SUBSTRING(pattern, 1, 50) as pattern_preview
    `);
    
    console.log(`  Deactivated ${deactivatePatterns.rows.length} low-value patterns\n`);
    
    // 3. Show final statistics
    console.log('3. Final Pattern Statistics:');
    const stats = await query(`
      SELECT 
        pattern_type,
        COUNT(*) FILTER (WHERE is_active = true AND (is_deleted = false OR is_deleted IS NULL)) as active,
        COUNT(*) FILTER (WHERE is_deleted = true) as deleted,
        COUNT(*) as total
      FROM decision_patterns
      GROUP BY pattern_type
      ORDER BY active DESC
    `);
    
    console.log('\n  Type         | Active | Deleted | Total');
    console.log('  -------------|--------|---------|-------');
    stats.rows.forEach(s => {
      console.log(`  ${s.pattern_type.padEnd(12)} | ${String(s.active).padStart(6)} | ${String(s.deleted).padStart(7)} | ${String(s.total).padStart(5)}`);
    });
    
    // 4. List the patterns that are staying active
    console.log('\n4. Active Patterns (these will show in the UI):');
    const activePatterns = await query(`
      SELECT 
        id,
        pattern_type,
        SUBSTRING(pattern, 1, 60) as pattern_preview,
        confidence_score,
        execution_count,
        success_count,
        CASE 
          WHEN execution_count > 0 
          THEN ROUND((success_count::float / execution_count * 100)::numeric, 0)
          ELSE 0
        END as success_rate
      FROM decision_patterns
      WHERE is_active = true 
      AND (is_deleted = false OR is_deleted IS NULL)
      ORDER BY 
        execution_count DESC,
        confidence_score DESC
    `);
    
    console.log(`\n  Total active: ${activePatterns.rows.length} patterns\n`);
    activePatterns.rows.forEach(p => {
      const execInfo = p.execution_count > 0 
        ? `exec=${p.execution_count}, success=${p.success_rate}%`
        : 'never executed';
      console.log(`  ID ${p.id} [${p.pattern_type}]: conf=${p.confidence_score}, ${execInfo}`);
      console.log(`    "${p.pattern_preview}"`);
    });
    
    // 5. Summary
    const summary = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE is_active = true AND (is_deleted = false OR is_deleted IS NULL)) as active,
        COUNT(*) FILTER (WHERE is_deleted = true) as deleted,
        COUNT(*) as total
      FROM decision_patterns
    `);
    
    const s = summary.rows[0];
    console.log('\n=== CLEANUP COMPLETE ===');
    console.log(`✅ Active patterns: ${s.active} (high-value patterns that are actually used)`);
    console.log(`🗑️  Deleted patterns: ${s.deleted} (never used, low confidence)`);
    console.log(`📊 Total patterns: ${s.total}`);
    
    console.log('\nThe system will continue to learn new patterns from OpenPhone conversations.');
    console.log('Pattern Learning Config: enabled=true, shadow_mode=false');
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

smartPatternCleanup();