import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// Debug endpoint to check user and database status
router.get('/check-user', authenticate, async (req: Request, res: Response) => {
  try {
    const tokenUser = req.user;
    
    // Check if user exists in database by ID
    const userById = await db.query(
      'SELECT id, email, name, role FROM users WHERE id = $1',
      [tokenUser!.id]
    );
    
    // Check if user exists in database by email
    const userByEmail = await db.query(
      'SELECT id, email, name, role FROM users WHERE email = $1',
      [tokenUser!.email]
    );
    
    // Get total user count
    const userCount = await db.query('SELECT COUNT(*) as count FROM users');
    
    // Get all users (limited to 10 for safety)
    const allUsers = await db.query(
      'SELECT id, email, name, role FROM users ORDER BY created_at DESC LIMIT 10'
    );
    
    res.json({
      success: true,
      tokenInfo: {
        id: tokenUser!.id,
        email: tokenUser!.email,
        role: tokenUser!.role
      },
      databaseCheck: {
        userExistsById: userById.rows.length > 0,
        userExistsByEmail: userByEmail.rows.length > 0,
        userByIdData: userById.rows[0] || null,
        userByEmailData: userByEmail.rows[0] || null
      },
      databaseStats: {
        totalUsers: parseInt(userCount.rows[0]?.count || '0'),
        recentUsers: allUsers.rows
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        databaseUrl: process.env.DATABASE_URL ? 'Connected' : 'Not configured',
        isRailway: process.env.RAILWAY_ENVIRONMENT ? true : false
      }
    });
  } catch (error: any) {
    logger.error('Debug check failed', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check user status',
      details: error.message
    });
  }
});

export default router;