import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validation';
import { body, query } from 'express-validator';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Define checklist templates
const CHECKLIST_TEMPLATES = {
  cleaning: {
    daily: [
      { id: 'balls', label: 'Replace practice balls' },
      { id: 'garbage', label: 'Empty all garbage bins' },
      { id: 'bathroom', label: 'Clean and restock bathrooms' },
      { id: 'water', label: 'Refill water stations' },
      { id: 'mats', label: 'Check and clean hitting mats' },
      { id: 'screens', label: 'Wipe down screens' }
    ],
    weekly: [
      { id: 'deep-clean', label: 'Deep clean all bays' },
      { id: 'vacuum', label: 'Vacuum entire facility' },
      { id: 'windows', label: 'Clean all windows' },
      { id: 'equipment', label: 'Inspect and clean equipment' },
      { id: 'storage', label: 'Organize storage areas' },
      { id: 'hvac', label: 'Check HVAC filters' }
    ],
    quarterly: [
      { id: 'walls', label: 'Wash walls and touch-up paint' },
      { id: 'carpet', label: 'Deep carpet cleaning' },
      { id: 'maintenance', label: 'Equipment maintenance check' },
      { id: 'inventory', label: 'Complete inventory audit' },
      { id: 'safety', label: 'Safety equipment inspection' }
    ]
  },
  tech: {
    daily: null, // Tech doesn't have daily tasks
    weekly: [
      { id: 'software', label: 'Update TrackMan software' },
      { id: 'cables', label: 'Check all cable connections' },
      { id: 'projectors', label: 'Clean projector lenses' },
      { id: 'computers', label: 'Run system diagnostics' },
      { id: 'network', label: 'Test network connectivity' },
      { id: 'backups', label: 'Verify backup systems' }
    ],
    quarterly: [
      { id: 'calibration', label: 'Calibrate all TrackMan units' },
      { id: 'hardware', label: 'Hardware inspection and cleaning' },
      { id: 'ups', label: 'Test UPS battery systems' },
      { id: 'security', label: 'Review security footage retention' },
      { id: 'licenses', label: 'Verify software licenses' },
      { id: 'documentation', label: 'Update technical documentation' }
    ]
  }
};

