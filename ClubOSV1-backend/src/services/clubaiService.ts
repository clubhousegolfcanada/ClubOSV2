import { readFileSync } from 'fs';
import { join } from 'path';
import { getOpenAIClient } from '../utils/openaiClient';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { getRAGContext, logSearch, addManualKnowledge, searchKnowledge } from './clubaiKnowledgeService';

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
let systemPromptLoaded = false;

/**
 * Load system prompt from DB (pattern_learning_config) with file fallback.
 * Cached in memory until clearSystemPromptCache() is called.
 */
async function loadSystemPromptAsync(): Promise<void> {
  if (systemPromptLoaded && systemPrompt) return;

  // Try DB first
  try {
    const result = await db.query(
      `SELECT config_value FROM pattern_learning_config WHERE config_key = 'clubai_system_prompt'`
    );
    if (result.rows.length > 0 && result.rows[0].config_value) {
      systemPrompt = result.rows[0].config_value;
      systemPromptLoaded = true;
      logger.info('[ClubAI] System prompt loaded from database');
      return;
    }
  } catch (err) {
    logger.warn('[ClubAI] DB system prompt fetch failed, falling back to file:', err);
  }

  // Fallback to markdown file
  loadSystemPromptFromFile();
}

function loadSystemPromptFromFile(): void {
  const possiblePaths = [
    join(__dirname, '..', 'knowledge-base'),
    join(process.cwd(), 'src', 'knowledge-base'),
    join(process.cwd(), 'dist', 'knowledge-base'),
  ];

  for (const basePath of possiblePaths) {
    try {
      const promptPath = join(basePath, 'clubai-system-prompt.md');
      systemPrompt = readFileSync(promptPath, 'utf-8');
      systemPromptLoaded = true;
      logger.info('[ClubAI] System prompt loaded from file: ' + basePath);
      return;
    } catch {
      // Try next path
    }
  }

  logger.error('[ClubAI] Failed to load system prompt from any path');
  systemPrompt = null;
}

// Synchronous fallback for first call (keeps generateResponse signature simple)
function loadSystemPrompt(): void {
  if (systemPromptLoaded && systemPrompt) return;
  loadSystemPromptFromFile();
}

/**
 * Clear the cached system prompt so the next generateResponse() reloads from DB.
 * Called after saving a new system prompt via the API.
 */
export function clearSystemPromptCache(): void {
  systemPrompt = null;
  systemPromptLoaded = false;
  logger.info('[ClubAI] System prompt cache cleared');
}

/**
 * Get the default system prompt from the markdown file (for reset functionality).
 */
