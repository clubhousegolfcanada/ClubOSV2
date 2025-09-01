/**
 * Pattern Learning Service
 * 
 * BREADCRUMB: Core service for V3-style pattern learning in V1
 * This service runs alongside existing regex patterns without breaking anything
 * 
 * Author: Claude
 * Date: 2025-09-01
 * 
 * TODO: After creating this file:
 * 1. Run typescript compilation to check for errors: npm run typecheck
 * 2. Add tests in __tests__/services/patternLearningService.test.ts
 * 3. Import and use in aiAutomationService.ts (in shadow mode first)
 */

import { db } from '../utils/database';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import OpenAI from 'openai';

// BREADCRUMB: These interfaces define the shape of our pattern data
interface Pattern {
  id: number;
  pattern_type: string;
  pattern_signature: string;
  trigger_text: string;
  trigger_keywords: string[];
  response_template: string;
  action_template: any;
  confidence_score: number;
  auto_executable: boolean;
  execution_count: number;
  success_count: number;
}

interface PatternResult {
  action: 'auto_execute' | 'suggest' | 'queue' | 'escalate' | 'shadow';
  pattern?: Pattern;
  patternId?: number;
  response?: string;
  actions?: any[];
  confidence?: number;
  reason?: string;
  learnFromResponse?: boolean;
}

interface LearningConfig {
  enabled: boolean;
  shadowMode: boolean;
  autoExecuteThreshold: number;
  suggestThreshold: number;
  queueThreshold: number;
  confidenceIncreaseSuccess: number;
  confidenceIncreaseModified: number;
  confidenceDecreaseFailure: number;
  confidenceDecayDaily: number;
  suggestionTimeoutSeconds: number;
  minExecutionsForAuto: number;
}

export class PatternLearningService {
  private openai: OpenAI | null = null;
  private config: LearningConfig;
  private configCache: Map<string, any> = new Map();
  private configCacheExpiry: number = 60000; // 1 minute cache
  private lastConfigLoad: number = 0;

  constructor() {
    // BREADCRUMB: Initialize with safe defaults that won't affect production
    this.config = {
      enabled: false, // Disabled by default
      shadowMode: true, // Shadow mode by default
      autoExecuteThreshold: 0.95,
      suggestThreshold: 0.75,
      queueThreshold: 0.50,
      confidenceIncreaseSuccess: 0.05,
      confidenceIncreaseModified: 0.02,
      confidenceDecreaseFailure: 0.10,
      confidenceDecayDaily: 0.01,
      suggestionTimeoutSeconds: 30,
      minExecutionsForAuto: 20
    };

    // Initialize OpenAI if API key exists
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }

    // Load configuration from database
    this.loadConfiguration();

