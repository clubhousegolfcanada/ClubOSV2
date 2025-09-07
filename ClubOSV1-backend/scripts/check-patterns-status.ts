import { query } from '../src/utils/db';

async function checkPatternsStatus() {
  console.log('=== PATTERN DATABASE INVESTIGATION ===\n');
  
  try {
    // 1. Count total patterns
    const totalCount = await query(`
      SELECT COUNT(*) as total FROM decision_patterns
    `);
    console.log(`1. Total patterns in database: ${totalCount.rows[0].total}`);
    
    // 2. Count by is_active status
    const activeCount = await query(`
      SELECT 
        is_active,
        COUNT(*) as count
      FROM decision_patterns
      GROUP BY is_active
      ORDER BY is_active DESC
    `);
    console.log('\n2. Patterns by is_active status:');
    activeCount.rows.forEach(row => {
      console.log(`   is_active=${row.is_active}: ${row.count} patterns`);
    });
    
    // 3. Count by is_deleted status
    const deletedCount = await query(`
      SELECT 
        is_deleted,
        COUNT(*) as count
      FROM decision_patterns
      GROUP BY is_deleted
      ORDER BY is_deleted
    `);
    console.log('\n3. Patterns by is_deleted status:');
    deletedCount.rows.forEach(row => {
      console.log(`   is_deleted=${row.is_deleted}: ${row.count} patterns`);
    });
    
    // 4. Check patterns that should be visible (active and not deleted)
    const visibleCount = await query(`
      SELECT COUNT(*) as count
      FROM decision_patterns
      WHERE is_active = true 
      AND (is_deleted = false OR is_deleted IS NULL)
    `);
    console.log(`\n4. Patterns that should be visible (active & not deleted): ${visibleCount.rows[0].count}`);
    
    // 5. List first 10 active patterns
    const activePatterns = await query(`
      SELECT 
        id,
        pattern_type,
        pattern,
        trigger_text,
        is_active,
        is_deleted,
        confidence_score,
        execution_count,
        created_at,
        updated_at
      FROM decision_patterns
      WHERE is_active = true
      ORDER BY id
      LIMIT 10
    `);
    
    console.log('\n5. First 10 active patterns:');
    activePatterns.rows.forEach(p => {
      console.log(`   ID ${p.id}: [${p.pattern_type}] ${(p.pattern || p.trigger_text || '').substring(0, 50)}...`);
      console.log(`      is_active: ${p.is_active}, is_deleted: ${p.is_deleted}, confidence: ${p.confidence_score}`);
    });
    
    // 6. Check what the API query would return (from patterns.ts)
    console.log('\n6. Testing actual API query from patterns.ts:');
    const apiQuery = await query(`
      SELECT 
        id,
        pattern_type,
        pattern,
        response_template,
        trigger_examples,
        trigger_keywords,
        confidence_score,
        execution_count,
        success_count,
        is_active,
        is_deleted,
        created_at,
        updated_at
      FROM decision_patterns
      WHERE (is_deleted = false OR is_deleted IS NULL)
      AND is_active = true
      ORDER BY 
        is_active DESC,
        confidence_score DESC,
        execution_count DESC
    `);
    
    console.log(`   API query returns: ${apiQuery.rows.length} patterns`);
    
    // 7. Check for NULL values that might cause issues
    const nullCheck = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE pattern IS NULL) as null_pattern,
        COUNT(*) FILTER (WHERE trigger_text IS NULL) as null_trigger_text,
        COUNT(*) FILTER (WHERE is_active IS NULL) as null_is_active,
        COUNT(*) FILTER (WHERE is_deleted IS NULL) as null_is_deleted,
        COUNT(*) FILTER (WHERE created_at IS NULL) as null_created_at
      FROM decision_patterns
    `);
    
    console.log('\n7. NULL value check:');
    console.log(`   pattern IS NULL: ${nullCheck.rows[0].null_pattern}`);
    console.log(`   trigger_text IS NULL: ${nullCheck.rows[0].null_trigger_text}`);
    console.log(`   is_active IS NULL: ${nullCheck.rows[0].null_is_active}`);
    console.log(`   is_deleted IS NULL: ${nullCheck.rows[0].null_is_deleted}`);
    console.log(`   created_at IS NULL: ${nullCheck.rows[0].null_created_at}`);
    
    // 8. Check pattern column sync
    const syncCheck = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE pattern = trigger_text) as synced,
        COUNT(*) FILTER (WHERE pattern != trigger_text) as not_synced,
        COUNT(*) FILTER (WHERE pattern IS NULL AND trigger_text IS NOT NULL) as pattern_null,
        COUNT(*) FILTER (WHERE pattern IS NOT NULL AND trigger_text IS NULL) as trigger_null
      FROM decision_patterns
    `);
    
    console.log('\n8. Pattern/trigger_text sync check:');
    console.log(`   Total: ${syncCheck.rows[0].total}`);
    console.log(`   Synced (pattern = trigger_text): ${syncCheck.rows[0].synced}`);
    console.log(`   Not synced: ${syncCheck.rows[0].not_synced}`);
    console.log(`   Pattern NULL, trigger_text NOT NULL: ${syncCheck.rows[0].pattern_null}`);
    console.log(`   Pattern NOT NULL, trigger_text NULL: ${syncCheck.rows[0].trigger_null}`);
    
    // 9. Check for patterns that might have been incorrectly updated
    const recentChanges = await query(`
      SELECT 
        id,
        pattern_type,
        SUBSTRING(pattern, 1, 30) as pattern_preview,
        SUBSTRING(trigger_text, 1, 30) as trigger_preview,
        is_active,
        is_deleted,
        created_at,
        updated_at
      FROM decision_patterns
      WHERE updated_at > NOW() - INTERVAL '1 hour'
      ORDER BY updated_at DESC
      LIMIT 10
    `);
    
    console.log('\n9. Recently modified patterns (last hour):');
    if (recentChanges.rows.length === 0) {
      console.log('   No patterns modified in the last hour');
    } else {
      recentChanges.rows.forEach(p => {
        console.log(`   ID ${p.id}: pattern="${p.pattern_preview}", trigger="${p.trigger_preview}"`);
        console.log(`      Updated: ${p.updated_at}`);
      });
    }
    
  } catch (error) {
    console.error('Error checking patterns:', error);
  }
  
  process.exit(0);
}

checkPatternsStatus();