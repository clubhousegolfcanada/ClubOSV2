import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { documentReprocessor } from '../services/documentReprocessor';
import { logger } from '../utils/logger';

const router = Router();

// Reprocess all documents with better titles
router.post('/reprocess-documents', authenticate, roleGuard(['admin']), async (req: Request, res: Response) => {
  try {
    logger.info('Admin requested document reprocessing');
    
    // Run in background
    documentReprocessor.reprocessAllDocuments()
      .then(stats => {
        logger.info('Document reprocessing completed', stats);
      })
      .catch(error => {
        logger.error('Document reprocessing failed:', error);
      });
    
    res.json({
      success: true,
      message: 'Document reprocessing started in background'
    });
  } catch (error: any) {
    logger.error('Failed to start document reprocessing:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Fix color documents specifically
router.post('/fix-color-documents', authenticate, roleGuard(['admin']), async (req: Request, res: Response) => {
  try {
    await documentReprocessor.fixColorDocuments();
    
    res.json({
      success: true,
      message: 'Color document analysis completed - check logs'
    });
  } catch (error: any) {
    logger.error('Failed to fix color documents:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;