import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

export interface KnowledgeBase {
  version: string;
  lastUpdated: string;
  categories: any[];
}

export class KnowledgeLoader {
  private knowledgeBases: Map<string, KnowledgeBase> = new Map();
  
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
  
  searchKnowledge(query: string, category?: string): any[] {
    const results: any[] = [];
    
    for (const [name, kb] of this.knowledgeBases) {
      if (kb.categories) {
        for (const cat of kb.categories) {
          if (!category || cat.name === category) {
            // Simple search implementation
            const items = cat.items || [];
            const matches = items.filter((item: any) => 
              JSON.stringify(item).toLowerCase().includes(query.toLowerCase())
            );
            results.push(...matches);
          }
        }
      }
    }
    
    return results;
  }
}

export const knowledgeLoader = new KnowledgeLoader();
