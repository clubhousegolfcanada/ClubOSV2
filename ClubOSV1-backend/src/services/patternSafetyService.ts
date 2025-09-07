/**
 * Pattern Safety Service
 * Implements critical safety controls for the V3-PLS system
 */

import { db } from '../utils/database';
import { logger } from '../utils/logger';

interface SafetyCheckResult {
  safe: boolean;
  reason?: string;
  alertType?: 'blacklist' | 'escalation';
  triggeredKeywords?: string[];
}

interface PatternApprovalStatus {
  requiresApproval: boolean;
  approvalCount: number;
  threshold: number;
}

class PatternSafetyService {
  private blacklistTopics: string[] = [];
  private escalationKeywords: string[] = [];
  private requireApprovalForNew: boolean = true;
  private approvalThreshold: number = 10;
  private minExamplesRequired: number = 5;
  private operatorOverrideWeight: number = 2.0;
  private lastConfigLoad: Date = new Date(0);
  private configCacheDuration = 60000; // 1 minute cache

  /**
   * Load safety configuration from database
   */
  private async loadConfig(): Promise<void> {
    try {
      // Only reload if cache expired
      if (Date.now() - this.lastConfigLoad.getTime() < this.configCacheDuration) {
        return;
      }

      const result = await db.query(`
        SELECT config_key, config_value 
        FROM pattern_learning_config 
        WHERE config_key IN (
          'blacklist_topics', 'escalation_keywords', 
          'require_approval_for_new', 'approval_threshold',
          'min_examples_required', 'operator_override_weight'
        )
      `);

      result.rows.forEach(row => {
        switch (row.config_key) {
          case 'blacklist_topics':
            this.blacklistTopics = row.config_value ? 
              row.config_value.split(',').map((t: string) => t.trim().toLowerCase()).filter(t => t.length > 0) : 
              [];
            break;
          case 'escalation_keywords':
            this.escalationKeywords = row.config_value ? 
              row.config_value.split(',').map((k: string) => k.trim().toLowerCase()).filter(k => k.length > 0) : 
              [];
            break;
          case 'require_approval_for_new':
            this.requireApprovalForNew = row.config_value === 'true';
            break;
          case 'approval_threshold':
            this.approvalThreshold = parseInt(row.config_value) || 10;
            break;
          case 'min_examples_required':
            this.minExamplesRequired = parseInt(row.config_value) || 5;
            break;
          case 'operator_override_weight':
            this.operatorOverrideWeight = parseFloat(row.config_value) || 2.0;
            break;
        }
      });

      this.lastConfigLoad = new Date();
      logger.info('[PatternSafety] Configuration loaded', {
        blacklistCount: this.blacklistTopics.length,
        escalationCount: this.escalationKeywords.length,
        approvalRequired: this.requireApprovalForNew
      });
    } catch (error) {
      logger.error('[PatternSafety] Failed to load config', error);
    }
  }

  /**
   * Check if a message contains blacklisted or escalation keywords
   */
  async checkMessageSafety(message: string): Promise<SafetyCheckResult> {
    await this.loadConfig();
    
    const lowerMessage = message.toLowerCase();
    
    // Check blacklist topics
    const blacklistMatches = this.blacklistTopics.filter(topic => 
      lowerMessage.includes(topic)
    );
    
    if (blacklistMatches.length > 0) {
      return {
        safe: false,
        reason: 'Message contains blacklisted topics',
        alertType: 'blacklist',
        triggeredKeywords: blacklistMatches
      };
    }

    // Check escalation keywords
    const escalationMatches = this.escalationKeywords.filter(keyword => 
      lowerMessage.includes(keyword)
    );
    
    if (escalationMatches.length > 0) {
      // Log escalation alert
      await this.logEscalationAlert(message, escalationMatches);
      
      return {
        safe: false,
        reason: 'Message requires operator attention',
        alertType: 'escalation',
        triggeredKeywords: escalationMatches
      };
    }

    return { safe: true };
  }

