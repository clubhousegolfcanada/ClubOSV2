const { knowledgeSearchService } = require('./dist/services/knowledgeSearchService');
const { db } = require('./dist/utils/database');

async function testSearch() {
  await db.initialize();
  
  console.log('\n=== Testing Knowledge Search for "gift cards" ===\n');
  
  // Test the search that the assistant would do
  const results = await knowledgeSearchService.searchKnowledge(
    'do we sell giftcards?',
    'brandtone',
    5
  );
  
  console.log(`Found ${results.length} results:\n`);
  
  results.forEach((result, index) => {
    console.log(`Result ${index + 1}:`);
    console.log(`  Source: ${result.source}`);
    console.log(`  Key: ${result.key}`);
    console.log(`  Confidence: ${result.confidence}`);
    console.log(`  Relevance: ${result.relevance}`);
    console.log(`  Combined Score: ${result.confidence * result.relevance}`);
    console.log(`  Content: ${JSON.stringify(result.value).substring(0, 200)}...`);
    console.log('');
  });
  
  // Check what the threshold is
  if (results.length > 0) {
    const topScore = results[0].confidence * results[0].relevance;
    console.log(`Top result combined score: ${topScore}`);
    console.log(`Threshold needed: 0.6`);
    console.log(`Would use local knowledge: ${topScore > 0.6 ? 'YES' : 'NO'}`);
  }
  
  process.exit(0);
}

testSearch().catch(console.error);