import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { db } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// Protected route - requires admin or operator role
router.use(authenticate);
router.use(roleGuard(['admin', 'operator']));

/**
 * Debug endpoint to test knowledge searches
 */
router.post('/search',
  asyncHandler(async (req, res) => {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const results: any = {
      query,
      tests: {}
    };

    try {
      // Test 1: Direct LIKE search
      const likeSearch = await db.query(`
        SELECT key,
               SUBSTRING(value::text, 1, 200) as value_preview,
               confidence,
               search_vector IS NOT NULL as has_vector
        FROM knowledge_store
        WHERE key ILIKE $1
           OR value::text ILIKE $1
        LIMIT 5
      `, [`%${query}%`]);

      results.tests.like_search = {
        count: likeSearch.rowCount,
        results: likeSearch.rows
      };

      // Test 2: Full-text search (current method)
      const ftsSearch = await db.query(`
        SELECT key,
               SUBSTRING(value::text, 1, 200) as value_preview,
               confidence,
               ts_rank(search_vector, plainto_tsquery('english', $1)) as relevance
        FROM knowledge_store
        WHERE search_vector @@ plainto_tsquery('english', $1)
          AND superseded_by IS NULL
        ORDER BY relevance DESC, confidence DESC
        LIMIT 5
      `, [query]);

      results.tests.fulltext_search = {
        count: ftsSearch.rowCount,
        results: ftsSearch.rows
      };

      // Test 3: Check if any entries have null search_vector
      const nullVectors = await db.query(`
        SELECT COUNT(*) as count
        FROM knowledge_store
        WHERE search_vector IS NULL
      `);

      results.tests.null_vectors = nullVectors.rows[0].count;

      // Test 4: Search with individual words
      const words = query.split(/\s+/).filter(w => w.length > 2);
      const wordResults: any[] = [];

      for (const word of words) {
        const wordSearch = await db.query(`
          SELECT key, confidence
          FROM knowledge_store
          WHERE search_vector @@ plainto_tsquery('english', $1)
          LIMIT 3
        `, [word]);

        wordResults.push({
          word,
          count: wordSearch.rowCount,
          keys: wordSearch.rows.map(r => r.key)
        });
      }

      results.tests.word_search = wordResults;

      // Test 5: Check what's actually in the value field for numeric entries
      if (/\d{5,}/.test(query)) {
        const numericSearch = await db.query(`
          SELECT key, value
          FROM knowledge_store
          WHERE value::text ~ '\\d{5,}'
          LIMIT 5
        `);

        results.tests.numeric_entries = {
          count: numericSearch.rowCount,
          results: numericSearch.rows
        };
      }

      logger.info('Knowledge debug search completed', {
        query,
        likeMatches: results.tests.like_search.count,
        ftsMatches: results.tests.fulltext_search.count
      });

      res.json({
        success: true,
        results
      });

    } catch (error) {
      logger.error('Debug search error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        results
      });
    }
  })
);

/**
 * Get stats about knowledge store
 */
router.get('/stats',
  asyncHandler(async (req, res) => {
    try {
      const stats = await db.query(`
        SELECT
          COUNT(*) as total_entries,
          SUM(CASE WHEN search_vector IS NULL THEN 1 ELSE 0 END) as without_vector,
          SUM(CASE WHEN search_vector IS NOT NULL THEN 1 ELSE 0 END) as with_vector,
          COUNT(DISTINCT category) as categories,
          SUM(CASE WHEN value::text ILIKE '%power%' OR value::text ILIKE '%meter%' THEN 1 ELSE 0 END) as power_related,
          SUM(CASE WHEN value::text ~ '\\d{6,}' THEN 1 ELSE 0 END) as with_long_numbers
        FROM knowledge_store
      `);

      const categories = await db.query(`
        SELECT category, COUNT(*) as count
        FROM knowledge_store
        WHERE category IS NOT NULL
        GROUP BY category
        ORDER BY count DESC
      `);

      res.json({
        success: true,
        stats: stats.rows[0],
        categories: categories.rows
      });

    } catch (error) {
      logger.error('Stats error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export default router;