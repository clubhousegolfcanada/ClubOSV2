import { Router, Request, Response } from 'express';
import { usageTracker } from '../services/usage/UsageTracker';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/usage/me
 * Get current user's usage statistics
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const period = (req.query.period as any) || 'day';
    
    const usage = await usageTracker.getUserUsage(userId, period);
    
    res.json({
      success: true,
      usage
    });
  } catch (error: any) {
    logger.error('Failed to get user usage:', error);
    res.status(500).json({
      error: 'Failed to get usage statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/usage/user/:userId
 * Get specific user's usage (admin only)
 */
router.get('/user/:userId', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const period = (req.query.period as any) || 'day';
    
    const usage = await usageTracker.getUserUsage(userId, period);
    
    res.json({
      success: true,
      usage
    });
  } catch (error: any) {
    logger.error('Failed to get user usage:', error);
    res.status(500).json({
      error: 'Failed to get usage statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/usage/key/:apiKey
 * Get API key usage (admin only)
 */
router.get('/key/:apiKey', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.params;
    const period = (req.query.period as any) || 'day';
    
    const usage = await usageTracker.getApiKeyUsage(apiKey, period);
    
    res.json({
      success: true,
      usage
    });
  } catch (error: any) {
    logger.error('Failed to get API key usage:', error);
    res.status(500).json({
      error: 'Failed to get usage statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/usage/overall
 * Get overall usage statistics (admin only)
 */
router.get('/overall', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as any) || 'day';
    
    const stats = await usageTracker.getOverallStats(period);
    
    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    logger.error('Failed to get overall usage:', error);
    res.status(500).json({
      error: 'Failed to get usage statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/usage/top-users
 * Get top users by usage (admin only)
 */
router.get('/top-users', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const period = (req.query.period as any) || 'day';
    
    const topUsers = await usageTracker.getTopUsers(limit, period);
    
    res.json({
      success: true,
      topUsers
    });
  } catch (error: any) {
    logger.error('Failed to get top users:', error);
    res.status(500).json({
      error: 'Failed to get top users',
      message: error.message
    });
  }
});

/**
 * GET /api/usage/endpoints
 * Get endpoint statistics (admin only)
 */
router.get('/endpoints', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as any) || 'day';
    
    const endpoints = await usageTracker.getEndpointStats(period);
    
    res.json({
      success: true,
      endpoints
    });
  } catch (error: any) {
    logger.error('Failed to get endpoint stats:', error);
    res.status(500).json({
      error: 'Failed to get endpoint statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/usage/check-limit
 * Check current rate limit status
 */
router.get('/check-limit', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const apiKey = req.headers['x-api-key'] as string;
    const endpoint = req.query.endpoint as string;
    
    const result = await usageTracker.checkRateLimit(userId, apiKey, endpoint);
    
    res.json({
      success: true,
      rateLimit: result
    });
  } catch (error: any) {
    logger.error('Failed to check rate limit:', error);
    res.status(500).json({
      error: 'Failed to check rate limit',
      message: error.message
    });
  }
});

/**
 * POST /api/usage/export
 * Export usage data (admin only)
 */
router.post('/export', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, format = 'json' } = req.body;
    
    // TODO: Implement export functionality
    // This would export usage data in various formats (JSON, CSV, Excel)
    
    res.json({
      success: true,
      message: 'Export functionality not yet implemented'
    });
  } catch (error: any) {
    logger.error('Failed to export usage data:', error);
    res.status(500).json({
      error: 'Failed to export usage data',
      message: error.message
    });
  }
});

export default router;
