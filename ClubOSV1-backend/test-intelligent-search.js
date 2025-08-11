const { IntelligentSearchService } = require('./dist/services/intelligentSearchService');

console.log('=== Testing Intelligent Context-Aware Search ===\n');

const service = new IntelligentSearchService();

// Test different ways people might ask about gift cards
const giftCardQueries = [
  // Customer variations
  "Do you sell gift cards?",
  "Can I buy a gift certificate?",
  "Where can I get a voucher?",
  "I want to purchase a present card for my friend",
  "How much are gift vouchers?",
  "Gift card availability?",
  
  // Employee variations
  "Customer asking about giftcards",
  "Process for selling gift certificates",
  "Gift card purchase procedure",
  
  // Typos and variations
  "giftcard",
  "gift-card",
  "Do u have gift cards",
  "clubhouse giftcards?",
];

console.log('Testing various phrasings for gift cards:\n');

giftCardQueries.forEach((query, index) => {
  console.log(`\n${index + 1}. Query: "${query}"`);
  
  const result = service.intelligentSearch(query);
  
  console.log(`   Detected intents: ${result.intents.join(', ') || 'none'}`);
  console.log(`   Key search terms: ${result.searchTerms.join(', ')}`);
  console.log(`   Expanded variations: ${result.expandedQueries.slice(0, 5).join(', ')}...`);
  console.log(`   Priority: ${result.priority}`);
  
  // Test semantic similarity with actual gift card content
  const giftCardContent = "Gift cards available at www.clubhouse247golf.com/giftcard/purchase";
  const similarity = service.calculateSemanticSimilarity(query, giftCardContent);
  console.log(`   Semantic similarity: ${(similarity * 100).toFixed(1)}%`);
  console.log(`   Would match: ${similarity > 0.3 ? 'YES ✓' : 'NO ✗'}`);
});

// Test other common queries
console.log('\n\n=== Testing Other Common Queries ===\n');

const otherQueries = [
  { query: "My simulator is broken", role: "employee" },
  { query: "How do I book a bay?", role: "customer" },
  { query: "What's your cancellation policy?", role: "customer" },
  { query: "Trackman not working", role: "employee" },
  { query: "Opening hours today?", role: "customer" },
];

otherQueries.forEach(({ query, role }) => {
  console.log(`\nQuery: "${query}" (${role})`);
  
  const result = service.intelligentSearch(query, role);
  
  console.log(`   Intents: ${result.intents.join(', ')}`);
  console.log(`   Priority: ${result.priority}`);
  console.log(`   Key terms: ${result.searchTerms.join(', ')}`);
});

// Show synonym expansion
console.log('\n\n=== Synonym Expansion Examples ===\n');

const expansionExamples = [
  "broken simulator",
  "book appointment",
  "membership discount",
  "parking location"
];

expansionExamples.forEach(query => {
  const expanded = service.expandQuery(query);
  console.log(`\n"${query}" expands to:`);
  console.log(`   ${expanded.slice(0, 8).join(', ')}${expanded.length > 8 ? '...' : ''}`);
  console.log(`   (${expanded.length} total variations)`);
});