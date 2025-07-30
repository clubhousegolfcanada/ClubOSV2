import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { query } from '../utils/db';
import { intelligentSOPModule } from '../services/intelligentSOPModule';
import { knowledgeLoader } from '../knowledge-base/knowledgeLoader';
import { authenticate } from '../middleware/auth';

const router = Router();

// Debug endpoint to check SOP search
router.post('/debug', authenticate, async (req: Request, res: Response) => {
  const { query: searchQuery, assistant = 'brand' } = req.body;
  
  try {
    logger.info('=== SOP DEBUG START ===');
    logger.info('Search query:', searchQuery);
    logger.info('Assistant:', assistant);
    
    // 1. Check SOP module status
    const sopStatus = intelligentSOPModule.getStatus();
    logger.info('SOP Module Status:', sopStatus);
    
    // 2. Direct database search
    const dbResult = await query(`
      SELECT id, assistant, title, 
             substring(content, 1, 200) as content_preview,
             metadata
      FROM sop_embeddings 
      WHERE assistant = $1
      AND (
        content ILIKE $2 
        OR title ILIKE $2
        OR to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', $3)
      )
      LIMIT 10
    `, [assistant, `%${searchQuery}%`, searchQuery]);
    
    logger.info(`Direct DB search found ${dbResult.rows.length} results`);
    
    // 3. Test SOP module search
    let sopDocs = [];
    let sopError = null;
    try {
      sopDocs = await intelligentSOPModule.findRelevantContext(searchQuery, assistant);
      logger.info(`SOP module found ${sopDocs.length} documents`);
    } catch (error) {
      sopError = error.message;
      logger.error('SOP module error:', error);
    }
    
    // 4. Test knowledge loader search
    let knowledgeResults = [];
    let knowledgeError = null;
    try {
      knowledgeResults = await knowledgeLoader.unifiedSearch(searchQuery, {
        includeSOPEmbeddings: true,
        assistant: assistant,
        limit: 10
      });
      logger.info(`Knowledge loader found ${knowledgeResults.length} results`);
    } catch (error) {
      knowledgeError = error.message;
      logger.error('Knowledge loader error:', error);
    }
    
    // 5. Test full SOP processing
    let sopResponse = null;
    let processingError = null;
    if (sopDocs.length > 0) {
      try {
        sopResponse = await intelligentSOPModule.processWithContext(searchQuery, assistant);
        logger.info('SOP processing response:', {
          hasResponse: !!sopResponse.response,
          confidence: sopResponse.confidence,
          source: sopResponse.source
        });
      } catch (error) {
        processingError = error.message;
        logger.error('SOP processing error:', error);
      }
    }
    
    logger.info('=== SOP DEBUG END ===');
    
    res.json({
      query: searchQuery,
      assistant,
      sopStatus,
      results: {
        directDb: {
          count: dbResult.rows.length,
          documents: dbResult.rows
        },
        sopModule: {
          count: sopDocs.length,
          documents: sopDocs.map(d => ({
            id: d.id,
            title: d.title,
            contentPreview: d.content.substring(0, 200)
          })),
          error: sopError
        },
        knowledgeLoader: {
          count: knowledgeResults.length,
          results: knowledgeResults.map(r => ({
            id: r.id,
            issue: r.issue,
            source: r.source
          })),
          error: knowledgeError
        },
        sopProcessing: {
          response: sopResponse,
          error: processingError
        }
      }
    });
  } catch (error) {
    logger.error('Debug endpoint error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

export default router;