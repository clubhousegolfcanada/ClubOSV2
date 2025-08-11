import { db } from '../utils/database';
import { logger } from '../utils/logger';

interface SearchResult {
  key: string;
  value: any;
  confidence: number;
  relevance: number;
  source: string;
}

export class KnowledgeSearchService {
  /**
   * Search for knowledge across all knowledge tables
   * Priority order:
   * 1. knowledge_store (AI-parsed, searchable)
   * 2. assistant_knowledge (manually uploaded)
   * 3. extracted_knowledge (from conversations)
   */
  async searchKnowledge(
    query: string,
    assistantType?: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    try {
      // 1. Search knowledge_store with full-text search
      const knowledgeStoreResults = await this.searchKnowledgeStore(query, assistantType, limit);
      results.push(...knowledgeStoreResults);

      // If we don't have enough results, search other tables
      if (results.length < limit) {
        // 2. Search assistant_knowledge
        const assistantResults = await this.searchAssistantKnowledge(query, assistantType, limit - results.length);
        results.push(...assistantResults);
      }

      if (results.length < limit) {
        // 3. Search extracted_knowledge
        const extractedResults = await this.searchExtractedKnowledge(query, limit - results.length);
        results.push(...extractedResults);
      }

      // Sort by relevance and confidence
      results.sort((a, b) => {
        const scoreA = a.relevance * a.confidence;
        const scoreB = b.relevance * b.confidence;
        return scoreB - scoreA;
      });

      // Log search for analytics
      await this.logSearch(query, results.length > 0);

      return results.slice(0, limit);
    } catch (error) {
      logger.error('Knowledge search error:', error);
      return [];
    }
  }

  /**
   * Search the knowledge_store table using full-text search
   */
  private async searchKnowledgeStore(query: string, assistantType: string | undefined, limit: number): Promise<SearchResult[]> {
    if (!db.initialized) return [];

    try {
      // Build the search query
      const searchQuery = query.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
      
      let sql = `
        SELECT 
          key,
          value,
          confidence,
          ts_rank(search_vector, plainto_tsquery('english', $1)) as relevance
        FROM knowledge_store
        WHERE 
          search_vector @@ plainto_tsquery('english', $1)
          AND superseded_by IS NULL
      `;

      const params: any[] = [searchQuery];

      // Filter by assistant type if provided
      if (assistantType) {
        sql += ` AND (key LIKE $2 || '%' OR value->>'assistant' = $2)`;
        params.push(assistantType.toLowerCase());
      }

      sql += `
        ORDER BY relevance DESC, confidence DESC
        LIMIT $${params.length + 1}
      `;
      params.push(limit);

      const result = await db.query(sql, params);

      return result.rows.map((row: any) => ({
        key: row.key,
        value: row.value,
        confidence: row.confidence || 0.5,
        relevance: row.relevance || 0,
        source: 'knowledge_store'
      }));
    } catch (error) {
      logger.error('Error searching knowledge_store:', error);
      return [];
    }
  }

  /**
   * Search the assistant_knowledge table
   */
  private async searchAssistantKnowledge(query: string, assistantType: string | undefined, limit: number): Promise<SearchResult[]> {
    if (!db.initialized) return [];

    try {
      const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
      
      let sql = `
        SELECT 
          route,
          fact,
          tags,
          1.0 as confidence
        FROM assistant_knowledge
        WHERE 1=1
      `;

      const params: any[] = [];

      // Add search conditions
      if (searchTerms.length > 0) {
        const searchConditions = searchTerms.map((_, index) => {
          params.push(`%${searchTerms[index]}%`);
          return `(LOWER(fact) LIKE $${params.length} OR LOWER(tags::text) LIKE $${params.length})`;
        });
        sql += ` AND (${searchConditions.join(' OR ')})`;
      }

      // Filter by assistant type
      if (assistantType) {
        params.push(assistantType);
        sql += ` AND route = $${params.length}`;
      }

      sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await db.query(sql, params);

      return result.rows.map((row: any) => {
        // Calculate relevance based on how many search terms match
        const factLower = row.fact.toLowerCase();
        const matchCount = searchTerms.filter(term => factLower.includes(term)).length;
        const relevance = searchTerms.length > 0 ? matchCount / searchTerms.length : 0.5;

        return {
          key: `${row.route}.assistant_knowledge`,
          value: {
            content: row.fact,
            tags: row.tags,
            assistant: row.route
          },
          confidence: 1.0, // Admin-uploaded knowledge has high confidence
          relevance,
          source: 'assistant_knowledge'
        };
      });
    } catch (error) {
      logger.error('Error searching assistant_knowledge:', error);
      return [];
    }
  }

