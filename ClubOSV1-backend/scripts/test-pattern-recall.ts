#!/usr/bin/env tsx
/**
 * Test Pattern Recall with Semantic Search
 */

import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';
import { logger } from '../src/utils/logger';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testPatternRecall() {
  try {
    // 1. Check embedding status
    const status = await db.query(`
      SELECT 
        COUNT(*) as total_patterns,
        COUNT(embedding) as with_embeddings,
        COUNT(CASE WHEN semantic_search_enabled THEN 1 END) as semantic_enabled
      FROM decision_patterns
    `);
    
    console.log('\n📊 Pattern Embedding Status:');
    console.log('  Total patterns:', status.rows[0].total_patterns);
    console.log('  With embeddings:', status.rows[0].with_embeddings);
    console.log('  Semantic search enabled:', status.rows[0].semantic_enabled);
    
    // 2. Check some patterns
    const samplePatterns = await db.query(`
      SELECT 
        id,
        trigger_text,
        pattern_type,
        embedding IS NOT NULL as has_embedding,
        semantic_search_enabled
      FROM decision_patterns
      ORDER BY id DESC
      LIMIT 5
    `);
    
    console.log('\n📝 Sample Patterns:');
    for (const pattern of samplePatterns.rows) {
      console.log(`  - ID ${pattern.id}: "${pattern.trigger_text?.substring(0, 50)}..."`);
      console.log(`    Type: ${pattern.pattern_type}`);
      console.log(`    Has embedding: ${pattern.has_embedding ? '✅' : '❌'}`);
      console.log(`    Semantic search: ${pattern.semantic_search_enabled ? '✅' : '❌'}`);
    }
    
    // 3. Test semantic search capability
    const semanticTest = await db.query(`
      SELECT COUNT(*) as searchable_patterns
      FROM decision_patterns
      WHERE embedding IS NOT NULL
        AND is_active = TRUE
        AND semantic_search_enabled = TRUE
    `);
    
    console.log('\n🔍 Semantic Search Capability:');
    console.log('  Searchable patterns:', semanticTest.rows[0].searchable_patterns);
    
    if (semanticTest.rows[0].searchable_patterns > 0) {
      console.log('  ✅ AI can recall patterns using semantic search');
    } else {
      console.log('  ❌ No patterns available for semantic search');
      console.log('  💡 Run: npm run generate-embeddings');
    }
    
    // 4. Check for patterns without embeddings
    const missingEmbeddings = await db.query(`
      SELECT COUNT(*) as count
      FROM decision_patterns
      WHERE embedding IS NULL
        AND is_active = TRUE
    `);
    
    if (missingEmbeddings.rows[0].count > 0) {
      console.log(`\n⚠️  ${missingEmbeddings.rows[0].count} active patterns are missing embeddings`);
      console.log('  These patterns will only work with keyword matching');
    }
    
    console.log('\n✨ Test complete!\n');
    
  } catch (error) {
    logger.error('Test failed:', error);
  } finally {
    await db.end();
  }
}

testPatternRecall();