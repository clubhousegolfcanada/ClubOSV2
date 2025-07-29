import { db } from '../utils/database';
import { logger } from '../utils/logger';

async function checkKnowledgeFormatting() {
  console.log('Checking extracted knowledge data formatting...\n');

  try {
    // Check categories distribution
    const categories = await db.query(`
      SELECT category, COUNT(*) as count 
      FROM extracted_knowledge 
      GROUP BY category 
      ORDER BY count DESC
    `);
    
    console.log('Knowledge by category:');
    const validCategories = ['emergency', 'booking', 'tech', 'brand', 'general'];
    let invalidCategoryCount = 0;
    
    categories.rows.forEach((row: any) => {
      const isValid = validCategories.includes(row.category);
      console.log(`  ${row.category}: ${row.count} entries ${!isValid ? '⚠️ INVALID CATEGORY' : '✓'}`);
      if (!isValid) invalidCategoryCount += parseInt(row.count);
    });
    
    if (invalidCategoryCount > 0) {
      console.log(`\n⚠️ WARNING: ${invalidCategoryCount} entries have invalid categories`);
    }
    
    // Check for required fields
    console.log('\nChecking data completeness:');
    const missingFields = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE problem IS NULL OR problem = '') as missing_problem,
        COUNT(*) FILTER (WHERE solution IS NULL OR solution = '') as missing_solution,
        COUNT(*) FILTER (WHERE category IS NULL OR category = '') as missing_category,
        COUNT(*) FILTER (WHERE confidence IS NULL) as missing_confidence,
        COUNT(*) as total
      FROM extracted_knowledge
    `);
    
    const stats = missingFields.rows[0];
    console.log(`  Total entries: ${stats.total}`);
    console.log(`  Missing problem: ${stats.missing_problem}`);
    console.log(`  Missing solution: ${stats.missing_solution}`);
    console.log(`  Missing category: ${stats.missing_category}`);
    console.log(`  Missing confidence: ${stats.missing_confidence}`);
    
    // Sample data from each category
    console.log('\nSample data from each category:');
    for (const category of validCategories) {
      const samples = await db.query(`
        SELECT problem, solution, confidence 
        FROM extracted_knowledge 
        WHERE category = $1 
        LIMIT 2
      `, [category]);
      
      if (samples.rows.length > 0) {
        console.log(`\n${category.toUpperCase()}:`);
        samples.rows.forEach((row: any, i: number) => {
          console.log(`  ${i + 1}. Problem: ${row.problem.substring(0, 50)}...`);
          console.log(`     Solution: ${row.solution.substring(0, 50)}...`);
          console.log(`     Confidence: ${row.confidence}`);
        });
      }
    }
    
    // Check confidence distribution
    console.log('\nConfidence score distribution:');
    const confidenceRanges = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE confidence >= 0.9) as high,
        COUNT(*) FILTER (WHERE confidence >= 0.7 AND confidence < 0.9) as medium,
        COUNT(*) FILTER (WHERE confidence >= 0.6 AND confidence < 0.7) as low,
        COUNT(*) FILTER (WHERE confidence < 0.6) as too_low
      FROM extracted_knowledge
    `);
    
    const conf = confidenceRanges.rows[0];
    console.log(`  High (≥0.9): ${conf.high}`);
    console.log(`  Medium (0.7-0.9): ${conf.medium}`);
    console.log(`  Low (0.6-0.7): ${conf.low}`);
    console.log(`  Too Low (<0.6): ${conf.too_low} (these are filtered out)`);
    
    // Check for proper mapping to LLM routes
    console.log('\nCategory to LLM route mapping:');
    const routeMap: Record<string, string> = {
      'booking': 'Booking & Access',
      'emergency': 'Emergency',
      'tech': 'TechSupport',
      'brand': 'BrandTone',
      'general': 'TechSupport (default)'
    };
    
    for (const [category, route] of Object.entries(routeMap)) {
      const count = categories.rows.find((r: any) => r.category === category)?.count || 0;
      console.log(`  ${category} → ${route}: ${count} entries`);
    }
    
    // Check for duplicate entries
    console.log('\nChecking for duplicates:');
    const duplicates = await db.query(`
      SELECT problem, solution, COUNT(*) as count
      FROM extracted_knowledge
      GROUP BY problem, solution
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 5
    `);
    
    if (duplicates.rows.length > 0) {
      console.log(`  Found ${duplicates.rows.length} duplicate problem/solution pairs`);
      duplicates.rows.forEach((row: any) => {
        console.log(`    "${row.problem.substring(0, 40)}..." appears ${row.count} times`);
      });
    } else {
      console.log('  No duplicates found ✓');
    }
    
  } catch (error) {
    console.error('Error checking knowledge formatting:', error);
  } finally {
    await db.end();
  }
}

// Run the check
checkKnowledgeFormatting().catch(console.error);