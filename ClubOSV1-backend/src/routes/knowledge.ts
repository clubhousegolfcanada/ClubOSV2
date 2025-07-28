import { Router, Request, Response } from 'express';
import { knowledgeExtractor } from '../services/knowledgeExtractor';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';

const router = Router();

// All knowledge routes require admin access
router.use(authenticate);
router.use(roleGuard(['admin']));

// Process unprocessed OpenPhone conversations
router.post('/extract', async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.body;
    
    logger.info('Starting knowledge extraction', { limit });
    
    const stats = await knowledgeExtractor.processUnprocessedConversations(limit);
    
    res.json({
      success: true,
      data: stats,
      message: `Processed ${stats.processed} conversations, extracted ${stats.extracted} knowledge items`
    });
    
  } catch (error) {
    logger.error('Knowledge extraction failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to extract knowledge'
    });
  }
});

// Get unapplied knowledge for review
router.get('/unapplied', async (req: Request, res: Response) => {
  try {
    const { category, limit = 50 } = req.query;
    
    const knowledge = await knowledgeExtractor.getUnappliedKnowledge(
      category as string,
      parseInt(limit as string)
    );
    
    res.json({
      success: true,
      data: knowledge,
      count: knowledge.length
    });
    
  } catch (error) {
    logger.error('Failed to get unapplied knowledge:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve knowledge'
    });
  }
});

// Mark knowledge as applied
router.put('/:id/apply', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sopFile } = req.body;
    
    if (!sopFile) {
      return res.status(400).json({
        success: false,
        error: 'SOP file path is required'
      });
    }
    
    await knowledgeExtractor.markKnowledgeApplied(id, sopFile);
    
    res.json({
      success: true,
      message: 'Knowledge marked as applied'
    });
    
  } catch (error) {
    logger.error('Failed to mark knowledge as applied:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update knowledge'
    });
  }
});

// Batch apply knowledge
router.post('/apply-batch', async (req: Request, res: Response) => {
  try {
    const { knowledgeIds, sopFile } = req.body;
    
    if (!knowledgeIds || !Array.isArray(knowledgeIds) || knowledgeIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Knowledge IDs array is required'
      });
    }
    
    if (!sopFile) {
      return res.status(400).json({
        success: false,
        error: 'SOP file path is required'
      });
    }
    
    await knowledgeExtractor.applyKnowledgeBatch(knowledgeIds, sopFile);
    
    res.json({
      success: true,
      message: `Applied ${knowledgeIds.length} knowledge items to ${sopFile}`
    });
    
  } catch (error) {
    logger.error('Failed to batch apply knowledge:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply knowledge batch'
    });
  }
});

// Get extraction statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await knowledgeExtractor.getExtractionStats();
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('Failed to get extraction stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics'
    });
  }
});

// Search for similar knowledge
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { problem, category } = req.query;
    
    if (!problem || !category) {
      return res.status(400).json({
        success: false,
        error: 'Problem and category are required'
      });
    }
    
    const similar = await knowledgeExtractor.findSimilarKnowledge(
      problem as string,
      category as string
    );
    
    res.json({
      success: true,
      data: similar,
      count: similar.length
    });
    
  } catch (error) {
    logger.error('Failed to search knowledge:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search knowledge'
    });
  }
});

// Process manual knowledge entry
router.post('/manual-entry', async (req: Request, res: Response) => {
  try {
    const { entry } = req.body;
    
    if (!entry || typeof entry !== 'string' || !entry.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Entry text is required'
      });
    }
    
    logger.info('Processing manual knowledge entry', { entry: entry.substring(0, 100) + '...' });
    
    // Process the manual entry using the knowledge extractor
    const result = await knowledgeExtractor.processManualEntry(entry.trim());
    
    res.json({
      success: true,
      data: result,
      message: 'Knowledge processed and added to SOP'
    });
    
  } catch (error) {
    logger.error('Failed to process manual knowledge entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process knowledge entry'
    });
  }
});

export default router;