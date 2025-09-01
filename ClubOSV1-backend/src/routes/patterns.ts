/**
 * Pattern Learning API Routes
 * 
 * BREADCRUMB: API endpoints for managing the pattern learning system
 * These routes allow operators to view, manage, and configure patterns
 * 
 * Author: Claude
 * Date: 2025-09-01
 * 
 * TODO: After creating this file:
 * 1. Import and mount in src/index.ts: app.use('/api/patterns', patternsRouter);
 * 2. Test endpoints with Postman or curl
 * 3. Add authentication middleware for production
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { patternLearningService } from '../services/patternLearningService';
import { body, param, query, validationResult } from 'express-validator';

const router = Router();

// BREADCRUMB: All routes require authentication and admin/operator role
// This ensures only authorized users can manage patterns

/**
 * GET /api/patterns/config
 * Get pattern learning configuration
 */
router.get('/config',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        'SELECT config_key, config_value, description FROM pattern_learning_config ORDER BY config_key'
      );
      
      const config = result.rows.reduce((acc, row) => {
        acc[row.config_key] = {
          value: row.config_value,
          description: row.description
        };
        return acc;
      }, {} as any);
      
      res.json({
        success: true,
        config,
        shadowMode: config.shadow_mode?.value === 'true',
        enabled: config.enabled?.value === 'true'
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to get config', error);
      res.status(500).json({ success: false, error: 'Failed to get configuration' });
    }
  }
);

/**
 * PUT /api/patterns/config
 * Update pattern learning configuration
 * BREADCRUMB: Use this to enable/disable pattern learning or change to production mode
 */
router.put('/config',
  authenticate,
  roleGuard(['admin']), // Only admins can change config
  [
    body('key').isString().notEmpty(),
    body('value').isString().notEmpty()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { key, value } = req.body;
      
      // Update configuration
      await db.query(
        'UPDATE pattern_learning_config SET config_value = $1, updated_at = NOW() WHERE config_key = $2',
        [value, key]
      );
      
      logger.info('[Patterns API] Configuration updated', {
        key,
        value,
        updatedBy: (req as any).user?.id
      });
      
      res.json({ success: true, message: 'Configuration updated' });
    } catch (error) {
      logger.error('[Patterns API] Failed to update config', error);
      res.status(500).json({ success: false, error: 'Failed to update configuration' });
    }
  }
);

/**
 * GET /api/patterns
 * Get all patterns with filtering and pagination
 */
