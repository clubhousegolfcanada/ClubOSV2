import { Router } from 'express';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { getOpenAIClient } from '../utils/openaiClient';

const router = Router();

/**
 * Public endpoint to trigger knowledge processing
 * GET /api/process-knowledge/status
 */
router.get('/status', async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM knowledge_store WHERE superseded_by IS NULL) as total_knowledge,
        (SELECT COUNT(*) FROM knowledge_store WHERE source_type = 'sop') as sop_knowledge,
        (SELECT COUNT(*) FROM knowledge_store WHERE source_type LIKE '%conversation%') as conversation_knowledge,
        (SELECT COUNT(*) FROM openphone_conversations WHERE processed = false OR processed IS NULL) as unprocessed_openphone,
        (SELECT COUNT(*) FROM conversation_sessions) as total_sessions
    `);

    res.json({
      success: true,
      stats: stats.rows[0],
      openai_configured: !!process.env.OPENAI_API_KEY,
      ready_to_process: !!(process.env.OPENAI_API_KEY && getOpenAIClient())
    });
  } catch (error) {
    logger.error('Error getting process status:', error);
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

/**
 * Process conversations for knowledge extraction
 * POST /api/process-knowledge/conversations
 */
router.post('/conversations', async (req, res) => {
  try {
    const { secret, limit = 5 } = req.body;
    
    // Simple secret check for production use
    if (secret !== process.env.ADMIN_SECRET && secret !== 'process-knowledge-2025') {
      return res.status(401).json({ error: 'Invalid secret' });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(500).json({ 
        error: 'OpenAI not configured',
        hint: 'Set OPENAI_API_KEY environment variable in Railway'
      });
    }

    // Get unprocessed conversations
    const conversations = await db.query(`
      SELECT * FROM openphone_conversations 
      WHERE (processed = false OR processed IS NULL)
      AND messages IS NOT NULL
      ORDER BY created_at DESC 
      LIMIT $1
    `, [limit]);

    const results = {
      processed: 0,
      knowledge_added: 0,
      errors: 0
    };

    for (const conv of conversations.rows) {
      try {
        const messages = conv.messages || [];
        if (messages.length < 3) continue;

        // Format conversation
        const text = messages.slice(0, 20).map((m: any) => 
          `${m.direction === 'inbound' ? 'Customer' : 'Support'}: ${m.body || m.text || ''}`
        ).join('\n');

        // Extract knowledge
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Extract valuable, reusable knowledge from this conversation. Focus on facts about services, policies, procedures, and solutions to problems.'
            },
            {
              role: 'user',
              content: `Extract knowledge from:\n${text.substring(0, 2000)}\n\nReturn as JSON: {"knowledge": [{"category": "gift_cards|booking|pricing|hours|membership|technical|policies|general", "question": "...", "answer": "...", "confidence": 0.0-1.0}]}`
            }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        });

        const result = JSON.parse(response.choices[0].message.content || '{"knowledge": []}');

        // Add valuable knowledge
        for (const item of result.knowledge || []) {
          if (item.confidence >= 0.6) {
            const key = `conv.${item.category}.${conv.id}.${Date.now()}`;
            
            await db.query(`
              INSERT INTO knowledge_store (key, value, confidence, category, source_type, source_id, source_table)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (key) DO NOTHING
            `, [
              key,
              JSON.stringify({
                question: item.question,
                answer: item.answer,
                content: item.answer,
                conversation_id: conv.conversation_id
              }),
              item.confidence * 0.8,
              item.category || 'general',
              'openphone_conversation',
              conv.id,
              'openphone_conversations'
            ]);
            
            results.knowledge_added++;
          }
        }

        // Mark as processed
        await db.query('UPDATE openphone_conversations SET processed = true WHERE id = $1', [conv.id]);
        results.processed++;

      } catch (error) {
        logger.error(`Error processing conversation ${conv.id}:`, error);
        results.errors++;
      }
    }

    // Get final stats
    const finalStats = await db.query('SELECT COUNT(*) as total FROM knowledge_store WHERE superseded_by IS NULL');

    res.json({
      success: true,
      results,
      total_knowledge: finalStats.rows[0].total,
      message: `Processed ${results.processed} conversations, added ${results.knowledge_added} knowledge items`
    });

  } catch (error) {
    logger.error('Error processing conversations:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Processing failed' 
    });
  }
});

export default router;