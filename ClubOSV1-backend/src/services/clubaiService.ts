import { readFileSync } from 'fs';
import { join } from 'path';
import { getOpenAIClient } from '../utils/openaiClient';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

interface ClubAIResponse {
  response: string | null;
  escalate: boolean;
  escalationSummary?: string;
  confidence: number;
}

interface ConversationMessage {
  sender_type: 'customer' | 'operator' | 'ai' | 'system';
  message_text: string;
  created_at: string;
}

// Cache loaded knowledge files in memory
let systemPrompt: string | null = null;
let knowledgeBase: string | null = null;

function loadKnowledgeFiles(): void {
  if (systemPrompt && knowledgeBase) return;

  try {
    const basePath = join(__dirname, '..', 'knowledge-base');
    systemPrompt = readFileSync(join(basePath, 'clubai-system-prompt.md'), 'utf-8');
    knowledgeBase = readFileSync(join(basePath, 'clubai-knowledge-base.md'), 'utf-8');
    logger.info('[ClubAI] Knowledge files loaded successfully');
  } catch (error) {
    logger.error('[ClubAI] Failed to load knowledge files:', error);
    systemPrompt = null;
    knowledgeBase = null;
  }
}

/**
 * Get conversation history for a conversation
 */
async function getConversationHistory(conversationId: string, limit: number = 10): Promise<ConversationMessage[]> {
  try {
    const result = await db.query(`
      SELECT sender_type, message_text, created_at
      FROM conversation_messages
      WHERE conversation_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [conversationId, limit]);

    // Return in chronological order (oldest first)
    return result.rows.reverse();
  } catch (error) {
    logger.warn('[ClubAI] Failed to fetch conversation history:', error);
    return [];
  }
}

/**
 * Generate a conversational response using GPT-4o with the ClubAI system prompt and knowledge base
 */
export async function generateResponse(
  phoneNumber: string,
  messageText: string,
  conversationId: string
): Promise<ClubAIResponse> {
  loadKnowledgeFiles();

  if (!systemPrompt || !knowledgeBase) {
    logger.error('[ClubAI] Knowledge files not loaded, cannot generate response');
    return { response: null, escalate: false, confidence: 0 };
  }

  const openai = getOpenAIClient();
  if (!openai) {
    logger.error('[ClubAI] OpenAI client not available');
    return { response: null, escalate: false, confidence: 0 };
  }

  // Get conversation history
  const history = await getConversationHistory(conversationId);

  // Check max messages limit
  const maxMessages = parseInt(process.env.CLUBAI_MAX_MESSAGES || '5');
  const aiMessageCount = history.filter(m => m.sender_type === 'ai').length;
  if (aiMessageCount >= maxMessages) {
    logger.info('[ClubAI] Max AI messages reached, escalating', { phoneNumber, aiMessageCount });
    return {
      response: null,
      escalate: true,
      escalationSummary: `AI message limit reached (${aiMessageCount}/${maxMessages}). Customer may need human assistance.`,
      confidence: 0
    };
  }

  // Build messages array for GPT-4o
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: systemPrompt + '\n\n---\n\nKNOWLEDGE BASE:\n' + knowledgeBase +
        '\n\n---\n\nIMPORTANT RESPONSE RULES:\n' +
        '- If you need to escalate to a human, include [ESCALATE TO HUMAN] at the END of your message, followed by a summary line.\n' +
        '- Format: [ESCALATE TO HUMAN] Location: X, Box: Y, Issue: Z, Tried: W\n' +
        '- Do NOT include the escalation tag in the message the customer sees.\n' +
        '- Keep responses SHORT — this is SMS. 1-3 sentences max.\n' +
        '- Do NOT sign your messages with "- ClubAI" — that is added automatically.'
    }
  ];

  // Add conversation history
  for (const msg of history) {
    if (msg.sender_type === 'customer') {
      messages.push({ role: 'user', content: msg.message_text });
    } else if (msg.sender_type === 'ai' || msg.sender_type === 'operator') {
      // Remove "- ClubAI" suffix from previous AI messages so GPT doesn't keep adding it
      const cleanText = msg.message_text.replace(/\s*-\s*ClubAI\s*$/i, '');
      messages.push({ role: 'assistant', content: cleanText });
    }
  }

  // Add the new customer message
  messages.push({ role: 'user', content: messageText });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 300,
    });

    const rawResponse = completion.choices[0]?.message?.content?.trim();

    if (!rawResponse) {
      logger.warn('[ClubAI] Empty response from GPT-4o');
      return { response: null, escalate: false, confidence: 0 };
    }

    // Check for escalation signal
    const escalationMatch = rawResponse.match(/\[ESCALATE TO HUMAN\]\s*(.*)/s);
    if (escalationMatch) {
      // Extract the customer-facing part (everything before the tag)
      const customerMessage = rawResponse.replace(/\[ESCALATE TO HUMAN\][\s\S]*$/, '').trim();
      const escalationSummary = escalationMatch[1]?.trim() || 'AI requested escalation';

      return {
        response: customerMessage || null,
        escalate: true,
        escalationSummary,
        confidence: 0.4
      };
    }

    // Clean up the response — remove any accidental signature
    let cleanResponse = rawResponse.replace(/\s*-\s*ClubAI\s*$/i, '').trim();

    // Safety: don't send empty or very short responses
    if (cleanResponse.length < 3) {
      logger.warn('[ClubAI] Response too short, skipping', { response: cleanResponse });
      return { response: null, escalate: false, confidence: 0 };
    }

    // Estimate confidence based on response characteristics
    let confidence = 0.75;
    if (cleanResponse.length > 500) confidence -= 0.1; // Too long for SMS
    if (cleanResponse.includes('?') && !history.length) confidence += 0.05; // Asking clarifying Q is good

    return {
      response: cleanResponse,
      escalate: false,
      confidence: Math.min(1, Math.max(0, confidence))
    };

  } catch (error) {
    logger.error('[ClubAI] GPT-4o call failed:', error);
    return { response: null, escalate: false, confidence: 0 };
  }
}

/**
 * Store a ClubAI message in conversation_messages for operator visibility
 */
export async function storeClubAIMessage(
  conversationId: string,
  messageText: string,
  confidence: number
): Promise<void> {
  try {
    await db.query(`
      INSERT INTO conversation_messages (conversation_id, sender_type, message_text, pattern_confidence, ai_reasoning)
      VALUES ($1, 'ai', $2, $3, 'ClubAI auto-response')
    `, [conversationId, messageText, confidence]);
  } catch (error) {
    logger.error('[ClubAI] Failed to store message:', error);
  }
}

/**
 * Deactivate ClubAI for a conversation (operator took over)
 */
export async function deactivateForConversation(conversationId: string): Promise<void> {
  try {
    await db.query(`
      UPDATE openphone_conversations
      SET clubai_active = false
      WHERE id = $1
    `, [conversationId]);
  } catch (error) {
    logger.error('[ClubAI] Failed to deactivate:', error);
  }
}

export const clubaiService = {
  generateResponse,
  storeClubAIMessage,
  deactivateForConversation,
};
