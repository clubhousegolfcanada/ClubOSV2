/**
 * End-to-end test for knowledge storage and retrieval
 * This proves whether the system can store and retrieve knowledge
 */

require('dotenv').config({ path: './ClubOSV1-backend/.env' });

const { Pool } = require('pg');

// Create a direct database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runTest() {
  console.log('🧪 KNOWLEDGE SYSTEM END-TO-END TEST\n');
  console.log('=====================================\n');
  
  try {
    // Step 1: Add knowledge directly to the database
    console.log('📝 STEP 1: Adding gift card knowledge to database...\n');
    
    const testKey = 'brand.pricing.gift_cards_test_' + Date.now();
    const testValue = {
      title: 'Gift Cards',
      content: 'Gift cards are available for purchase at www.clubhouse247golf.com/giftcard/purchase',
      answer: 'Yes, we offer gift cards! You can purchase them online at www.clubhouse247golf.com/giftcard/purchase',
      category: 'pricing',
      assistant: 'brand',
      question: 'Do you have gift cards?'
    };
    
    await pool.query(`
      INSERT INTO knowledge_store (key, value, confidence, verification_status, source_type)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        confidence = EXCLUDED.confidence,
        updated_at = NOW()
    `, [testKey, JSON.stringify(testValue), 0.9, 'verified', 'manual']);
    
    console.log('✅ Knowledge added with key:', testKey);
    console.log('   Content:', testValue.content);
    console.log();
    
    // Step 2: Search for it using full-text search (like the service does)
    console.log('🔍 STEP 2: Searching for "gift cards" using full-text search...\n');
    
    const searchResult = await pool.query(`
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
      LIMIT 5
    `, ['gift cards']);
    
    console.log(`Found ${searchResult.rows.length} results:\n`);
    
    if (searchResult.rows.length > 0) {
      searchResult.rows.forEach((row, i) => {
        const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        console.log(`Result ${i + 1}:`);
        console.log('  Key:', row.key);
        console.log('  Content:', value.content || value.answer || value);
        console.log('  Confidence:', row.confidence);
        console.log('  Relevance:', row.relevance);
        console.log('  Combined Score:', row.confidence * row.relevance);
        console.log();
      });
    } else {
      console.log('❌ NO RESULTS FOUND - This is the problem!');
    }
    
    // Step 3: Also try a simpler LIKE search
    console.log('🔍 STEP 3: Trying simple LIKE search for "gift"...\n');
    
    const likeResult = await pool.query(`
      SELECT key, value, confidence
      FROM knowledge_store
      WHERE 
        (key ILIKE '%gift%' OR value::text ILIKE '%gift%')
        AND superseded_by IS NULL
      ORDER BY confidence DESC
      LIMIT 5
    `);
    
    console.log(`Found ${likeResult.rows.length} results with LIKE search:\n`);
    
    if (likeResult.rows.length > 0) {
      likeResult.rows.forEach((row, i) => {
        const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        console.log(`Result ${i + 1}:`);
        console.log('  Key:', row.key);
        console.log('  Content:', value.content || value.answer || value);
        console.log();
      });
    }
    
    // Step 4: Check if full-text search indexes are working
    console.log('🔍 STEP 4: Checking search_vector content for our test entry...\n');
    
    const vectorCheck = await pool.query(`
      SELECT 
        key,
        search_vector,
        to_tsvector('english', 
          coalesce(key, '') || ' ' ||
          coalesce(value->>'title', '') || ' ' ||
          coalesce(value->>'content', '') || ' ' ||
          coalesce(value->>'answer', '') || ' ' ||
          coalesce(value->>'question', '')
        ) as computed_vector
      FROM knowledge_store
      WHERE key = $1
    `, [testKey]);
    
    if (vectorCheck.rows.length > 0) {
      console.log('Search vector for our test entry:');
      console.log('  Key:', vectorCheck.rows[0].key);
      console.log('  Search Vector:', vectorCheck.rows[0].search_vector);
      console.log('  Computed Vector:', vectorCheck.rows[0].computed_vector);
    }
    
    // Step 5: Test what the actual service would return
    console.log('\n📊 STEP 5: Testing combined confidence scoring (>0.5 threshold)...\n');
    
    const topResult = searchResult.rows[0];
    if (topResult) {
      const combinedScore = topResult.confidence * topResult.relevance;
      console.log('Top result combined score:', combinedScore);
      console.log('Threshold for using local knowledge:', 0.5);
      
      if (combinedScore > 0.5) {
        console.log('✅ WOULD USE LOCAL KNOWLEDGE!');
      } else {
        console.log('❌ Score too low, would use OpenAI');
      }
    }
    
    console.log('\n=====================================');
    console.log('📈 TEST SUMMARY:\n');
    console.log('1. Can we add knowledge? ✅');
    console.log(`2. Can we find it with full-text search? ${searchResult.rows.length > 0 ? '✅' : '❌'}`);
    console.log(`3. Can we find it with LIKE search? ${likeResult.rows.length > 0 ? '✅' : '❌'}`);
    console.log(`4. Would it be used (score > 0.5)? ${topResult && (topResult.confidence * topResult.relevance) > 0.5 ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

runTest();