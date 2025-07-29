import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';
import { query } from '../utils/db';

export interface KnowledgeBase {
  version: string;
  lastUpdated: string;
  categories: any[];
}

export interface KnowledgeItem {
  id: string;
  category: string;
  subcategory?: string;
  issue: string;
  symptoms: string[];
  solutions: string[];
  priority?: string;
  timeEstimate?: string;
  customerScript?: string;
  escalationPath?: string;
  metadata?: any;
  confidence?: number;
  source?: string;
}

export interface UnifiedSearchOptions {
  includeStatic?: boolean;
  includeExtracted?: boolean;
  includeSOPEmbeddings?: boolean;
  category?: string;
  assistant?: string;
  limit?: number;
  minConfidence?: number;
}

export class KnowledgeLoader {
  private knowledgeBases: Map<string, KnowledgeBase> = new Map();
  private dbInitialized: boolean = false;
  
  constructor() {
    this.loadAllKnowledgeBases();
  }
  
  private loadAllKnowledgeBases() {
    const knowledgeFiles = [
      'general-knowledge-v2.json',
      'booking-knowledge-v2.json',
      'emergency-knowledge-v2.json',
      'tone-knowledge-v2.json',
      'trackman-knowledge-v2.json'
    ];
    
    for (const file of knowledgeFiles) {
      try {
        const filePath = join(__dirname, file);
        
        // Check if file exists before trying to read it
        if (existsSync(filePath)) {
          const data = JSON.parse(readFileSync(filePath, 'utf-8'));
          const baseName = file.replace('.json', '');
          this.knowledgeBases.set(baseName, data);
          logger.info(`Loaded knowledge base: ${baseName}`);
        } else {
          logger.warn(`Knowledge base file not found: ${file} - using empty knowledge base`);
          // Create empty knowledge base
          const baseName = file.replace('.json', '');
          this.knowledgeBases.set(baseName, {
            version: '1.0',
            lastUpdated: new Date().toISOString(),
            categories: []
          });
        }
      } catch (error) {
        logger.error(`Failed to load knowledge base ${file}:`, error);
        // Create empty knowledge base on error
        const baseName = file.replace('.json', '');
        this.knowledgeBases.set(baseName, {
          version: '1.0',
          lastUpdated: new Date().toISOString(),
          categories: []
        });
      }
    }
    
    logger.info(`Loaded ${this.knowledgeBases.size} knowledge bases`);
  }
  
  getKnowledgeBase(name: string): KnowledgeBase | undefined {
    return this.knowledgeBases.get(name);
  }
  
  getAllKnowledgeBases(): Map<string, KnowledgeBase> {
    return this.knowledgeBases;
  }
  
  searchKnowledge(queryText: string, category?: string): any[] {
    // Try to use async database search synchronously
    // This is not ideal, but maintains backward compatibility
    try {
      // Create a promise and resolve it synchronously using a hack
      let dbResults: any[] = [];
      let dbError: any = null;
      let finished = false;
      
      this.searchKnowledgeDB(queryText, category)
        .then(results => {
          dbResults = results;
          finished = true;
        })
        .catch(error => {
          dbError = error;
          finished = true;
        });
      
      // Wait a short time for the database query
      const start = Date.now();
      while (!finished && Date.now() - start < 100) {
        // Busy wait - not ideal but works for backward compatibility
      }
      
      if (dbResults.length > 0) {
        return dbResults;
      }
    } catch (error) {
      logger.warn('Failed to search knowledge DB synchronously:', error);
    }
    
    // Fallback to file-based search
    const results: any[] = [];
    
    for (const [name, kb] of this.knowledgeBases) {
      if (kb.categories) {
        for (const cat of kb.categories) {
          if (!category || cat.name === category) {
            // Simple search implementation
            const items = cat.items || [];
            const matches = items.filter((item: any) => 
              JSON.stringify(item).toLowerCase().includes(queryText.toLowerCase())
            );
            results.push(...matches);
          }
        }
      }
    }
    
    return results;
  }
  
