import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { encrypt, decrypt } from '../utils/encryption';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
      
      // Generate response using GPT-4
      const prompt = `You are a helpful customer service assistant. Based on the conversation history and any relevant knowledge, suggest an appropriate response to the customer's last message.

Conversation History:
${conversationHistory}

${relevantKnowledge ? `Relevant Knowledge from Previous Interactions:\n${relevantKnowledge}\n` : ''}

Guidelines:
1. Be helpful, professional, and concise
2. Use the knowledge base to provide accurate information
3. If you're unsure, suggest asking for clarification
4. Keep the tone friendly but professional
5. Address the customer's specific question or concern

Suggested response:`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful customer service assistant. Generate appropriate responses based on conversation context.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      });

      const suggestedText = response.choices[0].message.content?.trim() || '';
      
      // Calculate confidence based on various factors
      const confidence = this.calculateConfidence(messages, suggestedText, relevantKnowledge);
      
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