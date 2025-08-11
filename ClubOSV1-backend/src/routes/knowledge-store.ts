/**
 * Knowledge Store API Routes
 * Provides CRUD operations for the flexible knowledge storage system
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { knowledgeStore } from '../services/knowledgeStore';
import { logger } from '../utils/logger';
import { body, query as queryValidator, param } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation';
import multer from 'multer';
import { parseUploadedFile } from '../services/knowledgeParser';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/knowledge-store/test
 * Test endpoint to verify the service is working
 */
router.get('/test', async (req, res) => {
  try {
    const testKey = 'test.connection';
    await knowledgeStore.set(testKey, { 
      message: 'Knowledge store is working!',
      timestamp: new Date().toISOString()
    });
    const value = await knowledgeStore.get(testKey);
    
    res.json({
      success: true,
      data: {
        stored: testKey,
        retrieved: value
      }
    });
  } catch (error) {
    logger.error('Knowledge store test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Knowledge store test failed'
    });
  }
});

/**
 * POST /api/knowledge-store/set
 * Store or update knowledge
 */
router.post('/set',
  roleGuard(['admin', 'operator']),
  [
    body('key').isString().notEmpty().withMessage('Key is required'),
    body('value').exists().withMessage('Value is required'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { key, value, confidence, verification_status, metadata } = req.body;
      
      const id = await knowledgeStore.set(key, value, {
        confidence,
        verification_status: req.user?.role === 'admin' && verification_status === 'verified' 
          ? 'verified' 
          : 'learned',
        source_type: 'manual',
        metadata,
        created_by: req.user?.id
      });

      res.json({
        success: true,
        data: { id, key },
        message: 'Knowledge stored successfully'
      });
    } catch (error) {
      logger.error('Failed to store knowledge:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to store knowledge'
      });
    }
  }
);

/**
 * GET /api/knowledge-store/get/:key
 * Retrieve knowledge by key
 */
router.get('/get/:key',
  param('key').isString().notEmpty(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const value = await knowledgeStore.get(req.params.key);
      
      if (value === null) {
        return res.status(404).json({
          success: false,
          error: 'Knowledge not found'
        });
      }

      res.json({
        success: true,
        data: {
          key: req.params.key,
          value
        }
      });
    } catch (error) {
      logger.error('Failed to retrieve knowledge:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve knowledge'
      });
    }
  }
);

/**
 * GET /api/knowledge-store/search
 * Search across all knowledge
 */
router.get('/search',
  [
    queryValidator('q').isString().notEmpty().withMessage('Search query is required'),
    queryValidator('limit').optional().isInt({ min: 1, max: 100 }),
    queryValidator('minConfidence').optional().isFloat({ min: 0, max: 1 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const results = await knowledgeStore.search(req.query.q as string, {
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        minConfidence: req.query.minConfidence ? parseFloat(req.query.minConfidence as string) : 0,
        verificationStatus: req.query.status as string
      });

      res.json({
        success: true,
        data: results,
        count: results.length
      });
    } catch (error) {
      logger.error('Knowledge search failed:', error);
      res.status(500).json({
        success: false,
        error: 'Search failed'
      });
    }
  }
);

/**
 * DELETE /api/knowledge-store/:key
 * Delete knowledge by key
 */
router.delete('/:key',
  roleGuard(['admin']),
  param('key').isString().notEmpty(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const deletedCount = await knowledgeStore.delete(req.params.key);
      
      res.json({
        success: true,
        data: {
          deletedCount,
          pattern: req.params.key
        },
        message: `Deleted ${deletedCount} entries`
      });
    } catch (error) {
      logger.error('Failed to delete knowledge:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete knowledge'
      });
    }
  }
);

/**
 * GET /api/knowledge-store/keys
 * List all keys (with optional prefix)
 */
router.get('/keys',
  async (req, res) => {
    try {
      const keys = await knowledgeStore.keys(req.query.prefix as string);
      
      res.json({
        success: true,
        data: keys,
        count: keys.length
      });
    } catch (error) {
      logger.error('Failed to list keys:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list keys'
      });
    }
  }
);

