import { Router, Request, Response } from 'express';
import { llmService } from '../services/llmService';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/llm/providers
 * Get status of all LLM providers
 */
router.get('/providers', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const providers = await llmService.getRouterStatus();
    res.json({
      success: true,
      providers
    });
  } catch (error: any) {
    logger.error('Failed to get provider status:', error);
    res.status(500).json({
      error: 'Failed to get provider status',
      message: error.message
    });
  }
});

/**
 * GET /api/llm/providers/metrics
 * Get metrics for all providers
 */
router.get('/providers/metrics', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const metrics = llmService.getMetrics();
    res.json({
      success: true,
      metrics
    });
  } catch (error: any) {
    logger.error('Failed to get provider metrics:', error);
    res.status(500).json({
      error: 'Failed to get provider metrics',
      message: error.message
    });
  }
});

/**
 * POST /api/llm/providers/test
 * Test all configured providers
 */
router.post('/providers/test', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const results = await llmService.testProviders();
    res.json({
      success: true,
      results
    });
  } catch (error: any) {
    logger.error('Failed to test providers:', error);
    res.status(500).json({
      error: 'Failed to test providers',
      message: error.message
    });
  }
});

/**
 * PUT /api/llm/providers/:provider/enable
 * Enable a specific provider
 */
router.put('/providers/:provider/enable', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    llmService.setProviderEnabled(provider, true);
    
    res.json({
      success: true,
      message: `Provider ${provider} enabled`
    });
  } catch (error: any) {
    logger.error('Failed to enable provider:', error);
    res.status(500).json({
      error: 'Failed to enable provider',
      message: error.message
    });
  }
});

/**
 * PUT /api/llm/providers/:provider/disable
 * Disable a specific provider
 */
router.put('/providers/:provider/disable', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    llmService.setProviderEnabled(provider, false);
    
    res.json({
      success: true,
      message: `Provider ${provider} disabled`
    });
  } catch (error: any) {
    logger.error('Failed to disable provider:', error);
    res.status(500).json({
      error: 'Failed to disable provider',
      message: error.message
    });
  }
});

/**
 * PUT /api/llm/providers/:provider/priority
 * Update provider priority
 */
router.put('/providers/:provider/priority', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const { priority } = req.body;
    
    if (typeof priority !== 'number' || priority < 0) {
      return res.status(400).json({
        error: 'Invalid priority value'
      });
    }
    
    llmService.setProviderPriority(provider, priority);
    
    res.json({
      success: true,
      message: `Provider ${provider} priority updated to ${priority}`
    });
  } catch (error: any) {
    logger.error('Failed to update provider priority:', error);
    res.status(500).json({
      error: 'Failed to update provider priority',
      message: error.message
    });
  }
});

export default router;
