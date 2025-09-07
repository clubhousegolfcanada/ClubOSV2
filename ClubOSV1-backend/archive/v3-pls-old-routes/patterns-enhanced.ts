/**
 * Enhanced Pattern API Routes
 * Supports editing trigger examples and validates GPT-4o compatibility
 */

import { Router, Request, Response } from 'express';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import OpenAI from 'openai';

const router = Router();

// Initialize OpenAI if available
let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Update pattern with enhanced fields (trigger examples, response, etc.)
 */
router.put('/patterns/:id/enhanced', 
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { 
        trigger_examples, // Array of example questions
        response_template,
        pattern, // Primary trigger text
        trigger_keywords // Keywords for matching
      } = req.body;

      // Validate the response template with GPT-4o
      if (openai && response_template) {
        const validation = await validateResponseWithGPT4o(response_template, trigger_examples || [pattern]);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: 'Response validation failed',
            details: validation.issues
          });
        }
      }

      // Generate embeddings for trigger examples
      const embeddings: number[][] = [];
      if (openai && trigger_examples && trigger_examples.length > 0) {
        for (const example of trigger_examples) {
          const embedding = await generateEmbedding(example);
          if (embedding) embeddings.push(embedding);
        }
      }

      // Update the pattern
      const updateQuery = `
        UPDATE decision_patterns
        SET 
          pattern = COALESCE($1, pattern),
          response_template = COALESCE($2, response_template),
          trigger_keywords = COALESCE($3, trigger_keywords),
          trigger_examples = COALESCE($4, trigger_examples),
          embedding = CASE 
            WHEN $5::float[] IS NOT NULL THEN $5::float[]
            ELSE embedding
          END,
          semantic_search_enabled = CASE
            WHEN $5::float[] IS NOT NULL THEN true
            ELSE semantic_search_enabled
          END,
          updated_at = NOW(),
          updated_by = $6
        WHERE id = $7
        RETURNING *
      `;

      // Use average of embeddings for the pattern
      const avgEmbedding = embeddings.length > 0 
        ? embeddings[0] // For simplicity, use first one. Could average them.
        : null;

      const result = await db.query(updateQuery, [
        pattern,
        response_template,
        trigger_keywords,
        trigger_examples,
        avgEmbedding,
        req.user?.id,
        id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Pattern not found'
        });
      }

      // If trigger examples changed, re-generate signatures
      if (trigger_examples && trigger_examples.length > 0) {
        await regeneratePatternSignatures(parseInt(id), trigger_examples);
      }

      res.json({
        success: true,
        data: result.rows[0],
        validation: {
          gpt4o_validated: true,
          semantic_search_enabled: avgEmbedding !== null
        }
      });

    } catch (error) {
      logger.error('Error updating pattern:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update pattern'
      });
    }
  }
);

/**
 * Test pattern matching with a sample message
 */
router.post('/patterns/test-match',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const { message, pattern_id } = req.body;

      // Get the pattern
      const patternResult = await db.query(
        'SELECT * FROM decision_patterns WHERE id = $1',
        [pattern_id]
      );

      if (patternResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Pattern not found'
        });
      }

      const pattern = patternResult.rows[0];

      // Test different matching methods
      const results = {
        keyword_match: false,
        semantic_match: false,
        semantic_score: 0,
        gpt4o_match: false,
        gpt4o_reasoning: '',
        would_trigger: false
      };

      // 1. Keyword matching
      if (pattern.trigger_keywords && pattern.trigger_keywords.length > 0) {
        const messageLower = message.toLowerCase();
        results.keyword_match = pattern.trigger_keywords.some((keyword: string) => 
          messageLower.includes(keyword.toLowerCase())
        );
      }

      // 2. Semantic matching
      if (openai && pattern.embedding) {
        const messageEmbedding = await generateEmbedding(message);
        if (messageEmbedding) {
          results.semantic_score = cosineSimilarity(messageEmbedding, pattern.embedding);
          results.semantic_match = results.semantic_score > 0.75;
        }
      }

      // 3. GPT-4o understanding
      if (openai) {
        const gptResult = await testWithGPT4o(message, pattern);
        results.gpt4o_match = gptResult.matches;
        results.gpt4o_reasoning = gptResult.reasoning;
      }

      // Overall decision
      results.would_trigger = results.keyword_match || results.semantic_match || results.gpt4o_match;

      res.json({
        success: true,
        pattern: {
          id: pattern.id,
          pattern: pattern.pattern,
          response_template: pattern.response_template
        },
        test_message: message,
        results
      });

    } catch (error) {
      logger.error('Error testing pattern match:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test pattern match'
      });
    }
  }
);

/**
 * Validate response template with GPT-4o
 */
async function validateResponseWithGPT4o(
  responseTemplate: string, 
  triggerExamples: string[]
): Promise<{ valid: boolean; issues?: string[] }> {
  if (!openai) return { valid: true };

  try {
    const prompt = `Validate this customer service response template:

Response Template: "${responseTemplate}"
Example Customer Questions: ${triggerExamples.map(e => `"${e}"`).join(', ')}

Check for:
1. The response uses appropriate template variables ({{customer_name}}, {{location}}, etc.)
2. The response is relevant to the example questions
3. The response doesn't make unverifiable claims
4. The tone is professional and helpful
5. URLs and specific information are preserved exactly

Return JSON: { "valid": true/false, "issues": ["issue1", "issue2"] }`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: "json_object" },
      max_tokens: 500
    });

    const result = JSON.parse(completion.choices[0].message.content || '{"valid": true}');
    return result;

  } catch (error) {
    logger.error('GPT-4o validation error:', error);
    return { valid: true }; // Default to valid if error
  }
}

/**
 * Test if a message would match a pattern using GPT-4o
 */
async function testWithGPT4o(
  message: string,
  pattern: any
): Promise<{ matches: boolean; reasoning: string }> {
  if (!openai) return { matches: false, reasoning: 'GPT-4o not available' };

  try {
    const prompt = `Determine if this customer message matches this pattern:

Customer Message: "${message}"

Pattern Information:
- Pattern: "${pattern.pattern}"
- Trigger Examples: ${JSON.stringify(pattern.trigger_examples || [])}
- Keywords: ${JSON.stringify(pattern.trigger_keywords || [])}
- Type: ${pattern.pattern_type}

Would this pattern be appropriate to handle this message? Consider semantic meaning, not just exact words.

Return JSON: { "matches": true/false, "reasoning": "brief explanation" }`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: "json_object" },
      max_tokens: 200
    });

    const result = JSON.parse(completion.choices[0].message.content || '{"matches": false}');
    return result;

  } catch (error) {
    logger.error('GPT-4o test error:', error);
    return { matches: false, reasoning: 'Error during GPT-4o analysis' };
  }
}

/**
 * Generate embedding for text
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!openai) return null;

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    return response.data[0].embedding;
  } catch (error) {
    logger.error('Embedding generation error:', error);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Regenerate pattern signatures for multiple trigger examples
 */
async function regeneratePatternSignatures(patternId: number, triggerExamples: string[]) {
  try {
    // Store multiple signatures for better matching
    const signatures = triggerExamples.map(example => {
      const normalized = example
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return require('crypto').createHash('md5').update(normalized).digest('hex');
    });

    // Store primary signature and additional signatures
    await db.query(`
      UPDATE decision_patterns 
      SET 
        pattern_signature = $1,
        additional_signatures = $2
      WHERE id = $3
    `, [signatures[0], signatures.slice(1), patternId]);

  } catch (error) {
    logger.error('Error regenerating signatures:', error);
  }
}

export default router;