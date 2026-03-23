import { readFileSync } from 'fs';
import { join } from 'path';
import { getOpenAIClient } from '../utils/openaiClient';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { getRAGContext, logSearch } from './clubaiKnowledgeService';

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

// Cache the system prompt (tone/rules only — knowledge comes from RAG now)
let systemPrompt: string | null = null;

function loadSystemPrompt(): void {
  if (systemPrompt) return;

  const possiblePaths = [
    join(__dirname, '..', 'knowledge-base'),
    join(process.cwd(), 'src', 'knowledge-base'),
    join(process.cwd(), 'dist', 'knowledge-base'),
  ];

  for (const basePath of possiblePaths) {
    try {
      const promptPath = join(basePath, 'clubai-system-prompt.md');
      systemPrompt = readFileSync(promptPath, 'utf-8');
      logger.info('[ClubAI] System prompt loaded from: ' + basePath);
      return;
    } catch {
      // Try next path
    }
  }

  logger.error('[ClubAI] Failed to load system prompt from any path');
  systemPrompt = null;
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
 * Generate a conversational response using GPT-4o with RAG-powered knowledge.
 * Instead of a static knowledge base file, this searches past conversations and
 * website content to find the most relevant context for each customer message.
 */
export async function generateResponse(
  phoneNumber: string,
  messageText: string,
  conversationId: string
): Promise<ClubAIResponse> {
  logger.info('[ClubAI] generateResponse called', { phoneNumber, messageText: messageText.substring(0, 50), conversationId });

  loadSystemPrompt();

  if (!systemPrompt) {
    logger.error('[ClubAI] System prompt not loaded, cannot generate response');
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

  // RAG: Search for relevant past conversations and website content
  let ragContext = { conversationExamples: '', websiteContent: '', knowledgeIds: [] as number[], similarityScores: [] as number[] };
  try {
    ragContext = await getRAGContext(messageText);
    logger.info('[ClubAI] RAG context retrieved', {
      conversationMatches: ragContext.knowledgeIds.length,
      topSimilarity: ragContext.similarityScores[0] || 0,
    });
  } catch (error) {
    logger.warn('[ClubAI] RAG search failed, proceeding with system prompt only:', error);
  }

  // Build the system message: tone/rules + dynamic RAG context
  let systemContent = systemPrompt;

  // Inject RAG context (past conversations and website content)
  if (ragContext.conversationExamples || ragContext.websiteContent) {
    systemContent += '\n\n---\n\nDYNAMIC CONTEXT (retrieved for this specific message):\n\n';

    if (ragContext.conversationExamples) {
      systemContent += ragContext.conversationExamples;
      systemContent += 'Use these real examples to match the team\'s tone and approach. Do NOT copy them word-for-word — adapt them to the current situation.\n\n';
    }

    if (ragContext.websiteContent) {
      systemContent += ragContext.websiteContent;
      systemContent += 'Use this information to answer the customer directly. Do NOT send them a link — give them the actual info.\n\n';
    }
  }

  systemContent += '\n\n---\n\nIMPORTANT RESPONSE RULES:\n' +
    '- ONLY use facts from the DYNAMIC CONTEXT above. If the context does not contain the answer, say "Let me check with the team" and escalate. NEVER guess or make up numbers, prices, hours, or steps.\n' +
    '- If you need to escalate to a human, include [ESCALATE TO HUMAN] at the END of your message, followed by a summary line.\n' +
    '- Format: [ESCALATE TO HUMAN] Issue: Z, Priority: normal/high\n' +
    '- Do NOT include the escalation tag in the message the customer sees.\n' +
    '- Keep responses SHORT — this is SMS. 1-3 sentences max.\n' +
    '- Do NOT sign your messages with "- ClubAI" — that is added automatically.\n' +
    '- Give the customer the actual information (pricing, steps, etc.) from the DYNAMIC CONTEXT — do NOT send links instead of answering.\n' +
    '- Quote exact numbers from the knowledge base. For pricing: $35/hr standard, $25/hr mornings (5AM-1PM weekdays), $15/hr late night (midnight-5AM weekdays). If these don\'t match the DYNAMIC CONTEXT, use the DYNAMIC CONTEXT values.';

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemContent }
  ];

  // Add conversation history
  for (const msg of history) {
    if (msg.sender_type === 'customer') {
      messages.push({ role: 'user', content: msg.message_text });
    } else if (msg.sender_type === 'ai' || msg.sender_type === 'operator') {
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
      const customerMessage = rawResponse.replace(/\[ESCALATE TO HUMAN\][\s\S]*$/, '').trim();
      const escalationSummary = escalationMatch[1]?.trim() || 'AI requested escalation';

      // Log the search context for this escalation
      logSearch(conversationId, messageText, ragContext.knowledgeIds, ragContext.similarityScores, customerMessage || '[escalated]').catch(() => {});

      return {
        response: customerMessage || null,
        escalate: true,
        escalationSummary,
        confidence: 0.4
      };
    }

    // Clean up the response
    let cleanResponse = rawResponse.replace(/\s*-\s*ClubAI\s*$/i, '').trim();

    if (cleanResponse.length < 3) {
      logger.warn('[ClubAI] Response too short, skipping', { response: cleanResponse });
      return { response: null, escalate: false, confidence: 0 };
    }

    // Dynamic confidence scoring based on RAG quality
    let confidence = 0.6; // Base confidence (lower than before since we can now measure quality)
    if (ragContext.similarityScores.length > 0) {
      const topSimilarity = ragContext.similarityScores[0];
      if (topSimilarity >= 0.85) confidence += 0.25; // Strong match to past conversation
      else if (topSimilarity >= 0.75) confidence += 0.15; // Good match
      else if (topSimilarity >= 0.65) confidence += 0.08; // Moderate match
    }
    if (ragContext.knowledgeIds.length >= 3) confidence += 0.05; // Multiple sources agree
    if (cleanResponse.length > 500) confidence -= 0.1; // Too long for SMS
    if (cleanResponse.includes('?') && !history.length) confidence += 0.05;

    // Log what knowledge was used for this response
    logSearch(conversationId, messageText, ragContext.knowledgeIds, ragContext.similarityScores, cleanResponse).catch(() => {});

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
