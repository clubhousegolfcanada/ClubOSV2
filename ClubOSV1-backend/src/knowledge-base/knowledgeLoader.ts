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
      let queryText = `
        SELECT * FROM knowledge_base 
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
      logger.error('Failed to search knowledge DB:', error);
      return [];
    }
  }
  
  async findSolutionDB(symptoms: string[]): Promise<KnowledgeItem[]> {
    try {
      // Find entries where symptoms overlap
      const queryText = `
        SELECT *, 
          CARDINALITY(symptoms & $1::text[]) as match_count
        FROM knowledge_base 
        WHERE symptoms && $1::text[]
        ORDER BY match_count DESC, priority DESC
        LIMIT 5
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
      // Check if knowledge_base table exists
      const result = await query(
        `SELECT COUNT(*) as count FROM knowledge_base`
      );
      
      this.dbInitialized = result.rows[0].count >= 0;
      logger.info('Knowledge base DB initialized:', { 
        initialized: this.dbInitialized,
        recordCount: result.rows[0].count 
      });
    } catch (error) {
      logger.warn('Knowledge base DB not available, using file-based fallback');
      this.dbInitialized = false;
    }
  }
}

export const knowledgeLoader = new KnowledgeLoader();

// Initialize DB connection on startup
knowledgeLoader.initializeDB().catch(err => 
  logger.error('Failed to initialize knowledge DB:', err)
);
