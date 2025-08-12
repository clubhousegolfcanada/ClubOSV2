const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkDatabase() {
  console.log('🔍 CHECKING WHAT\'S ACTUALLY IN THE DATABASE\n');
  console.log('=====================================\n');
  
  try {
    // 1. Check if knowledge_store table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'knowledge_store'
      );
    `);
    
    console.log('✓ knowledge_store table exists:', tableCheck.rows[0].exists);
    
    // 2. Count total entries
    const countResult = await pool.query('SELECT COUNT(*) FROM knowledge_store WHERE superseded_by IS NULL');
    console.log('✓ Total active entries:', countResult.rows[0].count);
    
    // 3. Find ALL entries with "gift" in them
    console.log('\n📦 ALL entries containing "gift":\n');
    const giftEntries = await pool.query(`
      SELECT key, value, confidence, created_at, updated_at
      FROM knowledge_store
      WHERE (key ILIKE '%gift%' OR value::text ILIKE '%gift%')
        AND superseded_by IS NULL
      ORDER BY updated_at DESC
    `);
    
    if (giftEntries.rows.length > 0) {
      giftEntries.rows.forEach((row, i) => {
        console.log(`Entry ${i + 1}:`);
        console.log('  Key:', row.key);
        console.log('  Value:', JSON.stringify(row.value).substring(0, 200));
        console.log('  Confidence:', row.confidence);
        console.log('  Created:', row.created_at);
        console.log('  Updated:', row.updated_at);
        console.log();
      });
    } else {
      console.log('❌ NO GIFT CARD ENTRIES FOUND!');
    }
    
    // 4. Test the EXACT search query that the service uses
    console.log('🔬 Testing the EXACT full-text search query:\n');
    const searchQuery = 'gift cards';
    
    const searchResult = await pool.query(`
      SELECT 
        key,
        value,
        confidence,
        ts_rank(search_vector, plainto_tsquery('english', $1)) as relevance,
        search_vector
      FROM knowledge_store
      WHERE 
        search_vector @@ plainto_tsquery('english', $1)
        AND superseded_by IS NULL
      ORDER BY relevance DESC, confidence DESC
      LIMIT 5
    `, [searchQuery]);
    
    console.log(`Full-text search for "${searchQuery}" returned: ${searchResult.rows.length} results\n`);
    
    if (searchResult.rows.length === 0) {
      console.log('❌ PROBLEM: Full-text search returns NOTHING!');
      console.log('\nLet\'s check what the search query looks like:');
      
      const queryCheck = await pool.query(`
        SELECT plainto_tsquery('english', $1) as query
      `, [searchQuery]);
      
      console.log('Search query transforms to:', queryCheck.rows[0].query);
      
      // Check if search vectors are populated
      const vectorCheck = await pool.query(`
        SELECT COUNT(*) as total,
               COUNT(search_vector) as with_vector
        FROM knowledge_store
        WHERE superseded_by IS NULL
      `);
      
      console.log('\nSearch vector stats:');
      console.log('  Total entries:', vectorCheck.rows[0].total);
      console.log('  Entries with search vector:', vectorCheck.rows[0].with_vector);
      
      if (vectorCheck.rows[0].with_vector === '0') {
        console.log('  ❌ CRITICAL: No search vectors exist! Full-text search cannot work!');
      }
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

checkDatabase();