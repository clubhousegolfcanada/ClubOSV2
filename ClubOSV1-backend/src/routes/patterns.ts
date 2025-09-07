/**
 * Pattern Learning API Routes
 * 
 * BREADCRUMB: API endpoints for managing the pattern learning system
 * These routes allow operators to view, manage, and configure patterns
 * 
 * Author: Claude
 * Date: 2025-09-01
 * 
 * TODO: After creating this file:
 * 1. Import and mount in src/index.ts: app.use('/api/patterns', patternsRouter);
 * 2. Test endpoints with Postman or curl
 * 3. Add authentication middleware for production
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { patternLearningService } from '../services/patternLearningService';
import { patternSafetyService } from '../services/patternSafetyService';
import { body, param, query, validationResult } from 'express-validator';
import OpenAI from 'openai';
import crypto from 'crypto';

const router = Router();

// BREADCRUMB: All routes require authentication and admin/operator role
// This ensures only authorized users can manage patterns

/**
 * GET /api/patterns
 * Get all active (non-deleted) patterns
 */
router.get('/',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      // Get query parameters for filtering
      const { includeDeleted = 'false', includeInactive = 'false' } = req.query;
      
      // Build WHERE clause
      const conditions = [];
      if (includeDeleted !== 'true') {
        conditions.push('(is_deleted = false OR is_deleted IS NULL)');
      }
      if (includeInactive !== 'true') {
        conditions.push('is_active = true');
      }
      
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';
      
      const result = await db.query(`
        SELECT 
          id,
          pattern_type,
          pattern,
          response_template,
          trigger_examples,
          trigger_keywords,
          confidence_score,
          execution_count,
          success_count,
          is_active,
          is_deleted,
          created_at,
          updated_at,
          CASE 
            WHEN success_count > 0 AND execution_count > 0 
            THEN ROUND((success_count::float / execution_count::float * 100)::numeric, 0)
            ELSE 0 
          END as success_rate,
          CASE 
            WHEN updated_at IS NOT NULL THEN updated_at
            ELSE created_at
          END as last_used
        FROM patterns
        ${whereClause}
        ORDER BY 
          is_active DESC,
          confidence_score DESC,
          execution_count DESC
      `);
      
      logger.info(`[Patterns API] Fetched ${result.rows.length} patterns (includeDeleted: ${includeDeleted}, includeInactive: ${includeInactive})`);
      
      res.json({
        success: true,
        patterns: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      logger.error('[Patterns API] Error fetching patterns:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch patterns' 
      });
    }
  }
);

/**
 * GET /api/patterns/config
 * Get pattern learning configuration
 */
router.get('/config',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        'SELECT config_key, config_value, description FROM pattern_learning_config ORDER BY config_key'
      );
      
      // Format config for UI - return flat object with actual types
      const config = result.rows.reduce((acc, row) => {
        const key = row.config_key;
        const value = row.config_value;
        
        // Convert boolean strings to actual booleans
        if (value === 'true' || value === 'false') {
          acc[key] = value === 'true';
        } else if (!isNaN(parseFloat(value))) {
          // Convert numeric strings to numbers
          acc[key] = parseFloat(value);
        } else {
          acc[key] = value;
        }
        return acc;
      }, {} as any);
      
      // Ensure required fields exist for UI
      config.enabled = config.enabled ?? false;
      config.shadow_mode = config.shadow_mode ?? true;
      config.min_confidence_to_act = config.min_confidence_to_act ?? 0.95;
      config.min_confidence_to_suggest = config.min_confidence_to_suggest ?? 0.7;
      config.min_occurrences_to_learn = config.min_occurrences_to_learn ?? 3;
      
      res.json(config);
    } catch (error) {
      logger.error('[Patterns API] Failed to get config', error);
      res.status(500).json({ success: false, error: 'Failed to get configuration' });
    }
  }
);

/**
 * PUT /api/patterns/config
 * Update pattern learning configuration
 * BREADCRUMB: Use this to enable/disable pattern learning or change to production mode
 */
router.put('/config',
  authenticate,
  roleGuard(['admin']), // Only admins can change config
  async (req: Request, res: Response) => {
    try {
      const updates = req.body;
      
      // Handle both single key-value and multiple updates
      const entries = updates.key && updates.value 
        ? [[updates.key, updates.value]]  // Old format
        : Object.entries(updates);  // New format with multiple keys
      
      for (const [key, value] of entries) {
        // Update configuration
        await db.query(
          'UPDATE pattern_learning_config SET config_value = $1, updated_at = NOW() WHERE config_key = $2',
          [String(value), key]
        );
        
        logger.info('[Patterns API] Configuration updated', {
          key,
          value,
          updatedBy: (req as any).user?.id
        });
      }
      
      res.json({ success: true, message: 'Configuration updated' });
    } catch (error) {
      logger.error('[Patterns API] Failed to update config', error);
      res.status(500).json({ success: false, error: 'Failed to update configuration' });
    }
  }
);

/**
 * GET /api/patterns
 * Get all patterns with filtering and pagination
 */
