// Run this in the browser console after logging in

async function testKnowledge() {
  const token = localStorage.getItem('token');
  const baseUrl = 'https://clubosv2-production.up.railway.app';
  
  console.log('=== Testing Knowledge Search ===');
  
  // 1. Check system configuration
  const systemCheck = await fetch(`${baseUrl}/api/system/check`, {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.json());
  
  console.log('1. System Configuration:');
  console.log('   OpenAI Configured:', systemCheck.checks?.configuration?.openaiConfigured);
  console.log('   Documents in DB:', systemCheck.checks?.data?.extractedKnowledgeCount);
  console.log('   Brand Category:', systemCheck.checks?.data?.brandCategoryCount);
  console.log('   7iron Documents:', systemCheck.checks?.data?.sevenIronCount);
  
  // 2. Test semantic search
  const searchTest = await fetch(`${baseUrl}/api/system/test-search`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: '7iron' })
  }).then(r => r.json());
  
  console.log('\n2. Search Results:');
  console.log('   Direct DB:', searchTest.results?.directDatabase?.count);
  console.log('   Semantic:', searchTest.results?.semanticSearch);
  
  // 3. Document distribution
  const distribution = await fetch(`${baseUrl}/api/knowledge-debug/document-distribution`, {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.json());
  
  console.log('\n3. Document Distribution:');
  console.log('   Total:', distribution.data?.totalDocuments);
  console.log('   Categories:', distribution.data?.categoryDistribution);
  
  return { systemCheck, searchTest, distribution };
}

// Run the test
testKnowledge().then(console.log).catch(console.error);