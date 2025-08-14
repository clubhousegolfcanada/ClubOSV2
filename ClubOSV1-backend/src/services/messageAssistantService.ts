import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { encrypt, decrypt } from '../utils/encryption';
import { assistantService } from './assistantService';
import { promptTemplateService } from './promptTemplateService';

interface Message {
  id: string;
  text?: string;
  body?: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  createdAt: string;
}

interface SuggestedResponse {
  id: string;
  messageId: string;
  conversationId: string;
  suggestedText: string;
  confidence: number;
  context?: string;
  createdBy: string;
  approved: boolean;
  sent: boolean;
  createdAt: Date;
}

export class MessageAssistantService {
  /**
   * Generate a suggested response for a message
   */
  async generateSuggestedResponse(
    conversationId: string,
    phoneNumber: string,
    messages: Message[],
    userId: string
  ): Promise<SuggestedResponse> {
    try {
      // Get recent conversation history
      const conversationHistory = this.formatConversationHistory(messages);
      
      // Get relevant knowledge from previous interactions
      const relevantKnowledge = await this.getRelevantKnowledge(messages[messages.length - 1].text || '');
      
      // Build context for the assistant with customer safety instructions
      const customerMessage = messages[messages.length - 1].text || messages[messages.length - 1].body || '';
      
      // Determine the best route based on the message content
      let route = 'BrandTone'; // Default to brand/marketing assistant for general inquiries
      const lowerMessage = customerMessage.toLowerCase();
      
      if (lowerMessage.includes('book') || lowerMessage.includes('reserve') || lowerMessage.includes('cancel') || lowerMessage.includes('reschedule')) {
        route = 'Booking & Access';
      } else if (lowerMessage.includes('tech') || lowerMessage.includes('problem') || lowerMessage.includes('issue') || lowerMessage.includes('not work') || 
                 lowerMessage.includes('trackman') || lowerMessage.includes('frozen') || lowerMessage.includes('stuck') || lowerMessage.includes('error')) {
        route = 'TechSupport';
      } else if (lowerMessage.includes('emergency') || lowerMessage.includes('urgent') || lowerMessage.includes('help')) {
        route = 'Emergency';
      }
      
      logger.info('Message routing decision', {
        customerMessage: customerMessage.substring(0, 50) + '...',
        detectedRoute: route,
        conversationId,
        phoneNumber: phoneNumber.slice(-4) // Log only last 4 digits
      });
      
      // Get the prompt template from database
      const template = await promptTemplateService.getTemplate('customer_message_response');
      
      let customerContext: string;
      
      if (template) {
        // Use the template from database
        customerContext = promptTemplateService.applyTemplate(template.template, {
          conversation_history: conversationHistory,
          relevant_knowledge: relevantKnowledge ? `RELEVANT PUBLIC KNOWLEDGE:\n${relevantKnowledge}\n\n` : '',
          customer_message: customerMessage
        });
      } else {
        // Fallback to hardcoded prompt if template not found
        customerContext = `CRITICAL INSTRUCTIONS - YOU ARE RESPONDING TO A CUSTOMER:

1. You are generating a suggested response to a CUSTOMER text message
2. NEVER mention:
   - Internal systems (ClubOS, databases, etc.)
   - Employee names or personal information
   - Business operations details
   - Pricing structures or discounts not publicly advertised
   - Security procedures or access codes
   - Any confidential business information

3. AVOID generic responses like:
   - "How can I assist you today?"
   - "Thank you for reaching out"
   - "Feel free to let me know"
   - "For detailed inquiries..."

4. BE SPECIFIC and helpful:
   - Answer their actual question directly
   - If you don't know, say "I'll need to check on that for you"
   - Never tell them to call or visit - this IS the way they're contacting us
   - If unsure, indicate a human will follow up

5. IMPORTANT: This text conversation IS their primary way to reach us. Do NOT suggest calling or visiting.

CONVERSATION HISTORY:
${conversationHistory}

${relevantKnowledge ? `RELEVANT PUBLIC KNOWLEDGE:\n${relevantKnowledge}\n\n` : ''}CUSTOMER'S CURRENT MESSAGE: ${customerMessage}

Generate a specific, helpful response. If you cannot provide a useful answer, respond with: "I'll need to check on that and get back to you shortly."`;
      }

      // Use the assistant service with the appropriate route
      // Pass the actual customer message to the assistant, not the full prompt
      const assistantResponse = await assistantService.getAssistantResponse(
        route,
        customerMessage, // Pass just the customer's message
        {
          userId: userId,
          isCustomerFacing: true,
          conversationId: conversationId,
          conversationHistory: conversationHistory,
          relevantKnowledge: relevantKnowledge
        }
      );

      // Log the raw assistant response for debugging
      logger.info('Assistant raw response for debugging', {
        route,
        customerMessage: customerMessage.substring(0, 100),
        rawResponse: assistantResponse.response?.substring(0, 500),
        responseLength: assistantResponse.response?.length,
        assistantId: assistantResponse.assistantId,
        confidence: assistantResponse.confidence
      });

      // Filter the response for customer safety
      let suggestedText = assistantResponse.response || '';
      
      // Additional safety filtering - remove any accidental internal references
      const internalTerms = [
        'ClubOS', 'database', 'system', 'backend', 'API', 'admin',
        'employee', 'staff', 'internal', 'confidential', 'password',
        'login', 'access code', 'security', 'SQL', 'error log'
      ];
      
      let hadInternalTerms = false;
      for (const term of internalTerms) {
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        if (regex.test(suggestedText)) {
          hadInternalTerms = true;
          suggestedText = suggestedText.replace(regex, '[removed]');
        }
      }
      
      // Log if internal terms were found
      if (hadInternalTerms) {
        logger.warn('Internal terms found and removed from response', {
          route,
          originalLength: assistantResponse.response?.length,
          filteredLength: suggestedText.length
        });
      }
      
      // Ensure the response is appropriate
      if (suggestedText.includes('[removed]') || suggestedText.length < 10) {
        logger.info('Response too short or contains removed terms, using fallback', {
          route,
          responseLength: suggestedText.length,
          hasRemoved: suggestedText.includes('[removed]')
        });
        suggestedText = "I'll need to check on that and get back to you shortly.";
      }
      
      // Check for generic unhelpful responses
      const genericPhrases = [
        'how can i assist you',
        'how may i help you',
        'thank you for reaching out',
        'feel free to let me know',
        'for detailed inquiries',
        'call or visit',
        'visit our facility',
        'call us directly'
      ];
      
      const lowerResponse = suggestedText.toLowerCase();
      const isGeneric = genericPhrases.some(phrase => lowerResponse.includes(phrase));
      
      // Log if generic phrase detected
      if (isGeneric) {
        const foundPhrases = genericPhrases.filter(phrase => lowerResponse.includes(phrase));
        logger.info('Generic phrases detected in response', {
          route,
          foundPhrases,
          responsePreview: suggestedText.substring(0, 200)
        });
      }
      
      // Calculate confidence based on various factors
      let confidence = this.calculateConfidence(messages, suggestedText, relevantKnowledge);
      
      // Only use fallback for truly generic responses, not for Trackman/technical issues
      if (isGeneric && !lowerMessage.includes('trackman') && !lowerMessage.includes('frozen')) {
        // If the response is too generic and NOT about technical issues, indicate human handoff needed
        logger.info('Using fallback for generic non-technical response', {
          route,
          customerMessage: customerMessage.substring(0, 100)
        });
        suggestedText = "I'll need to check on that and get back to you shortly.";
        // Reduce confidence significantly
        confidence = Math.min(confidence, 0.3);
      } else if (lowerMessage.includes('trackman') || lowerMessage.includes('frozen')) {
        // For Trackman/technical issues, ensure we keep the assistant's response
        logger.info('Keeping assistant response for Trackman/technical issue', {
          route,
          responseLength: suggestedText.length,
          isGeneric,
          confidence
        });
      }
      
      // Store the suggestion (encrypted)
      const suggestionId = await this.storeSuggestion({
        conversationId,
        phoneNumber,
        messageId: messages[messages.length - 1].id,
        suggestedText,
        confidence,
        context: relevantKnowledge,
        createdBy: userId
      });
      
      logger.info('Generated message suggestion', {
        conversationId,
        phoneNumber: phoneNumber.slice(-4), // Log only last 4 digits
        confidence,
        userId
      });
      
      return {
        id: suggestionId,
        messageId: messages[messages.length - 1].id,
        conversationId,
        suggestedText,
        confidence,
        context: relevantKnowledge,
        createdBy: userId,
        approved: false,
        sent: false,
        createdAt: new Date()
      };
    } catch (error) {
      logger.error('Failed to generate suggested response:', error);
      throw error;
    }
  }
  