router.get('/',
  authenticate,
  roleGuard(['admin', 'operator']),
  [
    query('type').optional().isString(),
    query('minConfidence').optional().isFloat({ min: 0, max: 1 }),
    query('autoExecutable').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  async (req: Request, res: Response) => {
    try {
      const {
        type,
        minConfidence = 0,
        autoExecutable,
        limit = 50,
        offset = 0
      } = req.query;

      let queryStr = `
        SELECT 
          p.*,
          COALESCE(p.success_count::float / NULLIF(p.execution_count, 0), 0) as success_rate,
          COUNT(peh.id) as recent_executions
        FROM decision_patterns p
        LEFT JOIN pattern_execution_history peh ON p.id = peh.pattern_id
          AND peh.created_at > NOW() - INTERVAL '7 days'
        WHERE COALESCE(p.is_deleted, FALSE) = FALSE
      `;

      const params: any[] = [];
      let paramCount = 0;

      if (type) {
        queryStr += ` AND p.pattern_type = $${++paramCount}`;
        params.push(type);
      }

      if (minConfidence) {
        queryStr += ` AND p.confidence_score >= $${++paramCount}`;
        params.push(minConfidence);
      }

      if (autoExecutable !== undefined) {
        queryStr += ` AND p.auto_executable = $${++paramCount}`;
        params.push(autoExecutable === 'true');
      }

      queryStr += `
        GROUP BY p.id
        ORDER BY p.confidence_score DESC, p.execution_count DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;
      
      params.push(limit, offset);

      const result = await db.query(queryStr, params);

      // Get total count for pagination
      const countResult = await db.query(
        'SELECT COUNT(*) FROM decision_patterns'
      );

      res.json({
        success: true,
        patterns: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to get patterns', error);
      res.status(500).json({ success: false, error: 'Failed to get patterns' });
    }
  }
);

// ============================================
// SPECIFIC ROUTES (must be defined before /:id)
// ============================================

/**
 * GET /api/patterns/deleted
 * Get deleted patterns (for archive view)
 */
router.get('/deleted',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const result = await db.query(`
        SELECT 
          p.*,
          u.name as deleted_by_name
        FROM decision_patterns p
        LEFT JOIN users u ON p.deleted_by = u.id
        WHERE COALESCE(p.is_deleted, FALSE) = TRUE
        ORDER BY p.deleted_at DESC
        LIMIT 50
      `);

      res.json({
        success: true,
        patterns: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to get deleted patterns', error);
      res.status(500).json({ success: false, error: 'Failed to get deleted patterns' });
    }
  }
);

/**
 * GET /api/patterns/stats
 * Get pattern learning statistics
 */
router.get('/stats',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      // Get overall stats - count ALL patterns and active ones separately
      const statsResult = await db.query(`
        SELECT 
          COUNT(*) as total_all_patterns,
          COUNT(*) FILTER (WHERE is_active = TRUE) as total_patterns,
          COUNT(*) FILTER (WHERE is_active = TRUE AND auto_executable = TRUE) as auto_executable_patterns,
          COUNT(*) FILTER (WHERE is_active = TRUE AND confidence_score >= 0.95) as high_confidence_patterns,
          COUNT(*) FILTER (WHERE is_active = TRUE AND confidence_score >= 0.75) as medium_confidence_patterns,
          COUNT(*) FILTER (WHERE is_active = TRUE AND confidence_score < 0.75) as low_confidence_patterns,
          AVG(CASE WHEN is_active = TRUE THEN confidence_score ELSE NULL END) as avg_confidence,
          SUM(CASE WHEN is_active = TRUE THEN execution_count ELSE 0 END) as total_executions,
          SUM(CASE WHEN is_active = TRUE THEN success_count ELSE 0 END) as total_successes,
          AVG(CASE WHEN is_active = TRUE AND execution_count > 0 
            THEN success_count::float / execution_count 
            ELSE 0 END) as avg_success_rate
        FROM decision_patterns
      `);

      // Get config for UI
      const configResult = await db.query(`
        SELECT config_key, config_value 
        FROM pattern_learning_config 
        WHERE config_key IN ('enabled', 'shadow_mode', 'min_confidence_to_act', 'min_confidence_to_suggest')
      `);
      
      const config = configResult.rows.reduce((acc, row) => {
        if (row.config_key === 'enabled' || row.config_key === 'shadow_mode') {
          acc[row.config_key] = row.config_value === 'true';
        } else {
          acc[row.config_key] = parseFloat(row.config_value) || 0;
        }
        return acc;
      }, {} as any);

      // Get pending suggestions count
      const suggestionsResult = await db.query(
        'SELECT COUNT(*) as count FROM pattern_suggestions_queue WHERE status = $1',
        ['pending']
      );

      // Format response for UI
      const stats = statsResult.rows[0];
      
      // Get executions today and this week
      const todayResult = await db.query(`
        SELECT COUNT(*) as count 
        FROM pattern_execution_history 
        WHERE created_at >= CURRENT_DATE
      `);
      
      const weekResult = await db.query(`
        SELECT COUNT(*) as count 
        FROM pattern_execution_history 
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      `);
      
      // Get top pattern types
      const topPatternsResult = await db.query(`
        SELECT pattern_type, COUNT(*) as execution_count
        FROM decision_patterns
        WHERE is_active = TRUE
        GROUP BY pattern_type
        ORDER BY execution_count DESC
        LIMIT 5
      `);
      
      res.json({
        // New fields for the header component - show ACTUAL active patterns
        totalPatterns: parseInt(stats.total_all_patterns) || 0,
        activePatterns: parseInt(stats.total_patterns) || 0,  // This is the count of is_active = TRUE
        executionsToday: parseInt(todayResult.rows[0]?.count) || 0,
        executionsThisWeek: parseInt(weekResult.rows[0]?.count) || 0,
        successRate: Math.round((parseFloat(stats.avg_success_rate) || 0) * 100),
        avgConfidence: Math.round((parseFloat(stats.avg_confidence) || 0) * 100),
        topPatterns: topPatternsResult.rows || [],
        
        // Original fields (for backward compatibility)
        patterns: {
          total: parseInt(stats.total_patterns) || 0,  // Active patterns for compatibility
          avgConfidence: parseFloat(stats.avg_confidence) || 0
        },
        executions: {
          total: parseInt(stats.total_executions) || 0,
          live: parseInt(stats.total_successes) || 0
        },
        suggestions: {
          pending: parseInt(suggestionsResult.rows[0]?.count) || 0
        },
        config: {
          enabled: config.enabled || false,
          shadow_mode: config.shadow_mode || false,
          min_confidence_to_act: config.min_confidence_to_act || 0.95
        }
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to get stats', error);
      res.status(500).json({ success: false, error: 'Failed to get statistics' });
    }
  }
);

/**
 * GET /api/patterns/safety-settings
 * Get pattern safety settings
 */
router.get('/safety-settings',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const settings = await patternSafetyService.getSettings();
      res.json(settings);
    } catch (error) {
      logger.error('[Patterns API] Failed to get safety settings', error);
      res.status(500).json({ success: false, error: 'Failed to get safety settings' });
    }
  }
);

/**
 * PUT /api/patterns/safety-settings
 * Update pattern safety settings
 */
router.put('/safety-settings',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response) => {
    try {
      await patternSafetyService.updateSettings(req.body);
      res.json({ success: true, message: 'Safety settings updated' });
    } catch (error) {
      logger.error('[Patterns API] Failed to update safety settings', error);
      res.status(500).json({ success: false, error: 'Failed to update safety settings' });
    }
  }
);

/**
 * POST /api/patterns/check-safety
 * Check if a message passes safety checks
 */
router.post('/check-safety',
  authenticate,
  roleGuard(['admin', 'operator']),
  [body('message').isString().notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      const result = await patternSafetyService.checkMessageSafety(message);
      res.json(result);
    } catch (error) {
      logger.error('[Patterns API] Failed to check message safety', error);
      res.status(500).json({ success: false, error: 'Failed to check message safety' });
    }
  }
);

/**
 * GET /api/patterns/ai-automations
 * Get AI automation settings
 */
router.get('/ai-automations',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const result = await db.query(`
        SELECT 
          af.feature_key,
          af.enabled,
          af.description
        FROM ai_automation_features af
        WHERE af.feature_key IN ('gift_card_inquiries', 'llm_initial_analysis', 'trackman_reset')
      `);

      const automations = result.rows.reduce((acc, row) => {
        const camelKey = row.feature_key.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
        acc[camelKey] = row.enabled;
        return acc;
      }, {} as any);

      res.json({
        giftCardInquiries: automations.giftCardInquiries || false,
        llmInitialAnalysis: automations.llmInitialAnalysis || false,
        trackmanReset: automations.trackmanReset || false
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to get AI automations', error);
      res.status(500).json({ success: false, error: 'Failed to get AI automations' });
    }
  }
);

/**
 * PUT /api/patterns/ai-automations
 * Update AI automation settings
 */
router.put('/ai-automations',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response) => {
    try {
      const updates = req.body;
      
      for (const [key, value] of Object.entries(updates)) {
        const snakeKey = key.replace(/[A-Z]/g, (letter: string) => `_${letter.toLowerCase()}`);
        
        await db.query(
          'UPDATE ai_automation_features SET enabled = $1 WHERE feature_key = $2',
          [value, snakeKey]
        );
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('[Patterns API] Failed to update AI automations', error);
      res.status(500).json({ success: false, error: 'Failed to update AI automations' });
    }
  }
);

/**
 * GET /api/patterns/execution-history
 * Get recent pattern execution history
 */
router.get('/execution-history',
  authenticate,
  roleGuard(['admin', 'operator']),
  [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('patternId').optional().isInt()
  ],
  async (req: Request, res: Response) => {
    try {
      const { limit = 20, patternId } = req.query;
      
      let queryStr = `
        SELECT 
          peh.*,
          dp.pattern_type,
          dp.trigger_text,
          dp.response_template,
          u.name as reviewed_by_name
        FROM pattern_execution_history peh
        JOIN decision_patterns dp ON peh.pattern_id = dp.id
        LEFT JOIN users u ON peh.reviewed_by = u.id
      `;
      
      const params: any[] = [];
      
      if (patternId) {
        queryStr += ' WHERE peh.pattern_id = $1';
        params.push(patternId);
      }
      
      queryStr += ' ORDER BY peh.created_at DESC LIMIT $' + (params.length + 1);
      params.push(limit);
      
      const result = await db.query(queryStr, params);
      
      res.json({
        success: true,
        history: result.rows
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to get execution history', error);
      res.status(500).json({ success: false, error: 'Failed to get execution history' });
    }
  }
);

/**
 * POST /api/patterns/test
 * Test a message against patterns without executing
 */
router.post('/test',
  authenticate,
  roleGuard(['admin', 'operator']),
  [body('message').isString().notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const { message } = req.body;

      const result = await patternLearningService.processMessage(
        message,
        'TEST_PHONE',
        'TEST_CONVERSATION',
        'Test Customer'
      );

      res.json({
        success: true,
        message,
        result,
        wouldExecute: result.action === 'auto_execute',
        confidence: result.confidence
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to test pattern', error);
      res.status(500).json({ success: false, error: 'Failed to test pattern' });
    }
  }
);

/**
 * POST /api/patterns
 * Create a new pattern manually
 */
router.post('/',
  authenticate,
  roleGuard(['admin', 'operator']),
  [
    body('pattern_type').isString().notEmpty(),
    body('trigger_examples').isArray().notEmpty(),
    body('trigger_keywords').optional().isArray(),
    body('response_template').isString().notEmpty(),
    body('confidence_score').optional().isFloat({ min: 0, max: 1 }),
    body('auto_executable').optional().isBoolean(),
    body('semantic_search_enabled').optional().isBoolean()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const {
        pattern_type,
        trigger_examples,
        trigger_keywords,
        response_template,
        confidence_score = 0.7,
        auto_executable = false,
        semantic_search_enabled = true
      } = req.body;

      // Generate pattern signature from first trigger example
      const pattern_signature = crypto.createHash('md5')
        .update(trigger_examples[0].toLowerCase())
        .digest('hex');

      // Check for duplicate patterns using signature
      const existingPattern = await db.query(
        'SELECT id FROM decision_patterns WHERE pattern_signature = $1',
        [pattern_signature]
      );

      if (existingPattern.rows.length > 0) {
        return res.status(409).json({ 
          success: false, 
          error: 'A pattern with similar trigger already exists',
          existingPatternId: existingPattern.rows[0].id
        });
      }
      
      // Check for semantically similar patterns if embeddings are enabled
      if (semantic_search_enabled && process.env.OPENAI_API_KEY) {
        try {
          // First generate embedding for the new pattern
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const newEmbeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: trigger_examples.join(' ')
          });
          const newEmbedding = newEmbeddingResponse.data[0].embedding;
          
          // Check similarity with existing patterns that have embeddings
          const similarPatterns = await db.query(`
            SELECT 
              id, 
              pattern_type,
              trigger_text,
              response_template,
              cosine_similarity(embedding, $1::float[]) as similarity
            FROM decision_patterns
            WHERE embedding IS NOT NULL
              AND is_active = true
            HAVING cosine_similarity(embedding, $1::float[]) > 0.85
            ORDER BY similarity DESC
            LIMIT 3
          `, [`{${newEmbedding.join(',')}}`]);
          
          if (similarPatterns.rows.length > 0) {
            const topMatch = similarPatterns.rows[0];
            logger.info('[Patterns API] Found semantically similar pattern', {
              similarity: topMatch.similarity,
              existingPattern: topMatch.trigger_text
            });
            
            // Warn about high similarity but don't block
            if (topMatch.similarity > 0.95) {
              return res.status(409).json({
                success: false,
                error: `Very similar pattern already exists: "${topMatch.trigger_text}"`,
                existingPatternId: topMatch.id,
                similarity: Math.round(topMatch.similarity * 100) + '%',
                suggestion: 'Consider editing the existing pattern instead'
              });
            }
          }
        } catch (simError) {
          logger.error('[Patterns API] Failed to check semantic similarity', simError);
          // Continue without similarity check
        }
      }

      // Use GPT-4o to expand trigger examples and extract better keywords
      let expandedTriggers = trigger_examples;
      let intelligentKeywords = trigger_keywords;
      
      if (process.env.OPENAI_API_KEY) {
        try {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          
          // Expand trigger examples using GPT-4o
          const expansionResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `You are helping create pattern triggers for a golf simulator business customer service AI.
                Given a few trigger examples, generate 5-10 more variations that customers might actually use.
                Include formal, casual, misspelled, and action-oriented versions.
                Return JSON: {triggers: string[], keywords: string[]}`
              },
              {
                role: 'user',
                content: `Pattern type: ${pattern_type}\nExisting triggers: ${JSON.stringify(trigger_examples)}\n\nGenerate more trigger variations and extract key unique words.`
              }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
            max_tokens: 500
          });

          const expansion = JSON.parse(expansionResponse.choices[0].message.content || '{}');
          
          // Combine original and expanded triggers (limit to 10 total)
          expandedTriggers = [...new Set([...trigger_examples, ...(expansion.triggers || [])])].slice(0, 10);
          
          // Use GPT-4o suggested keywords if better than simple extraction
          if (expansion.keywords && expansion.keywords.length > 0) {
            intelligentKeywords = expansion.keywords;
          }
          
          logger.info('[Patterns API] GPT-4o expanded triggers', { 
            original: trigger_examples.length, 
            expanded: expandedTriggers.length,
            keywords: intelligentKeywords?.length 
          });
        } catch (expandError) {
          logger.error('[Patterns API] Failed to expand triggers with GPT-4o', expandError);
          // Continue with original triggers
        }
      }
      
      // Fallback keyword extraction if GPT-4o didn't provide any
      const keywords = intelligentKeywords || trigger_examples.flatMap((example: string) => {
        const words = example.toLowerCase().split(/\s+/);
        const stopWords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'how', 'what', 'when', 'where', 'why'];
        return words.filter(word => word.length > 2 && !stopWords.includes(word));
      });

      // Generate embeddings from ALL expanded triggers for better matching
      let embedding = null;
      if (semantic_search_enabled && process.env.OPENAI_API_KEY) {
        try {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          // Use expanded triggers for embedding to capture more variations
          const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: expandedTriggers.join(' ')
          });
          embedding = embeddingResponse.data[0].embedding;
        } catch (embError) {
          logger.error('[Patterns API] Failed to generate embedding', embError);
          // Continue without embedding
        }
      }

      // Optimize and validate response template with GPT-4o
      let optimizedResponse = response_template;
      let gpt4o_validated = false;
      
      if (process.env.OPENAI_API_KEY) {
        try {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const optimizationResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `You are optimizing response templates for a golf simulator business.
                Rules:
                1. Answer must be in the FIRST sentence (no greetings first)
                2. Include specific actionable next steps
                3. Keep friendly but professional Clubhouse tone
                4. Format with line breaks for readability
                5. Preserve all URLs, prices, and specific information exactly
                6. Keep under 100 words
                Return JSON: {optimized: string, valid: boolean, improvements: string[]}`
              },
              {
                role: 'user',
                content: `Pattern type: ${pattern_type}\nOriginal response: ${response_template}\n\nOptimize this response to be more effective.`
              }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 500
          });

          const optimization = JSON.parse(optimizationResponse.choices[0].message.content || '{}');
          
          // Use optimized version if it's better
          if (optimization.optimized && optimization.valid) {
            optimizedResponse = optimization.optimized;
            gpt4o_validated = true;
            
            logger.info('[Patterns API] GPT-4o optimized response', {
              original_length: response_template.length,
              optimized_length: optimizedResponse.length,
              improvements: optimization.improvements
            });
          }
        } catch (optError) {
          logger.error('[Patterns API] Failed to optimize with GPT-4o', optError);
          // Continue with original response
        }
      }

      // Insert the new pattern with expanded triggers and optimized response
      const result = await db.query(`
        INSERT INTO decision_patterns (
          pattern_type,
          pattern_signature,
          pattern,
          trigger_text,
          trigger_examples,
          trigger_keywords,
          response_template,
          confidence_score,
          auto_executable,
          semantic_search_enabled,
          embedding,
          gpt4o_validated,
          created_from,
          created_by,
          is_active,
          notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `, [
        pattern_type,
        pattern_signature,
        trigger_examples[0], // Use first example as main pattern
        trigger_examples[0],
        expandedTriggers, // Use expanded triggers for better matching
        keywords,
        optimizedResponse, // Use optimized response
        confidence_score,
        auto_executable,
        semantic_search_enabled,
        embedding ? `{${embedding.join(',')}}` : null,
        gpt4o_validated,
        'manual',
        (req as any).user?.id,
        true, // Active by default
        `Manually created by ${(req as any).user?.name || 'operator'}. Triggers expanded from ${trigger_examples.length} to ${expandedTriggers.length}`
      ]);

      // Log the creation for audit
      logger.info('[Patterns API] Pattern manually created', {
        patternId: result.rows[0].id,
        patternType: pattern_type,
        createdBy: (req as any).user?.id,
        triggerExamples: trigger_examples.length,
        hasEmbedding: !!embedding,
        gpt4oValidated: gpt4o_validated
      });

      res.json({
        success: true,
        pattern: result.rows[0],
        message: 'Pattern created successfully',
        enhancements: {
          triggersExpanded: `${trigger_examples.length} → ${expandedTriggers.length}`,
          responseOptimized: optimizedResponse !== response_template,
          gpt4oValidated: gpt4o_validated,
          semanticSearchEnabled: semantic_search_enabled,
          embeddingGenerated: !!embedding
        }
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to create pattern', error);
      res.status(500).json({ success: false, error: 'Failed to create pattern' });
    }
  }
);

/**
 * GET /api/patterns/import-history
 * Get history of CSV imports
 */
router.get('/import-history',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        `SELECT 
          id,
          status,
          total_messages,
          processed_messages,
          duplicate_messages,
          conversations_found,
          conversations_analyzed,
          patterns_created,
          patterns_enhanced,
          started_at,
          completed_at,
          import_metadata
        FROM pattern_import_jobs
        WHERE user_id = $1 OR $2 = 'admin'
        ORDER BY started_at DESC
        LIMIT 20`,
        [(req as any).user?.id, (req as any).user?.role]
      );
      
      res.json({
        success: true,
        imports: result.rows
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to get import history', error);
      res.status(500).json({ success: false, error: 'Failed to get import history' });
    }
  }
);

/**
 * POST /api/patterns/import-csv
 * Import OpenPhone CSV data and extract patterns using GPT-4o
 */
router.post('/import-csv',
  authenticate,
  roleGuard(['admin', 'operator']),
  [body('csvData').isString().notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const { csvData, importType = 'csv' } = req.body;
      
      // Better CSV parsing that handles commas in message text
      const parseCSVLine = (line: string): string[] => {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };
      
      // Parse CSV data
      const lines = csvData.split('\n');
      const headers = parseCSVLine(lines[0]);
      
      // Find column indices - handle both formats
      const idCol = headers.indexOf('id');
      const bodyCol = headers.indexOf('body') !== -1 ? headers.indexOf('body') : headers.indexOf('conversationBody');
      const conversationIdCol = headers.indexOf('conversationId');
      const directionCol = headers.indexOf('direction');
      const fromCol = headers.indexOf('from');
      const toCol = headers.indexOf('to');
      const sentAtCol = headers.indexOf('sentAt');
      const createdAtCol = headers.indexOf('createdAt');
      
      if (bodyCol === -1 || directionCol === -1) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid CSV format. Required columns: body (or conversationBody), direction' 
        });
      }
      
      // Parse messages
      const messages = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = parseCSVLine(line);
        if (cols.length >= headers.length) {
          messages.push({
            id: cols[idCol] || '',
            conversationId: conversationIdCol !== -1 ? cols[conversationIdCol] : '',
            body: cols[bodyCol] || '',
            direction: cols[directionCol] || '',
            from: cols[fromCol] || '',
            to: cols[toCol] || '',
            sentAt: cols[sentAtCol] || cols[createdAtCol] || ''
          });
        }
      }
      
      logger.info(`[Patterns Import] Processing ${messages.length} messages`);
      
      // Create import job record
      const fileHash = crypto.createHash('sha256').update(csvData).digest('hex');
      
      // Check if this exact file was already imported
      const existingImport = await db.query(
        'SELECT id, completed_at FROM pattern_import_jobs WHERE file_hash = $1 AND status = $2',
        [fileHash, 'completed']
      );
      
      if (existingImport.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: `This exact CSV file was already imported on ${new Date(existingImport.rows[0].completed_at).toLocaleString()}`,
          importId: existingImport.rows[0].id
        });
      }
      
      // Create new import job
      const importJob = await db.query(
        `INSERT INTO pattern_import_jobs (
          user_id, status, total_messages, file_hash, import_metadata
        ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          (req as any).user?.id,
          'processing',
          messages.length,
          fileHash,
          JSON.stringify({
            startDate: messages[0]?.sentAt,
            endDate: messages[messages.length - 1]?.sentAt,
            columnHeaders: headers
          })
        ]
      );
      
      const jobId = importJob.rows[0].id;
      let duplicateCount = 0;
      let newMessageCount = 0;
      
      // Check for duplicate messages
      const filteredMessages = [];
      for (const msg of messages) {
        const messageHash = crypto.createHash('sha256')
          .update(`${msg.body}${msg.from}${msg.to}${msg.sentAt}`)
          .digest('hex');
        
        // Check if message was already imported
        const isDuplicate = await db.query(
          'SELECT 1 FROM imported_messages WHERE message_id = $1 OR message_hash = $2',
          [msg.id, messageHash]
        );
        
        if (isDuplicate.rows.length === 0) {
          filteredMessages.push(msg);
          newMessageCount++;
          
          // Record imported message
          await db.query(
            `INSERT INTO imported_messages (
              message_id, message_hash, phone_number, direction, sent_at, import_job_id
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (message_id) DO NOTHING`,
            [
              msg.id,
              messageHash,
              msg.direction === 'incoming' ? msg.from : msg.to,
              msg.direction,
              msg.sentAt ? new Date(msg.sentAt) : null,
              jobId
            ]
          );
        } else {
          duplicateCount++;
        }
      }
      
      logger.info(`[Patterns Import] Found ${duplicateCount} duplicate messages, processing ${newMessageCount} new messages`);
      
      // If all messages are duplicates, return early
      if (newMessageCount === 0) {
        await db.query(
          `UPDATE pattern_import_jobs 
           SET status = $1, completed_at = NOW(), duplicate_messages = $2
           WHERE id = $3`,
          ['completed', duplicateCount, jobId]
        );
        
        return res.json({
          success: true,
          totalMessages: messages.length,
          duplicateMessages: duplicateCount,
          newMessages: 0,
          message: 'All messages in this CSV have already been imported'
        });
      }
      
      // Sort filtered messages by timestamp
      filteredMessages.sort((a, b) => {
        const timeA = new Date(a.sentAt || 0).getTime();
        const timeB = new Date(b.sentAt || 0).getTime();
        return timeA - timeB;
      });
      
      // Group messages into conversations using conversation IDs and dynamic time windows
      const conversations = new Map();
      const activeConversations = new Map(); // Track active conversations per phone number
      
      for (const msg of filteredMessages) {
        // Skip automated messages
        if (msg.body.includes('CN6cc5c67b4') || msg.body.includes('CN2cc08d4c')) continue;
        
        // Use the actual conversationId from the CSV if available
        const convId = msg.conversationId || (msg.id ? msg.id.split('_')[0].substring(0, 10) : '');
        const phoneKey = msg.direction === 'incoming' ? msg.from : msg.to;
        const timestamp = new Date(msg.sentAt || Date.now()).getTime();
        
        // Use conversation ID if available, otherwise use phone + adaptive time window
        let convKey = convId || phoneKey;
        
        // Check if this is part of an active conversation (within 2 hours of last message)
        if (!convId && phoneKey) {
          const lastActivity = activeConversations.get(phoneKey);
          if (lastActivity && (timestamp - lastActivity.timestamp) < 2 * 60 * 60 * 1000) {
            // Part of existing conversation
            convKey = lastActivity.convKey;
          } else {
            // New conversation
            convKey = `${phoneKey}_${timestamp}`;
          }
        }
        
        // Update last activity
        activeConversations.set(phoneKey, { timestamp, convKey });
        
        if (!conversations.has(convKey)) {
          conversations.set(convKey, { 
            customer: [], 
            operator: [], 
            startTime: timestamp,
            endTime: timestamp,
            messages: []
          });
        }
        
        const conv = conversations.get(convKey);
        conv.endTime = Math.max(conv.endTime, timestamp);
        conv.messages.push({ ...msg, timestamp });
        
        if (msg.direction === 'incoming') {
          conv.customer.push(msg.body);
        } else {
          conv.operator.push(msg.body);
        }
      }
      
      logger.info(`[Patterns Import] Found ${conversations.size} conversations`);
      
      // Analyze conversations with GPT-4o
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const patterns = [];
      let conversationsAnalyzed = 0;
      const maxConversationsToAnalyze = 100; // Limit to prevent timeout
      
      for (const [key, conv] of conversations) {
        if (conversationsAnalyzed >= maxConversationsToAnalyze) break;
        
        if (conv.customer.length > 0 && conv.operator.length > 0) {
          conversationsAnalyzed++;
          
          // Build full conversation context (up to 5 messages each)
          const customerContext = conv.customer.slice(0, 5).join('\n');
          const operatorContext = conv.operator.slice(0, 5).join('\n');
          
          // Calculate conversation duration
          const duration = (conv.endTime - conv.startTime) / 1000 / 60; // minutes
          
          try {
            const completion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: `Analyze this customer service conversation and extract reusable patterns.
                          The conversation lasted ${duration.toFixed(0)} minutes with ${conv.messages.length} messages.
                          Focus on the main issue and resolution, not greetings or closings.
                          Return JSON with:
                          - type: booking|tech_issue|access|faq|gift_cards|hours|membership|general
                          - trigger: generalized version of the customer's main question/issue
                          - response: template of the operator's solution with variables like {{customer_name}}, {{bay_number}}
                          - confidence: 0.5-0.9 based on how clear and reusable the pattern is
                          - variables: array of template variables found
                          - multiMessage: true if this requires multiple messages to resolve`
                },
                {
                  role: "user",
                  content: `Customer messages:\n${customerContext}\n\nOperator responses:\n${operatorContext}`
                }
              ],
              response_format: { type: "json_object" }
            });
            
            const result = JSON.parse(completion.choices[0].message.content || '{}');
            
            if (result.trigger && result.response) {
              patterns.push({
                type: result.type || 'general',
                trigger: result.trigger,
                response: result.response,
                confidence: result.confidence || 0.6,
                variables: result.variables || [],
                multiMessage: result.multiMessage || false
              });
            }
          } catch (error) {
            logger.error('[Patterns Import] GPT-4o analysis failed', error);
          }
        }
      }
      
      logger.info(`[Patterns Import] Analyzed ${conversationsAnalyzed} conversations (limit: ${maxConversationsToAnalyze})`)
      
      // Deduplicate and insert patterns
      const uniquePatterns = new Map();
      for (const pattern of patterns) {
        const key = `${pattern.type}_${pattern.trigger.substring(0, 50)}`;
        if (!uniquePatterns.has(key) || uniquePatterns.get(key).confidence < pattern.confidence) {
          uniquePatterns.set(key, pattern);
        }
      }
      
      let newPatterns = 0;
      let enhancedPatterns = 0;
      let totalConfidence = 0;
      
      for (const pattern of uniquePatterns.values()) {
        try {
          // Generate embedding for semantic search
          let embedding: number[] | null = null;
          try {
            const embeddingText = `${pattern.trigger} ${pattern.response}`;
            const embeddingResponse = await openai.embeddings.create({
              model: 'text-embedding-3-small',
              input: embeddingText,
            });
            embedding = embeddingResponse.data[0].embedding;
          } catch (error) {
            logger.warn('[Patterns Import] Failed to generate embedding, pattern will use keyword matching only', error);
          }

          // Check if similar pattern exists
          const existing = await db.query(
            `SELECT id, confidence_score FROM decision_patterns 
             WHERE pattern_type = $1 
             AND (
               similarity(trigger_text, $2) > 0.7
               OR LOWER(trigger_text) LIKE LOWER($3)
             )`,
            [pattern.type, pattern.trigger, `%${pattern.trigger.substring(0, 30)}%`]
          );
          
          if (existing.rows.length === 0) {
            // Insert new pattern with embedding
            await db.query(
              `INSERT INTO decision_patterns (
                pattern_type,
                pattern_signature,
                trigger_text,
                response_template,
                confidence_score,
                auto_executable,
                execution_count,
                success_count,
                is_active,
                learned_from,
                template_variables,
                embedding,
                embedding_model,
                embedding_generated_at,
                semantic_search_enabled,
                created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())`,
              [
                pattern.type,
                `csv_import_${Date.now()}_${newPatterns}`,
                pattern.trigger,
                pattern.response,
                pattern.confidence,
                false, // Require manual approval
                0,
                0,
                true,
                'openphone_csv_import',
                JSON.stringify(pattern.variables),
                embedding,
                embedding ? 'text-embedding-3-small' : null,
                embedding ? new Date() : null,
                embedding ? true : false
              ]
            );
            newPatterns++;
            totalConfidence += pattern.confidence;
          } else {
            // Boost existing pattern confidence
            const newConfidence = Math.min(existing.rows[0].confidence_score + 0.05, 0.95);
            await db.query(
              `UPDATE decision_patterns 
               SET confidence_score = $1,
                   execution_count = execution_count + 1,
                   last_modified = NOW()
               WHERE id = $2`,
              [newConfidence, existing.rows[0].id]
            );
            enhancedPatterns++;
            totalConfidence += newConfidence;
          }
        } catch (error) {
          logger.error('[Patterns Import] Failed to save pattern', error);
        }
      }
      
      const avgConfidence = (newPatterns + enhancedPatterns) > 0 
        ? totalConfidence / (newPatterns + enhancedPatterns) 
        : 0;
      
      logger.info(`[Patterns Import] Complete - New: ${newPatterns}, Enhanced: ${enhancedPatterns}`);
      
      // Update job status
      await db.query(
        `UPDATE pattern_import_jobs 
         SET status = $1, completed_at = NOW(), 
             processed_messages = $2, duplicate_messages = $3,
             conversations_found = $4, conversations_analyzed = $5,
             patterns_created = $6, patterns_enhanced = $7
         WHERE id = $8`,
        [
          'completed',
          newMessageCount,
          duplicateCount,
          conversations.size,
          conversationsAnalyzed,
          newPatterns,
          enhancedPatterns,
          jobId
        ]
      );
      
      res.json({
        success: true,
        totalMessages: messages.length,
        duplicateMessages: duplicateCount,
        newMessages: newMessageCount,
        conversationsAnalyzed,
        newPatterns,
        enhancedPatterns,
        avgConfidence,
        importJobId: jobId
      });
      
    } catch (error) {
      logger.error('[Patterns Import] Failed to import CSV', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to import CSV data. Please check the format and try again.' 
      });
    }
  }
);

