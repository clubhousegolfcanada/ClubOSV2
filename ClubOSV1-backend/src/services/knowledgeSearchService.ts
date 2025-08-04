import { db } from '../utils/database';
import { logger } from '../utils/logger';

interface KnowledgeSearchResult {
  found: boolean;
  source: 'database' | 'assistant' | 'none';
  data?: any;
  confidence: number;
}

export class KnowledgeSearchService {
  /**
   * Search for knowledge in our database before hitting OpenAI
   */
  async searchKnowledge(
    query: string,
    category?: string
  ): Promise<KnowledgeSearchResult> {
    if (!db.initialized) {
      return { found: false, source: 'none', confidence: 0 };
    }

    try {
      // Search in knowledge_audit_log for recent updates
      const searchTerms = this.extractKeyTerms(query);
      
      let sql = `
        SELECT * FROM knowledge_audit_log
        WHERE (
          LOWER(new_value) LIKE ANY($1) OR
          LOWER(key) LIKE ANY($1) OR
          LOWER(category) LIKE ANY($1)
        )
      `;
      
      const params: any[] = [searchTerms.map(term => `%${term.toLowerCase()}%`)];
      
      if (category) {
        sql += ` AND assistant_target = $2`;
        params.push(category);
      }
      
      sql += ` ORDER BY timestamp DESC LIMIT 5`;
      
      const result = await db.query(sql, params);
      
      if (result.rows.length > 0) {
        // Found in database - return the most recent match
        const match = result.rows[0];
        
        logger.info('Knowledge found in database', {
          query,
          matchedKey: match.key,
          category: match.category
        });
        
        return {
          found: true,
          source: 'database',
          data: {
            answer: match.new_value,
            category: match.category,
            lastUpdated: match.timestamp,
            confidence: this.calculateConfidence(query, match)
          },
          confidence: this.calculateConfidence(query, match)
        };
      }
      
      // Also check extracted_knowledge table if it exists
      try {
        const extractedResult = await db.query(`
          SELECT * FROM extracted_knowledge
          WHERE (
            LOWER(problem) LIKE ANY($1) OR
            LOWER(solution) LIKE ANY($1)
          ) AND applied_to_sop = false
          ORDER BY confidence DESC
          LIMIT 5
        `, [searchTerms.map(term => `%${term.toLowerCase()}%`)]);
        
        if (extractedResult.rows.length > 0) {
          const match = extractedResult.rows[0];
          return {
            found: true,
            source: 'database',
            data: {
              answer: match.solution,
              problem: match.problem,
              category: match.category,
              confidence: match.confidence
            },
            confidence: match.confidence
          };
        }
      } catch (error) {
        // Table might not exist, that's okay
      }
      
      return { found: false, source: 'none', confidence: 0 };
    } catch (error) {
      logger.error('Knowledge search error:', error);
      return { found: false, source: 'none', confidence: 0 };
    }
  }

  /**
   * Extract key terms from a query for searching
   */
  private extractKeyTerms(query: string): string[] {
    // Remove common words and extract meaningful terms
    const stopWords = new Set([
      'what', 'is', 'the', 'a', 'an', 'how', 'do', 'i', 'can', 
      'where', 'when', 'why', 'which', 'to', 'for', 'of', 'in',
      'we', 'you', 'are', 'there', 'any', 'does', 'have'
    ]);
    
    const words = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
    
    // Add variations for common terms
    const variations: string[] = [];
    words.forEach(word => {
      // Handle gift card variations
      if (word === 'giftcard' || word === 'giftcards') {
        variations.push('gift', 'card', 'gift card', 'giftcard');
      } else if (word === 'gift' || word === 'card') {
        variations.push('gift', 'card', 'gift card', 'giftcard');
      }
      // Handle purchase variations
      else if (word === 'buy' || word === 'purchase' || word === 'get') {
        variations.push('buy', 'purchase', 'sell', 'available', 'offer');
      }
    });
    
    // Combine all terms
    const allTerms = [...words, ...variations];
    
    // Also include the full query for exact matches
    if (query.length < 50) {
      allTerms.push(query.toLowerCase());
    }
    
    return [...new Set(allTerms)];
  }

  /**
   * Calculate confidence score for a match
   */
  private calculateConfidence(query: string, match: any): number {
    const queryLower = query.toLowerCase();
    const valueLower = (match.new_value || match.solution || '').toLowerCase();
    const keyLower = (match.key || '').toLowerCase();
    const categoryLower = (match.category || '').toLowerCase();
    
    // Exact match
    if (valueLower.includes(queryLower) || keyLower === queryLower) {
      return 0.95;
    }
    
    // Check for semantic matches
    let score = 0;
    
    // Gift card specific matching
    const giftCardPatterns = ['gift card', 'giftcard', 'gift certificate', 'voucher'];
    const hasGiftCardQuery = giftCardPatterns.some(pattern => queryLower.includes(pattern));
    const hasGiftCardMatch = giftCardPatterns.some(pattern => 
      valueLower.includes(pattern) || keyLower.includes(pattern) || categoryLower.includes(pattern)
    );
    
    if (hasGiftCardQuery && hasGiftCardMatch) {
      score = 0.85; // High confidence for gift card matches
    }
    
    // Key term matching
    const terms = this.extractKeyTerms(query);
    const foundTerms = terms.filter(term => 
      valueLower.includes(term) || keyLower.includes(term) || categoryLower.includes(term)
    );
    
    // Calculate term match ratio
    const termMatchRatio = terms.length > 0 ? foundTerms.length / terms.length : 0;
    
    // Use the higher of semantic score or term match score
    return Math.max(score, Math.min(0.9, termMatchRatio * 1.2)); // Boost by 20% to be more forgiving
  }

  /**
   * Get recent knowledge updates for context
   */
  async getRecentContext(
    category: string,
    limit: number = 10
  ): Promise<any[]> {
    if (!db.initialized) return [];

    try {
      const result = await db.query(`
        SELECT 
          category,
          key,
          new_value,
          timestamp
        FROM knowledge_audit_log
        WHERE assistant_target = $1
        ORDER BY timestamp DESC
        LIMIT $2
      `, [category, limit]);
      
      return result.rows;
    } catch (error) {
      logger.error('Failed to get recent context:', error);
      return [];
    }
  }

  /**
   * Build context string for assistant
   */
  async buildContextForAssistant(
    category: string
  ): Promise<string> {
    const recentUpdates = await this.getRecentContext(category, 20);
    
    if (recentUpdates.length === 0) {
      return '';
    }
    
    let context = '\n\nRECENT KNOWLEDGE UPDATES:\n';
    
    for (const update of recentUpdates) {
      context += `- ${update.category}: ${update.key || 'General'} = ${update.new_value}\n`;
    }
    
    return context;
  }
}

// Export singleton
export const knowledgeSearchService = new KnowledgeSearchService();