  /**
   * Log an escalation alert for operator notification
   */
  private async logEscalationAlert(
    message: string, 
    keywords: string[],
    conversationId?: string,
    phoneNumber?: string
  ): Promise<void> {
    try {
      await db.query(`
        INSERT INTO pattern_escalation_alerts (
          conversation_id, phone_number, customer_message, 
          triggered_keywords, alert_type, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        conversationId || null,
        phoneNumber || null,
        message,
        keywords,
        'escalation'
      ]);
      
      logger.warn('[PatternSafety] Escalation alert created', { 
        keywords, 
        messagePreview: message.substring(0, 100) 
      });
    } catch (error) {
      logger.error('[PatternSafety] Failed to log escalation', error);
    }
  }

  /**
   * Check if a pattern requires approval
   */
  async checkPatternApproval(patternId: number): Promise<PatternApprovalStatus> {
    await this.loadConfig();
    
    if (!this.requireApprovalForNew) {
      return { 
        requiresApproval: false, 
        approvalCount: 0, 
        threshold: 0 
      };
    }

    try {
      const result = await db.query(`
        SELECT approval_count, requires_approval 
        FROM decision_patterns 
        WHERE id = $1
      `, [patternId]);

      if (result.rows.length === 0) {
        return { 
          requiresApproval: true, 
          approvalCount: 0, 
          threshold: this.approvalThreshold 
        };
      }

      const pattern = result.rows[0];
      const requiresApproval = pattern.requires_approval && 
                               pattern.approval_count < this.approvalThreshold;

      return {
        requiresApproval,
        approvalCount: pattern.approval_count || 0,
        threshold: this.approvalThreshold
      };
    } catch (error) {
      logger.error('[PatternSafety] Failed to check approval', error);
      return { 
        requiresApproval: true, 
        approvalCount: 0, 
        threshold: this.approvalThreshold 
      };
    }
  }

  /**
   * Record pattern usage and increment approval count
   */
  async recordPatternUsage(patternId: number, wasApproved: boolean): Promise<void> {
    try {
      if (wasApproved) {
        await db.query(`
          UPDATE decision_patterns 
          SET 
            approval_count = COALESCE(approval_count, 0) + 1,
            execution_count = COALESCE(execution_count, 0) + 1,
            last_used = NOW(),
            requires_approval = CASE 
              WHEN approval_count + 1 >= $2 THEN FALSE 
              ELSE requires_approval 
            END
          WHERE id = $1
        `, [patternId, this.approvalThreshold]);
      }
    } catch (error) {
      logger.error('[PatternSafety] Failed to record usage', error);
    }
  }

  /**
   * Check if enough examples exist to create a pattern
   */
  async checkMinimumExamples(patternSignature: string): Promise<boolean> {
    await this.loadConfig();
    
    try {
      const result = await db.query(`
        SELECT COUNT(*) as count 
        FROM pattern_learning_examples 
        WHERE pattern_signature = $1
      `, [patternSignature]);

      const count = parseInt(result.rows[0]?.count || '0');
      return count >= this.minExamplesRequired;
    } catch (error) {
      logger.error('[PatternSafety] Failed to check examples', error);
      return false;
    }
  }

  /**
   * Record a learning example
   */
  async recordLearningExample(
    patternSignature: string,
    customerMessage: string,
    operatorResponse: string,
    wasModified: boolean = false
  ): Promise<void> {
    try {
      // Calculate confidence based on whether operator modified
      const confidence = wasModified ? 0.3 : 0.7;
      
      await db.query(`
        INSERT INTO pattern_learning_examples (
          pattern_signature, customer_message, operator_response,
          confidence_score, was_modified, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        patternSignature,
        customerMessage,
        operatorResponse,
        confidence,
        wasModified
      ]);

      // Check if we have enough examples to create/update pattern
      if (await this.checkMinimumExamples(patternSignature)) {
        await this.createOrUpdatePattern(patternSignature);
      }
    } catch (error) {
      logger.error('[PatternSafety] Failed to record example', error);
    }
  }