/**
 * GET /api/patterns/queue
 * Get pending pattern suggestions awaiting operator action
 */
router.get('/queue',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const result = await db.query(`
        SELECT 
          psq.id,
          psq.conversation_id,
          psq.approved_pattern_id as pattern_id,
          psq.suggested_response,
          psq.confidence_score,
          psq.reasoning,
          psq.status,
          psq.created_at,
          psq.phone_number,
          psq.trigger_text as original_message,
          psq.pattern_type,
          dp.response_template
        FROM pattern_suggestions_queue psq
        LEFT JOIN decision_patterns dp ON dp.id = psq.approved_pattern_id
        WHERE psq.status = 'pending'
        ORDER BY psq.created_at DESC
        LIMIT 20
      `);

      res.json({
        success: true,
        queue: result.rows.map(row => ({
          id: row.id,
          conversationId: row.conversation_id,
          patternId: row.pattern_id,
          phoneNumber: row.phone_number,
          customerName: row.customer_name,
          originalMessage: row.original_message,
          suggestedResponse: row.suggested_response,
          confidence: row.confidence_score,
          reasoning: row.reasoning ? JSON.parse(row.reasoning) : null,
          patternType: row.pattern_type,
          createdAt: row.created_at
        }))
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to get queue', error);
      res.status(500).json({ success: false, error: 'Failed to get suggestions queue' });
    }
  }
);

