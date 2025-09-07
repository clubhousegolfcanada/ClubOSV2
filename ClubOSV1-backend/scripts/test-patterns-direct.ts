import { query } from '../src/utils/db';

async function testPatternsDirectly() {
  console.log('Testing decision_patterns table directly...\n');
  
  try {
    // Test 1: Check what columns actually exist
    console.log('1. Checking table schema:');
    const schemaResult = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'decision_patterns'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in decision_patterns:');
    schemaResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // Test 2: Try the exact query from patterns.ts
    console.log('\n2. Testing patterns.ts query (will fail if created_at missing):');
    try {
      const patternsQuery = await query(`
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
        LIMIT 1
      `);
      console.log('✅ Query succeeded!');
    } catch (err: any) {
      console.log(`❌ Query failed: ${err.message}`);
    }
    
    // Test 3: Try with column aliasing (workaround)
    console.log('\n3. Testing with column aliasing (workaround):');
    try {
      const aliasedQuery = await query(`
        SELECT 
          id,
          pattern_type,
          COALESCE(trigger_text, trigger_examples[1], '') as pattern,
          response_template,
          trigger_examples,
          trigger_keywords,
          confidence_score,
          execution_count,
          success_count,
          is_active,
          COALESCE(is_deleted, FALSE) as is_deleted,
          COALESCE(first_seen, NOW()) as created_at,
          COALESCE(updated_at, last_modified, NOW()) as updated_at
        FROM decision_patterns
        LIMIT 1
      `);
      console.log('✅ Aliased query succeeded!');
      if (aliasedQuery.rows.length > 0) {
        console.log('Sample pattern:', {
          id: aliasedQuery.rows[0].id,
          type: aliasedQuery.rows[0].pattern_type,
          pattern: aliasedQuery.rows[0].pattern?.substring(0, 50) + '...'
        });
      }
    } catch (err: any) {
      console.log(`❌ Aliased query failed: ${err.message}`);
    }
    
    // Test 4: Check if we need a pattern column
    console.log('\n4. Checking for pattern column:');
    const hasPatternCol = schemaResult.rows.some(r => r.column_name === 'pattern');
    const hasTriggerText = schemaResult.rows.some(r => r.column_name === 'trigger_text');
    const hasCreatedAt = schemaResult.rows.some(r => r.column_name === 'created_at');
    const hasFirstSeen = schemaResult.rows.some(r => r.column_name === 'first_seen');
    
    console.log(`  pattern column: ${hasPatternCol ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`  trigger_text column: ${hasTriggerText ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`  created_at column: ${hasCreatedAt ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`  first_seen column: ${hasFirstSeen ? '✅ EXISTS' : '❌ MISSING'}`);
    
    // Summary
    console.log('\n=== DIAGNOSIS ===');
    if (!hasCreatedAt && hasFirstSeen) {
      console.log('❌ PROBLEM: Code expects "created_at" but table has "first_seen"');
      console.log('   SOLUTION: Either add created_at column OR update code to use first_seen');
    }
    if (!hasPatternCol && hasTriggerText) {
      console.log('❌ PROBLEM: Code expects "pattern" but table has "trigger_text"');
      console.log('   SOLUTION: Either add pattern column OR update code to use trigger_text');
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
  
  process.exit(0);
}

testPatternsDirectly();