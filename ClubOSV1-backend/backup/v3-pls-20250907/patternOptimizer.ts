/**
 * Pattern Optimizer Service
 * 
 * Maximizes pattern learning effectiveness through:
 * - Quality scoring and void mechanisms
 * - Pattern merging and clustering
 * - Confidence decay management
 * - Performance analytics
 */

import { db } from '../utils/database';
import { logger } from '../utils/logger';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface InteractionQuality {
  score: number; // 0-1
  issues: string[];
  isGoldStandard: boolean;
  shouldVoid: boolean;
  reason?: string;
}

interface PatternCluster {
  primaryPatternId: string;
  alternativePhrasings: string[];
  contextVariations: Map<string, any>;
  totalExecutions: number;
  averageConfidence: number;
}

interface PatternPerformance {
  patternId: string;
  successRate: number;
  averageResponseTime: number;
  customerSatisfaction: number;
  operatorOverrideRate: number;
  lastUsed: Date;
  trend: 'improving' | 'stable' | 'declining';
}

export class PatternOptimizer {
  
  /**
   * Score interaction quality to determine if it should be learned from
   */
  async scoreInteractionQuality(
    customerMessage: string,
    operatorResponse: string,
    resolution: boolean,
    responseTime: number,
    operatorId: string
  ): Promise<InteractionQuality> {
    const issues: string[] = [];
    let score = 1.0;
    
    // Check for test/debug messages
    if (this.isTestMessage(customerMessage) || this.isTestMessage(operatorResponse)) {
      return {
        score: 0,
        issues: ['Test message detected'],
        isGoldStandard: false,
        shouldVoid: true,
        reason: 'test_message'
      };
    }
    
    // Check for very short interactions (likely incomplete)
    if (customerMessage.length < 10 || operatorResponse.length < 10) {
      score -= 0.3;
      issues.push('Very short interaction');
    }
    
    // Check for profanity or inappropriate content
    if (this.containsInappropriateContent(customerMessage) || 
        this.containsInappropriateContent(operatorResponse)) {
      return {
        score: 0,
        issues: ['Inappropriate content'],
        isGoldStandard: false,
        shouldVoid: true,
        reason: 'inappropriate_content'
      };
    }
    
    // Check response time (very fast might be copy-paste, very slow might be complex)
    if (responseTime < 5) { // Less than 5 seconds
      score -= 0.2;
      issues.push('Possibly automated or copy-paste response');
    } else if (responseTime > 600) { // More than 10 minutes
      score -= 0.1;
      issues.push('Very slow response time');
    }
    
    // Check for unresolved issues
    if (!resolution) {
      score -= 0.3;
      issues.push('Issue not resolved');
    }
    
    // Check for confusion indicators
    const confusionPhrases = [
      'i don\'t understand',
      'what do you mean',
      'that doesn\'t make sense',
      'wrong information',
      'that\'s not what i asked'
    ];
    
    const hasConfusion = confusionPhrases.some(phrase => 
      customerMessage.toLowerCase().includes(phrase) ||
      operatorResponse.toLowerCase().includes(phrase)
    );
    
    if (hasConfusion) {
      score -= 0.4;
      issues.push('Confusion detected in conversation');
    }
    
    // Check if operator is a senior/trainer (their responses are gold standard)
    const operatorInfo = await db.query(
      'SELECT role, experience_level FROM users WHERE id = $1',
      [operatorId]
    );
    
    const isGoldStandard = operatorInfo.rows[0]?.experience_level === 'senior' ||
                           operatorInfo.rows[0]?.role === 'trainer';
    
    if (isGoldStandard) {
      score = Math.min(1.0, score + 0.2); // Boost score for experienced operators
    }
    
    return {
      score: Math.max(0, Math.min(1, score)),
      issues,
      isGoldStandard,
      shouldVoid: score < 0.3,
      reason: issues.join(', ')
    };
  }
  
