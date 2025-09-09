import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validation';
import { body, query, param } from 'express-validator';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get checklist template from database (for regular checklist page)
router.get('/template/:category/:type',
  authenticate,
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
      
      // Get tasks for this template with supplies info (fallback for missing columns)
      let tasksResult;
      try {
        tasksResult = await db.query(
          `SELECT id, task_text as label, position, is_required, supplies_needed, supplies_urgency
           FROM checklist_tasks 
           WHERE template_id = $1 
           ORDER BY position`,
          [template.id]
        );
      } catch (error: any) {
        // Fallback if supplies columns don't exist yet
        if (error.code === '42703') { // column does not exist
          logger.debug('Supplies columns not found, using fallback query');
          tasksResult = await db.query(
            `SELECT id, task_text as label, position, is_required
             FROM checklist_tasks 
             WHERE template_id = $1 
             ORDER BY position`,
            [template.id]
          );
        } else {
          throw error;
        }
      }
      
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
        const customization = customizations.rows.find((c: any) => c.task_id === task.id);
        return {
          id: task.id,
          label: customization ? customization.custom_label : task.label,
          originalLabel: task.label,
          isCustomized: !!customization,
          isRequired: task.is_required,
          supplies_needed: task.supplies_needed,
          supplies_urgency: task.supplies_urgency
        };
      });
      
      res.json({
        success: true,
        data: {
          templateId: template.id,
          category: template.category,
          type: template.type,
          location: template.location,
          qr_enabled: template.qr_enabled,
          photo_required: template.photo_required,
          max_duration_minutes: template.max_duration_minutes,
          tasks: tasksWithCustomizations
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get all templates (admin only)
router.get('/templates',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const templatesResult = await db.query(
        `SELECT t.*, 
         COALESCE(json_agg(
           json_build_object(
             'id', tk.id,
             'template_id', tk.template_id,
             'task_text', tk.task_text,
             'position', tk.position,
             'is_required', tk.is_required,
             'supplies_needed', tk.supplies_needed,
             'supplies_urgency', tk.supplies_urgency
           ) ORDER BY tk.position
         ) FILTER (WHERE tk.id IS NOT NULL), '[]') as tasks
         FROM checklist_templates t
         LEFT JOIN checklist_tasks tk ON t.id = tk.template_id
         GROUP BY t.id
         ORDER BY t.category, t.type, t.location NULLS FIRST`
      );
      
      res.json({
        success: true,
        templates: templatesResult.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create new template
router.post('/templates',
  authenticate,
  roleGuard(['admin']),
  validate([
    body('name').notEmpty().withMessage('Name is required'),
    body('category').isIn(['cleaning', 'tech']).withMessage('Invalid category'),
    body('type').isIn(['daily', 'weekly', 'quarterly']).withMessage('Invalid type')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, category, type, location, qr_enabled, photo_required, max_duration_minutes } = req.body;
      
      const result = await db.query(
        `INSERT INTO checklist_templates 
         (name, category, type, location, qr_enabled, photo_required, max_duration_minutes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [name, category, type, location || null, qr_enabled ?? true, photo_required ?? false, 
         max_duration_minutes || null, req.user!.id]
      );
      
      res.json({
        success: true,
        template: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update template
router.put('/templates/:id',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      const values = [id, ...Object.values(updates)];
      
      const result = await db.query(
        `UPDATE checklist_templates 
         SET ${setClause}, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        values
      );
      
      res.json({
        success: true,
        template: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete template
router.delete('/templates/:id',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      // Check if it's a master template
      const checkResult = await db.query(
        'SELECT is_master FROM checklist_templates WHERE id = $1',
        [id]
      );
      
      if (checkResult.rows[0]?.is_master) {
        throw new AppError('Cannot delete master template', 400, 'MASTER_TEMPLATE');
      }
      
      await db.query('DELETE FROM checklist_templates WHERE id = $1', [id]);
      
      res.json({
        success: true,
        message: 'Template deleted'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Clone template
router.post('/templates/:id/clone',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { location } = req.body;
      
      // Get original template
      const templateResult = await db.query(
        'SELECT * FROM checklist_templates WHERE id = $1',
        [id]
      );
      
      if (!templateResult.rows.length) {
        throw new AppError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
      }
      
      const original = templateResult.rows[0];
      
      // Create clone
      const cloneResult = await db.query(
        `INSERT INTO checklist_templates 
         (name, category, type, location, active, parent_template_id, is_master, 
          qr_enabled, photo_required, max_duration_minutes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8, $9, $10)
         RETURNING *`,
        [
          `${original.name} - ${location || 'Copy'}`,
          original.category,
          original.type,
          location || null,
          true,
          id,
          original.qr_enabled,
          original.photo_required,
          original.max_duration_minutes,
          req.user!.id
        ]
      );
      
      const newTemplateId = cloneResult.rows[0].id;
      
      // Clone tasks
      await db.query(
        `INSERT INTO checklist_tasks (template_id, task_text, position, is_required, supplies_needed, supplies_urgency)
         SELECT $1, task_text, position, is_required, supplies_needed, supplies_urgency
         FROM checklist_tasks
         WHERE template_id = $2`,
        [newTemplateId, id]
      );
      
      res.json({
        success: true,
        template: cloneResult.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// Add task to template
router.post('/templates/:id/tasks',
  authenticate,
  roleGuard(['admin']),
  validate([
    body('task_text').notEmpty().withMessage('Task text is required')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { task_text, is_required, supplies_needed, supplies_urgency } = req.body;
      
      // Get next position
      const positionResult = await db.query(
        'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM checklist_tasks WHERE template_id = $1',
        [id]
      );
      
      const result = await db.query(
        `INSERT INTO checklist_tasks 
         (template_id, task_text, position, is_required, supplies_needed, supplies_urgency)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, task_text, positionResult.rows[0].next_position, is_required ?? true, 
         supplies_needed || null, supplies_urgency || null]
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

// Update task
router.put('/tasks/:id',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      const values = [id, ...Object.values(updates)];
      
      const result = await db.query(
        `UPDATE checklist_tasks 
         SET ${setClause}, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        values
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

// Delete task
router.delete('/tasks/:id',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      await db.query('DELETE FROM checklist_tasks WHERE id = $1', [id]);
      
      res.json({
        success: true,
        message: 'Task deleted'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Generate QR code for template
router.post('/templates/:id/qr-code',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { location } = req.body;
      
      // Generate short URL
      const shortCode = uuidv4().substring(0, 8);
      const baseUrl = process.env.FRONTEND_URL || 'https://clubos-frontend.vercel.app';
      const checklistUrl = `${baseUrl}/checklists?template=${id}&location=${location || ''}`;
      
      // Generate QR code
      const qrCode = await QRCode.toDataURL(checklistUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#0B3D3A',
          light: '#FFFFFF'
        }
      });
      
      // Store QR code info
      await db.query(
        `INSERT INTO checklist_qr_codes (template_id, location, qr_code_data, short_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (short_url) DO UPDATE
         SET qr_code_data = $3, updated_at = NOW()`,
        [id, location || null, qrCode, shortCode]
      );
      
      res.json({
        success: true,
        qr_code: qrCode,
        url: checklistUrl
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get performance metrics
router.get('/performance',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { location } = req.query;
      
      let whereClause = '';
      const params: any[] = [];
      
      if (location && location !== 'all') {
        whereClause = 'WHERE s.location = $1';
        params.push(String(location));
      }
      
      const metricsResult = await db.query(
        `SELECT 
          s.location,
          t.name as template_name,
          COUNT(DISTINCT s.id) as total_submissions,
          AVG(s.duration_minutes) as avg_duration,
          ROUND(
            (COUNT(CASE WHEN s.status = 'completed' THEN 1 END)::numeric / 
             NULLIF(COUNT(*), 0)) * 100, 2
          ) as completion_rate,
          ROUND(
            (COUNT(CASE WHEN s.duration_minutes <= t.max_duration_minutes THEN 1 END)::numeric / 
             NULLIF(COUNT(CASE WHEN t.max_duration_minutes IS NOT NULL THEN 1 END), 0)) * 100, 2
          ) as on_time_rate,
          COUNT(DISTINCT sr.id) as supplies_reported,
          COUNT(DISTINCT CASE WHEN s.photo_urls IS NOT NULL AND s.photo_urls != '[]' THEN s.id END) as photos_uploaded
         FROM checklist_submissions s
         JOIN checklist_templates t ON s.template_id = t.id
         LEFT JOIN checklist_supplies_requests sr ON s.id = sr.submission_id
         ${whereClause}
         GROUP BY s.location, t.name
         ORDER BY s.location, t.name`,
        params
      );
      
      res.json({
        success: true,
        metrics: metricsResult.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

// Submit checklist with enhanced features
router.post('/submit',
  authenticate,
  validate([
    body('templateId').isUUID().withMessage('Valid template ID required'),
    body('location').notEmpty().withMessage('Location is required'),
    body('completedTasks').isArray().withMessage('Completed tasks must be an array'),
    body('comments').optional().isString(),
    body('createTicket').optional().isBoolean(),
    body('supplies').optional().isArray(),
    body('photoUrls').optional().isArray()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { templateId, location, completedTasks, comments, createTicket, supplies, photoUrls } = req.body;
      const userId = req.user!.id;
      
      // Get category and type from templateId if provided
      let category = req.body.category;
      let type = req.body.type;
      
      if (templateId) {
        try {
          const templateInfo = await db.query(
            'SELECT category, type FROM checklist_templates WHERE id = $1',
            [templateId]
          );
          if (templateInfo.rows.length > 0) {
            category = templateInfo.rows[0].category;
            type = templateInfo.rows[0].type;
          }
        } catch (error) {
          // Templates table doesn't exist yet, use provided values
          logger.debug('Templates table not found, using provided category/type');
        }
      }
      
      // Create submission with basic fields that exist in current schema
      const submissionResult = await db.query(
        `INSERT INTO checklist_submissions 
         (user_id, location, category, type, total_tasks, completed_tasks, 
          comments, completion_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING id`,
        [userId, location, category, type, completedTasks.length, 
         JSON.stringify(completedTasks), comments]
      );
      
      const submissionId = submissionResult.rows[0].id;
      
      // Handle supplies requests (only if table exists)
      if (supplies && supplies.length > 0) {
        try {
          for (const supply of supplies) {
            await db.query(
              `INSERT INTO checklist_supplies_requests 
               (submission_id, task_id, supplies_description, urgency, requested_by)
               VALUES ($1, $2, $3, $4, $5)`,
              [submissionId, supply.taskId || null, supply.name, supply.urgency || 'medium', userId]
            );
          }
        } catch (error: any) {
          if (error.code !== '42P01') { // table does not exist
            throw error;
          }
          logger.debug('Supplies table not found, skipping supplies tracking');
        }
      }
      
      // Create ticket if requested
      let ticketId = null;
      if (createTicket && comments) {
        const ticketResult = await db.query(
          `INSERT INTO tickets 
           (title, description, category, priority, location, user_id, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'open')
           RETURNING id`,
          [`Checklist Issue - ${location}`, comments, 'facilities', 'normal', location, userId]
        );
        ticketId = ticketResult.rows[0].id;
        
        // Update submission with ticket ID
        await db.query(
          'UPDATE checklist_submissions SET ticket_created = true, ticket_id = $1 WHERE id = $2',
          [ticketId, submissionId]
        );
      }
      
      // Update performance tracking (only if table exists)
      if (templateId) {
        try {
          await db.query(
            `INSERT INTO checklist_performance 
             (user_id, location, template_id, week_start, completions_count, 
              supplies_reported_count, photos_uploaded_count)
             VALUES ($1, $2, $3, date_trunc('week', NOW()), 1, $4, $5)
             ON CONFLICT (user_id, location, template_id, week_start)
             DO UPDATE SET 
               completions_count = checklist_performance.completions_count + 1,
               supplies_reported_count = checklist_performance.supplies_reported_count + $4,
               photos_uploaded_count = checklist_performance.photos_uploaded_count + $5,
               updated_at = NOW()`,
            [userId, location, templateId, supplies?.length || 0, photoUrls?.length || 0]
          );
        } catch (error: any) {
          if (error.code !== '42P01') { // table does not exist
            throw error;
          }
          logger.debug('Performance table not found, skipping performance tracking');
        }
      }
      
      res.json({
        success: true,
        message: 'Checklist submitted successfully',
        submissionId,
        ticketId
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get submissions with enhanced data
router.get('/submissions',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { location, period } = req.query;
      const userId = req.user!.id;
      const isAdmin = req.user!.role === 'admin';
      
      let whereConditions = [];
      let params: any[] = [];
      let paramCount = 1;
      
      // Filter by user unless admin
      if (!isAdmin) {
        whereConditions.push(`s.user_id = $${paramCount}`);
        params.push(userId);
        paramCount++;
      }
      
      // Filter by location
      if (location && location !== 'all') {
        whereConditions.push(`s.location = $${paramCount}`);
        params.push(String(location));
        paramCount++;
      }
      
      // Filter by period
      if (period === 'week') {
        whereConditions.push(`s.completion_time >= NOW() - INTERVAL '1 week'`);
      } else if (period === 'month') {
        whereConditions.push(`s.completion_time >= NOW() - INTERVAL '1 month'`);
      }
      
      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';
      
      // Try enhanced query first, fallback to basic if tables don't exist
      let result;
      try {
        result = await db.query(
          `SELECT 
            s.*,
            u.name as user_name,
            u.email as user_email,
            t.name as template_name,
            COALESCE(
              (SELECT COUNT(*) FROM checklist_supplies_requests WHERE submission_id = s.id),
              0
            ) as supplies_count,
            CASE 
              WHEN s.photo_urls IS NOT NULL AND s.photo_urls != '[]' 
              THEN jsonb_array_length(s.photo_urls::jsonb)
              ELSE 0
            END as photo_count
           FROM checklist_submissions s
           JOIN users u ON s.user_id = u.id
           LEFT JOIN checklist_templates t ON s.template_id = t.id
           ${whereClause}
           ORDER BY s.completion_time DESC
           LIMIT 100`,
          params
        );
      } catch (error: any) {
        // Fallback for missing tables/columns
        if (error.code === '42P01' || error.code === '42703') {
          logger.debug('Enhanced tables not found, using fallback query');
          result = await db.query(
            `SELECT 
              s.*,
              u.name as user_name,
              u.email as user_email
             FROM checklist_submissions s
             JOIN users u ON s.user_id = u.id
             ${whereClause}
             ORDER BY s.completion_time DESC
             LIMIT 100`,
            params
          );
        } else {
          throw error;
        }
      }
      
      res.json({
        success: true,
        submissions: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get completion stats
router.get('/stats',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { location } = req.query;
      const userId = req.user!.id;
      const isAdmin = req.user!.role === 'admin';
      
      let whereCondition = isAdmin ? '' : 'WHERE s.user_id = $1';
      let params = isAdmin ? [] : [userId];
      
      if (location && location !== 'all') {
        if (whereCondition) {
          whereCondition += ` AND s.location = $${params.length + 1}`;
        } else {
          whereCondition = `WHERE s.location = $1`;
        }
        params.push(String(location));
      }
      
      // Try enhanced query with templates table, fallback if it doesn't exist
      let statsResult;
      try {
        statsResult = await db.query(
          `SELECT 
            COUNT(CASE WHEN s.completion_time >= NOW() - INTERVAL '1 day' THEN 1 END) as daily_completed,
            COUNT(CASE WHEN s.completion_time >= NOW() - INTERVAL '1 week' THEN 1 END) as weekly_completed,
            COUNT(CASE WHEN s.completion_time >= NOW() - INTERVAL '1 month' THEN 1 END) as monthly_completed,
            (SELECT COUNT(DISTINCT id) FROM checklist_templates WHERE active = true) as daily_total,
            (SELECT COUNT(DISTINCT id) FROM checklist_templates WHERE active = true) * 7 as weekly_total,
            (SELECT COUNT(DISTINCT id) FROM checklist_templates WHERE active = true) * 30 as monthly_total
           FROM checklist_submissions s
           ${whereCondition}`,
          params
        );
      } catch (error: any) {
        // Fallback if templates table doesn't exist
        logger.debug('Templates table not found, using hardcoded totals');
        statsResult = await db.query(
          `SELECT 
            COUNT(CASE WHEN s.completion_time >= NOW() - INTERVAL '1 day' THEN 1 END) as daily_completed,
            COUNT(CASE WHEN s.completion_time >= NOW() - INTERVAL '1 week' THEN 1 END) as weekly_completed,
            COUNT(CASE WHEN s.completion_time >= NOW() - INTERVAL '1 month' THEN 1 END) as monthly_completed,
            5 as daily_total,
            35 as weekly_total,
            150 as monthly_total
           FROM checklist_submissions s
           ${whereCondition}`,
          params
        );
      }
      
      // Get top performer
      const topPerformerResult = await db.query(
        `SELECT u.name, COUNT(*) as count
         FROM checklist_submissions s
         JOIN users u ON s.user_id = u.id
         WHERE s.completion_time >= NOW() - INTERVAL '1 month'
         GROUP BY u.name
         ORDER BY count DESC
         LIMIT 1`
      );
      
      const stats = statsResult.rows[0];
      const topPerformer = topPerformerResult.rows[0];
      
      res.json({
        success: true,
        stats: {
          daily: {
            completed: parseInt(stats.daily_completed) || 0,
            total: parseInt(stats.daily_total) || 0
          },
          weekly: {
            completed: parseInt(stats.weekly_completed) || 0,
            total: parseInt(stats.weekly_total) || 0
          },
          monthly: {
            completed: parseInt(stats.monthly_completed) || 0,
            total: parseInt(stats.monthly_total) || 0
          },
          topPerformer: topPerformer || null
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Export templates
router.get('/templates/export',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const templatesResult = await db.query(
        `SELECT t.*, 
         COALESCE(json_agg(
           json_build_object(
             'task_text', tk.task_text,
             'position', tk.position,
             'is_required', tk.is_required,
             'supplies_needed', tk.supplies_needed,
             'supplies_urgency', tk.supplies_urgency
           ) ORDER BY tk.position
         ) FILTER (WHERE tk.id IS NOT NULL), '[]') as tasks
         FROM checklist_templates t
         LEFT JOIN checklist_tasks tk ON t.id = tk.template_id
         GROUP BY t.id
         ORDER BY t.category, t.type, t.location NULLS FIRST`
      );
      
      res.json({
        success: true,
        templates: templatesResult.rows,
        exportDate: new Date(),
        version: '2.0'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;