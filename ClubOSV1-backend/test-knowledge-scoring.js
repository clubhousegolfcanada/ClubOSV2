const { Pool } = require('pg');

async function testKnowledgeScoring() {
  const pool = new Pool({
    connectionString: "postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway"
  });

  try {
    console.log('=== Testing Knowledge Scoring for Gift Cards ===\n');
    
    const query = "does clubhouse offer giftcards? gift cards?";
    console.log(`Query: "${query}"\n`);
    
    // 1. Test knowledge_store search with scoring
    console.log('1. Testing knowledge_store full-text search...');
    const storeQuery = `
      SELECT 
        key,
        value,
        confidence,
        ts_rank(search_vector, query) as relevance,
        confidence * ts_rank(search_vector, query) as combined_score
      FROM knowledge_store,
           plainto_tsquery('english', $1) query
      WHERE search_vector @@ query
      ORDER BY combined_score DESC
      LIMIT 5
    `;
    
    const storeResult = await pool.query(storeQuery, [query]);
    console.log(`   Found ${storeResult.rows.length} results`);
    storeResult.rows.forEach((row, i) => {
      console.log(`   ${i+1}. Key: ${row.key}`);
      console.log(`      Confidence: ${row.confidence}`);
      console.log(`      Relevance: ${row.relevance}`);
      console.log(`      Combined Score: ${row.combined_score}`);
      console.log(`      Value: ${JSON.stringify(row.value).substring(0, 100)}...`);
    });
    
    // 2. Test knowledge_audit_log search (skip similarity function)
    console.log('\n2. Testing knowledge_audit_log search...');
    const auditQuery = `
      SELECT 
        assistant_target,
        category,
        key,
        new_value,
        0.8 as confidence
      FROM knowledge_audit_log
      WHERE LOWER(new_value) LIKE '%gift%'
      ORDER BY timestamp DESC
      LIMIT 5
    `;
    
    const auditResult = await pool.query(auditQuery);
    console.log(`   Found ${auditResult.rows.length} results`);
    auditResult.rows.forEach((row, i) => {
      console.log(`   ${i+1}. Assistant: ${row.assistant_target}, Category: ${row.category}`);
      console.log(`      Confidence: ${row.confidence} (hardcoded)`);
      console.log(`      Value: ${row.new_value.substring(0, 80)}...`);
    });
    
    // 3. Test what the actual knowledgeSearchService would return
    console.log('\n3. Simulating actual knowledgeSearchService logic...');
    
    // This simulates the actual search in knowledgeSearchService.ts
    const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    console.log(`   Search terms: ${searchTerms.join(', ')}`);
    
    // Search knowledge_audit_log with the actual conditions used
    const actualSearchQuery = `
      SELECT 
        'audit.' || assistant_target || '.' || category as key,
        new_value as value,
        0.8 as confidence,
        'knowledge_audit_log' as source,
        assistant_target,
        category,
        timestamp
      FROM knowledge_audit_log
      WHERE ${searchTerms.map((_, i) => `(
        LOWER(new_value) LIKE $${i+1} OR 
        LOWER(key) LIKE $${i+1} OR 
        LOWER(category) LIKE $${i+1}
      )`).join(' OR ')}
      ORDER BY timestamp DESC
      LIMIT 5
    `;
    
    const params = searchTerms.map(term => `%${term}%`);
    const actualResult = await pool.query(actualSearchQuery, params);
    
    console.log(`   Results from actual search logic: ${actualResult.rows.length}`);
    actualResult.rows.forEach((row, i) => {
      console.log(`   ${i+1}. Key: ${row.key}`);
      console.log(`      Confidence: ${row.confidence}`);
      console.log(`      Source: ${row.source}`);
      console.log(`      Value: ${row.value.substring(0, 80)}...`);
    });
    
    // 4. Calculate relevance score as the service would
    console.log('\n4. Calculating relevance scores...');
    if (actualResult.rows.length > 0) {
      const topResult = actualResult.rows[0];
      const value = topResult.value.toLowerCase();
      
      // Count how many search terms appear in the value
      const matchCount = searchTerms.filter(term => value.includes(term)).length;
      const relevance = matchCount / searchTerms.length;
      
      console.log(`   Top result relevance calculation:`);
      console.log(`   - Search terms: ${searchTerms.length}`);
      console.log(`   - Matching terms: ${matchCount}`);
      console.log(`   - Relevance: ${relevance}`);
      console.log(`   - Confidence: ${topResult.confidence}`);
      console.log(`   - Combined Score: ${topResult.confidence * relevance}`);
      
      // This is what's actually happening
      const combinedScore = topResult.confidence * relevance;
      console.log(`\n   ACTUAL COMBINED SCORE: ${combinedScore}`);
      console.log(`   Threshold: 0.5`);
      console.log(`   Will use knowledge: ${combinedScore > 0.5 ? 'YES' : 'NO'}`);
      
      if (combinedScore <= 0.5) {
        console.log('\n❌ PROBLEM: The relevance calculation is too strict!');
        console.log('   The search terms include "does", "clubhouse", "offer" which dilute the match.');
        console.log('   Only "giftcards" matches, giving low relevance.');
      }
    }
    
    // 5. Test with just the important keywords
    console.log('\n5. Testing with filtered keywords (removing stop words)...');
    const importantTerms = ['giftcards', 'gift', 'cards'];
    const filteredResult = await pool.query(actualSearchQuery, importantTerms.map(t => `%${t}%`));
    
    if (filteredResult.rows.length > 0) {
      const topResult = filteredResult.rows[0];
      const value = topResult.value.toLowerCase();
      const matchCount = importantTerms.filter(term => value.includes(term)).length;
      const relevance = matchCount / importantTerms.length;
      const combinedScore = topResult.confidence * relevance;
      
      console.log(`   With important terms only:`);
      console.log(`   - Relevance: ${relevance}`);
      console.log(`   - Combined Score: ${combinedScore}`);
      console.log(`   - Will use knowledge: ${combinedScore > 0.5 ? 'YES' : 'NO'}`);
    }
    
  } finally {
    await pool.end();
  }
}

testKnowledgeScoring().catch(console.error);