  /**
   * Merge similar patterns instead of replacing them
   */
  async mergePatterns(
    existingPatternId: string,
    newTriggerText: string,
    newResponse: string,
    newContext: any
  ): Promise<void> {
    try {
      // Get existing pattern
      const existing = await db.query(
        'SELECT * FROM decision_patterns WHERE id = $1',
        [existingPatternId]
      );
      
      if (!existing.rows[0]) {
        throw new Error('Pattern not found');
      }
      
      const pattern = existing.rows[0];
      
      // Store alternative phrasing
      await db.query(`
        INSERT INTO pattern_alternatives 
        (pattern_id, alternative_text, alternative_response, context, frequency)
        VALUES ($1, $2, $3, $4, 1)
        ON CONFLICT (pattern_id, alternative_text) 
        DO UPDATE SET 
          frequency = pattern_alternatives.frequency + 1,
          last_seen = NOW()
      `, [existingPatternId, newTriggerText, newResponse, newContext]);
      
      // Update pattern with merged information
      const mergedKeywords = this.mergeKeywords(
        pattern.trigger_keywords || [],
        this.extractKeywords(newTriggerText)
      );
      
      // Use GPT-4 to create an improved response template
      if (openai.apiKey) {
        const improvedResponse = await this.createImprovedResponse(
          pattern.response_template,
          newResponse
        );
        
        await db.query(`
          UPDATE decision_patterns 
          SET trigger_keywords = $1,
              response_template = $2,
              execution_count = execution_count + 1,
              last_modified = NOW()
          WHERE id = $3
        `, [mergedKeywords, improvedResponse, existingPatternId]);
      } else {
        // Simple merge without AI
        await db.query(`
          UPDATE decision_patterns 
          SET trigger_keywords = $1,
              execution_count = execution_count + 1,
              last_modified = NOW()
          WHERE id = $2
        `, [mergedKeywords, existingPatternId]);
      }
      
      logger.info('Pattern merged successfully', {
        patternId: existingPatternId,
        newKeywords: mergedKeywords.length
      });
    } catch (error) {
      logger.error('Failed to merge patterns:', error);
      throw error;
    }
  }
  
  /**
   * Apply confidence decay to unused patterns
   */
  async applyConfidenceDecay(): Promise<void> {
    try {
      // Decay confidence for patterns not used in last 30 days
      const result = await db.query(`
        UPDATE decision_patterns
        SET confidence_score = GREATEST(
          0.3, -- Minimum confidence
          confidence_score * 0.95 -- 5% decay
        )
        WHERE last_used < NOW() - INTERVAL '30 days'
          AND is_active = true
        RETURNING id, pattern_type, confidence_score
      `);
      
      if (result.rows.length > 0) {
        logger.info(`Applied confidence decay to ${result.rows.length} patterns`);
        
        // Deactivate patterns with very low confidence
        await db.query(`
          UPDATE decision_patterns
          SET is_active = false,
              notes = 'Deactivated due to low confidence from decay'
          WHERE confidence_score < 0.3
            AND is_active = true
        `);
      }
      
      // Boost confidence for frequently used successful patterns
      await db.query(`
        UPDATE decision_patterns p
        SET confidence_score = LEAST(
          0.99, -- Maximum confidence
          confidence_score + 0.01 -- 1% boost
        )
        FROM (
          SELECT pattern_id, 
                 COUNT(*) as recent_uses,
                 AVG(CASE WHEN was_successful THEN 1 ELSE 0 END) as success_rate
          FROM pattern_execution_history
          WHERE executed_at > NOW() - INTERVAL '7 days'
          GROUP BY pattern_id
          HAVING COUNT(*) > 5 AND AVG(CASE WHEN was_successful THEN 1 ELSE 0 END) > 0.9
        ) AS recent
        WHERE p.id = recent.pattern_id
      `);
    } catch (error) {
      logger.error('Failed to apply confidence decay:', error);
    }
  }
  
