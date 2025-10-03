import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation';

const router = Router();

// Protected route - requires admin or operator role
router.use(authenticate);
router.use(roleGuard(['admin', 'operator']));

/**
 * Correct a knowledge response
 * Updates existing entries or creates new verified entries
 */
router.post('/correct',
  [
    body('originalResponse').isString().notEmpty().withMessage('Original response is required'),
    body('correctedResponse').isString().notEmpty().withMessage('Corrected response is required'),
    body('context').isObject().optional()
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { originalResponse, correctedResponse, context = {} } = req.body;
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    const updates = {
      knowledge_updated: 0,
      patterns_created: 0,
      new_entries: 0
    };

    try {
      // Strategy 1: Update existing knowledge entries that contain the original response
      const updateResult = await db.query(`
        UPDATE knowledge_store
        SET
          value = CASE
            WHEN value ? 'response' THEN
              jsonb_set(value, '{response}', to_jsonb($1::text))
            ELSE
              jsonb_build_object(
                'response', $1::text,
                'original', value,
                'corrected_at', CURRENT_TIMESTAMP
              )
          END,
          confidence = 1.0,
          verification_status = 'verified',
          updated_at = NOW(),
          updated_by = $2
        WHERE
          value::text ILIKE $3
          OR (value ? 'response' AND value->>'response' ILIKE $3)
        RETURNING id, key
      `, [
        correctedResponse,
        userId,
        `%${originalResponse.substring(0, Math.min(50, originalResponse.length))}%`
      ]);

      updates.knowledge_updated = updateResult.rowCount || 0;

      // Strategy 2: If no exact matches, also look for related knowledge by keywords
      if (updates.knowledge_updated === 0 && context.originalQuery) {
        // Extract keywords from the original query
        const keywords = context.originalQuery
          .toLowerCase()
          .split(/\s+/)
          .filter((word: string) => word.length > 3)
          .slice(0, 3); // Take first 3 significant words

        const keywordPattern = keywords.join('|');

        const keywordUpdate = await db.query(`
          UPDATE knowledge_store
          SET
            value = jsonb_set(
              COALESCE(value, '{}'::jsonb),
              '{response}',
              to_jsonb($1::text)
            ),
            confidence = LEAST(confidence + 0.2, 1.0),
            verification_status = 'verified',
            updated_at = NOW(),
            updated_by = $2
          WHERE
            key ~* $3
            AND verification_status != 'verified'
          RETURNING id, key
        `, [
          correctedResponse,
          userId,
          keywordPattern
        ]);

        updates.knowledge_updated += keywordUpdate.rowCount || 0;
      }

      // Strategy 3: Create new verified entry if no updates were made
      if (updates.knowledge_updated === 0) {
        const newKey = `correction_${context.route || 'general'}_${Date.now()}`;

        await db.query(`
          INSERT INTO knowledge_store (
            key,
            value,
            confidence,
            verification_status,
            source_type,
            created_by,
            category
          ) VALUES (
            $1,
            $2,
            1.0,
            'verified',
            'operator_correction',
            $3,
            $4
          )
          ON CONFLICT (key) DO UPDATE SET
            value = EXCLUDED.value,
            confidence = 1.0,
            verification_status = 'verified',
            updated_at = NOW(),
            updated_by = EXCLUDED.created_by
        `, [
          newKey,
          JSON.stringify({
            question: context.originalQuery || 'Knowledge correction',
            response: correctedResponse,
            original_wrong: originalResponse,
            corrected_by: userEmail,
            corrected_at: new Date().toISOString(),
            route: context.route,
            confidence: context.confidence
          }),
          userId,
          context.route || 'general'
        ]);

        updates.new_entries = 1;
      }

      // Log the correction for audit purposes
      await db.query(`
        INSERT INTO response_corrections (
          original_response,
          corrected_response,
          knowledge_updated,
          user_id,
          user_email,
          context
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        originalResponse,
        correctedResponse,
        updates.knowledge_updated + updates.new_entries,
        userId,
        userEmail,
        JSON.stringify(context)
      ]).catch(err => {
        // Table might not exist yet, log but don't fail
        logger.debug('Corrections audit table not yet created:', err.message);
      });

      logger.info('Knowledge correction completed', {
        userId,
        updates,
        originalLength: originalResponse.length,
        correctedLength: correctedResponse.length
      });

      res.json({
        success: true,
        updates,
        message: updates.knowledge_updated > 0
          ? `Updated ${updates.knowledge_updated} existing knowledge entries`
          : `Created new verified knowledge entry`
      });

    } catch (error) {
      logger.error('Knowledge correction failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to correct knowledge',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * Test endpoint to verify a correction would work
 */
router.post('/test',
  [
    body('query').isString().notEmpty().withMessage('Query is required')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { query } = req.body;

    try {
      // Search for knowledge that would match this query
      const result = await db.query(`
        SELECT
          key,
          value->>'response' as response,
          confidence,
          verification_status,
          updated_at
        FROM knowledge_store
        WHERE
          to_tsvector('english', key || ' ' || COALESCE(value::text, ''))
          @@ plainto_tsquery('english', $1)
          OR key ILIKE $2
          OR value::text ILIKE $2
        ORDER BY
          verification_status = 'verified' DESC,
          confidence DESC,
          updated_at DESC
        LIMIT 5
      `, [query, `%${query.substring(0, 30)}%`]);

      res.json({
        success: true,
        matches: result.rows,
        bestMatch: result.rows[0]?.response || 'No match found'
      });

    } catch (error) {
      logger.error('Knowledge test failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test knowledge'
      });
    }
  })
);

export default router;