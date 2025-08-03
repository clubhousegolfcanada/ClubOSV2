import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roleAuth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

const router = Router();

// GET /api/ai-automations - Get all automation features
router.get('/', authenticate, async (req, res) => {
  try {
    const { category, enabled } = req.query;
    
    let query = 'SELECT * FROM ai_automation_features WHERE 1=1';
    const params: any[] = [];
    
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    
    if (enabled !== undefined) {
      params.push(enabled === 'true');
      query += ` AND enabled = $${params.length}`;
    }
    
    // Check user permissions - filter features based on role
    if (req.user?.role !== 'admin') {
      params.push(req.user?.role);
      query += ` AND $${params.length} = ANY(required_permissions)`;
    }
    
    query += ' ORDER BY category, feature_name';
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      features: result.rows
    });
  } catch (error) {
    logger.error('Failed to fetch automation features:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch automation features'
    });
  }
});

// GET /api/ai-automations/:featureKey - Get specific feature details
router.get('/:featureKey', authenticate, async (req, res) => {
  try {
    const { featureKey } = req.params;
    
    const result = await db.query(
      'SELECT * FROM ai_automation_features WHERE feature_key = $1',
      [featureKey]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      });
    }
    
    const feature = result.rows[0];
    
    // Check permissions
    if (req.user?.role !== 'admin' && !feature.required_permissions.includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }
    
    // Get usage stats
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) as total_uses,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_uses,
        AVG(execution_time_ms) as avg_execution_time,
        MAX(created_at) as last_used
      FROM ai_automation_usage
      WHERE feature_id = $1
      AND created_at > NOW() - INTERVAL '30 days'
    `, [feature.id]);
    
    res.json({
      success: true,
      feature: {
        ...feature,
        stats: statsResult.rows[0]
      }
    });
  } catch (error) {
    logger.error('Failed to fetch feature details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feature details'
    });
  }
});

// PUT /api/ai-automations/:featureKey/toggle - Toggle feature on/off
router.put('/:featureKey/toggle', authenticate, requireRole(['admin', 'operator']), async (req, res) => {
  try {
    const { featureKey } = req.params;
    const { enabled } = req.body;
    
    // Check if feature exists and user has permission
    const featureResult = await db.query(
      'SELECT * FROM ai_automation_features WHERE feature_key = $1',
      [featureKey]
    );
    
    if (featureResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      });
    }
    
    const feature = featureResult.rows[0];
    
    // Check permissions
    if (req.user?.role !== 'admin' && !feature.required_permissions.includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to toggle this feature'
      });
    }
    
    // Update feature
    const result = await db.query(
      'UPDATE ai_automation_features SET enabled = $1, updated_at = NOW() WHERE feature_key = $2 RETURNING *',
      [enabled, featureKey]
    );
    
    logger.info('AI automation feature toggled', {
      featureKey,
      enabled,
      toggledBy: req.user?.email
    });
    
    res.json({
      success: true,
      feature: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to toggle feature:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle feature'
    });
  }
});

// Removed duplicate config route - using the one at line ~590

// GET /api/ai-automations/:featureKey/usage - Get usage statistics
router.get('/:featureKey/usage', authenticate, async (req, res) => {
  try {
    const { featureKey } = req.params;
    const { days = 30 } = req.query;
    
    // Get feature ID
    const featureResult = await db.query(
      'SELECT id FROM ai_automation_features WHERE feature_key = $1',
      [featureKey]
    );
    
    if (featureResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      });
    }
    
    const featureId = featureResult.rows[0].id;
    
    // Get usage data
    const usageResult = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_uses,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_uses,
        AVG(execution_time_ms) as avg_execution_time
      FROM ai_automation_usage
      WHERE feature_id = $1
      AND created_at > NOW() - INTERVAL '${parseInt(days as string)} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [featureId]);
    
    // Get recent usage examples
    const examplesResult = await db.query(`
      SELECT 
        created_at,
        success,
        error_message,
        execution_time_ms,
        user_confirmed
      FROM ai_automation_usage
      WHERE feature_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [featureId]);
    
    res.json({
      success: true,
      usage: {
        daily: usageResult.rows,
        recent: examplesResult.rows
      }
    });
  } catch (error) {
    logger.error('Failed to fetch usage data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch usage data'
    });
  }
});

// POST /api/ai-automations/bulk-toggle - Toggle multiple features by category
router.post('/bulk-toggle', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { category, enabled } = req.body;
    
    if (!category || enabled === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Category and enabled status required'
      });
    }
    
    const result = await db.query(
      'UPDATE ai_automation_features SET enabled = $1, updated_at = NOW() WHERE category = $2 RETURNING *',
      [enabled, category]
    );
    
    logger.info('Bulk toggle AI automations', {
      category,
      enabled,
      count: result.rows.length,
      toggledBy: req.user?.email
    });
    
    res.json({
      success: true,
      updated: result.rows.length,
      features: result.rows
    });
  } catch (error) {
    logger.error('Failed to bulk toggle features:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk toggle features'
    });
  }
});

