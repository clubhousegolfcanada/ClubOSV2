import { db } from '../utils/database';
import { logger } from '../utils/logger';

async function verifyExtractedKnowledge() {
  console.log('=== Verifying Extracted Knowledge Database ===\n');

  try {
    // 1. Total count
    const totalCount = await db.query('SELECT COUNT(*) as count FROM extracted_knowledge');
    console.log(`Total documents in extracted_knowledge: ${totalCount.rows[0].count}\n`);

    // 2. Count by category
    console.log('Documents by category:');
    const byCategory = await db.query(`
      SELECT category, COUNT(*) as count 
      FROM extracted_knowledge 
      GROUP BY category 
      ORDER BY count DESC
    `);
    byCategory.rows.forEach((row: any) => {
      console.log(`  ${row.category}: ${row.count} documents`);
    });

    // 3. Count by confidence level
    console.log('\nDocuments by confidence level:');
    const byConfidence = await db.query(`
      SELECT 
        CASE 
          WHEN confidence >= 0.9 THEN 'High (≥0.9)'
          WHEN confidence >= 0.7 THEN 'Medium (0.7-0.9)'
          WHEN confidence >= 0.6 THEN 'Low (0.6-0.7)'
          ELSE 'Very Low (<0.6)'
        END as level,
        COUNT(*) as count
      FROM extracted_knowledge
      GROUP BY level
      ORDER BY 
        CASE level
          WHEN 'High (≥0.9)' THEN 1
          WHEN 'Medium (0.7-0.9)' THEN 2
          WHEN 'Low (0.6-0.7)' THEN 3
          ELSE 4
        END
    `);
    byConfidence.rows.forEach((row: any) => {
      console.log(`  ${row.level}: ${row.count} documents`);
    });

    // 4. Search for specific terms mentioned
    console.log('\nSearching for specific terms:');
    const searchTerms = ['7iron', 'fan', 'bettergolf', 'nick'];
    
    for (const term of searchTerms) {
      const results = await db.query(`
        SELECT COUNT(*) as count
        FROM extracted_knowledge
        WHERE problem ILIKE $1 OR solution ILIKE $1
      `, [`%${term}%`]);
      
      console.log(`  "${term}": ${results.rows[0].count} matches`);
      
      // Show a sample if found
      if (results.rows[0].count > 0) {
        const sample = await db.query(`
          SELECT problem, solution, confidence, category
          FROM extracted_knowledge
          WHERE problem ILIKE $1 OR solution ILIKE $1
          LIMIT 2
        `, [`%${term}%`]);
        
        sample.rows.forEach((row: any, i: number) => {
          console.log(`    Sample ${i + 1}:`);
          console.log(`      Problem: ${row.problem.substring(0, 60)}...`);
          console.log(`      Solution: ${row.solution.substring(0, 60)}...`);
          console.log(`      Category: ${row.category}, Confidence: ${row.confidence}`);
        });
      }
    }

    // 5. Recent uploads
    console.log('\nMost recent uploads:');
    const recent = await db.query(`
      SELECT problem, category, confidence, created_at
      FROM extracted_knowledge
      ORDER BY created_at DESC
      LIMIT 5
    `);
    recent.rows.forEach((row: any, i: number) => {
      const date = new Date(row.created_at).toLocaleString();
      console.log(`  ${i + 1}. [${date}] ${row.category} - ${row.problem.substring(0, 50)}...`);
    });

    // 6. Source analysis
    console.log('\nDocument sources:');
    const sources = await db.query(`
      SELECT source_type, COUNT(*) as count
      FROM extracted_knowledge
      GROUP BY source_type
    `);
    sources.rows.forEach((row: any) => {
      console.log(`  ${row.source_type || 'unknown'}: ${row.count} documents`);
    });

    // 7. Quick unified search test
    console.log('\nTesting unified search for "7iron":');
    const { knowledgeLoader } = await import('../knowledge-base/knowledgeLoader');
    await knowledgeLoader.initializeDB();
    
    const searchResults = await knowledgeLoader.unifiedSearch('7iron', {
      includeExtracted: true,
      limit: 3
    });
    
    console.log(`  Found ${searchResults.length} results through unified search`);
    searchResults.forEach((result: any, i: number) => {
      console.log(`  ${i + 1}. [${result.source}] ${result.issue} (confidence: ${result.confidence})`);
    });

  } catch (error) {
    console.error('Error verifying knowledge:', error);
  } finally {
    await db.end();
  }
}

// Run verification
verifyExtractedKnowledge().catch(console.error);