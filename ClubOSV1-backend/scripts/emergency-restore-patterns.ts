import { query } from '../src/utils/db';

async function emergencyRestorePatterns() {
  console.log('=== EMERGENCY PATTERN RESTORATION ===\n');
  console.log('CRITICAL: Gift card automation is DOWN!');
  console.log('Restoring essential patterns immediately...\n');
  
  try {
    // 1. IMMEDIATELY restore gift card pattern
    console.log('1. RESTORING GIFT CARD PATTERN (CRITICAL):');
    const giftCardRestore = await query(`
      UPDATE decision_patterns
      SET 
        is_active = true,
        is_deleted = false,
        confidence_score = 0.95,
        updated_at = NOW()
      WHERE id = 217
      RETURNING id, pattern, response_template
    `);
    
    if (giftCardRestore.rows.length > 0) {
      console.log('  ✅ Gift card pattern ID 217 RESTORED and ACTIVE');
      console.log(`     Pattern: "${giftCardRestore.rows[0].pattern}"`);
    }
    
    // 2. Restore trackman reset pattern
    console.log('\n2. RESTORING TRACKMAN RESET PATTERN:');
    const trackmanRestore = await query(`
      UPDATE decision_patterns
      SET 
        is_active = true,
        is_deleted = false,
        updated_at = NOW()
      WHERE id = 216
      RETURNING id, pattern
    `);
    
    if (trackmanRestore.rows.length > 0) {
      console.log('  ✅ Trackman reset pattern ID 216 RESTORED');
    }
    
    // 3. Restore other critical patterns
    console.log('\n3. RESTORING OTHER CRITICAL PATTERNS:');
    const criticalPatterns = await query(`
      UPDATE decision_patterns
      SET 
        is_active = true,
        is_deleted = false,
        updated_at = NOW()
      WHERE id IN (
        215,  -- Hours
        220,  -- Food/drinks
        214,  -- Booking
        218   -- Membership
      )
      RETURNING id, pattern_type, SUBSTRING(pattern, 1, 50) as pattern_preview
    `);
    
    console.log(`  Restored ${criticalPatterns.rows.length} critical patterns:`);
    criticalPatterns.rows.forEach(p => {
      console.log(`    ✅ ID ${p.id} [${p.pattern_type}]: "${p.pattern_preview}..."`);
    });
    
    // 4. Restore all recently used patterns
    console.log('\n4. RESTORING RECENTLY USED PATTERNS:');
    const recentlyUsed = await query(`
      UPDATE decision_patterns
      SET 
        is_active = true,
        is_deleted = false,
        updated_at = NOW()
      WHERE id IN (
        SELECT DISTINCT pattern_id 
        FROM pattern_execution_history 
        WHERE created_at >= NOW() - INTERVAL '30 days'
        AND pattern_id IS NOT NULL
      )
      RETURNING id, pattern_type
    `);
    
    console.log(`  Restored ${recentlyUsed.rows.length} recently used patterns`);
    
    // 5. Final check
    console.log('\n5. FINAL STATUS CHECK:');
    const finalStatus = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true AND (is_deleted = false OR is_deleted IS NULL)) as active,
        COUNT(*) FILTER (WHERE pattern_type = 'gift_cards' AND is_active = true) as gift_cards_active
      FROM decision_patterns
    `);
    
    const status = finalStatus.rows[0];
    console.log(`\n  Total patterns: ${status.total}`);
    console.log(`  Active patterns: ${status.active} ✅`);
    console.log(`  Gift card patterns active: ${status.gift_cards_active} ${status.gift_cards_active > 0 ? '✅' : '❌'}`);
    
    // 6. Verify gift card pattern details
    console.log('\n6. GIFT CARD PATTERN VERIFICATION:');
    const giftCardCheck = await query(`
      SELECT 
        id,
        pattern,
        response_template,
        is_active,
        is_deleted,
        confidence_score,
        execution_count,
        success_count
      FROM decision_patterns
      WHERE id = 217
    `);
    
    if (giftCardCheck.rows.length > 0) {
      const gc = giftCardCheck.rows[0];
      console.log(`  Pattern: "${gc.pattern}"`);
      console.log(`  Response: "${gc.response_template?.substring(0, 100)}..."`);
      console.log(`  Status: active=${gc.is_active}, deleted=${gc.is_deleted}`);
      console.log(`  Performance: ${gc.success_count}/${gc.execution_count} successes, confidence=${gc.confidence_score}`);
      
      if (gc.is_active && !gc.is_deleted) {
        console.log('\n🎉 GIFT CARD AUTOMATION IS NOW ACTIVE!');
      } else {
        console.log('\n❌ WARNING: Gift card pattern still not active!');
      }
    }
    
    // 7. List all active patterns
    console.log('\n7. ALL ACTIVE PATTERNS:');
    const activeList = await query(`
      SELECT 
        id,
        pattern_type,
        SUBSTRING(pattern, 1, 60) as pattern_preview
      FROM decision_patterns
      WHERE is_active = true 
      AND (is_deleted = false OR is_deleted IS NULL)
      ORDER BY 
        CASE pattern_type
          WHEN 'gift_cards' THEN 1
          WHEN 'tech_issue' THEN 2
          ELSE 3
        END,
        id
    `);
    
    console.log(`\n  ${activeList.rows.length} patterns now active:`);
    activeList.rows.forEach(p => {
      const marker = p.id === 217 ? '🎁' : p.id === 216 ? '🔧' : '✓';
      console.log(`  ${marker} ID ${p.id} [${p.pattern_type}]: "${p.pattern_preview}"`);
    });
    
  } catch (error) {
    console.error('ERROR during restoration:', error);
  }
  
  process.exit(0);
}

emergencyRestorePatterns();