import { Router } from 'express';
import { knowledgeSearchService } from '../services/knowledgeSearchService';
import { assistantService } from '../services/assistantService';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

const router = Router();

/**
 * Test endpoint to verify knowledge system is working
 * GET /api/test-knowledge?query=Do you offer gift cards?
 */
router.get('/test-knowledge', async (req, res) => {
  try {
    const query = req.query.query as string || 'Do you offer gift cards?';
    
    logger.info('🧪 TEST: Knowledge system test started', { query });
    
    // 1. Test direct database query
    const dbTest = await db.query(`
      SELECT key, confidence, 
             ts_rank(search_vector, plainto_tsquery('english', $1)) as relevance
      FROM knowledge_store 
      WHERE search_vector @@ plainto_tsquery('english', $1) 
        AND superseded_by IS NULL
      ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC
      LIMIT 3
    `, [query]);
    
    logger.info('🧪 TEST: Database results', { 
      count: dbTest.rows.length,
      results: dbTest.rows 
    });
    
    // 2. Test knowledge search service
    const searchResults = await knowledgeSearchService.searchKnowledge(query, undefined, 5);
    
    logger.info('🧪 TEST: Knowledge search results', {
      count: searchResults.length,
      topResult: searchResults[0] ? {
        key: searchResults[0].key,
        confidence: searchResults[0].confidence,
        relevance: searchResults[0].relevance,
        combinedScore: searchResults[0].confidence * searchResults[0].relevance
      } : null
    });
    
    // 3. Test assistant service
    const assistantResponse = await assistantService.getAssistantResponse(
      'Booking & Access',
      query,
      { isCustomerFacing: true }
    );
    
    const usedLocal = assistantResponse.assistantId?.includes('LOCAL-KNOWLEDGE') || 
                      assistantResponse.metadata?.dataSource === 'LOCAL_DATABASE';
    
    logger.info('🧪 TEST: Assistant response', {
      usedLocal,
      assistantId: assistantResponse.assistantId,
      confidence: assistantResponse.confidence,
      metadata: assistantResponse.metadata
    });
    
    // Return comprehensive results
    res.json({
      success: true,
      query,
      databaseResults: {
        count: dbTest.rows.length,
        topResult: dbTest.rows[0] || null
      },
      searchServiceResults: {
        count: searchResults.length,
        topResult: searchResults[0] ? {
          key: searchResults[0].key,
          confidence: searchResults[0].confidence,
          relevance: searchResults[0].relevance,
          combinedScore: searchResults[0].confidence * searchResults[0].relevance,
          wouldUseLocal: (searchResults[0].confidence * searchResults[0].relevance) >= 0.15
        } : null
      },
      assistantResponse: {
        usedLocalKnowledge: usedLocal,
        assistantId: assistantResponse.assistantId,
        confidence: assistantResponse.confidence,
        responsePreview: assistantResponse.response.substring(0, 200) + '...'
      },
      summary: {
        knowledgeFound: searchResults.length > 0,
        localKnowledgeUsed: usedLocal,
        apiCallsSaved: usedLocal ? 1 : 0
      }
    });
    
  } catch (error) {
    logger.error('🧪 TEST: Error in knowledge test', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;