  /**
   * Format conversation history for the prompt
   */
  private formatConversationHistory(messages: Message[]): string {
    // Only include last 10 messages for context
    const recentMessages = messages.slice(-10);
    
    return recentMessages.map(msg => {
      const sender = msg.direction === 'inbound' ? 'Customer' : 'Agent';
      const text = msg.text || msg.body || '';
      return `${sender}: ${text}`;
    }).join('\n');
  }
  
  /**
   * Get relevant knowledge from previous interactions
   */
  private async getRelevantKnowledge(query: string): Promise<string | null> {
    try {
      const result = await db.query(`
        SELECT problem, solution, confidence 
        FROM extracted_knowledge 
        WHERE problem ILIKE $1 OR solution ILIKE $1
        ORDER BY confidence DESC, created_at DESC
        LIMIT 3
      `, [`%${query}%`]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows.map(row => 
        `Problem: ${row.problem}\nSolution: ${row.solution}`
      ).join('\n\n');
    } catch (error) {
      logger.error('Failed to get relevant knowledge:', error);
      return null;
    }
  }
  
  /**
   * Calculate confidence score for the suggestion
   */
  private calculateConfidence(
    messages: Message[], 
    suggestedText: string, 
    relevantKnowledge: string | null
  ): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence if we have relevant knowledge
    if (relevantKnowledge) {
      confidence += 0.2;
    }
    
    // Increase confidence if conversation history is substantial
    if (messages.length >= 3) {
      confidence += 0.1;
    }
    
    // Decrease confidence for very short or very long responses
    const wordCount = suggestedText.split(' ').length;
    if (wordCount < 5 || wordCount > 100) {
      confidence -= 0.1;
    }
    
    // Check if this is a handoff message
    if (suggestedText.includes("I'll need to check") || suggestedText.includes("get back to you")) {
      confidence = 0.3; // Low confidence indicates human should take over
    }
    
    // Cap confidence between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }
  
  /**
   * Store suggestion in database
   */
  private async storeSuggestion(data: {
    conversationId: string;
    phoneNumber: string;
    messageId: string;
    suggestedText: string;
    confidence: number;
    context: string | null;
    createdBy: string;
  }): Promise<string> {
    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS message_suggestions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id VARCHAR(255) NOT NULL,
        phone_number_hash VARCHAR(64) NOT NULL,
        message_id VARCHAR(255) NOT NULL,
        suggested_text TEXT NOT NULL,
        suggested_text_encrypted TEXT NOT NULL,
        confidence FLOAT NOT NULL,
        context TEXT,
        created_by UUID NOT NULL REFERENCES users(id),
        approved BOOLEAN DEFAULT FALSE,
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMP,
        sent BOOLEAN DEFAULT FALSE,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(message_id)
      )
    `);
    
    // Create index for performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_message_suggestions_conversation 
      ON message_suggestions(conversation_id);
      
      CREATE INDEX IF NOT EXISTS idx_message_suggestions_phone_hash 
      ON message_suggestions(phone_number_hash);
    `).catch(() => {}); // Ignore if already exists
    
