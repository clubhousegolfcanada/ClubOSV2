/**
 * Enhanced Unified Pattern API Routes
 * 
 * This is the consolidated pattern system that combines ALL features from:
 * - patterns.ts (main CRUD and management)
 * - patterns-enhanced.ts (GPT-4o validation and embeddings)
 * - patterns-api.ts (recovery and admin features)
 * 
 * Features preserved:
 * ✅ Full CRUD operations
 * ✅ GPT-4o validation and enhancement
 * ✅ Embeddings and semantic search
 * ✅ Pattern testing with multiple methods
 * ✅ Quality scoring and optimization
 * ✅ CSV import with AI
 * ✅ Queue management
 * ✅ Statistics and analytics
 * ✅ Configuration management
 * ✅ Pattern recovery
 * ✅ Safety validation
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { patternLearningService } from '../services/patternLearningService';
import { patternSafetyService } from '../services/patternSafetyService';
import { patternOptimizer } from '../services/patternOptimizer';
import { csvImportService } from '../services/csvImportService';
import { openPhoneService } from '../services/openphoneService';
import { sanitizePatternTemplate, sanitizeText } from '../utils/sanitizer';
import { body, param, query as queryValidator, validationResult } from 'express-validator';
import OpenAI from 'openai';
import crypto from 'crypto';
import multer from 'multer';
import rateLimit from 'express-rate-limit';

const router = Router();

// Initialize OpenAI for GPT-4o features
let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ============================================
// HELPER FUNCTIONS (from patterns-enhanced.ts)
// ============================================

/**
 * Validate response template with GPT-4o
 */
async function validateResponseWithGPT4o(
  response: string, 
  triggerExamples: string[]
): Promise<{ valid: boolean; issues?: string[] }> {
  if (!openai) return { valid: true };
  
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are validating if a response template is appropriate for the given trigger examples. Return JSON with {valid: boolean, issues?: string[]}'
        },
        {
          role: 'user',
          content: `Trigger examples: ${triggerExamples.join(', ')}\nResponse: ${response}`
        }
      ],
      temperature: 0.3
    });
    
    // Safely parse GPT-4o response with error handling
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      logger.warn('GPT-4o returned empty response');
      return { valid: true };
    }
    
    try {
      const parsed = JSON.parse(content);
      // Validate expected structure
      if (typeof parsed.valid !== 'boolean') {
        logger.warn('GPT-4o returned invalid structure', { content });
        return { valid: true };
      }
      return parsed;
    } catch (parseError) {
      logger.error('Failed to parse GPT-4o response', { content, error: parseError });
      return { valid: true }; // Default to valid to avoid blocking
    }
  } catch (error) {
    logger.error('GPT-4o validation error:', error);
    return { valid: true }; // Default to valid on error
  }
}

/**
 * Generate embedding for semantic search
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!openai || !text) return null;
  
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    
    return response.data[0].embedding;
  } catch (error) {
    logger.error('Embedding generation error:', error);
    return null;
  }
}

/**
 * Test pattern matching with multiple methods
 */
async function testPatternMatch(
  message: string,
  pattern: any
): Promise<{
  keywordMatch: boolean;
  semanticMatch: boolean;
  gptMatch: boolean;
  overallMatch: boolean;
  confidence: number;
}> {
  // Keyword matching
  const keywordMatch = pattern.trigger_keywords?.some((kw: string) => 
    message.toLowerCase().includes(kw.toLowerCase())
  ) || false;
  
  // Semantic matching with embeddings
  let semanticMatch = false;
  if (openai && pattern.embedding) {
    const messageEmbedding = await generateEmbedding(message);
    if (messageEmbedding) {
      // Cosine similarity
      const similarity = cosineSimilarity(messageEmbedding, pattern.embedding);
      semanticMatch = similarity > 0.75;
    }
  }
  
  // GPT-4o matching
  let gptMatch = false;
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Does this message match the pattern? Reply with just "yes" or "no".'
          },
          {
            role: 'user',
            content: `Message: "${message}"\nPattern: "${pattern.pattern}"\nExamples: ${pattern.trigger_examples?.join(', ')}`
          }
        ],
        temperature: 0.1
      });
      
      gptMatch = completion.choices[0].message.content?.toLowerCase() === 'yes';
    } catch (error) {
      logger.error('GPT-4o matching error:', error);
    }
  }
  
  // Calculate overall confidence
  const matchCount = [keywordMatch, semanticMatch, gptMatch].filter(Boolean).length;
  const confidence = matchCount / 3;
  
  return {
    keywordMatch,
    semanticMatch,
    gptMatch,
    overallMatch: matchCount >= 2,
    confidence
  };
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Extract meaningful keywords from trigger examples
 * Used for fallback keyword matching when semantic search fails
 */
function extractKeywords(triggers: string[]): string[] {
  const stopWords = new Set([
    'do', 'you', 'have', 'is', 'are', 'the', 'a', 'an', 'i', 'can', 'what',
    'how', 'where', 'when', 'why', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'there', 'here', 'this', 'that', 'it',
    'my', 'your', 'our', 'their', 'to', 'for', 'of', 'in', 'on', 'at', 'by',
    'with', 'about', 'just', 'get', 'any', 'some'
  ]);

  const keywords = new Set<string>();

  triggers.forEach(trigger => {
    trigger.toLowerCase()
      .replace(/[?.,!'"]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .forEach(word => keywords.add(word));
  });

  return Array.from(keywords);
}

/**
 * Regenerate embedding for a pattern (used for retry mechanism)
 */
async function regenerateEmbedding(patternId: number, triggers: string[]): Promise<void> {
  if (!openai) return;

  try {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: triggers.join(' ')
    });

    await db.query(
      'UPDATE decision_patterns SET embedding = $1 WHERE id = $2',
      [`{${embeddingResponse.data[0].embedding.join(',')}}`, patternId]
    );

    logger.info('[Patterns] Successfully regenerated embedding', { patternId });
  } catch (error) {
    logger.error('[Patterns] Failed to regenerate embedding:', error);
  }
}

