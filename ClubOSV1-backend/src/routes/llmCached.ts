import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { cachedLLMService } from '../services/llmServiceCached';
import { assistantService } from '../services/assistantService';
import { slackFallback } from '../services/slackFallback';
import { cacheService } from '../services/cacheService';
import { usageTrackingService } from '../services/usageTrackingService';
import { UserRequest, ProcessedRequest, SystemConfig, BotRoute } from '../types';
import { AppError } from '../middleware/errorHandler';
import { validate, requestValidation } from '../middleware/validation';
import { body } from 'express-validator';
import { strictLimiter } from '../middleware/security';
import { authenticate } from '../middleware/auth';
import { roleGuard, adminOrOperator } from '../middleware/roleGuard';
import OpenAI from 'openai';

// Only initialize OpenAI if API key is present
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

const router = Router();

// Apply usage tracking middleware to all routes
router.use(usageTrackingService.trackingMiddleware());

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    llmEnabled: cachedLLMService?.isConfigured() || false,
    cacheEnabled: cacheService.isAvailable(),
    cacheStats: cacheService.getStats()
  });
});

// Get system config with caching
async function getSystemConfig(): Promise<SystemConfig> {
  return cacheService.withCache('system:config', async () => {
    // Return default config - can be stored in database later
    return {
      environment: process.env.NODE_ENV || 'development',
      llmEnabled: cachedLLMService?.isConfigured() || false,
      assistantEnabled: !!assistantService,
      cacheEnabled: cacheService.isAvailable(),
      version: process.env.npm_package_version || '1.0.0'
    };
  }, { ttl: 60 }); // Cache for 1 minute
}

// Process user request with caching
router.post('/process',
  authenticate,
  strictLimiter,
  validate([
    body('description').isString().notEmpty().withMessage('Description is required'),
    body('location').optional().isString(),
    body('additionalContext').optional().isString(),
    body('selectedRoute').optional().isString(),
    body('noCache').optional().isBoolean()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = uuidv4();
    
    try {
      const { description, location, additionalContext, selectedRoute, noCache } = req.body;
      const userId = (req as any).user?.id;
      
      logger.info(`Processing request ${requestId}`, {
        userId,
        selectedRoute,
        descriptionLength: description?.length
      });

      // Check system config
      const config = await getSystemConfig();
      if (!config.llmEnabled) {
        throw new AppError('LLM service is disabled', 503);
      }

      // Process with cached LLM service
      const llmResponse = await cachedLLMService.processRequest(
        description,
        userId,
        {
          location,
          additionalContext,
          route: selectedRoute,
          noCache // Allow bypassing cache if needed
        }
      );

      // Log processing details
      const processingTime = Date.now() - startTime;
      logger.info(`Request ${requestId} completed`, {
        processingTime,
        route: llmResponse.route,
        confidence: llmResponse.confidence,
        cached: llmResponse.cached,
        provider: llmResponse.provider
      });

      // Add cache header if response was cached
      if (llmResponse.cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Age', llmResponse.cacheAge || 0);
      } else {
        res.setHeader('X-Cache', 'MISS');
      }

      // Return response
      res.json({
        success: true,
        requestId,
        data: llmResponse,
        processingTime,
        cached: llmResponse.cached || false
      });
    } catch (error) {
      logger.error(`Request ${requestId} failed`, error);
      next(error);
    }
  }
);

// Route user request with caching (skip assistant response)
router.post('/route',
  authenticate,
  strictLimiter,
  validate([
    body('description').isString().notEmpty().withMessage('Description is required'),
    body('additionalContext').optional().isString()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      const { description, additionalContext } = req.body;
      const userId = (req as any).user?.id;

      // Route with caching
      const routeResponse = await cachedLLMService.routeRequest(
        description,
        userId,
        { additionalContext }
      );

      const processingTime = Date.now() - startTime;
      
      res.json({
        success: true,
        route: routeResponse.route,
        confidence: routeResponse.confidence,
        processingTime
      });
    } catch (error) {
      logger.error('Routing failed', error);
      next(error);
    }
  }
);

// Get available routes
router.get('/routes',
  authenticate,
  async (req: Request, res: Response) => {
    const routes = cachedLLMService.getAvailableRoutes();
    res.json({ 
      success: true, 
      routes,
      cacheStats: cacheService.getStats()
    });
  }
);

// Clear cache (admin only)
router.delete('/cache',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { pattern } = req.query;
      const cleared = await cachedLLMService.clearCache(pattern as string);
      
      res.json({
        success: true,
        message: `Cleared ${cleared} cache entries`,
        pattern: pattern || 'all'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get cache statistics (admin/operator)
router.get('/cache/stats',
  authenticate,
  adminOrOperator,
  async (req: Request, res: Response) => {
    const stats = cacheService.getStats();
    res.json({
      success: true,
      stats,
      available: cacheService.isAvailable()
    });
  }
);

// Get usage statistics (admin only)
router.get('/usage',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { days = '30', userId } = req.query;
      
      let stats;
      if (userId) {
        stats = await usageTrackingService.getUserStats(
          parseInt(userId as string),
          parseInt(days as string)
        );
      } else {
        stats = await usageTrackingService.getSystemStats(
          parseInt(days as string)
        );
      }
      
      res.json({
        success: true,
        stats,
        period: `${days} days`
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get monthly cost projection (admin only)
router.get('/usage/projection',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projection = await usageTrackingService.getMonthlyProjection();
      
      res.json({
        success: true,
        projection,
        currency: 'USD'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;