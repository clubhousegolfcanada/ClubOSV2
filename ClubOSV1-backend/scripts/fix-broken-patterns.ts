/**
 * One-time script to fix all patterns missing keywords/embeddings
 *
 * Problem: Patterns created without keywords AND without embeddings cannot match anything.
 * This script finds all such patterns and:
 * 1. Extracts keywords from trigger_examples
 * 2. Regenerates embeddings if missing
 *
 * Run with: npx tsx scripts/fix-broken-patterns.ts
 */
import { db } from '../src/utils/database';
import { logger } from '../src/utils/logger';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * Extract meaningful keywords from trigger examples
 */
function extractKeywords(triggers: string[]): string[] {
  const stopWords = new Set([
    'do', 'you', 'have', 'is', 'are', 'the', 'a', 'an', 'i', 'can', 'what',
    'how', 'where', 'when', 'why', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'there', 'here', 'this', 'that', 'it',
    'my', 'your', 'our', 'their', 'to', 'for', 'of', 'in', 'on', 'at', 'by',
    'with', 'about', 'just', 'get', 'any', 'some'
  ]);

  const keywords = new Set<string>();
  triggers.forEach(trigger => {
    if (!trigger) return;
    trigger.toLowerCase()
      .replace(/[?.,!'"]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .forEach(word => keywords.add(word));
  });
  return Array.from(keywords);
}

/**
 * Regenerate embedding for a pattern
 */
async function regenerateEmbedding(patternId: number, triggers: string[]): Promise<boolean> {
  if (!openai) {
    console.log(`   ⚠️  OpenAI not configured, skipping embedding for pattern ${patternId}`);
    return false;
  }

  try {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: triggers.join(' ')
    });

    await db.query(
      'UPDATE decision_patterns SET embedding = $1 WHERE id = $2',
      [`{${embeddingResponse.data[0].embedding.join(',')}}`, patternId]
    );
    return true;
  } catch (error) {
    console.error(`   ❌ Failed to regenerate embedding for pattern ${patternId}:`, error);
    return false;
  }
}

async function fixBrokenPatterns() {
  console.log('========================================');
  console.log('V3-PLS Pattern Fix Script');
  console.log('========================================\n');

  // Find patterns with empty or null keywords
  const broken = await db.query(`
    SELECT
      id,
      trigger_text,
      trigger_examples,
      trigger_keywords,
      embedding IS NOT NULL as has_embedding,
      pattern_type,
      is_active
    FROM decision_patterns
    WHERE is_active = true
      AND (
        trigger_keywords IS NULL
        OR array_length(trigger_keywords, 1) IS NULL
        OR array_length(trigger_keywords, 1) = 0
      )
    ORDER BY created_at DESC
  `);

  console.log(`Found ${broken.rows.length} active patterns missing keywords\n`);

  if (broken.rows.length === 0) {
    console.log('✅ All patterns have keywords - nothing to fix!');
    process.exit(0);
  }

  let fixedCount = 0;
  let embeddingFixedCount = 0;
  let skippedCount = 0;

  for (const pattern of broken.rows) {
    const triggers = pattern.trigger_examples || [pattern.trigger_text].filter(Boolean);

    if (!triggers || triggers.length === 0) {
      console.log(`⚠️  Pattern ${pattern.id}: No trigger examples or text found, skipping`);
      skippedCount++;
      continue;
    }

    const keywords = extractKeywords(triggers);

    if (keywords.length === 0) {
      console.log(`⚠️  Pattern ${pattern.id}: No keywords extracted from "${triggers[0]?.substring(0, 50)}..."`,
        `(Type: ${pattern.pattern_type})`);
      skippedCount++;
      continue;
    }

    await db.query(
      'UPDATE decision_patterns SET trigger_keywords = $1 WHERE id = $2',
      [keywords, pattern.id]
    );

    console.log(`✅ Pattern ${pattern.id}: Added ${keywords.length} keywords [${keywords.slice(0, 3).join(', ')}${keywords.length > 3 ? '...' : ''}]`);
    fixedCount++;

    // Also regenerate embedding if missing
    if (!pattern.has_embedding) {
      const success = await regenerateEmbedding(pattern.id, triggers);
      if (success) {
        console.log(`   📊 Regenerated embedding for pattern ${pattern.id}`);
        embeddingFixedCount++;
      }
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log('\n========================================');
  console.log('Summary:');
  console.log(`  ✅ Fixed ${fixedCount} patterns with keywords`);
  console.log(`  📊 Regenerated ${embeddingFixedCount} embeddings`);
  console.log(`  ⚠️  Skipped ${skippedCount} patterns (no valid triggers)`);
  console.log('========================================\n');

  // Verify the fix
  const remaining = await db.query(`
    SELECT COUNT(*) as count
    FROM decision_patterns
    WHERE is_active = true
      AND (
        trigger_keywords IS NULL
        OR array_length(trigger_keywords, 1) IS NULL
        OR array_length(trigger_keywords, 1) = 0
      )
  `);

  if (parseInt(remaining.rows[0].count) === 0) {
    console.log('✅ All active patterns now have keywords!');
  } else {
    console.log(`⚠️  ${remaining.rows[0].count} patterns still missing keywords (may need manual review)`);
  }

  process.exit(0);
}

// Run the script
fixBrokenPatterns().catch(err => {
  console.error('Fix failed:', err);
  process.exit(1);
});
