const { Pool } = require('pg');

async function testGiftCardSearch() {
  const pool = new Pool({
    connectionString: "postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway"
  });

  try {
    console.log('=== Testing Gift Card Knowledge Search ===\n');
    
    // 1. Check knowledge_store table
    console.log('1. Checking knowledge_store table...');
    const storeResult = await pool.query(`
      SELECT key, value, confidence 
      FROM knowledge_store 
      WHERE LOWER(value::text) LIKE '%gift%'
      LIMIT 5
    `);
    console.log(`   Found ${storeResult.rows.length} entries in knowledge_store`);
    
    // 2. Check knowledge_audit_log
    console.log('\n2. Checking knowledge_audit_log table...');
    const auditResult = await pool.query(`
      SELECT assistant_target, category, new_value, timestamp
      FROM knowledge_audit_log
      WHERE LOWER(new_value) LIKE '%gift%'
      ORDER BY timestamp DESC
      LIMIT 5
    `);
    console.log(`   Found ${auditResult.rows.length} entries in knowledge_audit_log`);
    auditResult.rows.forEach((row, i) => {
      console.log(`   ${i+1}. ${row.assistant_target} - ${row.category}`);
      console.log(`      ${row.new_value.substring(0, 80)}...`);
    });
    
    // 3. Test the actual search function logic
    console.log('\n3. Testing search logic (simulating knowledgeSearchService)...');
    
    // Search knowledge_store with full-text search
    const searchQuery = `
      SELECT 
        key,
        value,
        confidence,
        ts_rank(search_vector, plainto_tsquery('english', $1)) as relevance
      FROM knowledge_store
      WHERE search_vector @@ plainto_tsquery('english', $1)
      ORDER BY relevance DESC, confidence DESC
      LIMIT 5
    `;
    
    const searchTerms = ['gift', 'giftcard', 'gift card'];
    
    for (const term of searchTerms) {
      console.log(`\n   Searching for "${term}"...`);
      try {
        const result = await pool.query(searchQuery, [term]);
        console.log(`   Results: ${result.rows.length}`);
        if (result.rows.length > 0) {
          console.log(`   Top result: ${result.rows[0].key} (confidence: ${result.rows[0].confidence})`);
        }
      } catch (error) {
        console.log(`   Error: ${error.message}`);
        // Try without full-text search
        console.log('   Falling back to LIKE search...');
        const fallbackResult = await pool.query(`
          SELECT key, value, confidence
          FROM knowledge_store
          WHERE LOWER(value::text) LIKE $1
          LIMIT 5
        `, [`%${term}%`]);
        console.log(`   Fallback results: ${fallbackResult.rows.length}`);
      }
    }
    
    // 4. Check if knowledge_store has the search_vector column
    console.log('\n4. Checking knowledge_store schema...');
    const schemaResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'knowledge_store'
      ORDER BY ordinal_position
    `);
    console.log('   Columns:');
    schemaResult.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });
    
    // 5. If search_vector doesn't exist, that's the problem
    const hasSearchVector = schemaResult.rows.some(col => col.column_name === 'search_vector');
    
    if (!hasSearchVector) {
      console.log('\n❌ PROBLEM FOUND: knowledge_store table missing search_vector column!');
      console.log('   This is why full-text search isn\'t working.');
      console.log('   The migration to add this column may have failed.');
    }
    
    // 6. Test simplified search from audit log
    console.log('\n5. Testing simplified search from knowledge_audit_log...');
    const simpleSearch = await pool.query(`
      SELECT 
        assistant_target,
        category,
        key,
        new_value,
        timestamp
      FROM knowledge_audit_log
      WHERE (
        LOWER(new_value) LIKE '%gift%' OR
        LOWER(new_value) LIKE '%giftcard%' OR
        LOWER(key) LIKE '%gift%' OR
        LOWER(category) LIKE '%gift%'
      )
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    
    if (simpleSearch.rows.length > 0) {
      console.log('   ✅ Found gift card knowledge in audit log!');
      console.log(`   Assistant: ${simpleSearch.rows[0].assistant_target}`);
      console.log(`   Category: ${simpleSearch.rows[0].category}`);
      console.log(`   Content: ${simpleSearch.rows[0].new_value.substring(0, 100)}...`);
      console.log('\n   The data EXISTS but search isn\'t finding it.');
    }
    
  } finally {
    await pool.end();
  }
}

testGiftCardSearch().catch(console.error);