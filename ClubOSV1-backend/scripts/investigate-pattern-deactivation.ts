import { query } from '../src/utils/db';

async function investigatePatternDeactivation() {
  console.log('=== INVESTIGATING PATTERN DEACTIVATION ===\n');
  
  try {
    // 1. Check when patterns were deactivated
    const deactivationTimes = await query(`
      SELECT 
        DATE(updated_at) as update_date,
        COUNT(*) as patterns_updated,
        COUNT(*) FILTER (WHERE is_active = false) as deactivated,
        COUNT(*) FILTER (WHERE is_deleted = true) as deleted
      FROM decision_patterns
      WHERE updated_at IS NOT NULL
      GROUP BY DATE(updated_at)
      ORDER BY update_date DESC
      LIMIT 10
    `);
    
    console.log('1. Pattern updates by date:');
    deactivationTimes.rows.forEach(row => {
      console.log(`   ${row.update_date}: ${row.patterns_updated} updated, ${row.deactivated} deactivated, ${row.deleted} deleted`);
    });
    
    // 2. Check patterns that should probably be active
    const highConfidenceInactive = await query(`
      SELECT 
        id,
        pattern_type,
        SUBSTRING(pattern, 1, 50) as pattern_preview,
        confidence_score,
        execution_count,
        success_count,
        is_active,
        is_deleted,
        updated_at
      FROM decision_patterns
      WHERE confidence_score >= 0.70
      AND (is_active = false OR is_deleted = true)
      ORDER BY confidence_score DESC
      LIMIT 10
    `);
    
    console.log('\n2. High confidence patterns that are inactive/deleted:');
    highConfidenceInactive.rows.forEach(p => {
      console.log(`   ID ${p.id} [${p.pattern_type}]: confidence=${p.confidence_score}, executions=${p.execution_count}`);
      console.log(`      Pattern: "${p.pattern_preview}..."`);
      console.log(`      is_active=${p.is_active}, is_deleted=${p.is_deleted}`);
    });
    
    // 3. Check patterns with good success rates that are inactive
    const successfulInactive = await query(`
      SELECT 
        id,
        pattern_type,
        SUBSTRING(pattern, 1, 50) as pattern_preview,
        confidence_score,
        execution_count,
        success_count,
        ROUND((success_count::float / NULLIF(execution_count, 0) * 100)::numeric, 0) as success_rate,
        is_active,
        is_deleted
      FROM decision_patterns
      WHERE execution_count > 0
      AND success_count > 0
      AND (is_active = false OR is_deleted = true)
      ORDER BY success_count DESC
      LIMIT 10
    `);
    
    console.log('\n3. Patterns with successful executions that are inactive/deleted:');
    successfulInactive.rows.forEach(p => {
      console.log(`   ID ${p.id} [${p.pattern_type}]: ${p.success_count}/${p.execution_count} successes (${p.success_rate}%)`);
      console.log(`      Pattern: "${p.pattern_preview}..."`);
      console.log(`      is_active=${p.is_active}, is_deleted=${p.is_deleted}`);
    });
    
    // 4. Check common pattern types
    const patternTypes = await query(`
      SELECT 
        pattern_type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true AND (is_deleted = false OR is_deleted IS NULL)) as active,
        COUNT(*) FILTER (WHERE is_active = false) as inactive,
        COUNT(*) FILTER (WHERE is_deleted = true) as deleted
      FROM decision_patterns
      GROUP BY pattern_type
      ORDER BY total DESC
    `);
    
    console.log('\n4. Pattern distribution by type:');
    patternTypes.rows.forEach(row => {
      console.log(`   ${row.pattern_type}: ${row.total} total (${row.active} active, ${row.inactive} inactive, ${row.deleted} deleted)`);
    });
    
    // 5. Find patterns that were likely good candidates
    console.log('\n5. Patterns that should probably be reactivated:');
    const reactivateCandidates = await query(`
      SELECT 
        id,
        pattern_type,
        SUBSTRING(pattern, 1, 60) as pattern_preview,
        confidence_score,
        execution_count,
        success_count
      FROM decision_patterns
      WHERE (
        confidence_score >= 0.75 
        OR execution_count >= 5
        OR pattern_type IN ('faq', 'booking', 'hours', 'tech_issue')
      )
      AND (is_active = false OR is_deleted = true)
      ORDER BY 
        CASE 
          WHEN pattern_type = 'faq' THEN 1
          WHEN pattern_type = 'booking' THEN 2
          WHEN pattern_type = 'hours' THEN 3
          WHEN pattern_type = 'tech_issue' THEN 4
          ELSE 5
        END,
        confidence_score DESC
      LIMIT 15
    `);
    
    console.log(`Found ${reactivateCandidates.rows.length} candidates for reactivation:\n`);
    reactivateCandidates.rows.forEach(p => {
      console.log(`   ID ${p.id} [${p.pattern_type}]: "${p.pattern_preview}"`);
      console.log(`      Confidence: ${p.confidence_score}, Executions: ${p.execution_count}, Successes: ${p.success_count}`);
    });
    
  } catch (error) {
    console.error('Error investigating:', error);
  }
  
  process.exit(0);
}

investigatePatternDeactivation();