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
  reasoning?: {
    thought_process: string;
    next_steps: string[];
    questions_to_ask?: string[];
    confidence_explanation: string;
  };
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
      autoExecuteThreshold: 0.85, // Lowered from 0.95 for faster auto-execution
      suggestThreshold: 0.60, // Lowered from 0.75 to show suggestions earlier
      queueThreshold: 0.40, // Lowered from 0.50 to capture more patterns
      confidenceIncreaseSuccess: 0.15, // Increased from 0.05 - reach auto threshold after ~3 approvals
      confidenceIncreaseModified: 0.10, // Increased from 0.02
      confidenceDecreaseFailure: 0.20, // Increased from 0.10 for stronger negative feedback
      confidenceDecayDaily: 0.01,
      suggestionTimeoutSeconds: 30,
      minExecutionsForAuto: 3 // Reduced from 20 - auto-send after just 3 successful uses
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

      // Get conversation history FIRST for better context
      const conversationHistory = await this.getConversationHistory(conversationId);
      
      // Generate pattern signature with context
      const signature = this.generateSignature(message);
      
      // Find matching patterns WITH conversation context
      const patterns = await this.findMatchingPatterns(message, signature, conversationHistory);
      
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
      let bestMatch = patterns[0];
      
      // Validate the match with GPT-4o to prevent nonsensical responses
      if (this.openai && bestMatch) {
        const isValidMatch = await this.validatePatternMatch(message, bestMatch, customerName, conversationHistory);
        if (!isValidMatch) {
          logger.info('[PatternLearning] GPT-4o rejected pattern match as inappropriate', {
            message: message.substring(0, 50),
            patternId: bestMatch.id,
            patternResponse: bestMatch.response_template.substring(0, 50)
          });
          
          // Try the next best pattern or escalate
          if (patterns.length > 1) {
            bestMatch = patterns[1];
          } else {
            return {
              action: 'escalate',
              reason: 'no_appropriate_pattern',
              learnFromResponse: true
            };
          }
        }
      }
      
      // We'll log after generating response to include the actual response text

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

      // Conversation history already fetched earlier
      
      // Build context for variable replacement
      const templateContext = await this.buildTemplateContext(message, {
        customerName,
        phoneNumber,
        conversationId,
        pattern: bestMatch
      });
      
      // Use GPT-4o for reasoning and adaptive response generation
      const reasonedResponse = await this.generateReasonedResponse(
        message,
        bestMatch,
        templateContext,
        conversationHistory
      );
      
      // Log pattern match with the actual response
      const willAutoExecute = bestMatch.confidence_score >= this.config.autoExecuteThreshold && bestMatch.auto_executable;
      await this.logPatternMatch(
        bestMatch, 
        message, 
        phoneNumber, 
        conversationId, 
        reasonedResponse.response,
        willAutoExecute
      );
      
      // Apply confidence-based automation with reasoning
      if (bestMatch.confidence_score >= this.config.autoExecuteThreshold && bestMatch.auto_executable) {
        return {
          action: 'auto_execute',
          pattern: bestMatch,
          patternId: bestMatch.id,
          response: reasonedResponse.response,
          actions: reasonedResponse.actions,
          confidence: bestMatch.confidence_score,
          reasoning: reasonedResponse.reasoning
        };
      } else if (bestMatch.confidence_score >= this.config.suggestThreshold) {
        return {
          action: 'suggest',
          pattern: bestMatch,
          patternId: bestMatch.id,
          response: reasonedResponse.response,
          actions: reasonedResponse.actions,
          confidence: bestMatch.confidence_score,
          reasoning: reasonedResponse.reasoning
        };
      } else if (bestMatch.confidence_score >= this.config.queueThreshold) {
        return {
          action: 'queue',
          pattern: bestMatch,
          patternId: bestMatch.id,
          response: reasonedResponse.response,
          actions: reasonedResponse.actions,
          confidence: bestMatch.confidence_score,
          reasoning: reasonedResponse.reasoning
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
    operatorId?: string
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
   * Find patterns matching the given message using hybrid search (semantic + keyword)
   */
  private async findMatchingPatterns(
    message: string, 
    signature: string,
    conversationHistory: any[] = []
  ): Promise<Pattern[]> {
    try {
      const patterns: Pattern[] = [];
      
      // Build context-aware message for better matching
      const contextMessage = this.buildContextMessage(message, conversationHistory);
      
      // 1. Try semantic search if we have OpenAI
      if (this.openai) {
        const semanticPatterns = await this.findSemanticMatches(contextMessage);
        patterns.push(...semanticPatterns);
      }
      
      // 2. Also do keyword matching as fallback/supplement
      const keywordResult = await db.query(`
        SELECT * FROM decision_patterns
        WHERE is_active = TRUE
          AND (
            pattern_signature = $1
            OR EXISTS (
              SELECT 1 FROM unnest(trigger_keywords) AS keyword
              WHERE $2 ILIKE '%' || keyword || '%'
            )
          )
          AND id NOT IN (SELECT unnest($3::int[]))
        ORDER BY confidence_score DESC, execution_count DESC
        LIMIT 5
      `, [signature, message, patterns.map(p => p.id)]);
      
      patterns.push(...keywordResult.rows);
      
      // 3. Sort by confidence and return top matches
      return patterns
        .sort((a, b) => b.confidence_score - a.confidence_score)
        .slice(0, 10);
        
    } catch (error) {
      logger.error('[PatternLearning] Failed to find matching patterns', error);
      return [];
    }
  }
  
  /**
   * Find semantically similar patterns using embeddings
   */
  private async findSemanticMatches(message: string, threshold: number = 0.75): Promise<Pattern[]> {
    try {
      if (!this.openai) return [];
      
      // Check embedding cache first
      const cacheKey = this.generateSignature(message);
      const cachedEmbedding = await this.getCachedEmbedding(cacheKey);
      
      let embedding: number[];
      if (cachedEmbedding) {
        embedding = cachedEmbedding;
      } else {
        // Generate embedding for the message
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: message
        });
        embedding = response.data[0].embedding;
        
        // Cache the embedding
        await this.cacheEmbedding(cacheKey, message, embedding);
      }
      
      // Find similar patterns using the embedding
      const result = await db.query(`
        SELECT 
          p.*,
          cosine_similarity($1::float[], p.embedding) as similarity
        FROM decision_patterns p
        WHERE 
          p.embedding IS NOT NULL
          AND p.is_active = TRUE
          AND p.semantic_search_enabled = TRUE
          AND cosine_similarity($1::float[], p.embedding) >= $2
        ORDER BY similarity DESC
        LIMIT 10
      `, [embedding, threshold]);
      
      logger.debug('[PatternLearning] Semantic search found', {
        count: result.rows.length,
        topSimilarity: result.rows[0]?.similarity || 0
      });
      
      return result.rows;
    } catch (error) {
      logger.error('[PatternLearning] Semantic search failed', error);
      return [];
    }
  }
  
  /**
   * Get cached embedding for a message
   */
  private async getCachedEmbedding(messageHash: string): Promise<number[] | null> {
    try {
      const result = await db.query(`
        UPDATE message_embeddings
        SET use_count = use_count + 1,
            last_used = NOW()
        WHERE message_hash = $1
        RETURNING embedding
      `, [messageHash]);
      
      return result.rows[0]?.embedding || null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Cache an embedding for future use
   */
  private async cacheEmbedding(messageHash: string, message: string, embedding: number[]): Promise<void> {
    try {
      await db.query(`
        INSERT INTO message_embeddings (message_hash, message_text, embedding)
        VALUES ($1, $2, $3)
        ON CONFLICT (message_hash) DO UPDATE
        SET use_count = message_embeddings.use_count + 1,
            last_used = NOW()
      `, [messageHash, message, embedding]);
    } catch (error) {
      // Non-critical, just log
      logger.debug('[PatternLearning] Failed to cache embedding', error);
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
    conversationId: string,
    response?: string,
    wasAutoExecuted: boolean = false
  ): Promise<void> {
    try {
      await db.query(`
        INSERT INTO pattern_execution_history 
        (pattern_id, conversation_id, phone_number, message_text, 
         confidence_at_execution, execution_mode, message_timestamp, created_at,
         response_sent, was_auto_executed)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7, $8)
      `, [
        pattern.id,
        conversationId,
        phoneNumber,
        message,
        pattern.confidence_score,
        this.config.shadowMode ? 'shadow' : this.getExecutionMode(pattern.confidence_score),
        response || null,
        wasAutoExecuted
      ]);

      // Update pattern statistics
      const statsResult = await db.query(`
        SELECT update_pattern_statistics($1, true, false)
      `, [pattern.id]);
      
      logger.info('[PatternLearning] Updated pattern statistics', {
        patternId: pattern.id,
        result: statsResult.rows[0]
      });
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
   * Supports:
   * - Basic replacement: {{customer_name}}
   * - Nested objects: {{customer.name}}
   * - Default values: {{bay_number|Bay 1}}
   * - Formatting: {{time|format:hh:mm a}}
   */
  private fillResponseTemplate(template: string, context: any): string {
    if (!template) return '';
    
    // Extract all variables from the template
    const variablePattern = /\{\{([^}]+)\}\}/g;
    let filled = template;
    
    // Process each variable
    filled = filled.replace(variablePattern, (match, variable) => {
      try {
        // Check for default value (e.g., {{bay_number|Bay 1}})
        const [varPath, defaultValue] = variable.split('|').map((s: string) => s.trim());
        
        // Check for formatting (e.g., {{time|format:hh:mm a}})
        let formatSpec = '';
        if (defaultValue?.startsWith('format:')) {
          formatSpec = defaultValue.substring(7);
        }
        
        // Navigate nested objects (e.g., customer.name)
        const value = this.getNestedValue(context, varPath);
        
        // Apply formatting if specified
        if (value && formatSpec) {
          return this.formatValue(value, formatSpec);
        }
        
        // Return value or default
        return value !== undefined && value !== null ? String(value) : (defaultValue || match);
      } catch (error) {
        logger.warn('[PatternLearning] Failed to replace variable', { variable, error });
        return match; // Keep original if replacement fails
      }
    });
    
    return filled;
  }
  
  /**
   * Build context for template variable replacement
   */
  private async buildTemplateContext(message: string, baseContext: any): Promise<any> {
    const context: any = {
      // Basic context
      customer_name: baseContext.customerName,
      phone_number: baseContext.phoneNumber,
      conversation_id: baseContext.conversationId,
      
      // Time context
      current_time: new Date(),
      current_date: new Date().toLocaleDateString(),
      day_of_week: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()],
      
      // Extract entities from message
      ...this.extractEntitiesFromMessage(message)
    };
    
    // Add customer profile data if available
    if (baseContext.phoneNumber) {
      try {
        const customerProfile = await db.query(`
          SELECT 
            cp.*,
            u.email,
            u.name,
            u.role,
            u.phone_number,
            cp.total_rounds,
            cp.handicap,
            cp.home_location,
            cp.preferred_tee_time,
            cp.preferred_bay_type
          FROM users u
          LEFT JOIN customer_profiles cp ON cp.user_id = u.id
          WHERE u.phone_number = $1
          LIMIT 1
        `, [baseContext.phoneNumber]);
        
        if (customerProfile.rows.length > 0) {
          const profile = customerProfile.rows[0];
          context.is_member = profile.role === 'customer';
          context.customer_profile = {
            display_name: profile.display_name,
            handicap: profile.handicap,
            home_location: profile.home_location,
            total_rounds: profile.total_rounds || 0,
            preferred_tee_time: profile.preferred_tee_time,
            preferred_bay_type: profile.preferred_bay_type,
            is_regular: (profile.total_rounds || 0) > 5
          };
          
          // Use profile name if we don't have a customer name
          if (!context.customer_name && profile.name) {
            context.customer_name = profile.name;
          }
        }
      } catch (error) {
        logger.debug('[PatternLearning] Could not fetch customer profile', error);
      }
    }
    
    // Add pattern-specific context if action template has entities
    if (baseContext.pattern?.action_template) {
      try {
        const actionData = typeof baseContext.pattern.action_template === 'string' 
          ? JSON.parse(baseContext.pattern.action_template) 
          : baseContext.pattern.action_template;
        
        if (actionData.entities) {
          Object.assign(context, actionData.entities);
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }
    
    return context;
  }
  
  /**
   * Extract common entities from message text
   */
  private extractEntitiesFromMessage(message: string): any {
    const entities: any = {};
    
    // Extract bay numbers
    const bayMatch = message.match(/bay\s*(\d+)/i);
    if (bayMatch) {
      entities.bay_number = bayMatch[1];
    }
    
    // Extract times (simple patterns)
    const timeMatch = message.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (timeMatch) {
      entities.time = timeMatch[0];
    }
    
    // Extract dates
    const dateMatch = message.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
    if (dateMatch) {
      entities.date = dateMatch[1];
    }
    
    // Extract location references
    if (message.match(/dartmouth/i)) {
      entities.location = 'Dartmouth';
    } else if (message.match(/bedford/i)) {
      entities.location = 'Bedford';
    }
    
    // Extract common issues
    if (message.match(/track\s*man|simulator/i)) {
      entities.issue_type = 'trackman';
    } else if (message.match(/door|unlock|access/i)) {
      entities.issue_type = 'access';
    } else if (message.match(/screen|projector|display/i)) {
      entities.issue_type = 'display';
    }
    
    return entities;
  }
  
  /**
   * Process action template with variable replacement
   */
  private processActionTemplate(actionTemplate: any, context: any): any[] {
    if (!actionTemplate) return [];
    
    try {
      const actions = typeof actionTemplate === 'string' 
        ? JSON.parse(actionTemplate) 
        : actionTemplate;
      
      // If actions is an object with an 'actions' property
      if (actions.actions && Array.isArray(actions.actions)) {
        return actions.actions.map((action: any) => this.fillActionVariables(action, context));
      }
      
      // If actions is directly an array
      if (Array.isArray(actions)) {
        return actions.map((action: any) => this.fillActionVariables(action, context));
      }
      
      return [];
    } catch (error) {
      logger.warn('[PatternLearning] Failed to process action template', { error });
      return [];
    }
  }
  
  /**
   * Fill variables in a single action
   */
  private fillActionVariables(action: any, context: any): any {
    if (typeof action === 'string') {
      return this.fillResponseTemplate(action, context);
    }
    
    if (typeof action === 'object' && action !== null) {
      const filled: any = {};
      for (const key in action) {
        if (typeof action[key] === 'string') {
          filled[key] = this.fillResponseTemplate(action[key], context);
        } else {
          filled[key] = action[key];
        }
      }
      return filled;
    }
    
    return action;
  }
  
  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    
    return path.split('.').reduce((current, key) => {
      return current?.[key];
    }, obj);
  }
  
  /**
   * Format value based on format specification
   */
  private formatValue(value: any, format: string): string {
    try {
      // Time formatting
      if (format.includes('h') || format.includes('m')) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          // Simple time formatting (extend as needed)
          const hours = date.getHours();
          const minutes = date.getMinutes();
          const ampm = hours >= 12 ? 'PM' : 'AM';
          const displayHours = hours % 12 || 12;
          return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
        }
      }
      
      // Number formatting
      if (format === 'currency') {
        return `$${parseFloat(value).toFixed(2)}`;
      }
      
      // Default: return as string
      return String(value);
    } catch (error) {
      return String(value);
    }
  }

  /**
   * Create a new pattern from human interaction using GPT-4
   */
  private async createNewPatternFromInteraction(
    message: string,
    response: string,
    actions: any[],
    operatorId?: string
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

      // Use GPT-4 to analyze and extract pattern with template variables
      const analysis = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: `Extract a reusable pattern from this customer service interaction.
            
            Create a TEMPLATE response with variables, not the exact response.
            Replace specific values with template variables:
            - Customer names → {{customer_name}}
            - Bay numbers → {{bay_number}}
            - Times → {{time}}
            - Dates → {{date}}
            - Locations → {{location}}
            - Codes/passwords → {{code}}
            - Amounts → {{amount}}
            
            Return JSON with:
            - pattern_type: one of [booking, tech_issue, access, faq, gift_cards, hours]
            - keywords: array of important keywords from the message
            - response_template: generalized response with {{variables}}
            - entities: object with extracted values (e.g., {"bay_number": "3", "time": "7pm"})
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
      
      // Create the pattern with entities stored in action_template
      const actionData = {
        actions: actions.length > 0 ? actions : [],
        entities: patternData.entities || {},
        metadata: {
          is_edge_case: patternData.is_edge_case,
          created_at: new Date().toISOString()
        }
      };
      
      await db.query(`
        INSERT INTO decision_patterns 
        (pattern_type, pattern_signature, trigger_text, trigger_keywords,
         response_template, action_template, confidence_score, 
         created_from, created_by, notes, is_active, auto_executable)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, false)
        ON CONFLICT (pattern_signature) DO UPDATE
        SET response_template = EXCLUDED.response_template,
            action_template = EXCLUDED.action_template,
            trigger_keywords = EXCLUDED.trigger_keywords,
            last_modified = NOW()
      `, [
        patternData.pattern_type || 'faq',
        this.generateSignature(message),
        message,
        patternData.keywords || [],
        patternData.response_template || response,
        JSON.stringify(actionData),
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
    operatorId?: string
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
         created_from, created_by, is_active, auto_executable)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, false)
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
    operatorId?: string
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

  /**
   * Build context-aware message for better pattern matching
   * Includes recent conversation history to understand context
   */
  private buildContextMessage(message: string, conversationHistory: any[]): string {
    if (conversationHistory.length === 0) {
      return message;
    }
    
    // Get last 3 messages for context (excluding current)
    const recentMessages = conversationHistory
      .slice(-3)
      .map(h => `${h.sender}: ${h.message}`)
      .join(' | ');
    
    // Combine context with current message for better matching
    return `[Context: ${recentMessages}] Current: ${message}`;
  }

  /**
   * Validate if a pattern match makes sense for the given message
   * This prevents nonsensical responses like "swinging club like sword" for "Thanks"
   */
  private async validatePatternMatch(
    message: string,
    pattern: Pattern,
    customerName?: string,
    conversationHistory: any[] = []
  ): Promise<boolean> {
    try {
      if (!this.openai) return true; // Can't validate without AI
      
      // Build conversation context for validation
      const contextString = conversationHistory.length > 0 
        ? `\nRecent Conversation:\n${conversationHistory.slice(-3).map(h => `${h.sender}: ${h.message}`).join('\n')}\n`
        : '';
      
      const prompt = `You are evaluating if a customer service response template is appropriate for a customer message.
${contextString}
Current Customer Message: "${message}"
Customer Name: ${customerName || 'Unknown'}

Proposed Response Template: "${pattern.response_template}"
Pattern Type: ${pattern.pattern_type}
Pattern Trigger: ${pattern.trigger_text || 'N/A'}

Is this response appropriate and contextually relevant for this message?
Consider:
1. Does the response make logical sense as a reply to the message?
2. Is the tone and content appropriate?
3. Would this response seem random or out of context?

Respond with a JSON object: { "appropriate": true/false, "reason": "brief explanation" }`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Very low temperature for consistent validation
        response_format: { type: "json_object" },
        max_tokens: 200
      });

      const result = JSON.parse(completion.choices[0].message.content || '{"appropriate": true}');
      
      if (!result.appropriate) {
        logger.info('[PatternLearning] Pattern validation failed', {
          reason: result.reason,
          message: message.substring(0, 50),
          patternId: pattern.id
        });
      }
      
      return result.appropriate;
    } catch (error) {
      logger.error('[PatternLearning] Pattern validation error', error);
      return true; // Default to allowing the match if validation fails
    }
  }

  /**
   * Generate reasoned response using GPT-4o for adaptive conversation handling
   * This is where the real AI magic happens - not just template filling
   */
  private async generateReasonedResponse(
    message: string,
    pattern: Pattern,
    context: any,
    conversationHistory: any[]
  ): Promise<{
    response: string;
    actions: any[];
    reasoning: {
      thought_process: string;
      next_steps: string[];
      questions_to_ask?: string[];
      confidence_explanation: string;
    };
  }> {
    try {
      // If no OpenAI, fall back to template filling
      if (!this.openai) {
        return {
          response: this.fillResponseTemplate(pattern.response_template, context),
          actions: this.processActionTemplate(pattern.action_template, context),
          reasoning: {
            thought_process: 'Using template-based response (no AI available)',
            next_steps: ['Send response', 'Execute actions'],
            confidence_explanation: 'Pattern match based on historical data'
          }
        };
      }

      // Build comprehensive context for GPT-4o
      const systemPrompt = `You are an AI customer service agent for a golf simulator facility.
You have access to a pattern that previously worked for similar requests. You must follow these CRITICAL RULES:

CRITICAL RULES:
- ONLY use information from the pattern template, conversation history, or context provided
- NEVER make up facility policies, rules, hours, or services
- NEVER invent information about food, alcohol, membership, or any other policies
- If asked about policies not in your template, respond: "Let me check our current policy on that and get back to you"
- Do NOT guess or assume any facility-specific information

Pattern Type: ${pattern.pattern_type}
Pattern Confidence: ${pattern.confidence_score}
Previous Success Rate: ${pattern.success_count}/${pattern.execution_count}

Your job is to:
1. Analyze the customer's message in context of the conversation
2. Use ONLY the pattern's template response and provided context
3. Adapt the wording to be natural while keeping the factual content exactly the same
4. If information is missing, say you'll check rather than guessing
5. Determine next steps based only on available information

Stay within the bounds of what you know. Do not add helpful details that aren't in the pattern.`;

      const userPrompt = `Customer Message: "${message}"
Customer Name: ${context.customer_name || 'Unknown'}
Phone: ${context.phone_number}

Pattern Template Response: "${pattern.response_template}"
Pattern Actions: ${JSON.stringify(pattern.action_template)}

Conversation History:
${conversationHistory.map(h => `${h.sender}: ${h.message}`).join('\n') || 'No previous messages'}

Context Variables:
${JSON.stringify(context, null, 2)}

Please provide:
1. An adapted, natural response for this specific customer and situation
2. A list of actions to take (if any)
3. Your reasoning process
4. Any clarifying questions you would ask
5. Next steps in the conversation`;

      // Use GPT-4o for advanced reasoning
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o', // Using GPT-4o for better reasoning
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for consistency
        response_format: { type: "json_object" },
        max_tokens: 1000
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');

      // Validate and structure the response
      return {
        response: result.response || this.fillResponseTemplate(pattern.response_template, context),
        actions: result.actions || this.processActionTemplate(pattern.action_template, context),
        reasoning: {
          thought_process: result.reasoning || 'Analyzed customer need and adapted response',
          next_steps: result.next_steps || ['Send response', 'Monitor for follow-up'],
          questions_to_ask: result.clarifying_questions,
          confidence_explanation: result.confidence_explanation || `Based on ${pattern.execution_count} similar interactions`
        }
      };

    } catch (error) {
      logger.error('[PatternLearning] GPT-4o reasoning failed, falling back to templates', error);
      
      // Fallback to template-based response
      return {
        response: this.fillResponseTemplate(pattern.response_template, context),
        actions: this.processActionTemplate(pattern.action_template, context),
        reasoning: {
          thought_process: 'Fallback to template due to AI error',
          next_steps: ['Send template response'],
          confidence_explanation: 'Using proven pattern template'
        }
      };
    }
  }

  /**
   * Get conversation history for context
   */
  private async getConversationHistory(conversationId: string, limit: number = 10): Promise<any[]> {
    try {
      const result = await db.query(`
        SELECT 
          sender_type as sender,
          message_text as message,
          created_at
        FROM conversation_messages
        WHERE conversation_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `, [conversationId, limit]);

      return result.rows.reverse(); // Reverse to get chronological order
    } catch (error) {
      logger.warn('[PatternLearning] Could not fetch conversation history', error);
      return [];
    }
  }

  /**
   * Analyze conversation for multi-step planning
   */
  async planConversationSteps(
    message: string,
    conversationId: string,
    customerContext: any
  ): Promise<{
    steps: Array<{
      step: number;
      action: string;
      description: string;
      condition?: string;
    }>;
    current_step: number;
    estimated_resolution_time: string;
  }> {
    try {
      if (!this.openai) {
        return {
          steps: [{ step: 1, action: 'respond', description: 'Send response to customer' }],
          current_step: 1,
          estimated_resolution_time: 'immediate'
        };
      }

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'system',
          content: 'Analyze this customer service request and create a step-by-step resolution plan.'
        }, {
          role: 'user',
          content: `Message: "${message}"\nContext: ${JSON.stringify(customerContext)}\n\nCreate a structured plan with steps, conditions, and estimated time.`
        }],
        temperature: 0.2,
        response_format: { type: "json_object" }
      });

      const plan = JSON.parse(completion.choices[0].message.content || '{}');
      
      return {
        steps: plan.steps || [],
        current_step: 1,
        estimated_resolution_time: plan.estimated_time || 'unknown'
      };

    } catch (error) {
      logger.error('[PatternLearning] Conversation planning failed', error);
      return {
        steps: [{ step: 1, action: 'escalate', description: 'Escalate to human agent' }],
        current_step: 1,
        estimated_resolution_time: 'unknown'
      };
    }
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