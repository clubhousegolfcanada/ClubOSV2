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
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-demo-key-not-for-production') {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    } else {
      logger.warn('OpenAI API key not configured - knowledge router will not be able to parse updates');
      this.openai = null as any;
    }

    // Map assistant types to their IDs from environment variables with correct fallbacks
    this.assistantIds = {
      emergency: process.env.EMERGENCY_GPT_ID || 'asst_MIBSjbcKE6mkJQnEKgLrfYE2',
      booking: process.env.BOOKING_ACCESS_GPT_ID || 'asst_YeWa98dP4Dv0eXwviMsCHeE7',
      tech: process.env.TECH_SUPPORT_GPT_ID || 'asst_Uwu1EQXHPYuW5Q06FKqya5Ak',
      brand: process.env.BRAND_MARKETING_GPT_ID || 'asst_7YqDqjc4bmWk1kcvXVhecpTS'
    };
  }

  /**
   * Parse natural language input into structured knowledge update
   */
  async parseKnowledgeInput(input: string, userId?: string): Promise<KnowledgeUpdate> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }
    
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
      } else {
        logger.error('Failed to update assistant knowledge:', {
          assistant: update.target_assistant,
          route,
          error: result.message
        });
      }

      return {
        success: result.success,
        assistant: update.target_assistant,
        message: result.success ? `Knowledge updated for ${update.target_assistant} assistant` : result.message,
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
   * Log knowledge update for audit trail and store in knowledge_store
   */
  private async logKnowledgeUpdate(update: KnowledgeUpdate, userId?: string): Promise<void> {
    if (!db.initialized) return;

    try {
      // Save to audit log (existing functionality)
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

      // IMPORTANT: Also save to knowledge_store for searching
      await this.saveToKnowledgeStore(update, userId);

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
   * Save knowledge to the searchable knowledge_store table
   */
  private async saveToKnowledgeStore(update: KnowledgeUpdate, userId?: string): Promise<void> {
    try {
      // Create a structured key using dot notation
      const storeKey = `${update.target_assistant}.${update.category.toLowerCase()}${update.key ? '.' + update.key.toLowerCase().replace(/\s+/g, '_') : ''}`;
      
      // Structure the value as searchable JSON
      const storeValue = {
        title: update.key || update.category,
        content: update.value,
        category: update.category,
        assistant: update.target_assistant,
        intent: update.intent,
        metadata: update.metadata || {}
      };

      // Determine confidence based on intent
      const confidence = update.intent === 'overwrite' ? 1.0 : 0.8;

      if (update.intent === 'add') {
        // Insert new knowledge
        await db.query(`
          INSERT INTO knowledge_store (key, value, confidence, verification_status, source_type, created_by)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (key) DO UPDATE SET
            value = EXCLUDED.value,
            confidence = GREATEST(knowledge_store.confidence, EXCLUDED.confidence),
            verification_status = CASE 
              WHEN EXCLUDED.confidence > knowledge_store.confidence THEN EXCLUDED.verification_status
              ELSE knowledge_store.verification_status
            END,
            source_count = knowledge_store.source_count + 1,
            updated_at = NOW()
        `, [storeKey, JSON.stringify(storeValue), confidence, 'verified', 'manual', userId]);
      } else if (update.intent === 'update') {
        // Update existing knowledge
        await db.query(`
          INSERT INTO knowledge_store (key, value, confidence, verification_status, source_type, created_by)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (key) DO UPDATE SET
            value = EXCLUDED.value,
            confidence = EXCLUDED.confidence,
            verification_status = EXCLUDED.verification_status,
            updated_at = NOW()
        `, [storeKey, JSON.stringify(storeValue), confidence, 'verified', 'manual', userId]);
      } else if (update.intent === 'overwrite') {
        // Overwrite - mark old entries as superseded and insert new
        await db.query(`
          UPDATE knowledge_store 
          SET superseded_by = gen_random_uuid()
          WHERE key LIKE $1 || '%' AND superseded_by IS NULL
        `, [update.target_assistant + '.' + update.category.toLowerCase()]);

        await db.query(`
          INSERT INTO knowledge_store (key, value, confidence, verification_status, source_type, created_by)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [storeKey, JSON.stringify(storeValue), confidence, 'verified', 'manual', userId]);
      }

      logger.info('Knowledge saved to knowledge_store:', {
        key: storeKey,
        intent: update.intent,
        assistant: update.target_assistant,
        category: update.category
      });
    } catch (error) {
      logger.error('Failed to save to knowledge_store:', error);
    }
  }

  /**
   * Send Slack notification for critical updates
   */
  private async notifySlack(update: KnowledgeUpdate): Promise<void> {
    if (!config.SLACK_WEBHOOK_URL) return;

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
      await fetch(config.SLACK_WEBHOOK_URL, {
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