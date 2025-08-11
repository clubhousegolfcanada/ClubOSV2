console.log('=== Testing Improved Search Logic ===\n');

const query = "does clubhouse offer giftcards? gift cards?";
console.log(`Original query: "${query}"\n`);

// Stop words to filter out
const stopWords = new Set(['does', 'do', 'is', 'are', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'we', 'you', 'your', 'them', 'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', 'offer', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'would', 'could', 'ought', 'may', 'might', 'must', 'shall', 'should', 'would', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);
const businessStopWords = new Set(['clubhouse', 'club', 'house', 'golf', 'simulator']);

// OLD METHOD
const oldSearchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
console.log('OLD METHOD:');
console.log('Search terms:', oldSearchTerms);
console.log('Term count:', oldSearchTerms.length);

// Test with gift card content
const giftCardContent = "Gift cards available at www.clubhouse247golf.com/giftcard/purchase".toLowerCase();
const oldMatchCount = oldSearchTerms.filter(term => giftCardContent.includes(term)).length;
const oldRelevance = oldMatchCount / oldSearchTerms.length;

console.log('Matching terms:', oldMatchCount);
console.log('Relevance:', oldRelevance);
console.log('With confidence 0.8:', 0.8 * oldRelevance);
console.log('Passes threshold (0.5)?', 0.8 * oldRelevance > 0.5 ? 'NO - REJECTED' : 'YES');

// NEW METHOD
const newSearchTerms = query.toLowerCase()
  .replace(/[?!.,;:]/g, '') // Remove punctuation
  .split(' ')
  .filter(term => term.length > 2 && !stopWords.has(term) && !businessStopWords.has(term));

console.log('\nNEW METHOD:');
console.log('Search terms:', newSearchTerms);
console.log('Term count:', newSearchTerms.length);

const newMatchCount = newSearchTerms.filter(term => giftCardContent.includes(term)).length;
const newRelevance = newSearchTerms.length > 0 ? newMatchCount / newSearchTerms.length : 0.5;

console.log('Matching terms:', newMatchCount);
console.log('Relevance:', newRelevance);
console.log('With confidence 0.8:', 0.8 * newRelevance);
console.log('Passes threshold (0.5)?', 0.8 * newRelevance > 0.5 ? 'YES - ACCEPTED' : 'NO');

console.log('\n=== Summary ===');
console.log('Old combined score:', (0.8 * oldRelevance).toFixed(3));
console.log('New combined score:', (0.8 * newRelevance).toFixed(3));
console.log('Improvement:', ((0.8 * newRelevance) - (0.8 * oldRelevance)).toFixed(3));