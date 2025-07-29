import { db } from '../utils/database';
import { knowledgeLoader } from '../knowledge-base/knowledgeLoader';
import { intelligentSOPModule } from '../services/intelligentSOPModule';
import { assistantService } from '../services/assistantService';
import { logger } from '../utils/logger';

async function testCompleteKnowledgeFlow() {
  console.log('=== Testing Complete Knowledge Flow ===\n');
  
  const testQueries = ['What is 7iron?', 'Tell me about fan', 'bettergolf information'];
  
  try {
    // 1. First verify data exists
    console.log('1. VERIFYING DATA EXISTS IN DATABASE:');
    const totalCount = await db.query('SELECT COUNT(*) FROM extracted_knowledge');
    console.log(`   Total extracted knowledge entries: ${totalCount.rows[0].count}`);
    
    const brandCount = await db.query(`SELECT COUNT(*) FROM extracted_knowledge WHERE category = 'brand'`);
    console.log(`   Brand category entries: ${brandCount.rows[0].count}`);
    
    // 2. Test each query
    for (const query of testQueries) {
      console.log(`\n2. TESTING QUERY: "${query}"`);
      
      // Direct DB search
      const dbResult = await db.query(`
        SELECT problem, solution, category, confidence 
        FROM extracted_knowledge 
        WHERE problem ILIKE $1 OR solution ILIKE $1
        LIMIT 5
      `, [`%${query.split(' ').pop()}%`]);
      
      console.log(`   Direct DB matches: ${dbResult.rows.length}`);
      if (dbResult.rows.length > 0) {
        console.log(`   Sample: ${dbResult.rows[0].problem.substring(0, 50)}...`);
      }
      
      // Test knowledgeLoader
      console.log('\n   Testing KnowledgeLoader:');
      await knowledgeLoader.initializeDB();
      const unifiedResults = await knowledgeLoader.unifiedSearch(query, {
        includeExtracted: true,
        includeStatic: true,
        includeSOPEmbeddings: true
      });
      console.log(`   Unified search found: ${unifiedResults.length} results`);
      if (unifiedResults.length > 0) {
        console.log(`   Top result: ${unifiedResults[0].issue} (${unifiedResults[0].source})`);
      }
      
      // Test SOP module
      console.log('\n   Testing SOP Module:');
      const sopEnabled = process.env.USE_INTELLIGENT_SOP === 'true';
      console.log(`   SOP Module enabled: ${sopEnabled}`);
      
      if (sopEnabled) {
        const sopDocs = await intelligentSOPModule.findRelevantContext(query, 'BrandTone');
        console.log(`   SOP found ${sopDocs.length} documents`);
        
        const sopResponse = await intelligentSOPModule.processWithContext(query, 'BrandTone');
        console.log(`   SOP response confidence: ${sopResponse.confidence}`);
        console.log(`   SOP response source: ${sopResponse.source}`);
        if (sopResponse.response) {
          console.log(`   Response preview: ${sopResponse.response.substring(0, 100)}...`);
        }
      }
      
      // Test assistant service
      console.log('\n   Testing Assistant Service:');
      try {
        const assistantResponse = await assistantService.getAssistantResponse('BrandTone', query);
        console.log(`   Assistant response received: ${!!assistantResponse.response}`);
        if (assistantResponse.response) {
          console.log(`   Response preview: ${assistantResponse.response.substring(0, 100)}...`);
        }
      } catch (err) {
        console.log(`   Assistant error: ${err}`);
      }
    }
    
    // 3. Check configuration
    console.log('\n3. CONFIGURATION CHECK:');
    console.log(`   USE_INTELLIGENT_SOP: ${process.env.USE_INTELLIGENT_SOP}`);
    console.log(`   SOP_SHADOW_MODE: ${process.env.SOP_SHADOW_MODE}`);
    console.log(`   OPENAI_API_KEY exists: ${!!process.env.OPENAI_API_KEY}`);
    
    // 4. Test simple category search
    console.log('\n4. SIMPLE CATEGORY SEARCH TEST:');
    const categories = ['brand', 'tech', 'booking', 'emergency', 'general'];
    for (const cat of categories) {
      const catResult = await db.query(`
        SELECT COUNT(*) as count FROM extracted_knowledge WHERE category = $1
      `, [cat]);
      console.log(`   ${cat}: ${catResult.rows[0].count} entries`);
    }
    
  } catch (error) {
    console.error('\nError during test:', error);
  } finally {
    await db.end();
  }
}

// Run the test
testCompleteKnowledgeFlow().catch(console.error);