/**
 * GET /api/knowledge-store/all
 * Get all knowledge entries
 */
router.get('/all',
  roleGuard(['admin', 'operator']),
  async (req, res) => {
    try {
      const all = await knowledgeStore.getAll(req.query.prefix as string);
      
      res.json({
        success: true,
        data: all,
        count: Object.keys(all).length
      });
    } catch (error) {
      logger.error('Failed to get all knowledge:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve knowledge'
      });
    }
  }
);

/**
 * POST /api/knowledge-store/bulk
 * Bulk operations
 */
router.post('/bulk',
  roleGuard(['admin']),
  [
    body('operations').isArray().withMessage('Operations must be an array'),
    body('operations.*.action').isIn(['set', 'delete']).withMessage('Action must be set or delete'),
    body('operations.*.key').isString().notEmpty().withMessage('Key is required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      await knowledgeStore.bulk(req.body.operations);
      
      res.json({
        success: true,
        message: `Processed ${req.body.operations.length} operations`
      });
    } catch (error) {
      logger.error('Bulk operations failed:', error);
      res.status(500).json({
        success: false,
        error: 'Bulk operations failed'
      });
    }
  }
);

/**
 * POST /api/knowledge-store/upload
 * Upload and parse files (.md, .json, .txt)
 */
router.post('/upload',
  roleGuard(['admin', 'operator']),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided'
        });
      }

      // Parse the uploaded file
      const entries = await parseUploadedFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      // Store all entries
      let stored = 0;
      for (const entry of entries) {
        await knowledgeStore.set(entry.key, entry.value, {
          verification_status: req.user?.role === 'admin' ? 'verified' : 'learned',
          source_type: 'file_upload',
          metadata: {
            filename: req.file.originalname,
            uploadedBy: req.user?.email
          },
          created_by: req.user?.id
        });
        stored++;
      }

      res.json({
        success: true,
        data: {
          filename: req.file.originalname,
          entriesCreated: stored
        },
        message: `Successfully imported ${stored} knowledge entries`
      });
    } catch (error) {
      logger.error('File upload failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process file'
      });
    }
  }
);

/**
 * POST /api/knowledge-store/confidence
 * Update confidence based on feedback
 */
router.post('/confidence',
  [
    body('key').isString().notEmpty().withMessage('Key is required'),
    body('success').isBoolean().withMessage('Success flag is required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      await knowledgeStore.updateConfidence(req.body.key, req.body.success);
      
      res.json({
        success: true,
        message: 'Confidence updated'
      });
    } catch (error) {
      logger.error('Failed to update confidence:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update confidence'
      });
    }
  }
);

/**
 * POST /api/knowledge-store/promote/:key
 * Promote knowledge to verified status
 */
router.post('/promote/:key',
  roleGuard(['admin']),
  param('key').isString().notEmpty(),
  handleValidationErrors,
  async (req, res) => {
    try {
      await knowledgeStore.promote(req.params.key);
      
      res.json({
        success: true,
        message: 'Knowledge promoted to verified'
      });
    } catch (error) {
      logger.error('Failed to promote knowledge:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to promote knowledge'
      });
    }
  }
);

/**
 * GET /api/knowledge-store/analytics
 * Get analytics and usage statistics
 */
router.get('/analytics',
  roleGuard(['admin', 'operator']),
  async (req, res) => {
    try {
      const analytics = await knowledgeStore.getAnalytics();
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Failed to get analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve analytics'
      });
    }
  }
);

/**
 * POST /api/knowledge-store/cleanup
 * Clean up expired entries
 */
router.post('/cleanup',
  roleGuard(['admin']),
  async (req, res) => {
    try {
      const cleaned = await knowledgeStore.cleanupExpired();
      
      res.json({
        success: true,
        data: {
          cleanedCount: cleaned
        },
        message: `Cleaned up ${cleaned} expired entries`
      });
    } catch (error) {
      logger.error('Cleanup failed:', error);
      res.status(500).json({
        success: false,
        error: 'Cleanup failed'
      });
    }
  }
);

export default router;