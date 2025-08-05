import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import OpenAI from 'openai';

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface ExtractedKnowledge {
  category: string;
  problem: string;
  solution: string;
  confidence: number;
  context?: string;
  phoneNumber: string;
  conversationId: string;
}

// Process unprocessed conversations for knowledge extraction
router.post('/process-conversations',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response) => {
    try {
      const { limit = 10 } = req.body;
      
      // Get unprocessed conversations
      const conversationsResult = await db.query(`
        SELECT * FROM openphone_conversations 
        WHERE processed = false 
        ORDER BY created_at DESC 
        LIMIT $1
      `, [limit]);
      
      if (conversationsResult.rows.length === 0) {
        return res.json({
          success: true,
          message: 'No unprocessed conversations found',
          processed: 0
        });
      }
      
      const results = {
        processed: 0,
        knowledgeExtracted: 0,
        errors: 0,
        knowledge: [] as ExtractedKnowledge[]
      };
      
      // Process each conversation
      for (const conversation of conversationsResult.rows) {
        try {
          const messages = conversation.messages || [];
          if (messages.length === 0) {
            continue;
          }
          
          // Format conversation for analysis
          const conversationText = messages.map((msg: any) => {
            const direction = msg.direction === 'inbound' ? 'Customer' : 'Support';
            return `${direction}: ${msg.body || msg.text || ''}`;
          }).join('\n');
          
          // Extract knowledge using OpenAI
          const knowledge = await extractKnowledgeFromConversation(
            conversationText,
            conversation.phone_number,
            conversation.id
          );
          
          // Store extracted knowledge
          if (knowledge.length > 0) {
            for (const item of knowledge) {
              // Try with metadata first, fall back to without if column doesn't exist
              try {
                await db.query(`
                  INSERT INTO extracted_knowledge 
                  (source_id, source_type, category, problem, solution, confidence, metadata, created_at)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                `, [
                  conversation.id,
                  'openphone_conversation',
                  item.category,
                  item.problem,
                  item.solution,
                  item.confidence,
                  JSON.stringify({
                    phoneNumber: item.phoneNumber,
                    conversationId: item.conversationId,
                    context: item.context
                  })
                ]);
              } catch (err: any) {
                if (err.code === '42703') { // Column doesn't exist
                  // Fall back to insert without metadata
                  await db.query(`
                    INSERT INTO extracted_knowledge 
                    (source_id, source_type, category, problem, solution, confidence, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, NOW())
                  `, [
                    conversation.id,
                    'openphone_conversation',
                    item.category,
                    item.problem,
                    item.solution,
                    item.confidence
                  ]);
                } else {
                  throw err; // Re-throw other errors
                }
              }
              
              results.knowledge.push(item);
            }
            results.knowledgeExtracted += knowledge.length;
          }
          
          // Mark conversation as processed
          await db.query(`
            UPDATE openphone_conversations 
            SET processed = true, processed_at = NOW()
            WHERE id = $1
          `, [conversation.id]);
          
          results.processed++;
          
        } catch (error) {
          logger.error('Failed to process conversation:', {
            conversationId: conversation.id,
            error
          });
          results.errors++;
        }
      }
      
      logger.info('Conversation processing complete', results);
      
      res.json({
        success: true,
        results
      });
      
    } catch (error) {
      logger.error('Failed to process conversations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process conversations'
      });
    }
  }
);

// Extract knowledge from a single conversation
async function extractKnowledgeFromConversation(
  conversationText: string,
  phoneNumber: string,
  conversationId: string
): Promise<ExtractedKnowledge[]> {
  try {
    const prompt = `Analyze this customer service SMS conversation and extract actionable knowledge.

Conversation:
${conversationText}

Extract any valuable information that could help improve customer service, including:
1. Common questions and their answers
2. Issues/problems and their solutions
3. Customer preferences or feedback
4. Process improvements
5. Product/service information shared

For each piece of knowledge, determine:
- Category: gift_cards, booking, access, technical, hours, membership, general
- Problem/Question: What the customer asked or issue they had
- Solution/Answer: How it was resolved or answered
- Confidence: 0-1, how useful this knowledge is for future interactions

Focus on concrete, reusable information. Skip small talk or one-off specific issues.
Return as JSON: {"knowledge": [...]}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing customer service conversations and extracting actionable knowledge.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });
    
    const result = JSON.parse(response.choices[0].message.content || '{"knowledge": []}');
    const knowledge: ExtractedKnowledge[] = (result.knowledge || []).map((item: any) => ({
      ...item,
      phoneNumber,
      conversationId
    }));
    
    return knowledge.filter(item => item.confidence > 0.6);
    
  } catch (error) {
    logger.error('Failed to extract knowledge:', error);
    return [];
  }
}

// Get processing status
router.get('/processing-status',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const stats = await db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE processed = false) as unprocessed,
          COUNT(*) FILTER (WHERE processed = true) as processed,
          COUNT(*) as total
        FROM openphone_conversations
      `);
      
      const recentKnowledge = await db.query(`
        SELECT * FROM extracted_knowledge 
        WHERE source_type = 'openphone_conversation'
        ORDER BY created_at DESC
        LIMIT 10
      `);
      
      res.json({
        success: true,
        stats: stats.rows[0],
        recentKnowledge: recentKnowledge.rows
      });
      
    } catch (error) {
      logger.error('Failed to get processing status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get status'
      });
    }
  }
);

export default router;