/**
 * POST /api/patterns/queue/:id/respond
 * Operator accepts, modifies, or rejects a pattern suggestion
 */
router.post('/queue/:id/respond',
  authenticate,
  roleGuard(['admin', 'operator']),
  [
    param('id').isInt(),
    body('action').isIn(['accept', 'modify', 'reject']),
    body('modifiedResponse').optional().isString()
  ],
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { action, modifiedResponse } = req.body;
      const operatorId = (req as any).user?.id;

      // Get the suggestion details
      const suggestion = await db.query(
        `SELECT * FROM pattern_suggestions_queue WHERE id = $1 AND status = 'pending'`,
        [id]
      );

      if (suggestion.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Suggestion not found or already processed' });
      }

      const sugg = suggestion.rows[0];
      const finalResponse = action === 'modify' ? modifiedResponse : sugg.suggested_response;

      // Start transaction
      await db.query('BEGIN');

      try {
        // Update suggestion status
        await db.query(
          `UPDATE pattern_suggestions_queue 
           SET status = $1, processed_at = NOW(), processed_by = $2, final_response = $3
           WHERE id = $4`,
          [action === 'reject' ? 'rejected' : 'processed', operatorId, finalResponse, id]
        );

        // Log operator action
        await db.query(
          `INSERT INTO operator_actions 
           (suggestion_id, operator_id, action_type, original_suggestion, final_response, pattern_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [id, operatorId, action, sugg.suggested_response, finalResponse, sugg.approved_pattern_id]
        );

        if (action !== 'reject') {
          // Send the response via OpenPhone
          const conversation = await db.query(
            'SELECT phone_number FROM openphone_conversations WHERE id::text = $1',
            [sugg.conversation_id]
          );

          if (conversation.rows[0]) {
            const { openPhoneService } = require('../services/openphoneService');
            const defaultNumber = process.env.OPENPHONE_DEFAULT_NUMBER;
            
            if (defaultNumber) {
              await openPhoneService.sendMessage(
                conversation.rows[0].phone_number,
                defaultNumber,
                finalResponse
              );

              // Store the sent message
              await db.query(
                `INSERT INTO conversation_messages 
                 (conversation_id, sender_type, message_text, pattern_id, created_at)
                 VALUES ($1, 'operator', $2, $3, NOW())`,
                [sugg.conversation_id, finalResponse, sugg.approved_pattern_id]
              );
            }
          }

          // Update pattern confidence based on action
          if (sugg.approved_pattern_id) {
            // Use the tracked confidence update function
            const isSuccess = action === 'accept';
            const isHumanOverride = action === 'modify' || action === 'reject';
            const feedbackReason = action === 'accept' ? 'accepted' : 
                                  action === 'modify' ? 'modified' : 'rejected';
            
            await db.query(
              `SELECT update_pattern_confidence_tracked($1, $2, $3, $4, $5)`,
              [sugg.approved_pattern_id, isSuccess, isHumanOverride, feedbackReason, req.user?.id || 'system']
            );
          }
        }

        // Track operator action in the database
        await db.query(`
          INSERT INTO operator_actions 
          (pattern_id, action_type, original_response, modified_response, 
           operator_id, suggestion_id, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
          sugg.approved_pattern_id,
          action,
          sugg.suggested_response,
          action === 'modify' ? finalResponse : null,
          operatorId,
          id,
        ]);

        // If modified, learn from the modification
        if (action === 'modify' && sugg.approved_pattern_id) {
          const conversationData = await db.query(
            'SELECT phone_number FROM openphone_conversations WHERE id::text = $1',
            [sugg.conversation_id]
          );
          
          await patternLearningService.learnFromHumanResponse(
            sugg.suggested_response,
            finalResponse,
            [],
            sugg.conversation_id,
            conversationData.rows[0]?.phone_number,
            operatorId
          );
        }

        await db.query('COMMIT');

        res.json({
          success: true,
          action,
          finalResponse,
          messageSent: action !== 'reject'
        });

      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      logger.error('[Patterns API] Failed to process operator response', error);
      res.status(500).json({ success: false, error: 'Failed to process response' });
    }
  }
);

