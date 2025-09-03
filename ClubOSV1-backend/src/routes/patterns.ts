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
import { body, param, query, validationResult } from 'express-validator';
import OpenAI from 'openai';

const router = Router();

// BREADCRUMB: All routes require authentication and admin/operator role
// This ensures only authorized users can manage patterns

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
        WHERE p.is_active = TRUE
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
        'SELECT COUNT(*) FROM decision_patterns WHERE is_active = TRUE'
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
 * GET /api/patterns/stats
 * Get pattern learning statistics
 */
router.get('/stats',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      // Get overall stats
      const statsResult = await db.query(`
        SELECT 
          COUNT(*) as total_patterns,
          COUNT(*) FILTER (WHERE auto_executable = TRUE) as auto_executable_patterns,
          COUNT(*) FILTER (WHERE confidence_score >= 0.95) as high_confidence_patterns,
          COUNT(*) FILTER (WHERE confidence_score >= 0.75) as medium_confidence_patterns,
          COUNT(*) FILTER (WHERE confidence_score < 0.75) as low_confidence_patterns,
          AVG(confidence_score) as avg_confidence,
          SUM(execution_count) as total_executions,
          SUM(success_count) as total_successes,
          AVG(CASE WHEN execution_count > 0 
            THEN success_count::float / execution_count 
            ELSE 0 END) as avg_success_rate
        FROM decision_patterns
        WHERE is_active = TRUE
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
      res.json({
        patterns: {
          total: parseInt(stats.total_patterns) || 0,
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
 * POST /api/patterns/import-csv
 * Import OpenPhone CSV data and extract patterns using GPT-4o
 */
router.post('/import-csv',
  authenticate,
  roleGuard(['admin', 'operator']),
  [body('csvData').isString().notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const { csvData } = req.body;
      
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
      
      // Find column indices
      const idCol = headers.indexOf('id');
      const bodyCol = headers.indexOf('conversationBody');
      const directionCol = headers.indexOf('direction');
      const fromCol = headers.indexOf('from');
      const toCol = headers.indexOf('to');
      const sentAtCol = headers.indexOf('sentAt');
      
      if (bodyCol === -1 || directionCol === -1) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid CSV format. Required columns: conversationBody, direction' 
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
            body: cols[bodyCol] || '',
            direction: cols[directionCol] || '',
            from: cols[fromCol] || '',
            to: cols[toCol] || '',
            sentAt: cols[sentAtCol] || ''
          });
        }
      }
      
      logger.info(`[Patterns Import] Processing ${messages.length} messages`);
      
      // Sort messages by timestamp first
      messages.sort((a, b) => {
        const timeA = new Date(a.sentAt || 0).getTime();
        const timeB = new Date(b.sentAt || 0).getTime();
        return timeA - timeB;
      });
      
      // Group messages into conversations using conversation IDs and dynamic time windows
      const conversations = new Map();
      const activeConversations = new Map(); // Track active conversations per phone number
      
      for (const msg of messages) {
        // Skip automated messages
        if (msg.body.includes('CN6cc5c67b4') || msg.body.includes('CN2cc08d4c')) continue;
        
        // Extract conversation ID from message ID (first part before any suffix)
        const convId = msg.id ? msg.id.split('_')[0].substring(0, 10) : '';
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
            // Insert new pattern
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
                created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
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
                JSON.stringify(pattern.variables)
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
      
      res.json({
        success: true,
        totalMessages: messages.length,
        conversationsAnalyzed,
        newPatterns,
        enhancedPatterns,
        avgConfidence
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
  roleGuard(['admin']),
  [
    param('id').isInt(),
    body('response_template').optional().isString(),
    body('confidence_score').optional().isFloat({ min: 0, max: 1 }),
    body('auto_executable').optional().isBoolean(),
    body('is_active').optional().isBoolean(),
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
        'UPDATE decision_patterns SET is_active = FALSE, last_modified = NOW() WHERE id = $1',
        [id]
      );

      logger.info('[Patterns API] Pattern deactivated', {
        patternId: id,
        deactivatedBy: (req as any).user?.id
      });

      res.json({ success: true, message: 'Pattern deactivated' });
    } catch (error) {
      logger.error('[Patterns API] Failed to delete pattern', error);
      res.status(500).json({ success: false, error: 'Failed to delete pattern' });
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

export default router;