  /**
   * Track operator feedback on patterns
   */
  async recordOperatorFeedback(
    patternId: string,
    operatorId: string,
    feedback: 'approve' | 'reject' | 'improve',
    suggestion?: string
  ): Promise<void> {
    try {
      // Record feedback
      await db.query(`
        INSERT INTO pattern_feedback
        (pattern_id, operator_id, feedback_type, suggestion, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [patternId, operatorId, feedback, suggestion]);
      
      // Update pattern confidence based on feedback
      const adjustment = feedback === 'approve' ? 0.05 : 
                         feedback === 'reject' ? -0.15 : -0.05;
      
      await db.query(`
        UPDATE decision_patterns
        SET confidence_score = GREATEST(0, LEAST(1, confidence_score + $1)),
            human_feedback_count = human_feedback_count + 1
        WHERE id = $2
      `, [adjustment, patternId]);
      
      // If rejected by multiple operators, deactivate
      const rejectionCount = await db.query(`
        SELECT COUNT(*) as count
        FROM pattern_feedback
        WHERE pattern_id = $1 
          AND feedback_type = 'reject'
          AND created_at > NOW() - INTERVAL '7 days'
      `, [patternId]);
      
      if (rejectionCount.rows[0].count >= 3) {
        await db.query(`
          UPDATE decision_patterns
          SET is_active = false,
              notes = 'Deactivated due to multiple operator rejections'
          WHERE id = $1
        `, [patternId]);
        
        logger.warn('Pattern deactivated due to rejections', { patternId });
      }
    } catch (error) {
      logger.error('Failed to record operator feedback:', error);
    }
  }
  
  /**
   * Create pattern performance analytics
   */
  async analyzePatternPerformance(patternId: string): Promise<PatternPerformance> {
    try {
      const stats = await db.query(`
        SELECT 
          p.id,
          p.confidence_score,
          p.last_used,
          COUNT(DISTINCT peh.id) as total_executions,
          AVG(CASE WHEN peh.was_successful THEN 1 ELSE 0 END) as success_rate,
          AVG(peh.response_time_ms) as avg_response_time,
          COUNT(DISTINCT pf.id) as feedback_count,
          AVG(CASE WHEN pf.feedback_type = 'approve' THEN 1 
                   WHEN pf.feedback_type = 'reject' THEN 0 
                   ELSE 0.5 END) as approval_rate
        FROM decision_patterns p
        LEFT JOIN pattern_execution_history peh ON p.id = peh.pattern_id
        LEFT JOIN pattern_feedback pf ON p.id = pf.pattern_id
        WHERE p.id = $1
        GROUP BY p.id
      `, [patternId]);
      
      if (!stats.rows[0]) {
        throw new Error('Pattern not found');
      }
      
      const data = stats.rows[0];
      
      // Calculate trend
      const recentStats = await db.query(`
        SELECT 
          AVG(CASE WHEN was_successful THEN 1 ELSE 0 END) as recent_success_rate
        FROM pattern_execution_history
        WHERE pattern_id = $1 
          AND executed_at > NOW() - INTERVAL '7 days'
      `, [patternId]);
      
      const oldStats = await db.query(`
        SELECT 
          AVG(CASE WHEN was_successful THEN 1 ELSE 0 END) as old_success_rate
        FROM pattern_execution_history
        WHERE pattern_id = $1 
          AND executed_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
      `, [patternId]);
      
      const recentRate = recentStats.rows[0]?.recent_success_rate || 0;
      const oldRate = oldStats.rows[0]?.old_success_rate || 0;
      
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (recentRate > oldRate + 0.1) trend = 'improving';
      else if (recentRate < oldRate - 0.1) trend = 'declining';
      
      return {
        patternId: data.id,
        successRate: parseFloat(data.success_rate || 0),
        averageResponseTime: parseFloat(data.avg_response_time || 0),
        customerSatisfaction: parseFloat(data.approval_rate || 0.5),
        operatorOverrideRate: 1 - parseFloat(data.success_rate || 0),
        lastUsed: data.last_used,
        trend
      };
    } catch (error) {
      logger.error('Failed to analyze pattern performance:', error);
      throw error;
    }
  }
  
  /**
   * Test a pattern with simulated messages
   */
  async testPattern(
    patternId: string,
    testMessages: string[]
  ): Promise<{ matches: number; confidence: number[] }> {
    const pattern = await db.query(
      'SELECT * FROM decision_patterns WHERE id = $1',
      [patternId]
    );
    
    if (!pattern.rows[0]) {
      throw new Error('Pattern not found');
    }
    
    let matches = 0;
    const confidences: number[] = [];
    
    for (const message of testMessages) {
      const signature = this.generateSignature(message);
      const keywords = this.extractKeywords(message);
      
      // Check if pattern would match
      const wouldMatch = 
        pattern.rows[0].pattern_signature === signature ||
        this.keywordsOverlap(pattern.rows[0].trigger_keywords, keywords) > 0.5;
      
      if (wouldMatch) {
        matches++;
        confidences.push(pattern.rows[0].confidence_score);
      }
    }
    
    return { matches, confidence: confidences };
  }
  
  // Helper methods
  
  private isTestMessage(text: string): boolean {
    const testIndicators = ['test', 'testing', 'ignore this', 'debug', 'asdf', '123'];
    const lower = text.toLowerCase();
    return testIndicators.some(indicator => lower.includes(indicator));
  }
  
  private containsInappropriateContent(text: string): boolean {
    // Simple profanity check - should be enhanced with proper filter
    const inappropriate = ['fuck', 'shit', 'damn', 'hell'];
    const lower = text.toLowerCase();
    return inappropriate.some(word => lower.includes(word));
  }
  
  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 10);
  }
  
  private mergeKeywords(existing: string[], new_: string[]): string[] {
    const merged = new Set([...existing, ...new_]);
    return Array.from(merged).slice(0, 20); // Limit to 20 keywords
  }
  
  private async createImprovedResponse(
    existing: string,
    new_: string
  ): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: 'Merge these two customer service responses into one improved version. Keep it concise and professional.'
        }, {
          role: 'user',
          content: `Response 1: ${existing}\n\nResponse 2: ${new_}`
        }],
        temperature: 0.3,
        max_tokens: 200
      });
      
      return response.choices[0].message.content || existing;
    } catch (error) {
      logger.error('Failed to create improved response:', error);
      return existing; // Fallback to existing
    }
  }
  
  private generateSignature(text: string): string {
    const normalized = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    return require('crypto')
      .createHash('md5')
      .update(normalized)
      .digest('hex');
  }
  
  private keywordsOverlap(keywords1: string[], keywords2: string[]): number {
    if (!keywords1?.length || !keywords2?.length) return 0;
    
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    
    return intersection.size / Math.min(set1.size, set2.size);
  }
}

export const patternOptimizer = new PatternOptimizer();