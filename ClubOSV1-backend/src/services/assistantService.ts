import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { config } from '../utils/envValidator';

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
  }

  async getAssistantResponse(
    route: string,
    userMessage: string,
    context?: Record<string, any>
  ): Promise<AssistantResponse> {
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
        message: userMessage.substring(0, 50) + '...',
        hasAssistantId: !!assistantId,
        assistantMapKeys: Object.keys(this.assistantMap)
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
      const timeout = 15000; // Reduced to 15 seconds
      let runStatus = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
      
      while (runStatus.status !== 'completed' && runStatus.status !== 'failed') {
        if (Date.now() - startTime > timeout) {
          await this.openai.beta.threads.runs.cancel(thread.id, run.id).catch(() => {});
          throw new Error('Assistant response timeout');
        }
        
        await new Promise(resolve => setTimeout(resolve, 250)); // Check 4 times per second
        runStatus = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
        
        // Handle function calls if needed
        if (runStatus.status === 'requires_action') {
          logger.info('Assistant wants to call functions, but we\'ll skip them', {
            assistantId,
            requiredAction: runStatus.required_action
          });
          
          // Submit empty outputs to continue without executing functions
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
          
          // Continue waiting for completion
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

      // Clean up the response - remove markdown code blocks and citations
      let cleanedContent = textContent;
      
      // Remove markdown code blocks
      cleanedContent = cleanedContent.replace(/```json\n/g, '').replace(/```\n/g, '').replace(/```/g, '');
      
      // Remove citations like 【4:0†source】
      cleanedContent = cleanedContent.replace(/【[^】]+】/g, '');
      
      // Trim extra whitespace
      cleanedContent = cleanedContent.trim();

      // Try to parse as JSON if the response looks like JSON
      let structuredResponse = null;
      let responseText = cleanedContent;
      let category = undefined;
      let priority = undefined;
      let actions = undefined;
      let metadata = undefined;
      let escalation = undefined;
      
      try {
        // Look for JSON anywhere in the response
        const jsonMatch = cleanedContent.match(/\{[\s\S]*?\}(?=\s*(?:In case|$))/);  
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.response) {
              structuredResponse = parsed;
              responseText = parsed.response;
              category = parsed.category;
              priority = parsed.priority;
              actions = parsed.actions;
              metadata = parsed.metadata;
              escalation = parsed.escalation;
              
              // Get any text after the JSON
              const afterJsonIndex = jsonMatch.index! + jsonMatch[0].length;
              const afterJson = cleanedContent.substring(afterJsonIndex).trim();
              
              // If there's meaningful text after JSON, append it
              if (afterJson && afterJson.length > 10) {
                responseText = responseText + '\n\n' + afterJson;
              }
              
              logger.info('Successfully parsed JSON from assistant response', {
                route,
                category,
                priority,
                hasActions: !!actions?.length,
                hasAfterText: !!afterJson
              });
            } else {
              // JSON doesn't have response field, use the whole text
              responseText = cleanedContent;
            }
          } catch (e) {
            logger.warn('Failed to parse JSON from response', { error: e });
            responseText = cleanedContent;
          }
        } else if (cleanedContent.trim().startsWith('{')) {
          // Try to parse the whole thing as JSON
          try {
            const parsed = JSON.parse(cleanedContent);
            if (parsed.response) {
              structuredResponse = parsed;
              responseText = parsed.response;
              category = parsed.category;
              priority = parsed.priority;
              actions = parsed.actions;
              metadata = parsed.metadata;
              escalation = parsed.escalation;
            }
          } catch (e) {
            // Not valid JSON
            responseText = cleanedContent;
          }
        }
      } catch (e) {
        // Error in parsing, use as plain text
        logger.error('Error parsing assistant response', { error: e });
        responseText = cleanedContent;
      }

      return {
        response: responseText,
        assistantId,
        threadId: thread.id,
        confidence: 0.9, // High confidence since it's from the actual assistant
        structured: structuredResponse,
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
      'Booking & Access': 'I can help you with bookings and access. Please contact the front desk at 555-0100 for immediate assistance.',
      'Emergency': 'For emergencies, please call 911 immediately or contact facility management at 555-0111.',
      'TechSupport': 'For technical support, please describe your issue and I\'ll help troubleshoot or create a support ticket.',
      'BrandTone': 'I can provide information about our memberships, promotions, and facilities. What would you like to know?'
    };

    return fallbacks[route] || 'I\'m having trouble processing your request. Please try again or contact support.';
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
