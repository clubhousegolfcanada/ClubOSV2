import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validation';
import { body, query, param } from 'express-validator';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { contractorService } from '../services/contractorService';

const router = Router();

// Get checklist template from database
router.get('/template/:category/:type',
  authenticate,
  roleGuard(['admin', 'operator', 'support', 'contractor']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, type } = req.params;
      const { location } = req.query;
      
      // First try to get location-specific template
      let templateResult;
      if (location) {
        templateResult = await db.query(
          `SELECT * FROM checklist_templates 
           WHERE category = $1 AND type = $2 AND location = $3 AND active = true
           LIMIT 1`,
          [category, type, location]
        );
      }
      
      // Fall back to global template if no location-specific one exists
      if (!templateResult?.rows.length) {
        templateResult = await db.query(
          `SELECT * FROM checklist_templates 
           WHERE category = $1 AND type = $2 AND location IS NULL AND active = true
           LIMIT 1`,
          [category, type]
        );
      }
      
      if (!templateResult.rows.length) {
        throw new AppError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
      }
      
      const template = templateResult.rows[0];
      
      // Get tasks for this template
      const tasksResult = await db.query(
        `SELECT id, task_text as label, position, is_required
         FROM checklist_tasks 
         WHERE template_id = $1 
         ORDER BY position`,
        [template.id]
      );
      
      // Check for any task customizations
      let customizations = { rows: [] };
      try {
        customizations = await db.query(
          `SELECT task_id, custom_label 
           FROM checklist_task_customizations 
           WHERE category = $1 AND type = $2`,
          [category, type]
        );
      } catch (dbError: any) {
        logger.debug('No customizations table or no customizations found');
      }
      
      // Merge customizations with tasks
      const tasksWithCustomizations = tasksResult.rows.map(task => {
        const customization = customizations.rows.find(c => c.task_id === task.id);
        return {
          id: task.id,
          label: customization ? customization.custom_label : task.label,
          originalLabel: task.label,
          isCustomized: !!customization,
          isRequired: task.is_required
        };
      });
      
      res.json({
        success: true,
        data: {
          templateId: template.id,
          category: template.category,
          type: template.type,
          location: template.location,
          tasks: tasksWithCustomizations
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Unlock door for checklist
router.post('/unlock-door',
  authenticate,
  validate([
    body('location').notEmpty().withMessage('Location is required')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { location } = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      
      // Check permissions for contractors
      if (userRole === 'contractor') {
        const canUnlock = await contractorService.canUnlockDoor(userId, location);
        if (!canUnlock) {
          throw new AppError('No permission to unlock doors at this location', 403, 'DOOR_UNLOCK_DENIED');
        }
        // Log the door unlock for auditing
        await contractorService.logDoorUnlock(userId, location, `${location}-door`);
      } else if (!['admin', 'operator', 'support'].includes(userRole)) {
        throw new AppError('Insufficient permissions to unlock door', 403, 'INSUFFICIENT_PERMISSIONS');
      }
      
      // Map location to door configuration
      const doorMap: Record<string, { location: string; doorKey: string }> = {
        'Bedford': { location: 'bedford', doorKey: 'front' },
        'Dartmouth': { location: 'dartmouth', doorKey: 'office' },
        // Add more mappings as needed
      };
      
      const doorConfig = doorMap[location];
      if (!doorConfig) {
        throw new AppError('No door configured for this location', 400, 'NO_DOOR_CONFIG');
      }
      
      // Make request to UniFi door service
      const fetch = (await import('node-fetch')).default;
      const doorResponse = await fetch(
        `http://localhost:${process.env.PORT || 5005}/api/unifi-doors/doors/${doorConfig.location}/${doorConfig.doorKey}/unlock`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.authorization || ''
          },
          body: JSON.stringify({ duration: 30 })
        }
      );
      
      const doorResult = await doorResponse.json();
      
      if (!doorResult.success) {
        throw new AppError('Failed to unlock door', 500, 'DOOR_UNLOCK_FAILED');
      }
      
      logger.info('Door unlocked for checklist', {
        userId,
        location,
        doorConfig
      });
      
      res.json({
        success: true,
        message: 'Door unlocked',
        unlockTime: new Date()
      });
    } catch (error) {
      next(error);
    }
  }
);

// Start a checklist session with door unlock
router.post('/start',
  authenticate,
  roleGuard(['admin', 'operator', 'support', 'contractor']),
  validate([
    body('templateId').isUUID().withMessage('Valid template ID required'),
    body('location').notEmpty().withMessage('Location is required'),
    body('doorUnlockedAt').optional().isISO8601()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { templateId, location, doorUnlockedAt } = req.body;
      const userId = req.user!.id;
      
      // Check if user has access to this location
      if (req.user!.role === 'contractor') {
        // Check contractor permissions for this location
        const canSubmit = await contractorService.canSubmitChecklist(userId, location);
        if (!canSubmit) {
          throw new AppError('No permission to submit checklists at this location', 403, 'CHECKLIST_SUBMIT_DENIED');
        }
      } else {
        const userResult = await db.query(
          'SELECT allowed_locations FROM users WHERE id = $1',
          [userId]
        );
        
        const user = userResult.rows[0];
        if (user.allowed_locations && !user.allowed_locations.includes(location) && req.user!.role !== 'admin') {
          throw new AppError('Access denied for this location', 403, 'LOCATION_ACCESS_DENIED');
        }
      }
      
      // Create submission record
      const submission = await db.query(
        `INSERT INTO checklist_submissions 
         (template_id, user_id, location, door_unlocked_at, started_at, status, category, type, total_tasks)
         VALUES ($1, $2, $3, $4, NOW(), 'in_progress', 
                (SELECT category FROM checklist_templates WHERE id = $1),
                (SELECT type FROM checklist_templates WHERE id = $1),
                (SELECT COUNT(*) FROM checklist_tasks WHERE template_id = $1))
         RETURNING *`,
        [templateId, userId, location, doorUnlockedAt]
      );
      
      // Log door unlock if provided
      if (doorUnlockedAt) {
        await db.query(
          `INSERT INTO checklist_door_unlocks 
           (user_id, location, checklist_submission_id, unlocked_at)
           VALUES ($1, $2, $3, $4)`,
          [userId, location, submission.rows[0].id, doorUnlockedAt]
        );
      }
      
      logger.info('Checklist started', {
        submissionId: submission.rows[0].id,
        userId,
        location,
        templateId
      });
      
      res.json({
        success: true,
        id: submission.rows[0].id,
        startedAt: submission.rows[0].started_at
      });
    } catch (error) {
      next(error);
    }
  }
);

// Complete a checklist session
router.patch('/complete/:id',
  authenticate,
  roleGuard(['admin', 'operator', 'support', 'contractor']),
  validate([
    param('id').isUUID(),
    body('completedTasks').isArray(),
    body('comments').optional().isString(),
    body('supplies').optional(),
    body('photos').optional()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { completedTasks, comments, supplies, photos } = req.body;
      const userId = req.user!.id;
      
      // Update submission
      const result = await db.query(
        `UPDATE checklist_submissions 
         SET completed_at = NOW(),
             completed_tasks = $2,
             comments = $3,
             supplies_needed = $4,
             photo_urls = $5,
             status = 'completed',
             completion_time = NOW()
         WHERE id = $1 AND user_id = $6 AND status = 'in_progress'
         RETURNING *, duration_minutes`,
        [id, JSON.stringify(completedTasks), comments, supplies, photos, userId]
      );
      
      if (!result.rows.length) {
        throw new AppError('Submission not found or already completed', 404, 'SUBMISSION_NOT_FOUND');
      }
      
      const submission = result.rows[0];
      
      // Create ticket if needed
      if (comments || supplies) {
        try {
          const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
          
          const ticketResult = await db.query(
            `INSERT INTO tickets 
             (title, description, category, status, priority, location, 
              created_by_id, created_by_name, created_by_email)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id`,
            [
              `Checklist - ${submission.category} ${submission.type} - ${submission.location}`,
              `Comments: ${comments || 'None'}\nSupplies: ${supplies || 'None'}`,
              submission.category === 'tech' ? 'tech' : 'facilities',
              'open',
              supplies ? 'high' : 'medium',
              submission.location,
              userId,
              user.rows[0].name || 'Unknown',
              user.rows[0].email
            ]
          );
          
          await db.query(
            'UPDATE checklist_submissions SET ticket_created = true, ticket_id = $1 WHERE id = $2',
            [ticketResult.rows[0].id, id]
          );
        } catch (ticketError) {
          logger.error('Failed to create ticket from checklist', ticketError);
        }
      }
      
      logger.info('Checklist completed', {
        submissionId: id,
        duration: submission.duration_minutes,
        location: submission.location
      });
      
      res.json({
        success: true,
        duration: submission.duration_minutes
      });
    } catch (error) {
      next(error);
    }
  }
);

// Submit checklist (backward compatibility - combines start and complete)
router.post('/submit',
  authenticate,
  roleGuard(['admin', 'operator', 'support', 'contractor']),
  validate([
    body('category').isIn(['cleaning', 'tech']),
    body('type').isIn(['daily', 'weekly', 'quarterly']),
    body('location').notEmpty(),
    body('completedTasks').isArray(),
    body('totalTasks').isInt({ min: 1 })
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, type, location, completedTasks, totalTasks, comments, createTicket, supplies_needed, photo_urls } = req.body;
      const userId = req.user!.id;
      
      // Get template ID for backward compatibility
      const templateResult = await db.query(
        `SELECT id FROM checklist_templates 
         WHERE category = $1 AND type = $2 
         AND (location = $3 OR location IS NULL)
         ORDER BY location DESC NULLS LAST
         LIMIT 1`,
        [category, type, location]
      );
      
      const templateId = templateResult.rows[0]?.id;
      
      // Create submission
      const submission = await db.query(
        `INSERT INTO checklist_submissions 
         (template_id, user_id, category, type, location, completed_tasks, 
          total_tasks, comments, ticket_created, supplies_needed, photo_urls,
          started_at, completed_at, completion_time, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), NOW(), 'completed')
         RETURNING *`,
        [templateId, userId, category, type, location, JSON.stringify(completedTasks), 
         totalTasks, comments, false, supplies_needed, photo_urls]
      );
      
      // Create ticket if requested
      let ticketData = null;
      if (createTicket && comments) {
        const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
        
        const ticketResult = await db.query(
          `INSERT INTO tickets 
           (title, description, category, status, priority, location, 
            created_by_id, created_by_name, created_by_email)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            `${category} Checklist - ${type} - ${location}`,
            comments,
            category === 'tech' ? 'tech' : 'facilities',
            'open',
            'medium',
            location,
            userId,
            user.rows[0].name || 'Unknown',
            user.rows[0].email
          ]
        );
        
        ticketData = ticketResult.rows[0];
        
        await db.query(
          'UPDATE checklist_submissions SET ticket_created = true, ticket_id = $1 WHERE id = $2',
          [ticketData.id, submission.rows[0].id]
        );
      }
      
      res.json({
        success: true,
        data: submission.rows[0],
        ticket: ticketData
      });
    } catch (error) {
      next(error);
    }
  }
);

// Admin: Create or clone template
router.post('/templates',
  authenticate,
  roleGuard(['admin']),
  validate([
    body('name').notEmpty(),
    body('category').isIn(['cleaning', 'tech']),
    body('type').isIn(['daily', 'weekly', 'quarterly']),
    body('location').optional(),
    body('cloneFromId').optional().isUUID()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, category, type, location, cloneFromId } = req.body;
      const userId = req.user!.id;
      
      // Create template
      const templateResult = await db.query(
        `INSERT INTO checklist_templates 
         (name, category, type, location, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, category, type, location, userId]
      );
      
      const newTemplate = templateResult.rows[0];
      
      // If cloning, copy tasks from source template
      if (cloneFromId) {
        await db.query(
          `INSERT INTO checklist_tasks (template_id, task_text, position, is_required)
           SELECT $1, task_text, position, is_required
           FROM checklist_tasks
           WHERE template_id = $2`,
          [newTemplate.id, cloneFromId]
        );
      }
      
      res.json({
        success: true,
        template: newTemplate
      });
    } catch (error) {
      next(error);
    }
  }
);

// Admin: Add task to template
router.post('/templates/:templateId/tasks',
  authenticate,
  roleGuard(['admin']),
  validate([
    param('templateId').isUUID(),
    body('taskText').notEmpty(),
    body('position').optional().isInt()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { templateId } = req.params;
      const { taskText, position } = req.body;
      
      // Get next position if not provided
      let taskPosition = position;
      if (!taskPosition) {
        const maxPosResult = await db.query(
          'SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM checklist_tasks WHERE template_id = $1',
          [templateId]
        );
        taskPosition = maxPosResult.rows[0].next_pos;
      }
      
      const result = await db.query(
        `INSERT INTO checklist_tasks (template_id, task_text, position)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [templateId, taskText, taskPosition]
      );
      
      res.json({
        success: true,
        task: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// Keep existing endpoints for submissions, stats, etc.
router.get('/submissions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  // Same implementation as before, just include template_id in results
  try {
    const { category, type, location, userId, startDate, endDate, limit = 50, offset = 0 } = req.query;
    
    let queryStr = `
      SELECT 
        cs.*,
        u.name as user_name,
        u.email as user_email,
        ct.name as template_name
      FROM checklist_submissions cs
      JOIN users u ON cs.user_id = u.id
      LEFT JOIN checklist_templates ct ON cs.template_id = ct.id
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
    
    queryStr += ` ORDER BY cs.completion_time DESC`;
    queryStr += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);
    
    const result = await db.query(queryStr, params);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

export default router;