import { db } from '../utils/database';
import { semanticSearch } from '../services/semanticSearch';
import { intelligentSOPModule } from '../services/intelligentSOPModule';
import { knowledgeLoader } from '../knowledge-base/knowledgeLoader';

async function quickTest() {
  console.log('=== QUICK KNOWLEDGE SEARCH TEST ===\n');
  
  try {
    // 1. Check if we have data
    const count = await db.query('SELECT COUNT(*) as count FROM extracted_knowledge');
    console.log(`Total documents in DB: ${count.rows[0].count}`);
    
    const brandCount = await db.query(`
      SELECT COUNT(*) as count 
      FROM extracted_knowledge 
      WHERE category = 'brand' 
      AND (problem ILIKE '%7iron%' OR solution ILIKE '%7iron%')
    `);
    console.log(`Documents with '7iron' in brand category: ${brandCount.rows[0].count}`);
    
    // 2. Test direct DB search
    const directSearch = await db.query(`
      SELECT id, problem, solution, category, confidence 
      FROM extracted_knowledge 
      WHERE problem ILIKE '%7iron%' OR solution ILIKE '%7iron%'
      LIMIT 3
    `);
    console.log(`\nDirect DB search for '7iron': ${directSearch.rows.length} results`);
    if (directSearch.rows.length > 0) {
      console.log('Sample:', directSearch.rows[0].problem.substring(0, 60) + '...');
    }
    
    // 3. Test semantic search
    console.log('\n--- Testing Semantic Search ---');
    console.log('OpenAI configured:', !!process.env.OPENAI_API_KEY);
    
    const semanticResults = await semanticSearch.searchKnowledge('What is 7iron?', {
      limit: 5,
      includeAllCategories: true
    });
    
    console.log(`Semantic search results: ${semanticResults.length}`);
    if (semanticResults.length > 0) {
      console.log('Top result:', {
        problem: semanticResults[0].problem.substring(0, 50) + '...',
        relevance: semanticResults[0].relevance,
        category: semanticResults[0].category
      });
    }
    
    // 4. Test knowledge loader
    console.log('\n--- Testing Knowledge Loader ---');
    await knowledgeLoader.initializeDB();
    
    const unifiedResults = await knowledgeLoader.unifiedSearch('7iron', {
      includeExtracted: true,
      includeStatic: true,
      includeSOPEmbeddings: false
    });
    
    console.log(`Unified search results: ${unifiedResults.length}`);
    if (unifiedResults.length > 0) {
      console.log('Top result:', {
        issue: unifiedResults[0].issue.substring(0, 50) + '...',
        source: unifiedResults[0].source,
        category: unifiedResults[0].category
      });
    }
    
    // 5. Test SOP module
    console.log('\n--- Testing SOP Module ---');
    console.log('SOP enabled:', process.env.USE_INTELLIGENT_SOP);
    console.log('SOP shadow mode:', process.env.SOP_SHADOW_MODE);
    
    if (process.env.USE_INTELLIGENT_SOP === 'true') {
      const sopDocs = await intelligentSOPModule.findRelevantContext('What is 7iron?', 'BrandTone');
      console.log(`SOP documents found: ${sopDocs.length}`);
      
      const sopResponse = await intelligentSOPModule.processWithContext('What is 7iron?', 'BrandTone');
      console.log('SOP response:', {
        hasResponse: !!sopResponse.response,
        confidence: sopResponse.confidence,
        source: sopResponse.source
      });
    }
    
    // 6. Check all categories
    console.log('\n--- Documents by Category ---');
    const categories = await db.query(`
      SELECT category, COUNT(*) as count 
      FROM extracted_knowledge 
      GROUP BY category 
      ORDER BY count DESC
    `);
    categories.rows.forEach((row: any) => {
      console.log(`${row.category}: ${row.count}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.end();
  }
}

quickTest().catch(console.error);