// Get checklist template
router.get('/template/:category/:type',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, type } = req.params;
      
      if (!CHECKLIST_TEMPLATES[category as keyof typeof CHECKLIST_TEMPLATES]) {
        throw new AppError('Invalid category', 400, 'INVALID_CATEGORY');
      }
      
      const categoryTemplates = CHECKLIST_TEMPLATES[category as keyof typeof CHECKLIST_TEMPLATES];
      const template = categoryTemplates[type as keyof typeof categoryTemplates];
      
      if (!template) {
        throw new AppError('Invalid checklist type for this category', 400, 'INVALID_TYPE');
      }
      
      // Fetch any customizations for this template
      let customizations = { rows: [] };
      try {
        customizations = await db.query(
          `SELECT task_id, custom_label 
           FROM checklist_task_customizations 
           WHERE category = $1 AND type = $2`,
          [category, type]
        );
      } catch (dbError: any) {
        // Table might not exist yet, log but continue
        logger.warn('Failed to fetch checklist customizations', {
          error: dbError.message,
          code: dbError.code
        });
      }
      
      // Merge customizations with template
      const tasksWithCustomizations = template.map(task => {
        const customization = customizations.rows.find(c => c.task_id === task.id);
        return {
          ...task,
          label: customization ? customization.custom_label : task.label,
          originalLabel: task.label,
          isCustomized: !!customization
        };
      });
      
      res.json({
        success: true,
        data: {
          category,
          type,
          tasks: tasksWithCustomizations
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Submit a completed checklist
router.post('/submit',
  authenticate,
  validate([
    body('category').isIn(['cleaning', 'tech']).withMessage('Invalid category'),
    body('type').isIn(['daily', 'weekly', 'quarterly']).withMessage('Invalid type'),
    body('location').notEmpty().withMessage('Location is required'),
    body('completedTasks').isArray().withMessage('Completed tasks must be an array'),
    body('totalTasks').isInt({ min: 1 }).withMessage('Total tasks must be a positive integer'),
    body('comments').optional().isString().withMessage('Comments must be a string'),
    body('createTicket').optional().isBoolean().withMessage('Create ticket must be a boolean'),
    body('suppliesNeeded').optional().isJSON().withMessage('Supplies must be valid JSON'),
    body('photoUrls').optional().isJSON().withMessage('Photo URLs must be valid JSON')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, type, location, completedTasks, totalTasks, comments, createTicket, suppliesNeeded, photoUrls } = req.body;
      let userId = req.user!.id;

      logger.info('Checklist submission attempt', {
        userId,
        userEmail: req.user!.email,
        category,
        type,
        location,
        completedTasksCount: completedTasks.length,
        totalTasks
      });

      // First, verify the user exists in the database
      const userCheck = await db.query(
        'SELECT id, email, name FROM users WHERE id = $1',
        [userId]
      );
      
      if (userCheck.rows.length === 0) {
        logger.error('User not found in database during submission', {
          userId,
          userEmail: req.user!.email
        });
        
        // Try to find user by email instead
        const userByEmail = await db.query(
          'SELECT id, email, name FROM users WHERE email = $1',
          [req.user!.email]
        );
        
        if (userByEmail.rows.length > 0) {
          logger.info('Found user by email, using correct user ID', {
            tokenUserId: userId,
            dbUserId: userByEmail.rows[0].id,
            email: req.user!.email
          });
          // Use the correct user ID from database
          userId = userByEmail.rows[0].id;
        } else {
          return res.status(400).json({
            success: false,
            error: 'User account not found in database. Please contact support.',
            code: 'USER_NOT_FOUND'
          });
        }
      }

      // Save the submission
      const submission = await db.query(
        `INSERT INTO checklist_submissions 
         (user_id, category, type, location, completed_tasks, total_tasks, comments, ticket_created, supplies_needed, photo_urls)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [userId, category, type, location, JSON.stringify(completedTasks), totalTasks, comments || null, false, suppliesNeeded || null, photoUrls || null]
      );
      
      // Create ticket if requested (now includes photos or supplies)
      let ticketData = null;
      if (createTicket && (comments || suppliesNeeded || photoUrls)) {
        try {
          // Get user details
          const user = await db.findUserById(userId);
          
          // Determine incomplete tasks
          const categoryTemplates = CHECKLIST_TEMPLATES[category as keyof typeof CHECKLIST_TEMPLATES];
          const templateTasks = categoryTemplates ? categoryTemplates[type as keyof typeof categoryTemplates] : undefined;
          const incompleteTasks = templateTasks?.filter((task: any) => !completedTasks.includes(task.id)) || [];
          
          // Build ticket description
          let ticketDescription = 'Checklist submission report:\n\n';
          
          if (comments) {
            ticketDescription += `Comments: ${comments}\n\n`;
          }
          
          if (suppliesNeeded) {
            ticketDescription += `Supplies needed:\n`;
            const supplies = JSON.parse(suppliesNeeded);
            supplies.forEach((item: any) => {
              ticketDescription += `- ${item.name} (${item.urgency} priority)\n`;
            });
            ticketDescription += '\n';
          }
          
          if (photoUrls) {
            ticketDescription += `Photos attached: ${JSON.parse(photoUrls).length} photo(s)\n\n`;
          }
          
          if (incompleteTasks.length > 0) {
            ticketDescription += `Incomplete tasks:\n${incompleteTasks.map((t: any) => `- ${t.label}`).join('\n')}`;
          }
          
          // Determine priority based on supplies urgency or incomplete tasks
          let priority = 'medium';
          if (suppliesNeeded) {
            const supplies = JSON.parse(suppliesNeeded);
            if (supplies.some((s: any) => s.urgency === 'high')) {
              priority = 'high';
            }
          } else if (incompleteTasks.length > 2) {
            priority = 'high';
          }
          
          // Create ticket
          const ticketResult = await db.query(
            `INSERT INTO tickets 
             (title, description, category, status, priority, location, created_by_id, created_by_name, created_by_email, created_by_phone)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
              `${category.charAt(0).toUpperCase() + category.slice(1)} Checklist - ${type.charAt(0).toUpperCase() + type.slice(1)} - ${location}`,
              ticketDescription,
              category === 'tech' ? 'tech' : 'facilities',
              'open',
              priority,
              location,
              userId,
              user?.name || 'Unknown',
              user?.email || req.user!.email,
              user?.phone || null
            ]
          );
          
          ticketData = ticketResult.rows[0];
          
          // Update submission with ticket ID
          await db.query(
            'UPDATE checklist_submissions SET ticket_created = true, ticket_id = $1 WHERE id = $2',
            [ticketData.id, submission.rows[0].id]
          );
          
          logger.info('Ticket created from checklist', {
            ticketId: ticketData.id,
            submissionId: submission.rows[0].id
          });
        } catch (ticketError) {
          logger.error('Failed to create ticket from checklist', ticketError);
        }
      }

      logger.info('Checklist submitted', {
        userId,
        category,
        type,
        location,
        taskCount: totalTasks
      });

      res.json({
        success: true,
        data: submission.rows[0],
        ticket: ticketData
      });
    } catch (error: any) {
      // Handle foreign key constraint violation
      if (error.code === '23503' && error.constraint === 'checklist_submissions_user_id_fkey') {
        logger.error('User not found in database', {
          userId: req.user!.id,
          userEmail: req.user!.email,
          error: error.message
        });
        
        return res.status(400).json({
          success: false,
          error: 'User account not found. Please log out and log in again.',
          code: 'USER_NOT_FOUND'
        });
      }
      
      logger.error('Failed to submit checklist', {
        error: error.message,
        code: error.code,
        constraint: error.constraint
      });
      
      next(error);
    }
  }
);