    // Encrypt sensitive data
    const encryptedText = encrypt(data.suggestedText);
    const phoneHash = require('crypto').createHash('sha256').update(data.phoneNumber).digest('hex');
    
    const result = await db.query(`
      INSERT INTO message_suggestions (
        conversation_id,
        phone_number_hash,
        message_id,
        suggested_text,
        suggested_text_encrypted,
        confidence,
        context,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      data.conversationId,
      phoneHash,
      data.messageId,
      '', // Don't store unencrypted version in production
      encryptedText,
      data.confidence,
      data.context,
      data.createdBy
    ]);
    
    return result.rows[0].id;
  }
  
  /**
   * Approve a suggestion
   */
  async approveSuggestion(suggestionId: string, userId: string): Promise<void> {
    await db.query(`
      UPDATE message_suggestions 
      SET approved = TRUE, approved_by = $1, approved_at = NOW()
      WHERE id = $2
    `, [userId, suggestionId]);
    
    logger.info('Suggestion approved', { suggestionId, userId });
  }
  
  /**
   * Mark suggestion as sent
   */
  async markSuggestionAsSent(suggestionId: string): Promise<void> {
    await db.query(`
      UPDATE message_suggestions 
      SET sent = TRUE, sent_at = NOW()
      WHERE id = $2
    `, [suggestionId]);
  }
  
  /**
   * Get suggestion by ID
   */
  async getSuggestion(suggestionId: string): Promise<SuggestedResponse | null> {
    const result = await db.query(`
      SELECT * FROM message_suggestions WHERE id = $1
    `, [suggestionId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    
    // Decrypt the suggested text
    const suggestedText = decrypt(row.suggested_text_encrypted);
    
    return {
      id: row.id,
      messageId: row.message_id,
      conversationId: row.conversation_id,
      suggestedText,
      confidence: row.confidence,
      context: row.context,
      createdBy: row.created_by,
      approved: row.approved,
      sent: row.sent,
      createdAt: row.created_at
    };
  }
  
  /**
   * Get conversation statistics
   */
  async getConversationStats(days: number = 30): Promise<any> {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_suggestions,
        COUNT(CASE WHEN approved = TRUE THEN 1 END) as approved_suggestions,
        COUNT(CASE WHEN sent = TRUE THEN 1 END) as sent_suggestions,
        AVG(confidence) as avg_confidence,
        COUNT(CASE WHEN confidence > 0.7 THEN 1 END) as high_confidence_count
      FROM message_suggestions
      WHERE created_at > NOW() - INTERVAL '${days} days'
    `);
    
    return result.rows[0];
  }
}

// Export singleton instance
export const messageAssistantService = new MessageAssistantService();