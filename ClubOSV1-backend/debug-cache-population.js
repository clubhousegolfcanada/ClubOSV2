#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');

async function debugCachePopulation() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  console.log('🔍 Cache Population Debug\n');
  
  try {
    // 1. Cache stats
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_entries,
        COUNT(customer_name) as with_names,
        COUNT(CASE WHEN customer_name IS NULL THEN 1 END) as without_names,
        MIN(updated_at) as oldest_entry,
        MAX(updated_at) as newest_entry
      FROM hubspot_cache
    `);
    
    console.log('1. Cache Statistics:');
    const s = stats.rows[0];
    console.log(`   Total entries: ${s.total_entries}`);
    console.log(`   With names: ${s.with_names}`);
    console.log(`   Without names (not found): ${s.without_names}`);
    console.log(`   Oldest: ${s.oldest_entry || 'Empty'}`);
    console.log(`   Newest: ${s.newest_entry || 'Empty'}`);
    
    // 2. Check recent successful lookups
    console.log('\n2. Recent successful cache entries:');
    const recent = await pool.query(`
      SELECT phone_number, customer_name, company, updated_at
      FROM hubspot_cache
      WHERE customer_name IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 5
    `);
    
    recent.rows.forEach(row => {
      console.log(`   ${row.phone_number} → "${row.customer_name}" (${row.company || 'no company'})`);
    });
    
    // 3. Check if Roger is really not cached
    console.log('\n3. Checking specific numbers:');
    const checkNumbers = ['+19024998318', '19024998318', '9024998318'];
    
    for (const num of checkNumbers) {
      const check = await pool.query(
        'SELECT * FROM hubspot_cache WHERE phone_number = $1',
        [num]
      );
      console.log(`   ${num}: ${check.rows.length > 0 ? 'CACHED' : 'NOT CACHED'}`);
    }
    
    // 4. Check conversation update timing
    console.log('\n4. Recent conversation updates vs cache:');
    const recentConvs = await pool.query(`
      SELECT 
        c.phone_number,
        c.customer_name as conv_name,
        c.updated_at as conv_updated,
        h.customer_name as cache_name,
        h.updated_at as cache_updated
      FROM openphone_conversations c
      LEFT JOIN hubspot_cache h ON h.phone_number = c.phone_number
      WHERE c.updated_at > NOW() - INTERVAL '1 hour'
      ORDER BY c.updated_at DESC
      LIMIT 10
    `);
    
    console.log(`   Found ${recentConvs.rows.length} recent conversations:`);
    recentConvs.rows.forEach(row => {
      const status = row.cache_name ? 
        (row.conv_name === row.cache_name ? '✅ Synced' : '⚠️  Not synced') : 
        '❌ Not cached';
      console.log(`   ${row.phone_number}: ${status}`);
      if (row.cache_name && row.conv_name !== row.cache_name) {
        console.log(`     Conv: "${row.conv_name}" vs Cache: "${row.cache_name}"`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugCachePopulation().catch(console.error);