// GET /api/ai-automations/learning-opportunities - View potential new automations
router.get('/learning-opportunities', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { days = 7, minOccurrences = 3 } = req.query;
    
    // Get learning data from the last N days
    const learningData = await db.query(`
      SELECT 
        rule_data->>'detectedFeature' as feature,
        rule_data->>'message' as customer_message,
        rule_data->>'staffResponse' as staff_response,
        COUNT(*) OVER (PARTITION BY rule_data->>'detectedFeature') as feature_count,
        created_at
      FROM ai_automation_rules
      WHERE rule_type = 'missed_automation'
      AND rule_data->>'detectedFeature' IS NOT NULL
      AND created_at > NOW() - INTERVAL '${parseInt(days as string)} days'
      ORDER BY created_at DESC
    `);
    
    // Group by detected feature
    const opportunities = new Map<string, any>();
    
    learningData.rows.forEach(row => {
      if (!opportunities.has(row.feature)) {
        opportunities.set(row.feature, {
          feature: row.feature,
          occurrences: row.feature_count,
          examples: []
        });
      }
      
      const opp = opportunities.get(row.feature);
      if (opp.examples.length < 10) { // Keep up to 10 examples
        opp.examples.push({
          customerMessage: row.customer_message,
          staffResponse: row.staff_response,
          timestamp: row.created_at
        });
      }
    });
    
    // Get patterns that aren't automated yet
    const unautomatedPatterns = await db.query(`
      SELECT 
        rule_data,
        COUNT(*) as occurrence_count
      FROM ai_automation_rules
      WHERE rule_type = 'missed_automation'
      AND rule_data->>'awaitingResponse' = 'false'
      AND rule_data->>'detectedFeature' IS NULL
      AND created_at > NOW() - INTERVAL '${parseInt(days as string)} days'
      GROUP BY rule_data
      HAVING COUNT(*) >= $1
      ORDER BY occurrence_count DESC
      LIMIT 20
    `, [parseInt(minOccurrences as string)]);
    
    res.json({
      success: true,
      data: {
        detectedOpportunities: Array.from(opportunities.values()),
        undetectedPatterns: unautomatedPatterns.rows.map(row => ({
          pattern: row.rule_data.message,
          staffResponse: row.rule_data.staffResponse,
          occurrences: row.occurrence_count
        })),
        summary: {
          totalMissedAutomations: learningData.rows.length,
          uniqueFeatures: opportunities.size,
          dateRange: `Last ${days} days`
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get learning opportunities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get learning opportunities'
    });
  }
});

// GET /api/ai-automations/:featureKey/patterns - Get learned patterns for review
router.get('/:featureKey/patterns', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { featureKey } = req.params;
    const { limit = 100 } = req.query;
    
    // Get feature
    const featureResult = await db.query(
      'SELECT id, config FROM ai_automation_features WHERE feature_key = $1',
      [featureKey]
    );
    
    if (featureResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      });
    }
    
    const feature = featureResult.rows[0];
    
    // Get recent pattern analyses
    const patternsResult = await db.query(`
      SELECT 
        rule_data,
        priority,
        created_at
      FROM ai_automation_rules
      WHERE feature_id = $1
      AND rule_type = 'pattern_analysis'
      ORDER BY created_at DESC
      LIMIT $2
    `, [feature.id, parseInt(limit as string)]);
    
    // Aggregate patterns by confidence
    const patternMap = new Map<string, { count: number; avgConfidence: number; examples: string[] }>();
    
    patternsResult.rows.forEach(row => {
      const data = row.rule_data;
      data.matchedPatterns?.forEach((pattern: string) => {
        if (!patternMap.has(pattern)) {
          patternMap.set(pattern, { count: 0, avgConfidence: 0, examples: [] });
        }
        const stats = patternMap.get(pattern)!;
        stats.count++;
        stats.avgConfidence = (stats.avgConfidence * (stats.count - 1) + data.confidenceScore) / stats.count;
        if (stats.examples.length < 3) {
          stats.examples.push(data.message);
        }
      });
    });
    
    // Convert to array and sort by frequency
    const patterns = Array.from(patternMap.entries())
      .map(([pattern, stats]) => ({ pattern, ...stats }))
      .sort((a, b) => b.count - a.count);
    
    res.json({
      success: true,
      feature: {
        featureKey,
        config: feature.config,
        learnedPatterns: feature.config.learnedPatterns || {}
      },
      recentPatterns: patterns,
      totalAnalyses: patternsResult.rows.length
    });
  } catch (error) {
    logger.error('Failed to get patterns:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get patterns'
    });
  }
});

