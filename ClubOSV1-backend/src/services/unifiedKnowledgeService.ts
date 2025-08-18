/**
 * Unified Knowledge Service
 * Single source of truth for all knowledge queries
 * Handles SOPs, customer conversations, manual entries, etc.
 */

import { db } from '../utils/database';
import { logger } from '../utils/logger';

export interface KnowledgeSource {
  type: 'sop' | 'manual' | 'customer_conversation' | 'openphone' | 'assistant_knowledge';
  confidence_modifier: number;
  description: string;
}

export const KNOWLEDGE_SOURCES: Record<string, KnowledgeSource> = {
  sop: {
    type: 'sop',
    confidence_modifier: 1.0, // Official procedures - highest confidence
    description: 'Official Standard Operating Procedure'
  },
  manual: {
    type: 'manual',
    confidence_modifier: 0.95, // Admin entered - very high confidence
    description: 'Manually entered by administrator'
  },
  assistant_knowledge: {
    type: 'assistant_knowledge',
    confidence_modifier: 0.9, // Uploaded knowledge files
    description: 'Assistant knowledge file'
  },
  customer_conversation: {
    type: 'customer_conversation',
    confidence_modifier: 0.7, // Extracted and validated
    description: 'Learned from customer interaction'
  },
  openphone: {
    type: 'openphone',
    confidence_modifier: 0.6, // Auto-extracted, needs validation
    description: 'Extracted from phone conversation'
  }
};

export class UnifiedKnowledgeService {
  /**
   * Search all knowledge with source-aware confidence scoring
   */
  async searchKnowledge(
    query: string,
    options: {
      minConfidence?: number;
      sourceTypes?: string[];
      category?: string;
      limit?: number;
      includeUnvalidated?: boolean;
    } = {}
  ) {
    const {
      minConfidence = 0.3,
      sourceTypes,
      category,
      limit = 10,
      includeUnvalidated = false
    } = options;

    try {
      let sql = `
        SELECT 
          key,
          value,
          confidence,
          source_type,
          source_table,
          validation_status,
          category,
          created_at,
          updated_at,
          ts_rank(search_vector, plainto_tsquery('english', $1)) as relevance
        FROM knowledge_store
        WHERE 
          search_vector @@ plainto_tsquery('english', $1)
          AND superseded_by IS NULL
          AND confidence >= $2
      `;

      const params: any[] = [query, minConfidence];

      // Filter by validation status
      if (!includeUnvalidated) {
        sql += ` AND (validation_status != 'pending' OR validation_status IS NULL)`;
      }

      // Filter by source types
      if (sourceTypes && sourceTypes.length > 0) {
        sql += ` AND source_type = ANY($${params.length + 1})`;
        params.push(sourceTypes);
      }

      // Filter by category
      if (category) {
        sql += ` AND category = $${params.length + 1}`;
        params.push(category);
      }

      sql += `
        ORDER BY 
          (confidence * ts_rank(search_vector, plainto_tsquery('english', $1))) DESC
        LIMIT $${params.length + 1}
      `;
      params.push(limit);

      const result = await db.query(sql, params);

      // Apply source-based confidence modifiers
      const enhancedResults = result.rows.map((row: any) => {
        const source = KNOWLEDGE_SOURCES[row.source_type] || KNOWLEDGE_SOURCES.manual;
        const adjustedConfidence = row.confidence * source.confidence_modifier;
        
        return {
          ...row,
          adjustedConfidence,
          combinedScore: adjustedConfidence * row.relevance,
          sourceDescription: source.description
        };
      });

      logger.info('📚 Unified knowledge search', {
        query,
        resultsFound: enhancedResults.length,
        topResult: enhancedResults[0] ? {
          key: enhancedResults[0].key,
          source: enhancedResults[0].source_type,
          score: enhancedResults[0].combinedScore
        } : null
      });

      return enhancedResults;

    } catch (error) {
      logger.error('Error in unified knowledge search:', error);
      return [];
    }
  }

  /**
   * Add knowledge from OpenPhone conversation
   */
  async addFromConversation(
    conversationId: string,
    messages: any[],
    extractedFacts: Array<{
      key: string;
      content: string;
      confidence: number;
      category?: string;
    }>
  ) {
    try {
      const addedCount = await db.query(
        `SELECT extract_knowledge_from_conversation($1, $2, $3)`,
        [conversationId, JSON.stringify(messages), JSON.stringify(extractedFacts)]
      );

      logger.info('📱 Added knowledge from conversation', {
        conversationId,
        factsExtracted: extractedFacts.length
      });

      return { success: true, count: extractedFacts.length };
    } catch (error) {
      logger.error('Error adding knowledge from conversation:', error);
      return { success: false, error };
    }
  }

  /**
   * Validate pending knowledge
   */
  async validateKnowledge(key: string, validatedBy: string, approved: boolean) {
    try {
      if (approved) {
        // Approve and increase confidence
        await db.query(`
          UPDATE knowledge_store 
          SET 
            validation_status = 'approved',
            validated_by = $2,
            validated_at = NOW(),
            confidence = LEAST(confidence * 1.2, 0.95)
          WHERE key = $1 AND superseded_by IS NULL
        `, [key, validatedBy]);
      } else {
        // Reject - mark as superseded
        await db.query(`
          UPDATE knowledge_store 
          SET 
            validation_status = 'rejected',
            validated_by = $2,
            validated_at = NOW(),
            superseded_by = 'rejected'
          WHERE key = $1 AND superseded_by IS NULL
        `, [key, validatedBy]);
      }

      logger.info('✅ Knowledge validated', { key, approved, validatedBy });
      return { success: true };

    } catch (error) {
      logger.error('Error validating knowledge:', error);
      return { success: false, error };
    }
  }

  /**
   * Get knowledge statistics
   */
  async getStatistics() {
    try {
      const stats = await db.query(`
        SELECT 
          source_type,
          COUNT(*) as count,
          AVG(confidence) as avg_confidence,
          COUNT(CASE WHEN validation_status = 'pending' THEN 1 END) as pending_validation
        FROM knowledge_store
        WHERE superseded_by IS NULL
        GROUP BY source_type
      `);

      const total = await db.query(`
        SELECT 
          COUNT(*) as total_items,
          COUNT(DISTINCT category) as categories
        FROM knowledge_store
        WHERE superseded_by IS NULL
      `);

      return {
        bySource: stats.rows,
        total: total.rows[0]
      };

    } catch (error) {
      logger.error('Error getting knowledge statistics:', error);
      return null;
    }
  }
}

export const unifiedKnowledgeService = new UnifiedKnowledgeService();