router.get('/',
  authenticate,
  roleGuard(['admin', 'operator']),
  [
    query('type').optional().isString(),
    query('minConfidence').optional().isFloat({ min: 0, max: 1 }),
    query('autoExecutable').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  async (req: Request, res: Response) => {
    try {
      const {
        type,
        minConfidence = 0,
        autoExecutable,
        limit = 50,
        offset = 0
      } = req.query;

      let queryStr = `
        SELECT 
          p.*,
          COALESCE(p.success_count::float / NULLIF(p.execution_count, 0), 0) as success_rate,
          COUNT(peh.id) as recent_executions
        FROM decision_patterns p
        LEFT JOIN pattern_execution_history peh ON p.id = peh.pattern_id
          AND peh.created_at > NOW() - INTERVAL '7 days'
        WHERE p.is_active = TRUE
      `;

      const params: any[] = [];
      let paramCount = 0;

      if (type) {
        queryStr += ` AND p.pattern_type = $${++paramCount}`;
        params.push(type);
      }

      if (minConfidence) {
        queryStr += ` AND p.confidence_score >= $${++paramCount}`;
        params.push(minConfidence);
      }

      if (autoExecutable !== undefined) {
        queryStr += ` AND p.auto_executable = $${++paramCount}`;
        params.push(autoExecutable === 'true');
      }

      queryStr += `
        GROUP BY p.id
        ORDER BY p.confidence_score DESC, p.execution_count DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;
      
      params.push(limit, offset);

      const result = await db.query(queryStr, params);

      // Get total count for pagination
      const countResult = await db.query(
        'SELECT COUNT(*) FROM decision_patterns WHERE is_active = TRUE'
      );

      res.json({
        success: true,
        patterns: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to get patterns', error);
      res.status(500).json({ success: false, error: 'Failed to get patterns' });
    }
  }
);

/**
 * GET /api/patterns/:id
 * Get a specific pattern with its execution history
 */
router.get('/:id',
  authenticate,
  roleGuard(['admin', 'operator']),
  [param('id').isInt()],
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Get pattern
      const patternResult = await db.query(
        'SELECT * FROM decision_patterns WHERE id = $1',
        [id]
      );

      if (patternResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Pattern not found' });
      }

      // Get recent execution history
      const historyResult = await db.query(`
        SELECT 
          peh.*,
          u.name as reviewed_by_name
        FROM pattern_execution_history peh
        LEFT JOIN users u ON peh.reviewed_by = u.id
        WHERE peh.pattern_id = $1
        ORDER BY peh.created_at DESC
        LIMIT 20
      `, [id]);

      // Get confidence evolution
      const evolutionResult = await db.query(`
        SELECT 
          ce.*,
          u.name as changed_by_name
        FROM confidence_evolution ce
        LEFT JOIN users u ON ce.changed_by = u.id
        WHERE ce.pattern_id = $1
        ORDER BY ce.changed_at DESC
        LIMIT 20
      `, [id]);

      res.json({
        success: true,
        pattern: patternResult.rows[0],
        executionHistory: historyResult.rows,
        confidenceEvolution: evolutionResult.rows
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to get pattern', error);
      res.status(500).json({ success: false, error: 'Failed to get pattern' });
    }
  }
);

/**
 * PUT /api/patterns/:id
 * Update a pattern (response, confidence, active status)
 */
router.put('/:id',
  authenticate,
  roleGuard(['admin']),
  [
    param('id').isInt(),
    body('response_template').optional().isString(),
    body('confidence_score').optional().isFloat({ min: 0, max: 1 }),
    body('auto_executable').optional().isBoolean(),
    body('is_active').optional().isBoolean(),
    body('notes').optional().isString()
  ],
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Build update query
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          updateFields.push(`${key} = $${paramCount++}`);
          values.push(updates[key]);
        }
      });

      if (updateFields.length === 0) {
        return res.status(400).json({ success: false, error: 'No updates provided' });
      }

      // Add last_modified
      updateFields.push(`last_modified = NOW()`);
      
      // Add id as last parameter
      values.push(id);

      await db.query(
        `UPDATE decision_patterns SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
        values
      );

      // Log the change
      if (updates.confidence_score !== undefined) {
        await db.query(`
          INSERT INTO confidence_evolution 
          (pattern_id, old_confidence, new_confidence, change_reason, changed_by)
          SELECT id, confidence_score, $1, 'manual_adjustment', $2
          FROM decision_patterns WHERE id = $3
        `, [updates.confidence_score, (req as any).user?.id, id]);
      }

      logger.info('[Patterns API] Pattern updated', {
        patternId: id,
        updates,
        updatedBy: (req as any).user?.id
      });

      res.json({ success: true, message: 'Pattern updated' });
    } catch (error) {
      logger.error('[Patterns API] Failed to update pattern', error);
      res.status(500).json({ success: false, error: 'Failed to update pattern' });
    }
  }
);

/**
 * DELETE /api/patterns/:id
 * Soft delete a pattern (sets is_active = false)
 */
router.delete('/:id',
  authenticate,
  roleGuard(['admin']),
  [param('id').isInt()],
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await db.query(
        'UPDATE decision_patterns SET is_active = FALSE, last_modified = NOW() WHERE id = $1',
        [id]
      );

      logger.info('[Patterns API] Pattern deactivated', {
        patternId: id,
        deactivatedBy: (req as any).user?.id
      });

      res.json({ success: true, message: 'Pattern deactivated' });
    } catch (error) {
      logger.error('[Patterns API] Failed to delete pattern', error);
      res.status(500).json({ success: false, error: 'Failed to delete pattern' });
    }
  }
);

/**
 * GET /api/patterns/queue/pending
 * Get patterns waiting for approval
 */
