import axios from 'axios';
import dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

const API_BASE_URL = process.env.PRODUCTION_API_URL || 'https://clubosv2-production.up.railway.app';
const API_KEY = process.env.API_KEY || '';

async function debugProductionSearch() {
  console.log('=== DEBUGGING PRODUCTION KNOWLEDGE SEARCH ===\n');
  
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  };
  
  try {
    // 1. Test if the API is accessible
    console.log('1. Testing API connectivity...');
    try {
      const healthCheck = await axios.get(`${API_BASE_URL}/health`, { headers });
      console.log('   ✓ API is accessible');
    } catch (err: any) {
      console.log('   ✗ API health check failed:', err.response?.status || err.message);
    }
    
    // 2. Check document distribution
    console.log('\n2. Checking document distribution...');
    try {
      const distribution = await axios.get(`${API_BASE_URL}/api/knowledge-debug/document-distribution`, { headers });
      console.log('   Total documents:', distribution.data.data.totalDocuments);
      console.log('   By category:');
      distribution.data.data.categoryDistribution.forEach((cat: any) => {
        console.log(`     - ${cat.category}: ${cat.count}`);
      });
      
      // Check for specific terms
      const terms = ['7iron', 'fan', 'bettergolf', 'nick'];
      console.log('\n   Term distribution:');
      for (const term of terms) {
        const termData = distribution.data.data.termDistribution[term];
        if (termData && termData.length > 0) {
          console.log(`     - "${term}": found in ${termData.reduce((sum: number, t: any) => sum + t.count, 0)} documents`);
          termData.forEach((t: any) => console.log(`       ${t.category}: ${t.count}`));
        } else {
          console.log(`     - "${term}": NOT FOUND`);
        }
      }
    } catch (err: any) {
      console.log('   ✗ Document distribution check failed:', err.response?.data || err.message);
    }
    
    // 3. Test semantic search
    console.log('\n3. Testing semantic search...');
    const testQueries = ['What is 7iron?', 'Tell me about fan', 'bettergolf tips'];
    
    for (const query of testQueries) {
      console.log(`\n   Query: "${query}"`);
      try {
        const searchResult = await axios.post(`${API_BASE_URL}/api/knowledge-debug/semantic-search`, 
          { query }, 
          { headers }
        );
        
        const data = searchResult.data.data;
        console.log(`     Semantic results: ${data.semanticSearch.resultsFound}`);
        console.log(`     Keyword results: ${data.keywordSearch.resultsFound}`);
        
        if (data.semanticSearch.resultsFound > 0) {
          console.log('     Top semantic result:');
          const top = data.semanticSearch.results[0];
          console.log(`       Problem: ${top.problem.substring(0, 50)}...`);
          console.log(`       Relevance: ${top.relevance}`);
          console.log(`       Reasoning: ${top.reasoning}`);
        }
        
        if (data.generatedAnswer) {
          console.log(`     Generated answer: ${data.generatedAnswer.substring(0, 100)}...`);
        }
      } catch (err: any) {
        console.log(`     ✗ Semantic search failed:`, err.response?.data || err.message);
      }
    }
    
    // 4. Test direct search
    console.log('\n4. Testing direct database search...');
    try {
      const directSearch = await axios.post(`${API_BASE_URL}/api/knowledge-debug/direct-search`,
        { query: '7iron', category: 'brand' },
        { headers }
      );
      
      const data = directSearch.data.data;
      console.log(`   Direct DB results: ${data.directDatabaseResults.count}`);
      console.log(`   Unified search results: ${data.unifiedSearchResults.count}`);
      console.log(`   Total in brand category: ${data.categoryStats.totalInCategory}`);
      
      if (data.directDatabaseResults.count > 0) {
        console.log('\n   Sample result:');
        const sample = data.directDatabaseResults.results[0];
        console.log(`     Problem: ${sample.problem.substring(0, 50)}...`);
        console.log(`     Solution: ${sample.solution.substring(0, 50)}...`);
      }
    } catch (err: any) {
      console.log('   ✗ Direct search failed:', err.response?.data || err.message);
    }
    
    // 5. Test the main assistant endpoint
    console.log('\n5. Testing main assistant endpoint...');
    try {
      const assistantResponse = await axios.post(`${API_BASE_URL}/api/assistant/response`,
        {
          route: 'BrandTone',
          description: 'What is 7iron?'
        },
        { headers }
      );
      
      console.log(`   Response received: ${!!assistantResponse.data.response}`);
      console.log(`   Confidence: ${assistantResponse.data.confidence || 'N/A'}`);
      console.log(`   Source: ${assistantResponse.data.source || 'N/A'}`);
      
      if (assistantResponse.data.response) {
        console.log(`   Response preview: ${assistantResponse.data.response.substring(0, 100)}...`);
      } else {
        console.log('   ✗ No response generated');
      }
    } catch (err: any) {
      console.log('   ✗ Assistant endpoint failed:', err.response?.data || err.message);
    }
    
    // 6. Check configuration
    console.log('\n6. Checking configuration...');
    try {
      const diagnosis = await axios.post(`${API_BASE_URL}/api/knowledge-debug/diagnose`,
        { query: 'What is 7iron?' },
        { headers }
      );
      
      const diag = diagnosis.data.diagnosis;
      console.log('   Environment:');
      console.log(`     USE_INTELLIGENT_SOP: ${diag.environment.USE_INTELLIGENT_SOP}`);
      console.log(`     SOP_SHADOW_MODE: ${diag.environment.SOP_SHADOW_MODE}`);
      console.log(`     SOP_CONFIDENCE_THRESHOLD: ${diag.environment.SOP_CONFIDENCE_THRESHOLD}`);
      
      console.log('\n   Category searches:');
      for (const [cat, data] of Object.entries(diag.categorySearches)) {
        console.log(`     ${cat}: ${(data as any).matches} matches`);
      }
      
      console.log(`\n   Unified search found: ${diag.unifiedSearch.resultsFound} results`);
      
      if (diag.recommendations && diag.recommendations.length > 0) {
        console.log('\n   Recommendations:');
        diag.recommendations.forEach((r: string) => console.log(`     - ${r}`));
      }
    } catch (err: any) {
      console.log('   ✗ Diagnosis failed:', err.response?.data || err.message);
    }
    
  } catch (error) {
    console.error('\nUnexpected error:', error);
  }
}

// Run the debug script
console.log('Note: Make sure you have set PRODUCTION_API_URL and API_KEY in your .env file\n');
debugProductionSearch().catch(console.error);