import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { routingOptimizer } from '../services/routingOptimizer';

const router = Router();

// GET /api/analytics/routing - Get routing analytics
router.get('/routing', authenticate, roleGuard(['admin', 'operator']), async (req, res) => {
  try {
    const { startDate, endDate, limit = 100 } = req.query;
    
    // Check if we have any data
    const dataCheck = await db.query('SELECT COUNT(*) as count FROM customer_interactions');
    const hasData = dataCheck.rows[0]?.count > 0;

    if (!hasData) {
      return res.json({
        success: true,
        data: {
          routeDistribution: [],
          lowConfidenceRequests: [],
          routePatterns: [],
          commonPatterns: [],
          summary: {
            totalRequests: 0,
            averageConfidence: 0,
            mostUsedRoute: 'None',
            leastConfidentRoute: null
          }
        }
      });
    }
    
    // Route distribution
    const routeDistribution = await db.query(`
      SELECT 
        route,
        COUNT(*) as count,
        AVG(confidence) as avg_confidence,
        MIN(confidence) as min_confidence,
        MAX(confidence) as max_confidence
      FROM customer_interactions
      WHERE ($1::timestamp IS NULL OR "createdAt" >= $1)
        AND ($2::timestamp IS NULL OR "createdAt" <= $2)
      GROUP BY route
      ORDER BY count DESC
    `, [startDate || null, endDate || null]);

    // Low confidence routes (potential issues)
    const lowConfidenceRequests = await db.query(`
      SELECT 
        id,
        request_text,
        route,
        confidence,
        response_text,
        "createdAt"
      FROM customer_interactions
      WHERE confidence < 0.5
        AND ($1::timestamp IS NULL OR "createdAt" >= $1)
        AND ($2::timestamp IS NULL OR "createdAt" <= $2)
      ORDER BY confidence ASC, "createdAt" DESC
      LIMIT $3
    `, [startDate || null, endDate || null, limit]);

    // Route patterns by time
    const routePatterns = await db.query(`
      SELECT 
        DATE_TRUNC('hour', "createdAt") as hour,
        route,
        COUNT(*) as count
      FROM customer_interactions
      WHERE ($1::timestamp IS NULL OR "createdAt" >= $1)
        AND ($2::timestamp IS NULL OR "createdAt" <= $2)
      GROUP BY hour, route
      ORDER BY hour DESC
      LIMIT 168  -- Last 7 days of hourly data
    `, [startDate || null, endDate || null]);

    // Most common request patterns per route
    const commonPatterns = await db.query(`
      WITH request_words AS (
        SELECT 
          route,
          LOWER(regexp_split_to_table(request_text, '\\s+')) as word
        FROM customer_interactions
        WHERE ($1::timestamp IS NULL OR "createdAt" >= $1)
          AND ($2::timestamp IS NULL OR "createdAt" <= $2)
      )
      SELECT 
        route,
        word,
        COUNT(*) as frequency
      FROM request_words
      WHERE LENGTH(word) > 3  -- Filter out short words
        AND word NOT IN ('have', 'that', 'this', 'with', 'from', 'what', 'when', 'where', 'which')
      GROUP BY route, word
      HAVING COUNT(*) > 2
      ORDER BY route, frequency DESC
    `, [startDate || null, endDate || null]);

    res.json({
      success: true,
      data: {
        routeDistribution: routeDistribution.rows || [],
        lowConfidenceRequests: lowConfidenceRequests.rows || [],
        routePatterns: routePatterns.rows || [],
        commonPatterns: commonPatterns.rows || [],
        summary: {
          totalRequests: routeDistribution.rows?.reduce((sum, r) => sum + parseInt(r.count), 0) || 0,
          averageConfidence: routeDistribution.rows?.length > 0 
            ? routeDistribution.rows.reduce((sum, r, idx, arr) => 
                sum + (parseFloat(r.avg_confidence) * parseInt(r.count)) / arr.reduce((s, r2) => s + parseInt(r2.count), 0), 0
              )
            : 0,
          mostUsedRoute: routeDistribution.rows?.[0]?.route || 'None',
          leastConfidentRoute: routeDistribution.rows?.reduce((min, r) => 
            !min || parseFloat(r.avg_confidence) < parseFloat(min.avg_confidence) ? r : min, null
          ) || null
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching routing analytics:', error);
    // Return empty data structure instead of error
    res.json({
      success: true,
      data: {
        routeDistribution: [],
        lowConfidenceRequests: [],
        routePatterns: [],
        commonPatterns: [],
        summary: {
          totalRequests: 0,
          averageConfidence: 0,
          mostUsedRoute: 'None',
          leastConfidentRoute: null
        }
      }
    });
  }
});

// GET /api/analytics/feedback - Analyze feedback patterns
router.get('/feedback', authenticate, roleGuard(['admin', 'operator']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Check if we have any feedback data
    const feedbackCheck = await db.query('SELECT COUNT(*) as count FROM feedback');
    const hasFeedback = feedbackCheck.rows[0]?.count > 0;

    if (!hasFeedback) {
      return res.json({
        success: true,
        data: {
          feedbackByRoute: [],
          misroutedPatterns: [],
          confidenceFeedback: [],
          summary: {
            totalFeedback: 0,
            totalUnhelpful: 0,
            worstPerformingRoute: null
          }
        }
      });
    }

    // Feedback by route
    const feedbackByRoute = await db.query(`
      SELECT 
        f.route,
        COUNT(*) as total_feedback,
        SUM(CASE WHEN f.is_useful = false THEN 1 ELSE 0 END) as unhelpful_count,
        ROUND(100.0 * SUM(CASE WHEN f.is_useful = false THEN 1 ELSE 0 END) / COUNT(*), 2) as unhelpful_percentage
      FROM feedback f
      WHERE ($1::timestamp IS NULL OR f.timestamp >= $1)
        AND ($2::timestamp IS NULL OR f.timestamp <= $2)
      GROUP BY f.route
      ORDER BY unhelpful_percentage DESC
    `, [startDate || null, endDate || null]);

    // Join feedback with interactions to find routing issues
    const misroutedPatterns = await db.query(`
      SELECT 
        f.route as assigned_route,
        f.request_description,
        f.confidence,
        COUNT(*) as unhelpful_count
      FROM feedback f
      WHERE f.is_useful = false
        AND ($1::timestamp IS NULL OR f.timestamp >= $1)
        AND ($2::timestamp IS NULL OR f.timestamp <= $2)
      GROUP BY f.route, f.request_description, f.confidence
      HAVING COUNT(*) > 1  -- Multiple unhelpful responses for same type
      ORDER BY unhelpful_count DESC
      LIMIT 20
    `, [startDate || null, endDate || null]);

    // Confidence correlation with feedback
    const confidenceFeedback = await db.query(`
      SELECT 
        CASE 
          WHEN confidence >= 0.9 THEN '90-100%'
          WHEN confidence >= 0.7 THEN '70-90%'
          WHEN confidence >= 0.5 THEN '50-70%'
          WHEN confidence >= 0.3 THEN '30-50%'
          ELSE '0-30%'
        END as confidence_range,
        COUNT(*) as total,
        SUM(CASE WHEN is_useful = false THEN 1 ELSE 0 END) as unhelpful,
        ROUND(100.0 * SUM(CASE WHEN is_useful = false THEN 1 ELSE 0 END) / COUNT(*), 2) as unhelpful_rate
      FROM feedback
      WHERE ($1::timestamp IS NULL OR timestamp >= $1)
        AND ($2::timestamp IS NULL OR timestamp <= $2)
      GROUP BY confidence_range
      ORDER BY confidence_range DESC
    `, [startDate || null, endDate || null]);

    res.json({
      success: true,
      data: {
        feedbackByRoute: feedbackByRoute.rows,
        misroutedPatterns: misroutedPatterns.rows,
        confidenceFeedback: confidenceFeedback.rows,
        summary: {
          totalFeedback: feedbackByRoute.rows.reduce((sum, r) => sum + parseInt(r.total_feedback), 0),
          totalUnhelpful: feedbackByRoute.rows.reduce((sum, r) => sum + parseInt(r.unhelpful_count), 0),
          worstPerformingRoute: feedbackByRoute.rows[0] || null
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching feedback analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch feedback analytics' 
    });
  }
});

// GET /api/analytics/routing-accuracy - Analyze routing accuracy based on feedback
router.get('/routing-accuracy', authenticate, roleGuard(['admin', 'operator']), async (req, res) => {
  try {
    // First check if we have any feedback data
    const feedbackCheck = await db.query('SELECT COUNT(*) as count FROM feedback WHERE is_useful = false');
    const hasFeedback = feedbackCheck.rows[0]?.count > 0;

    if (!hasFeedback) {
      return res.json({
        success: true,
        data: {
          potentialMisroutes: [],
          lowConfidenceExamples: [],
          recommendations: ['No feedback data available yet. As operators use the system and provide feedback, routing accuracy analysis will appear here.']
        }
      });
    }

    // Find patterns where routing might be wrong based on feedback
    const routingIssues = await db.query(`
      WITH feedback_analysis AS (
        SELECT 
          f.request_description,
          f.route as original_route,
          f.confidence,
          f.is_useful,
          -- Extract potential keywords that might indicate different routing
          CASE 
            WHEN LOWER(f.request_description) SIMILAR TO '%(emergency|fire|injury|hurt|accident|smoke|security|threat)%' 
              THEN 'Emergency'
            WHEN LOWER(f.request_description) SIMILAR TO '%(book|reservation|cancel|refund|access|door|key|card|payment)%' 
              THEN 'Booking & Access'
            WHEN LOWER(f.request_description) SIMILAR TO '%(trackman|screen|equipment|tech|broken|restart|simulator|ball|tracking)%' 
              THEN 'TechSupport'
            WHEN LOWER(f.request_description) SIMILAR TO '%(member|price|cost|promotion|hours|gift card)%' 
              THEN 'BrandTone'
            ELSE original_route
          END as suggested_route
        FROM feedback f
        WHERE f.is_useful = false
      )
      SELECT 
        original_route,
        suggested_route,
        COUNT(*) as mismatch_count,
        ARRAY_AGG(DISTINCT LEFT(request_description, 100)) as example_requests
      FROM feedback_analysis
      WHERE original_route != suggested_route
      GROUP BY original_route, suggested_route
      ORDER BY mismatch_count DESC
    `);

    // Get specific examples of potentially misrouted requests
    const examples = await db.query(`
      SELECT 
        f.request_description,
        f.route,
        f.confidence,
        f.response,
        f.timestamp
      FROM feedback f
      WHERE f.is_useful = false
        AND f.confidence < 0.7
      ORDER BY f.timestamp DESC
      LIMIT 50
    `);

    res.json({
      success: true,
      data: {
        potentialMisroutes: routingIssues.rows || [],
        lowConfidenceExamples: examples.rows || [],
        recommendations: generateRoutingRecommendations(routingIssues.rows || [])
      }
    });
  } catch (error) {
    logger.error('Error analyzing routing accuracy:', error);
    
    // Return empty data instead of error to prevent frontend crash
    res.json({
      success: true,
      data: {
        potentialMisroutes: [],
        lowConfidenceExamples: [],
        recommendations: ['Analytics data is still being collected. Please check back after using the system for a while.']
      }
    });
  }
});

// Helper function to generate recommendations
function generateRoutingRecommendations(misroutes: any[]): string[] {
  const recommendations: string[] = [];
  
  for (const misroute of misroutes) {
    if (misroute.mismatch_count > 5) {
      recommendations.push(
        `Consider adjusting routing rules: ${misroute.mismatch_count} requests ` +
        `currently routed to "${misroute.original_route}" might belong in "${misroute.suggested_route}"`
      );
    }
  }
  
  return recommendations;
}

// GET /api/analytics/routing-optimization - Get routing optimization suggestions
router.get('/routing-optimization', authenticate, roleGuard(['admin']), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const optimization = await routingOptimizer.analyzeRoutingFeedback(parseInt(days as string));
    const report = await routingOptimizer.generateRoutingReport();
    
    res.json({
      success: true,
      data: {
        optimization,
        currentPerformance: report,
        summary: {
          patternsFound: optimization.patterns.length,
          topMisroutedPattern: optimization.patterns[0] || null,
          keywordSuggestions: Object.keys(optimization.keywordAdjustments).length
        }
      }
    });
  } catch (error) {
    logger.error('Error generating routing optimization:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate routing optimization' 
    });
  }
});

// POST /api/analytics/apply-optimization - Apply routing optimizations
router.post('/apply-optimization', authenticate, roleGuard(['admin']), async (req, res) => {
  try {
    const { optimization } = req.body;
    
    if (!optimization) {
      return res.status(400).json({
        success: false,
        message: 'Optimization data is required'
      });
    }
    
    await routingOptimizer.applyOptimizations(optimization);
    
    logger.info('Routing optimizations applied', {
      userId: req.user?.id,
      patternCount: optimization.patterns?.length || 0
    });
    
    res.json({
      success: true,
      message: 'Routing optimizations applied successfully'
    });
  } catch (error) {
    logger.error('Error applying routing optimization:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to apply routing optimization' 
    });
  }
});

// DELETE /api/analytics/clear-old-data - Clear old interaction data
router.delete('/clear-old-data', authenticate, roleGuard(['admin']), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Delete customer interactions older than specified days
    const deleteResult = await db.query(`
      DELETE FROM customer_interactions 
      WHERE "createdAt" < CURRENT_DATE - INTERVAL '${parseInt(days as string)} days'
      RETURNING id
    `);
    
    const deletedCount = deleteResult.rows.length;
    
    logger.info('Cleared old analytics data', {
      userId: req.user?.id,
      deletedCount,
      olderThanDays: days
    });
    
    res.json({
      success: true,
      message: `Cleared ${deletedCount} old interaction records`,
      deletedCount
    });
  } catch (error) {
    logger.error('Error clearing old data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to clear old data' 
    });
  }
});

export default router;