/**
 * GET /api/patterns/recent-activity
 * Get recent pattern matching activity
 */
router.get('/recent-activity',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const result = await db.query(`
        SELECT 
          peh.id,
          peh.pattern_id,
          peh.conversation_id,
          peh.phone_number,
          peh.message_text,
          peh.confidence_at_execution,
          peh.execution_mode,
          peh.created_at,
          peh.execution_status,
          dp.pattern_type,
          dp.response_template,
          oc.customer_name,
          CASE 
            WHEN psq.status = 'pending' THEN 'pending'
            WHEN psq.status = 'processed' THEN 'handled'
            WHEN psq.status = 'rejected' THEN 'rejected'
            WHEN peh.execution_mode = 'auto' THEN 'auto_handled'
            ELSE 'queued'
          END as status
        FROM pattern_execution_history peh
        LEFT JOIN decision_patterns dp ON dp.id = peh.pattern_id
        LEFT JOIN openphone_conversations oc ON oc.id::text = peh.conversation_id
        LEFT JOIN pattern_suggestions_queue psq ON psq.conversation_id = peh.conversation_id
          AND psq.approved_pattern_id = peh.pattern_id
        ORDER BY peh.created_at DESC
        LIMIT 50
      `);

      res.json({
        success: true,
        activity: result.rows.map(row => ({
          id: row.id,
          time: row.created_at,
          phone: row.phone_number,
          customerName: row.customer_name,
          message: row.message_text,
          pattern: row.pattern_type,
          confidence: Math.round(row.confidence_at_execution * 100),
          status: row.status,
          mode: row.execution_mode
        }))
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to get recent activity', error);
      res.status(500).json({ success: false, error: 'Failed to get recent activity' });
    }
  }
);