  /**
   * Search the extracted_knowledge table
   */
  private async searchExtractedKnowledge(query: string, limit: number): Promise<SearchResult[]> {
    if (!db.initialized) return [];

    try {
      // First check if the table exists and what columns it has
      const tableCheck = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'extracted_knowledge'
        LIMIT 1
      `);

      if (tableCheck.rows.length === 0) {
        // Table doesn't exist
        return [];
      }

      const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
      
      // Use simpler query that works with actual table structure
      let sql = `
        SELECT 
          problem,
          solution,
          confidence,
          category
        FROM extracted_knowledge
        WHERE applied_to_sop = false
      `;

      const params: any[] = [];

      // Add search conditions
      if (searchTerms.length > 0) {
        const searchConditions = searchTerms.map((_, index) => {
          params.push(`%${searchTerms[index]}%`);
          return `(LOWER(problem) LIKE $${params.length} OR LOWER(solution) LIKE $${params.length})`;
        });
        sql += ` AND (${searchConditions.join(' OR ')})`;
      }

      sql += ` ORDER BY confidence DESC, created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await db.query(sql, params);

      return result.rows.map((row: any) => {
        // Calculate relevance
        const contentLower = `${row.problem} ${row.solution}`.toLowerCase();
        const matchCount = searchTerms.filter(term => contentLower.includes(term)).length;
        const relevance = searchTerms.length > 0 ? matchCount / searchTerms.length : 0.3;

        return {
          key: `extracted.${row.category || 'general'}`,
          value: {
            problem: row.problem,
            solution: row.solution,
            content: row.solution
          },
          confidence: row.confidence || 0.5,
          relevance,
          source: 'extracted_knowledge'
        };
      });
    } catch (error) {
      logger.error('Error searching extracted_knowledge:', error);
      return [];
    }
  }

  /**
   * Get knowledge by exact key
   */
  async getKnowledgeByKey(key: string): Promise<SearchResult | null> {
    if (!db.initialized) return null;

    try {
      const result = await db.query(`
        SELECT key, value, confidence
        FROM knowledge_store
        WHERE key = $1 AND superseded_by IS NULL
        LIMIT 1
      `, [key]);

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        key: row.key,
        value: row.value,
        confidence: row.confidence || 1.0,
        relevance: 1.0, // Exact match
        source: 'knowledge_store'
      };
    } catch (error) {
      logger.error('Error getting knowledge by key:', error);
      return null;
    }
  }

  /**
   * Format search results for assistant response
   */
  formatResultsForResponse(results: SearchResult[]): string {
    if (results.length === 0) return '';

    const highConfidenceResults = results.filter(r => r.confidence >= 0.7);
    if (highConfidenceResults.length === 0) return '';

    // Format the top results
    const formattedResults = highConfidenceResults.slice(0, 3).map(result => {
      const content = result.value.content || result.value.answer || result.value;
      return content;
    });

    return formattedResults.join('\n\n');
  }

  /**
   * Log search for analytics
   */
  private async logSearch(query: string, found: boolean): Promise<void> {
    try {
      // Check if knowledge_patterns table exists
      const tableExists = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'knowledge_patterns'
        )
      `);

      if (tableExists.rows[0]?.exists) {
        // Update or insert pattern tracking
        await db.query(`
          INSERT INTO knowledge_patterns (pattern, pattern_type, occurrence_count)
          VALUES ($1, 'search', 1)
          ON CONFLICT (pattern) DO UPDATE SET
            occurrence_count = knowledge_patterns.occurrence_count + 1,
            last_seen = NOW()
        `, [query.substring(0, 255)]);
      }
    } catch (error) {
      // Don't fail the search if logging fails
      logger.error('Error logging search:', error);
    }
  }

  /**
   * Update usage statistics when knowledge is used
   */
  async trackUsage(key: string, successful: boolean): Promise<void> {
    if (!db.initialized) return;

    try {
      const column = successful ? 'success_count' : 'failure_count';
      await db.query(`
        UPDATE knowledge_store
        SET 
          usage_count = usage_count + 1,
          ${column} = ${column} + 1,
          last_accessed = NOW()
        WHERE key = $1
      `, [key]);
    } catch (error) {
      logger.error('Error tracking usage:', error);
    }
  }
}

// Export singleton instance
export const knowledgeSearchService = new KnowledgeSearchService();