router.get('/queue/pending',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const result = await db.query(`
        SELECT 
          q.*,
          p.pattern_type,
          p.trigger_text,
          p.confidence_score as pattern_confidence,
          peh.phone_number,
          peh.message_text
        FROM pattern_suggestions_queue q
        JOIN decision_patterns p ON q.pattern_id = p.id
        JOIN pattern_execution_history peh ON q.execution_history_id = peh.id
        WHERE q.status = 'pending'
          AND (q.expires_at IS NULL OR q.expires_at > NOW())
        ORDER BY q.priority DESC, q.created_at ASC
      `);

      res.json({
        success: true,
        queue: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to get queue', error);
      res.status(500).json({ success: false, error: 'Failed to get queue' });
    }
  }
);

/**
 * POST /api/patterns/queue/:id/approve
 * Approve a queued pattern suggestion
 */
router.post('/queue/:id/approve',
  authenticate,
  roleGuard(['admin', 'operator']),
  [
    param('id').isInt(),
    body('modifications').optional().isObject()
  ],
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { modifications } = req.body;
      const userId = (req as any).user?.id;

      // Update queue item
      await db.query(`
        UPDATE pattern_suggestions_queue
        SET status = 'approved',
            reviewed_by = $1,
            reviewed_at = NOW(),
            review_notes = $2
        WHERE id = $3
      `, [userId, modifications ? 'Modified before approval' : null, id]);

      // TODO: Execute the pattern action if not in shadow mode

      logger.info('[Patterns API] Pattern suggestion approved', {
        queueId: id,
        approvedBy: userId,
        hasModifications: !!modifications
      });

      res.json({ success: true, message: 'Pattern approved' });
    } catch (error) {
      logger.error('[Patterns API] Failed to approve pattern', error);
      res.status(500).json({ success: false, error: 'Failed to approve pattern' });
    }
  }
);

/**
 * POST /api/patterns/queue/:id/reject
 * Reject a queued pattern suggestion
 */
router.post('/queue/:id/reject',
  authenticate,
  roleGuard(['admin', 'operator']),
  [
    param('id').isInt(),
    body('reason').optional().isString()
  ],
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = (req as any).user?.id;

      // Update queue item
      await db.query(`
        UPDATE pattern_suggestions_queue
        SET status = 'rejected',
            reviewed_by = $1,
            reviewed_at = NOW(),
            review_notes = $2
        WHERE id = $3
      `, [userId, reason, id]);

      // Update pattern confidence (decrease for rejection)
      const queueItem = await db.query(
        'SELECT pattern_id FROM pattern_suggestions_queue WHERE id = $1',
        [id]
      );

      if (queueItem.rows[0]?.pattern_id) {
        await patternLearningService.updatePatternConfidence(
          queueItem.rows[0].pattern_id,
          false, // not successful
          false  // not modified
        );
      }

      logger.info('[Patterns API] Pattern suggestion rejected', {
        queueId: id,
        rejectedBy: userId,
        reason
      });

      res.json({ success: true, message: 'Pattern rejected' });
    } catch (error) {
      logger.error('[Patterns API] Failed to reject pattern', error);
      res.status(500).json({ success: false, error: 'Failed to reject pattern' });
    }
  }
);

/**
 * GET /api/patterns/stats
 * Get pattern learning statistics
 */
router.get('/stats',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      // Get overall stats
      const statsResult = await db.query(`
        SELECT 
          COUNT(*) as total_patterns,
          COUNT(*) FILTER (WHERE auto_executable = TRUE) as auto_executable_patterns,
          COUNT(*) FILTER (WHERE confidence_score >= 0.95) as high_confidence_patterns,
          COUNT(*) FILTER (WHERE confidence_score >= 0.75) as medium_confidence_patterns,
          COUNT(*) FILTER (WHERE confidence_score < 0.75) as low_confidence_patterns,
          AVG(confidence_score) as avg_confidence,
          SUM(execution_count) as total_executions,
          SUM(success_count) as total_successes,
          AVG(CASE WHEN execution_count > 0 
            THEN success_count::float / execution_count 
            ELSE 0 END) as avg_success_rate
        FROM decision_patterns
        WHERE is_active = TRUE
      `);

      // Get pattern type distribution
      const typeResult = await db.query(`
        SELECT 
          pattern_type,
          COUNT(*) as count,
          AVG(confidence_score) as avg_confidence
        FROM decision_patterns
        WHERE is_active = TRUE
        GROUP BY pattern_type
        ORDER BY count DESC
      `);

      // Get recent activity
      const activityResult = await db.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as executions,
          COUNT(DISTINCT pattern_id) as unique_patterns,
          COUNT(*) FILTER (WHERE execution_status = 'success') as successes
        FROM pattern_execution_history
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);

      res.json({
        success: true,
        stats: statsResult.rows[0],
        typeDistribution: typeResult.rows,
        recentActivity: activityResult.rows
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to get stats', error);
      res.status(500).json({ success: false, error: 'Failed to get statistics' });
    }
  }
);

