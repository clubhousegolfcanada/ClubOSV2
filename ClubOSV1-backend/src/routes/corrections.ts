import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation';
import { patternLearningService } from '../services/patternLearningService';

const router = Router();

// Protected route - requires admin or operator role
router.use(authenticate);
router.use(roleGuard(['admin', 'operator']));

/**
 * Direct correction endpoint - saves correction and creates pattern
 * This replaces the complex knowledge-router flow
 */
router.post('/save',
  [
    body('responseId').optional().isUUID().withMessage('Invalid response ID'),
    body('originalQuery').isString().notEmpty().withMessage('Original query is required'),
    body('originalResponse').isString().notEmpty().withMessage('Original response is required'),
    body('correctedResponse').isString().notEmpty().withMessage('Corrected response is required'),
    body('route').optional().isString(),
    body('confidence').optional().isFloat({ min: 0, max: 1 })
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { responseId, originalQuery, originalResponse, correctedResponse, route, confidence } = req.body;
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    const results = {
      knowledgeUpdated: 0,
      patternCreated: false,
      patternId: null as number | null,
      responseTracked: false,
      errors: [] as string[]
    };

    try {
      // Start a transaction for consistency
      await db.query('BEGIN');

      // Step 1: Update or create knowledge store entry
      try {
        // First try to update existing knowledge that matches the original response
        const updateResult = await db.query(`
          UPDATE knowledge_store
          SET
            value = jsonb_set(
              COALESCE(value, '{}'::jsonb),
              '{response}',
              to_jsonb($1::text)
            ),
            confidence = 1.0,
            verification_status = 'verified',
            updated_at = NOW(),
            updated_by = $2,
            source_type = 'operator_correction'
          WHERE
            (value->>'response' ILIKE $3 OR value::text ILIKE $3)
            AND verification_status != 'verified'
          RETURNING id, key
        `, [
          correctedResponse,
          userId,
          `%${originalResponse.substring(0, 100)}%`
        ]);

        if (updateResult.rowCount && updateResult.rowCount > 0) {
          results.knowledgeUpdated = updateResult.rowCount;
        } else {
          // Create new knowledge entry
          const newKey = `correction_${route || 'general'}_${Date.now()}`;
          await db.query(`
            INSERT INTO knowledge_store (
              key, value, confidence, verification_status,
              source_type, created_by, category
            ) VALUES (
              $1, $2, 1.0, 'verified',
              'operator_correction', $3, $4
            )
          `, [
            newKey,
            JSON.stringify({
              question: originalQuery,
              response: correctedResponse,
              original_wrong: originalResponse,
              corrected_by: userEmail,
              corrected_at: new Date().toISOString(),
              route: route
            }),
            userId,
            route || 'general'
          ]);
          results.knowledgeUpdated = 1;
        }
      } catch (err) {
        logger.error('Failed to update knowledge store:', err);
        results.errors.push('Failed to update knowledge store');
      }

      // Step 2: Create or update pattern for future automation
      try {
        // Generate pattern from the correction
        const patternSignature = patternLearningService.generateSignature(originalQuery);

        // Check if pattern exists
        const existingPattern = await db.query(`
          SELECT id, confidence_score, execution_count
          FROM v3_pls_patterns
          WHERE pattern_signature = $1
        `, [patternSignature]);

        if (existingPattern.rows.length > 0) {
          // Update existing pattern with corrected response
          const pattern = existingPattern.rows[0];
          const newConfidence = Math.min(pattern.confidence_score + 0.15, 1.0);

          await db.query(`
            UPDATE v3_pls_patterns
            SET
              response_template = $1,
              confidence_score = $2,
              updated_at = NOW(),
              last_modified_by = $3
            WHERE id = $4
          `, [
            correctedResponse,
            newConfidence,
            userId,
            pattern.id
          ]);

          results.patternId = pattern.id;
          results.patternCreated = false;

          logger.info('Updated existing pattern from correction:', {
            patternId: pattern.id,
            newConfidence,
            route
          });
        } else {
          // Create new pattern from correction
          const insertResult = await db.query(`
            INSERT INTO v3_pls_patterns (
              pattern_type, pattern_signature, trigger_text,
              response_template, confidence_score, is_active,
              auto_executable, created_by, metadata
            ) VALUES (
              'correction', $1, $2, $3, 0.6, true, false, $4, $5
            ) RETURNING id
          `, [
            patternSignature,
            originalQuery,
            correctedResponse,
            userId,
            JSON.stringify({
              source: 'operator_correction',
              original_response: originalResponse,
              route: route,
              corrected_at: new Date().toISOString()
            })
          ]);

          if (insertResult.rows.length > 0) {
            results.patternId = insertResult.rows[0].id;
            results.patternCreated = true;

            logger.info('Created new pattern from correction:', {
              patternId: results.patternId,
              route
            });
          }
        }

        // Record this as an operator response for pattern learning
        await patternLearningService.recordOperatorResponse(
          originalQuery,
          correctedResponse,
          '', // phone number not applicable here
          results.patternId || undefined
        );
      } catch (err) {
        logger.error('Failed to create/update pattern:', err);
        results.errors.push('Failed to create pattern');
      }

      // Step 3: Update response tracking if responseId provided
      if (responseId) {
        try {
          await db.query(`
            UPDATE response_tracking
            SET
              corrected = true,
              correction_count = correction_count + 1,
              updated_at = NOW()
            WHERE id = $1
          `, [responseId]);

          results.responseTracked = true;
        } catch (err) {
          logger.error('Failed to update response tracking:', err);
          results.errors.push('Failed to update response tracking');
        }
      }

      // Step 4: Log the correction for audit
      try {
        await db.query(`
          INSERT INTO response_corrections (
            response_id, original_response, corrected_response,
            knowledge_updated, pattern_id, pattern_created,
            user_id, user_email, context
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          responseId || null,
          originalResponse,
          correctedResponse,
          results.knowledgeUpdated,
          results.patternId,
          results.patternCreated,
          userId,
          userEmail,
          JSON.stringify({
            route,
            originalQuery,
            confidence
          })
        ]);
      } catch (err) {
        logger.debug('Corrections audit table might not exist yet:', err);
      }

      // Commit transaction
      await db.query('COMMIT');

      logger.info('Correction saved successfully:', {
        userId,
        results,
        route
      });

      res.json({
        success: true,
        results,
        message: results.patternCreated
          ? 'Correction saved and new pattern created for future automation'
          : 'Correction saved and pattern updated'
      });

    } catch (error) {
      // Rollback transaction on error
      await db.query('ROLLBACK');

      logger.error('Correction save failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save correction',
        details: error instanceof Error ? error.message : 'Unknown error',
        results
      });
    }
  })
);

/**
 * Get correction analytics
 */
router.get('/analytics',
  asyncHandler(async (req, res) => {
    try {
      const analytics = await db.query(`
        SELECT * FROM correction_analytics
        ORDER BY total_responses DESC
      `);

      const recentCorrections = await db.query(`
        SELECT
          rc.id,
          rc.created_at,
          rc.user_email,
          rc.pattern_created,
          rt.route,
          rt.original_query,
          LENGTH(rc.original_response) as original_length,
          LENGTH(rc.corrected_response) as corrected_length
        FROM response_corrections rc
        LEFT JOIN response_tracking rt ON rt.id = rc.response_id
        ORDER BY rc.created_at DESC
        LIMIT 10
      `);

      res.json({
        success: true,
        analytics: analytics.rows,
        recentCorrections: recentCorrections.rows
      });
    } catch (error) {
      logger.error('Failed to get correction analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve analytics'
      });
    }
  })
);

export default router;