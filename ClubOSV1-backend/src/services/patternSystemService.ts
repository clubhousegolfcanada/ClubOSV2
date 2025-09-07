/**
 * Unified Pattern System Service
 * 
 * Consolidates all pattern-related services into a single, cohesive system:
 * - Pattern learning and matching (from patternLearningService)
 * - Quality scoring and optimization (from patternOptimizer)
 * - Safety validation (from patternSafetyService)
 * - Conversation analysis (from conversationAnalyzer)
 * 
 * This service preserves ALL features while providing a clean, unified interface.
 */

import { db } from '../utils/database';
import { logger } from '../utils/logger';
import OpenAI from 'openai';
import crypto from 'crypto';

// Import existing services to preserve their logic
import { PatternLearningService } from './patternLearningService';
import { PatternOptimizer } from './patternOptimizer';
import { patternSafetyService } from './patternSafetyService';
import { ConversationAnalyzer } from './conversationAnalyzer';

// ============================================
// INTERFACES
// ============================================

interface PatternMatch {
  pattern: any;
  confidence: number;
  matchType: 'keyword' | 'semantic' | 'gpt' | 'hybrid';
  reasoning?: string;
}

interface ProcessResult {
  action: 'auto_execute' | 'suggest' | 'queue' | 'escalate' | 'shadow';
  pattern?: any;
  response?: string;
  confidence?: number;
  quality?: number;
  safety?: {
    safe: boolean;
    issues?: string[];
  };
  context?: {
    intent?: string;
    sentiment?: string;
    urgency?: string;
    entities?: any[];
  };
}

interface ConversationContext {
  conversationId: string;
  phoneNumber: string;
  customerName?: string;
  history?: any[];
  metadata?: any;
}

// ============================================
// UNIFIED PATTERN SYSTEM SERVICE
// ============================================

export class PatternSystemService {
  private learning: PatternLearningService;
  private optimizer: PatternOptimizer;
  private safety: typeof patternSafetyService;
  private analyzer: ConversationAnalyzer;
  private openai: OpenAI | null = null;
  
  constructor() {
    // Initialize all modules
    this.learning = new PatternLearningService();
    this.optimizer = new PatternOptimizer();
    this.safety = patternSafetyService;
    this.analyzer = new ConversationAnalyzer();
    
    // Initialize OpenAI for GPT-4o features
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
    
    logger.info('[PatternSystem] Unified service initialized with all modules');
  }
  
  /**
   * Main entry point for processing messages
   * Combines all pattern processing logic
   */
  async processMessage(
    message: string,
    context: ConversationContext
  ): Promise<ProcessResult> {
    try {
      logger.info('[PatternSystem] Processing message', {
        conversationId: context.conversationId,
        messageLength: message.length
      });
      
      // Step 1: Safety validation
      const safetyCheck = await this.safety.checkMessageSafety(message);
      if (!safetyCheck.safe) {
        logger.warn('[PatternSystem] Message failed safety check', safetyCheck);
        return {
          action: 'escalate',
          safety: safetyCheck
        };
      }
      
      // Step 2: Conversation analysis for rich context
      const conversationAnalysis = await this.analyzer.extractConversationContext(
        context.history || []
      );
      
      // Step 3: Pattern matching with learning service
      const learningResult = await this.learning.processMessage(
        message,
        context.phoneNumber,
        context.conversationId,
        context.customerName
      );
      
      // Step 4: Quality scoring if pattern found
      let qualityScore = 0;
      if (learningResult.pattern) {
        const quality = await this.optimizer.scoreInteractionQuality(
          message,
          learningResult.response || '',
          true, // resolution status
          5000, // response time in ms
          'system' // operator ID
        );
        qualityScore = quality.score;
        
        // Check if this is a gold standard interaction
        if (quality.isGoldStandard) {
          logger.info('[PatternSystem] Gold standard interaction detected!', {
            patternId: learningResult.pattern.id,
            score: quality.score
          });
          
          // Store as gold standard example for future learning
          await db.query(`
            INSERT INTO pattern_learning_examples 
            (pattern_id, customer_message, operator_response, confidence_score, created_at)
            VALUES ($1, $2, $3, $4, NOW())
          `, [
            learningResult.pattern.id,
            message,
            learningResult.response,
            quality.score
          ]);
          
          // Update pattern confidence directly in database
          await db.query(`
            UPDATE decision_patterns 
            SET confidence_score = LEAST(confidence_score + 0.01, 1.0),
                updated_at = NOW()
            WHERE id = $1
          `, [learningResult.pattern.id]);
        }
      }
      
      // Step 5: Optimize decision based on all factors
      const optimizedAction = this.optimizeAction(
        learningResult,
        conversationAnalysis,
        qualityScore
      );
      
      // Step 6: Build final result
      return {
        action: optimizedAction,
        pattern: learningResult.pattern,
        response: learningResult.response,
        confidence: learningResult.confidence,
        quality: qualityScore,
        safety: safetyCheck,
        context: {
          intent: conversationAnalysis.intent,
          sentiment: conversationAnalysis.sentiment,
          urgency: conversationAnalysis.urgency,
          entities: []
        }
      };
      
    } catch (error) {
      logger.error('[PatternSystem] Error processing message', error);
      return {
        action: 'escalate',
        safety: { safe: true }
      };
    }
  }
  
