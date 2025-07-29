import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { config } from '../utils/envValidator';

interface KnowledgeFile {
  assistantId: string;
  fileName: string;
  content: string;
}

export class AssistantFileManager {
  private openai: OpenAI;
  private knowledgeFileIds: Map<string, string> = new Map();

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY
    });
  }

  /**
   * Initialize or get existing knowledge files for each assistant
   */
  async initializeKnowledgeFiles(assistantMap: Record<string, string>): Promise<void> {
    for (const [route, assistantId] of Object.entries(assistantMap)) {
      try {
        // Check if assistant already has a knowledge file
        const assistant = await this.openai.beta.assistants.retrieve(assistantId);
        const existingFiles = assistant.file_ids || [];
        
        // Look for our knowledge file
        let knowledgeFileId: string | null = null;
        
        for (const fileId of existingFiles) {
          try {
            const file = await this.openai.files.retrieve(fileId);
            if (file.filename === `${route.toLowerCase()}_knowledge.json`) {
              knowledgeFileId = fileId;
              break;
            }
          } catch (error) {
            // File might be deleted or inaccessible
            logger.warn(`Could not retrieve file ${fileId} for assistant ${assistantId}`);
          }
        }

        // Create knowledge file if it doesn't exist
        if (!knowledgeFileId) {
          knowledgeFileId = await this.createKnowledgeFile(route, assistantId);
        }

        this.knowledgeFileIds.set(assistantId, knowledgeFileId);
        logger.info(`Knowledge file initialized for ${route}:`, { assistantId, fileId: knowledgeFileId });
      } catch (error) {
        logger.error(`Failed to initialize knowledge file for ${route}:`, error);
      }
    }
  }

  /**
   * Create a new knowledge file for an assistant
   */
  private async createKnowledgeFile(route: string, assistantId: string): Promise<string> {
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

    // Create the file
    const file = await this.openai.files.create({
      file: Buffer.from(JSON.stringify(initialContent, null, 2)),
      purpose: 'assistants'
    });

    // Attach to assistant
    await this.openai.beta.assistants.update(assistantId, {
      file_ids: [...(await this.getAssistantFileIds(assistantId)), file.id]
    });

    return file.id;
  }

  /**
   * Get current file IDs for an assistant
   */
  private async getAssistantFileIds(assistantId: string): Promise<string[]> {
    const assistant = await this.openai.beta.assistants.retrieve(assistantId);
    return assistant.file_ids || [];
  }

  /**
   * Update knowledge file with new information
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
      const fileId = this.knowledgeFileIds.get(assistantId);
      if (!fileId) {
        throw new Error(`No knowledge file found for assistant ${assistantId}`);
      }

      // Retrieve current content
      const fileContent = await this.openai.files.content(fileId);
      const currentData = JSON.parse(fileContent.toString());

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

      // Create new file with updated content
      const newFile = await this.openai.files.create({
        file: Buffer.from(JSON.stringify(currentData, null, 2)),
        purpose: 'assistants'
      });

      // Update assistant with new file
      const currentFileIds = await this.getAssistantFileIds(assistantId);
      const updatedFileIds = currentFileIds.filter(id => id !== fileId);
      updatedFileIds.push(newFile.id);

      await this.openai.beta.assistants.update(assistantId, {
        file_ids: updatedFileIds
      });

      // Delete old file
      try {
        await this.openai.files.del(fileId);
      } catch (error) {
        logger.warn('Could not delete old knowledge file:', error);
      }

      // Update our mapping
      this.knowledgeFileIds.set(assistantId, newFile.id);

      logger.info('Knowledge file updated successfully', {
        assistantId,
        newFileId: newFile.id,
        category: knowledge.category
      });

      return true;
    } catch (error) {
      logger.error('Failed to update knowledge file:', error);
      return false;
    }
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
      const fileId = this.knowledgeFileIds.get(assistantId);
      if (!fileId) {
        return { found: false, matches: [] };
      }

      const fileContent = await this.openai.files.content(fileId);
      const data = JSON.parse(fileContent.toString());
      
      const matches: any[] = [];
      const searchLower = searchTerm.toLowerCase();

      // Search through all knowledge arrays
      for (const [category, items] of Object.entries(data.knowledge)) {
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
   * Get all knowledge for an assistant
   */
  async getAssistantKnowledge(assistantId: string): Promise<any> {
    try {
      const fileId = this.knowledgeFileIds.get(assistantId);
      if (!fileId) {
        return null;
      }

      const fileContent = await this.openai.files.content(fileId);
      return JSON.parse(fileContent.toString());
    } catch (error) {
      logger.error('Failed to get assistant knowledge:', error);
      return null;
    }
  }
}

// Export singleton instance
export const assistantFileManager = new AssistantFileManager();