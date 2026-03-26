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
import { patternSafetyService } from '../services/patternSafetyService';
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
      
      return res.json({
        success: true,
        patterns: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      logger.error('[Enhanced Patterns API] Error fetching patterns:', error);
      return res.status(500).json({ 
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
  async (_req: Request, res: Response) => {
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

      return res.json({
        success: true,
        patterns: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      logger.error('[Enhanced Patterns API] Failed to get deleted patterns', error);
      return res.status(500).json({ 
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
      
      return res.json({
        success: true,
        pattern: result.rows[0]
      });
    } catch (error) {
      logger.error('[Enhanced Patterns API] Error restoring pattern:', error);
      return res.status(500).json({ 
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

      return res.json({
        success: true,
        pattern: result.rows[0]
      });
    } catch (error) {
      logger.error('[Enhanced Patterns API] Error updating pattern:', error);
      return res.status(500).json({
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

      return res.json({
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
      return res.status(500).json({ success: false, error: 'Failed to test pattern' });
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
      
      return res.json({
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
      return res.status(500).json({
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
  async (_req: Request, res: Response) => {
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
      
      return res.json({
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
      return res.status(500).json({ 
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
  async (_req: Request, res: Response) => {
    try {
      // Get configuration from pattern_learning_config table
      const result = await db.query(`
        SELECT config_key, config_value
        FROM pattern_learning_config
      `);

      // Transform to object format
      const config: any = {};
      result.rows.forEach((row: any) => {
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

      return res.json(config);
    } catch (error) {
      logger.error('[Pattern Config] Failed to get configuration', error);
      // Return default config if table doesn't exist
      return res.json({
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

      return res.json({
        success: true,
        message: 'Pattern learning configuration updated'
      });
    } catch (error) {
      logger.error('[Pattern Config] Failed to update configuration', error);
      return res.status(500).json({
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
  async (_req: Request, res: Response) => {
    try {
      const settings = await patternSafetyService.getSettings();
      return res.json(settings);
    } catch (error) {
      logger.error('[Patterns API] Failed to get safety settings', error);
      return res.status(500).json({ success: false, error: 'Failed to get safety settings' });
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
      return res.json({ success: true, message: 'Safety settings updated' });
    } catch (error) {
      logger.error('[Patterns API] Failed to update safety settings', error);
      return res.status(500).json({ success: false, error: 'Failed to update safety settings' });
    }
  }
);

/**
 * GET /api/patterns/safety-thresholds
 * Get configurable safety thresholds (rapid message, AI limit, sentiment, escalation messages)
 */
router.get('/safety-thresholds',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (_req: Request, res: Response) => {
    try {
      const thresholds = await patternSafetyService.getSafetyThresholds();
      return res.json({
        success: true,
        thresholds
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to get safety thresholds', error);
      return res.status(500).json({ success: false, error: 'Failed to get safety thresholds' });
    }
  }
);

/**
 * PUT /api/patterns/safety-thresholds
 * Update safety thresholds
 */
router.put('/safety-thresholds',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response) => {
    try {
      await patternSafetyService.updateSafetyThresholds(req.body);

      // Return updated thresholds
      const updatedThresholds = await patternSafetyService.getSafetyThresholds();

      return res.json({
        success: true,
        message: 'Safety thresholds updated',
        thresholds: updatedThresholds
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to update safety thresholds', error);
      return res.status(500).json({ success: false, error: 'Failed to update safety thresholds' });
    }
  }
);

/**
 * POST /api/patterns/sentiment-patterns/reset
 * Reset sentiment patterns to defaults
 */
router.post('/sentiment-patterns/reset',
  authenticate,
  roleGuard(['admin']),
  async (_req: Request, res: Response) => {
    try {
      await patternSafetyService.resetSentimentPatterns();
      const thresholds = await patternSafetyService.getSafetyThresholds();

      return res.json({
        success: true,
        message: 'Sentiment patterns reset to defaults',
        patterns: thresholds.negativeSentimentPatterns
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to reset sentiment patterns', error);
      return res.status(500).json({ success: false, error: 'Failed to reset sentiment patterns' });
    }
  }
);

/**
 * GET /api/patterns/sentiment-patterns/defaults
 * Get default sentiment patterns
 */
router.get('/sentiment-patterns/defaults',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (_req: Request, res: Response) => {
    try {
      const defaults = patternSafetyService.getDefaultSentimentPatterns();
      return res.json({
        success: true,
        patterns: defaults
      });
    } catch (error) {
      logger.error('[Patterns API] Failed to get default sentiment patterns', error);
      return res.status(500).json({ success: false, error: 'Failed to get default patterns' });
    }
  }
);

/**
 * GET /api/patterns/:id
 * Get a specific pattern with full details (numeric IDs only)
 */
router.get('/:id(\\d+)',
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

      return res.json({
        success: true,
        pattern: patternResult.rows[0],
        recent_executions: historyResult.rows
      });
    } catch (error) {
      logger.error('[Enhanced Patterns API] Failed to get pattern', error);
      return res.status(500).json({ 
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
  keyGenerator: (req) => req.user?.id || req.ip || 'unknown', // Rate limit by user ID
});

// Configure multer for CSV uploads
const csvUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req: any, file: any, cb: any) => {
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

      return res.json({
        success: true,
        jobId: job.id,
        status: job.status,
        totalMessages: job.totalMessages
      });
    } catch (error: any) {
      logger.error('[CSV Import] Failed to start import', error);
      return res.status(500).json({
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
      
      return res.json({
        success: true,
        job: job
      });
    } catch (error) {
      logger.error('[CSV Import] Failed to get job status', error);
      return res.status(500).json({
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
      
      return res.json({
        success: true,
        imports: result.rows
      });
    } catch (error) {
      logger.error('[CSV Import] Failed to get import history', error);
      return res.status(500).json({
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
      
      return res.json({
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
      return res.status(500).json({
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
      
      return res.json({
        success: true,
        approved: approved_count,
        failed: failed_count,
        message: `Successfully approved ${approved_count} patterns${failed_count > 0 ? `, ${failed_count} failed` : ''}`
      });
    } catch (error) {
      logger.error('[Pattern Approval] Failed to approve patterns', error);
      return res.status(500).json({
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
      
      return res.json({
        success: true,
        rejected: rejectedCount,
        message: `Successfully rejected ${rejectedCount} patterns`
      });
    } catch (error) {
      logger.error('[Pattern Rejection] Failed to reject patterns', error);
      return res.status(500).json({
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
      
      return res.json({
        success: true,
        message: 'Pattern updated successfully'
      });
    } catch (error) {
      logger.error('[Pattern Edit] Failed to edit staged pattern', error);
      return res.status(500).json({
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

      return res.status(201).json({
        success: true,
        pattern: createdPattern
      });
    } catch (error) {
      logger.error('[Enhanced Patterns API] Failed to create pattern', error);
      return res.status(500).json({ 
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
router.put('/:id(\\d+)',
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

      return res.json({ 
        success: true, 
        message: 'Pattern updated' 
      });
    } catch (error) {
      logger.error('[Enhanced Patterns API] Failed to update pattern', error);
      return res.status(500).json({ 
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
router.delete('/:id(\\d+)',
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

      return res.json({ 
        success: true, 
        message: 'Pattern deleted' 
      });
    } catch (error) {
      logger.error('[Enhanced Patterns API] Failed to delete pattern', error);
      return res.status(500).json({ 
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
  async (_req: Request, res: Response) => {
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

      return res.json({
        success: true,
        queue: result.rows.map((row: any) => ({
          ...row,
          reasoning: row.reasoning ? JSON.parse(row.reasoning) : null
        }))
      });
    } catch (error) {
      logger.error('[Patterns Queue] Failed to fetch queue', error);
      return res.status(500).json({
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
  async (_req: Request, res: Response) => {
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

      return res.json({
        success: true,
        activity: result.rows
      });
    } catch (error) {
      logger.error('[Patterns Activity] Failed to fetch recent activity', error);
      return res.status(500).json({
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

      return res.json({
        success: true,
        message: `Suggestion ${action}ed successfully`,
        action,
        messageSent: !!responseToSend
      });

    } catch (error) {
      logger.error('[Pattern Queue] Failed to process operator action', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to process action'
      });
    }
  }
);

// ===== ClubAI Endpoints =====

/**
 * GET /api/patterns/clubai-stats
 * Get ClubAI conversation statistics for today
 */
router.get('/clubai-stats', authenticate, async (_req: Request, res: Response) => {
  try {
    // Check if clubai columns exist before querying them
    const colCheck = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'openphone_conversations' AND column_name = 'clubai_messages_sent'
    `);

    if (colCheck.rows.length === 0) {
      // Columns haven't been added yet — return zeros
      return res.json({
        success: true,
        data: { conversationsToday: 0, messagesSent: 0, escalated: 0, resolved: 0, correctionsToday: 0, accuracyRate: 100 }
      });
    }

    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE clubai_messages_sent > 0) as conversations_today,
        COALESCE(SUM(clubai_messages_sent), 0) as messages_sent,
        COUNT(*) FILTER (WHERE clubai_escalated = true) as escalated,
        COUNT(*) FILTER (WHERE clubai_messages_sent > 0 AND clubai_escalated = false) as resolved
      FROM openphone_conversations
      WHERE created_at >= CURRENT_DATE
    `);

    const stats = result.rows[0] || { conversations_today: 0, messages_sent: 0, escalated: 0, resolved: 0 };

    // Fetch correction stats from clubai_corrections table
    let correctionsToday = 0;
    try {
      const corrResult = await db.query(`
        SELECT COUNT(*) as corrections_today
        FROM clubai_corrections
        WHERE created_at >= CURRENT_DATE
      `);
      correctionsToday = parseInt(corrResult.rows[0]?.corrections_today) || 0;
    } catch {
      // Table may not exist yet — return 0
    }

    const messagesSent = parseInt(stats.messages_sent) || 0;
    const accuracyRate = messagesSent > 0
      ? Math.round(((messagesSent - correctionsToday) / messagesSent) * 100)
      : 100;

    return res.json({
      success: true,
      data: {
        conversationsToday: parseInt(stats.conversations_today) || 0,
        messagesSent,
        escalated: parseInt(stats.escalated) || 0,
        resolved: parseInt(stats.resolved) || 0,
        correctionsToday,
        accuracyRate,
      }
    });
  } catch (error) {
    logger.error('[ClubAI Stats] Error:', error);
    // Return empty data instead of 500 so the page still loads
    return res.json({
      success: true,
      data: { conversationsToday: 0, messagesSent: 0, escalated: 0, resolved: 0, correctionsToday: 0, accuracyRate: 100 }
    });
  }
});

/**
 * GET /api/patterns/clubai-knowledge
 * Get ClubAI system prompt and knowledge base content (read-only)
 */
router.get('/clubai-knowledge', authenticate, async (_req: Request, res: Response) => {
  try {
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const basePath = join(__dirname, '..', 'knowledge-base');

    let systemPrompt = '';
    let knowledgeBase = '';

    try {
      systemPrompt = readFileSync(join(basePath, 'clubai-system-prompt.md'), 'utf-8');
    } catch { systemPrompt = 'System prompt file not found'; }

    try {
      knowledgeBase = readFileSync(join(basePath, 'clubai-knowledge-base.md'), 'utf-8');
    } catch { knowledgeBase = 'Knowledge base file not found'; }

    return res.json({
      success: true,
      data: { systemPrompt, knowledgeBase }
    });
  } catch (error) {
    logger.error('[ClubAI Knowledge] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch knowledge base' });
  }
});

/**
 * GET /api/patterns/clubai-config
 * Get ClubAI configuration from pattern_learning_config, with env var fallbacks
 */
router.get('/clubai-config', authenticate, async (_req: Request, res: Response) => {
  // Env var defaults — always available even if DB fails
  const envEnabled = process.env.CLUBAI_ENABLED === 'true';
  const envShadow = process.env.CLUBAI_SHADOW_MODE === 'true';
  const envMaxMsgs = parseInt(process.env.CLUBAI_MAX_MESSAGES || '5');

  try {
    const result = await db.query(`
      SELECT config_key, config_value FROM pattern_learning_config
      WHERE config_key IN ('clubai_enabled', 'clubai_shadow_mode', 'clubai_approval_mode', 'clubai_max_messages')
    `);

    const dbConfig: Record<string, string> = {};
    for (const row of result.rows) {
      dbConfig[row.config_key] = row.config_value;
    }

    const enabled = dbConfig.clubai_enabled !== undefined ? dbConfig.clubai_enabled === 'true' : envEnabled;
    const shadowMode = dbConfig.clubai_shadow_mode !== undefined ? dbConfig.clubai_shadow_mode === 'true' : envShadow;
    const approvalMode = dbConfig.clubai_approval_mode !== undefined ? dbConfig.clubai_approval_mode === 'true' : false;
    const maxMessages = dbConfig.clubai_max_messages !== undefined ? parseInt(dbConfig.clubai_max_messages) : envMaxMsgs;

    // If DB was empty, seed it so future reads and writes are consistent
    if (result.rows.length === 0) {
      try {
        const defaults = [
          { key: 'clubai_enabled', value: String(enabled) },
          { key: 'clubai_shadow_mode', value: String(shadowMode) },
          { key: 'clubai_approval_mode', value: String(approvalMode) },
          { key: 'clubai_max_messages', value: String(maxMessages) },
        ];
        for (const { key, value } of defaults) {
          await db.query(`
            INSERT INTO pattern_learning_config (config_key, config_value, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (config_key) DO NOTHING
          `, [key, value]);
        }
        logger.info('[ClubAI Config] Seeded missing config keys from env vars');
      } catch (seedErr) {
        logger.warn('[ClubAI Config] Could not seed config keys (table may not have updated_at column):', seedErr);
      }
    }

    return res.json({ success: true, data: { enabled, shadowMode, approvalMode, maxMessages } });
  } catch (error) {
    logger.error('[ClubAI Config] DB error, falling back to env vars:', error);
    // Return env var defaults if DB query fails entirely
    return res.json({
      success: true,
      data: { enabled: envEnabled, shadowMode: envShadow, approvalMode: false, maxMessages: envMaxMsgs }
    });
  }
});

/**
 * PUT /api/patterns/clubai-config
 * Update ClubAI configuration
 */
router.put('/clubai-config', authenticate, async (req: Request, res: Response) => {
  try {
    const { user } = req as any;
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const { enabled, shadowMode, approvalMode, maxMessages } = req.body;

    const updates: Array<{ key: string; value: string }> = [];
    if (enabled !== undefined) updates.push({ key: 'clubai_enabled', value: String(enabled) });
    if (shadowMode !== undefined) updates.push({ key: 'clubai_shadow_mode', value: String(shadowMode) });
    if (approvalMode !== undefined) updates.push({ key: 'clubai_approval_mode', value: String(approvalMode) });
    if (maxMessages !== undefined) updates.push({ key: 'clubai_max_messages', value: String(maxMessages) });

    for (const { key, value } of updates) {
      await db.query(`
        INSERT INTO pattern_learning_config (config_key, config_value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = NOW()
      `, [key, value]);
    }

    logger.info('[ClubAI Config] Updated by admin', { updates });

    return res.json({ success: true, message: 'ClubAI config updated' });
  } catch (error) {
    logger.error('[ClubAI Config] Update error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update ClubAI config' });
  }
});

// ============================================
// CLUBAI SYSTEM PROMPT ENDPOINTS
// ============================================

/**
 * GET /api/patterns/clubai-system-prompt
 * Returns the current system prompt (from DB or default file)
 */
router.get('/clubai-system-prompt', authenticate, async (_req: Request, res: Response) => {
  try {
    // Check DB first
    const result = await db.query(
      `SELECT config_value FROM pattern_learning_config WHERE config_key = 'clubai_system_prompt'`
    );

    if (result.rows.length > 0 && result.rows[0].config_value) {
      return res.json({
        success: true,
        data: { prompt: result.rows[0].config_value, source: 'database' }
      });
    }

    // Fall back to file
    const { getDefaultSystemPrompt } = await import('../services/clubaiService');
    const defaultPrompt = getDefaultSystemPrompt();
    if (defaultPrompt) {
      return res.json({
        success: true,
        data: { prompt: defaultPrompt, source: 'default' }
      });
    }

    return res.status(404).json({ success: false, error: 'System prompt not found' });
  } catch (error) {
    logger.error('[ClubAI System Prompt] Fetch error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch system prompt' });
  }
});

/**
 * PUT /api/patterns/clubai-system-prompt
 * Save the system prompt to DB. Admin only. Clears the in-memory cache.
 */
router.put('/clubai-system-prompt', authenticate, async (req: Request, res: Response) => {
  try {
    const { user } = req as any;
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 50) {
      return res.status(400).json({ success: false, error: 'Prompt must be at least 50 characters' });
    }

    await db.query(`
      INSERT INTO pattern_learning_config (config_key, config_value, updated_at)
      VALUES ('clubai_system_prompt', $1, NOW())
      ON CONFLICT (config_key) DO UPDATE SET config_value = $1, updated_at = NOW()
    `, [prompt.trim()]);

    // Clear the in-memory cache so the next generateResponse() picks up the new prompt
    const { clearSystemPromptCache } = await import('../services/clubaiService');
    clearSystemPromptCache();

    logger.info('[ClubAI System Prompt] Updated by admin', { userId: user.id, promptLength: prompt.trim().length });

    return res.json({ success: true, message: 'System prompt updated' });
  } catch (error) {
    logger.error('[ClubAI System Prompt] Update error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update system prompt' });
  }
});

/**
 * POST /api/patterns/clubai-system-prompt/reset
 * Reset the system prompt to the default from the markdown file. Admin only.
 */
router.post('/clubai-system-prompt/reset', authenticate, async (req: Request, res: Response) => {
  try {
    const { user } = req as any;
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    // Delete the DB override so it falls back to the file
    await db.query(`DELETE FROM pattern_learning_config WHERE config_key = 'clubai_system_prompt'`);

    const { clearSystemPromptCache } = await import('../services/clubaiService');
    clearSystemPromptCache();

    logger.info('[ClubAI System Prompt] Reset to default by admin', { userId: (req as any).user?.id });

    return res.json({ success: true, message: 'System prompt reset to default' });
  } catch (error) {
    logger.error('[ClubAI System Prompt] Reset error:', error);
    return res.status(500).json({ success: false, error: 'Failed to reset system prompt' });
  }
});

// ============================================
// CLUBAI RAG KNOWLEDGE BASE ENDPOINTS
// ============================================

/**
 * GET /api/patterns/clubai-knowledge-stats
 * Returns stats about the RAG knowledge base
 */
router.get('/clubai-knowledge-stats', authenticate, async (_req: Request, res: Response) => {
  try {
    const { getKnowledgeStats } = await import('../services/clubaiKnowledgeService');
    const stats = await getKnowledgeStats();
    return res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('[ClubAI Knowledge] Stats error:', error);
    // Return empty stats if table doesn't exist yet
    return res.json({
      success: true,
      data: { total: 0, conversations: 0, website: 0, manual: 0, withEmbeddings: 0, avgConfidence: 0 }
    });
  }
});

/**
 * GET /api/patterns/clubai-knowledge-entries
 * Returns knowledge entries with optional filters
 */
router.get('/clubai-knowledge-entries', authenticate, async (req: Request, res: Response) => {
  try {
    const { source_type, intent, limit = '50', offset = '0' } = req.query;

    let query = `
      SELECT id, source_type, intent, customer_message, team_response, source_url, page_section,
             confidence_score, use_count, feedback_up, feedback_down, is_active, created_at
      FROM clubai_knowledge
      WHERE is_active = TRUE
    `;
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (source_type) {
      query += ` AND source_type = $${paramIndex++}`;
      params.push(source_type as string);
    }
    if (intent) {
      query += ` AND intent = $${paramIndex++}`;
      params.push(intent as string);
    }

    query += ` ORDER BY confidence_score DESC, use_count DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit as string) || 50);
    params.push(parseInt(offset as string) || 0);

    const result = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM clubai_knowledge WHERE is_active = TRUE`;
    const countParams: string[] = [];
    let countIdx = 1;
    if (source_type) {
      countQuery += ` AND source_type = $${countIdx++}`;
      countParams.push(source_type as string);
    }
    if (intent) {
      countQuery += ` AND intent = $${countIdx++}`;
      countParams.push(intent as string);
    }
    const countResult = await db.query(countQuery, countParams);

    return res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (error) {
    logger.error('[ClubAI Knowledge] Entries error:', error);
    // Return empty if table doesn't exist yet
    return res.json({ success: true, data: [], total: 0 });
  }
});

/**
 * POST /api/patterns/clubai-knowledge-search
 * Test a RAG search against the knowledge base
 */
router.post('/clubai-knowledge-search', authenticate, async (req: Request, res: Response) => {
  try {
    const { query: searchQuery } = req.body;
    if (!searchQuery) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    const { searchKnowledge } = await import('../services/clubaiKnowledgeService');
    const results = await searchKnowledge(searchQuery, { limit: 10, threshold: 0.5 });

    return res.json({ success: true, data: results });
  } catch (error) {
    logger.error('[ClubAI Knowledge] Search error:', error);
    return res.json({ success: true, data: [] });
  }
});

/**
 * POST /api/patterns/clubai-knowledge-parse
 * Accept raw text (policy, info, instructions) and use GPT-4o to parse it
 * into structured Q&A pairs for the knowledge base
 */
router.post('/clubai-knowledge-parse', authenticate, async (req: Request, res: Response) => {
  try {
    const { rawText } = req.body;
    if (!rawText?.trim()) {
      return res.status(400).json({ success: false, error: 'rawText is required' });
    }

    const { getOpenAIClient } = await import('../utils/openaiClient');
    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(500).json({ success: false, error: 'OpenAI not available' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a knowledge base parser for Clubhouse 24/7 Golf, a chain of self-service indoor golf simulator locations in Nova Scotia.

Given raw text (policy updates, new info, instructions, etc.), extract structured Q&A pairs that a customer support AI would need.

For each piece of information, create:
1. "question" — How a customer would naturally ask about this (casual SMS style, e.g. "how much does it cost" not "What are your pricing tiers?")
2. "answer" — The response the AI should give (friendly, brief, SMS-style)
3. "intent" — Category: pricing, sim_frozen, door_access, booking_change, club_rental, wifi, general_inquiry, food_drink, how_long_18, refund_request, gift_card, login_qr_issue, side_screens, ball_not_registering, tech_support

Respond with valid JSON only: { "entries": [{ "question": "...", "answer": "...", "intent": "..." }] }
Extract as many distinct Q&A pairs as the text contains. If there are multiple facts, create separate entries for each.`
        },
        { role: 'user', content: rawText.trim() }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{"entries":[]}');
    const entries = parsed.entries || [];

    if (entries.length === 0) {
      return res.json({ success: true, data: [], message: 'No Q&A pairs could be extracted' });
    }

    // Store each entry
    const { addManualKnowledge } = await import('../services/clubaiKnowledgeService');
    const results = [];
    for (const entry of entries) {
      const id = await addManualKnowledge(
        entry.intent || 'general_inquiry',
        entry.question,
        entry.answer
      );
      results.push({ id, question: entry.question, answer: entry.answer, intent: entry.intent });
    }

    return res.json({ success: true, data: results, count: results.length });
  } catch (error) {
    logger.error('[ClubAI Knowledge] Parse error:', error);
    return res.status(500).json({ success: false, error: 'Failed to parse knowledge' });
  }
});

/**
 * POST /api/patterns/clubai-knowledge-manual
 * Add a manual knowledge entry
 */
router.post('/clubai-knowledge-manual', authenticate, async (req: Request, res: Response) => {
  try {
    const { intent, customerQuestion, teamResponse } = req.body;
    if (!customerQuestion || !teamResponse) {
      return res.status(400).json({ success: false, error: 'customerQuestion and teamResponse are required' });
    }

    const { addManualKnowledge } = await import('../services/clubaiKnowledgeService');
    const id = await addManualKnowledge(intent || 'general_inquiry', customerQuestion, teamResponse);

    if (!id) {
      return res.status(500).json({ success: false, error: 'Failed to add knowledge entry' });
    }

    return res.json({ success: true, data: { id } });
  } catch (error) {
    logger.error('[ClubAI Knowledge] Manual add error:', error);
    return res.status(500).json({ success: false, error: 'Failed to add knowledge entry' });
  }
});

/**
 * GET /api/patterns/clubai-search-log
 * Get recent search logs to see what knowledge ClubAI used
 */
router.get('/clubai-search-log', authenticate, async (req: Request, res: Response) => {
  try {
    const { limit = '20' } = req.query;

    const result = await db.query(`
      SELECT sl.*,
        (SELECT json_agg(json_build_object(
          'id', k.id, 'source_type', k.source_type, 'intent', k.intent,
          'customer_message', k.customer_message, 'team_response', LEFT(k.team_response, 200)
        ))
        FROM clubai_knowledge k WHERE k.id = ANY(sl.knowledge_ids)) as matched_knowledge
      FROM clubai_knowledge_search_log sl
      ORDER BY sl.created_at DESC
      LIMIT $1
    `, [parseInt(limit as string) || 20]);

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('[ClubAI Knowledge] Search log error:', error);
    return res.json({ success: true, data: [] });
  }
});

/**
 * GET /api/patterns/clubai-conversations
 * Returns recent ClubAI conversations with messages for the operator monitor
 */
router.get('/clubai-conversations', authenticate, async (req: Request, res: Response) => {
  try {
    const { filter = 'all', limit = '20', offset = '0' } = req.query;

    // Get conversations where ClubAI was involved
    let whereClause = `WHERE oc.clubai_messages_sent > 0 OR oc.clubai_active = true OR oc.clubai_escalated = true`;
    if (filter === 'escalated') {
      whereClause += ` AND oc.clubai_escalated = true`;
    } else if (filter === 'active') {
      whereClause += ` AND oc.clubai_active = true AND oc.clubai_escalated = false`;
    } else if (filter === 'today') {
      whereClause += ` AND oc.updated_at >= CURRENT_DATE`;
    }

    const result = await db.query(`
      SELECT
        oc.id,
        oc.phone_number,
        oc.customer_name,
        oc.clubai_active,
        oc.clubai_messages_sent,
        oc.clubai_escalated,
        oc.clubai_escalation_reason,
        oc.updated_at,
        oc.created_at,
        (
          SELECT json_agg(sub ORDER BY sub.created_at ASC)
          FROM (
            SELECT cm.sender_type, cm.message_text, cm.pattern_confidence, cm.created_at
            FROM conversation_messages cm
            WHERE cm.conversation_id = oc.id::text
            ORDER BY cm.created_at ASC
            LIMIT 30
          ) sub
        ) as messages,
        (
          SELECT json_agg(json_build_object(
            'knowledge_ids', sl.knowledge_ids,
            'similarity_scores', sl.similarity_scores,
            'response_quality', sl.response_quality,
            'created_at', sl.created_at
          ) ORDER BY sl.created_at DESC)
          FROM clubai_knowledge_search_log sl
          WHERE sl.conversation_id = oc.id::text
        ) as search_logs
      FROM openphone_conversations oc
      ${whereClause}
      ORDER BY oc.updated_at DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit as string) || 20, parseInt(offset as string) || 0]);

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*) FROM openphone_conversations oc ${whereClause}
    `);

    return res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (error) {
    logger.error('[ClubAI Conversations] Error:', error);
    // Return empty if clubai columns don't exist yet
    return res.json({ success: true, data: [], total: 0 });
  }
});

/**
 * POST /api/patterns/clubai-correct
 * Operator corrects a ClubAI response from the conversation monitor.
 * AI auto-classifies the correction type (factual/tone/brevity/completeness/escalation),
 * routes factual corrections to knowledge base, style corrections to style rules,
 * and always logs to clubai_corrections for stats.
 */
router.post('/clubai-correct', authenticate, async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    if (!userRole || !['admin', 'operator'].includes(userRole)) {
      return res.status(403).json({ success: false, error: 'Admin or operator access required' });
    }

    const { customerMessage, originalResponse, correctedResponse, intent } = req.body;
    if (!customerMessage || !correctedResponse) {
      return res.status(400).json({ success: false, error: 'customerMessage and correctedResponse are required' });
    }

    const resolvedIntent = intent || 'general_inquiry';
    const correctedBy = (req as any).user?.email || 'operator';

    // Step 1: AI classifies what type of correction this is
    let correctionType = 'factual';
    let correctionSummary = 'Operator corrected response';

    if (openai && originalResponse) {
      try {
        const classification = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You classify operator corrections to AI SMS responses. Compare the original and corrected response and determine:
1. The correction type (exactly one of: factual, tone, brevity, completeness, escalation)
2. A short summary of what was changed

Definitions:
- factual: Wrong information was corrected (wrong link, wrong price, wrong hours, wrong policy, wrong steps)
- tone: The style/personality was adjusted (too formal, too casual, too nice, robotic language, wrong energy)
- brevity: The response was shortened or made more concise (too long, too many sentences, unnecessary details removed)
- completeness: Missing information was added (incomplete answer, missed part of the question)
- escalation: Changed whether the response should escalate to human (should have escalated but didn't, or vice versa)

If multiple types apply, pick the PRIMARY reason the operator made the change.

Return JSON only: {"type": "factual|tone|brevity|completeness|escalation", "summary": "brief description of what changed"}`
            },
            {
              role: 'user',
              content: `Customer message: "${customerMessage}"\n\nOriginal AI response: "${originalResponse}"\n\nCorrected response: "${correctedResponse}"`
            }
          ],
          temperature: 0.1,
          max_tokens: 150,
        });

        const content = classification.choices[0]?.message?.content;
        if (content) {
          try {
            const parsed = JSON.parse(content);
            if (['factual', 'tone', 'brevity', 'completeness', 'escalation'].includes(parsed.type)) {
              correctionType = parsed.type;
            }
            if (parsed.summary) {
              correctionSummary = parsed.summary;
            }
          } catch {
            logger.warn('[ClubAI Correct] Could not parse classification, defaulting to factual');
          }
        }
      } catch (classifyErr) {
        logger.warn('[ClubAI Correct] Classification failed, defaulting to factual:', classifyErr);
      }
    }

    let knowledgeEntryId: number | null = null;
    let styleRuleId: number | null = null;
    let deactivatedCount = 0;

    // Step 2A: ALWAYS save the corrected response to the knowledge base.
    // Every correction teaches ClubAI the right answer for this question,
    // regardless of whether the fix was factual, tone, or brevity.
    const { addManualKnowledge, searchKnowledge } = await import('../services/clubaiKnowledgeService');
    knowledgeEntryId = await addManualKnowledge(
      resolvedIntent,
      customerMessage.trim(),
      correctedResponse.trim(),
      {
        source: 'operator_correction',
        correction_type: correctionType,
        original_response: originalResponse || '',
        corrected_by: correctedBy,
      }
    );

    // Deactivate conflicting entries
    if (knowledgeEntryId) {
      try {
        const similar = await searchKnowledge(customerMessage.trim(), { limit: 5, threshold: 0.6 });
        const toDeactivate = similar.filter(s =>
          s.knowledge_id !== knowledgeEntryId &&
          s.team_response !== correctedResponse.trim()
        );
        if (toDeactivate.length > 0) {
          const ids = toDeactivate.map(s => s.knowledge_id);
          await db.query(
            `UPDATE clubai_knowledge SET is_active = FALSE, updated_at = NOW() WHERE id = ANY($1)`,
            [ids]
          );
          deactivatedCount = ids.length;
        }
      } catch (conflictErr) {
        logger.warn('[ClubAI Correct] Could not check/deactivate conflicts:', conflictErr);
      }
    }

    // Step 2B: ADDITIONALLY create a style rule for tone/brevity corrections.
    // This teaches ClubAI to adjust its style globally, not just for this question.
    if (correctionType === 'tone' || correctionType === 'brevity') {
      let ruleText = correctionType === 'tone'
        ? `Adjust tone: ${correctionSummary}`
        : `Keep responses concise: ${correctionSummary}`;

      if (openai) {
        try {
          const ruleGen = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You create reusable style rules for an SMS AI assistant based on operator corrections.
The rule should be a clear, actionable instruction that applies broadly (not just to this one message).
Keep the rule to 1-2 sentences. Be specific about what to do differently.
Return ONLY the rule text, nothing else.`
              },
              {
                role: 'user',
                content: `Correction type: ${correctionType}\nIntent: ${resolvedIntent}\nOriginal: "${originalResponse}"\nCorrected: "${correctedResponse}"\nSummary: ${correctionSummary}`
              }
            ],
            temperature: 0.3,
            max_tokens: 100,
          });
          const ruleContent = ruleGen.choices[0]?.message?.content?.trim();
          if (ruleContent && ruleContent.length > 10) {
            ruleText = ruleContent;
          }
        } catch (ruleErr) {
          logger.warn('[ClubAI Correct] Rule generation failed, using default:', ruleErr);
        }
      }

      try {
        const ruleResult = await db.query(`
          INSERT INTO clubai_style_rules (rule_type, rule_text, example_before, example_after, intent)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [
          correctionType,
          ruleText,
          originalResponse || '',
          correctedResponse.trim(),
          resolvedIntent === 'general_inquiry' ? null : resolvedIntent,
        ]);
        styleRuleId = ruleResult.rows[0]?.id || null;
      } catch (styleErr) {
        logger.warn('[ClubAI Correct] Failed to create style rule:', styleErr);
      }
    }

    // Step 3: Always create audit entry in clubai_corrections
    try {
      await db.query(`
        INSERT INTO clubai_corrections
          (customer_message, original_response, corrected_response, correction_type, correction_summary,
           intent, knowledge_entry_id, style_rule_id, corrected_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        customerMessage.trim(),
        originalResponse || '',
        correctedResponse.trim(),
        correctionType,
        correctionSummary,
        resolvedIntent,
        knowledgeEntryId,
        styleRuleId,
        correctedBy,
      ]);
    } catch (auditErr) {
      logger.warn('[ClubAI Correct] Failed to log correction audit:', auditErr);
    }

    // Check if the knowledge base save worked — this is the critical save
    const saveFailed = !knowledgeEntryId;

    if (saveFailed) {
      logger.error(`[ClubAI Correct] Save failed — ${correctionType} correction by ${correctedBy}: knowledgeEntryId=${knowledgeEntryId}, styleRuleId=${styleRuleId}. Likely missing database tables (run migrations 360+364).`);
      return res.status(500).json({
        success: false,
        error: `Failed to save ${correctionType} correction. Database tables may not exist — contact admin to run migrations.`,
        data: { correctionType, correctionSummary },
      });
    }

    // Build user-facing message based on correction type
    const typeMessages: Record<string, string> = {
      factual: `Factual correction saved to knowledge base${deactivatedCount > 0 ? ` (${deactivatedCount} conflicting entries deactivated)` : ''}`,
      completeness: `Missing info added to knowledge base${deactivatedCount > 0 ? ` (${deactivatedCount} conflicting entries deactivated)` : ''}`,
      tone: 'Tone correction saved — ClubAI will adjust its style for future responses',
      brevity: 'Brevity correction saved — ClubAI will keep similar responses shorter',
      escalation: 'Escalation correction logged — helps improve escalation decisions',
    };

    logger.info(`[ClubAI Correct] ${correctionType} correction by ${correctedBy}: ${correctionSummary}`);

    return res.json({
      success: true,
      data: {
        correctionType,
        correctionSummary,
        knowledgeEntryId,
        styleRuleId,
        deactivatedCount,
      },
      message: typeMessages[correctionType] || 'Correction saved',
    });
  } catch (error) {
    logger.error('[ClubAI Correct] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to save correction' });
  }
});

/**
 * POST /api/patterns/clubai-feedback
 * Submit thumbs up/down feedback on a ClubAI search log entry
 */
router.post('/clubai-feedback', authenticate, async (req: Request, res: Response) => {
  try {
    const { searchLogId, quality } = req.body;
    if (!searchLogId || !['good', 'bad'].includes(quality)) {
      return res.status(400).json({ success: false, error: 'searchLogId and quality (good/bad) required' });
    }

    // Update search log quality
    await db.query(`
      UPDATE clubai_knowledge_search_log
      SET response_quality = $1
      WHERE id = $2
    `, [quality, searchLogId]);

    // Update knowledge entry feedback counts
    const logResult = await db.query(`
      SELECT knowledge_ids FROM clubai_knowledge_search_log WHERE id = $1
    `, [searchLogId]);

    if (logResult.rows.length > 0 && logResult.rows[0].knowledge_ids) {
      const column = quality === 'good' ? 'feedback_up' : 'feedback_down';
      await db.query(`
        UPDATE clubai_knowledge
        SET ${column} = ${column} + 1, updated_at = NOW()
        WHERE id = ANY($1)
      `, [logResult.rows[0].knowledge_ids]);
    }

    return res.json({ success: true });
  } catch (error) {
    logger.error('[ClubAI Feedback] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to submit feedback' });
  }
});

// ============================================
// CLUBAI DRAFT / APPROVAL MODE ENDPOINTS
// ============================================

/**
 * GET /api/patterns/clubai-drafts
 * List pending draft responses for operator review
 */
router.get('/clubai-drafts', authenticate, async (req: Request, res: Response) => {
  try {
    const { status = 'pending', limit = '20' } = req.query;
    const result = await db.query(`
      SELECT * FROM clubai_draft_responses
      WHERE status = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [status, parseInt(limit as string) || 20]);

    const countResult = await db.query(`
      SELECT COUNT(*) FROM clubai_draft_responses WHERE status = 'pending'
    `);

    return res.json({
      success: true,
      data: result.rows,
      pendingCount: parseInt(countResult.rows[0].count),
    });
  } catch (error) {
    logger.error('[ClubAI Drafts] List error:', error);
    return res.json({ success: true, data: [], pendingCount: 0 });
  }
});

/**
 * POST /api/patterns/clubai-drafts/:id/approve
 * Approve a draft and send it to the customer
 */
router.post('/clubai-drafts/:id/approve', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || null;

    // Get the draft
    const draftResult = await db.query(`
      SELECT * FROM clubai_draft_responses WHERE id = $1 AND status = 'pending'
    `, [id]);

    if (draftResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Draft not found or already reviewed' });
    }

    const draft = draftResult.rows[0];

    // Send the response via OpenPhone
    const defaultNumber = process.env.OPENPHONE_DEFAULT_NUMBER;
    if (defaultNumber) {
      const { openPhoneService } = await import('../services/openphoneService');
      const responseWithSignature = draft.ai_response + ' - ClubAI';
      await openPhoneService.sendMessage(draft.phone_number, defaultNumber, responseWithSignature);

      // Store the sent message
      const { storeClubAIMessage } = await import('../services/clubaiService');
      await storeClubAIMessage(draft.conversation_id, responseWithSignature, draft.confidence);

      // Update conversation tracking
      try {
        await db.query(`
          UPDATE openphone_conversations SET
            clubai_active = true,
            clubai_messages_sent = COALESCE(clubai_messages_sent, 0) + 1
          WHERE id = $1
        `, [draft.conversation_id]);
      } catch { /* columns may not exist */ }
    }

    // Mark draft as approved
    await db.query(`
      UPDATE clubai_draft_responses
      SET status = 'approved', reviewed_by = $2, reviewed_at = NOW()
      WHERE id = $1
    `, [id, userId]);

    return res.json({ success: true, message: 'Draft approved and sent' });
  } catch (error) {
    logger.error('[ClubAI Drafts] Approve error:', error);
    return res.status(500).json({ success: false, error: 'Failed to approve draft' });
  }
});

/**
 * POST /api/patterns/clubai-drafts/:id/edit
 * Edit a draft and send the edited version
 */
router.post('/clubai-drafts/:id/edit', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { editedResponse } = req.body;
    const userId = (req as any).user?.id || null;

    if (!editedResponse?.trim()) {
      return res.status(400).json({ success: false, error: 'editedResponse is required' });
    }

    const draftResult = await db.query(`
      SELECT * FROM clubai_draft_responses WHERE id = $1 AND status = 'pending'
    `, [id]);

    if (draftResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Draft not found or already reviewed' });
    }

    const draft = draftResult.rows[0];

    // Send the edited response
    const defaultNumber = process.env.OPENPHONE_DEFAULT_NUMBER;
    if (defaultNumber) {
      const { openPhoneService } = await import('../services/openphoneService');
      await openPhoneService.sendMessage(draft.phone_number, defaultNumber, editedResponse.trim());

      // Store as operator message (not AI — since it was edited)
      await db.query(`
        INSERT INTO conversation_messages
        (conversation_id, sender_type, message_text)
        VALUES ($1, 'operator', $2)
      `, [draft.conversation_id, editedResponse.trim()]);
    }

    // Mark draft as edited, store the correction for learning
    await db.query(`
      UPDATE clubai_draft_responses
      SET status = 'edited', operator_response = $2, reviewed_by = $3, reviewed_at = NOW()
      WHERE id = $1
    `, [id, editedResponse.trim(), userId]);

    return res.json({ success: true, message: 'Edited response sent' });
  } catch (error) {
    logger.error('[ClubAI Drafts] Edit error:', error);
    return res.status(500).json({ success: false, error: 'Failed to edit draft' });
  }
});

/**
 * POST /api/patterns/clubai-drafts/:id/reject
 * Reject a draft (operator will handle manually)
 */
router.post('/clubai-drafts/:id/reject', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || null;

    await db.query(`
      UPDATE clubai_draft_responses
      SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW()
      WHERE id = $1
    `, [id, userId]);

    return res.json({ success: true, message: 'Draft rejected' });
  } catch (error) {
    logger.error('[ClubAI Drafts] Reject error:', error);
    return res.status(500).json({ success: false, error: 'Failed to reject draft' });
  }
});

// ============================================
// CLUBAI ESCALATION QUEUE
// ============================================

/**
 * GET /api/patterns/clubai-escalations
 * Returns conversations escalated by ClubAI that haven't been resolved by an operator yet
 */
router.get('/clubai-escalations', authenticate, async (_req: Request, res: Response) => {
  try {
    const result = await db.query(`
      SELECT
        oc.id,
        oc.phone_number,
        oc.customer_name,
        oc.clubai_escalation_reason,
        oc.clubai_messages_sent,
        oc.updated_at,
        oc.created_at,
        (
          SELECT json_agg(sub ORDER BY sub.created_at ASC)
          FROM (
            SELECT cm.sender_type, cm.message_text, cm.created_at
            FROM conversation_messages cm
            WHERE cm.conversation_id = oc.id::text
            ORDER BY cm.created_at ASC
            LIMIT 20
          ) sub
        ) as messages,
        -- Check if an operator has responded AFTER the escalation
        EXISTS (
          SELECT 1 FROM conversation_messages cm
          WHERE cm.conversation_id = oc.id::text
            AND cm.sender_type = 'operator'
            AND cm.created_at > (
              SELECT MAX(cm2.created_at) FROM conversation_messages cm2
              WHERE cm2.conversation_id = oc.id::text AND cm2.sender_type = 'ai'
            )
        ) as operator_responded
      FROM openphone_conversations oc
      WHERE oc.clubai_escalated = true
      ORDER BY oc.updated_at DESC
      LIMIT 30
    `);

    // Split into waiting vs resolved
    const waiting = result.rows.filter((r: any) => !r.operator_responded);
    const resolved = result.rows.filter((r: any) => r.operator_responded);

    return res.json({
      success: true,
      waiting,
      resolved,
      waitingCount: waiting.length,
    });
  } catch (error) {
    logger.error('[ClubAI Escalations] Error:', error);
    // Return empty if columns don't exist yet
    return res.json({ success: true, waiting: [], resolved: [], waitingCount: 0 });
  }
});

/**
 * POST /api/patterns/clubai-escalations/:id/resolve
 * Mark an escalation as resolved
 */
router.post('/clubai-escalations/:id/resolve', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.query(`
      UPDATE openphone_conversations
      SET clubai_escalated = false, conversation_locked = false
      WHERE id = $1
    `, [id]);
    return res.json({ success: true });
  } catch (error) {
    logger.error('[ClubAI Escalations] Resolve error:', error);
    return res.status(500).json({ success: false, error: 'Failed to resolve' });
  }
});

// ============================================
// CLUBAI KNOWLEDGE MANAGEMENT ENDPOINTS
// ============================================

/**
 * PUT /api/patterns/clubai-knowledge/:id
 * Edit an existing knowledge entry (updates text + regenerates embedding)
 */
router.put('/clubai-knowledge/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    if (!userRole || !['admin', 'operator'].includes(userRole)) {
      return res.status(403).json({ success: false, error: 'Admin or operator access required' });
    }

    const { id } = req.params;
    const { intent, customerQuestion, teamResponse, confidenceScore } = req.body;

    // Verify entry exists
    const existing = await db.query(`SELECT id, source_type FROM clubai_knowledge WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Knowledge entry not found' });
    }

    // Build update fields
    const updates: string[] = [];
    const params: (string | number | null)[] = [];
    let paramIndex = 1;

    if (intent !== undefined) {
      updates.push(`intent = $${paramIndex++}`);
      params.push(intent);
    }
    if (customerQuestion !== undefined) {
      updates.push(`customer_message = $${paramIndex++}`);
      params.push(customerQuestion);
    }
    if (teamResponse !== undefined) {
      updates.push(`team_response = $${paramIndex++}`);
      params.push(teamResponse);
    }
    if (confidenceScore !== undefined) {
      updates.push(`confidence_score = $${paramIndex++}`);
      params.push(confidenceScore);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    params.push(parseInt(id));

    await db.query(
      `UPDATE clubai_knowledge SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params
    );

    // Regenerate embedding if text fields changed
    if (customerQuestion !== undefined || teamResponse !== undefined) {
      const updated = await db.query(
        `SELECT customer_message, team_response FROM clubai_knowledge WHERE id = $1`,
        [id]
      );
      if (updated.rows.length > 0) {
        const { generateEmbedding } = await import('../services/clubaiKnowledgeService');
        const row = updated.rows[0];
        const embeddingText = row.customer_message
          ? `Customer: ${row.customer_message}\nResponse: ${row.team_response}`
          : row.team_response;
        const embedding = await generateEmbedding(embeddingText);
        if (embedding) {
          await db.query(
            `UPDATE clubai_knowledge SET embedding = $1, embedding_generated_at = NOW() WHERE id = $2`,
            [embedding, id]
          );
        }
      }
    }

    logger.info(`[ClubAI Knowledge] Entry ${id} updated by ${userRole}`);
    return res.json({ success: true, message: 'Knowledge entry updated' });
  } catch (error) {
    logger.error('[ClubAI Knowledge] Update error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update knowledge entry' });
  }
});

/**
 * PATCH /api/patterns/clubai-knowledge/:id/toggle
 * Activate or deactivate a knowledge entry (soft delete)
 */
router.patch('/clubai-knowledge/:id/toggle', authenticate, async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    if (!userRole || !['admin', 'operator'].includes(userRole)) {
      return res.status(403).json({ success: false, error: 'Admin or operator access required' });
    }

    const { id } = req.params;
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      return res.status(400).json({ success: false, error: 'active (boolean) is required' });
    }

    const result = await db.query(
      `UPDATE clubai_knowledge SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, is_active`,
      [active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Knowledge entry not found' });
    }

    logger.info(`[ClubAI Knowledge] Entry ${id} ${active ? 'activated' : 'deactivated'} by ${userRole}`);
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('[ClubAI Knowledge] Toggle error:', error);
    return res.status(500).json({ success: false, error: 'Failed to toggle knowledge entry' });
  }
});

/**
 * GET /api/patterns/clubai-knowledge-conflicts
 * Find existing entries for a given intent to detect potential conflicts
 */
router.get('/clubai-knowledge-conflicts', authenticate, async (req: Request, res: Response) => {
  try {
    const { intent, query: searchQuery } = req.query;

    if (!intent && !searchQuery) {
      return res.status(400).json({ success: false, error: 'intent or query parameter required' });
    }

    let result;
    if (searchQuery) {
      // Search by semantic similarity to find potentially conflicting entries
      const { searchKnowledge } = await import('../services/clubaiKnowledgeService');
      const matches = await searchKnowledge(searchQuery as string, { limit: 10, threshold: 0.4 });
      // Also get inactive entries that match the intent
      const intentMatches = intent ? await db.query(`
        SELECT id, source_type, intent, customer_message, team_response,
               confidence_score, is_active, use_count, feedback_up, feedback_down, created_at
        FROM clubai_knowledge
        WHERE intent = $1
        ORDER BY is_active DESC, confidence_score DESC, created_at DESC
        LIMIT 20
      `, [intent]) : { rows: [] };

      // Merge results, deduplicating by id
      const seenIds = new Set<number>();
      const merged: any[] = [];
      for (const m of matches) {
        if (!seenIds.has(m.knowledge_id)) {
          seenIds.add(m.knowledge_id);
          merged.push({ ...m, id: m.knowledge_id, similarity: m.similarity });
        }
      }
      for (const row of intentMatches.rows) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          merged.push(row);
        }
      }

      result = merged;
    } else {
      // Search by intent only
      const dbResult = await db.query(`
        SELECT id, source_type, intent, customer_message, team_response,
               confidence_score, is_active, use_count, feedback_up, feedback_down, created_at
        FROM clubai_knowledge
        WHERE intent = $1
        ORDER BY is_active DESC, confidence_score DESC, created_at DESC
        LIMIT 20
      `, [intent]);
      result = dbResult.rows;
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('[ClubAI Knowledge] Conflicts check error:', error);
    return res.status(500).json({ success: false, error: 'Failed to check conflicts' });
  }
});

/**
 * DELETE /api/patterns/clubai-knowledge/:id
 * Permanently delete a knowledge entry (admin only)
 */
router.delete('/clubai-knowledge/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { id } = req.params;
    const result = await db.query(`DELETE FROM clubai_knowledge WHERE id = $1 RETURNING id`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Knowledge entry not found' });
    }

    logger.info(`[ClubAI Knowledge] Entry ${id} permanently deleted by admin`);
    return res.json({ success: true, message: 'Knowledge entry deleted' });
  } catch (error) {
    logger.error('[ClubAI Knowledge] Delete error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete knowledge entry' });
  }
});

// Export the router
export default router;