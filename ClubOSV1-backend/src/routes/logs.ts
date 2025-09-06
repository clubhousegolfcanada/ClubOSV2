import { Router, Request, Response } from 'express';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * POST /api/logs/frontend
 * Log frontend errors and events
 */
router.post('/frontend', async (req: Request, res: Response) => {
  try {
    const { level, message, context } = req.body;
    const userId = (req as any).user?.id || null;
    
    // Validate level
    const validLevels = ['debug', 'info', 'warn', 'error', 'fatal'];
    const logLevel = validLevels.includes(level) ? level : 'info';
    
    // Insert log entry
    await db.query(
      `INSERT INTO frontend_logs (level, message, context, user_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        logLevel,
        message || 'No message provided',
        context || {},
        userId,
        req.ip,
        req.get('user-agent')
      ]
    );
    
    // Also log to backend logger for monitoring
    logger.info(`[Frontend ${logLevel.toUpperCase()}]`, {
      message,
      context,
      userId,
      ip: req.ip
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to log frontend event:', error);
    // Don't fail the request, just acknowledge
    res.json({ success: false });
  }
});

/**
 * GET /api/logs/frontend
 * Get recent frontend logs (admin only)
 */
router.get('/frontend', 
  authenticate,
  async (req: Request, res: Response) => {
    try {
      // Check if user is admin
      if ((req as any).user?.role !== 'admin') {
        return res.status(403).json({ 
          success: false, 
          error: 'Admin access required' 
        });
      }
      
      const { limit = 100, level, user_id } = req.query;
      
      let query = `
        SELECT 
          fl.*,
          u.name as user_name,
          u.email as user_email
        FROM frontend_logs fl
        LEFT JOIN users u ON fl.user_id = u.id
        WHERE 1=1
      `;
      
      const params: any[] = [];
      let paramCount = 0;
      
      if (level) {
        query += ` AND fl.level = $${++paramCount}`;
        params.push(level);
      }
      
      if (user_id) {
        query += ` AND fl.user_id = $${++paramCount}`;
        params.push(user_id);
      }
      
      query += ` ORDER BY fl.created_at DESC LIMIT $${++paramCount}`;
      params.push(limit);
      
      const result = await db.query(query, params);
      
      res.json({
        success: true,
        logs: result.rows
      });
    } catch (error) {
      logger.error('Failed to fetch frontend logs:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch logs' 
      });
    }
  }
);

export default router;