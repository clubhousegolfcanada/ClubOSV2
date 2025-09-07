import { query } from '../src/utils/db';

async function restoreImportantPatterns() {
  console.log('=== RESTORING IMPORTANT PATTERNS ===\n');
  
  try {
    // 1. Restore gift card patterns
    console.log('1. Restoring gift card patterns...');
    const giftCardRestore = await query(`
      UPDATE decision_patterns
      SET 
        is_active = true,
        is_deleted = false,
        updated_at = NOW()
      WHERE pattern_type = 'gift_cards'
      OR (pattern ILIKE '%gift card%' OR trigger_text ILIKE '%gift card%')
      RETURNING id, pattern_type, SUBSTRING(pattern, 1, 50) as pattern_preview
    `);
    
    console.log(`   Restored ${giftCardRestore.rows.length} gift card patterns:`);
    giftCardRestore.rows.forEach(p => {
      console.log(`   - ID ${p.id} [${p.pattern_type}]: "${p.pattern_preview}..."`);
    });
    
    // 2. Restore trackman reset patterns
    console.log('\n2. Restoring trackman/simulator reset patterns...');
    const trackmanRestore = await query(`
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
        OR trigger_text ILIKE '%trackman%'
        OR trigger_text ILIKE '%frozen%'
        OR trigger_text ILIKE '%stuck%'
        OR trigger_text ILIKE '%reset%'
        OR trigger_text ILIKE '%restart%'
      )
      RETURNING id, pattern_type, SUBSTRING(pattern, 1, 50) as pattern_preview
    `);
    
    console.log(`   Restored ${trackmanRestore.rows.length} trackman reset patterns:`);
    trackmanRestore.rows.forEach(p => {
      console.log(`   - ID ${p.id} [${p.pattern_type}]: "${p.pattern_preview}..."`);
    });
    
    // 3. Restore high-confidence patterns with successful executions
    console.log('\n3. Restoring high-confidence patterns with successful executions...');
    const successfulRestore = await query(`
      UPDATE decision_patterns
      SET 
        is_active = true,
        is_deleted = false,
        updated_at = NOW()
      WHERE (
        (confidence_score >= 0.85 AND execution_count > 0)
        OR (success_count >= 2)
        OR (execution_count >= 5 AND success_count > 0)
      )
      AND is_active = false
      RETURNING id, pattern_type, confidence_score, execution_count, success_count, SUBSTRING(pattern, 1, 40) as pattern_preview
    `);
    
    console.log(`   Restored ${successfulRestore.rows.length} successful patterns:`);
    successfulRestore.rows.forEach(p => {
      console.log(`   - ID ${p.id} [${p.pattern_type}]: confidence=${p.confidence_score}, exec=${p.execution_count}, success=${p.success_count}`);
      console.log(`     "${p.pattern_preview}..."`);
    });
    
    // 4. Restore common FAQ patterns
    console.log('\n4. Restoring common FAQ patterns...');
    const faqRestore = await query(`
      UPDATE decision_patterns
      SET 
        is_active = true,
        is_deleted = false,
        updated_at = NOW()
      WHERE pattern_type IN ('faq', 'hours', 'booking', 'membership')
      AND (
        pattern ILIKE '%hours%'
        OR pattern ILIKE '%book%'
        OR pattern ILIKE '%membership%'
        OR pattern ILIKE '%price%'
        OR pattern ILIKE '%cost%'
        OR pattern ILIKE '%food%'
        OR pattern ILIKE '%drink%'
        OR trigger_text ILIKE '%hours%'
        OR trigger_text ILIKE '%book%'
        OR trigger_text ILIKE '%membership%'
        OR trigger_text ILIKE '%price%'
        OR trigger_text ILIKE '%cost%'
        OR trigger_text ILIKE '%food%'
        OR trigger_text ILIKE '%drink%'
      )
      AND is_active = false
      RETURNING id, pattern_type, SUBSTRING(pattern, 1, 50) as pattern_preview
    `);
    
    console.log(`   Restored ${faqRestore.rows.length} FAQ patterns:`);
    faqRestore.rows.forEach(p => {
      console.log(`   - ID ${p.id} [${p.pattern_type}]: "${p.pattern_preview}..."`);
    });
    
    // 5. Final count
    console.log('\n5. Final pattern status:');
    const finalCount = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE is_active = true AND (is_deleted = false OR is_deleted IS NULL)) as active,
        COUNT(*) FILTER (WHERE is_active = false) as inactive,
        COUNT(*) FILTER (WHERE is_deleted = true) as deleted,
        COUNT(*) as total
      FROM decision_patterns
    `);
    
    const result = finalCount.rows[0];
    console.log(`   Active patterns: ${result.active}`);
    console.log(`   Inactive patterns: ${result.inactive}`);
    console.log(`   Deleted patterns: ${result.deleted}`);
    console.log(`   Total patterns: ${result.total}`);
    
    // 6. List all active patterns
    console.log('\n6. All active patterns:');
    const activePatterns = await query(`
      SELECT 
        id,
        pattern_type,
        SUBSTRING(pattern, 1, 60) as pattern_preview,
        confidence_score,
        execution_count,
        success_count
      FROM decision_patterns
      WHERE is_active = true 
      AND (is_deleted = false OR is_deleted IS NULL)
      ORDER BY pattern_type, confidence_score DESC
    `);
    
    console.log(`\n   Total active patterns: ${activePatterns.rows.length}\n`);
    activePatterns.rows.forEach(p => {
      console.log(`   ID ${p.id} [${p.pattern_type}]: "${p.pattern_preview}"`);
      console.log(`      Confidence: ${p.confidence_score}, Executions: ${p.execution_count}, Successes: ${p.success_count}`);
    });
    
  } catch (error) {
    console.error('Error restoring patterns:', error);
  }
  
  process.exit(0);
}

restoreImportantPatterns();