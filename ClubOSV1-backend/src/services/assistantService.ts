import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { config } from '../utils/envValidator';
import { db } from '../utils/database';
import { intelligentSOPModule } from './intelligentSOPModule';

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
    // Shadow Mode: Run SOP module in parallel but don't use response yet
    const shadowMode = process.env.SOP_SHADOW_MODE === 'true';
    const useIntelligentSOP = process.env.USE_INTELLIGENT_SOP === 'true';
    
    let sopShadowId: string | null = null;
    
    if (shadowMode || useIntelligentSOP) {
      // Try SOP module in shadow mode or for actual use
      try {
        const sopStart = Date.now();
        const sopResponse = await intelligentSOPModule.processWithContext(
          userMessage,
          route,
          context
        );
        const sopTime = Date.now() - sopStart;
        
        // Log comparison
        logger.info(shadowMode ? 'SHADOW MODE - SOP Response' : 'SOP MODULE Response', {
          route,
          confidence: sopResponse.confidence,
          responseTime: sopTime,
          responsePreview: sopResponse.response?.substring(0, 100)
        });
        
        // Store comparison for analysis (we'll fill assistant response later)
        if (db.initialized && shadowMode) {
          const result = await db.query(`
            INSERT INTO sop_shadow_comparisons 
            (query, route, assistant_response, sop_response, sop_confidence, sop_time_ms)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
          `, [
            userMessage,
            route,
            '', // Will be updated after Assistant response
            sopResponse.response,
            sopResponse.confidence,
            sopTime
          ]);
          
          sopShadowId = result.rows[0]?.id;
        }
        
        // If USE_INTELLIGENT_SOP is true (not shadow mode), use SOP response
        if (useIntelligentSOP && !shadowMode) {
          const confidenceThreshold = parseFloat(process.env.SOP_CONFIDENCE_THRESHOLD || '0.75');
          
          // When SOP mode is active, ALWAYS use SOP response (no fallback)
          logger.info('Using SOP response (SOP Mode Active)', {
            route,
            confidence: sopResponse.confidence,
            threshold: confidenceThreshold,
            meetsThreshold: sopResponse.confidence >= confidenceThreshold
          });
          
          // Return SOP response even if confidence is low
          if (sopResponse.confidence === 0 && sopResponse.source === 'no_match') {
            return {
              response: `Nobody told me that answer yet... 

**Turn off Smart Assist and send to a human so I can learn!**

To send to human:
1. Toggle OFF the "Smart Assist" switch
2. Submit the request again
3. A human will receive and respond to your request

Once a human answers, administrators can add this knowledge through the Knowledge Extraction panel so I can help with similar questions in the future.`,
              assistantId: `sop-${route}`,
              threadId: `sop-${Date.now()}`,
              confidence: 0,
              structured: {
                text: "Nobody told me that answer yet... turn off Smart Assist and send to a human so I can learn",
                category: "no_data",
                priority: "low"
              }
            };
          }
          
          return {
            response: sopResponse.response,
            assistantId: `sop-${route}`,
            threadId: `sop-${Date.now()}`,
            confidence: sopResponse.confidence,
            structured: sopResponse.structured
          };
        }
      } catch (error) {
        logger.error('SOP module error:', error);
      }
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

      // Update shadow comparison if we have one
      if (sopShadowId && db.initialized) {
        const assistantTime = Date.now() - startTime;
        await db.query(`
          UPDATE sop_shadow_comparisons 
          SET assistant_response = $1,
              assistant_time_ms = $2
          WHERE id = $3
        `, [responseText, assistantTime, sopShadowId]).catch(err => {
          logger.error('Failed to update shadow comparison:', err);
        });
      }
      
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
}

// Only create instance if we have an API key
let assistantServiceInstance: AssistantService | null = null;

try {
  assistantServiceInstance = new AssistantService();
} catch (error) {
  logger.error('Failed to initialize AssistantService:', error);
}

export const assistantService = assistantServiceInstance;
