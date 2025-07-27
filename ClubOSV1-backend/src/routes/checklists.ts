import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validation';
import { body, query } from 'express-validator';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Submit a completed checklist
router.post('/submit',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  validate([
    body('category').isIn(['cleaning', 'tech']).withMessage('Invalid category'),
    body('type').isIn(['daily', 'weekly', 'quarterly']).withMessage('Invalid type'),
    body('location').notEmpty().withMessage('Location is required'),
    body('completedTasks').isArray().withMessage('Completed tasks must be an array'),
    body('totalTasks').isInt({ min: 1 }).withMessage('Total tasks must be a positive integer')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, type, location, completedTasks, totalTasks } = req.body;
      const userId = req.user!.id;

      // Save the submission
      const submission = await db.query(
        `INSERT INTO checklist_submissions 
         (user_id, category, type, location, completed_tasks, total_tasks)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, category, type, location, JSON.stringify(completedTasks), totalTasks]
      );

      logger.info('Checklist submitted', {
        userId,
        category,
        type,
        location,
        taskCount: totalTasks
      });

      res.json({
        success: true,
        data: submission.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get checklist submissions with filtering
router.get('/submissions',
  authenticate,
  roleGuard(['admin', 'operator']),
  validate([
    query('category').optional().isIn(['cleaning', 'tech']),
    query('type').optional().isIn(['daily', 'weekly', 'quarterly']),
    query('location').optional(),
    query('userId').optional().isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        category,
        type,
        location,
        userId,
        startDate,
        endDate,
        limit = 50,
        offset = 0
      } = req.query;

      let queryStr = `
        SELECT 
          cs.*,
          u.name as user_name,
          u.email as user_email
        FROM checklist_submissions cs
        JOIN users u ON cs.user_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramCount = 0;

      if (category) {
        queryStr += ` AND cs.category = $${++paramCount}`;
        params.push(category);
      }

      if (type) {
        queryStr += ` AND cs.type = $${++paramCount}`;
        params.push(type);
      }

      if (location) {
        queryStr += ` AND cs.location = $${++paramCount}`;
        params.push(location);
      }

      if (userId) {
        queryStr += ` AND cs.user_id = $${++paramCount}`;
        params.push(userId);
      }

      if (startDate) {
        queryStr += ` AND cs.completion_time >= $${++paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        queryStr += ` AND cs.completion_time <= $${++paramCount}`;
        params.push(endDate);
      }

      queryStr += ` ORDER BY cs.completion_time DESC`;
      queryStr += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(limit, offset);

      const result = await db.query(queryStr, params);

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total
        FROM checklist_submissions cs
        WHERE 1=1
      `;
      const countParams = params.slice(0, -2); // Remove limit and offset

      if (category) countQuery += ` AND cs.category = $1`;
      if (type) countQuery += ` AND cs.type = $${category ? 2 : 1}`;
      // ... add other conditions

      const countResult = await db.query(countQuery, countParams);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get submission statistics
router.get('/stats',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get completion stats by category and type
      const statsQuery = `
        SELECT 
          category,
          type,
          COUNT(*) as submission_count,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT location) as unique_locations,
          MAX(completion_time) as last_completed
        FROM checklist_submissions
        WHERE completion_time >= NOW() - INTERVAL '30 days'
        GROUP BY category, type
        ORDER BY category, type
      `;

      const stats = await db.query(statsQuery);

      // Get recent submissions
      const recentQuery = `
        SELECT 
          cs.*,
          u.name as user_name
        FROM checklist_submissions cs
        JOIN users u ON cs.user_id = u.id
        ORDER BY cs.completion_time DESC
        LIMIT 10
      `;

      const recent = await db.query(recentQuery);

      res.json({
        success: true,
        data: {
          stats: stats.rows,
          recent: recent.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;