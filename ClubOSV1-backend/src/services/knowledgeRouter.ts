import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { config } from '../utils/envValidator';

interface KnowledgeUpdate {
  intent: 'add' | 'update' | 'overwrite';
  category: string;
  key?: string;
  value: string;
  target_assistant: 'emergency' | 'booking' | 'tech' | 'brand';
  metadata?: any;
}

interface RouteResult {
  success: boolean;
  assistant: string;
  message: string;
  error?: string;
}

export class KnowledgeRouterService {
  private openai: OpenAI;
  private assistantIds: Record<string, string>;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey
    });

    // Map assistant types to their IDs
    this.assistantIds = {
      emergency: 'asst_jOWRzC9eOMRsupRqMWR5hc89',
      booking: 'asst_E2CrYEtb5CKJGPZYdE7z7VAq',
      tech: 'asst_Xax6THdGRHYJwPbRi9OoQrRF',
      brand: 'asst_1vMUEQ7oTIYrCFG1BhgpwMkw'
    };
  }

  /**
   * Parse natural language input into structured knowledge update
   */
  async parseKnowledgeInput(input: string, userId?: string): Promise<KnowledgeUpdate> {
    try {
      const systemPrompt = `You are a knowledge router for ClubOS. Parse the user's input to extract knowledge updates for the AI assistants.

Categories and their purposes:
- emergency: Fire, medical, security, evacuations, urgent safety issues
- booking: Reservations, access control, membership, refunds, credits
- tech: TrackMan, simulators, hardware issues, technical support
- brand: Company info, tone, marketing, competitors, pricing

Extract the following information:
1. intent: "add" (new info), "update" (modify existing), or "overwrite" (replace all)
2. category: The type of knowledge (Checklist, Brand, Competitor, SOP, Pricing, etc.)
3. key: Optional identifier for updates/overwrites (e.g., "Clubhouse Grey color")
4. value: The actual knowledge content
5. target_assistant: Which assistant should receive this (emergency/booking/tech/brand)

Examples:
- "Add HDMI fix to checklist" → {intent: "add", category: "Checklist", value: "HDMI fix steps...", target_assistant: "tech"}
- "Update Clubhouse Grey to #503285" → {intent: "update", category: "Brand", key: "Clubhouse Grey", value: "#503285", target_assistant: "brand"}
- "Nick Wang is opening a Better Golf location in PEI" → {intent: "add", category: "Competitor", value: "Nick Wang - Better Golf - PEI location", target_assistant: "brand"}

Respond with valid JSON only.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const parsed = JSON.parse(completion.choices[0].message.content || '{}');
      
      // Validate the parsed result
      if (!parsed.intent || !parsed.target_assistant || !parsed.value) {
        throw new Error('Invalid knowledge update format');
      }

      // Log the parsing for audit
      await this.logKnowledgeUpdate(parsed, userId);

      return parsed as KnowledgeUpdate;
    } catch (error) {
      logger.error('Failed to parse knowledge input:', error);
      throw new Error('Failed to parse knowledge input. Please check the format.');
    }
  }

  /**
   * Route knowledge update to the appropriate assistant
   */
  async routeToAssistant(update: KnowledgeUpdate): Promise<RouteResult> {
    try {
      // Import assistant service dynamically to avoid circular dependencies
      const { assistantService } = await import('./assistantService');
      
      if (!assistantService) {
        throw new Error('Assistant service not initialized');
      }

      // Map assistant types to route names used by assistant service
      const routeMap: Record<string, string> = {
        emergency: 'Emergency',
        booking: 'Booking & Access',
        tech: 'TechSupport',
        brand: 'BrandTone'
      };

      const route = routeMap[update.target_assistant];
      if (!route) {
        throw new Error(`Unknown assistant type: ${update.target_assistant}`);
      }

      // Prepare tags based on the update
      const tags = [
        update.category.toLowerCase(),
        update.target_assistant,
        update.intent
      ];
      
      if (update.key) {
        tags.push(update.key.toLowerCase());
      }

      // Use the assistant service to update knowledge
      const result = await assistantService.updateAssistantKnowledge(route, {
        fact: update.value,
        tags,
        intent: update.intent,
        category: update.category,
        key: update.key
      });

      if (result.success) {
        logger.info('Knowledge successfully routed to assistant:', {
          assistant: update.target_assistant,
          route,
          assistantId: result.assistantId
        });
      }

      return {
        success: result.success,
        assistant: update.target_assistant,
        message: result.message,
        error: result.success ? undefined : result.message
      };
    } catch (error) {
      logger.error('Failed to route to assistant:', error);
      return {
        success: false,
        assistant: update.target_assistant,
        message: 'Failed to route knowledge',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Format knowledge update for assistant consumption
   */
  private formatKnowledgeForAssistant(update: KnowledgeUpdate): string {
    const timestamp = new Date().toISOString();
    
    switch (update.intent) {
      case 'add':
        return `[NEW KNOWLEDGE - ${timestamp}]\nCategory: ${update.category}\n${update.value}`;
      
      case 'update':
        return `[UPDATED KNOWLEDGE - ${timestamp}]\nCategory: ${update.category}\nKey: ${update.key || 'N/A'}\nNew Value: ${update.value}`;
      
      case 'overwrite':
        return `[OVERWRITE - ${timestamp}]\nCategory: ${update.category}\nReplacing all ${update.category} knowledge with:\n${update.value}`;
      
      default:
        return `[KNOWLEDGE - ${timestamp}]\n${update.value}`;
    }
  }

  /**
   * Log knowledge update for audit trail
   */
  private async logKnowledgeUpdate(update: KnowledgeUpdate, userId?: string): Promise<void> {
    if (!db.initialized) return;

    try {
      await db.query(`
        INSERT INTO knowledge_audit_log 
        (action, category, key, new_value, user_id, assistant_target, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        update.intent,
        update.category,
        update.key || null,
        update.value,
        userId || null,
        update.target_assistant,
        JSON.stringify(update.metadata || {})
      ]);

      // Check if we need to send Slack notification
      if (update.intent === 'overwrite' || 
          update.category === 'Pricing' || 
          update.category === 'SOP') {
        await this.notifySlack(update);
      }
    } catch (error) {
      logger.error('Failed to log knowledge update:', error);
    }
  }

  /**
   * Send Slack notification for critical updates
   */
  private async notifySlack(update: KnowledgeUpdate): Promise<void> {
    if (!config.slackWebhookUrl) return;

    try {
      const message = {
        text: `🔔 Critical Knowledge Update`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Action:* ${update.intent.toUpperCase()}\n*Category:* ${update.category}\n*Assistant:* ${update.target_assistant}\n*Value:* ${update.value.substring(0, 100)}...`
            }
          }
        ]
      };

      // Send to Slack webhook
      await fetch(config.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });

      // Mark as notified in audit log
      await db.query(`
        UPDATE knowledge_audit_log 
        SET slack_notified = true 
        WHERE assistant_target = $1 
        ORDER BY timestamp DESC 
        LIMIT 1
      `, [update.target_assistant]);
    } catch (error) {
      logger.error('Failed to send Slack notification:', error);
    }
  }

  /**
   * Get recent knowledge updates for monitoring
   */
  async getRecentUpdates(limit: number = 20): Promise<any[]> {
    if (!db.initialized) return [];

    try {
      const result = await db.query(`
        SELECT * FROM knowledge_audit_log
        ORDER BY timestamp DESC
        LIMIT $1
      `, [limit]);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get recent updates:', error);
      return [];
    }
  }
}

// Export singleton instance
export const knowledgeRouter = new KnowledgeRouterService();