import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { intelligentSearch } from '../services/intelligentSearch';
import { intelligentSOPModule } from '../services/intelligentSOPModule';
import { authenticate } from '../middleware/auth';

const router = Router();

// Test intelligent search
router.post('/search', authenticate, async (req: Request, res: Response) => {
  const { query, category, limit = 10 } = req.body;
  
  try {
    logger.info('Intelligent search request:', { query, category });
    
    // Get search results
    const results = await intelligentSearch.intelligentSearch(query, category, limit);
    
    // Also get a synthesized response if we have results
    let synthesizedResponse = null;
    if (results.length > 0) {
      synthesizedResponse = await intelligentSearch.synthesizeResponse(query, results);
    }
    
    res.json({
      query,
      category,
      resultCount: results.length,
      results: results.map(r => ({
        id: r.id,
        title: r.title,
        assistant: r.assistant,
        relevance: r.relevance,
        matchedTerms: r.matchedTerms,
        contentPreview: r.content.substring(0, 200) + '...'
      })),
      synthesizedResponse
    });
  } catch (error) {
    logger.error('Intelligent search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test full assistant response with intelligent search
router.post('/assistant-test', authenticate, async (req: Request, res: Response) => {
  const { query, assistant = 'brand' } = req.body;
  
  try {
    // Get SOP response using intelligent search
    const sopResponse = await intelligentSOPModule.processWithContext(query, assistant);
    
    res.json({
      query,
      assistant,
      response: sopResponse.response,
      confidence: sopResponse.confidence,
      source: sopResponse.source,
      structured: sopResponse.structured
    });
  } catch (error) {
    logger.error('Assistant test error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;