import { Router, Request, Response } from 'express';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';

const router = Router();

// All monitoring routes require admin access
router.use(authenticate);
router.use(roleGuard(['admin']));

// Get shadow mode comparison statistics
router.get('/shadow-stats', async (req: Request, res: Response) => {
  try {
    // Overall statistics
    const overallStats = await db.query(`
      SELECT 
        COUNT(*) as total_comparisons,
        AVG(sop_confidence) as avg_sop_confidence,
        AVG(sop_time_ms) as avg_sop_time,
        AVG(CASE WHEN assistant_response IS NOT NULL THEN assistant_time_ms END) as avg_assistant_time,
        COUNT(CASE WHEN sop_confidence >= 0.75 THEN 1 END) as high_confidence_count,
        COUNT(CASE WHEN sop_confidence < 0.75 THEN 1 END) as low_confidence_count
      FROM sop_shadow_comparisons
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);
    
    // By route statistics
    const byRoute = await db.query(`
      SELECT 
        route,
        COUNT(*) as comparison_count,
        AVG(sop_confidence) as avg_confidence,
        AVG(sop_time_ms) as avg_time_ms,
        MIN(sop_confidence) as min_confidence,
        MAX(sop_confidence) as max_confidence
      FROM sop_shadow_comparisons
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY route
      ORDER BY comparison_count DESC
    `);
    
    // Recent comparisons
    const recentComparisons = await db.query(`
      SELECT 
        id,
        query,
        route,
        sop_confidence,
        sop_time_ms,
        assistant_time_ms,
        created_at,
        LENGTH(sop_response) as sop_response_length,
        LENGTH(assistant_response) as assistant_response_length
      FROM sop_shadow_comparisons
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    // Daily trend
    const dailyTrend = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as comparisons,
        AVG(sop_confidence) as avg_confidence,
        AVG(sop_time_ms) as avg_time
      FROM sop_shadow_comparisons
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    
    res.json({
      success: true,
      data: {
        overall: overallStats.rows[0],
        byRoute: byRoute.rows,
        recentComparisons: recentComparisons.rows,
        dailyTrend: dailyTrend.rows
      }
    });
    
  } catch (error) {
    logger.error('Failed to get shadow mode stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics'
    });
  }
});

// Get detailed comparison by ID
router.get('/comparison/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT * FROM sop_shadow_comparisons WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Comparison not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    logger.error('Failed to get comparison details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve comparison'
    });
  }
});

// Get SOP module status
router.get('/sop-status', async (req: Request, res: Response) => {
  try {
    const { intelligentSOPModule } = await import('../services/intelligentSOPModule');
    const status = intelligentSOPModule.getStatus();
    
    // Get current configuration
    const config = {
      USE_INTELLIGENT_SOP: process.env.USE_INTELLIGENT_SOP === 'true',
      SOP_SHADOW_MODE: process.env.SOP_SHADOW_MODE === 'true',
      SOP_CONFIDENCE_THRESHOLD: parseFloat(process.env.SOP_CONFIDENCE_THRESHOLD || '0.75'),
      SOP_ROLLOUT_PERCENTAGE: parseFloat(process.env.SOP_ROLLOUT_PERCENTAGE || '0')
    };
    
    // Get metrics if database is available
    let metrics = null;
    if (db.initialized) {
      const metricsResult = await db.query(`
        SELECT 
          COUNT(DISTINCT assistant) as unique_assistants,
          COUNT(*) as total_documents,
          MIN(created_at) as oldest_embedding,
          MAX(updated_at) as newest_embedding
        FROM sop_embeddings
      `);
      metrics = metricsResult.rows[0];
    }
    
    res.json({
      success: true,
      data: {
        module: status,
        config,
        metrics
      }
    });
    
  } catch (error) {
    logger.error('Failed to get SOP status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve status'
    });
  }
});

// Calculate potential cost savings
router.get('/cost-analysis', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    
    // Get request counts
    const requestStats = await db.query(`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN sop_confidence >= 0.75 THEN 1 END) as sop_eligible_requests
      FROM sop_shadow_comparisons
      WHERE created_at > NOW() - INTERVAL '${days} days'
    `);
    
    const stats = requestStats.rows[0];
    const sopEligiblePercentage = (stats.sop_eligible_requests / stats.total_requests) * 100;
    
    // Calculate costs (rough estimates)
    const assistantCostPerMonth = 750; // Current OpenAI Assistant cost
    const gpt4CostPer1kTokens = 0.03; // GPT-4 API cost
    const avgTokensPerRequest = 500; // Estimate
    
    const potentialMonthlySavings = assistantCostPerMonth * (sopEligiblePercentage / 100);
    const sopOperationalCost = (stats.total_requests * avgTokensPerRequest / 1000) * gpt4CostPer1kTokens;
    
    res.json({
      success: true,
      data: {
        period: `${days} days`,
        totalRequests: stats.total_requests,
        sopEligibleRequests: stats.sop_eligible_requests,
        sopEligiblePercentage: sopEligiblePercentage.toFixed(2),
        currentMonthlyCost: assistantCostPerMonth,
        potentialMonthlySavings: potentialMonthlySavings.toFixed(2),
        estimatedSopOperationalCost: sopOperationalCost.toFixed(2),
        netMonthlySavings: (potentialMonthlySavings - sopOperationalCost).toFixed(2)
      }
    });
    
  } catch (error) {
    logger.error('Failed to calculate cost analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate costs'
    });
  }
});

export default router;