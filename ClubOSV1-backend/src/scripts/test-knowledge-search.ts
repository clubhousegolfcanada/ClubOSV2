import { knowledgeLoader } from '../knowledge-base/knowledgeLoader';
import { db } from '../utils/database';
import { logger } from '../utils/logger';

async function testKnowledgeSearch() {
  console.log('Testing knowledge search functionality...\n');

  try {
    // Initialize database
    await knowledgeLoader.initializeDB();
    
    // Test 1: Check extracted knowledge count
    const ekCount = await db.query('SELECT COUNT(*) as count FROM extracted_knowledge');
    console.log(`Extracted knowledge entries: ${ekCount.rows[0].count}`);
    
    // Test 2: Sample some extracted knowledge
    const samples = await db.query('SELECT category, problem, solution, confidence FROM extracted_knowledge LIMIT 5');
    console.log('\nSample extracted knowledge:');
    samples.rows.forEach((row: any, i: number) => {
      console.log(`${i + 1}. [${row.category}] ${row.problem} -> ${row.solution} (confidence: ${row.confidence})`);
    });
    
    // Test 3: Search for a common term
    const searchTerms = ['trackman', 'frozen', 'door', 'booking', 'help'];
    
    for (const term of searchTerms) {
      console.log(`\nSearching for "${term}":`);
      
      // Test async search
      const asyncResults = await knowledgeLoader.searchKnowledgeDB(term);
      console.log(`  - Async DB search: ${asyncResults.length} results`);
      if (asyncResults.length > 0) {
        console.log(`    First result: ${asyncResults[0].issue}`);
      }
      
      // Test sync search (used by LocalProvider)
      const syncResults = knowledgeLoader.searchKnowledge(term);
      console.log(`  - Sync search: ${syncResults.length} results`);
      
      // Test findSolution
      const solutions = await knowledgeLoader.findSolution([term]);
      console.log(`  - Find solution: ${solutions.length} results`);
    }
    
    // Test 4: Check category mapping
    const categories = await db.query('SELECT DISTINCT category, COUNT(*) as count FROM extracted_knowledge GROUP BY category');
    console.log('\nKnowledge by category:');
    categories.rows.forEach((row: any) => {
      console.log(`  - ${row.category}: ${row.count} entries`);
    });
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await db.end();
  }
}

// Run the test
testKnowledgeSearch().catch(console.error);