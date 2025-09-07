import { query } from '../src/utils/db';

async function investigatePatternDiscrepancy() {
  console.log('=== INVESTIGATING PATTERN DISCREPANCY ===\n');
  console.log('UI shows: 1 active pattern');
  console.log('Database should have: 22 active patterns\n');
  
  try {
    // 1. Check all pattern-related tables
    console.log('1. Checking all pattern-related tables:');
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (
        table_name LIKE '%pattern%' 
        OR table_name LIKE '%automation%'
        OR table_name LIKE '%ai_%'
      )
      ORDER BY table_name
    `);
    
    console.log('Found pattern/automation related tables:');
    tables.rows.forEach(t => console.log(`  - ${t.table_name}`));
    
    // 2. Check decision_patterns status
    console.log('\n2. decision_patterns table status:');
    const dpStats = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active_true,
        COUNT(*) FILTER (WHERE is_active = false) as active_false,
        COUNT(*) FILTER (WHERE is_active IS NULL) as active_null,
        COUNT(*) FILTER (WHERE is_deleted = true) as deleted_true,
        COUNT(*) FILTER (WHERE is_deleted = false) as deleted_false,
        COUNT(*) FILTER (WHERE is_deleted IS NULL) as deleted_null
      FROM decision_patterns
    `);
    
    const stats = dpStats.rows[0];
    console.log(`  Total: ${stats.total}`);
    console.log(`  is_active: true=${stats.active_true}, false=${stats.active_false}, null=${stats.active_null}`);
    console.log(`  is_deleted: true=${stats.deleted_true}, false=${stats.deleted_false}, null=${stats.deleted_null}`);
    
    // 3. Check what the actual API query returns
    console.log('\n3. Testing the exact API query from patterns.ts:');
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
    
    console.log(`  Query returns: ${apiQuery.rows.length} patterns`);
    
    // 4. Check if there's another automations table
    console.log('\n4. Checking ai_automation_patterns table (if exists):');
    try {
      const aiPatterns = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active
        FROM ai_automation_patterns
      `);
      console.log(`  ai_automation_patterns: ${aiPatterns.rows[0].total} total, ${aiPatterns.rows[0].active} active`);
    } catch (err) {
      console.log('  ai_automation_patterns table does not exist');
    }
    
    // 5. Check for gift card specific patterns
    console.log('\n5. Gift card patterns status:');
    const giftCardPatterns = await query(`
      SELECT 
        id,
        pattern_type,
        SUBSTRING(pattern, 1, 50) as pattern_preview,
        is_active,
        is_deleted,
        confidence_score,
        execution_count,
        success_count
      FROM decision_patterns
      WHERE 
        pattern_type = 'gift_cards'
        OR pattern ILIKE '%gift%card%'
        OR response_template ILIKE '%gift-cards%'
      ORDER BY id
    `);
    
    console.log(`  Found ${giftCardPatterns.rows.length} gift card patterns:`);
    giftCardPatterns.rows.forEach(p => {
      console.log(`    ID ${p.id}: active=${p.is_active}, deleted=${p.is_deleted}, conf=${p.confidence_score}`);
      console.log(`      "${p.pattern_preview}..."`);
    });
    
    // 6. Check if there's a view that filters patterns
    console.log('\n6. Checking for views that might filter patterns:');
    const views = await query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%pattern%'
    `);
    
    if (views.rows.length === 0) {
      console.log('  No pattern-related views found');
    } else {
      views.rows.forEach(v => console.log(`  - ${v.table_name}`));
    }
    
    // 7. Check what patterns.ts endpoint would actually return
    console.log('\n7. Simulating /api/patterns endpoint logic:');
    
    // Default query parameters from OperationsPatterns.tsx
    const includeDeleted = false;
    const includeInactive = false;
    
    const conditions = [];
    if (!includeDeleted) {
      conditions.push('(is_deleted = false OR is_deleted IS NULL)');
    }
    if (!includeInactive) {
      conditions.push('is_active = true');
    }
    
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';
    
    console.log(`  WHERE clause: ${whereClause}`);
    
    const simulatedQuery = await query(`
      SELECT COUNT(*) as count
      FROM decision_patterns
      ${whereClause}
    `);
    
    console.log(`  Simulated endpoint would return: ${simulatedQuery.rows[0].count} patterns`);
    
    // 8. Check if there's a different active pattern (maybe ID 184)
    console.log('\n8. Checking pattern ID 184 (might be the only one showing):');
    const pattern184 = await query(`
      SELECT * FROM decision_patterns WHERE id = 184
    `);
    
    if (pattern184.rows.length > 0) {
      const p = pattern184.rows[0];
      console.log(`  ID 184: ${p.pattern_type}`);
      console.log(`  Pattern: "${p.pattern?.substring(0, 60)}..."`);
      console.log(`  is_active: ${p.is_active}, is_deleted: ${p.is_deleted}`);
      console.log(`  confidence: ${p.confidence_score}, executions: ${p.execution_count}`);
    }
    
    // 9. Check for any recent updates that might have reverted changes
    console.log('\n9. Recent pattern updates (last hour):');
    const recentUpdates = await query(`
      SELECT 
        COUNT(*) as count,
        MAX(updated_at) as last_update,
        MIN(updated_at) as first_update
      FROM decision_patterns
      WHERE updated_at >= NOW() - INTERVAL '1 hour'
    `);
    
    const recent = recentUpdates.rows[0];
    if (recent.count > 0) {
      console.log(`  ${recent.count} patterns updated between:`);
      console.log(`    ${recent.first_update} and ${recent.last_update}`);
    } else {
      console.log('  No patterns updated in the last hour');
    }
    
    // 10. Final diagnosis
    console.log('\n=== DIAGNOSIS ===');
    if (apiQuery.rows.length === 1) {
      console.log('❌ DATABASE ISSUE: Only 1 pattern is actually active in the database!');
      console.log('   The smart cleanup might not have committed properly or was reverted.');
    } else if (apiQuery.rows.length === 22) {
      console.log('✅ DATABASE OK: 22 patterns are active in the database');
      console.log('❌ FRONTEND/API ISSUE: The UI is not showing the correct data');
      console.log('   Possible causes:');
      console.log('   - Frontend is caching old data');
      console.log('   - API is using a different query or table');
      console.log('   - Deployment has not completed');
    } else {
      console.log(`⚠️ UNEXPECTED: Database has ${apiQuery.rows.length} active patterns (expected 22 or 1)`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

investigatePatternDiscrepancy();