  /**
   * Create or update a pattern based on accumulated examples
   */
  private async createOrUpdatePattern(patternSignature: string): Promise<void> {
    try {
      // Get all examples for this pattern
      const examplesResult = await db.query(`
        SELECT 
          operator_response,
          confidence_score,
          was_modified
        FROM pattern_learning_examples 
        WHERE pattern_signature = $1
        ORDER BY created_at DESC
        LIMIT 20
      `, [patternSignature]);

      if (examplesResult.rows.length < this.minExamplesRequired) {
        return;
      }

      // Calculate weighted confidence
      let totalWeight = 0;
      let weightedConfidence = 0;
      
      examplesResult.rows.forEach(ex => {
        const weight = ex.was_modified ? this.operatorOverrideWeight : 1.0;
        totalWeight += weight;
        weightedConfidence += ex.confidence_score * weight;
      });

      const finalConfidence = weightedConfidence / totalWeight;
      
      // Use most recent response as template
      const responseTemplate = examplesResult.rows[0].operator_response;

      // Check if pattern exists
      const existingPattern = await db.query(`
        SELECT id FROM decision_patterns 
        WHERE pattern_signature = $1
      `, [patternSignature]);

      if (existingPattern.rows.length > 0) {
        // Update existing pattern
        await db.query(`
          UPDATE decision_patterns 
          SET 
            response_template = $2,
            confidence_score = $3,
            updated_at = NOW()
          WHERE id = $1
        `, [existingPattern.rows[0].id, responseTemplate, finalConfidence]);
        
        logger.info('[PatternSafety] Pattern updated', { 
          patternSignature, 
          confidence: finalConfidence 
        });
      } else {
        // Create new pattern
        await db.query(`
          INSERT INTO decision_patterns (
            pattern_signature,
            pattern_type,
            trigger_text,
            response_template,
            confidence_score,
            is_active,
            auto_executable,
            requires_approval,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        `, [
          patternSignature,
          'learned',
          patternSignature, // Use signature as trigger for now
          responseTemplate,
          finalConfidence,
          true,
          false, // Don't auto-execute new patterns
          true   // Require approval for new patterns
        ]);
        
        logger.info('[PatternSafety] New pattern created', { 
          patternSignature, 
          confidence: finalConfidence 
        });
      }
    } catch (error) {
      logger.error('[PatternSafety] Failed to create/update pattern', error);
    }
  }

  /**
   * Get safety settings for API
   */
  async getSettings(): Promise<any> {
    // Force reload to get latest from database
    this.lastConfigLoad = new Date(0);
    await this.loadConfig();
    
    return {
      blacklistTopics: this.blacklistTopics || [],
      escalationKeywords: this.escalationKeywords || [],
      requireApprovalForNew: this.requireApprovalForNew !== undefined ? this.requireApprovalForNew : true,
      approvalThreshold: this.approvalThreshold || 10,
      minExamplesRequired: this.minExamplesRequired || 5,
      operatorOverrideWeight: this.operatorOverrideWeight || 2.0,
      enableFallbackResponses: false,
      fallbackMessages: {
        booking: '',
        emergency: '',
        techSupport: '',
        brandTone: '',
        general: ''
      }
    };
  }

  /**
   * Update safety settings
   */
  async updateSettings(settings: any): Promise<void> {
    const updates = [
      { key: 'blacklist_topics', value: settings.blacklistTopics?.join(',') },
      { key: 'escalation_keywords', value: settings.escalationKeywords?.join(',') },
      { key: 'require_approval_for_new', value: String(settings.requireApprovalForNew) },
      { key: 'approval_threshold', value: String(settings.approvalThreshold) },
      { key: 'min_examples_required', value: String(settings.minExamplesRequired) },
      { key: 'operator_override_weight', value: String(settings.operatorOverrideWeight) }
    ];

    for (const update of updates) {
      if (update.value !== undefined) {
        // Use UPSERT to handle missing config rows
        await db.query(`
          INSERT INTO pattern_learning_config (config_key, config_value, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (config_key) 
          DO UPDATE SET config_value = $2, updated_at = NOW()
        `, [update.key, update.value]);
      }
    }

    // Clear cache to force reload
    this.lastConfigLoad = new Date(0);
    await this.loadConfig();
  }
}

export const patternSafetyService = new PatternSafetyService();