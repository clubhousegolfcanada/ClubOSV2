import { getOpenAIClient } from '../utils/openaiClient';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

const EMBEDDING_MODEL = 'text-embedding-3-small';

// ============================================
// EMBEDDING GENERATION
// ============================================

/**
 * Generate an embedding vector for a text string using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const openai = getOpenAIClient();
  if (!openai) {
    logger.error('[ClubAI-Knowledge] OpenAI client not available');
    return null;
  }

  try {
    // Normalize and truncate text (embedding model has 8191 token limit)
    const normalizedText = text.trim().replace(/\s+/g, ' ').substring(0, 8000);

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: normalizedText,
    });

    return response.data[0].embedding;
  } catch (error) {
    logger.error('[ClubAI-Knowledge] Embedding generation failed:', error);
    return null;
  }
}

/**
 * Generate embeddings for multiple texts in a batch (max 2048 per batch)
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<(number[] | null)[]> {
  const openai = getOpenAIClient();
  if (!openai) return texts.map(() => null);

  const BATCH_SIZE = 100;
  const results: (number[] | null)[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map(t =>
      t.trim().replace(/\s+/g, ' ').substring(0, 8000)
    );

    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
      });

      for (const item of response.data) {
        results.push(item.embedding);
      }

      // Rate limit: small pause between batches
      if (i + BATCH_SIZE < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      logger.error(`[ClubAI-Knowledge] Batch embedding failed at index ${i}:`, error);
      // Fill failed batch with nulls
      for (let j = 0; j < batch.length; j++) {
        results.push(null);
      }
    }
  }

  return results;
}

// ============================================
// KNOWLEDGE SEARCH (RAG)
// ============================================

export interface KnowledgeMatch {
  knowledge_id: number;
  source_type: string;
  intent: string | null;
  customer_message: string | null;
  team_response: string;
  page_section: string | null;
  confidence_score: number;
  similarity: number;
}

/**
 * Search the knowledge base for content similar to a customer message.
 * Returns the most relevant past conversations and website content.
 */
export async function searchKnowledge(
  query: string,
  options: {
    limit?: number;
    threshold?: number;
    sourceType?: 'conversation' | 'website' | 'manual' | null;
  } = {}
): Promise<KnowledgeMatch[]> {
  const { limit = 8, threshold = 0.65, sourceType = null } = options;

  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) {
    logger.warn('[ClubAI-Knowledge] Could not generate query embedding, falling back to empty results');
    return [];
  }

  try {
    const result = await db.query(`
      SELECT * FROM find_similar_knowledge($1, $2, $3, $4)
    `, [queryEmbedding, threshold, limit, sourceType]);

    return result.rows;
  } catch (error) {
    logger.error('[ClubAI-Knowledge] Search failed:', error);
    return [];
  }
}

/**
 * Search and format results specifically for the ClubAI prompt.
 * Returns past conversations and website content as formatted context strings.
 */
export async function getRAGContext(customerMessage: string): Promise<{
  conversationExamples: string;
  websiteContent: string;
  knowledgeIds: number[];
  similarityScores: number[];
}> {
  // Search past conversations (top 5)
  const conversations = await searchKnowledge(customerMessage, {
    limit: 5,
    threshold: 0.65,
    sourceType: 'conversation',
  });

  // Search website content (top 3)
  const website = await searchKnowledge(customerMessage, {
    limit: 3,
    threshold: 0.6,
    sourceType: 'website',
  });

  // Also get manual entries
  const manual = await searchKnowledge(customerMessage, {
    limit: 2,
    threshold: 0.6,
    sourceType: 'manual',
  });

  // Format conversation examples
  let conversationExamples = '';
  if (conversations.length > 0) {
    conversationExamples = 'REAL EXAMPLES OF HOW THE TEAM HAS HANDLED SIMILAR MESSAGES:\n\n';
    for (const conv of conversations) {
      conversationExamples += `Customer: "${conv.customer_message}"\n`;
      conversationExamples += `Team response: "${conv.team_response}"\n`;
      if (conv.intent) conversationExamples += `(Intent: ${conv.intent})\n`;
      conversationExamples += '\n';
    }
  }

  // Format website content
  let websiteContent = '';
  const allWebsite = [...website, ...manual];
  if (allWebsite.length > 0) {
    websiteContent = 'RELEVANT INFORMATION FROM THE CLUBHOUSE WEBSITE:\n\n';
    for (const entry of allWebsite) {
      if (entry.page_section) websiteContent += `[${entry.page_section}]\n`;
      websiteContent += entry.team_response + '\n\n';
    }
  }

  // Collect IDs and scores for logging
  const allMatches = [...conversations, ...website, ...manual];
  const knowledgeIds = allMatches.map(m => m.knowledge_id);
  const similarityScores = allMatches.map(m => m.similarity);

  // Increment use_count for retrieved entries
  if (knowledgeIds.length > 0) {
    try {
      await db.query(`
        UPDATE clubai_knowledge
        SET use_count = use_count + 1, updated_at = NOW()
        WHERE id = ANY($1)
      `, [knowledgeIds]);
    } catch (error) {
      logger.warn('[ClubAI-Knowledge] Failed to update use counts:', error);
    }
  }

  return { conversationExamples, websiteContent, knowledgeIds, similarityScores };
}

// ============================================
// KNOWLEDGE IMPORT
// ============================================

