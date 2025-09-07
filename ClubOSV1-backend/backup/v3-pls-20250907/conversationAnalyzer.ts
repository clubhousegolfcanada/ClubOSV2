/**
 * Conversation Analyzer Service
 * 
 * Intelligently detects conversation boundaries, extracts context,
 * and organizes pattern learning data
 */

import { db } from '../utils/database';
import { logger } from '../utils/logger';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface ConversationContext {
  intent: string;
  entities: {
    dates?: string[];
    times?: string[];
    locations?: string[];
    services?: string[];
    issues?: string[];
  };
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'low' | 'medium' | 'high';
  category: string;
  requiredActions: string[];
  isComplete: boolean;
  summary: string;
}

interface ConversationBoundary {
  conversationId: string;
  startTime: Date;
  endTime: Date;
  messageCount: number;
  isComplete: boolean;
  resolution?: string;
}

export class ConversationAnalyzer {
  /**
   * Detect if a conversation has ended based on multiple signals
   */
  async detectConversationEnd(
    messages: any[],
    lastMessageTime: Date,
    currentTime: Date = new Date()
  ): Promise<boolean> {
    // Sort messages by time
    const sortedMessages = messages.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    // Check time-based signals
    const timeSinceLastMessage = (currentTime.getTime() - lastMessageTime.getTime()) / 1000 / 60; // minutes
    
    // Adaptive timeout based on conversation pattern
    const avgResponseTime = this.calculateAverageResponseTime(sortedMessages);
    const dynamicTimeout = Math.max(
      60, // minimum 1 hour
      Math.min(
        1440, // maximum 24 hours
        avgResponseTime * 5 // 5x the average response time
      )
    );
    
    if (timeSinceLastMessage > dynamicTimeout) {
      return true;
    }
    
    // Check content-based signals
    const lastMessage = sortedMessages[sortedMessages.length - 1];
    const closingSignals = [
      'thank you', 'thanks', 'perfect', 'great', 'awesome',
      'see you', 'bye', 'have a good', 'take care',
      'all set', 'that\'s all', 'nothing else', 'good to go'
    ];
    
    const lastMessageLower = (lastMessage.body || '').toLowerCase();
    const hasClosingSignal = closingSignals.some(signal => 
      lastMessageLower.includes(signal)
    );
    
    // If customer said thanks/bye and operator responded, likely ended
    if (hasClosingSignal && lastMessage.direction === 'outbound') {
      return true;
    }
    
    // Check if the issue was resolved
    if (lastMessage.direction === 'outbound' && lastMessageLower.includes('let me know if')) {
      // Operator offered help, if no response for 2+ hours, likely done
      return timeSinceLastMessage > 120;
    }
    
    return false;
  }
  