  /**
   * Optimize action decision based on multiple factors
   */
  private optimizeAction(
    learningResult: any,
    conversationAnalysis: any,
    qualityScore: number
  ): 'auto_execute' | 'suggest' | 'queue' | 'escalate' | 'shadow' {
    // If no pattern found, escalate
    if (!learningResult.pattern) {
      return 'escalate';
    }
    
    // Check if shadow mode
    if (learningResult.action === 'shadow') {
      return 'shadow';
    }
    
    // Adjust based on conversation urgency
    let confidenceThreshold = 0.85; // Default for auto-execution
    if (conversationAnalysis.urgency === 'high') {
      confidenceThreshold = 0.75; // Lower threshold for urgent messages
    } else if (conversationAnalysis.urgency === 'low') {
      confidenceThreshold = 0.90; // Higher threshold for non-urgent
    }
    
    // Adjust based on quality score
    const adjustedConfidence = learningResult.confidence * (qualityScore / 100);
    
    // Determine final action
    if (adjustedConfidence >= confidenceThreshold && learningResult.pattern.auto_executable) {
      return 'auto_execute';
    } else if (adjustedConfidence >= 0.60) {
      return 'suggest';
    } else if (adjustedConfidence >= 0.40) {
      return 'queue';
    } else {
      return 'escalate';
    }
  }
  
  /**
   * Create a new pattern with all enhancements
   */
  async createPattern(
    patternData: any,
    createdBy: string
  ): Promise<any> {
    try {
      // Validate with safety service
      const safetyCheck = await this.safety.checkMessageSafety(patternData.response_template);
      if (!safetyCheck.safe) {
        throw new Error(`Pattern failed safety check: ${safetyCheck.reason || 'Unknown safety issue'}`);
      }
      
      // Generate embeddings if GPT-4o available
      let embedding = null;
      if (this.openai && patternData.trigger_text) {
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: patternData.trigger_text
        });
        embedding = response.data[0].embedding;
      }
      
      // Create pattern in database
      const result = await db.query(`
        INSERT INTO decision_patterns (
          pattern_type,
          pattern_signature,
          pattern,
          trigger_text,
          trigger_keywords,
          trigger_examples,
          response_template,
          confidence_score,
          auto_executable,
          is_active,
          created_from,
          created_by,
          embedding,
          semantic_search_enabled
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        ) RETURNING *
      `, [
        patternData.pattern_type,
        crypto.createHash('md5').update(patternData.trigger_text || '').digest('hex'),
        patternData.pattern || patternData.trigger_text,
        patternData.trigger_text,
        patternData.trigger_keywords || [],
        patternData.trigger_examples || [],
        patternData.response_template,
        patternData.confidence_score || 0.5,
        false, // Start with auto_executable false
        true, // is_active
        'manual',
        createdBy,
        embedding,
        embedding ? true : false
      ]);
      
      logger.info('[PatternSystem] Created new pattern', {
        patternId: result.rows[0].id,
        type: patternData.pattern_type
      });
      
