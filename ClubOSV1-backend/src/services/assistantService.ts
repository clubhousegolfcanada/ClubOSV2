import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { config } from '../utils/envValidator';
import { db } from '../utils/database';
import { assistantFileManager } from './assistantFileManager';
import { knowledgeSearchService } from './knowledgeSearchService';
// Intelligent SOP Module disabled - using OpenAI Assistants directly

interface AssistantResponse {
  response: string;
  assistantId: string;
  threadId: string;
  confidence?: number;
  // New fields for structured JSON responses
  structured?: any;
  category?: string;
  priority?: string;
  actions?: Array<{
    type: string;
    description: string;
    details?: any;
  }>;
  metadata?: any;
  escalation?: any;
}

export class AssistantService {
  private openai: OpenAI | null;
  private assistantMap: Record<string, string>;
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = !!config.OPENAI_API_KEY;
    
    if (this.isEnabled) {
      this.openai = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
        organization: process.env.OPENAI_ORGANIZATION,
        project: process.env.OPENAI_PROJECT_ID
      });
    } else {
      this.openai = null;
      logger.warn('AssistantService: OpenAI API key not configured, assistant features disabled');
    }

    // Map routes to assistant IDs - handle both old and new route names
    this.assistantMap = {
      'Booking & Access': process.env.BOOKING_ACCESS_GPT_ID || '',
      'Emergency': process.env.EMERGENCY_GPT_ID || '',
      'TechSupport': process.env.TECH_SUPPORT_GPT_ID || '',
      'BrandTone': process.env.BRAND_MARKETING_GPT_ID || '',
      // Also support old route names
      'booking': process.env.BOOKING_ACCESS_GPT_ID || '',
      'access': process.env.BOOKING_ACCESS_GPT_ID || '',
      'emergency': process.env.EMERGENCY_GPT_ID || '',
      'tech': process.env.TECH_SUPPORT_GPT_ID || '',
      'brand': process.env.BRAND_MARKETING_GPT_ID || ''
    };

    // Initialize knowledge files for each assistant
    this.initializeKnowledgeFiles();
  }

  private async initializeKnowledgeFiles(): Promise<void> {
    try {
      await assistantFileManager.initializeKnowledgeFiles(this.assistantMap);
      logger.info('✅ Assistant knowledge files initialized');
    } catch (error) {
      logger.error('Failed to initialize knowledge files:', error);
    }
  }

  private extractJsonFromText(text: string): { json: any | null; textAfter: string; fullText: string } {
    // First, clean up markdown and citations
    let cleanedText = text;
    cleanedText = cleanedText.replace(/```json\s*/g, '').replace(/```\s*/g, '').replace(/```/g, '');
    cleanedText = cleanedText.replace(/【[^】]+】/g, '');
    cleanedText = cleanedText.trim();
    
    // If the text doesn't look like it contains JSON, return as-is
    if (!cleanedText.includes('{') || !cleanedText.includes('}')) {
      return { json: null, textAfter: '', fullText: cleanedText };
    }
    
    // Try to find valid JSON in the text
    if (cleanedText.trim().startsWith('{')) {
      // Find the matching closing brace
      let braceCount = 0;
      let jsonEndIndex = -1;
      let inString = false;
      let escapeNext = false;
      
      for (let i = 0; i < cleanedText.length; i++) {
        const char = cleanedText[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') braceCount++;
          if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEndIndex = i;
              break;
            }
          }
        }
      }
      
      if (jsonEndIndex > -1) {
        const jsonPart = cleanedText.substring(0, jsonEndIndex + 1);
        const textAfter = cleanedText.substring(jsonEndIndex + 1).trim();
        
        try {
          const parsed = JSON.parse(jsonPart);
          return { json: parsed, textAfter, fullText: cleanedText };
        } catch (e) {
          logger.warn('Failed to parse extracted JSON', { 
            error: e,
            jsonPart: jsonPart.substring(0, 100) + '...'
          });
        }
      }
    }
    
    // Try to find JSON anywhere in the text
    const jsonRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
    const matches = cleanedText.match(jsonRegex);
    
    if (matches) {
      for (const match of matches) {
        try {
          const parsed = JSON.parse(match);
          if (parsed.response) {
            // Remove the JSON from the text to get what's before and after
            const jsonIndex = cleanedText.indexOf(match);
            const textBefore = cleanedText.substring(0, jsonIndex).trim();
            const textAfter = cleanedText.substring(jsonIndex + match.length).trim();
            
            return { 
              json: parsed, 
              textAfter: textBefore + (textBefore && textAfter ? ' ' : '') + textAfter,
              fullText: cleanedText 
            };
          }
        } catch (e) {
          // Continue to next match
        }
      }
    }
    
    return { json: null, textAfter: '', fullText: cleanedText };
  }

  async getAssistantResponse(
    route: string,
    userMessage: string,
    context?: Record<string, any>
  ): Promise<AssistantResponse> {
    // First, check our database for recent knowledge updates
    const dbSearch = await knowledgeSearchService.searchKnowledge(
      userMessage,
      route.toLowerCase()
    );
    
    if (dbSearch.found && dbSearch.confidence > 0.8) {
      logger.info('Using knowledge from database', {
        route,
        source: dbSearch.source,
        confidence: dbSearch.confidence
      });
      
      // Format the database response
      const formattedResponse = this.formatDatabaseResponse(dbSearch.data, route);
      
      return {
        response: formattedResponse,
        assistantId: `db-${route}`,
        threadId: `db-${Date.now()}`,
        confidence: dbSearch.confidence,
        structured: {
          source: 'database',
          category: dbSearch.data.category,
          lastUpdated: dbSearch.data.lastUpdated
        }
      };
    }
    
    if (!this.isEnabled || !this.openai) {
      logger.warn('Assistant service is disabled - returning fallback response');
      return {
        response: this.getFallbackResponse(route, userMessage),
        assistantId: 'fallback',
        threadId: 'fallback',
        confidence: 0.3
      };
    }
    
    try {
      const assistantId = this.assistantMap[route];
      
      if (!assistantId) {
        throw new Error(`No assistant configured for route: ${route}`);
      }

      logger.info('Calling OpenAI Assistant', {
        route,
        assistantId,
        message: userMessage.substring(0, 50) + '...'
      });

      // Create a thread
      const thread = await this.openai.beta.threads.create();

      // Add the user's message to the thread
      await this.openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: userMessage
      });

      // Run the assistant
      const run = await this.openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistantId
      });

      // Wait for the run to complete with timeout
      const startTime = Date.now();
      const timeout = 15000; // 15 seconds
      let runStatus = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
      
      while (runStatus.status !== 'completed' && runStatus.status !== 'failed') {
        if (Date.now() - startTime > timeout) {
          await this.openai.beta.threads.runs.cancel(thread.id, run.id).catch(() => {});
          throw new Error('Assistant response timeout');
        }
        
        await new Promise(resolve => setTimeout(resolve, 250));
        runStatus = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
        
        // Handle function calls if needed
        if (runStatus.status === 'requires_action') {
          logger.info('Assistant wants to call functions, but we\'ll skip them', {
            assistantId,
            requiredAction: runStatus.required_action
          });
          
          const toolCalls = runStatus.required_action?.submit_tool_outputs?.tool_calls || [];
          const emptyOutputs = toolCalls.map((call: any) => ({
            tool_call_id: call.id,
            output: JSON.stringify({ 
              message: "Function execution is disabled. Please provide information instead of trying to perform actions." 
            })
          }));
          
          await this.openai.beta.threads.runs.submitToolOutputs(
            thread.id,
            run.id,
            { tool_outputs: emptyOutputs }
          );
          
          continue;
        }
      }

      if (runStatus.status === 'failed') {
        throw new Error(`Assistant run failed: ${runStatus.last_error?.message || 'Unknown error'}`);
      }

      // Get the assistant's response
      const messages = await this.openai.beta.threads.messages.list(thread.id);
      const assistantMessage = messages.data.find(msg => msg.role === 'assistant');

      if (!assistantMessage) {
        throw new Error('No response from assistant');
      }

      // Extract the text content
      const textContent = assistantMessage.content
        .filter(content => content.type === 'text')
        .map(content => (content as any).text.value)
        .join('\n');

      logger.info('Raw assistant response:', { 
        length: textContent.length,
        preview: textContent.substring(0, 200) + '...'
      });

      // For now, just use the full text content without JSON parsing
      // since the Assistant is having trouble with JSON formatting
      let responseText = textContent;
      
      // Clean up any markdown code blocks if present
      responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').replace(/```/g, '');
      
      // Remove any citation markers
      responseText = responseText.replace(/【[^】]+】/g, '');
      
      // Trim whitespace
      responseText = responseText.trim();
      
      logger.info('Using full text response (JSON parsing disabled)', {
        route,
        textLength: responseText.length,
        preview: responseText.substring(0, 100) + '...'
      });
      
      // Still try to extract metadata if JSON is present, but don't use it for the response
      const { json } = this.extractJsonFromText(textContent);
      let category = json?.category;
      let priority = json?.priority;
      let actions = json?.actions;
      let metadata = json?.metadata;
      let escalation = json?.escalation;

      // Shadow comparison removed - using OpenAI Assistants directly
      
      return {
        response: responseText,
        assistantId,
        threadId: thread.id,
        confidence: 0.9,
        structured: json, // Use the extracted json if any
        category,
        priority,
        actions,
        metadata,
        escalation
      };

    } catch (error: any) {
      logger.error('Assistant API error', {
        route,
        error: error.message,
        stack: error.stack
      });
      
      // Return a fallback response
      return {
        response: this.getFallbackResponse(route, userMessage),
        assistantId: 'fallback',
        threadId: 'fallback',
        confidence: 0.3
      };
    }
  }

  private getFallbackResponse(route: string, userMessage: string): string {
    const fallbacks: Record<string, string> = {
      'Booking & Access': 'I can help you manage customer bookings and access issues. To process this request, please check the booking system or use the access control panel. For immediate assistance with booking disputes or refunds, consult the operations manual.',
      'Emergency': 'For facility emergencies: 1) Ensure customer safety first, 2) Call 911 if needed, 3) Follow emergency protocols in the red binder, 4) Contact facility management at 555-0111, 5) Document the incident.',
      'TechSupport': 'I can help troubleshoot equipment issues. Please describe the specific problem with the simulator or TrackMan system. Common fixes: restart the system, check cable connections, or run diagnostics from the admin panel.',
      'BrandTone': 'I can help you create customer communications and marketing content. Please specify what type of message or content you need to develop for your members or promotional campaigns.'
    };

    return fallbacks[route] || 'System is having trouble processing this request. Please try rephrasing your operational question or contact technical support.';
  }

  private formatDatabaseResponse(data: any, route: string): string {
    const routeTemplates: Record<string, string> = {
      'Booking & Access': `Based on our records: ${data.answer}`,
      'Emergency': `Emergency Protocol: ${data.answer}`,
      'TechSupport': `Technical Solution: ${data.answer}`,
      'BrandTone': `Brand Information: ${data.answer}`
    };

    const template = routeTemplates[route] || `Information: ${data.answer}`;
    
    if (data.lastUpdated) {
      const updateDate = new Date(data.lastUpdated).toLocaleDateString();
      return `${template}\n\n*Last updated: ${updateDate}*`;
    }
    
    return template;
  }

  /**
   * Update assistant knowledge through structured knowledge updates
   * This method is called by the KnowledgeRouter after parsing natural language input
   */
  async updateAssistantKnowledge(
    route: string, 
    knowledge: {
      fact: string;
      tags: string[];
      intent: 'add' | 'update' | 'overwrite';
      category: string;
      key?: string;
    }
  ): Promise<{
    success: boolean;
    message: string;
    assistantId: string;
  }> {
    if (!this.isEnabled || !this.openai) {
      return {
        success: false,
        message: 'Assistant service is disabled',
        assistantId: 'disabled'
      };
    }

    const assistantId = this.assistantMap[route];
    if (!assistantId) {
      return {
        success: false,
        message: `Unknown route: ${route}`,
        assistantId: 'unknown'
      };
    }

    try {
      // Update the assistant's knowledge file
      const fileUpdated = await assistantFileManager.updateKnowledgeFile(
        assistantId,
        knowledge
      );

      if (!fileUpdated) {
        throw new Error('Failed to update knowledge file');
      }

      // Also create a thread to inform the assistant of the update
      const thread = await this.openai.beta.threads.create({
        metadata: {
          type: 'knowledge_update',
          intent: knowledge.intent,
          category: knowledge.category
        }
      });

      // Format the knowledge update message
      const knowledgeMessage = `SYSTEM KNOWLEDGE UPDATE:
Intent: ${knowledge.intent}
Category: ${knowledge.category}
${knowledge.key ? `Key: ${knowledge.key}` : ''}
Tags: ${knowledge.tags.join(', ')}

Fact: ${knowledge.fact}

This knowledge has been added to your knowledge file. You can now reference this information when answering questions.`;

      // Add message to thread
      await this.openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: knowledgeMessage
      });

      // Run the thread to acknowledge the update
      const run = await this.openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistantId,
        instructions: 'Acknowledge the knowledge update. Your knowledge file has been updated with this information.'
      });

      // Wait for completion (with timeout)
      let runStatus = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
      let attempts = 0;
      while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
        attempts++;
      }

      if (runStatus.status === 'failed') {
        logger.warn('Assistant failed to acknowledge update, but knowledge file was updated');
      }

      // Verify the knowledge was stored
      const verification = await assistantFileManager.verifyKnowledge(
        assistantId,
        knowledge.fact.substring(0, 50) // Search for first 50 chars
      );

      logger.info('Knowledge update successful', {
        route,
        assistantId,
        category: knowledge.category,
        intent: knowledge.intent,
        verified: verification.found
      });

      return {
        success: true,
        message: `Knowledge successfully updated in ${route} assistant's file${verification.found ? ' (verified)' : ''}`,
        assistantId
      };
    } catch (error) {
      logger.error('Failed to update assistant knowledge:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        assistantId
      };
    }
  }
}

// Only create instance if we have an API key
let assistantServiceInstance: AssistantService | null = null;

try {
  assistantServiceInstance = new AssistantService();
} catch (error) {
  logger.error('Failed to initialize AssistantService:', error);
}

export const assistantService = assistantServiceInstance;