// ============================================
// MAIN ROUTES (from patterns.ts)
// ============================================

/**
 * GET /api/patterns
 * Get all active patterns with filtering
 */
router.get('/',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const { includeDeleted = 'false', includeInactive = 'false' } = req.query;
      
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
          COALESCE(pattern, trigger_text, trigger_examples[1], '') as pattern,
          COALESCE(trigger_text, pattern, trigger_examples[1], '') as trigger_text,
          response_template,
          trigger_examples,
          trigger_keywords,
          confidence_score,
          execution_count,
          success_count,
          is_active,
          auto_executable,
          COALESCE(is_deleted, FALSE) as is_deleted,
          COALESCE(created_at, first_seen, NOW()) as created_at,
          COALESCE(updated_at, last_modified, NOW()) as updated_at,
          CASE 
            WHEN success_count > 0 AND execution_count > 0 
            THEN ROUND((success_count::float / execution_count::float * 100)::numeric, 0)
            ELSE 0 
          END as success_rate,
          COALESCE(last_used, updated_at, NOW()) as last_used,
          semantic_search_enabled,
          embedding IS NOT NULL as has_embedding
        FROM decision_patterns
        ${whereClause}
        ORDER BY 
          is_active DESC,
          confidence_score DESC,
          execution_count DESC
      `);
      
      logger.info(`[Enhanced Patterns API] Fetched ${result.rows.length} patterns`);
      
      res.json({
        success: true,
        patterns: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      logger.error('[Enhanced Patterns API] Error fetching patterns:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch patterns' 
      });
    }
  }
);

/**
 * GET /api/patterns/deleted
 * Get deleted patterns for recovery (from patterns-api.ts)
 */
router.get('/deleted',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const result = await db.query(`
        SELECT 
          p.id,
          p.pattern_type,
          COALESCE(p.pattern, p.trigger_text, p.trigger_examples[1], '') as pattern,
          COALESCE(p.trigger_text, p.pattern, p.trigger_examples[1], '') as trigger_text,
          p.response_template,
          p.trigger_examples,
          p.trigger_keywords,
          p.confidence_score,
          p.execution_count,
          p.success_count,
          p.is_active,
          p.auto_executable,
          COALESCE(p.is_deleted, FALSE) as is_deleted,
          COALESCE(p.created_at, p.first_seen, NOW()) as created_at,
          COALESCE(p.updated_at, p.last_modified, NOW()) as updated_at,
          p.notes,
          u.name as deleted_by_name
        FROM decision_patterns p
        LEFT JOIN users u ON p.updated_by::text = u.id::text
        WHERE COALESCE(p.is_deleted, FALSE) = TRUE
        ORDER BY p.updated_at DESC
        LIMIT 50
      `);

      res.json({
        success: true,
        patterns: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      logger.error('[Enhanced Patterns API] Failed to get deleted patterns', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get deleted patterns' 
      });
    }
  }
);

/**
 * POST /api/patterns/:id/restore
 * Restore a deleted pattern (from patterns-api.ts)
 */
router.post('/:id/restore',
  authenticate,
  roleGuard(['admin', 'operator']),
  [param('id').isInt()],
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const result = await db.query(
        `UPDATE decision_patterns 
         SET is_deleted = false, 
             is_active = true,
             updated_at = NOW(),
             updated_by = $2
         WHERE id = $1
         RETURNING *`,
        [id, req.user?.id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Pattern not found' 
        });
      }
      
      logger.info(`[Enhanced Patterns API] Pattern ${id} restored by user ${req.user?.id}`);
      
      res.json({
        success: true,
        pattern: result.rows[0]
      });
    } catch (error) {
      logger.error('[Enhanced Patterns API] Error restoring pattern:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to restore pattern' 
      });
    }
  }
);

/**
 * PUT /api/patterns/:id/enhanced
 * Enhanced pattern update with GPT-4o validation and embeddings (from patterns-enhanced.ts)
 */
router.put('/:id/enhanced',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { 
        trigger_examples,
        response_template,
        pattern,
        trigger_keywords
      } = req.body;

      // Validate the response template with GPT-4o
      if (openai && response_template) {
        const validation = await validateResponseWithGPT4o(
          response_template, 
          trigger_examples || [pattern]
        );
        
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: 'Response validation failed',
            details: validation.issues
          });
        }
      }

      // Generate embeddings for trigger examples
      const embeddings: number[][] = [];
      if (openai && trigger_examples && trigger_examples.length > 0) {
        for (const example of trigger_examples) {
          const embedding = await generateEmbedding(example);
          if (embedding) embeddings.push(embedding);
        }
      }

      // Update the pattern
      const avgEmbedding = embeddings.length > 0 
        ? embeddings[0] // Could average them for better results
        : null;

      const result = await db.query(`
        UPDATE decision_patterns
        SET 
          pattern = COALESCE($1, pattern),
          response_template = COALESCE($2, response_template),
          trigger_keywords = COALESCE($3, trigger_keywords),
          trigger_examples = COALESCE($4, trigger_examples),
          embedding = CASE 
            WHEN $5::float[] IS NOT NULL THEN $5::float[]
            ELSE embedding
          END,
          semantic_search_enabled = CASE
            WHEN $5::float[] IS NOT NULL THEN true
            ELSE semantic_search_enabled
          END,
          updated_at = NOW(),
          updated_by = $6
        WHERE id = $7
        RETURNING *
      `, [
        pattern,
        response_template,
        trigger_keywords,
        trigger_examples,
        avgEmbedding,
        req.user?.id,
        id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Pattern not found'
        });
      }

      logger.info(`[Enhanced Patterns API] Pattern ${id} updated with GPT-4o enhancements`);

      res.json({
        success: true,
        pattern: result.rows[0]
      });
    } catch (error) {
      logger.error('[Enhanced Patterns API] Error updating pattern:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update pattern'
      });
    }
  }
);

/**
 * POST /api/patterns/test
 * Test if a message would match pattern trigger examples BEFORE saving
 * Used by PatternCreationModal to preview matching before creation
 */
router.post('/test',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const { message, trigger_examples, response_template, semantic_search_enabled } = req.body;

      if (!message?.trim()) {
        return res.status(400).json({ success: false, error: 'Test message is required' });
      }
      if (!trigger_examples?.length) {
        return res.status(400).json({ success: false, error: 'Trigger examples are required' });
      }

      const keywords = extractKeywords(trigger_examples);
      const messageLower = message.toLowerCase();

      // Keyword matching (always available)
      const matchedKeywords = keywords.filter(kw => messageLower.includes(kw));
      const keywordMatch = matchedKeywords.length > 0;

      // Semantic matching (if OpenAI available)
      let semanticMatch = false;
      let semanticSimilarity = 0;

      if (semantic_search_enabled && openai) {
        try {
          const [msgEmbed, triggerEmbed] = await Promise.all([
            openai.embeddings.create({ model: 'text-embedding-3-small', input: message }),
            openai.embeddings.create({ model: 'text-embedding-3-small', input: trigger_examples.join(' ') })
          ]);

          semanticSimilarity = cosineSimilarity(
            msgEmbed.data[0].embedding,
            triggerEmbed.data[0].embedding
          );
          semanticMatch = semanticSimilarity >= 0.75;
        } catch (err) {
          logger.warn('[Patterns] Semantic test failed, using keyword-only:', err);
        }
      }

      const wouldMatch = keywordMatch || semanticMatch;

      res.json({
        success: true,
        wouldMatch,
        matchMethod: semanticMatch ? 'semantic' : (keywordMatch ? 'keyword' : 'none'),
        confidence: semanticMatch ? Math.round(semanticSimilarity * 100) : (keywordMatch ? 70 : 0),
        keywordMatch,
        matchedKeywords,
        semanticMatch,
        semanticSimilarity: Math.round(semanticSimilarity * 100),
        extractedKeywords: keywords,
        preview: response_template || ''
      });
    } catch (error) {
      logger.error('[Patterns] Test failed:', error);
      res.status(500).json({ success: false, error: 'Failed to test pattern' });
    }
  }
);

/**
 * POST /api/patterns/test-match
 * Test pattern matching with multiple methods (from patterns-enhanced.ts)
 */
router.post('/test-match',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const { message, patternId } = req.body;
      
      if (!message || !patternId) {
        return res.status(400).json({
          success: false,
          error: 'Message and patternId are required'
        });
      }
      
      // Get the pattern
      const patternResult = await db.query(
        'SELECT * FROM decision_patterns WHERE id = $1',
        [patternId]
      );
      
      if (patternResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Pattern not found'
        });
      }
      
      const pattern = patternResult.rows[0];
      
      // Test matching with multiple methods
      const matchResult = await testPatternMatch(message, pattern);
      
      res.json({
        success: true,
        pattern: {
          id: pattern.id,
          type: pattern.pattern_type,
          pattern: pattern.pattern
        },
        message,
        results: matchResult
      });
    } catch (error) {
      logger.error('[Enhanced Patterns API] Error testing pattern match:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test pattern match'
      });
    }
  }
);

/**
 * GET /api/patterns/stats
 * Get comprehensive pattern statistics
 */
router.get('/stats',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      // Get overall stats
      const statsResult = await db.query(`
        SELECT 
          COUNT(*) as total_all_patterns,
          COUNT(*) FILTER (WHERE is_active = TRUE) as total_patterns,
          COUNT(*) FILTER (WHERE is_active = TRUE AND auto_executable = TRUE) as auto_executable_patterns,
          COUNT(*) FILTER (WHERE is_active = TRUE AND confidence_score >= 0.95) as high_confidence_patterns,
          COUNT(*) FILTER (WHERE is_active = TRUE AND confidence_score >= 0.75) as medium_confidence_patterns,
          COUNT(*) FILTER (WHERE is_active = TRUE AND confidence_score < 0.75) as low_confidence_patterns,
          COUNT(*) FILTER (WHERE is_active = TRUE AND semantic_search_enabled = TRUE) as semantic_enabled,
          COUNT(*) FILTER (WHERE is_active = TRUE AND embedding IS NOT NULL) as has_embeddings,
          AVG(CASE WHEN is_active = TRUE THEN confidence_score ELSE NULL END) as avg_confidence,
          SUM(CASE WHEN is_active = TRUE THEN execution_count ELSE 0 END) as total_executions,
          SUM(CASE WHEN is_active = TRUE THEN success_count ELSE 0 END) as total_successes
        FROM decision_patterns
      `);
      
      // Get pattern type distribution
      const typeResult = await db.query(`
        SELECT 
          pattern_type,
          COUNT(*) as count,
          AVG(confidence_score) as avg_confidence,
          SUM(execution_count) as total_executions,
          COUNT(*) FILTER (WHERE auto_executable = TRUE) as auto_executable
        FROM decision_patterns
        WHERE is_active = TRUE
        GROUP BY pattern_type
        ORDER BY count DESC
      `);
      
      const stats = statsResult.rows[0];
      const successRate = stats.total_executions > 0 
        ? Math.round((stats.total_successes / stats.total_executions) * 100)
        : 0;
      
      res.json({
        success: true,
        overview: {
          total_patterns: parseInt(stats.total_patterns),
          auto_executable: parseInt(stats.auto_executable_patterns),
          high_confidence: parseInt(stats.high_confidence_patterns),
          medium_confidence: parseInt(stats.medium_confidence_patterns),
          low_confidence: parseInt(stats.low_confidence_patterns),
          semantic_enabled: parseInt(stats.semantic_enabled),
          has_embeddings: parseInt(stats.has_embeddings),
          avg_confidence: parseFloat(stats.avg_confidence).toFixed(2),
          total_executions: parseInt(stats.total_executions),
          success_rate: successRate + '%'
        },
        by_type: typeResult.rows
      });
    } catch (error) {
      logger.error('[Enhanced Patterns API] Failed to get statistics', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get statistics' 
      });
    }
  }
);

// ============================================
// CONFIG & SAFETY SETTINGS (MUST BE BEFORE /:id)
// ============================================

/**
 * GET /api/patterns/config
 * Get pattern learning configuration
 */
router.get('/config',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      // Get configuration from pattern_learning_config table
      const result = await db.query(`
        SELECT config_key, config_value
        FROM pattern_learning_config
      `);

      // Transform to object format
      const config: any = {};
      result.rows.forEach(row => {
        const value = row.config_value;
        // Convert string values to appropriate types
        if (value === 'true') config[row.config_key] = true;
        else if (value === 'false') config[row.config_key] = false;
        else if (!isNaN(Number(value))) config[row.config_key] = Number(value);
        else config[row.config_key] = value;
      });

      // Ensure openphone_enabled has a default if not set
      if (config.openphone_enabled === undefined) {
        config.openphone_enabled = false; // Default to OFF for safety
      }

      res.json(config);
    } catch (error) {
      logger.error('[Pattern Config] Failed to get configuration', error);
      // Return default config if table doesn't exist
      res.json({
        enabled: false,
        shadow_mode: true,
        openphone_enabled: false, // Default to OFF for safety
        min_confidence_to_suggest: 0.60,
        min_confidence_to_act: 0.85,
        min_occurrences_to_learn: 1
      });
    }
  }
);

/**
 * PUT /api/patterns/config
 * Update pattern learning configuration
 */
router.put('/config',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response) => {
    try {
      const {
        enabled,
        shadow_mode,
        openphone_enabled,
        min_confidence_to_suggest,
        min_confidence_to_act,
        min_occurrences_to_learn
      } = req.body;

      // Update each config value if provided
      const updates = [
        { key: 'enabled', value: enabled },
        { key: 'shadow_mode', value: shadow_mode },
        { key: 'openphone_enabled', value: openphone_enabled },
        { key: 'suggest_threshold', value: min_confidence_to_suggest },
        { key: 'auto_execute_threshold', value: min_confidence_to_act },
        { key: 'min_executions_for_auto', value: min_occurrences_to_learn }
      ];

      for (const update of updates) {
        if (update.value !== undefined) {
          // Use UPSERT to handle new keys that don't exist yet
          await db.query(`
            INSERT INTO pattern_learning_config (config_key, config_value)
            VALUES ($1, $2)
            ON CONFLICT (config_key) DO UPDATE
            SET config_value = $2
          `, [update.key, String(update.value)]);
        }
      }

      // Log configuration change
      logger.info('[Pattern Config] Configuration updated', {
        enabled,
        shadow_mode,
        updatedBy: req.user!.email
      });

      res.json({
        success: true,
        message: 'Pattern learning configuration updated'
      });
    } catch (error) {
      logger.error('[Pattern Config] Failed to update configuration', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update configuration'
      });
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
 * GET /api/patterns/:id
 * Get a specific pattern with full details
 */
router.get('/:id',
  authenticate,
  roleGuard(['admin', 'operator']),
  [param('id').isInt()],
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const patternResult = await db.query(`
        SELECT 
          id,
          pattern_type,
          COALESCE(pattern, trigger_text, trigger_examples[1], '') as pattern,
          COALESCE(trigger_text, pattern, trigger_examples[1], '') as trigger_text,
          response_template,
          trigger_examples,
          trigger_keywords,
          confidence_score,
          execution_count,
          success_count,
          is_active,
          auto_executable,
          COALESCE(is_deleted, FALSE) as is_deleted,
          COALESCE(created_at, first_seen, NOW()) as created_at,
          COALESCE(updated_at, last_modified, NOW()) as updated_at,
          notes,
          tags,
          action_template,
          requires_confirmation,
          COALESCE(last_used, updated_at, NOW()) as last_used,
          semantic_search_enabled,
          embedding IS NOT NULL as has_embedding,
          CASE 
            WHEN success_count > 0 AND execution_count > 0 
            THEN ROUND((success_count::float / execution_count::float * 100)::numeric, 0)
            ELSE 0 
          END as success_rate
        FROM decision_patterns 
        WHERE id = $1`,
        [id]
      );

      if (patternResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Pattern not found' 
        });
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

      res.json({
        success: true,
        pattern: patternResult.rows[0],
        recent_executions: historyResult.rows
      });
    } catch (error) {
      logger.error('[Enhanced Patterns API] Failed to get pattern', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get pattern' 
      });
    }
  }
);

// ============================================
// CSV IMPORT ENDPOINTS
// ============================================

// Rate limiter for CSV imports - 1 import per hour per user
const csvImportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 1, // 1 import per hour
  message: 'Too many import attempts. Please wait 1 hour before importing another CSV.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip, // Rate limit by user ID
});

// Configure multer for CSV uploads
const csvUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req: any, file: any, cb: any) => {
    // Accept CSV files
    if (file.mimetype === 'text/csv' || 
        file.mimetype === 'application/csv' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

/**
 * POST /api/patterns/import/csv
 * Import patterns from OpenPhone CSV export
 */
router.post('/import/csv',
  authenticate,
  roleGuard(['admin']), // Admin only initially
  csvImportLimiter, // Apply rate limiting
  csvUpload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      // Convert buffer to string
      const csvData = req.file.buffer.toString('utf-8');
      
      // Validate CSV has required columns
      const firstLine = csvData.split('\n')[0];
      const requiredColumns = ['id', 'conversationBody', 'direction', 'from', 'to', 'sentAt'];
      const hasRequiredColumns = requiredColumns.every(col => 
        firstLine.toLowerCase().includes(col.toLowerCase())
      );
      
      if (!hasRequiredColumns) {
        return res.status(400).json({
          success: false,
          error: 'Invalid CSV format. Please use OpenPhone export format with columns: id, conversationBody, direction, from, to, sentAt'
        });
      }

      // Start import job
      const job = await csvImportService.startImport(csvData, req.user!.id);
      
      logger.info('[CSV Import] Job started', { 
        jobId: job.id, 
        userId: req.user!.id,
        fileName: req.file.originalname,
        fileSize: req.file.size
      });

      res.json({
        success: true,
        jobId: job.id,
        status: job.status,
        totalMessages: job.totalMessages
      });
    } catch (error: any) {
      logger.error('[CSV Import] Failed to start import', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to start CSV import'
      });
    }
  }
);

/**
 * GET /api/patterns/import/status/:jobId
 * Get CSV import job status
 */
router.get('/import/status/:jobId',
  authenticate,
  [param('jobId').isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      const { jobId } = req.params;
      
      // Get job status from service
      const job = csvImportService.getJobStatus(jobId);
      
      if (!job) {
        // Try to get from database if not in memory
        const dbResult = await db.query(
          `SELECT * FROM pattern_import_jobs WHERE id = $1 AND user_id = $2`,
          [jobId, req.user!.id]
        );
        
        if (dbResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Import job not found'
          });
        }
        
        const dbJob = dbResult.rows[0];
        return res.json({
          success: true,
          job: {
            id: dbJob.id,
            status: dbJob.status,
            totalMessages: dbJob.total_messages,
            processedMessages: dbJob.processed_messages,
            conversationsFound: dbJob.conversations_found,
            conversationsAnalyzed: dbJob.conversations_analyzed,
            patternsCreated: dbJob.patterns_created,
            patternsEnhanced: dbJob.patterns_enhanced,
            errors: dbJob.errors || [],
            startedAt: dbJob.started_at,
            completedAt: dbJob.completed_at
          }
        });
      }
      
      res.json({
        success: true,
        job: job
      });
    } catch (error) {
      logger.error('[CSV Import] Failed to get job status', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get import status'
      });
    }
  }
);

/**
 * GET /api/patterns/import/history
 * Get recent import jobs for current user
 */
router.get('/import/history',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        `SELECT 
          id,
          status,
          total_messages,
          processed_messages,
          conversations_found,
          conversations_analyzed,
          patterns_created,
          patterns_enhanced,
          patterns_staged,
          errors,
          started_at,
          completed_at,
          review_completed
        FROM pattern_import_jobs
        WHERE user_id = $1
        ORDER BY started_at DESC
        LIMIT 10`,
        [req.user!.id]
      );
      
      res.json({
        success: true,
        imports: result.rows
      });
    } catch (error) {
      logger.error('[CSV Import] Failed to get import history', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get import history'
      });
    }
  }
);

/**
 * GET /api/patterns/import/staging/:jobId
 * Get staged patterns for review
 */
router.get('/import/staging/:jobId',
  authenticate,
  roleGuard(['admin']),
  [
    param('jobId').isUUID(),
    queryValidator('page').optional().isInt({ min: 1 }).toInt(),
    queryValidator('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }
      
      const { jobId } = req.params;
      const { status = 'all' } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;
      
      // Get total count first
      let countQuery = `
        SELECT COUNT(*) as total
        FROM pattern_import_staging ps
        WHERE ps.import_job_id = $1
      `;
      
      const countParams: any[] = [jobId];
      
      if (status !== 'all') {
        countQuery += ` AND ps.status = $2`;
        countParams.push(status);
      }
      
      const countResult = await db.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].total);
      
      // Get paginated results
      let query = `
        SELECT 
          ps.*,
          u.name as reviewed_by_name
        FROM pattern_import_staging ps
        LEFT JOIN users u ON ps.reviewed_by = u.id
        WHERE ps.import_job_id = $1
      `;
      
      const params: any[] = [jobId];
      
      if (status !== 'all') {
        query += ` AND ps.status = $2`;
        params.push(status);
      }
      
      query += ` ORDER BY ps.confidence_score DESC, ps.created_at DESC`;
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
      
      const result = await db.query(query, params);
      
      res.json({
        success: true,
        patterns: result.rows,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      logger.error('[Pattern Staging] Failed to get staged patterns', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get staged patterns'
      });
    }
  }
);

/**
 * POST /api/patterns/import/approve
 * Approve staged patterns
 */
router.post('/import/approve',
  authenticate,
  roleGuard(['admin']),
  [
    body('patternIds')
      .isArray()
      .withMessage('Pattern IDs must be an array')
      .custom((value) => {
        if (!Array.isArray(value)) return false;
        if (value.length === 0) throw new Error('At least one pattern ID is required');
        if (value.length > 100) throw new Error('Maximum 100 patterns can be approved at once');
        return true;
      }),
    body('patternIds.*')
      .isInt({ min: 1, max: 2147483647 })
      .withMessage('Each pattern ID must be a valid positive integer')
      .toInt()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }
      
      const { patternIds } = req.body;
      
      // Additional runtime validation
      const validatedIds = patternIds.filter((id: any) => 
        Number.isInteger(id) && id > 0 && id <= Number.MAX_SAFE_INTEGER
      );
      
      if (validatedIds.length !== patternIds.length) {
        return res.status(400).json({
          success: false,
          error: 'Invalid pattern IDs detected'
        });
      }
      
      // Call the stored procedure with validated IDs
      const result = await db.query(
        'SELECT * FROM approve_staged_patterns($1, $2)',
        [validatedIds, req.user!.id]
      );
      
      const { approved_count, failed_count } = result.rows[0];
      
      res.json({
        success: true,
        approved: approved_count,
        failed: failed_count,
        message: `Successfully approved ${approved_count} patterns${failed_count > 0 ? `, ${failed_count} failed` : ''}`
      });
    } catch (error) {
      logger.error('[Pattern Approval] Failed to approve patterns', error);
      res.status(500).json({
        success: false,
        error: 'Failed to approve patterns'
      });
    }
  }
);

/**
 * POST /api/patterns/import/reject
 * Reject staged patterns
 */
router.post('/import/reject',
  authenticate,
  roleGuard(['admin']),
  [
    body('patternIds')
      .isArray()
      .withMessage('Pattern IDs must be an array')
      .custom((value) => {
        if (!Array.isArray(value)) return false;
        if (value.length === 0) throw new Error('At least one pattern ID is required');
        if (value.length > 100) throw new Error('Maximum 100 patterns can be rejected at once');
        return true;
      }),
    body('patternIds.*')
      .isInt({ min: 1, max: 2147483647 })
      .withMessage('Each pattern ID must be a valid positive integer')
      .toInt(),
    body('reason')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Reason must be less than 500 characters')
      .trim()
      .escape()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }
      
      const { patternIds, reason } = req.body;
      
      // Additional runtime validation
      const validatedIds = patternIds.filter((id: any) => 
        Number.isInteger(id) && id > 0 && id <= Number.MAX_SAFE_INTEGER
      );
      
      if (validatedIds.length !== patternIds.length) {
        return res.status(400).json({
          success: false,
          error: 'Invalid pattern IDs detected'
        });
      }
      
      // Call the stored procedure with validated IDs
      const result = await db.query(
        'SELECT reject_staged_patterns($1, $2, $3) as rejected_count',
        [validatedIds, req.user!.id, reason || null]
      );
      
      const rejectedCount = result.rows[0].rejected_count;
      
      res.json({
        success: true,
        rejected: rejectedCount,
        message: `Successfully rejected ${rejectedCount} patterns`
      });
    } catch (error) {
      logger.error('[Pattern Rejection] Failed to reject patterns', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reject patterns'
      });
    }
  }
);

/**
 * PUT /api/patterns/import/staging/:id
 * Edit a staged pattern before approval
 */
router.put('/import/staging/:id',
  authenticate,
  roleGuard(['admin']),
  [
    param('id').isInt(),
    body('trigger_text').optional().isString(),
    body('response_template').optional().isString(),
    body('confidence_score').optional().isFloat({ min: 0, max: 1 })
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }
      
      const { id } = req.params;
      const { trigger_text, response_template, confidence_score } = req.body;
      
      // Sanitize inputs to prevent XSS
      const sanitizedTrigger = trigger_text ? sanitizeText(trigger_text) : undefined;
      const sanitizedResponse = response_template ? sanitizePatternTemplate(response_template) : undefined;
      
      // Validate ID is numeric
      const validatedId = parseInt(id);
      if (isNaN(validatedId) || validatedId <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid pattern ID'
        });
      }
      
      // Store original values if this is the first edit
      await db.query(`
        UPDATE pattern_import_staging
        SET 
          original_trigger = COALESCE(original_trigger, trigger_text),
          original_response = COALESCE(original_response, response_template),
          trigger_text = COALESCE($1, trigger_text),
          response_template = COALESCE($2, response_template),
          confidence_score = COALESCE($3, confidence_score),
          status = 'edited',
          edited_by = $4,
          edited_at = NOW()
        WHERE id = $5
      `, [sanitizedTrigger, sanitizedResponse, confidence_score, req.user!.id, validatedId]);
      
      res.json({
        success: true,
        message: 'Pattern updated successfully'
      });
    } catch (error) {
      logger.error('[Pattern Edit] Failed to edit staged pattern', error);
      res.status(500).json({
        success: false,
        error: 'Failed to edit pattern'
      });
    }
  }
);

// ============================================
// STANDARD CRUD ENDPOINTS (MISSING FROM CONSOLIDATION)
// ============================================

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
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
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

      // Auto-extract keywords from trigger examples (fallback for keyword matching)
      const extractedKeywords = extractKeywords(trigger_examples);
      const finalKeywords = (trigger_keywords?.length > 0) ? trigger_keywords : extractedKeywords;

      logger.info('[Patterns] Creating pattern', {
        type: pattern_type,
        triggerCount: trigger_examples.length,
        keywordCount: finalKeywords.length,
        keywords: finalKeywords.slice(0, 5),
        semanticEnabled: semantic_search_enabled
      });

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
      
      // Generate embedding if OpenAI is available
      let embedding = null;
      if (semantic_search_enabled && openai) {
        try {
          const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: trigger_examples.join(' ')
          });
          embedding = embeddingResponse.data[0].embedding;
          
          // Check for semantically similar patterns
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
              AND cosine_similarity(embedding, $1::float[]) > 0.85
            ORDER BY similarity DESC
            LIMIT 3
          `, [`{${embedding.join(',')}}`]);
          
          if (similarPatterns.rows.length > 0) {
            const topMatch = similarPatterns.rows[0];
            logger.warn('[Enhanced Patterns API] Similar pattern detected', {
              newPattern: trigger_examples[0],
              existingPattern: topMatch.trigger_text,
              similarity: topMatch.similarity
            });
            
            return res.status(409).json({
              success: false,
              error: 'A semantically similar pattern already exists',
              existingPattern: {
                id: topMatch.id,
                trigger_text: topMatch.trigger_text,
                similarity: topMatch.similarity
              }
            });
          }
        } catch (error) {
          logger.error('[Enhanced Patterns API] Failed to generate embedding', error);
          // Continue without embedding
        }
      }

      // Insert the new pattern
      const result = await db.query(`
        INSERT INTO decision_patterns (
          pattern_type,
          trigger_text,
          trigger_examples,
          trigger_keywords,
          response_template,
          confidence_score,
          auto_executable,
          is_active,
          pattern_signature,
          embedding,
          created_by,
          created_from
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        ) RETURNING *
      `, [
        pattern_type,
        trigger_examples[0], // Use first example as trigger_text
        trigger_examples,
        finalKeywords, // Auto-extracted from trigger_examples if not provided
        response_template,
        confidence_score,
        auto_executable,
        true, // Start as active
        pattern_signature,
        embedding ? `{${embedding.join(',')}}` : null,
        req.user?.id,
        'manual'
      ]);

      const createdPattern = result.rows[0];

      logger.info('[Enhanced Patterns API] Pattern created', {
        patternId: createdPattern.id,
        pattern_type,
        createdBy: req.user?.email
      });

      // If embedding failed but semantic search is enabled, queue for retry
      if (semantic_search_enabled && !createdPattern.embedding) {
        logger.warn('[Patterns] Embedding generation failed, queuing for retry', {
          patternId: createdPattern.id
        });

        // Queue async retry (don't block the response)
        regenerateEmbedding(createdPattern.id, trigger_examples).catch(err => {
          logger.error('[Patterns] Background embedding retry failed:', err);
        });
      }

      res.status(201).json({
        success: true,
        pattern: createdPattern
      });
    } catch (error) {
      logger.error('[Enhanced Patterns API] Failed to create pattern', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create pattern' 
      });
    }
  }
);

