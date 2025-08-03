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

// PUT /api/ai-automations/:featureKey/config - Update feature configuration
router.put('/:featureKey/config', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { featureKey } = req.params;
    const { config } = req.body;
    
    // Validate config is an object
    if (typeof config !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Config must be an object'
      });
    }
    
    const result = await db.query(
      'UPDATE ai_automation_features SET config = $1, updated_at = NOW() WHERE feature_key = $2 RETURNING *',
      [JSON.stringify(config), featureKey]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      });
    }
    
    logger.info('AI automation config updated', {
      featureKey,
      updatedBy: req.user?.email
    });
    
    res.json({
      success: true,
      feature: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to update config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update configuration'
    });
  }
});

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

export default router;