  // New database-based methods
  async searchKnowledgeDB(searchQuery: string, category?: string): Promise<KnowledgeItem[]> {
    try {
      // Search both knowledge_base and extracted_knowledge tables
      let queryText = `
        WITH combined_knowledge AS (
          -- From knowledge_base table
          SELECT 
            id,
            category,
            issue,
            symptoms,
            ARRAY[issue] as solutions,
            priority,
            NULL as confidence,
            'knowledge_base' as source
          FROM knowledge_base 
          WHERE (
            issue ILIKE $1 
            OR $1 = ANY(symptoms)
            OR EXISTS (
              SELECT 1 FROM unnest(symptoms) s 
              WHERE s ILIKE '%' || $1 || '%'
            )
          )
          
          UNION ALL
          
          -- From extracted_knowledge table
          SELECT 
            id,
            category,
            problem as issue,
            ARRAY[problem] as symptoms,
            ARRAY[solution] as solutions,
            CASE 
              WHEN confidence >= 0.9 THEN 'high'
              WHEN confidence >= 0.7 THEN 'medium'
              ELSE 'low'
            END as priority,
            confidence,
            'extracted_knowledge' as source
          FROM extracted_knowledge
          WHERE (
            problem ILIKE $1
            OR solution ILIKE $1
          )
          AND confidence >= 0.6
        )
        SELECT * FROM combined_knowledge
      `;
      const params: any[] = [`%${searchQuery}%`];
      
      if (category) {
        queryText += ` WHERE category = $2`;
        params.push(category);
      }
      
      queryText += ` ORDER BY confidence DESC NULLS LAST, priority DESC, issue`;
      
      const result = await query(queryText, params);
      return result.rows;
    } catch (error) {
      logger.error('Failed to search knowledge DB:', error);
      return [];
    }
  }
  
