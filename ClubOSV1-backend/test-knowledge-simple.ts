/**
 * Simple test to verify local knowledge is being used
 */

process.env.DATABASE_URL = "postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway";

import { knowledgeSearchService } from './src/services/knowledgeSearchService';
import { db } from './src/utils/database';

async function test() {
  console.log('Testing knowledge search...\n');
  
  // Initialize database
  await db.initialize();
  
  // Test query
  const query = "Do you offer gift cards?";
  console.log(`Query: "${query}"\n`);
  
  // Search knowledge
  const results = await knowledgeSearchService.searchKnowledge(query, undefined, 5);
  
  if (results.length > 0) {
    console.log(`Found ${results.length} results:\n`);
    
    results.forEach((result, index) => {
      const score = result.confidence * result.relevance;
      console.log(`Result ${index + 1}:`);
      console.log(`  Key: ${result.key}`);
      console.log(`  Confidence: ${result.confidence.toFixed(3)}`);
      console.log(`  Relevance: ${result.relevance.toFixed(3)}`);
      console.log(`  Combined Score: ${score.toFixed(3)}`);
      console.log(`  Will use local (>0.15)? ${score >= 0.15 ? '✅ YES' : '❌ NO'}`);
      console.log(`  Content preview: ${JSON.stringify(result.value).substring(0, 100)}...`);
      console.log();
    });
    
    // Check what threshold would be needed
    const topScore = results[0].confidence * results[0].relevance;
    if (topScore < 0.15) {
      console.log(`⚠️ Top result score (${topScore.toFixed(3)}) is below threshold (0.15)`);
      console.log(`   This query would still use OpenAI instead of local knowledge`);
    } else {
      console.log(`✅ Top result score (${topScore.toFixed(3)}) exceeds threshold (0.15)`);
      console.log(`   This query will use LOCAL KNOWLEDGE instead of OpenAI!`);
    }
  } else {
    console.log('❌ No results found - would use OpenAI');
  }
  
  // Check SOP embeddings directly
  console.log('\n\nChecking SOP embeddings directly...\n');
  const sopQuery = await db.query(`
    SELECT COUNT(*) as count 
    FROM sop_embeddings 
    WHERE content ILIKE '%gift%card%'
  `);
  
  console.log(`SOPs mentioning "gift card": ${sopQuery.rows[0].count}`);
  
  if (sopQuery.rows[0].count > 0) {
    const samples = await db.query(`
      SELECT title, content 
      FROM sop_embeddings 
      WHERE content ILIKE '%gift%card%'
      LIMIT 3
    `);
    
    console.log('\nSample SOPs:');
    samples.rows.forEach((row: any) => {
      console.log(`\n- ${row.title}`);
      console.log(`  ${row.content.substring(0, 150)}...`);
    });
  }
  
  process.exit(0);
}

test().catch(console.error);