// ============================================
// DYNAMIC ROUTES (must be defined after specific routes)
// ============================================

/**
 * GET /api/patterns/:id
 * Get a specific pattern with its execution history
 */
router.get('/:id',
  authenticate,
  roleGuard(['admin', 'operator']),
  [param('id').isInt()],
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Get pattern
      const patternResult = await db.query(
        'SELECT * FROM decision_patterns WHERE id = $1',
        [id]
      );

      if (patternResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Pattern not found' });
      }

      // Get recent execution history
      const historyResult = await db.query(`
        SELECT 
          peh.*,
          u.name as reviewed_by_name
        FROM pattern_execution_history peh
        LEFT JOIN users u ON peh.reviewed_by = u.id
        WHERE peh.pattern_id = $1
        ORDER BY peh.created_at DESC
        LIMIT 20
      `, [id]);

      // Get confidence evolution
      const evolutionResult = await db.query(`
        SELECT 
          ce.*,
          u.name as changed_by_name
        FROM confidence_evolution ce
        LEFT JOIN users u ON ce.changed_by = u.id
        WHERE ce.pattern_id = $1
        ORDER BY ce.changed_at DESC
        LIMIT 20
      `, [id]);

      res.json({
        success: true,
        pattern: patternResult.rows[0],
        executionHistory: historyResult.rows,
        confidenceEvolution: evolutionResult.rows
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to get pattern', error);
      res.status(500).json({ success: false, error: 'Failed to get pattern' });
    }
  }
);

