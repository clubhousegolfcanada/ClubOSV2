import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { handleValidationErrors } from '../middleware/validation';
import { knowledgeRouter } from '../services/knowledgeRouter';
import { logger } from '../utils/logger';
import { body, query } from 'express-validator';
import { config } from '../utils/envValidator';
import { db } from '../utils/database';

const router = Router();

/**
 * Test endpoint to check OpenAI configuration (PUBLIC)
 */
router.get('/test-config',
  asyncHandler(async (req, res) => {
    const hasApiKey = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-demo-key-not-for-production';
    const keyPrefix = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 7) + '...' : 'NOT SET';
    
    res.json({
      success: true,
      config: {
        hasOpenAIKey: hasApiKey,
        keyPrefix,
        assistantIds: {
          emergency: process.env.EMERGENCY_GPT_ID || 'NOT SET',
          booking: process.env.BOOKING_ACCESS_GPT_ID || 'NOT SET',
          tech: process.env.TECH_SUPPORT_GPT_ID || 'NOT SET',
          brand: process.env.BRAND_MARKETING_GPT_ID || 'NOT SET'
        },
        database: {
          initialized: db.initialized,
          tables: {
            knowledge_audit_log: 'required',
            assistant_knowledge: 'required'
          }
        }
      }
    });
  })
);

// Protected routes require admin authentication
const protectedRouter = Router();
protectedRouter.use(authenticate);
protectedRouter.use(roleGuard(['admin']));

/**
 * Parse natural language knowledge input and route to assistants
 */
protectedRouter.post('/parse-and-route',
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
      
      // Log the result for debugging
      logger.info('Knowledge routing result:', {
        success: routeResult.success,
        assistant: routeResult.assistant,
        message: routeResult.message
      });

      // Determine the appropriate message based on what happened
      let message = 'Knowledge saved successfully to database';
      if (routeResult.success) {
        message = 'Knowledge saved and OpenAI assistant updated successfully';
      } else if (!routeResult.success && parsedUpdate) {
        message = `Knowledge saved to database but OpenAI update failed: ${routeResult.error || 'Unknown error'}`;
      }
      
      res.json({
        success: true, // True if knowledge was saved to DB
        data: {
          parsed: parsedUpdate,
          routing: routeResult,
          message,
          assistantUpdateStatus: routeResult.success ? 'success' : 'failed',
          openAIUpdateError: !routeResult.success ? routeResult.error : undefined
        }
      });
    } catch (error) {
      logger.error('Knowledge routing error:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        input: input?.substring(0, 100),
        userId
      });
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
protectedRouter.get('/recent-updates',
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
protectedRouter.post('/test-parse',
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

// Mount protected routes under the main router
router.use('/', protectedRouter);

export default router;