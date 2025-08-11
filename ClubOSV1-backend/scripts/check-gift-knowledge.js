#!/usr/bin/env node
require('dotenv').config();

const { Pool } = require('pg');

async function checkGiftKnowledge() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('\n=== Checking gift card knowledge in all tables ===\n');

    // 1. Check knowledge_store
    console.log('1. KNOWLEDGE_STORE TABLE:');
    const storeResult = await pool.query(`
      SELECT key, value, confidence, created_at
      FROM knowledge_store
      WHERE key ILIKE '%gift%' OR value::text ILIKE '%gift%'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (storeResult.rows.length === 0) {
      console.log('   No gift card entries found\n');
    } else {
      storeResult.rows.forEach(row => {
        console.log(`   Key: ${row.key}`);
        console.log(`   Value: ${JSON.stringify(row.value).substring(0, 200)}...`);
        console.log(`   Confidence: ${row.confidence}`);
        console.log(`   Created: ${row.created_at}\n`);
      });
    }

    // 2. Check assistant_knowledge
    console.log('2. ASSISTANT_KNOWLEDGE TABLE:');
    const assistantResult = await pool.query(`
      SELECT route, fact, tags, created_at
      FROM assistant_knowledge
      WHERE LOWER(fact) LIKE '%gift%'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (assistantResult.rows.length === 0) {
      console.log('   No gift card entries found\n');
    } else {
      assistantResult.rows.forEach(row => {
        console.log(`   Route: ${row.route}`);
        console.log(`   Fact: ${row.fact.substring(0, 200)}...`);
        console.log(`   Tags: ${JSON.stringify(row.tags)}`);
        console.log(`   Created: ${row.created_at}\n`);
      });
    }

    // 3. Check knowledge_audit_log
    console.log('3. KNOWLEDGE_AUDIT_LOG TABLE:');
    const auditResult = await pool.query(`
      SELECT action, category, key, new_value, assistant_target, timestamp
      FROM knowledge_audit_log
      WHERE LOWER(new_value) LIKE '%gift%' OR LOWER(key) LIKE '%gift%'
      ORDER BY timestamp DESC
      LIMIT 5
    `);
    
    if (auditResult.rows.length === 0) {
      console.log('   No gift card entries found\n');
    } else {
      auditResult.rows.forEach(row => {
        console.log(`   Action: ${row.action}`);
        console.log(`   Category: ${row.category}`);
        console.log(`   Key: ${row.key || 'N/A'}`);
        console.log(`   Value: ${row.new_value.substring(0, 200)}...`);
        console.log(`   Target: ${row.assistant_target}`);
        console.log(`   Time: ${row.timestamp}\n`);
      });
    }

    // 4. Test full-text search
    console.log('4. TESTING FULL-TEXT SEARCH:');
    const searchResult = await pool.query(`
      SELECT 
        key,
        value,
        confidence,
        ts_rank(search_vector, plainto_tsquery('english', 'gift card')) as relevance
      FROM knowledge_store
      WHERE search_vector @@ plainto_tsquery('english', 'gift card')
      ORDER BY relevance DESC, confidence DESC
      LIMIT 5
    `);
    
    if (searchResult.rows.length === 0) {
      console.log('   Full-text search found no matches for "gift card"\n');
    } else {
      console.log('   Full-text search results:');
      searchResult.rows.forEach(row => {
        console.log(`     Key: ${row.key}, Relevance: ${row.relevance}, Confidence: ${row.confidence}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkGiftKnowledge();