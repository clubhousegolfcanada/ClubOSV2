/**
 * Unified Knowledge Search Service
 * Searches across all knowledge tables in priority order
 */

import { query } from '../utils/db';
import { logger } from '../utils/logger';

export interface KnowledgeSearchResult {
  found: boolean;
  source: 'assistant_knowledge' | 'audit_log' | 'extracted' | 'static' | 'none';
  answer: string;
  confidence: number;
  metadata?: {
    category?: string;
    lastUpdated?: Date;
    sourceId?: string;
    assistant?: string;
  };
}

export class UnifiedKnowledgeSearchService {
  /**
   * Main search function - checks all knowledge sources
   */
  async search(searchQuery: string, options?: {
    category?: string;
    minConfidence?: number;
    assistantType?: string;
  }): Promise<KnowledgeSearchResult> {
    const minConfidence = options?.minConfidence || 0.5;
    
    logger.info('Unified knowledge search', { 
      query: searchQuery.substring(0, 100),
      category: options?.category,
      minConfidence 
    });

    // Extract search terms
    const searchTerms = this.extractSearchTerms(searchQuery);
    
    // 1. First check assistant_knowledge (highest priority - manually added)
    const assistantResult = await this.searchAssistantKnowledge(searchTerms, options);
    if (assistantResult.found && assistantResult.confidence >= minConfidence) {
      logger.info('Found in assistant_knowledge', { confidence: assistantResult.confidence });
      return assistantResult;
    }

    // 2. Check knowledge_audit_log (recent updates)
    const auditResult = await this.searchAuditLog(searchTerms, options);
    if (auditResult.found && auditResult.confidence >= minConfidence) {
      logger.info('Found in knowledge_audit_log', { confidence: auditResult.confidence });
      return auditResult;
    }

    // 3. Check extracted_knowledge (from conversations)
    const extractedResult = await this.searchExtractedKnowledge(searchTerms, options);
    if (extractedResult.found && extractedResult.confidence >= minConfidence) {
      logger.info('Found in extracted_knowledge', { confidence: extractedResult.confidence });
      return extractedResult;
    }

    // 4. Check static knowledge files (fallback)
    const staticResult = await this.searchStaticKnowledge(searchQuery, options);
    if (staticResult.found && staticResult.confidence >= minConfidence) {
      logger.info('Found in static knowledge', { confidence: staticResult.confidence });
      return staticResult;
    }

    // No results found
    logger.info('No knowledge found locally');
    return {
      found: false,
      source: 'none',
      answer: '',
      confidence: 0
    };
  }

  /**
   * Search assistant_knowledge table
   */
  private async searchAssistantKnowledge(
    searchTerms: string[], 
    options?: any
  ): Promise<KnowledgeSearchResult> {
    try {
      const searchPatterns = searchTerms.map(term => `%${term.toLowerCase()}%`);
      
      let sql = `
        SELECT 
          assistant_id,
          route,
          knowledge,
          updated_at
        FROM assistant_knowledge
        WHERE (
          LOWER(knowledge::text) LIKE ANY($1)
        )
      `;
      
      const params: any[] = [searchPatterns];
      
      if (options?.assistantType) {
        sql += ` AND LOWER(route) = LOWER($2)`;
        params.push(options.assistantType);
      }
      
      sql += ` ORDER BY updated_at DESC LIMIT 1`;
      
      const result = await query(sql, params);
      
      if (result.rows.length > 0) {
        const row = result.rows[0];
        const knowledge = row.knowledge;
        
        // Extract answer from knowledge JSON
        let answer = '';
        if (typeof knowledge === 'object') {
          answer = knowledge.fact || knowledge.value || knowledge.content || JSON.stringify(knowledge);
        } else {
          answer = String(knowledge);
        }
        
        return {
          found: true,
          source: 'assistant_knowledge',
          answer,
          confidence: this.calculateConfidence(searchTerms, answer),
          metadata: {
            assistant: row.route,
            lastUpdated: row.updated_at
          }
        };
      }
    } catch (error) {
      logger.error('Error searching assistant_knowledge:', error);
    }
    
    return { found: false, source: 'none', answer: '', confidence: 0 };
  }

  /**
   * Search knowledge_audit_log table
   */
  private async searchAuditLog(
    searchTerms: string[], 
    options?: any
  ): Promise<KnowledgeSearchResult> {
    try {
      const searchPatterns = searchTerms.map(term => `%${term.toLowerCase()}%`);
      
      let sql = `
        SELECT 
          new_value,
          category,
          assistant_target,
          timestamp
        FROM knowledge_audit_log
        WHERE (
          LOWER(new_value) LIKE ANY($1) OR
          LOWER(key) LIKE ANY($1) OR
          LOWER(category) LIKE ANY($1)
        )
      `;
      
      const params: any[] = [searchPatterns];
      
      if (options?.category) {
        sql += ` AND LOWER(assistant_target) = LOWER($2)`;
        params.push(options.category);
      }
      
      sql += ` ORDER BY timestamp DESC LIMIT 1`;
      
      const result = await query(sql, params);
      
      if (result.rows.length > 0) {
        const row = result.rows[0];
        
        return {
          found: true,
          source: 'audit_log',
          answer: row.new_value,
          confidence: this.calculateConfidence(searchTerms, row.new_value),
          metadata: {
            category: row.category,
            assistant: row.assistant_target,
            lastUpdated: row.timestamp
          }
        };
      }
    } catch (error) {
      logger.error('Error searching knowledge_audit_log:', error);
    }
    
    return { found: false, source: 'none', answer: '', confidence: 0 };
  }

  /**
   * Search extracted_knowledge table
   */
  private async searchExtractedKnowledge(
    searchTerms: string[], 
    options?: any
  ): Promise<KnowledgeSearchResult> {
    try {
      const searchPatterns = searchTerms.map(term => `%${term.toLowerCase()}%`);
      
      let sql = `
        SELECT 
          problem,
          solution,
          category,
          confidence,
          created_at
        FROM extracted_knowledge
        WHERE (
          LOWER(problem) LIKE ANY($1) OR
          LOWER(solution) LIKE ANY($1)
        )
      `;
      
      const params: any[] = [searchPatterns];
      
      if (options?.category) {
        sql += ` AND LOWER(category) = LOWER($2)`;
        params.push(options.category);
      }
      
      sql += ` ORDER BY confidence DESC, created_at DESC LIMIT 1`;
      
      const result = await query(sql, params);
      
      if (result.rows.length > 0) {
        const row = result.rows[0];
        
        return {
          found: true,
          source: 'extracted',
          answer: row.solution,
          confidence: row.confidence || this.calculateConfidence(searchTerms, row.solution),
          metadata: {
            category: row.category,
            lastUpdated: row.created_at
          }
        };
      }
    } catch (error) {
      logger.error('Error searching extracted_knowledge:', error);
    }
    
    return { found: false, source: 'none', answer: '', confidence: 0 };
  }

  /**
   * Search static knowledge files (JSON knowledge bases)
   */
  private async searchStaticKnowledge(
    searchQuery: string,
    options?: any
  ): Promise<KnowledgeSearchResult> {
    try {
      // Import knowledge loader
      const { knowledgeLoader } = await import('../knowledge-base/knowledgeLoader');
      const knowledgeBases = knowledgeLoader.getAllKnowledge();
      
      const searchTerms = this.extractSearchTerms(searchQuery);
      let bestMatch: KnowledgeSearchResult = { 
        found: false, 
        source: 'none', 
        answer: '', 
        confidence: 0 
      };
      
      // Search through all knowledge bases
      for (const [category, knowledge] of Object.entries(knowledgeBases)) {
        if (options?.category && category !== options.category) continue;
        
        // Search in each knowledge item
        if (Array.isArray(knowledge)) {
          for (const item of knowledge) {
            const itemText = JSON.stringify(item).toLowerCase();
            const matchCount = searchTerms.filter(term => 
              itemText.includes(term.toLowerCase())
            ).length;
            
            if (matchCount > 0) {
              const confidence = matchCount / searchTerms.length;
              
              if (confidence > bestMatch.confidence) {
                // Extract answer from item
                let answer = '';
                if (typeof item === 'object') {
                  answer = item.answer || item.solution || item.response || item.content || JSON.stringify(item);
                } else {
                  answer = String(item);
                }
                
                bestMatch = {
                  found: true,
                  source: 'static',
                  answer,
                  confidence,
                  metadata: { category }
                };
              }
            }
          }
        }
      }
      
      return bestMatch;
    } catch (error) {
      logger.error('Error searching static knowledge:', error);
      return { found: false, source: 'none', answer: '', confidence: 0 };
    }
  }

  /**
   * Extract meaningful search terms from query
   */
  private extractSearchTerms(query: string): string[] {
    // Remove common stop words
    const stopWords = new Set([
      'what', 'is', 'the', 'a', 'an', 'how', 'do', 'i', 'can',
      'where', 'when', 'why', 'which', 'to', 'for', 'of', 'in',
      'we', 'you', 'are', 'there', 'any', 'does', 'have', 'get',
      'buy', 'purchase'
    ]);
    
    // Extract words
    const words = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
    
    // Add special handling for common terms
    const specialTerms: string[] = [];
    
    // Gift card variations
    if (query.toLowerCase().includes('gift') || query.toLowerCase().includes('card')) {
      specialTerms.push('gift', 'card', 'giftcard', 'gift card', 'gift-card');
    }
    
    // Trackman variations
    if (query.toLowerCase().includes('track') || query.toLowerCase().includes('man')) {
      specialTerms.push('trackman', 'track man', 'simulator', 'frozen', 'reset');
    }
    
    // Hours variations
    if (query.toLowerCase().includes('hour') || query.toLowerCase().includes('open')) {
      specialTerms.push('hours', 'open', 'close', 'schedule', 'time');
    }
    
    // Combine all terms
    const allTerms = [...new Set([...words, ...specialTerms])];
    
    // Also include the full query if it's short
    if (query.length < 50) {
      allTerms.push(query.toLowerCase());
    }
    
    return allTerms;
  }

  /**
   * Calculate confidence score for a match
   */
  private calculateConfidence(searchTerms: string[], content: string): number {
    if (!content) return 0;
    
    const lowerContent = content.toLowerCase();
    let matchCount = 0;
    let exactMatches = 0;
    
    for (const term of searchTerms) {
      if (lowerContent.includes(term.toLowerCase())) {
        matchCount++;
        
        // Check for exact word match (not just substring)
        const regex = new RegExp(`\\b${term}\\b`, 'i');
        if (regex.test(content)) {
          exactMatches++;
        }
      }
    }
    
    // Calculate base confidence
    const baseConfidence = matchCount / searchTerms.length;
    
    // Boost for exact matches
    const exactBoost = (exactMatches / searchTerms.length) * 0.3;
    
    // Length penalty for very short content
    const lengthPenalty = content.length < 20 ? -0.2 : 0;
    
    // Calculate final confidence
    const confidence = Math.min(1, Math.max(0, baseConfidence + exactBoost + lengthPenalty));
    
    return confidence;
  }
}

// Export singleton instance
export const unifiedKnowledgeSearch = new UnifiedKnowledgeSearchService();