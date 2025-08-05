import { db } from '../utils/database';
import { logger } from '../utils/logger';

interface SearchResult {
  found: boolean;
  source: string;
  data?: any;
  confidence: number;
}

export class ImprovedKnowledgeSearchService {
  /**
   * Enhanced search with fuzzy matching and semantic understanding
   */
  async searchKnowledge(query: string, category?: string): Promise<SearchResult> {
    if (!db.initialized) {
      return { found: false, source: 'none', confidence: 0 };
    }

    try {
      // 1. Extract semantic concepts from query
      const concepts = this.extractSemanticConcepts(query);
      
      // 2. Build flexible search query with multiple strategies
      const searchStrategies = [
        // Strategy 1: Full-text search with stemming
        this.buildFullTextSearch(query, concepts),
        
        // Strategy 2: Synonym matching
        this.buildSynonymSearch(concepts),
        
        // Strategy 3: Fuzzy matching for typos
        this.buildFuzzySearch(query, concepts)
      ];

      // 3. Execute searches and combine results
      const results = await Promise.all(
        searchStrategies.map(strategy => this.executeSearch(strategy, category))
      );

      // 4. Score and rank results
      const scoredResults = this.scoreResults(results, query, concepts);
      
      // 5. Return best match if confidence is high enough
      if (scoredResults.length > 0 && scoredResults[0].confidence > 0.5) {
        const bestMatch = scoredResults[0];
        
        logger.info('Knowledge found with improved search', {
          query,
          confidence: bestMatch.confidence,
          matchType: bestMatch.matchType
        });
        
        return {
          found: true,
          source: 'database',
          data: {
            answer: bestMatch.new_value,
            category: bestMatch.category,
            lastUpdated: bestMatch.timestamp,
            confidence: bestMatch.confidence
          },
          confidence: bestMatch.confidence
        };
      }

      // 6. Fall back to vector similarity search if available
      const vectorResult = await this.vectorSimilaritySearch(query, category);
      if (vectorResult.found) {
        return vectorResult;
      }

      return { found: false, source: 'none', confidence: 0 };
    } catch (error) {
      logger.error('Improved knowledge search error:', error);
      return { found: false, source: 'none', confidence: 0 };
    }
  }

  /**
   * Extract semantic concepts and intent from query
   */
  private extractSemanticConcepts(query: string): string[] {
    const concepts: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Gift card related concepts
    if (lowerQuery.match(/gift\s*card|giftcard|gift\s*certificate|present|voucher/i)) {
      concepts.push('gift_card', 'gift', 'card', 'purchase', 'buy', 'voucher', 'certificate');
    }

    // Purchase/buying concepts
    if (lowerQuery.match(/buy|purchase|get|order|how\s+to|where|sell/i)) {
      concepts.push('purchase', 'buy', 'acquire', 'order', 'obtain', 'sell', 'available');
    }

    // Question concepts
    if (lowerQuery.match(/do\s+you|can\s+i|is\s+it|are\s+there|where\s+can/i)) {
      concepts.push('inquiry', 'question', 'availability', 'information');
    }

    // Also include original terms
    const words = this.extractKeyTerms(query);
    concepts.push(...words);

    return [...new Set(concepts)]; // Remove duplicates
  }

  /**
   * Build full-text search query
   */
  private buildFullTextSearch(query: string, concepts: string[]): any {
    return {
      type: 'fulltext',
      sql: `
        SELECT *, 
               ts_rank(
                 to_tsvector('english', COALESCE(new_value, '') || ' ' || COALESCE(key, '') || ' ' || COALESCE(category, '')),
                 plainto_tsquery('english', $1)
               ) as rank
        FROM knowledge_audit_log
        WHERE to_tsvector('english', COALESCE(new_value, '') || ' ' || COALESCE(key, '') || ' ' || COALESCE(category, ''))
              @@ plainto_tsquery('english', $1)
        ORDER BY rank DESC
        LIMIT 10
      `,
      params: [concepts.join(' ')]
    };
  }

  /**
   * Build synonym-based search
   */
  private buildSynonymSearch(concepts: string[]): any {
    const synonymGroups = {
      gift_card: ['gift card', 'giftcard', 'gift certificate', 'voucher', 'gift voucher', 'present card'],
      purchase: ['buy', 'purchase', 'get', 'acquire', 'order', 'obtain'],
      availability: ['available', 'sell', 'offer', 'have', 'stock']
    };

    const expandedTerms: string[] = [];
    concepts.forEach(concept => {
      if (synonymGroups[concept]) {
        expandedTerms.push(...synonymGroups[concept]);
      } else {
        expandedTerms.push(concept);
      }
    });

    return {
      type: 'synonym',
      sql: `
        SELECT * FROM knowledge_audit_log
        WHERE (
          ${expandedTerms.map((_, i) => `LOWER(new_value) LIKE $${i + 1}`).join(' OR ')} OR
          ${expandedTerms.map((_, i) => `LOWER(key) LIKE $${i + 1}`).join(' OR ')} OR
          ${expandedTerms.map((_, i) => `LOWER(category) LIKE $${i + 1}`).join(' OR ')}
        )
        ORDER BY timestamp DESC
        LIMIT 10
      `,
      params: expandedTerms.map(term => `%${term.toLowerCase()}%`)
    };
  }

