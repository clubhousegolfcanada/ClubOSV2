import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

// Test endpoint to check environment variables
router.get('/env-check', (req: Request, res: Response) => {
  logger.info('Environment check requested');
  
  const envCheck = {
    timestamp: new Date().toISOString(),
    node_env: process.env.NODE_ENV,
    has_openai_key: !!process.env.OPENAI_API_KEY,
    has_booking_gpt: !!process.env.BOOKING_ACCESS_GPT_ID,
    has_openphone_number: !!process.env.OPENPHONE_DEFAULT_NUMBER,
    has_database_url: !!process.env.DATABASE_URL,
    
    // Check what config sees
    config_check: {
      has_openai_in_config: !!(global as any).configSnapshot?.OPENAI_API_KEY,
      config_created_at: (global as any).configCreatedAt
    },
    
    // Check assistant service status
    assistant_service: {
      exists: !!(global as any).assistantServiceStatus,
      enabled: (global as any).assistantServiceStatus?.enabled,
      created_at: (global as any).assistantServiceStatus?.createdAt
    }
  };
  
  res.json(envCheck);
});

export default router;