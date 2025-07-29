import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { assistantService } from '../services/assistantService';
import { logger } from '../utils/logger';

const router = Router();

// Simple assistant response endpoint for testing
router.post('/response', authenticate, async (req: Request, res: Response) => {
  const { route, description } = req.body;
  
  try {
    const response = await assistantService.getAssistantResponse(
      route || 'BrandTone',
      description || 'What is 7iron?',
      {}
    );
    
    res.json({
      success: true,
      ...response
    });
  } catch (error) {
    logger.error('Assistant response error:', error);
    res.status(500).json({
      success: false,
      error: String(error)
    });
  }
});

export default router;