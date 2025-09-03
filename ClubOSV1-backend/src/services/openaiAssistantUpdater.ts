import OpenAI from 'openai';
import { logger } from '../utils/logger';

export class OpenAIAssistantUpdater {
  private openai: OpenAI;
  
  constructor() {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-demo-key-not-for-production') {
      throw new Error('OpenAI API key not configured');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Update assistant with new knowledge by appending to instructions
   */
  async updateAssistantKnowledge(
    assistantId: string,
    knowledge: {
      fact: string;
      tags: string[];
      intent: 'add' | 'update' | 'overwrite';
      category: string;
      key?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      logger.info('Updating OpenAI assistant with knowledge', { assistantId, category: knowledge.category });
      
      // Retrieve current assistant
      const assistant = await this.openai.beta.assistants.retrieve(assistantId);
      
      // Get current instructions
      let currentInstructions = assistant.instructions || '';
      
      // Create knowledge section
      const knowledgeSection = this.formatKnowledgeUpdate(knowledge);
      
      // Handle different intents
      let updatedInstructions: string;
      
      if (knowledge.intent === 'overwrite' && knowledge.category) {
        // Remove old knowledge of this category and add new
        updatedInstructions = this.replaceKnowledgeCategory(
          currentInstructions,
          knowledge.category,
          knowledgeSection
        );
      } else if (knowledge.intent === 'update' && knowledge.key) {
        // Update specific knowledge entry
        updatedInstructions = this.updateSpecificKnowledge(
          currentInstructions,
          knowledge.key,
          knowledgeSection
        );
      } else {
        // Add new knowledge
        updatedInstructions = this.appendKnowledge(currentInstructions, knowledgeSection);
      }
      
      // Ensure instructions don't exceed OpenAI's limit (32,768 characters)
      if (updatedInstructions.length > 32000) {
        // Trim old knowledge updates if too long
        updatedInstructions = this.trimOldKnowledge(updatedInstructions);
      }
      
      // Update the assistant
      await this.openai.beta.assistants.update(assistantId, {
        instructions: updatedInstructions
      });
      
      logger.info('Successfully updated OpenAI assistant', { 
        assistantId, 
        instructionsLength: updatedInstructions.length 
      });
      
      return {
        success: true,
        message: `Knowledge successfully updated in OpenAI assistant ${assistantId}`
      };
      
    } catch (error) {
      logger.error('Failed to update OpenAI assistant:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error updating assistant'
      };
    }
  }

  /**
   * Format knowledge update for instructions
   */
  private formatKnowledgeUpdate(knowledge: any): string {
    const timestamp = new Date().toISOString().split('T')[0]; // Just date
    
    return `
[KNOWLEDGE UPDATE - ${timestamp}]
Category: ${knowledge.category}
${knowledge.key ? `Key: ${knowledge.key}` : ''}
${knowledge.tags.length > 0 ? `Tags: ${knowledge.tags.join(', ')}` : ''}
Content: ${knowledge.fact}
---`;
  }

  /**
   * Append knowledge to instructions
   */
  private appendKnowledge(instructions: string, knowledgeSection: string): string {
    // Look for existing knowledge section
    const knowledgeMarker = '\n## DYNAMIC KNOWLEDGE BASE\n';
    
    if (instructions.includes(knowledgeMarker)) {
      // Insert after the marker
      const parts = instructions.split(knowledgeMarker);
      return parts[0] + knowledgeMarker + knowledgeSection + '\n' + parts[1];
    } else {
      // Create new knowledge section at the end
      return instructions + '\n\n## DYNAMIC KNOWLEDGE BASE\n' + knowledgeSection;
    }
  }

  /**
   * Replace all knowledge of a specific category
   */
  private replaceKnowledgeCategory(
    instructions: string, 
    category: string, 
    newKnowledge: string
  ): string {
    // Pattern to match knowledge entries of this category
    const categoryPattern = new RegExp(
      `\\[KNOWLEDGE UPDATE[^\\]]*\\]\\nCategory: ${category}[^\\-]*---`,
      'gm'
    );
    
    // Remove all existing entries of this category
    let updated = instructions.replace(categoryPattern, '');
    
    // Add the new knowledge
    return this.appendKnowledge(updated, newKnowledge);
  }

  /**
   * Update a specific knowledge entry by key
   */
  private updateSpecificKnowledge(
    instructions: string,
    key: string,
    newKnowledge: string
  ): string {
    // Pattern to match knowledge entry with this key
    const keyPattern = new RegExp(
      `\\[KNOWLEDGE UPDATE[^\\]]*\\][^\\-]*Key: ${key}[^\\-]*---`,
      'gm'
    );
    
    if (keyPattern.test(instructions)) {
      // Replace existing entry
      return instructions.replace(keyPattern, newKnowledge);
    } else {
      // Key not found, add as new
      return this.appendKnowledge(instructions, newKnowledge);
    }
  }

  /**
   * Trim old knowledge if instructions are too long
   */
  private trimOldKnowledge(instructions: string): string {
    // Find all knowledge updates with dates
    const knowledgePattern = /\[KNOWLEDGE UPDATE - (\d{4}-\d{2}-\d{2})\][^-]*---/gm;
    const matches = Array.from(instructions.matchAll(knowledgePattern));
    
    if (matches.length > 20) {
      // Keep only the 20 most recent updates
      const sortedMatches = matches.sort((a, b) => {
        const dateA = new Date(a[1]).getTime();
        const dateB = new Date(b[1]).getTime();
        return dateB - dateA; // Sort descending (newest first)
      });
      
      // Remove old entries (keep top 20)
      const toRemove = sortedMatches.slice(20);
      let trimmed = instructions;
      
      for (const match of toRemove) {
        trimmed = trimmed.replace(match[0], '');
      }
      
      return trimmed;
    }
    
    return instructions;
  }

  /**
   * Get assistant's current knowledge (for verification)
   */
  async getAssistantKnowledge(assistantId: string): Promise<string[]> {
    try {
      const assistant = await this.openai.beta.assistants.retrieve(assistantId);
      const instructions = assistant.instructions || '';
      
      // Extract knowledge entries
      const knowledgePattern = /\[KNOWLEDGE UPDATE[^-]*---/gm;
      const matches = instructions.match(knowledgePattern) || [];
      
      return matches;
    } catch (error) {
      logger.error('Failed to retrieve assistant knowledge:', error);
      return [];
    }
  }
}

// Export singleton instance
export const openaiAssistantUpdater = new OpenAIAssistantUpdater();