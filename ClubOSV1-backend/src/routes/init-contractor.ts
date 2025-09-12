import { Router, Request, Response } from 'express';
import initializeContractorSupport from '../api-initialize-contractor';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';

const router = Router();

// Temporary endpoint to initialize contractor support
// Only admins can run this
router.post('/initialize', 
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response) => {
    try {
      console.log('Admin requested contractor initialization...');
      const result = await initializeContractorSupport();
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Contractor support has been initialized successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to initialize contractor support'
        });
      }
    } catch (error: any) {
      console.error('Error in initialization endpoint:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

export default router;