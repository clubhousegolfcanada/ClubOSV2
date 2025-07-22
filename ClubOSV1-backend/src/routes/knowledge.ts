// src/routes/knowledge.ts

import { Router, Request, Response } from 'express';
import { knowledgeLoader } from '../knowledge-base/knowledgeLoader';
import { logger } from '../utils/logger';
import { LocalProvider } from '../services/llm/LocalProvider';

const router = Router();

// Get all knowledge bases
router.get('/', (req: Request, res: Response) => {
  try {
    const knowledgeBases = knowledgeLoader.getAllKnowledgeBases();
    res.json({
      success: true,
      count: knowledgeBases.length,
      knowledgeBases: knowledgeBases.map(kb => ({
        route: kb.route,
        description: kb.description,
        version: kb.version,
        lastUpdated: kb.lastUpdated
      }))
    });
  } catch (error) {
    logger.error('Error fetching knowledge bases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch knowledge bases'
    });
  }
});

// Search knowledge base
router.post('/search', (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }
    
    const results = knowledgeLoader.searchKnowledge(query);
    
    res.json({
      success: true,
      query,
      count: results.length,
      results
    });
  } catch (error) {
    logger.error('Error searching knowledge base:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search knowledge base'
    });
  }
});

// Find solution for symptoms
router.post('/solution', (req: Request, res: Response) => {
  try {
    const { symptoms } = req.body;
    
    if (!symptoms || !Array.isArray(symptoms)) {
      return res.status(400).json({
        success: false,
        error: 'Symptoms array is required'
      });
    }
    
    const solutions = knowledgeLoader.findSolution(symptoms);
    
    res.json({
      success: true,
      symptoms,
      count: solutions.length,
      solutions
    });
  } catch (error) {
    logger.error('Error finding solution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find solution'
    });
  }
});

// Test the local provider with knowledge base
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { description, userId, context } = req.body;
    
    if (!description) {
      return res.status(400).json({
        success: false,
        error: 'Description is required'
      });
    }
    
    const provider = new LocalProvider();
    const result = await provider.processRequest(description, userId, context);
    
    res.json({
      success: true,
      description,
      result
    });
  } catch (error) {
    logger.error('Error testing local provider:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test local provider'
    });
  }
});

export default router;