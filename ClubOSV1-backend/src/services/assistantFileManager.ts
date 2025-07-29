import { logger } from '../utils/logger';
import { db } from '../utils/database';

interface KnowledgeUpdate {
  assistantId: string;
  route: string;
  content: any;
}

export class AssistantFileManager {
  // Since we can't directly manage OpenAI Assistant files,
  // we'll track knowledge updates in our database instead
  
  constructor() {
    // No OpenAI client needed - assistants manage their own files
  }

  /**
   * Initialize knowledge tracking for each assistant
   */
  async initializeKnowledgeFiles(assistantMap: Record<string, string>): Promise<void> {
    // Create database table for tracking knowledge if it doesn't exist
    try {
      if (!db.initialized) {
        logger.warn('Database not initialized, skipping knowledge file initialization');
        return;
      }
      await db.query(`
        CREATE TABLE IF NOT EXISTS assistant_knowledge (
          id SERIAL PRIMARY KEY,
          assistant_id VARCHAR(255) NOT NULL UNIQUE,
          route VARCHAR(255) NOT NULL,
          knowledge JSONB NOT NULL,
          version VARCHAR(50) DEFAULT '1.0',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create index for faster lookups
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_assistant_id 
        ON assistant_knowledge(assistant_id)
      `);
      
      logger.info('Assistant knowledge tracking initialized');
    } catch (error) {
      logger.error('Failed to initialize knowledge tracking:', error);
    }
  }

  /**
   * Create initial knowledge record for an assistant
   */
  private async createKnowledgeRecord(route: string, assistantId: string): Promise<void> {
    const initialContent = {
      assistant: route,
      version: "1.0",
      lastUpdated: new Date().toISOString(),
      knowledge: {
        facts: [],
        procedures: [],
        policies: [],
        contacts: []
      }
    };

    await db.query(`
      INSERT INTO assistant_knowledge (assistant_id, route, knowledge)
      VALUES ($1, $2, $3)
      ON CONFLICT (assistant_id) DO UPDATE SET
        route = EXCLUDED.route,
        knowledge = EXCLUDED.knowledge,
        updated_at = CURRENT_TIMESTAMP
    `, [assistantId, route, JSON.stringify(initialContent)]);
  }

  /**
   * Get current knowledge for an assistant
   */
  private async getAssistantKnowledge(assistantId: string): Promise<any> {
    const result = await db.query(`
      SELECT knowledge FROM assistant_knowledge
      WHERE assistant_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `, [assistantId]);
    
    return result.rows[0]?.knowledge || null;
  }

  /**
   * Update knowledge for an assistant (stored in our database)
   */
  async updateKnowledgeFile(
    assistantId: string,
    knowledge: {
      fact: string;
      tags: string[];
      intent: 'add' | 'update' | 'overwrite';
      category: string;
      key?: string;
    }
  ): Promise<boolean> {
    try {
      // Ensure table exists first
      await this.initializeKnowledgeFiles({ [assistantId]: assistantId });
      // Get current knowledge
      let currentData = await this.getAssistantKnowledge(assistantId);
      
      if (!currentData) {
        // Create initial record if none exists
        const route = await this.getRouteForAssistant(assistantId);
        await this.createKnowledgeRecord(route || 'unknown', assistantId);
        currentData = await this.getAssistantKnowledge(assistantId);
      }

      // Update based on intent
      switch (knowledge.intent) {
        case 'add':
          this.addKnowledge(currentData, knowledge);
          break;
        case 'update':
          this.updateKnowledge(currentData, knowledge);
          break;
        case 'overwrite':
          this.overwriteKnowledge(currentData, knowledge);
          break;
      }

      // Update metadata
      currentData.lastUpdated = new Date().toISOString();
      currentData.version = this.incrementVersion(currentData.version || "1.0");

      // Save updated knowledge to database
      await db.query(`
        UPDATE assistant_knowledge 
        SET knowledge = $1, updated_at = CURRENT_TIMESTAMP
        WHERE assistant_id = $2
      `, [JSON.stringify(currentData), assistantId]);

      logger.info('Knowledge updated successfully', {
        assistantId,
        category: knowledge.category,
        intent: knowledge.intent
      });

      return true;
    } catch (error) {
      logger.error('Failed to update knowledge:', error);
      return false;
    }
  }

