/**
 * Direct database test for knowledge
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: "postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway"
});

async function test() {
  console.log('🔍 Testing Knowledge Database Directly\n');
  console.log('=' .repeat(50) + '\n');
  
  try {
    // 1. Check SOP embeddings
    console.log('📚 Checking SOP Embeddings:\n');
    const sopResult = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(DISTINCT category) as categories,
             COUNT(CASE WHEN content ILIKE '%gift%card%' THEN 1 END) as gift_card_sops
      FROM sop_embeddings
    `);
    
    console.log(`Total SOPs: ${sopResult.rows[0].total}`);
    console.log(`Categories: ${sopResult.rows[0].categories}`);
    console.log(`Gift Card SOPs: ${sopResult.rows[0].gift_card_sops}\n`);
    
    // 2. Check knowledge_store
    console.log('🗄️ Checking Knowledge Store:\n');
    const ksResult = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN key ILIKE '%gift%' OR value::text ILIKE '%gift%' THEN 1 END) as gift_related
      FROM knowledge_store
      WHERE superseded_by IS NULL
    `);
    
    console.log(`Total Knowledge Items: ${ksResult.rows[0].total}`);
    console.log(`Gift-related Items: ${ksResult.rows[0].gift_related}\n`);
    
    // 3. Test full-text search (what the system actually uses)
    console.log('🔎 Testing Full-Text Search for "gift cards":\n');
    const searchQuery = 'gift cards';
    const searchResult = await pool.query(`
      SELECT 
        key,
        confidence,
        ts_rank(search_vector, plainto_tsquery('english', $1)) as relevance,
        confidence * ts_rank(search_vector, plainto_tsquery('english', $1)) as combined_score
      FROM knowledge_store
      WHERE 
        search_vector @@ plainto_tsquery('english', $1)
        AND superseded_by IS NULL
      ORDER BY combined_score DESC
      LIMIT 5
    `, [searchQuery]);
    
    if (searchResult.rows.length > 0) {
      console.log(`Found ${searchResult.rows.length} results:\n`);
      searchResult.rows.forEach((row: any, index: number) => {
        console.log(`Result ${index + 1}:`);
        console.log(`  Key: ${row.key}`);
        console.log(`  Confidence: ${row.confidence.toFixed(3)}`);
        console.log(`  Relevance: ${row.relevance.toFixed(6)}`);
        console.log(`  Combined Score: ${row.combined_score.toFixed(6)}`);
        console.log(`  Will use local (>0.15)? ${row.combined_score >= 0.15 ? '✅ YES' : '❌ NO'}\n`);
      });
      
      const topScore = searchResult.rows[0].combined_score;
      if (topScore >= 0.15) {
        console.log(`✅ SUCCESS! Top result (${topScore.toFixed(3)}) exceeds threshold (0.15)`);
        console.log(`   Gift card queries WILL use local knowledge!\n`);
      } else {
        console.log(`⚠️ Top result (${topScore.toFixed(3)}) below threshold (0.15)`);
        console.log(`   Need to adjust confidence scores or relevance calculation\n`);
      }
    } else {
      console.log('❌ No results found in full-text search\n');
      
      // Check if data exists but isn't searchable
      console.log('Checking if gift card data exists but isn\'t searchable...\n');
      const directCheck = await pool.query(`
        SELECT key, value->>'answer' as answer
        FROM knowledge_store
        WHERE (key ILIKE '%gift%' OR value::text ILIKE '%gift%')
        AND superseded_by IS NULL
        LIMIT 3
      `);
      
      if (directCheck.rows.length > 0) {
        console.log('Found gift card data that isn\'t being picked up by search:');
        directCheck.rows.forEach((row: any) => {
          console.log(`- ${row.key}: ${row.answer?.substring(0, 100)}...`);
        });
        console.log('\n⚠️ Need to rebuild search vectors!');
      }
    }
    
    // 4. Sample some actual gift card SOPs
    console.log('\n📝 Sample Gift Card SOPs:\n');
    const sopSamples = await pool.query(`
      SELECT title, content
      FROM sop_embeddings
      WHERE content ILIKE '%gift%card%'
      LIMIT 2
    `);
    
    sopSamples.rows.forEach((row: any) => {
      console.log(`Title: ${row.title}`);
      console.log(`Content: ${row.content.substring(0, 200)}...\n`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

test().catch(console.error);