// Get checklist submissions with filtering
router.get('/submissions',
  authenticate,
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

      logger.info('Loading checklist submissions', {
        requestedBy: req.user!.email,
        filters: { category, type, location, userId, startDate, endDate, limit, offset }
      });

      // Check if table exists and has any data
      try {
        const tableCheck = await db.query('SELECT COUNT(*) as total FROM checklist_submissions');
        logger.info('Total submissions in database:', { total: tableCheck.rows[0].total });
      } catch (tableError: any) {
        logger.error('Table check failed:', tableError);
        
        // Check if table exists
        const tableExists = await db.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'checklist_submissions'
          )
        `);
        
        if (!tableExists.rows[0].exists) {
          throw new AppError('Checklist submissions table not found. Please contact support.', 500, 'TABLE_NOT_FOUND');
        }
      }

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
      
      // Rebuild the WHERE clause for count query with the same conditions
      let countParamIndex = 0;
      if (category) {
        countQuery += ` AND cs.category = $${++countParamIndex}`;
      }
      if (type) {
        countQuery += ` AND cs.type = $${++countParamIndex}`;
      }
      if (location) {
        countQuery += ` AND cs.location = $${++countParamIndex}`;
      }
      if (userId) {
        countQuery += ` AND cs.user_id = $${++countParamIndex}`;
      }
      if (startDate) {
        countQuery += ` AND cs.completion_time >= $${++countParamIndex}`;
      }
      if (endDate) {
        countQuery += ` AND cs.completion_time <= $${++countParamIndex}`;
      }

      const countResult = await db.query(countQuery, countParams);

      logger.info('Checklist submissions loaded', {
        count: result.rows.length,
        total: countResult.rows[0].total
      });

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      });
    } catch (error: any) {
      logger.error('Failed to load checklist submissions', {
        error: error.message,
        code: error.code,
        detail: error.detail,
        table: error.table,
        requestedBy: req.user?.email
      });
      
      // Provide more specific error messages
      if (error.code === '42P01') { // Table does not exist
        return res.status(500).json({
          success: false,
          error: 'Checklist system is being initialized. Please try again in a moment.',
          code: 'TABLE_INITIALIZING'
        });
      }
      
      if (error.code === '42703') { // Column does not exist
        return res.status(500).json({
          success: false,
          error: 'Database schema update in progress. Please try again shortly.',
          code: 'SCHEMA_UPDATE'
        });
      }
      
      next(error);
    }
  }
);

// Delete a submission
router.delete('/submissions/:id',
  authenticate,
  roleGuard(['admin', 'operator']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      // Check if submission exists and get details for logging
      const existing = await db.query(
        'SELECT * FROM checklist_submissions WHERE id = $1',
        [id]
      );
      
      if (existing.rows.length === 0) {
        throw new AppError('Submission not found', 404, 'NOT_FOUND');
      }
      
      // Delete the submission
      await db.query('DELETE FROM checklist_submissions WHERE id = $1', [id]);
      
      logger.info('Checklist submission deleted', {
        submissionId: id,
        deletedBy: req.user!.email,
        submission: existing.rows[0]
      });
      
      res.json({
        success: true,
        message: 'Submission deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get submission statistics
router.get('/stats',
  authenticate,
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

// Update task label (admin only)
router.put('/template/task',
  authenticate,
  roleGuard(['admin']),
  validate([
    body('category').isIn(['cleaning', 'tech']).withMessage('Invalid category'),
    body('type').isIn(['daily', 'weekly', 'quarterly']).withMessage('Invalid type'),
    body('taskId').notEmpty().withMessage('Task ID is required'),
    body('label').notEmpty().trim().withMessage('Label is required')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, type, taskId, label } = req.body;
      
      // Validate task exists in template
      const categoryTemplates = CHECKLIST_TEMPLATES[category as keyof typeof CHECKLIST_TEMPLATES];
      const template = categoryTemplates?.[type as keyof typeof categoryTemplates];
      const taskExists = template?.some((t: any) => t.id === taskId);
      
      if (!taskExists) {
        throw new AppError('Task not found in template', 404, 'TASK_NOT_FOUND');
      }
      
      // Upsert customization
      await db.query(
        `INSERT INTO checklist_task_customizations 
         (category, type, task_id, custom_label, updated_by) 
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (category, type, task_id) 
         DO UPDATE SET 
           custom_label = $4,
           updated_by = $5,
           updated_at = CURRENT_TIMESTAMP`,
        [category, type, taskId, label, req.user!.id]
      );
      
      logger.info('Checklist task updated', {
        category,
        type,
        taskId,
        label,
        updatedBy: req.user!.email
      });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// Reset task to original label (admin only)
router.delete('/template/task/:category/:type/:taskId',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, type, taskId } = req.params;
      
      // Validate parameters
      if (!['cleaning', 'tech'].includes(category)) {
        throw new AppError('Invalid category', 400);
      }
      if (!['daily', 'weekly', 'quarterly'].includes(type)) {
        throw new AppError('Invalid type', 400);
      }
      
      await db.query(
        `DELETE FROM checklist_task_customizations 
         WHERE category = $1 AND type = $2 AND task_id = $3`,
        [category, type, taskId]
      );
      
      logger.info('Checklist task reset to default', {
        category,
        type,
        taskId,
        resetBy: req.user!.email
      });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;