    // TODO: Set up daily confidence decay job
    // TODO: Set up pattern promotion check job
  }

  /**
   * Load configuration from database
   * BREADCRUMB: Configuration is stored in DB so it can be changed without redeploying
   */
  private async loadConfiguration(): Promise<void> {
    try {
      // Check if we have a recent cache
      if (Date.now() - this.lastConfigLoad < this.configCacheExpiry) {
        return;
      }

      const result = await db.query('SELECT config_key, config_value FROM pattern_learning_config');
      
      if (result.rows.length > 0) {
        const dbConfig: any = {};
        result.rows.forEach(row => {
          const key = this.snakeToCamel(row.config_key);
          const value = this.parseConfigValue(row.config_value);
          dbConfig[key] = value;
        });

        this.config = { ...this.config, ...dbConfig };
        this.lastConfigLoad = Date.now();
        
        logger.info('[PatternLearning] Configuration loaded', {
          enabled: this.config.enabled,
          shadowMode: this.config.shadowMode
        });
      }
    } catch (error) {
      logger.error('[PatternLearning] Failed to load configuration', error);
      // Continue with defaults if DB is not ready
    }
  }

  /**
   * Main entry point - process a message through pattern learning
   * BREADCRUMB: This is called from aiAutomationService.processOpenPhoneMessage
   */
  async processMessage(
    message: string, 
    phoneNumber: string, 
    conversationId: string,
    customerName?: string
  ): Promise<PatternResult> {
    try {
      // Reload config if needed
      await this.loadConfiguration();

      // Check if pattern learning is enabled
      if (!this.config.enabled) {
        return { 
          action: 'escalate', 
          reason: 'pattern_learning_disabled' 
        };
      }

      // Generate pattern signature
      const signature = this.generateSignature(message);
      
      // Find matching patterns
      const patterns = await this.findMatchingPatterns(message, signature);
      
      // Log for debugging (TODO: Remove in production)
      logger.debug('[PatternLearning] Found patterns', {
        count: patterns.length,
        topConfidence: patterns[0]?.confidence_score || 0,
        shadowMode: this.config.shadowMode
      });

      if (patterns.length === 0) {
        // No pattern found - this is a learning opportunity
        return {
          action: this.config.shadowMode ? 'shadow' : 'escalate',
          reason: 'no_matching_pattern',
          learnFromResponse: true
        };
      }

      // Get the best matching pattern
      const bestMatch = patterns[0];
      
      // Log pattern match for analysis
      await this.logPatternMatch(bestMatch, message, phoneNumber, conversationId);

      // If in shadow mode, just log what would happen
      if (this.config.shadowMode) {
        logger.info('[PatternLearning] SHADOW MODE - Would execute', {
          patternId: bestMatch.id,
          confidence: bestMatch.confidence_score,
          wouldAutoExecute: bestMatch.confidence_score >= this.config.autoExecuteThreshold
        });
        
        return {
          action: 'shadow',
          pattern: bestMatch,
          confidence: bestMatch.confidence_score
        };
      }

      // Apply confidence-based automation
      if (bestMatch.confidence_score >= this.config.autoExecuteThreshold && bestMatch.auto_executable) {
        return {
          action: 'auto_execute',
          pattern: bestMatch,
          patternId: bestMatch.id,
          response: this.fillResponseTemplate(bestMatch.response_template, { customerName }),
          actions: bestMatch.action_template,
          confidence: bestMatch.confidence_score
        };
      } else if (bestMatch.confidence_score >= this.config.suggestThreshold) {
        return {
          action: 'suggest',
          pattern: bestMatch,
          patternId: bestMatch.id,
          response: this.fillResponseTemplate(bestMatch.response_template, { customerName }),
          actions: bestMatch.action_template,
          confidence: bestMatch.confidence_score
        };
      } else if (bestMatch.confidence_score >= this.config.queueThreshold) {
        return {
          action: 'queue',
          pattern: bestMatch,
          patternId: bestMatch.id,
          response: this.fillResponseTemplate(bestMatch.response_template, { customerName }),
          actions: bestMatch.action_template,
          confidence: bestMatch.confidence_score
        };
      } else {
        return {
          action: 'escalate',
          reason: 'low_confidence',
          confidence: bestMatch.confidence_score,
          learnFromResponse: true
        };
      }
    } catch (error) {
      logger.error('[PatternLearning] Error processing message', error);
      // On error, escalate to human to be safe
      return {
        action: 'escalate',
        reason: 'processing_error'
      };
    }
  }

  /**
   * Learn from human response to create or update patterns
   * BREADCRUMB: This is called after an operator responds to a message
   */
  async learnFromHumanResponse(
    originalMessage: string,
    humanResponse: string,
    actionsTaken: any[],
    conversationId: string,
    phoneNumber: string,
    operatorId?: number
  ): Promise<void> {
    try {
      // Only learn if enabled and not in pure shadow mode
      if (!this.config.enabled) {
        return;
      }

      logger.info('[PatternLearning] Learning from human response', {
        messageLength: originalMessage.length,
        responseLength: humanResponse.length,
        hasActions: actionsTaken.length > 0
      });

      // Check if we already have a pattern for this
      const signature = this.generateSignature(originalMessage);
      const existingPattern = await this.findPatternBySignature(signature);

      if (existingPattern) {
        // Update existing pattern based on human response
        await this.updatePatternFromHumanResponse(
          existingPattern.id,
          humanResponse,
          actionsTaken,
          operatorId
        );
      } else {
        // Create new pattern if we have OpenAI available
        if (this.openai) {
          await this.createNewPatternFromInteraction(
            originalMessage,
            humanResponse,
            actionsTaken,
            operatorId
          );
        } else {
          // Without OpenAI, create a basic pattern
          await this.createBasicPattern(
            originalMessage,
            humanResponse,
            actionsTaken,
            signature,
            operatorId
          );
        }
      }
    } catch (error) {
      logger.error('[PatternLearning] Failed to learn from human response', error);
      // Don't throw - learning failures shouldn't break the system
    }
  }

  /**
   * Update pattern confidence based on execution outcome
   * BREADCRUMB: Called after pattern execution to evolve confidence
   */
  async updatePatternConfidence(
    patternId: number,
    success: boolean,
    humanModified: boolean = false,
    executionId?: number
  ): Promise<void> {
    try {
      const pattern = await db.query(
        'SELECT * FROM decision_patterns WHERE id = $1',
        [patternId]
      );
      
      if (!pattern.rows[0]) {
        logger.warn('[PatternLearning] Pattern not found for confidence update', { patternId });
        return;
      }

      const currentPattern = pattern.rows[0];
      let newConfidence = currentPattern.confidence_score;
      
      // Calculate new confidence
      if (success && !humanModified) {
        newConfidence = Math.min(1.0, newConfidence + this.config.confidenceIncreaseSuccess);
      } else if (success && humanModified) {
        newConfidence = Math.min(1.0, newConfidence + this.config.confidenceIncreaseModified);
      } else if (!success) {
        newConfidence = Math.max(0.0, newConfidence - this.config.confidenceDecreaseFailure);
      }

      // Update pattern
      await db.query(`
        UPDATE decision_patterns 
        SET confidence_score = $1,
            execution_count = execution_count + 1,
            success_count = success_count + $2,
            failure_count = failure_count + $3,
            human_override_count = human_override_count + $4,
            last_used = NOW()
        WHERE id = $5
      `, [
        newConfidence,
        success ? 1 : 0,
        success ? 0 : 1,
        humanModified ? 1 : 0,
        patternId
      ]);

      // Log confidence evolution
      await db.query(`
        INSERT INTO confidence_evolution 
        (pattern_id, old_confidence, new_confidence, change_reason, execution_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        patternId,
        currentPattern.confidence_score,
        newConfidence,
        success ? (humanModified ? 'override' : 'success') : 'failure',
        executionId
      ]);

      // Check if pattern should be promoted to auto-executable
      if (newConfidence >= this.config.autoExecuteThreshold && !currentPattern.auto_executable) {
        await this.checkPatternPromotion(patternId);
      }

      logger.info('[PatternLearning] Pattern confidence updated', {
        patternId,
        oldConfidence: currentPattern.confidence_score,
        newConfidence,
        reason: success ? (humanModified ? 'override' : 'success') : 'failure'
      });
    } catch (error) {
      logger.error('[PatternLearning] Failed to update pattern confidence', error);
    }
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Generate a normalized signature for pattern matching
   */
  private generateSignature(message: string): string {
    const normalized = message
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  /**
   * Find patterns matching the given message
   */
  private async findMatchingPatterns(message: string, signature: string): Promise<Pattern[]> {
    try {
      // TODO: Implement semantic search with embeddings when OpenAI is available
      
      // For now, use signature and keyword matching
      const result = await db.query(`
        SELECT * FROM decision_patterns
        WHERE is_active = TRUE
          AND (
            pattern_signature = $1
            OR EXISTS (
              SELECT 1 FROM unnest(trigger_keywords) AS keyword
              WHERE $2 ILIKE '%' || keyword || '%'
            )
          )
        ORDER BY confidence_score DESC, execution_count DESC
        LIMIT 10
      `, [signature, message]);

      return result.rows;
    } catch (error) {
      logger.error('[PatternLearning] Failed to find matching patterns', error);
      return [];
    }
  }

  /**
   * Find a pattern by its signature
   */
  private async findPatternBySignature(signature: string): Promise<Pattern | null> {
    try {
      const result = await db.query(
        'SELECT * FROM decision_patterns WHERE pattern_signature = $1 AND is_active = TRUE',
        [signature]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('[PatternLearning] Failed to find pattern by signature', error);
      return null;
    }
  }

  /**
   * Log pattern match for analysis
   */
  private async logPatternMatch(
    pattern: Pattern,
    message: string,
    phoneNumber: string,
    conversationId: string
  ): Promise<void> {
    try {
      await db.query(`
        INSERT INTO pattern_execution_history 
        (pattern_id, conversation_id, phone_number, message_text, 
         confidence_at_execution, execution_mode, message_timestamp, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `, [
        pattern.id,
        conversationId,
        phoneNumber,
        message,
        pattern.confidence_score,
        this.config.shadowMode ? 'shadow' : this.getExecutionMode(pattern.confidence_score)
      ]);
    } catch (error) {
      logger.error('[PatternLearning] Failed to log pattern match', error);
    }
  }

  /**
   * Get execution mode based on confidence
   */
  private getExecutionMode(confidence: number): string {
    if (confidence >= this.config.autoExecuteThreshold) return 'auto';
    if (confidence >= this.config.suggestThreshold) return 'suggested';
    if (confidence >= this.config.queueThreshold) return 'queued';
    return 'manual';
  }

  /**
   * Fill response template with variables
   */
  private fillResponseTemplate(template: string, variables: any): string {
    let filled = template;
    Object.keys(variables || {}).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      filled = filled.replace(regex, variables[key] || '');
    });
    return filled;
  }

  /**
   * Create a new pattern from human interaction using GPT-4
   */
  private async createNewPatternFromInteraction(
    message: string,
    response: string,
    actions: any[],
    operatorId?: number
  ): Promise<void> {
    try {
      if (!this.openai) {
        return await this.createBasicPattern(
          message, 
          response, 
          actions, 
          this.generateSignature(message),
          operatorId
        );
      }

      // Use GPT-4 to analyze and extract pattern
      const analysis = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: `Extract a reusable pattern from this customer service interaction.
            Return JSON with:
            - pattern_type: one of [booking, tech_issue, access, faq, gift_cards, hours]
            - keywords: array of important keywords from the message
            - response_template: generalized response (use {{customer_name}} for personalization)
            - confidence: initial confidence score (0.50-0.70)
            - is_edge_case: boolean indicating if this is unusual
            - summary: brief description of the pattern`
        }, {
          role: 'user',
          content: `Customer: "${message}"\nOperator: "${response}"\nActions: ${JSON.stringify(actions)}`
        }],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const patternData = JSON.parse(analysis.choices[0].message.content || '{}');
      
      // Create the pattern
      await db.query(`
        INSERT INTO decision_patterns 
        (pattern_type, pattern_signature, trigger_text, trigger_keywords,
         response_template, action_template, confidence_score, 
         created_from, created_by, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (pattern_signature) DO UPDATE
        SET response_template = EXCLUDED.response_template,
            last_modified = NOW()
      `, [
        patternData.pattern_type || 'faq',
        this.generateSignature(message),
        message,
        patternData.keywords || [],
        patternData.response_template || response,
        actions.length > 0 ? JSON.stringify(actions) : null,
        patternData.confidence || 0.60,
        'learned',
        operatorId,
        patternData.summary || 'Learned from operator interaction'
      ]);

      logger.info('[PatternLearning] Created new pattern from interaction', {
        type: patternData.pattern_type,
        confidence: patternData.confidence,
        isEdgeCase: patternData.is_edge_case
      });
    } catch (error) {
      logger.error('[PatternLearning] Failed to create pattern from interaction', error);
    }
  }

  /**
   * Create a basic pattern without AI analysis
   */
  private async createBasicPattern(
    message: string,
    response: string,
    actions: any[],
    signature: string,
    operatorId?: number
  ): Promise<void> {
    try {
      // Extract basic keywords
      const keywords = message
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 5);

      // Determine pattern type based on keywords
      let patternType = 'faq';
      if (message.match(/book|reserv|schedul/i)) patternType = 'booking';
      else if (message.match(/track|simul|bay|screen|reset/i)) patternType = 'tech_issue';
      else if (message.match(/door|unlock|access|entry/i)) patternType = 'access';
      else if (message.match(/gift|card|certificate/i)) patternType = 'gift_cards';
      else if (message.match(/hour|open|close|time/i)) patternType = 'hours';

      await db.query(`
        INSERT INTO decision_patterns 
        (pattern_type, pattern_signature, trigger_text, trigger_keywords,
         response_template, action_template, confidence_score, 
         created_from, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (pattern_signature) DO UPDATE
        SET response_template = EXCLUDED.response_template,
            last_modified = NOW()
      `, [
        patternType,
        signature,
        message,
        keywords,
        response,
        actions.length > 0 ? JSON.stringify(actions) : null,
        0.50, // Start with 50% confidence
        'learned',
        operatorId
      ]);

      logger.info('[PatternLearning] Created basic pattern', { type: patternType });
    } catch (error) {
      logger.error('[PatternLearning] Failed to create basic pattern', error);
    }
  }

  /**
   * Update existing pattern based on human response
   */
  private async updatePatternFromHumanResponse(
    patternId: number,
    humanResponse: string,
    actionsTaken: any[],
    operatorId?: number
  ): Promise<void> {
    try {
      // For now, just log that the pattern was overridden
      // TODO: Implement pattern merging/updating logic
      
      await db.query(`
        UPDATE decision_patterns
        SET human_override_count = human_override_count + 1,
            last_modified = NOW()
        WHERE id = $1
      `, [patternId]);

      logger.info('[PatternLearning] Pattern overridden by human', { patternId });
    } catch (error) {
      logger.error('[PatternLearning] Failed to update pattern from human response', error);
    }
  }

  /**
   * Check if pattern should be promoted to auto-executable
   */
  private async checkPatternPromotion(patternId: number): Promise<void> {
    try {
      const result = await db.query(
        'SELECT promote_pattern_to_auto_executable($1) as promoted',
        [patternId]
      );
      
      if (result.rows[0]?.promoted) {
        logger.info('[PatternLearning] Pattern promoted to auto-executable', { patternId });
      }
    } catch (error) {
      logger.error('[PatternLearning] Failed to check pattern promotion', error);
    }
  }

  // Utility functions
  private snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  private parseConfigValue(value: string): any {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(Number(value))) return Number(value);
    return value;
  }
}

// BREADCRUMB: Export singleton instance
export const patternLearningService = new PatternLearningService();

// TODO NEXT STEPS:
// 1. Run typescript check: npm run typecheck
// 2. Add to aiAutomationService.ts in shadow mode
// 3. Create API endpoints in routes/patterns.ts
// 4. Test with sample messages
// 5. Monitor shadow mode logs before enabling