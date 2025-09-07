import { query } from '../src/utils/db';

async function checkActivePatterns() {
  console.log('=== CHECKING WHICH PATTERNS ARE ACTUALLY IN USE ===\n');
  
  try {
    // 1. Check recent pattern execution history
    console.log('1. Patterns executed in the last 30 days:');
    const recentlyUsed = await query(`
      SELECT 
        p.id,
        p.pattern_type,
        SUBSTRING(p.pattern, 1, 60) as pattern_preview,
        p.confidence_score,
        p.execution_count,
        p.success_count,
        MAX(h.created_at) as last_execution,
        COUNT(h.id) as recent_executions
      FROM decision_patterns p
      INNER JOIN pattern_execution_history h ON h.pattern_id = p.id
      WHERE h.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY p.id, p.pattern_type, p.pattern, p.confidence_score, p.execution_count, p.success_count
      ORDER BY MAX(h.created_at) DESC
    `);
    
    if (recentlyUsed.rows.length === 0) {
      console.log('  No patterns have been executed in the last 30 days\n');
    } else {
      console.log(`  Found ${recentlyUsed.rows.length} patterns with recent executions:\n`);
      recentlyUsed.rows.forEach(p => {
        console.log(`  ID ${p.id} [${p.pattern_type}]: "${p.pattern_preview}"`);
        console.log(`    Last used: ${p.last_execution}`);
        console.log(`    Recent executions: ${p.recent_executions}, Total: ${p.execution_count}`);
      });
    }
    
    // 2. Check patterns with high success rates
    console.log('\n2. Patterns with proven success (>80% success rate, 2+ executions):');
    const successful = await query(`
      SELECT 
        id,
        pattern_type,
        SUBSTRING(pattern, 1, 60) as pattern_preview,
        confidence_score,
        execution_count,
        success_count,
        ROUND((success_count::float / execution_count * 100)::numeric, 0) as success_rate
      FROM decision_patterns
      WHERE execution_count >= 2
      AND (success_count::float / execution_count) >= 0.80
      ORDER BY success_rate DESC, execution_count DESC
    `);
    
    console.log(`  Found ${successful.rows.length} high-performing patterns:\n`);
    successful.rows.forEach(p => {
      console.log(`  ID ${p.id} [${p.pattern_type}]: ${p.success_rate}% success (${p.success_count}/${p.execution_count})`);
      console.log(`    "${p.pattern_preview}"`);
    });
    
    // 3. Check essential pattern types
    console.log('\n3. Essential pattern categories (should keep at least 1 of each):');
    const essentialTypes = ['gift_cards', 'hours', 'booking', 'membership'];
    for (const type of essentialTypes) {
      const essential = await query(`
        SELECT 
          id,
          SUBSTRING(pattern, 1, 60) as pattern_preview,
          confidence_score,
          execution_count,
          success_count
        FROM decision_patterns
        WHERE pattern_type = $1
        AND is_active = true
        ORDER BY confidence_score DESC, execution_count DESC
        LIMIT 3
      `, [type]);
      
      console.log(`\n  ${type}:`);
      if (essential.rows.length === 0) {
        console.log(`    ⚠️ No active patterns for ${type}!`);
      } else {
        essential.rows.forEach(p => {
          console.log(`    ID ${p.id}: conf=${p.confidence_score}, exec=${p.execution_count}, success=${p.success_count}`);
          console.log(`      "${p.pattern_preview}"`);
        });
      }
    }
    
    // 4. Check patterns that have NEVER been used
    console.log('\n4. Patterns that have NEVER been executed:');
    const neverUsed = await query(`
      SELECT 
        COUNT(*) as count,
        pattern_type,
        MIN(confidence_score) as min_conf,
        MAX(confidence_score) as max_conf
      FROM decision_patterns
      WHERE execution_count = 0
      AND is_active = true
      GROUP BY pattern_type
      ORDER BY count DESC
    `);
    
    console.log('\n  Type         | Count | Confidence Range');
    console.log('  -------------|-------|------------------');
    let totalNeverUsed = 0;
    neverUsed.rows.forEach(row => {
      totalNeverUsed += parseInt(row.count);
      console.log(`  ${row.pattern_type.padEnd(12)} | ${String(row.count).padStart(5)} | ${row.min_conf} - ${row.max_conf}`);
    });
    console.log(`\n  Total never used: ${totalNeverUsed} patterns`);
    
    // 5. Recommend which patterns to keep
    console.log('\n5. RECOMMENDATION:');
    console.log('  Keep these patterns:');
    console.log('  - All patterns with recent executions (last 30 days)');
    console.log('  - All patterns with >80% success rate and 2+ executions');
    console.log('  - At least 1 pattern for each essential type (gift_cards, hours, booking, membership)');
    console.log('  - Trackman reset patterns (critical for operations)');
    
    const shouldKeep = await query(`
      SELECT COUNT(*) as count
      FROM decision_patterns
      WHERE (
        -- Has been executed recently
        EXISTS (
          SELECT 1 FROM pattern_execution_history 
          WHERE pattern_id = decision_patterns.id 
          AND created_at >= NOW() - INTERVAL '30 days'
        )
        -- OR has high success rate
        OR (execution_count >= 2 AND (success_count::float / execution_count) >= 0.80)
        -- OR is essential type with high confidence
        OR (pattern_type IN ('gift_cards', 'hours', 'booking', 'membership') AND confidence_score >= 0.85)
        -- OR is trackman reset
        OR (pattern ILIKE '%trackman%' AND pattern_type = 'tech_issue')
      )
    `);
    
    console.log(`\n  Patterns that should definitely stay active: ${shouldKeep.rows[0].count}`);
    
    const canDelete = await query(`
      SELECT COUNT(*) as count
      FROM decision_patterns
      WHERE execution_count = 0
      AND confidence_score < 0.85
      AND pattern_type NOT IN ('gift_cards', 'hours', 'booking', 'membership')
      AND NOT (pattern ILIKE '%trackman%')
    `);
    
    console.log(`  Patterns that can probably be deleted: ${canDelete.rows[0].count}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

checkActivePatterns();