import { query as db } from '../utils/db';

async function cleanupPatterns() {
  console.log('Starting pattern cleanup...');
  
  try {
    // First, let's see what patterns we have
    const allPatterns = await db(`
      SELECT 
        id,
        pattern_type,
        trigger_examples,
        confidence_score,
        execution_count,
        success_count,
        is_active,
        is_deleted,
        created_at,
        CASE 
          WHEN success_count > 0 AND execution_count > 0 
          THEN (success_count::float / execution_count::float * 100)
          ELSE 0 
        END as success_rate
      FROM decision_patterns
      ORDER BY created_at DESC
    `);
    
    console.log(`Found ${allPatterns.rows.length} total patterns`);
    
    // Categorize patterns
    const lowPerformers = allPatterns.rows.filter(p => 
      p.execution_count >= 2 && p.success_rate < 50
    );
    
    const unused = allPatterns.rows.filter(p => 
      p.execution_count === 0 && 
      new Date(p.created_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Older than 7 days
    );
    
    const duplicates = [];
    const seen = new Map();
    
    for (const pattern of allPatterns.rows) {
      const trigger = pattern.trigger_examples?.[0]?.toLowerCase() || '';
      if (seen.has(trigger)) {
        // Keep the one with better performance
        const existing = seen.get(trigger);
        if (pattern.success_rate < existing.success_rate) {
          duplicates.push(pattern);
        } else {
          duplicates.push(existing);
          seen.set(trigger, pattern);
        }
      } else {
        seen.set(trigger, pattern);
      }
    }
    
    console.log('\n=== Pattern Analysis ===');
    console.log(`Low performers (< 50% success): ${lowPerformers.length}`);
    console.log(`Unused patterns (> 7 days old): ${unused.length}`);
    console.log(`Duplicate patterns: ${duplicates.length}`);
    
    // Mark patterns as deleted (soft delete)
    const toDelete = [...new Set([...lowPerformers, ...unused, ...duplicates])];
    
    if (toDelete.length > 0) {
      console.log(`\nMarking ${toDelete.length} patterns as deleted...`);
      
      for (const pattern of toDelete) {
        await db(
          'UPDATE decision_patterns SET is_deleted = true, is_active = false WHERE id = $1',
          [pattern.id]
        );
        console.log(`- Deleted: ${pattern.pattern_type} (${pattern.success_rate.toFixed(0)}% success rate)`);
      }
    }
    
    // Show remaining active patterns
    const activePatterns = await db(`
      SELECT 
        pattern_type,
        confidence_score,
        execution_count,
        success_count,
        CASE 
          WHEN success_count > 0 AND execution_count > 0 
          THEN (success_count::float / execution_count::float * 100)
          ELSE 0 
        END as success_rate
      FROM decision_patterns
      WHERE is_deleted = false AND is_active = true
      ORDER BY success_rate DESC
    `);
    
    console.log('\n=== Remaining Active Patterns ===');
    for (const p of activePatterns.rows) {
      console.log(`✓ ${p.pattern_type}: ${p.success_rate.toFixed(0)}% success (${p.execution_count} uses)`);
    }
    
    console.log(`\nCleanup complete! ${activePatterns.rows.length} active patterns remain.`);
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  cleanupPatterns()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Cleanup failed:', error);
      process.exit(1);
    });
}

export { cleanupPatterns };