      return result.rows[0];
      
    } catch (error) {
      logger.error('[PatternSystem] Error creating pattern', error);
      throw error;
    }
  }
  
  /**
   * Update pattern with optimization
   */
  async updatePattern(
    patternId: number,
    updates: any,
    updatedBy: string
  ): Promise<any> {
    try {
      // Get existing pattern
      const existing = await db.query(
        'SELECT * FROM decision_patterns WHERE id = $1',
        [patternId]
      );
      
      if (existing.rows.length === 0) {
        throw new Error('Pattern not found');
      }
      
      // Validate updates with safety service
      if (updates.response_template) {
        const safetyCheck = await this.safety.checkMessageSafety(updates.response_template);
        if (!safetyCheck.safe) {
          throw new Error(`Update failed safety check: ${safetyCheck.reason || 'Unknown safety issue'}`);
        }
      }
      
      // Generate new embeddings if trigger changed
      let embedding = existing.rows[0].embedding;
      if (this.openai && updates.trigger_text && updates.trigger_text !== existing.rows[0].trigger_text) {
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: updates.trigger_text
        });
        embedding = response.data[0].embedding;
      }
      
      // Use optimizer to merge patterns instead of replacing
      if (updates.trigger_examples && existing.rows[0].trigger_examples) {
        updates.trigger_examples = [
          ...new Set([
            ...existing.rows[0].trigger_examples,
            ...updates.trigger_examples
          ])
        ];
      }
      
      // Update pattern
      const result = await db.query(`
        UPDATE decision_patterns
        SET 
          pattern = COALESCE($1, pattern),
          trigger_text = COALESCE($2, trigger_text),
          trigger_keywords = COALESCE($3, trigger_keywords),
          trigger_examples = COALESCE($4, trigger_examples),
          response_template = COALESCE($5, response_template),
          confidence_score = COALESCE($6, confidence_score),
          embedding = $7,
          semantic_search_enabled = $8,
          updated_at = NOW(),
          updated_by = $9
        WHERE id = $10
        RETURNING *
      `, [
        updates.pattern,
        updates.trigger_text,
        updates.trigger_keywords,
        updates.trigger_examples,
        updates.response_template,
        updates.confidence_score,
        embedding,
        embedding ? true : false,
        updatedBy,
        patternId
      ]);
      
      logger.info('[PatternSystem] Updated pattern', {
        patternId,
        updatedFields: Object.keys(updates)
      });
      
      return result.rows[0];
      
    } catch (error) {
      logger.error('[PatternSystem] Error updating pattern', error);
      throw error;
    }
  }
  
  /**
   * Get pattern recommendations using all services
   */
  async getRecommendations(
    message: string,
    context: ConversationContext
  ): Promise<any[]> {
    try {
      // Get recommendations using analyzer's public method
      const learningPatterns = await this.analyzer.findSimilarPatterns(
        message,
        0.7
      );
      
      // Get additional semantic matches with higher threshold
      const semanticMatches = await this.analyzer.findSimilarPatterns(
        message,
        0.85
      );
      
      // Combine and deduplicate
      const allMatches = new Map();
      
      [...learningPatterns, ...semanticMatches].forEach(match => {
        if (!allMatches.has(match.id) || allMatches.get(match.id).confidence < match.confidence_score) {
          allMatches.set(match.id, match);
        }
      });
      
      // Score and rank using optimizer
      const recommendations = await Promise.all(
        Array.from(allMatches.values()).map(async (pattern) => {
          const quality = await this.optimizer.scoreInteractionQuality(
            message,
            pattern.response_template,
            false, // not resolved yet
            0, // no response time yet
            'system' // system evaluation
          );
          
          return {
            ...pattern,
            quality_score: quality.score,
            combined_score: (pattern.confidence_score * 0.7) + (quality.score / 100 * 0.3)
          };
        })
      );
      
      // Sort by combined score
      recommendations.sort((a, b) => b.combined_score - a.combined_score);
      
      return recommendations.slice(0, 5);
      
    } catch (error) {
      logger.error('[PatternSystem] Error getting recommendations', error);
      return [];
    }
  }
  
  /**
   * Analyze pattern performance
   */
  async analyzePerformance(patternId?: number): Promise<any> {
    try {
      if (patternId) {
        // Analyze specific pattern
        return await this.optimizer.analyzePatternPerformance(patternId.toString());
      } else {
        // Analyze all patterns
        const patterns = await db.query(`
          SELECT id FROM decision_patterns 
          WHERE is_active = TRUE
        `);
        
        const analyses = await Promise.all(
          patterns.rows.map(p => this.optimizer.analyzePatternPerformance(p.id.toString()))
        );
        
        return {
          total_patterns: analyses.length,
          high_performers: analyses.filter(a => a.performance_score > 80).length,
          needs_improvement: analyses.filter(a => a.performance_score < 50).length,
          patterns: analyses
        };
      }
    } catch (error) {
      logger.error('[PatternSystem] Error analyzing performance', error);
      throw error;
    }
  }
  
  /**
   * Run pattern optimization
   */
  async optimizePatterns(): Promise<any> {
    try {
      logger.info('[PatternSystem] Starting pattern optimization');
      
      // Run confidence decay
      await this.optimizer.applyConfidenceDecay();
      
      // Identify and merge similar patterns
      const patterns = await db.query(`
        SELECT * FROM decision_patterns 
        WHERE is_active = TRUE
        ORDER BY pattern_type, confidence_score DESC
      `);
      
      let mergeCount = 0;
      const processed = new Set();
      
      for (const pattern of patterns.rows) {
        if (processed.has(pattern.id)) continue;
        
        // Find similar patterns
        const similar = patterns.rows.filter(p => 
          p.id !== pattern.id &&
          !processed.has(p.id) &&
          p.pattern_type === pattern.pattern_type &&
          this.calculateSimilarity(pattern.trigger_text, p.trigger_text) > 0.85
        );
        
        if (similar.length > 0) {
          // Merge similar patterns
          const merged = await this.mergePatternsIntelligently(pattern, similar);
          mergeCount += similar.length;
          
          similar.forEach(s => processed.add(s.id));
        }
        
        processed.add(pattern.id);
      }
      
      logger.info('[PatternSystem] Pattern optimization complete', {
        patternsProcessed: processed.size,
        patternsMerged: mergeCount
      });
      
      return {
        processed: processed.size,
        merged: mergeCount
      };
      
    } catch (error) {
      logger.error('[PatternSystem] Error optimizing patterns', error);
      throw error;
    }
  }
  
  /**
   * Calculate similarity between two texts
   */
  private calculateSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Intelligently merge similar patterns
   */
  private async mergePatternsIntelligently(
    primary: any,
    similar: any[]
  ): Promise<any> {
    try {
      // Combine trigger examples
      const allExamples = new Set([
        ...(primary.trigger_examples || []),
        ...similar.flatMap(s => s.trigger_examples || [])
      ]);
      
      // Combine keywords
      const allKeywords = new Set([
        ...(primary.trigger_keywords || []),
        ...similar.flatMap(s => s.trigger_keywords || [])
      ]);
      
      // Use highest confidence
      const maxConfidence = Math.max(
        primary.confidence_score,
        ...similar.map(s => s.confidence_score)
      );
      
      // Sum execution counts
      const totalExecutions = primary.execution_count + 
        similar.reduce((sum, s) => sum + s.execution_count, 0);
      
      const totalSuccesses = primary.success_count + 
        similar.reduce((sum, s) => sum + s.success_count, 0);
      
      // Update primary pattern with merged data
      await db.query(`
        UPDATE decision_patterns
        SET 
          trigger_examples = $1,
          trigger_keywords = $2,
          confidence_score = $3,
          execution_count = $4,
          success_count = $5,
          updated_at = NOW()
        WHERE id = $6
      `, [
        Array.from(allExamples),
        Array.from(allKeywords),
        maxConfidence,
        totalExecutions,
        totalSuccesses,
        primary.id
      ]);
      
      // Mark similar patterns as deleted
      for (const s of similar) {
        await db.query(`
          UPDATE decision_patterns
          SET 
            is_deleted = TRUE,
            is_active = FALSE,
            notes = COALESCE(notes, '') || ' [Merged into pattern ' || $1 || ']',
            updated_at = NOW()
          WHERE id = $2
        `, [primary.id, s.id]);
      }
      
      logger.info('[PatternSystem] Merged patterns', {
        primaryId: primary.id,
        mergedCount: similar.length
      });
      
      return primary;
      
    } catch (error) {
      logger.error('[PatternSystem] Error merging patterns', error);
      throw error;
    }
  }
}

// Export singleton instance
export const patternSystemService = new PatternSystemService();