  async findSolutionDB(symptoms: string[]): Promise<KnowledgeItem[]> {
    try {
      // Find entries from both tables
      const queryText = `
        WITH combined_results AS (
          -- From knowledge_base table (original logic)
          SELECT 
            kb.*,
            CARDINALITY(symptoms & $1::text[]) as match_count,
            'knowledge_base' as source
          FROM knowledge_base kb
          WHERE symptoms && $1::text[]
          
          UNION ALL
          
          -- From extracted_knowledge table
          SELECT 
            ek.id,
            ek.category,
            NULL as subcategory,
            ek.problem as issue,
            ARRAY[ek.problem] as symptoms,
            ARRAY[ek.solution] as solutions,
            CASE 
              WHEN ek.confidence >= 0.9 THEN 'high'
              WHEN ek.confidence >= 0.7 THEN 'medium'
              ELSE 'low'
            END as priority,
            NULL as timeEstimate,
            NULL as customerScript,
            NULL as escalationPath,
            ek.metadata,
            CASE 
              WHEN EXISTS (
                SELECT 1 FROM unnest($1::text[]) s 
                WHERE ek.problem ILIKE '%' || s || '%'
                OR ek.solution ILIKE '%' || s || '%'
              ) THEN 1
              ELSE 0
            END as match_count,
            'extracted_knowledge' as source
          FROM extracted_knowledge ek
          WHERE ek.confidence >= 0.6
          AND EXISTS (
            SELECT 1 FROM unnest($1::text[]) s 
            WHERE ek.problem ILIKE '%' || s || '%'
            OR ek.solution ILIKE '%' || s || '%'
          )
        )
        SELECT * FROM combined_results
        ORDER BY match_count DESC, priority DESC
        LIMIT 10
      `;
      
      const result = await query(queryText, [symptoms]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to find solutions in DB:', error);
      return [];
    }
  }
  
  async getQuickReferenceDB(route: string): Promise<KnowledgeItem[]> {
    try {
      const categoryMap: Record<string, string> = {
        'booking': 'booking',
        'Booking & Access': 'booking',
        'emergency': 'emergency',
        'Emergency': 'emergency',
        'tech': 'technical',
        'TechSupport': 'technical',
        'brand': 'general',
        'BrandTone': 'general'
      };
      
      const category = categoryMap[route] || 'general';
      
      const result = await query(
        `SELECT * FROM knowledge_base 
         WHERE category = $1 
         ORDER BY priority DESC, issue 
         LIMIT 10`,
        [category]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Failed to get quick reference from DB:', error);
      return [];
    }
  }
  
  // Wrapper methods that try database first, then fallback to file-based
  async findSolution(symptoms: string[]): Promise<any[]> {
    // Try database first
    if (this.dbInitialized) {
      const dbResults = await this.findSolutionDB(symptoms);
      if (dbResults.length > 0) {
        return dbResults.map(item => ({
          ...item,
          matchScore: 0.9,
          matchedSymptom: symptoms[0],
          knowledgeBase: item.category
        }));
      }
    }
    
    // Fallback to file-based search
    const results: any[] = [];
    const lowerSymptoms = symptoms.map(s => s.toLowerCase());
    
    for (const [name, kb] of this.knowledgeBases) {
      if (kb.categories) {
        for (const cat of kb.categories) {
          const items = cat.items || [];
          for (const item of items) {
            if (item.symptoms && Array.isArray(item.symptoms)) {
              for (const symptom of item.symptoms) {
                for (const userSymptom of lowerSymptoms) {
                  if (symptom.toLowerCase().includes(userSymptom) || 
                      userSymptom.includes(symptom.toLowerCase())) {
                    results.push({
                      ...item,
                      matchScore: 0.7,
                      matchedSymptom: userSymptom,
                      knowledgeBase: name
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return results;
  }
  
  async getQuickReference(route: string): Promise<any> {
    // Try database first
    if (this.dbInitialized) {
      const dbResults = await this.getQuickReferenceDB(route);
      if (dbResults.length > 0) {
        return {
          route,
          items: dbResults
        };
      }
    }
    
    // Fallback to empty response
    return {
      route,
      items: []
    };
  }
  
  // Initialize database connection
  async initializeDB(): Promise<void> {
    try {
      // Check if both tables exist and count records
      const kbResult = await query(
        `SELECT COUNT(*) as count FROM knowledge_base`
      ).catch(() => ({ rows: [{ count: 0 }] }));
      
      const ekResult = await query(
        `SELECT COUNT(*) as count FROM extracted_knowledge WHERE confidence >= 0.6`
      ).catch(() => ({ rows: [{ count: 0 }] }));
      
      const totalRecords = (kbResult.rows[0].count || 0) + (ekResult.rows[0].count || 0);
      
      this.dbInitialized = totalRecords > 0 || (kbResult.rows[0].count >= 0 || ekResult.rows[0].count >= 0);
      
      logger.info('Knowledge base DB initialized:', { 
        initialized: this.dbInitialized,
        knowledgeBaseRecords: kbResult.rows[0].count || 0,
        extractedKnowledgeRecords: ekResult.rows[0].count || 0,
        totalRecords
      });
    } catch (error) {
      logger.warn('Knowledge base DB not available, using file-based fallback');
      this.dbInitialized = false;
    }
  }

  // NEW: Unified search across all knowledge sources
  async unifiedSearch(
    searchQuery: string,
    options: UnifiedSearchOptions = {}
  ): Promise<KnowledgeItem[]> {
    const {
      includeStatic = true,
      includeExtracted = true,
      includeSOPEmbeddings = true,
      category,
      assistant,
      limit = 10,
      minConfidence = 0.6
    } = options;
    
    const results: KnowledgeItem[] = [];
    
    try {
      // Map assistant to category if provided
      let searchCategory = category;
      if (!searchCategory && assistant) {
        const categoryMap: Record<string, string> = {
          'booking': 'booking',
          'booking & access': 'booking',
          'emergency': 'emergency',
          'techsupport': 'tech',
          'tech': 'tech',
          'brandtone': 'brand',
          'brand': 'brand',
          'general': 'general'
        };
        searchCategory = categoryMap[assistant.toLowerCase()] || 'general';
        
        // Log for debugging
        logger.info('Knowledge search mapping:', {
          assistant,
          assistantLower: assistant.toLowerCase(),
          mappedCategory: searchCategory,
          searchQuery
        });
      }
      
      // Search all requested sources in parallel
      const promises: Promise<any>[] = [];
      
      if (includeStatic && this.dbInitialized) {
        promises.push(this.searchStaticKnowledge(searchQuery, searchCategory));
      }
      
      if (includeExtracted && this.dbInitialized) {
        promises.push(this.searchExtractedKnowledge(searchQuery, searchCategory, minConfidence));
      }
      
      if (includeSOPEmbeddings && this.dbInitialized) {
        logger.info('Including SOP embeddings in search');
        promises.push(this.searchSOPEmbeddings(searchQuery, assistant || searchCategory));
      }
      
      // Fallback to JSON files if DB not available
      if (!this.dbInitialized && includeStatic) {
        const jsonResults = this.searchKnowledge(searchQuery, searchCategory);
        results.push(...jsonResults.map(r => ({
          ...r,
          source: 'json_file',
          confidence: 0.5
        })));
      }
      
      // Wait for all searches to complete
      const searchResults = await Promise.all(promises);
      searchResults.forEach(items => results.push(...items));
      
      // If no results found and we were searching a specific category, try searching all categories
      if (results.length === 0 && searchCategory && includeExtracted) {
        logger.info('No results in category, searching all categories:', { 
          originalCategory: searchCategory,
          searchQuery 
        });
        
        const allCategoryResults = await this.searchExtractedKnowledge(
          searchQuery, 
          undefined, // No category filter
          minConfidence
        );
        results.push(...allCategoryResults);
      }
      
      // Sort by confidence (if available) and limit
      return results
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        .slice(0, limit);
        
    } catch (error) {
      logger.error('Unified search failed:', error);
      return results; // Return what we have so far
    }
  }
  
  // Search static knowledge base table
  private async searchStaticKnowledge(
    searchQuery: string,
    category?: string
  ): Promise<KnowledgeItem[]> {
    try {
      let queryText = `
        SELECT *, 'knowledge_base' as source, 0.8 as confidence
        FROM knowledge_base 
        WHERE (
          issue ILIKE $1 
          OR $1 = ANY(symptoms)
          OR EXISTS (
            SELECT 1 FROM unnest(symptoms) s 
            WHERE s ILIKE '%' || $1 || '%'
          )
        )
      `;
      const params: any[] = [`%${searchQuery}%`];
      
      if (category) {
        queryText += ` AND category = $2`;
        params.push(category);
      }
      
      queryText += ` ORDER BY priority DESC, issue`;
      
      const result = await query(queryText, params);
      return result.rows;
    } catch (error) {
      logger.error('Failed to search static knowledge:', error);
      return [];
    }
  }
  
  // Search extracted knowledge table
  private async searchExtractedKnowledge(
    searchQuery: string,
    category?: string,
    minConfidence: number = 0.6
  ): Promise<KnowledgeItem[]> {
    try {
      let queryText = `
        SELECT 
          id,
          category,
          problem as issue,
          ARRAY[problem] as symptoms,
          ARRAY[solution] as solutions,
          CASE 
            WHEN confidence >= 0.9 THEN 'high'
            WHEN confidence >= 0.7 THEN 'medium'
            ELSE 'low'
          END as priority,
          confidence,
          'extracted_knowledge' as source,
          metadata
        FROM extracted_knowledge
        WHERE confidence >= $1
        AND (
          problem ILIKE $2
          OR solution ILIKE $2
          OR to_tsvector('english', problem || ' ' || solution) @@ plainto_tsquery('english', $3)
        )
      `;
      const params: any[] = [minConfidence, `%${searchQuery}%`, searchQuery];
      
      if (category) {
        queryText += ` AND category = $4`;
        params.push(category);
      }
      
      queryText += ` ORDER BY confidence DESC, problem`;
      
      // Debug logging
      logger.info('Searching extracted knowledge:', {
        searchQuery,
        category,
        minConfidence,
        queryPreview: queryText.substring(0, 100)
      });
      
      const result = await query(queryText, params);
      
      logger.info('Extracted knowledge search results:', {
        found: result.rows.length,
        category,
        searchQuery
      });
      
      return result.rows;
    } catch (error) {
      logger.error('Failed to search extracted knowledge:', error);
      return [];
    }
  }
  
  // Search SOP embeddings table
  private async searchSOPEmbeddings(
    searchQuery: string,
    assistant?: string
  ): Promise<KnowledgeItem[]> {
    try {
      // Map assistant names to categories
      let searchCategory = assistant;
      if (assistant && !['emergency', 'booking', 'tech', 'brand'].includes(assistant)) {
        const assistantMap: Record<string, string> = {
          'BrandTone': 'brand',
          'TechSupport': 'tech',
          'Emergency': 'emergency',
          'Booking & Access': 'booking'
        };
        searchCategory = assistantMap[assistant] || assistant?.toLowerCase();
      }
      
      let queryText = `
        SELECT 
          id,
          assistant as category,
          title as issue,
          ARRAY[title] as symptoms,
          ARRAY[content] as solutions,
          'medium' as priority,
          0.7 as confidence,
          'sop_embeddings' as source,
          metadata
        FROM sop_embeddings
        WHERE (
          title ILIKE $1
          OR content ILIKE $1
          OR to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', $2)
        )
      `;
      const params: any[] = [`%${searchQuery}%`, searchQuery];
      
      if (searchCategory) {
        queryText += ` AND assistant = $3`;
        params.push(searchCategory);
      }
      
      queryText += ` ORDER BY updated_at DESC`;
      
      logger.info('Searching SOP embeddings:', { searchQuery, searchCategory, queryPreview: queryText.substring(0, 100) });
      
      const result = await query(queryText, params);
      
      logger.info('SOP embeddings search results:', { found: result.rows.length });
      
      return result.rows;
    } catch (error) {
      logger.error('Failed to search SOP embeddings:', error);
      return [];
    }
  }
}

export const knowledgeLoader = new KnowledgeLoader();

// Initialize DB connection on startup
knowledgeLoader.initializeDB().catch(err => 
  logger.error('Failed to initialize knowledge DB:', err)
);
