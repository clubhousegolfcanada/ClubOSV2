import express from 'express';
import { authenticate } from '../middleware/auth';
import { query as db } from '../utils/db';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * GET /api/patterns
 * Get all active (non-deleted) patterns
 */
router.get('/', authenticate, async (req, res) => {
  try {
    // Get query parameters for filtering
    const { includeDeleted = 'false', includeInactive = 'false' } = req.query;
    
    // Build WHERE clause
    const conditions = [];
    if (includeDeleted !== 'true') {
      conditions.push('(is_deleted = false OR is_deleted IS NULL)');
    }
    if (includeInactive !== 'true') {
      conditions.push('is_active = true');
    }
    
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';
    
    const result = await db(`
      SELECT 
        id,
        pattern_type,
        COALESCE(trigger_text, trigger_examples[1], '') as pattern,
        response_template,
        trigger_examples,
        trigger_keywords,
        confidence_score,
        execution_count,
        success_count,
        is_active,
        COALESCE(is_deleted, FALSE) as is_deleted,
        COALESCE(first_seen, NOW()) as created_at,
        COALESCE(updated_at, last_modified, NOW()) as updated_at,
        CASE 
          WHEN success_count > 0 AND execution_count > 0 
          THEN ROUND((success_count::float / execution_count::float * 100)::numeric, 0)
          ELSE 0 
        END as success_rate,
        CASE 
          WHEN updated_at IS NOT NULL THEN updated_at
          ELSE created_at
        END as last_used
      FROM decision_patterns
      ${whereClause}
      ORDER BY 
        is_active DESC,
        confidence_score DESC,
        execution_count DESC
    `);
    
    logger.info(`Fetched ${result.rows.length} patterns (includeDeleted: ${includeDeleted}, includeInactive: ${includeInactive})`);
    
    res.json({
      success: true,
      patterns: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    logger.error('Error fetching patterns:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch patterns' 
    });
  }
});

/**
 * GET /api/patterns/deleted
 * Get deleted patterns for recovery
 */
router.get('/deleted', authenticate, async (req, res) => {
  try {
    const result = await db(`
      SELECT 
        id,
        pattern_type,
        COALESCE(trigger_text, trigger_examples[1], '') as pattern,
        response_template,
        trigger_examples,
        confidence_score,
        execution_count,
        success_count,
        COALESCE(is_deleted, FALSE) as is_deleted,
        COALESCE(updated_at, last_modified, NOW()) as updated_at,
        CASE 
          WHEN success_count > 0 AND execution_count > 0 
          THEN ROUND((success_count::float / execution_count::float * 100)::numeric, 0)
          ELSE 0 
        END as success_rate
      FROM patterns
      WHERE is_deleted = true
      ORDER BY updated_at DESC
      LIMIT 50
    `);
    
    res.json({
      success: true,
      patterns: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    logger.error('Error fetching deleted patterns:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch deleted patterns' 
    });
  }
});

/**
 * POST /api/patterns/:id/restore
 * Restore a deleted pattern
 */
router.post('/:id/restore', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db(
      `UPDATE decision_patterns 
       SET is_deleted = false, 
           is_active = true,
           confidence_score = 70,
           execution_count = 0,
           success_count = 0,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Pattern not found' 
      });
    }
    
    logger.info(`Pattern ${id} restored by user ${req.user?.id}`);
    
    res.json({
      success: true,
      pattern: result.rows[0]
    });
  } catch (error) {
    logger.error('Error restoring pattern:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to restore pattern' 
    });
  }
});

/**
 * DELETE /api/patterns/:id
 * Soft delete a pattern
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;
    
    if (permanent === 'true' && req.user?.role === 'admin') {
      // Permanent delete for admins only
      await db('DELETE FROM decision_patterns WHERE id = $1', [id]);
      logger.info(`Pattern ${id} permanently deleted by admin ${req.user.id}`);
    } else {
      // Soft delete
      await db(
        `UPDATE decision_patterns 
         SET is_deleted = true, 
             is_active = false,
             updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
      logger.info(`Pattern ${id} soft deleted by user ${req.user?.id}`);
    }
    
    res.json({
      success: true,
      message: permanent === 'true' ? 'Pattern permanently deleted' : 'Pattern deleted'
    });
  } catch (error) {
    logger.error('Error deleting pattern:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete pattern' 
    });
  }
});

/**
 * POST /api/patterns/cleanup
 * Run cleanup to remove low-performing patterns
 */
router.post('/cleanup', authenticate, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin access required' 
      });
    }
    
    // Import and run cleanup
    const { cleanupPatterns } = await import('../scripts/cleanup-patterns');
    await cleanupPatterns();
    
    res.json({
      success: true,
      message: 'Pattern cleanup completed'
    });
  } catch (error) {
    logger.error('Error running cleanup:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to run cleanup' 
    });
  }
});

export default router;