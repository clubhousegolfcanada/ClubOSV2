const { knowledgeSearchService } = require('./ClubOSV1-backend/dist/services/knowledgeSearchService.js');

async function test() {
  console.log('Testing local knowledge search for gift cards...\n');
  
  // Search for gift card knowledge
  const results = await knowledgeSearchService.search('gift cards', 'BrandTone');
  console.log('BrandTone search results:', JSON.stringify(results, null, 2));
  
  // Also try with 'booking' route
  const bookingResults = await knowledgeSearchService.search('gift cards', 'booking');
  console.log('\nBooking route results:', JSON.stringify(bookingResults, null, 2));
  
  // Try a more general search
  const generalResults = await knowledgeSearchService.search('gift cards');
  console.log('\nGeneral search results:', JSON.stringify(generalResults, null, 2));
  
  // Check what keys exist
  console.log('\nChecking all stored keys...');
  const db = require('./ClubOSV1-backend/dist/database/index.js').default;
  const allKeys = await db.query('SELECT DISTINCT key, source, confidence FROM knowledge_store ORDER BY confidence DESC LIMIT 20');
  console.log('Top knowledge keys:', allKeys.rows);
  
  process.exit(0);
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});