/**
 * PUT /api/patterns/:id
 * Update a pattern (response, confidence, active status)
 * CRITICAL: This endpoint was missing, causing toggle issues
 */
router.put('/:id',
  authenticate,
  roleGuard(['admin', 'operator']),
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
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

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
        return res.status(400).json({ 
          success: false, 
          error: 'No updates provided' 
        });
      }

      // Add last_modified
      updateFields.push(`last_modified = NOW()`);
      
      // Add id as last parameter
      values.push(id);

      await db.query(
        `UPDATE decision_patterns SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
        values
      );

      // Log confidence changes
      if (updates.confidence_score !== undefined) {
        await db.query(`
          INSERT INTO confidence_evolution 
          (pattern_id, old_confidence, new_confidence, change_reason, changed_by)
          SELECT id, confidence_score, $1, 'manual_adjustment', $2
          FROM decision_patterns WHERE id = $3
        `, [updates.confidence_score, req.user?.id, id]);
      }

      logger.info('[Enhanced Patterns API] Pattern updated', {
        patternId: id,
        updates,
        updatedBy: req.user?.email
      });

      res.json({ 
        success: true, 
        message: 'Pattern updated' 
      });
    } catch (error) {
      logger.error('[Enhanced Patterns API] Failed to update pattern', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update pattern' 
      });
    }
  }
);

/**
 * DELETE /api/patterns/:id
 * Soft delete a pattern (sets is_deleted = true, is_active = false)
 */
router.delete('/:id',
  authenticate,
  roleGuard(['admin', 'operator']),
  [param('id').isInt()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      const { id } = req.params;

      await db.query(
        `UPDATE decision_patterns 
         SET is_deleted = TRUE, 
             deleted_at = NOW(), 
             deleted_by = $2,
             is_active = FALSE,
             last_modified = NOW()
         WHERE id = $1`,
        [id, req.user?.id]
      );

      logger.info('[Enhanced Patterns API] Pattern soft deleted', {
        patternId: id,
        deletedBy: req.user?.email
      });

      res.json({ 
        success: true, 
        message: 'Pattern deleted' 
      });
    } catch (error) {
      logger.error('[Enhanced Patterns API] Failed to delete pattern', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to delete pattern' 
      });
    }
  }
);

// ============================================
// QUEUE MANAGEMENT ENDPOINTS (for Live Dashboard)
// ============================================

/**
 * GET /api/patterns/queue
 * Get pending pattern suggestions waiting for operator review
 */
router.get('/queue',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  async (req: Request, res: Response) => {
    try {
      // Get pending suggestions from queue
      const result = await db.query(`
        SELECT
          psq.id,
          psq.pattern_id as "patternId",
          psq.suggested_response as "suggestedResponse",
          psq.confidence_score as confidence,
          psq.created_at as "createdAt",
          peh.conversation_id as "conversationId",
          peh.phone_number as "phoneNumber",
          peh.customer_name as "customerName",
          peh.message_text as "originalMessage",
          peh.gpt4o_reasoning as reasoning,
          dp.pattern_type as "patternType"
        FROM pattern_suggestions_queue psq
        LEFT JOIN pattern_execution_history peh ON psq.execution_history_id = peh.id
        LEFT JOIN decision_patterns dp ON psq.pattern_id = dp.id
        WHERE psq.status = 'pending'
        AND (psq.expires_at IS NULL OR psq.expires_at > NOW())
        ORDER BY psq.priority DESC, psq.created_at ASC
        LIMIT 20
      `);

      res.json({
        success: true,
        queue: result.rows.map(row => ({
          ...row,
          reasoning: row.reasoning ? JSON.parse(row.reasoning) : null
        }))
      });
    } catch (error) {
      logger.error('[Patterns Queue] Failed to fetch queue', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch pattern queue'
      });
    }
  }
);

/**
 * GET /api/patterns/recent-activity
 * Get recent pattern execution activity
 */
router.get('/recent-activity',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  async (req: Request, res: Response) => {
    try {
      const result = await db.query(`
        SELECT
          peh.id,
          peh.created_at as time,
          peh.phone_number as phone,
          peh.customer_name as "customerName",
          peh.message_text as message,
          dp.pattern_type as pattern,
          ROUND((peh.confidence_at_execution * 100)::numeric, 0) as confidence,
          peh.execution_status as status,
          peh.execution_mode as mode
        FROM pattern_execution_history peh
        LEFT JOIN decision_patterns dp ON peh.pattern_id = dp.id
        WHERE peh.created_at > NOW() - INTERVAL '24 hours'
        ORDER BY peh.created_at DESC
        LIMIT 50
      `);

      res.json({
        success: true,
        activity: result.rows
      });
    } catch (error) {
      logger.error('[Patterns Activity] Failed to fetch recent activity', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch recent activity'
      });
    }
  }
);

/**
 * POST /api/patterns/queue/:id/respond
 * Handle operator action on a queued suggestion
 */
router.post('/queue/:id/respond',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  [
    param('id').isInt(),
    body('action').isIn(['accept', 'modify', 'reject']),
    body('modifiedResponse').optional().isString()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { action, modifiedResponse } = req.body;

      // Get the queued suggestion
      const queueResult = await db.query(`
        SELECT
          psq.*,
          peh.phone_number,
          peh.conversation_id,
          peh.pattern_id
        FROM pattern_suggestions_queue psq
        JOIN pattern_execution_history peh ON psq.execution_history_id = peh.id
        WHERE psq.id = $1 AND psq.status = 'pending'
      `, [id]);

      if (queueResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Suggestion not found or already processed'
        });
      }

      const suggestion = queueResult.rows[0];
      let responseToSend = suggestion.suggested_response;

      // Handle the action
      switch (action) {
        case 'accept':
          // Send the suggested response
          responseToSend = suggestion.suggested_response;

          // Update pattern confidence (increase)
          await db.query(`
            UPDATE decision_patterns
            SET confidence_score = LEAST(confidence_score + 0.05, 1.0),
                success_count = success_count + 1,
                execution_count = execution_count + 1,
                last_used = NOW()
            WHERE id = $1
          `, [suggestion.pattern_id]);

          // Update execution history
          await db.query(`
            UPDATE pattern_execution_history
            SET execution_status = 'success',
                human_approved = true,
                human_review_at = NOW(),
                reviewed_by = $2,
                response_sent = $3,
                completed_at = NOW()
            WHERE id = $1
          `, [suggestion.execution_history_id, req.user?.id, responseToSend]);
          break;

        case 'modify':
          // Use the modified response
          responseToSend = modifiedResponse || suggestion.suggested_response;

          // Update pattern confidence (small increase)
          await db.query(`
            UPDATE decision_patterns
            SET confidence_score = LEAST(confidence_score + 0.02, 1.0),
                execution_count = execution_count + 1,
                human_override_count = human_override_count + 1,
                last_used = NOW()
            WHERE id = $1
          `, [suggestion.pattern_id]);

          // Update execution history
          await db.query(`
            UPDATE pattern_execution_history
            SET execution_status = 'modified',
                human_approved = true,
                human_modified = true,
                modifications = jsonb_build_object('response', $3),
                human_review_at = NOW(),
                reviewed_by = $2,
                response_sent = $3,
                completed_at = NOW()
            WHERE id = $1
          `, [suggestion.execution_history_id, req.user?.id, responseToSend]);
          break;

        case 'reject':
          // Don't send anything
          responseToSend = null;

          // Update pattern confidence (decrease)
          await db.query(`
            UPDATE decision_patterns
            SET confidence_score = GREATEST(confidence_score - 0.10, 0.0),
                failure_count = failure_count + 1,
                execution_count = execution_count + 1
            WHERE id = $1
          `, [suggestion.pattern_id]);

          // Update execution history
          await db.query(`
            UPDATE pattern_execution_history
            SET execution_status = 'cancelled',
                human_rejected = true,
                rejection_reason = 'Operator rejected suggestion',
                human_review_at = NOW(),
                reviewed_by = $2,
                completed_at = NOW()
            WHERE id = $1
          `, [suggestion.execution_history_id, req.user?.id]);
          break;
      }

      // Update queue status
      await db.query(`
        UPDATE pattern_suggestions_queue
        SET status = $2,
            reviewed_by = $3,
            reviewed_at = NOW(),
            review_notes = $4
        WHERE id = $1
      `, [id, action === 'reject' ? 'rejected' : 'approved', req.user?.id, action]);

      // Send the message if not rejected
      if (responseToSend && (action === 'accept' || action === 'modify')) {
        try {
          const defaultNumber = process.env.OPENPHONE_DEFAULT_NUMBER;
          if (defaultNumber) {
            await openPhoneService.sendMessage(
              suggestion.phone_number,
              defaultNumber,
              responseToSend
            );

            logger.info('[Pattern Queue] Response sent after operator action', {
              action,
              queueId: id,
              phoneNumber: suggestion.phone_number,
              operatorId: req.user?.id
            });
          }
        } catch (sendError) {
          logger.error('[Pattern Queue] Failed to send message', sendError);
          return res.status(500).json({
            success: false,
            error: 'Failed to send message'
          });
        }
      }

      res.json({
        success: true,
        message: `Suggestion ${action}ed successfully`,
        action,
        messageSent: !!responseToSend
      });

    } catch (error) {
      logger.error('[Pattern Queue] Failed to process operator action', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process action'
      });
    }
  }
);

// Export the router
export default router;