  /**
   * Build fuzzy search for typos
   */
  private buildFuzzySearch(query: string, concepts: string[]): any {
    return {
      type: 'fuzzy',
      sql: `
        SELECT *,
               LEAST(
                 levenshtein(LOWER(new_value), LOWER($1)),
                 levenshtein(LOWER(key), LOWER($1)),
                 levenshtein(LOWER(category), LOWER($1))
               ) as distance
        FROM knowledge_audit_log
        WHERE LEAST(
          levenshtein(LOWER(new_value), LOWER($1)),
          levenshtein(LOWER(key), LOWER($1)),
          levenshtein(LOWER(category), LOWER($1))
        ) <= 5
        ORDER BY distance ASC
        LIMIT 10
      `,
      params: [query]
    };
  }

  /**
   * Execute a search strategy
   */
  private async executeSearch(strategy: any, category?: string): Promise<any[]> {
    try {
      let { sql, params } = strategy;
      
      if (category) {
        // Handle route name variations (e.g., 'Booking & Access' vs 'booking')
        const categoryVariations = this.getCategoryVariations(category);
        sql += ` AND assistant_target = ANY($${params.length + 1})`;
        params.push(categoryVariations);
      }

      const result = await db.query(sql, params);
      return result.rows.map(row => ({ ...row, matchType: strategy.type }));
    } catch (error) {
      // Some strategies might fail (e.g., if extensions aren't installed)
      logger.debug(`Search strategy ${strategy.type} failed:`, error);
      return [];
    }
  }

  /**
   * Score and rank results based on relevance
   */
  private scoreResults(results: any[][], query: string, concepts: string[]): any[] {
    const allResults = results.flat();
    const queryLower = query.toLowerCase();

    return allResults
      .map(result => {
        let score = 0;
        const valueLower = (result.new_value || '').toLowerCase();
        const keyLower = (result.key || '').toLowerCase();

        // Exact match bonus
        if (valueLower.includes(queryLower)) score += 0.5;
        if (keyLower === queryLower) score += 0.5;

        // Concept match scoring
        concepts.forEach(concept => {
          if (valueLower.includes(concept)) score += 0.2;
          if (keyLower.includes(concept)) score += 0.3;
        });

        // Match type scoring
        if (result.matchType === 'fulltext' && result.rank) {
          score += result.rank * 0.5;
        }

        // Recency bonus
        const daysSinceUpdate = (Date.now() - new Date(result.timestamp).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 7) score += 0.1;

        return { ...result, confidence: Math.min(1, score) };
      })
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Vector similarity search using embeddings (requires pg_vector extension)
   */
  private async vectorSimilaritySearch(query: string, category?: string): Promise<SearchResult> {
    // This would require:
    // 1. Generate embedding for query using OpenAI
    // 2. Search using cosine similarity in pg_vector
    // For now, return not found
    return { found: false, source: 'none', confidence: 0 };
  }

  /**
   * Get category variations to handle different naming conventions
   */
  private getCategoryVariations(category: string): string[] {
    const variations: string[] = [category];
    const lowerCategory = category.toLowerCase();
    
    // Add base category
    variations.push(lowerCategory);
    
    // Handle specific route variations
    if (lowerCategory === 'booking & access') {
      variations.push('booking', 'access', 'booking_access');
    } else if (lowerCategory === 'techsupport') {
      variations.push('tech', 'tech_support', 'technical');
    } else if (lowerCategory === 'brandtone') {
      variations.push('brand', 'marketing', 'brand_tone');
    } else if (lowerCategory === 'emergency') {
      variations.push('urgent', 'safety');
    }
    
    return [...new Set(variations)];
  }

  /**
   * Extract key terms from query (existing method)
   */
  private extractKeyTerms(query: string): string[] {
    const stopWords = new Set([
      'what', 'is', 'the', 'a', 'an', 'how', 'do', 'i', 'can', 
      'where', 'when', 'why', 'which', 'to', 'for', 'of', 'in',
      'we', 'you', 'are', 'there', 'any', 'does', 'have'
    ]);
    
    const words = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
    
    return [...new Set(words)];
  }
}

export const improvedKnowledgeSearch = new ImprovedKnowledgeSearchService();