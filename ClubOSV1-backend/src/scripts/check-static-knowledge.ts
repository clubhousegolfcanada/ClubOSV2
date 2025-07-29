import { db } from '../utils/database';
import { knowledgeLoader } from '../knowledge-base/knowledgeLoader';
import { logger } from '../utils/logger';

async function checkStaticKnowledge() {
  console.log('Checking static knowledge base status...\n');

  try {
    // Check knowledge_base table
    const kbCount = await db.query('SELECT COUNT(*) as count FROM knowledge_base').catch(() => ({ rows: [{ count: 0 }] }));
    console.log(`Static knowledge_base table: ${kbCount.rows[0].count} entries\n`);
    
    // Check JSON files loaded
    const allBases = knowledgeLoader.getAllKnowledgeBases();
    console.log('Loaded JSON knowledge bases:');
    for (const [name, kb] of allBases) {
      let totalItems = 0;
      if (kb.categories) {
        kb.categories.forEach((cat: any) => {
          totalItems += (cat.items || []).length;
        });
      }
      console.log(`  ${name}: ${totalItems} items`);
    }
    
    // Sample from knowledge_base table if any exist
    if (kbCount.rows[0].count > 0) {
      const samples = await db.query('SELECT category, issue, priority FROM knowledge_base LIMIT 5');
      console.log('\nSample entries from knowledge_base table:');
      samples.rows.forEach((row: any, i: number) => {
        console.log(`  ${i + 1}. [${row.category}] ${row.issue} (${row.priority})`);
      });
    }
    
  } catch (error) {
    console.error('Error checking static knowledge:', error);
  } finally {
    await db.end();
  }
}

// Run the check
checkStaticKnowledge().catch(console.error);