/**
 * PUT /api/patterns/:id
 * Update a pattern (response, confidence, active status)
 */
router.put('/:id',
  authenticate,
  roleGuard(['admin', 'operator']),  // Allow operators to edit patterns
  [
    param('id').isInt(),
    body('response_template').optional().isString(),
    body('trigger_text').optional().isString(),
    body('trigger_examples').optional().isArray(),
    body('confidence_score').optional().isFloat({ min: 0, max: 1 }),
    body('auto_executable').optional().isBoolean(),
    body('is_active').optional().isBoolean(),
    body('is_deleted').optional().isBoolean(),
    body('notes').optional().isString()
  ],
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Build update query
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          updateFields.push(`${key} = $${paramCount++}`);
          values.push(updates[key]);
        }
      });

      // If restoring from deleted, clear deletion metadata
      if (updates.is_deleted === false) {
        updateFields.push(`deleted_at = NULL`);
        updateFields.push(`deleted_by = NULL`);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ success: false, error: 'No updates provided' });
      }

      // Add last_modified
      updateFields.push(`last_modified = NOW()`);
      
      // Add id as last parameter
      values.push(id);

      await db.query(
        `UPDATE decision_patterns SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
        values
      );

      // Log the change
      if (updates.confidence_score !== undefined) {
        await db.query(`
          INSERT INTO confidence_evolution 
          (pattern_id, old_confidence, new_confidence, change_reason, changed_by)
          SELECT id, confidence_score, $1, 'manual_adjustment', $2
          FROM decision_patterns WHERE id = $3
        `, [updates.confidence_score, (req as any).user?.id, id]);
      }

      logger.info('[Patterns API] Pattern updated', {
        patternId: id,
        updates,
        updatedBy: (req as any).user?.id
      });

      res.json({ success: true, message: 'Pattern updated' });
    } catch (error) {
      logger.error('[Patterns API] Failed to update pattern', error);
      res.status(500).json({ success: false, error: 'Failed to update pattern' });
    }
  }
);

/**
 * DELETE /api/patterns/:id
 * Soft delete a pattern (sets is_active = false)
 */
router.delete('/:id',
  authenticate,
  roleGuard(['admin']),
  [param('id').isInt()],
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await db.query(
        `UPDATE decision_patterns 
         SET is_deleted = TRUE, 
             deleted_at = NOW(), 
             deleted_by = $2,
             is_active = FALSE
         WHERE id = $1`,
        [id, (req as any).user?.id]
      );

      logger.info('[Patterns API] Pattern soft deleted', {
        patternId: id,
        deletedBy: (req as any).user?.id
      });

      res.json({ success: true, message: 'Pattern deleted' });
    } catch (error) {
      logger.error('[Patterns API] Failed to delete pattern', error);
      res.status(500).json({ success: false, error: 'Failed to delete pattern' });
    }
  }
);

/**
 * POST /api/patterns/suggest-for-conversation
 * Get pattern suggestion for a specific conversation
 * This is called by the Messages UI to show suggestions to operators
 */
router.post('/suggest-for-conversation',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  [
    body('conversationId').isString(),
    body('customerMessage').isString(),
    body('phoneNumber').isString()
  ],
  async (req: Request, res: Response) => {
    try {
      const { conversationId, customerMessage, phoneNumber, customerName } = req.body;
      
      // First check if there's already a queued suggestion for this conversation
      const queuedSuggestion = await db.query(`
        SELECT 
          psq.*,
          dp.pattern_type,
          dp.confidence_score as pattern_confidence,
          dp.execution_count,
          dp.success_count
        FROM pattern_suggestions_queue psq
        LEFT JOIN decision_patterns dp ON dp.id = psq.approved_pattern_id
        WHERE psq.conversation_id = $1 
          AND psq.status = 'pending'
          AND psq.created_at > NOW() - INTERVAL '30 minutes'
        ORDER BY psq.created_at DESC
        LIMIT 1
      `, [conversationId]);
      
      if (queuedSuggestion.rows.length > 0) {
        const suggestion = queuedSuggestion.rows[0];
        return res.json({
          success: true,
          data: {
            suggestion: suggestion.suggested_response,
            confidence: suggestion.confidence_score,
            patternId: suggestion.approved_pattern_id,
            queueId: suggestion.id,
            source: 'pattern_queue',
            canAutoApprove: suggestion.confidence_score >= 0.75
          }
        });
      }
      
      // If no queued suggestion, process the message through pattern learning
      const patternResult = await patternLearningService.processMessage(
        customerMessage,
        phoneNumber,
        conversationId,
        customerName
      );
      
      // If we have a suggestion or queue result, return it
      if (patternResult.action === 'suggest' || patternResult.action === 'queue') {
        return res.json({
          success: true,
          data: {
            suggestion: patternResult.response,
            confidence: patternResult.confidence || 0,
            patternId: patternResult.patternId,
            source: 'pattern_learning',
            canAutoApprove: patternResult.action === 'suggest'
          }
        });
      }
      
      // No pattern suggestion available
      return res.json({
        success: false,
        message: 'No pattern suggestion available'
      });
      
    } catch (error) {
      logger.error('[Patterns API] Failed to get suggestion for conversation', error);
      res.status(500).json({ success: false, error: 'Failed to get suggestion' });
    }
  }
);

/**
 * GET /api/patterns/queue/pending
 * Get patterns waiting for approval
 */
router.get('/queue/pending',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const result = await db.query(`
        SELECT 
          q.*,
          p.pattern_type,
          p.trigger_text,
          p.confidence_score as pattern_confidence,
          peh.phone_number,
          peh.message_text
        FROM pattern_suggestions_queue q
        JOIN decision_patterns p ON q.pattern_id = p.id
        JOIN pattern_execution_history peh ON q.execution_history_id = peh.id
        WHERE q.status = 'pending'
          AND (q.expires_at IS NULL OR q.expires_at > NOW())
        ORDER BY q.priority DESC, q.created_at ASC
      `);

      res.json({
        success: true,
        queue: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to get queue', error);
      res.status(500).json({ success: false, error: 'Failed to get queue' });
    }
  }
);

/**
 * POST /api/patterns/queue/:id/approve
 * Approve a queued pattern suggestion
 */
router.post('/queue/:id/approve',
  authenticate,
  roleGuard(['admin', 'operator']),
  [
    param('id').isInt(),
    body('modifications').optional().isObject()
  ],
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { modifications } = req.body;
      const userId = (req as any).user?.id;

      // Update queue item
      await db.query(`
        UPDATE pattern_suggestions_queue
        SET status = 'approved',
            reviewed_by = $1,
            reviewed_at = NOW(),
            review_notes = $2
        WHERE id = $3
      `, [userId, modifications ? 'Modified before approval' : null, id]);

      // TODO: Execute the pattern action if not in shadow mode

      logger.info('[Patterns API] Pattern suggestion approved', {
        queueId: id,
        approvedBy: userId,
        hasModifications: !!modifications
      });

      res.json({ success: true, message: 'Pattern approved' });
    } catch (error) {
      logger.error('[Patterns API] Failed to approve pattern', error);
      res.status(500).json({ success: false, error: 'Failed to approve pattern' });
    }
  }
);

/**
 * POST /api/patterns/:id/executed
 * Track pattern execution (approval/rejection) for confidence updates
 */
router.post('/:id/executed',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  [
    param('id').isInt(),
    body('success').isBoolean(),
    body('conversationId').optional().isString()
  ],
  async (req: Request, res: Response) => {
    try {
      const patternId = parseInt(req.params.id);
      const { success, conversationId } = req.body;
      const operatorId = (req as any).user?.id;
      
      // Update pattern confidence
      await patternLearningService.updatePatternConfidence(
        patternId,
        success,
        false, // not modified
        undefined // execution id
      );
      
      // Log the execution
      await db.query(`
        INSERT INTO pattern_execution_history 
        (pattern_id, conversation_id, execution_mode, confidence_at_execution, execution_status, operator_id, created_at)
        VALUES ($1, $2, $3, 
          (SELECT confidence_score FROM decision_patterns WHERE id = $1),
          $4, $5, NOW())
      `, [
        patternId,
        conversationId || null,
        success ? 'approved' : 'rejected',
        success ? 'success' : 'failure',
        operatorId
      ]);
      
      // Check if pattern should be promoted to auto-executable
      const pattern = await db.query(
        'SELECT * FROM decision_patterns WHERE id = $1',
        [patternId]
      );
      
      if (pattern.rows[0]) {
        const p = pattern.rows[0];
        // Auto-promote if confidence >= 0.85 and has 3+ successful executions
        if (p.confidence_score >= 0.85 && p.success_count >= 3 && !p.auto_executable) {
          await db.query(
            'UPDATE decision_patterns SET auto_executable = true WHERE id = $1',
            [patternId]
          );
          logger.info('[Patterns API] Pattern promoted to auto-executable', {
            patternId,
            confidence: p.confidence_score,
            successCount: p.success_count
          });
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      logger.error('[Patterns API] Failed to track pattern execution', error);
      res.status(500).json({ success: false, error: 'Failed to track execution' });
    }
  }
);

/**
 * POST /api/patterns/queue/:id/reject
 * Reject a queued pattern suggestion
 */
router.post('/queue/:id/reject',
  authenticate,
  roleGuard(['admin', 'operator']),
  [
    param('id').isInt(),
    body('reason').optional().isString()
  ],
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = (req as any).user?.id;

      // Update queue item
      await db.query(`
        UPDATE pattern_suggestions_queue
        SET status = 'rejected',
            reviewed_by = $1,
            reviewed_at = NOW(),
            review_notes = $2
        WHERE id = $3
      `, [userId, reason, id]);

      // Update pattern confidence (decrease for rejection)
      const queueItem = await db.query(
        'SELECT pattern_id FROM pattern_suggestions_queue WHERE id = $1',
        [id]
      );

      if (queueItem.rows[0]?.pattern_id) {
        await patternLearningService.updatePatternConfidence(
          queueItem.rows[0].pattern_id,
          false, // not successful
          false  // not modified
        );
      }

      logger.info('[Patterns API] Pattern suggestion rejected', {
        queueId: id,
        rejectedBy: userId,
        reason
      });

      res.json({ success: true, message: 'Pattern rejected' });
    } catch (error) {
      logger.error('[Patterns API] Failed to reject pattern', error);
      res.status(500).json({ success: false, error: 'Failed to reject pattern' });
    }
  }
);

/**
 * POST /api/patterns/import-enhanced
 * Import patterns from CSV, Q&A pairs, or natural language
 */
router.post('/import-enhanced',
  authenticate,
  roleGuard(['admin', 'operator']),
  [
    body('data').isString().notEmpty(),
    body('format').optional().isIn(['auto', 'csv', 'qa', 'natural'])
  ],
  async (req: Request, res: Response) => {
    try {
      const { data, format = 'auto' } = req.body;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      // Auto-detect format if needed
      let detectedFormat = format;
      if (format === 'auto') {
        if (data.includes('conversationId') && data.includes(',')) {
          detectedFormat = 'csv';
        } else if (data.includes('Q:') || data.includes('A:')) {
          detectedFormat = 'qa';
        } else {
          detectedFormat = 'natural';
        }
      }
      
      logger.info(`[Patterns Import Enhanced] Processing ${detectedFormat} format`);
      
      let patterns: any[] = [];
      
      // Process based on format
      if (detectedFormat === 'csv') {
        // Use existing CSV processing logic
        return res.status(400).json({ 
          success: false, 
          error: 'Please use /api/patterns/import-csv for CSV imports' 
        });
      } else if (detectedFormat === 'qa') {
        // Parse Q&A pairs
        const prompt = `
          Extract customer service patterns from these Q&A pairs.
          For each Q&A pair, create a pattern with:
          - trigger: the question (generalized to match variations)
          - response: the answer (with template variables like {{name}} where appropriate)
          - type: category (booking/tech/faq/general/emergency)
          - confidence: 0.7 (manual entry default)
          - variables: array of template variables used
          
          Text:
          ${data}
          
          Return a JSON object with a "patterns" array.
        `;
        
        const result = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        });
        
        const parsed = JSON.parse(result.choices[0].message?.content || '{"patterns":[]}');
        patterns = parsed.patterns || [];
        
      } else if (detectedFormat === 'natural') {
        // Parse natural language
        const prompt = `
          Extract customer service patterns from this natural language text.
          
          Look for:
          - "When X happens, do Y" statements
          - "If customer asks about X, respond with Y" patterns
          - "Tell people X" instructions
          - Direct statements like "Our hours are X"
          - Common questions and their answers
          
          For each pattern found, create:
          - trigger: what the customer might say (generalized)
          - response: how to respond (with template variables)
          - type: category (booking/tech/faq/general/emergency)
          - confidence: 0.6-0.8 based on clarity
          - variables: array of template variables used
          
          Text:
          ${data}
          
          Return a JSON object with a "patterns" array.
        `;
        
        const result = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        });
        
        const parsed = JSON.parse(result.choices[0].message?.content || '{"patterns":[]}');
        patterns = parsed.patterns || [];
      }
      
      logger.info(`[Patterns Import Enhanced] GPT-4o extracted ${patterns.length} patterns`);
      
      // Insert patterns with embeddings
      let newPatterns = 0;
      let failedPatterns = 0;
      
      for (const pattern of patterns) {
        try {
          // Generate embedding
          let embedding: number[] | null = null;
          try {
            const embeddingText = `${pattern.trigger} ${pattern.response}`;
            const embeddingResponse = await openai.embeddings.create({
              model: 'text-embedding-3-small',
              input: embeddingText,
            });
            embedding = embeddingResponse.data[0].embedding;
          } catch (error) {
            logger.warn('[Patterns Import Enhanced] Failed to generate embedding', error);
          }
          
          // Check for existing similar pattern
          const existing = await db.query(
            `SELECT id FROM decision_patterns 
             WHERE pattern_type = $1 
             AND similarity(trigger_text, $2) > 0.8`,
            [pattern.type || 'general', pattern.trigger]
          );
          
          if (existing.rows.length === 0) {
            // Insert new pattern with embedding
            await db.query(
              `INSERT INTO decision_patterns (
                pattern_type,
                pattern_signature,
                trigger_text,
                response_template,
                confidence_score,
                auto_executable,
                execution_count,
                success_count,
                is_active,
                learned_from,
                template_variables,
                embedding,
                embedding_model,
                embedding_generated_at,
                semantic_search_enabled,
                created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())`,
              [
                pattern.type || 'general',
                `${detectedFormat}_import_${Date.now()}_${newPatterns}`,
                pattern.trigger,
                pattern.response,
                pattern.confidence || 0.7,
                false,
                0,
                0,
                true,
                `${detectedFormat}_import`,
                JSON.stringify(pattern.variables || []),
                embedding,
                embedding ? 'text-embedding-3-small' : null,
                embedding ? new Date() : null,
                embedding ? true : false
              ]
            );
            newPatterns++;
          }
        } catch (error) {
          logger.error('[Patterns Import Enhanced] Failed to save pattern', error);
          failedPatterns++;
        }
      }
      
      res.json({
        success: true,
        format: detectedFormat,
        totalPatterns: patterns.length,
        newPatterns,
        failedPatterns,
        patterns: patterns.slice(0, 5) // Return first 5 for preview
      });
      
    } catch (error) {
      logger.error('[Patterns Import Enhanced] Failed', error);
      res.status(500).json({ 
        success: false, 
        error: 'Import failed' 
      });
    }
  }
);

export default router;
