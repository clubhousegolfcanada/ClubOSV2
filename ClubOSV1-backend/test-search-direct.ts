/**
 * Direct test of knowledge search to see what's actually happening
 */

// Set environment variables
process.env.DATABASE_URL = "postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway";
process.env.NODE_ENV = 'development';

import { knowledgeSearchService } from './src/services/knowledgeSearchService';
import { db } from './src/utils/database';

async function test() {
  console.log('🔍 Testing Knowledge Search Service Directly\n');
  console.log('=' .repeat(50) + '\n');
  
  try {
    // Initialize database
    await db.initialize();
    console.log('✅ Database initialized\n');
    
    // Test queries
    const queries = [
      "Do you offer gift cards?",
      "gift cards",
      "gift",
      "cards"
    ];
    
    for (const query of queries) {
      console.log(`\nTesting query: "${query}"`);
      console.log('-'.repeat(40));
      
      // Call the actual search service
      const results = await knowledgeSearchService.searchKnowledge(query, undefined, 5);
      
      if (results.length > 0) {
        console.log(`Found ${results.length} results:`);
        results.forEach((result, index) => {
          const score = result.confidence * result.relevance;
          console.log(`\n  Result ${index + 1}:`);
          console.log(`    Key: ${result.key}`);
          console.log(`    Source: ${result.source}`);
          console.log(`    Confidence: ${result.confidence}`);
          console.log(`    Relevance: ${result.relevance}`);
          console.log(`    Combined Score: ${score.toFixed(4)}`);
          console.log(`    Passes 0.15 threshold? ${score >= 0.15 ? '✅ YES' : '❌ NO'}`);
          
          // Show value preview
          const valueStr = typeof result.value === 'string' 
            ? result.value 
            : (result.value.answer || result.value.content || JSON.stringify(result.value));
          console.log(`    Value: ${valueStr.substring(0, 100)}...`);
        });
      } else {
        console.log('  ❌ No results found');
      }
    }
    
    // Now test what the assistant service would do
    console.log('\n\n' + '='.repeat(50));
    console.log('Testing Assistant Service Integration\n');
    
    const { assistantService } = await import('./src/services/assistantService');
    
    const testQuery = "Do you offer gift cards?";
    console.log(`Query: "${testQuery}"\n`);
    
    const response = await assistantService.getAssistantResponse(
      'Booking & Access',
      testQuery,
      { isCustomerFacing: true }
    );
    
    console.log('Response metadata:');
    console.log(`  Assistant ID: ${response.assistantId}`);
    console.log(`  Confidence: ${response.confidence}`);
    console.log(`  Thread ID: ${response.threadId}`);
    
    if (response.structured) {
      console.log(`  Source: ${response.structured.source || 'Unknown'}`);
      console.log(`  OpenAI Used: ${response.structured.openAiUsed === false ? 'NO ✅' : 'YES ⚠️'}`);
    }
    
    if (response.metadata) {
      console.log(`  Data Source: ${response.metadata.dataSource || 'Unknown'}`);
      console.log(`  API Calls Used: ${response.metadata.apiCallsUsed}`);
    }
    
    console.log(`\nResponse (first 200 chars):`);
    console.log(response.response.substring(0, 200) + '...');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

test().catch(console.error);