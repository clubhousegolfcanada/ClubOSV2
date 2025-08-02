#!/usr/bin/env node

// Analyze HubSpot API logs from production
require('dotenv').config();
const { Pool } = require('pg');

async function analyzeHubSpotLogs() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  console.log('📊 HubSpot API Analysis\n');
  
  try {
    // 1. Check recent conversations
    console.log('1. Recent conversations analysis:');
    const conversations = await pool.query(`
      SELECT 
        phone_number,
        customer_name,
        created_at,
        updated_at,
        CASE 
          WHEN customer_name IS NOT NULL 
            AND customer_name != 'Unknown' 
            AND customer_name != phone_number 
          THEN 'Has Name'
          ELSE 'No Name'
        END as name_status
      FROM openphone_conversations
      WHERE created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    const withNames = conversations.rows.filter(r => r.name_status === 'Has Name').length;
    const total = conversations.rows.length;
    
    console.log(`   Total recent conversations: ${total}`);
    console.log(`   With names: ${withNames} (${Math.round(withNames/total*100)}%)`);
    console.log('\n   Sample conversations:');
    
    conversations.rows.slice(0, 5).forEach(row => {
      console.log(`   - ${row.phone_number} → "${row.customer_name}" (${row.name_status})`);
    });
    
    // 2. Check unique phone formats
    console.log('\n2. Phone number formats in database:');
    const formats = await pool.query(`
      SELECT DISTINCT 
        CASE 
          WHEN phone_number LIKE '+1%' THEN '+1 format'
          WHEN phone_number LIKE '1%' THEN '1 format'
          WHEN phone_number ~ '^[0-9]{10}$' THEN '10 digit format'
          WHEN phone_number ~ '^[0-9]{7}$' THEN '7 digit format'
          ELSE 'Other format'
        END as format,
        COUNT(*) as count
      FROM openphone_conversations
      WHERE phone_number IS NOT NULL
      GROUP BY format
      ORDER BY count DESC
    `);
    
    formats.rows.forEach(row => {
      console.log(`   - ${row.format}: ${row.count} conversations`);
    });
    
    // 3. Check if cache table exists and has data
    console.log('\n3. HubSpot cache status:');
    try {
      const cacheStats = await pool.query(`
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN customer_name IS NOT NULL THEN 1 END) as with_names
        FROM hubspot_cache
      `);
      
      console.log(`   Cache entries: ${cacheStats.rows[0].total}`);
      console.log(`   With names: ${cacheStats.rows[0].with_names}`);
    } catch (error) {
      console.log('   ❌ Cache table does not exist');
    }
    
    // 4. Success rate calculation
    console.log('\n4. Estimated API success rate:');
    console.log('   If only 5% succeed, possible causes:');
    console.log('   - Rate limiting (too many requests)');
    console.log('   - Phone format mismatch');
    console.log('   - API key permissions');
    console.log('   - Service not properly initialized');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

analyzeHubSpotLogs().catch(console.error);