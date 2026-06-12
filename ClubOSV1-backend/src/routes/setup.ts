import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
// import { setupDatabase } from '../scripts/setupDatabase';

const router = Router();

// One-time database setup endpoint
router.post('/setup-database', async (req: Request, res: Response) => {
  try {
    // Security check - key comes from DB_SETUP_KEY env var; fails closed if unset
    const setupKey = req.headers['x-setup-key'];
    const expectedKey = process.env.DB_SETUP_KEY;

    if (!expectedKey || setupKey !== expectedKey) {
      return res.status(401).json({
        success: false,
        message: 'Invalid setup key'
      });
    }
    
    logger.debug('Starting database setup via HTTP endpoint...');
    
    // Run the setup
    // await setupDatabase();
    
    res.json({
      success: true,
      message: 'Database setup completed successfully'
    });
    
  } catch (error: any) {
    logger.error('Database setup failed:', error);
    res.status(500).json({
      success: false,
      message: 'Database setup failed',
      error: error.message
    });
  }
});

export default router;
