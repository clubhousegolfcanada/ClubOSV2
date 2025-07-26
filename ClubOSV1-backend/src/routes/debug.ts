import { Router, Request, Response } from 'express';
// JSON operations removed - using PostgreSQL
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

const router = Router();

// Debug endpoint to check users (remove in production)
router.get('/debug/users', async (req: Request, res: Response) => {
  try {
    const dataDir = process.env.DATA_PATH || path.join(process.cwd(), 'src', 'data');
    const usersPath = path.join(dataDir, 'users.json');
    
    logger.info('Debug info:', {
      dataDir,
      usersPath,
      cwd: process.cwd(),
      exists: fs.existsSync(usersPath)
    });
    
    if (fs.existsSync(usersPath)) {
      const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
      res.json({
        dataDir,
        usersPath,
        userCount: users.length,
        users: users.map((u: any) => ({ email: u.email, role: u.role }))
      });
    } else {
      res.json({
        dataDir,
        usersPath,
        exists: false,
        message: 'Users file not found'
      });
    }
  } catch (error) {
    res.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      cwd: process.cwd(),
      dataPath: process.env.DATA_PATH
    });
  }
});

export default router;