  /**
   * Extract rich context from a conversation using AI
   */
  async extractConversationContext(messages: any[]): Promise<ConversationContext> {
    try {
      if (!openai.apiKey) {
        // Fallback to rule-based extraction
        return this.extractContextRuleBased(messages);
      }
      
      // Prepare conversation for AI analysis
      const conversationText = messages
        .map(m => `${m.direction === 'inbound' ? 'Customer' : 'Operator'}: ${m.body}`)
        .join('\n');
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: `Analyze this customer service conversation and extract:
            1. Primary intent (booking, support, inquiry, feedback, complaint)
            2. Entities (dates, times, locations, services mentioned)
            3. Sentiment (positive, neutral, negative)
            4. Urgency (low, medium, high)
            5. Category (booking, tech_issue, access, billing, general)
            6. Required actions (create_ticket, send_info, schedule, refund, none)
            7. Is the conversation complete/resolved?
            8. Brief summary (one sentence)
            
            Return as JSON.`
        }, {
          role: 'user',
          content: conversationText
        }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });
      
      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        intent: analysis.intent || 'unknown',
        entities: analysis.entities || {},
        sentiment: analysis.sentiment || 'neutral',
        urgency: analysis.urgency || 'medium',
        category: analysis.category || 'general',
        requiredActions: analysis.requiredActions || [],
        isComplete: analysis.isComplete || false,
        summary: analysis.summary || 'Customer service interaction'
      };
    } catch (error) {
      logger.error('Failed to extract context with AI:', error);
      return this.extractContextRuleBased(messages);
    }
  }
  
  /**
   * Rule-based context extraction (fallback)
   */
  private extractContextRuleBased(messages: any[]): ConversationContext {
    const allText = messages.map(m => m.body).join(' ').toLowerCase();
    
    // Detect intent
    let intent = 'inquiry';
    if (allText.match(/book|reserv|schedule/i)) intent = 'booking';
    else if (allText.match(/problem|issue|broken|fix/i)) intent = 'support';
    else if (allText.match(/thank|great|perfect/i)) intent = 'feedback';
    else if (allText.match(/complaint|upset|angry/i)) intent = 'complaint';
    
    // Detect category
    let category = 'general';
    if (allText.match(/book|bay|simulator/i)) category = 'booking';
    else if (allText.match(/trackman|screen|technical/i)) category = 'tech_issue';
    else if (allText.match(/door|unlock|access|code/i)) category = 'access';
    else if (allText.match(/charge|bill|pay|refund/i)) category = 'billing';
    
    // Detect urgency
    let urgency: 'low' | 'medium' | 'high' = 'medium';
    if (allText.match(/urgent|asap|emergency|immediately/i)) urgency = 'high';
    else if (allText.match(/when you can|no rush|whenever/i)) urgency = 'low';
    
    // Detect sentiment
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    const positiveWords = (allText.match(/thank|great|perfect|awesome|love|excellent/gi) || []).length;
    const negativeWords = (allText.match(/problem|issue|broken|bad|terrible|horrible/gi) || []).length;
    
    if (positiveWords > negativeWords + 2) sentiment = 'positive';
    else if (negativeWords > positiveWords + 2) sentiment = 'negative';
    
    // Extract entities
    const entities: any = {};
    
    // Extract times (basic)
    const timeMatches = allText.match(/\d{1,2}:\d{2}|\d{1,2}[ap]m/gi);
    if (timeMatches) entities.times = timeMatches;
    
    // Extract bay numbers
    const bayMatches = allText.match(/bay\s*\d+/gi);
    if (bayMatches) entities.locations = bayMatches;
    
    // Detect required actions
    const requiredActions = [];
    if (allText.includes('ticket')) requiredActions.push('create_ticket');
    if (allText.match(/send|email|text/i)) requiredActions.push('send_info');
    if (allText.match(/book|schedule/i)) requiredActions.push('schedule');
    if (allText.match(/refund|credit/i)) requiredActions.push('refund');
    
    // Check if complete
    const lastMessage = messages[messages.length - 1];
    const isComplete = 
      lastMessage.direction === 'outbound' && 
      (lastMessage.body.toLowerCase().includes('let me know') ||
       lastMessage.body.toLowerCase().includes('anything else') ||
       messages.some(m => m.body.toLowerCase().includes('thank')));
    
    return {
      intent,
      entities,
      sentiment,
      urgency,
      category,
      requiredActions,
      isComplete,
      summary: `${intent} regarding ${category}`
    };
  }
  
  /**
   * Group messages into logical conversations
   */
  async groupMessagesIntoConversations(
    phoneNumber: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ConversationBoundary[]> {
    // Get all messages for this phone number
    const messages = await db.query(`
      SELECT * FROM messages 
      WHERE (from_number = $1 OR to_number = $1)
        AND created_at >= $2
        AND created_at <= $3
      ORDER BY created_at ASC
    `, [
      phoneNumber,
      startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate || new Date()
    ]);
    
    const conversations: ConversationBoundary[] = [];
    let currentConversation: any[] = [];
    let conversationStart: Date | null = null;
    
    for (const message of messages.rows) {
      if (currentConversation.length === 0) {
        // Start new conversation
        currentConversation.push(message);
        conversationStart = new Date(message.created_at);
      } else {
        const lastMessage = currentConversation[currentConversation.length - 1];
        const timeDiff = (new Date(message.created_at).getTime() - 
                         new Date(lastMessage.created_at).getTime()) / 1000 / 60; // minutes
        
        // Check if this belongs to the same conversation
        if (timeDiff < 60 || !await this.detectConversationEnd(
          currentConversation, 
          new Date(lastMessage.created_at),
          new Date(message.created_at)
        )) {
          currentConversation.push(message);
        } else {
          // Save current conversation and start new one
          const context = await this.extractConversationContext(currentConversation);
          conversations.push({
            conversationId: currentConversation[0].conversation_id || 
                           `conv_${phoneNumber}_${conversationStart!.getTime()}`,
            startTime: conversationStart!,
            endTime: new Date(lastMessage.created_at),
            messageCount: currentConversation.length,
            isComplete: context.isComplete,
            resolution: context.summary
          });
          
          // Start new conversation
          currentConversation = [message];
          conversationStart = new Date(message.created_at);
        }
      }
    }
    
    // Don't forget the last conversation
    if (currentConversation.length > 0) {
      const context = await this.extractConversationContext(currentConversation);
      conversations.push({
        conversationId: currentConversation[0].conversation_id || 
                       `conv_${phoneNumber}_${conversationStart!.getTime()}`,
        startTime: conversationStart!,
        endTime: new Date(currentConversation[currentConversation.length - 1].created_at),
        messageCount: currentConversation.length,
        isComplete: context.isComplete,
        resolution: context.summary
      });
    }
    
    return conversations;
  }
  
  /**
   * Calculate average response time in minutes
   */
  private calculateAverageResponseTime(messages: any[]): number {
    const responseTimes: number[] = [];
    
    for (let i = 1; i < messages.length; i++) {
      const current = messages[i];
      const previous = messages[i - 1];
      
      // Only count when direction changes (someone responded)
      if (current.direction !== previous.direction) {
        const timeDiff = (new Date(current.createdAt).getTime() - 
                         new Date(previous.createdAt).getTime()) / 1000 / 60; // minutes
        
        // Only include reasonable response times (< 24 hours)
        if (timeDiff < 1440) {
          responseTimes.push(timeDiff);
        }
      }
    }
    
    if (responseTimes.length === 0) return 60; // default 1 hour
    
    // Calculate median (more robust than average)
    responseTimes.sort((a, b) => a - b);
    const middle = Math.floor(responseTimes.length / 2);
    
    if (responseTimes.length % 2 === 0) {
      return (responseTimes[middle - 1] + responseTimes[middle]) / 2;
    } else {
      return responseTimes[middle];
    }
  }
  
  /**
   * Find similar patterns using embeddings or fuzzy matching
   */
  async findSimilarPatterns(
    message: string,
    threshold: number = 0.7
  ): Promise<any[]> {
    try {
      if (!openai.apiKey) {
        // Fallback to keyword matching
        return this.findSimilarPatternsKeyword(message);
      }
      
      // Generate embedding for the message
      const embedding = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: message
      });
      
      const messageEmbedding = embedding.data[0].embedding;
      
      // Find similar patterns using cosine similarity
      // This would require storing embeddings in the database
      // For now, return empty array
      logger.info('Embedding generated for pattern matching');
      return [];
    } catch (error) {
      logger.error('Failed to find similar patterns:', error);
      return this.findSimilarPatternsKeyword(message);
    }
  }
  
  /**
   * Keyword-based pattern matching (fallback)
   */
  private async findSimilarPatternsKeyword(message: string): Promise<any[]> {
    const keywords = message
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    if (keywords.length === 0) return [];
    
    // Search for patterns with similar keywords
    const result = await db.query(`
      SELECT DISTINCT p.* 
      FROM decision_patterns p
      WHERE p.is_active = true
        AND (
          ${keywords.map((_, i) => `p.trigger_text ILIKE $${i + 1}`).join(' OR ')}
        )
      ORDER BY p.confidence_score DESC
      LIMIT 10
    `, keywords.map(k => `%${k}%`));
    
    return result.rows;
  }
}

export const conversationAnalyzer = new ConversationAnalyzer();