/**
 * POST /api/patterns/test
 * Test a message against patterns without executing
 * BREADCRUMB: Use this to see what pattern would match a message
 */
router.post('/test',
  authenticate,
  roleGuard(['admin', 'operator']),
  [body('message').isString().notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const { message } = req.body;

      // Process through pattern learning in test mode
      const result = await patternLearningService.processMessage(
        message,
        'TEST_PHONE',
        'TEST_CONVERSATION',
        'Test Customer'
      );

      res.json({
        success: true,
        message,
        result,
        wouldExecute: result.action === 'auto_execute',
        confidence: result.confidence
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to test pattern', error);
      res.status(500).json({ success: false, error: 'Failed to test pattern' });
    }
  }
);

/**
 * GET /api/patterns/ai-automations
 * Get AI automation settings
 */
router.get('/ai-automations',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      // Get automation settings from database or config
      const result = await db.query(`
        SELECT * FROM ai_automation_settings 
        WHERE id = 1
      `);
      
      if (result.rows.length === 0) {
        // Return defaults if no settings exist
        res.json({
          giftCardInquiries: true,
          llmInitialAnalysis: true,
          trackmanReset: false
        });
      } else {
        res.json({
          giftCardInquiries: result.rows[0].gift_card_inquiries ?? true,
          llmInitialAnalysis: result.rows[0].llm_initial_analysis ?? true,
          trackmanReset: result.rows[0].trackman_reset ?? false
        });
      }
    } catch (error) {
      logger.error('Failed to get AI automation settings:', error);
      res.status(500).json({ error: 'Failed to get AI automation settings' });
    }
  }
);

/**
 * PUT /api/patterns/ai-automations
 * Update AI automation settings
 */
router.put('/ai-automations',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const { giftCardInquiries, llmInitialAnalysis, trackmanReset } = req.body;
      
      // Check if settings exist
      const existing = await db.query('SELECT id FROM ai_automation_settings WHERE id = 1');
      
      if (existing.rows.length === 0) {
        // Insert new settings
        await db.query(`
          INSERT INTO ai_automation_settings 
          (id, gift_card_inquiries, llm_initial_analysis, trackman_reset, updated_at)
          VALUES (1, $1, $2, $3, NOW())
        `, [
          giftCardInquiries ?? true,
          llmInitialAnalysis ?? true,
          trackmanReset ?? false
        ]);
      } else {
        // Update existing settings
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        if (giftCardInquiries !== undefined) {
          updates.push(`gift_card_inquiries = $${paramCount++}`);
          values.push(giftCardInquiries);
        }
        if (llmInitialAnalysis !== undefined) {
          updates.push(`llm_initial_analysis = $${paramCount++}`);
          values.push(llmInitialAnalysis);
        }
        if (trackmanReset !== undefined) {
          updates.push(`trackman_reset = $${paramCount++}`);
          values.push(trackmanReset);
        }
        
        if (updates.length > 0) {
          await db.query(`
            UPDATE ai_automation_settings 
            SET ${updates.join(', ')}, updated_at = NOW()
            WHERE id = 1
          `, values);
        }
      }
      
      // Log the change
      logger.info('AI automation settings updated:', { 
        by: req.user?.email,
        settings: req.body 
      });
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to update AI automation settings:', error);
      res.status(500).json({ error: 'Failed to update AI automation settings' });
    }
  }
);

export default router;

// TODO NEXT STEPS:
// 1. Import this router in src/index.ts
// 2. Mount at /api/patterns
// 3. Test with: curl http://localhost:3001/api/patterns/config
// 4. Create UI to manage patterns
// 5. Monitor pattern execution in shadow mode