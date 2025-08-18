/**
 * Test script to verify local knowledge is being used instead of OpenAI
 * Run with: DATABASE_URL="postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway" npx tsx test-local-knowledge.ts
 */

// Set environment variable for database connection
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway";

import { assistantService } from './src/services/assistantService';
import { knowledgeSearchService } from './src/services/knowledgeSearchService';
import { logger } from './src/utils/logger';
import { db } from './src/utils/database';

// Test queries that should match our SOP knowledge
const testQueries = [
  "Do you offer gift cards?",
  "What are your hours?",
  "How much does membership cost?",
  "Can I book a simulator?",
  "What's your refund policy?",
  "Do you have tournaments?",
  "What equipment do you use?",
  "Do you offer lessons?"
];

async function testLocalKnowledge() {
  console.log('\n🧪 Testing Local Knowledge Usage\n');
  console.log('================================\n');

  // Initialize database connection
  await db.initialize();

  for (const query of testQueries) {
    console.log(`\n📝 Testing: "${query}"`);
    console.log('-'.repeat(50));

    try {
      // First, search knowledge directly to see what's available
      const searchResults = await knowledgeSearchService.searchKnowledge(query, undefined, 3);
      
      if (searchResults.length > 0) {
        console.log(`✅ Found ${searchResults.length} knowledge results`);
        const topResult = searchResults[0];
        const combinedScore = topResult.confidence * topResult.relevance;
        
        console.log(`   Top result: ${topResult.key}`);
        console.log(`   Confidence: ${topResult.confidence.toFixed(2)}`);
        console.log(`   Relevance: ${topResult.relevance.toFixed(2)}`);
        console.log(`   Combined Score: ${combinedScore.toFixed(2)}`);
        console.log(`   Will use local? ${combinedScore >= 0.15 ? 'YES ✅' : 'NO ❌ (will call OpenAI)'}`);
      } else {
        console.log(`❌ No knowledge found - will use OpenAI`);
      }

      // Now test the assistant service to see what it actually does
      console.log('\n   Testing assistant response...');
      const response = await assistantService.getAssistantResponse(
        'Booking & Access',
        query,
        { isCustomerFacing: true }
      );

      // Check if response used local knowledge
      if (response.assistantId?.includes('LOCAL-KNOWLEDGE')) {
        console.log(`   🎯 USED LOCAL DATABASE! Saved an OpenAI API call!`);
        console.log(`   Response preview: ${response.response.substring(0, 100)}...`);
      } else if (response.metadata?.dataSource === 'LOCAL_DATABASE') {
        console.log(`   🎯 USED LOCAL DATABASE! Saved an OpenAI API call!`);
        console.log(`   Response preview: ${response.response.substring(0, 100)}...`);
      } else {
        console.log(`   ⚠️ Used OpenAI API (local knowledge not sufficient)`);
        console.log(`   Assistant ID: ${response.assistantId}`);
      }

    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Get statistics
  console.log('\n\n📊 Knowledge Database Statistics\n');
  console.log('================================\n');

  try {
    const stats = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM knowledge_store WHERE superseded_by IS NULL) as knowledge_store_count,
        (SELECT COUNT(*) FROM sop_embeddings) as sop_embeddings_count,
        (SELECT COUNT(*) FROM knowledge_patterns) as patterns_count,
        (SELECT COUNT(*) FROM knowledge_audit_log) as audit_count
    `);

    const row = stats.rows[0];
    console.log(`Knowledge Store Items: ${row.knowledge_store_count}`);
    console.log(`SOP Embeddings: ${row.sop_embeddings_count}`);
    console.log(`Knowledge Patterns: ${row.patterns_count}`);
    console.log(`Audit Logs: ${row.audit_count}`);
    console.log(`\nTotal Knowledge Items: ${row.knowledge_store_count + row.sop_embeddings_count}`);

  } catch (error) {
    console.error('Could not get statistics:', error);
  }

  console.log('\n✅ Test complete!\n');
  process.exit(0);
}

// Run the test
testLocalKnowledge().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});