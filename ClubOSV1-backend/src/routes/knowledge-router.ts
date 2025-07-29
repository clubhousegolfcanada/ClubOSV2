import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { handleValidationErrors } from '../middleware/validation';
import { knowledgeRouter } from '../services/knowledgeRouter';
import { logger } from '../utils/logger';
import { body, query } from 'express-validator';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(roleGuard(['admin']));

/**
 * Parse natural language knowledge input and route to assistants
 */
router.post('/parse-and-route',
  [
    body('input').isString().notEmpty().withMessage('Input is required'),
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { input } = req.body;
    const userId = req.user?.id;

    try {
      // Step 1: Parse the natural language input
      const parsedUpdate = await knowledgeRouter.parseKnowledgeInput(input, userId);
      
      logger.info('Parsed knowledge update:', {
        userId,
        input: input.substring(0, 100),
        parsed: parsedUpdate
      });

      // Step 2: Route to the appropriate assistant
      const routeResult = await knowledgeRouter.routeToAssistant(parsedUpdate);

      res.json({
        success: routeResult.success,
        data: {
          parsed: parsedUpdate,
          routing: routeResult,
          message: routeResult.message
        },
        error: routeResult.error
      });
    } catch (error) {
      logger.error('Knowledge routing error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process knowledge update'
      });
    }
  })
);

/**
 * Get recent knowledge updates for monitoring
 */
router.get('/recent-updates',
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 20;

    try {
      const updates = await knowledgeRouter.getRecentUpdates(limit);
      
      res.json({
        success: true,
        data: updates
      });
    } catch (error) {
      logger.error('Failed to get recent updates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve recent updates'
      });
    }
  })
);

/**
 * Test endpoint to verify parsing without routing
 */
router.post('/test-parse',
  [
    body('input').isString().notEmpty().withMessage('Input is required'),
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { input } = req.body;

    try {
      const parsed = await knowledgeRouter.parseKnowledgeInput(input);
      
      res.json({
        success: true,
        data: {
          input,
          parsed,
          message: 'Parsing successful (not routed to assistant)'
        }
      });
    } catch (error) {
      logger.error('Parse test error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse input'
      });
    }
  })
);

export default router;