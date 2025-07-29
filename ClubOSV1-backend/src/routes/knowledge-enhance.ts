import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { knowledgeEnhancer } from '../services/knowledgeEnhancer';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';

const router = Router();

// Enhance existing documents
router.post('/enhance', authenticate, roleGuard(['admin']), async (req: Request, res: Response) => {
  const { batchSize = 10 } = req.body;
  
  try {
    logger.info('Starting document enhancement...');
    
    // Get current progress
    const before = await knowledgeEnhancer.getProgress();
    
    // Enhance documents
    await knowledgeEnhancer.enhanceExistingDocuments(batchSize);
    
    // Get updated progress
    const after = await knowledgeEnhancer.getProgress();
    
    res.json({
      success: true,
      before,
      after,
      enhanced: after.enhanced - before.enhanced
    });
  } catch (error) {
    logger.error('Enhancement failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate proper embeddings
router.post('/embeddings', authenticate, roleGuard(['admin']), async (req: Request, res: Response) => {
  const { batchSize = 20 } = req.body;
  
  try {
    await knowledgeEnhancer.generateProperEmbeddings(batchSize);
    
    const progress = await knowledgeEnhancer.getProgress();
    
    res.json({
      success: true,
      progress
    });
  } catch (error) {
    logger.error('Embedding generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Optimize database
router.post('/optimize', authenticate, roleGuard(['admin']), async (req: Request, res: Response) => {
  try {
    await knowledgeEnhancer.optimizeDatabase();
    
    res.json({
      success: true,
      message: 'Database optimization complete'
    });
  } catch (error) {
    logger.error('Optimization failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get enhancement status
router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const progress = await knowledgeEnhancer.getProgress();
    
    const percentage = progress.total > 0 
      ? Math.round((progress.enhanced / progress.total) * 100)
      : 0;
    
    res.json({
      ...progress,
      percentageEnhanced: percentage,
      needsEnhancement: progress.total - progress.enhanced
    });
  } catch (error) {
    logger.error('Status check failed:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;