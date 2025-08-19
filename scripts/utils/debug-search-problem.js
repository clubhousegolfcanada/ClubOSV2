const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway',
  ssl: { rejectUnauthorized: false }
});

async function debugSearch() {
  console.log('🔍 DEBUGGING SEARCH PROBLEM\n');
  console.log('=====================================\n');
  
  try {
    // 1. Check what's in assistant_knowledge table
    console.log('1️⃣ Checking assistant_knowledge table:\n');
    const assistantKnowledge = await pool.query(`
      SELECT id, assistant_name, knowledge_content, created_at
      FROM assistant_knowledge
      WHERE assistant_name = 'Booking & Access'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (assistantKnowledge.rows.length > 0) {
      assistantKnowledge.rows.forEach(row => {
        console.log('Entry:', row.assistant_name);
        console.log('Content:', row.knowledge_content?.substring(0, 200));
        console.log('Created:', row.created_at);
        console.log();
      });
    }
    
    // 2. Run the EXACT search that the service runs
    console.log('2️⃣ Running search for "gift cards" across all tables:\n');
    
    // Search knowledge_store
    console.log('knowledge_store results:');
    const ksResults = await pool.query(`
      SELECT 
        key,
        value,
        confidence,
        ts_rank(search_vector, plainto_tsquery('english', $1)) as relevance
      FROM knowledge_store
      WHERE 
        search_vector @@ plainto_tsquery('english', $1)
        AND superseded_by IS NULL
      ORDER BY relevance DESC, confidence DESC
      LIMIT 3
    `, ['gift cards']);
    
    ksResults.rows.forEach(row => {
      console.log(`  ${row.key}: confidence=${row.confidence}, relevance=${row.relevance}, score=${row.confidence * row.relevance}`);
    });
    
    // Search assistant_knowledge
    console.log('\nassistant_knowledge results:');
    const akResults = await pool.query(`
      SELECT 
        assistant_name,
        1.0 as confidence,
        ts_rank(
          to_tsvector('english', knowledge_content),
          plainto_tsquery('english', $1)
        ) as relevance
      FROM assistant_knowledge
      WHERE 
        to_tsvector('english', knowledge_content) @@ plainto_tsquery('english', $1)
      ORDER BY relevance DESC
      LIMIT 3
    `, ['gift cards']);
    
    akResults.rows.forEach(row => {
      console.log(`  ${row.assistant_name}: confidence=${row.confidence}, relevance=${row.relevance}, score=${row.confidence * row.relevance}`);
    });
    
    // 3. Check why assistant_knowledge has such high confidence
    console.log('\n3️⃣ Why does assistant_knowledge always have confidence 1.0?');
    console.log('Looking at the search method...');
    console.log('FOUND IT: The code hardcodes confidence=1.0 for assistant_knowledge!');
    console.log('This means ANY match from assistant_knowledge will outrank knowledge_store entries');
    
    // 4. Solution
    console.log('\n4️⃣ THE FIX:');
    console.log('- Stop hardcoding confidence=1.0 for assistant_knowledge');
    console.log('- Or better: Only search knowledge_store (the new system)');
    console.log('- assistant_knowledge is the OLD system that should be deprecated');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

debugSearch();