interface ConversationImport {
  source_id: string;
  intent: string;
  customer_message: string;
  team_response: string;
  location?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Import a single conversation Q&A pair into the knowledge base
 */
export async function importConversation(conv: ConversationImport): Promise<number | null> {
  // Build the text to embed: combine customer question + team response for better matching
  const embeddingText = `Customer: ${conv.customer_message}\nResponse: ${conv.team_response}`;
  const embedding = await generateEmbedding(embeddingText);

  try {
    const result = await db.query(`
      INSERT INTO clubai_knowledge
        (source_type, intent, customer_message, team_response, source_id, location, metadata, embedding, embedding_generated_at, confidence_score)
      VALUES
        ('conversation', $1, $2, $3, $4, $5, $6, $7, NOW(), $8)
      RETURNING id
    `, [
      conv.intent,
      conv.customer_message,
      conv.team_response,
      conv.source_id,
      conv.location || null,
      JSON.stringify(conv.metadata || {}),
      embedding,
      conv.metadata?.confidence || 0.7,
    ]);

    return result.rows[0]?.id || null;
  } catch (error) {
    logger.error('[ClubAI-Knowledge] Failed to import conversation:', error);
    return null;
  }
}

interface WebsiteImport {
  url: string;
  page_section: string;
  content: string;
  intent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Import a website content section into the knowledge base
 */
export async function importWebsiteContent(entry: WebsiteImport): Promise<number | null> {
  const embedding = await generateEmbedding(entry.content);

  try {
    const result = await db.query(`
      INSERT INTO clubai_knowledge
        (source_type, intent, team_response, source_url, page_section, metadata, embedding, embedding_generated_at, confidence_score)
      VALUES
        ('website', $1, $2, $3, $4, $5, $6, NOW(), 0.9)
      RETURNING id
    `, [
      entry.intent || null,
      entry.content,
      entry.url,
      entry.page_section,
      JSON.stringify(entry.metadata || {}),
      embedding,
    ]);

    return result.rows[0]?.id || null;
  } catch (error) {
    logger.error('[ClubAI-Knowledge] Failed to import website content:', error);
    return null;
  }
}

/**
 * Add a manual knowledge entry (operator-created)
 */
export async function addManualKnowledge(
  intent: string,
  customerQuestion: string,
  teamResponse: string,
  metadata?: Record<string, unknown>
): Promise<number | null> {
  const embeddingText = `Customer: ${customerQuestion}\nResponse: ${teamResponse}`;
  const embedding = await generateEmbedding(embeddingText);

  try {
    const result = await db.query(`
      INSERT INTO clubai_knowledge
        (source_type, intent, customer_message, team_response, metadata, embedding, embedding_generated_at, confidence_score)
      VALUES
        ('manual', $1, $2, $3, $4, $5, NOW(), 0.95)
      RETURNING id
    `, [
      intent,
      customerQuestion,
      teamResponse,
      JSON.stringify(metadata || {}),
      embedding,
    ]);

    return result.rows[0]?.id || null;
  } catch (error) {
    logger.error('[ClubAI-Knowledge] Failed to add manual knowledge:', error);
    return null;
  }
}

// ============================================
// SEARCH LOGGING
// ============================================

/**
 * Log what knowledge was used to generate an AI response
 */
export async function logSearch(
  conversationId: string,
  customerMessage: string,
  knowledgeIds: number[],
  similarityScores: number[],
  aiResponse: string
): Promise<void> {
  try {
    await db.query(`
      INSERT INTO clubai_knowledge_search_log
        (conversation_id, customer_message, knowledge_ids, similarity_scores, ai_response)
      VALUES ($1, $2, $3, $4, $5)
    `, [conversationId, customerMessage, knowledgeIds, similarityScores, aiResponse]);
  } catch (error) {
    logger.warn('[ClubAI-Knowledge] Failed to log search:', error);
  }
}

// ============================================
// KNOWLEDGE MANAGEMENT
// ============================================

/**
 * Get knowledge base stats
 */
export async function getKnowledgeStats(): Promise<{
  total: number;
  conversations: number;
  website: number;
  manual: number;
  withEmbeddings: number;
  avgConfidence: number;
}> {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_active) as total,
        COUNT(*) FILTER (WHERE source_type = 'conversation' AND is_active) as conversations,
        COUNT(*) FILTER (WHERE source_type = 'website' AND is_active) as website,
        COUNT(*) FILTER (WHERE source_type = 'manual' AND is_active) as manual,
        COUNT(*) FILTER (WHERE embedding IS NOT NULL AND is_active) as with_embeddings,
        COALESCE(AVG(confidence_score) FILTER (WHERE is_active), 0) as avg_confidence
      FROM clubai_knowledge
    `);

    const row = result.rows[0];
    return {
      total: parseInt(row.total),
      conversations: parseInt(row.conversations),
      website: parseInt(row.website),
      manual: parseInt(row.manual),
      withEmbeddings: parseInt(row.with_embeddings),
      avgConfidence: parseFloat(row.avg_confidence),
    };
  } catch (error) {
    logger.error('[ClubAI-Knowledge] Failed to get stats:', error);
    return { total: 0, conversations: 0, website: 0, manual: 0, withEmbeddings: 0, avgConfidence: 0 };
  }
}

/**
 * Clear all knowledge of a specific source type (for re-import)
 */
export async function clearKnowledge(sourceType: 'conversation' | 'website' | 'manual'): Promise<number> {
  try {
    const result = await db.query(`
      DELETE FROM clubai_knowledge WHERE source_type = $1
    `, [sourceType]);
    return result.rowCount || 0;
  } catch (error) {
    logger.error('[ClubAI-Knowledge] Failed to clear knowledge:', error);
    return 0;
  }
}

export const clubaiKnowledgeService = {
  generateEmbedding,
  generateEmbeddingsBatch,
  searchKnowledge,
  getRAGContext,
  importConversation,
  importWebsiteContent,
  addManualKnowledge,
  logSearch,
  getKnowledgeStats,
  clearKnowledge,
};