  /**
   * Get route name for an assistant ID
   */
  private async getRouteForAssistant(assistantId: string): Promise<string | null> {
    const result = await db.query(`
      SELECT route FROM assistant_knowledge
      WHERE assistant_id = $1
      LIMIT 1
    `, [assistantId]);
    
    return result.rows[0]?.route || null;
  }

  /**
   * Add new knowledge to the appropriate category
   */
  private addKnowledge(data: any, knowledge: any): void {
    const knowledgeEntry = {
      id: Date.now().toString(),
      fact: knowledge.fact,
      tags: knowledge.tags,
      category: knowledge.category,
      key: knowledge.key,
      addedAt: new Date().toISOString()
    };

    // Determine which array to add to based on category
    const categoryMap: Record<string, string> = {
      'procedure': 'procedures',
      'policy': 'policies',
      'contact': 'contacts',
      'fact': 'facts',
      'sop': 'procedures',
      'checklist': 'procedures',
      'brand': 'facts',
      'competitor': 'facts',
      'pricing': 'policies'
    };

    const targetArray = categoryMap[knowledge.category.toLowerCase()] || 'facts';
    
    if (!data.knowledge[targetArray]) {
      data.knowledge[targetArray] = [];
    }
    
    data.knowledge[targetArray].push(knowledgeEntry);
  }

  /**
   * Update existing knowledge
   */
  private updateKnowledge(data: any, knowledge: any): void {
    // Search through all arrays for matching key
    for (const arrayName of Object.keys(data.knowledge)) {
      const array = data.knowledge[arrayName];
      if (Array.isArray(array)) {
        const index = array.findIndex((item: any) => 
          item.key === knowledge.key || 
          item.fact.toLowerCase().includes(knowledge.key?.toLowerCase() || '')
        );
        
        if (index !== -1) {
          array[index] = {
            ...array[index],
            fact: knowledge.fact,
            tags: [...new Set([...array[index].tags, ...knowledge.tags])],
            updatedAt: new Date().toISOString()
          };
          return;
        }
      }
    }
    
    // If not found, add as new
    this.addKnowledge(data, knowledge);
  }

  /**
   * Overwrite category with new knowledge
   */
  private overwriteKnowledge(data: any, knowledge: any): void {
    const categoryMap: Record<string, string> = {
      'procedure': 'procedures',
      'policy': 'policies',
      'contact': 'contacts',
      'fact': 'facts'
    };

    const targetArray = categoryMap[knowledge.category.toLowerCase()] || 'facts';
    
    // Clear the array and add new entry
    data.knowledge[targetArray] = [{
      id: Date.now().toString(),
      fact: knowledge.fact,
      tags: knowledge.tags,
      category: knowledge.category,
      overwrittenAt: new Date().toISOString()
    }];
  }

  /**
   * Increment version number
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const minor = parseInt(parts[1] || '0') + 1;
    return `${parts[0]}.${minor}`;
  }

  /**
   * Verify knowledge was stored correctly
   */
  async verifyKnowledge(
    assistantId: string,
    searchTerm: string
  ): Promise<{
    found: boolean;
    matches: any[];
  }> {
    try {
      const data = await this.getAssistantKnowledge(assistantId);
      if (!data) {
        return { found: false, matches: [] };
      }
      
      const matches: any[] = [];
      const searchLower = searchTerm.toLowerCase();

      // Search through all knowledge arrays
      for (const [category, items] of Object.entries(data.knowledge || {})) {
        if (Array.isArray(items)) {
          for (const item of items) {
            if (
              item.fact?.toLowerCase().includes(searchLower) ||
              item.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower)) ||
              item.key?.toLowerCase().includes(searchLower)
            ) {
              matches.push({
                category,
                ...item
              });
            }
          }
        }
      }

      return {
        found: matches.length > 0,
        matches
      };
    } catch (error) {
      logger.error('Failed to verify knowledge:', error);
      return { found: false, matches: [] };
    }
  }

  /**
   * Get all knowledge entries for display/export
   */
  async getAllAssistantKnowledge(): Promise<any[]> {
    try {
      const result = await db.query(`
        SELECT assistant_id, route, knowledge, updated_at
        FROM assistant_knowledge
        ORDER BY updated_at DESC
      `);
      
      return result.rows;
    } catch (error) {
      logger.error('Failed to get all assistant knowledge:', error);
      return [];
    }
  }
}

// Export singleton instance
export const assistantFileManager = new AssistantFileManager();