// GET /api/ai-automations/conversation-stats - Get conversation statistics by assistant type
router.get('/conversation-stats', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Get conversation distribution by assistant type
    const typeDistribution = await db.query(`
      SELECT 
        COALESCE(assistant_type, 'Uncategorized') as assistant_type,
        COUNT(*) as conversation_count,
        COUNT(DISTINCT phone_number) as unique_customers,
        SUM(jsonb_array_length(messages)) as total_messages
      FROM openphone_conversations
      WHERE created_at > NOW() - INTERVAL '${parseInt(days as string)} days'
      GROUP BY assistant_type
      ORDER BY conversation_count DESC
    `);
    
    // Get automation performance by assistant type
    const automationStats = await db.query(`
      SELECT 
        rule_data->>'assistantType' as assistant_type,
        COUNT(*) as missed_automations,
        COUNT(CASE WHEN rule_data->>'detectedFeature' IS NOT NULL THEN 1 END) as learned_patterns
      FROM ai_automation_rules
      WHERE rule_type = 'missed_automation'
      AND created_at > NOW() - INTERVAL '${parseInt(days as string)} days'
      GROUP BY rule_data->>'assistantType'
    `);
    
    // Get daily trends
    const dailyTrends = await db.query(`
      SELECT 
        DATE(created_at) as date,
        assistant_type,
        COUNT(*) as conversations
      FROM openphone_conversations
      WHERE created_at > NOW() - INTERVAL '${parseInt(days as string)} days'
      AND assistant_type IS NOT NULL
      GROUP BY DATE(created_at), assistant_type
      ORDER BY date DESC, assistant_type
    `);
    
    res.json({
      success: true,
      data: {
        distribution: typeDistribution.rows,
        automationPerformance: automationStats.rows,
        dailyTrends: dailyTrends.rows,
        period: `Last ${days} days`
      }
    });
  } catch (error) {
    logger.error('Failed to get conversation stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get conversation statistics'
    });
  }
});

// Helper function to check if a feature is enabled
export async function isAutomationEnabled(featureKey: string): Promise<boolean> {
  try {
    const result = await db.query(
      'SELECT enabled FROM ai_automation_features WHERE feature_key = $1',
      [featureKey]
    );
    
    return result.rows.length > 0 && result.rows[0].enabled;
  } catch (error) {
    logger.error('Failed to check automation status:', error);
    return false;
  }
}

// Helper function to log automation usage
export async function logAutomationUsage(
  featureKey: string,
  data: {
    conversationId?: string;
    triggerType: 'automatic' | 'manual' | 'scheduled';
    inputData?: any;
    outputData?: any;
    success: boolean;
    errorMessage?: string;
    executionTimeMs?: number;
    userConfirmed?: boolean;
  }
): Promise<void> {
  try {
    // Get feature ID
    const featureResult = await db.query(
      'SELECT id FROM ai_automation_features WHERE feature_key = $1',
      [featureKey]
    );
    
    if (featureResult.rows.length === 0) {
      logger.warn('Attempted to log usage for non-existent feature:', featureKey);
      return;
    }
    
    const featureId = featureResult.rows[0].id;
    
    await db.query(`
      INSERT INTO ai_automation_usage 
      (feature_id, conversation_id, trigger_type, input_data, output_data, 
       success, error_message, execution_time_ms, user_confirmed)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      featureId,
      data.conversationId || null,
      data.triggerType,
      data.inputData ? JSON.stringify(data.inputData) : null,
      data.outputData ? JSON.stringify(data.outputData) : null,
      data.success,
      data.errorMessage || null,
      data.executionTimeMs || null,
      data.userConfirmed || false
    ]);
  } catch (error) {
    logger.error('Failed to log automation usage:', error);
  }
}

// PUT /api/ai-automations/:featureKey/config - Update feature configuration
router.put('/:featureKey/config', authenticate, roleGuard(['admin', 'operator']), async (req, res) => {
  try {
    const { featureKey } = req.params;
    const { config, allow_follow_up } = req.body;
    
    if (!config || typeof config !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid configuration data'
      });
    }
    
    // Update the feature configuration and allow_follow_up if provided
    let query = 'UPDATE ai_automation_features SET config = $1, updated_at = NOW()';
    let params = [JSON.stringify(config)];
    
    if (allow_follow_up !== undefined) {
      query += ', allow_follow_up = $3';
      params.push(allow_follow_up);
    }
    
    query += ' WHERE feature_key = $2 RETURNING *';
    params.splice(params.length - 1, 0, featureKey); // Insert featureKey at correct position
    
    const result = await db.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      });
    }
    
    logger.info('AI automation config updated', {
      featureKey,
      updatedBy: req.user?.email,
      changes: {
        responseSource: config.responseSource,
        maxResponses: config.maxResponses,
        hasHardcodedResponse: !!config.hardcodedResponse
      }
    });
    
    res.json({
      success: true,
      feature: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to update automation config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update configuration'
    });
  }
});

export default router;