export function getDefaultSystemPrompt(): string | null {
  const possiblePaths = [
    join(__dirname, '..', 'knowledge-base'),
    join(process.cwd(), 'src', 'knowledge-base'),
    join(process.cwd(), 'dist', 'knowledge-base'),
  ];

  for (const basePath of possiblePaths) {
    try {
      return readFileSync(join(basePath, 'clubai-system-prompt.md'), 'utf-8');
    } catch {
      // Try next path
    }
  }
  return null;
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

  // Try async DB load first, fall back to sync file load
  await loadSystemPromptAsync();
  if (!systemPrompt) loadSystemPrompt();

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

  // Check if the conversation is already closed (customer acknowledged our closer)
  // If the last AI/operator message was a closer and the customer is just saying thanks/bye, stop.
  // Only suppresses short acknowledgments (under 40 chars) to avoid silencing real follow-up questions.
  if (history.length >= 2) {
    const lastAiMsg = [...history].reverse().find(m => m.sender_type === 'ai' || m.sender_type === 'operator');
    if (lastAiMsg) {
      const closerPatterns = /\b(enjoy your round|have (a )?great time|have fun|anytime|glad .* help|no problem|you'?re (all )?set|good to go)\b/i;
      const customerCloserPatterns = /^(thanks|thank you|thx|ty|ok!?|okay|cool|perfect|awesome|great!?|will do|sounds good|appreciate it|cheers|bye|see ya|have a good|good night)[\s!.]*$/i;
      const trimmedMessage = messageText.trim();
      const lastAiWasCloser = closerPatterns.test(lastAiMsg.message_text);
      const customerIsAcknowledging = trimmedMessage.length < 40 && customerCloserPatterns.test(trimmedMessage);

      if (lastAiWasCloser && customerIsAcknowledging) {
        logger.info('[ClubAI] Conversation already closed, not responding to acknowledgment', {
          phoneNumber,
          lastAiMessage: lastAiMsg.message_text.substring(0, 50),
          customerMessage: trimmedMessage,
        });
        return { response: null, escalate: false, confidence: 0 };
      }
    }
  }

  // RAG: Search for relevant past conversations and website content
  let ragContext = { conversationExamples: '', websiteContent: '', knowledgeIds: [] as number[], similarityScores: [] as number[], hasManualMatches: false, hasWebsiteMatches: false };
  try {
    ragContext = await getRAGContext(messageText);
    logger.info('[ClubAI] RAG context retrieved', {
      conversationMatches: ragContext.knowledgeIds.length,
      topSimilarity: ragContext.similarityScores[0] || 0,
    });
  } catch (error) {
    logger.warn('[ClubAI] RAG search failed, proceeding with system prompt only:', error);
  }

  // Fetch active style rules learned from operator corrections
  let styleRulesSection = '';
  try {
    const rulesResult = await db.query(`
      SELECT id, rule_type, rule_text, intent
      FROM clubai_style_rules
      WHERE is_active = TRUE
      ORDER BY use_count DESC, created_at DESC
      LIMIT 10
    `);

    if (rulesResult.rows.length > 0) {
      // Filter to rules relevant to this conversation (global + intent-specific)
      // We don't know the intent yet, so include all — the AI will apply what's relevant
      const rules = rulesResult.rows;
      styleRulesSection = '\n\n---\n\nSTYLE CORRECTIONS FROM THE TEAM (apply these to ALL responses):\n\n';
      for (const rule of rules) {
        const scope = rule.intent ? ` [${rule.intent}]` : '';
        styleRulesSection += `• ${rule.rule_text}${scope}\n`;
      }

      // Increment use_count for retrieved rules
      const ruleIds = rules.map((r: any) => r.id).filter(Boolean);
      if (ruleIds.length > 0) {
        db.query(`UPDATE clubai_style_rules SET use_count = use_count + 1, updated_at = NOW() WHERE id = ANY($1)`, [ruleIds]).catch(() => {});
      }
    }
  } catch (styleErr) {
    logger.warn('[ClubAI] Failed to fetch style rules:', styleErr);
  }

  // Build the system message: tone/rules + style corrections + dynamic RAG context
  let systemContent = systemPrompt + styleRulesSection;

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

  // Soft warning: when RAG only found conversation examples (no manual/website) AND
  // the top match is weak (< 0.75), nudge GPT to be extra cautious.
  // Strong conversation matches (0.75+) pass through normally — they often contain good info.
  const topSimilarity = ragContext.similarityScores[0] || 0;
  if (!ragContext.hasManualMatches && !ragContext.hasWebsiteMatches
      && ragContext.knowledgeIds.length > 0 && topSimilarity < 0.75) {
    systemContent += '\n\n---\n\n';
    systemContent += 'CAUTION FOR THIS MESSAGE: No verified information (team corrections or website content) was found for this question. ';
    systemContent += 'Only past conversation examples matched, and the match confidence is low. ';
    systemContent += 'These examples may contain outdated or incorrect information. ';
    systemContent += 'Be extra cautious — do NOT use conversation examples as factual sources. ';
    systemContent += 'If the answer is not already in your core instructions above, ';
    systemContent += 'respond with "Let me check with the team on that and get back to you!" and add [ESCALATE TO HUMAN] with Tier: SOFT HOLD.\n';

    logger.info('[ClubAI] Low-confidence unverified match, injecting caution warning', {
      phoneNumber,
      conversationId,
      topSimilarity,
      matchCount: ragContext.knowledgeIds.length,
    });
  }

  // Note: IMPORTANT RESPONSE RULES are now part of the editable system prompt (end of the prompt text).
  // They are no longer hardcoded here, so changes from the ClubAI Settings UI take effect immediately.

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemContent }
  ];

  // Add conversation history (skip the current message — it was already inserted
  // into conversation_messages before generateResponse was called, so it would
  // appear twice if we don't filter it out)
  for (const msg of history) {
    // Skip the current message from history — we add it explicitly below
    if (msg.sender_type === 'customer' && msg.message_text === messageText &&
        msg === history[history.length - 1]) {
      continue;
    }
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
      temperature: 0.4,
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

    // Strip markdown formatting — SMS doesn't render it, customers see raw brackets/asterisks.
    // Convert markdown links [text](url) → just the URL (prefer the actual URL over display text)
    cleanResponse = cleanResponse.replace(/\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, '$2');
    // Strip any remaining markdown bold/italic
    cleanResponse = cleanResponse.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleanResponse = cleanResponse.replace(/\*([^*]+)\*/g, '$1');
    cleanResponse = cleanResponse.replace(/_([^_]+)_/g, '$1');

    // Strip internal reasoning that GPT sometimes includes instead of staying silent.
    // Examples: "(stopping here as the conversation is closed.)", "(No response needed.)"
    // This catches meta-commentary that should never reach the customer.
    cleanResponse = cleanResponse
      .replace(/\((?:stopping|not responding|no response|conversation (?:is )?(?:closed|ended|over|done|complete)|I (?:will|should|won't|shouldn't) (?:not )?respond)[^)]*\)/gi, '')
      .replace(/^(?:I (?:will|should|won't|shouldn't) (?:not )?respond|no response needed|stopping here|conversation (?:is )?(?:closed|ended|over|done))\.?\s*/gim, '')
      .trim();

    // If after stripping internal reasoning the response is empty or too short, stay silent
    if (cleanResponse.length < 3) {
      if (rawResponse.length >= 3) {
        logger.info('[ClubAI] Response was internal reasoning only, suppressing', { rawResponse: rawResponse.substring(0, 100) });
      } else {
        logger.warn('[ClubAI] Response too short, skipping', { response: cleanResponse });
      }
      return { response: null, escalate: false, confidence: 0 };
    }

    // Post-generation hallucination check: if the response contains specific numbers
    // (prices, hours, phone numbers) that aren't in the RAG context, flag it.
    // Catches: $35, $25/hr, 5:00 AM, 902-707-3748, (902) 707-3748
    const hasRAGContext = ragContext.conversationExamples.length > 0 || ragContext.websiteContent.length > 0;
    const numberPattern = /\$\d+(?:\.\d{2})?|\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)|\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const responseNumbers = cleanResponse.match(numberPattern) || [];
    // Strip formatting from both response numbers and context for comparison
    const contextText = ragContext.conversationExamples + ragContext.websiteContent;
    const normalizeNum = (n: string) => n.replace(/[\s().-]/g, '');

    if (responseNumbers.length > 0 && hasRAGContext) {
      const normalizedContext = normalizeNum(contextText);
      const ungroundedNumbers = responseNumbers.filter(num => {
        const norm = normalizeNum(num);
        // Check both raw and normalized forms against context
        return !contextText.includes(num) && !normalizedContext.includes(norm);
      });
      if (ungroundedNumbers.length > 0) {
        logger.warn('[ClubAI] Hallucination detected: response contains numbers not in context', {
          ungroundedNumbers,
          responsePreview: cleanResponse.substring(0, 100),
        });
        // Replace with escalation instead of sending potentially wrong info
        return {
          response: "Let me check with the team on that and get back to you!",
          escalate: true,
          escalationSummary: `ClubAI blocked: response contained ungrounded numbers (${ungroundedNumbers.join(', ')}). Original: ${cleanResponse.substring(0, 200)}`,
          confidence: 0.2
        };
      }
    } else if (!hasRAGContext && responseNumbers.length > 0) {
      // No RAG context at all but response has specific numbers. Very likely hallucinated.
      logger.warn('[ClubAI] No RAG context but response contains numbers, escalating', {
        numbers: responseNumbers,
        responsePreview: cleanResponse.substring(0, 100),
      });
      return {
        response: "Let me check with the team on that and get back to you!",
        escalate: true,
        escalationSummary: `ClubAI blocked: no knowledge context but response contained specific numbers (${responseNumbers.join(', ')}). Original: ${cleanResponse.substring(0, 200)}`,
        confidence: 0.2
      };
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
      VALUES ($1, 'ai', $2, $3, $4)
    `, [conversationId, messageText, confidence, JSON.stringify({ source: 'ClubAI', type: 'auto-response' })]);
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

/**
 * Detect if an operator outbound message is correcting a recent ClubAI response.
 * If so, auto-save the correction to the knowledge base for future use.
 *
 * Called asynchronously (fire-and-forget) from the webhook handler.
 * Uses GPT-4o-mini to classify: correction vs. continuation.
 * Must never throw — all errors are caught and logged silently.
 */
export async function detectAndLearnCorrection(
  convDbId: number | string,
  operatorMessage: string,
  phoneNumber: string
): Promise<void> {
  const convId = String(convDbId);

  try {
    // Step 1: Find the last ClubAI message in this conversation (within last 30 minutes)
    const aiMsgResult = await db.query(`
      SELECT message_text, created_at
      FROM conversation_messages
      WHERE conversation_id = $1
        AND sender_type = 'ai'
        AND created_at > NOW() - INTERVAL '30 minutes'
      ORDER BY created_at DESC
      LIMIT 1
    `, [convId]);

    if (aiMsgResult.rows.length === 0) {
      // No recent ClubAI message — operator is responding directly, nothing to correct
      return;
    }

    const clubaiMessage = aiMsgResult.rows[0].message_text;
    const cleanAiMessage = clubaiMessage.replace(/\s*-\s*ClubAI\s*$/i, '').trim();

    // Step 2: Find the customer message that preceded the ClubAI response
    const customerMsgResult = await db.query(`
      SELECT message_text
      FROM conversation_messages
      WHERE conversation_id = $1
        AND sender_type = 'customer'
        AND created_at <= $2
      ORDER BY created_at DESC
      LIMIT 1
    `, [convId, aiMsgResult.rows[0].created_at]);

    const customerMessage = customerMsgResult.rows[0]?.message_text || '';
    if (!customerMessage) {
      logger.warn('[ClubAI Auto-Correct] No customer message found before AI response, skipping', { convId });
      return;
    }

    // Step 3: Dedup — skip if we already auto-corrected for this conversation recently
    const recentAutoCorrection = await db.query(`
      SELECT id FROM clubai_corrections
      WHERE conversation_id = $1
        AND corrected_by = 'auto-detection'
        AND created_at > NOW() - INTERVAL '10 minutes'
      LIMIT 1
    `, [convId]);

    if (recentAutoCorrection.rows.length > 0) {
      logger.info('[ClubAI Auto-Correct] Already auto-corrected recently for this conversation, skipping', { convId });
      return;
    }

    // Step 4: Use GPT-4o-mini to determine if operator is correcting ClubAI
    const openai = getOpenAIClient();
    if (!openai) {
      logger.warn('[ClubAI Auto-Correct] OpenAI client not available');
      return;
    }

    const classification = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You analyze SMS conversations between an AI assistant ("ClubAI") and a human operator at a golf/entertainment facility. An operator just sent a message after ClubAI responded to a customer. Determine if the operator is CORRECTING the AI (providing different/better information) or just CONTINUING the conversation (adding context, following up, or handling something unrelated).

A CORRECTION means:
- The operator provides different factual information than ClubAI gave
- The operator contradicts what ClubAI said
- The operator answers the same question but with different/better info
- The operator explicitly says ClubAI was wrong ("that was incorrect", "actually", "no we don't have that")

NOT a correction:
- Operator says "thanks", "ok", "got it", "no worries" (acknowledgment)
- Operator asks the customer a follow-up question
- Operator discusses something different from what ClubAI addressed
- Operator adds complementary info that doesn't contradict ClubAI
- Operator is sending a greeting or closing message
- Operator is handling the situation ClubAI correctly escalated

Return JSON only: {"isCorrection": true/false, "correctedInfo": "brief description of what was corrected (empty string if not correction)", "intent": "topic category: booking, pricing, hours, access, tech_support, music, equipment, general_inquiry"}`
        },
        {
          role: 'user',
          content: `Customer asked: "${customerMessage}"\n\nClubAI responded: "${cleanAiMessage}"\n\nOperator then said: "${operatorMessage}"`
        }
      ],
      temperature: 0.1,
      max_tokens: 150,
    });

    const content = classification.choices[0]?.message?.content;
    if (!content) {
      logger.warn('[ClubAI Auto-Correct] Empty classification response');
      return;
    }

    let parsed: { isCorrection: boolean; correctedInfo: string; intent: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      logger.warn('[ClubAI Auto-Correct] Could not parse classification JSON', { content: content.substring(0, 200) });
      return;
    }

    if (!parsed.isCorrection) {
      logger.info('[ClubAI Auto-Correct] Operator message is NOT a correction, no learning needed', {
        phoneNumber,
        operatorPreview: operatorMessage.substring(0, 50),
      });
      return;
    }

    // Step 5: It IS a correction — save to knowledge base
    logger.info('[ClubAI Auto-Correct] Correction detected! Learning from operator', {
      phoneNumber,
      intent: parsed.intent,
      correctedInfo: parsed.correctedInfo,
      customerMessage: customerMessage.substring(0, 80),
      aiResponse: cleanAiMessage.substring(0, 80),
      operatorResponse: operatorMessage.substring(0, 80),
    });

    const resolvedIntent = parsed.intent || 'general_inquiry';

    // 5a: Add to knowledge base
    const knowledgeEntryId = await addManualKnowledge(
      resolvedIntent,
      customerMessage.trim(),
      operatorMessage.trim(),
      {
        source: 'auto_correction',
        original_ai_response: cleanAiMessage,
        corrected_info: parsed.correctedInfo,
        phone_number: phoneNumber,
      }
    );

    // 5b: Deactivate conflicting knowledge entries
    let deactivatedCount = 0;
    if (knowledgeEntryId) {
      try {
        const similar = await searchKnowledge(customerMessage.trim(), { limit: 5, threshold: 0.6 });
        const toDeactivate = similar.filter(s =>
          s.knowledge_id !== knowledgeEntryId &&
          s.team_response !== operatorMessage.trim()
        );
        if (toDeactivate.length > 0) {
          const ids = toDeactivate.map(s => s.knowledge_id);
          await db.query(
            `UPDATE clubai_knowledge SET is_active = FALSE, updated_at = NOW() WHERE id = ANY($1)`,
            [ids]
          );
          deactivatedCount = ids.length;
        }
      } catch (conflictErr) {
        logger.warn('[ClubAI Auto-Correct] Could not check/deactivate conflicts:', conflictErr);
      }
    }

    // 5c: Log to clubai_corrections audit table
    try {
      await db.query(`
        INSERT INTO clubai_corrections
          (conversation_id, phone_number, customer_message, original_response, corrected_response,
           correction_type, correction_summary, intent, knowledge_entry_id, corrected_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        convId,
        phoneNumber,
        customerMessage.trim(),
        cleanAiMessage,
        operatorMessage.trim(),
        'factual',
        parsed.correctedInfo || 'Auto-detected operator correction',
        resolvedIntent,
        knowledgeEntryId,
        'auto-detection',
      ]);
    } catch (auditErr) {
      logger.warn('[ClubAI Auto-Correct] Failed to log correction audit:', auditErr);
    }

    logger.info('[ClubAI Auto-Correct] Successfully learned correction', {
      phoneNumber,
      knowledgeEntryId,
      deactivatedCount,
      intent: resolvedIntent,
    });

  } catch (error) {
    // Silently fail — this is fire-and-forget, must never affect webhook response
    logger.error('[ClubAI Auto-Correct] Error in correction detection:', error);
  }
}

export const clubaiService = {
  generateResponse,
  storeClubAIMessage,
  deactivateForConversation,
  detectAndLearnCorrection,
  clearSystemPromptCache,
  getDefaultSystemPrompt,
};
