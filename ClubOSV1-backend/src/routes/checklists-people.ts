import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validation';
import { body, query, param } from 'express-validator';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Helper to get current ISO week start (Monday)
const getWeekStart = (date: Date = new Date()): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getWeekEnd = (weekStart: Date): Date => {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
};

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// ===== PERSON MANAGEMENT =====

// Get all persons
router.get('/persons',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { active } = req.query;

      let query_str = `SELECT * FROM checklist_persons`;
      const params: any[] = [];

      if (active === 'true') {
        query_str += ` WHERE active = true`;
      } else if (active === 'false') {
        query_str += ` WHERE active = false`;
      }

      query_str += ` ORDER BY name`;

      const result = await db.query(query_str, params);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }
);

// Get single person with their tasks
router.get('/persons/:id',
  authenticate,
  validate([
    param('id').isUUID().withMessage('Invalid person ID')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const personResult = await db.query(
        `SELECT * FROM checklist_persons WHERE id = $1`,
        [id]
      );

      if (!personResult.rows.length) {
        throw new AppError('Person not found', 404, 'PERSON_NOT_FOUND');
      }

      const tasksResult = await db.query(
        `SELECT * FROM checklist_person_tasks
         WHERE person_id = $1 AND active = true
         ORDER BY day_of_week, position`,
        [id]
      );

      res.json({
        success: true,
        data: {
          ...personResult.rows[0],
          tasks: tasksResult.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create person (admin only)
router.post('/persons',
  authenticate,
  roleGuard(['admin']),
  validate([
    body('name').notEmpty().withMessage('Name is required'),
    body('description').optional().isString(),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Invalid color format')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description, color } = req.body;
      const userId = req.user?.id;

      const result = await db.query(
        `INSERT INTO checklist_persons (name, description, color, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, description || null, color || '#0B3D3A', userId]
      );

      logger.info(`Person created: ${name} by user ${userId}`);

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      if (error.code === '23505') { // unique violation
        next(new AppError('A person with this name already exists', 400, 'DUPLICATE_NAME'));
      } else {
        next(error);
      }
    }
  }
);

// Update person (admin only)
router.put('/persons/:id',
  authenticate,
  roleGuard(['admin']),
  validate([
    param('id').isUUID().withMessage('Invalid person ID'),
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('description').optional().isString(),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Invalid color format'),
    body('active').optional().isBoolean()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, description, color, active } = req.body;

      // Build dynamic update
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(name);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(description);
      }
      if (color !== undefined) {
        updates.push(`color = $${paramCount++}`);
        values.push(color);
      }
      if (active !== undefined) {
        updates.push(`active = $${paramCount++}`);
        values.push(active);
      }

      if (updates.length === 0) {
        throw new AppError('No fields to update', 400, 'NO_UPDATES');
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const result = await db.query(
        `UPDATE checklist_persons SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      if (!result.rows.length) {
        throw new AppError('Person not found', 404, 'PERSON_NOT_FOUND');
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// Delete/deactivate person (admin only)
router.delete('/persons/:id',
  authenticate,
  roleGuard(['admin']),
  validate([
    param('id').isUUID().withMessage('Invalid person ID')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Soft delete - set active = false
      const result = await db.query(
        `UPDATE checklist_persons SET active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id]
      );

      if (!result.rows.length) {
        throw new AppError('Person not found', 404, 'PERSON_NOT_FOUND');
      }

      res.json({ success: true, message: 'Person deactivated' });
    } catch (error) {
      next(error);
    }
  }
);

// ===== TASK MANAGEMENT =====

// Get tasks for a person
router.get('/persons/:personId/tasks',
  authenticate,
  validate([
    param('personId').isUUID().withMessage('Invalid person ID')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { personId } = req.params;
      const { day } = req.query;

      let query_str = `SELECT * FROM checklist_person_tasks WHERE person_id = $1 AND active = true`;
      const params: any[] = [personId];

      if (day) {
        query_str += ` AND day_of_week = $2`;
        params.push(day);
      }

      query_str += ` ORDER BY day_of_week, position`;

      const result = await db.query(query_str, params);

      // Group by day
      const grouped: Record<string, any[]> = {};
      for (const task of result.rows) {
        if (!grouped[task.day_of_week]) {
          grouped[task.day_of_week] = [];
        }
        grouped[task.day_of_week].push(task);
      }

      res.json({ success: true, data: result.rows, grouped });
    } catch (error) {
      next(error);
    }
  }
);

// Add task to person (admin only)
router.post('/persons/:personId/tasks',
  authenticate,
  roleGuard(['admin']),
  validate([
    param('personId').isUUID().withMessage('Invalid person ID'),
    body('task_text').notEmpty().withMessage('Task text is required'),
    body('day_of_week').isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']).withMessage('Invalid day of week'),
    body('position').optional().isInt({ min: 0 }),
    body('is_required').optional().isBoolean()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { personId } = req.params;
      const { task_text, day_of_week, position, is_required } = req.body;

      // Verify person exists
      const personCheck = await db.query(`SELECT id FROM checklist_persons WHERE id = $1`, [personId]);
      if (!personCheck.rows.length) {
        throw new AppError('Person not found', 404, 'PERSON_NOT_FOUND');
      }

      // Get max position for this day if not provided
      let taskPosition = position;
      if (taskPosition === undefined) {
        const maxPosResult = await db.query(
          `SELECT COALESCE(MAX(position), -1) + 1 as next_position
           FROM checklist_person_tasks
           WHERE person_id = $1 AND day_of_week = $2`,
          [personId, day_of_week]
        );
        taskPosition = maxPosResult.rows[0].next_position;
      }

      const result = await db.query(
        `INSERT INTO checklist_person_tasks (person_id, task_text, day_of_week, position, is_required)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [personId, task_text, day_of_week, taskPosition, is_required ?? true]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// Update task (admin only)
router.put('/tasks/:taskId',
  authenticate,
  roleGuard(['admin']),
  validate([
    param('taskId').isUUID().withMessage('Invalid task ID'),
    body('task_text').optional().notEmpty(),
    body('day_of_week').optional().isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
    body('position').optional().isInt({ min: 0 }),
    body('is_required').optional().isBoolean(),
    body('active').optional().isBoolean()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { taskId } = req.params;
      const { task_text, day_of_week, position, is_required, active } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (task_text !== undefined) {
        updates.push(`task_text = $${paramCount++}`);
        values.push(task_text);
      }
      if (day_of_week !== undefined) {
        updates.push(`day_of_week = $${paramCount++}`);
        values.push(day_of_week);
      }
      if (position !== undefined) {
        updates.push(`position = $${paramCount++}`);
        values.push(position);
      }
      if (is_required !== undefined) {
        updates.push(`is_required = $${paramCount++}`);
        values.push(is_required);
      }
      if (active !== undefined) {
        updates.push(`active = $${paramCount++}`);
        values.push(active);
      }

      if (updates.length === 0) {
        throw new AppError('No fields to update', 400, 'NO_UPDATES');
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(taskId);

      const result = await db.query(
        `UPDATE checklist_person_tasks SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      if (!result.rows.length) {
        throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// Delete task (admin only)
router.delete('/tasks/:taskId',
  authenticate,
  roleGuard(['admin']),
  validate([
    param('taskId').isUUID().withMessage('Invalid task ID')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { taskId } = req.params;

      // Soft delete
      const result = await db.query(
        `UPDATE checklist_person_tasks SET active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [taskId]
      );

      if (!result.rows.length) {
        throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
      }

      res.json({ success: true, message: 'Task deleted' });
    } catch (error) {
      next(error);
    }
  }
);

// ===== WEEKLY SUBMISSION =====

// Get current week's tasks and completions for a person
router.get('/weekly/:personId',
  authenticate,
  validate([
    param('personId').isUUID().withMessage('Invalid person ID')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { personId } = req.params;

      // Verify person exists
      const personResult = await db.query(`SELECT * FROM checklist_persons WHERE id = $1`, [personId]);
      if (!personResult.rows.length) {
        throw new AppError('Person not found', 404, 'PERSON_NOT_FOUND');
      }

      const weekStart = getWeekStart();
      const weekEnd = getWeekEnd(weekStart);

      // Get or create weekly submission
      let submissionResult = await db.query(
        `SELECT * FROM checklist_person_weekly_submissions
         WHERE person_id = $1 AND week_start = $2`,
        [personId, formatDate(weekStart)]
      );

      let submission = submissionResult.rows[0];

      // Get tasks for this person
      const tasksResult = await db.query(
        `SELECT * FROM checklist_person_tasks
         WHERE person_id = $1 AND active = true
         ORDER BY
           CASE day_of_week
             WHEN 'monday' THEN 1
             WHEN 'tuesday' THEN 2
             WHEN 'wednesday' THEN 3
             WHEN 'thursday' THEN 4
             WHEN 'friday' THEN 5
             WHEN 'saturday' THEN 6
             WHEN 'sunday' THEN 7
           END,
           position`,
        [personId]
      );

      // Get completions if submission exists
      let completions: Record<string, any> = {};
      if (submission) {
        const completionsResult = await db.query(
          `SELECT * FROM checklist_person_task_completions WHERE submission_id = $1`,
          [submission.id]
        );
        for (const c of completionsResult.rows) {
          completions[c.task_id] = c;
        }
      }

      // Group tasks by day with completion status
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const dayLabels: Record<string, string> = {
        monday: 'Monday',
        tuesday: 'Tuesday',
        wednesday: 'Wednesday',
        thursday: 'Thursday',
        friday: 'Friday',
        saturday: 'Saturday',
        sunday: 'Sunday'
      };

      const tasksByDay = days.map(day => {
        const dayTasks = tasksResult.rows.filter(t => t.day_of_week === day);
        return {
          dayOfWeek: day,
          dayLabel: dayLabels[day],
          tasks: dayTasks.map(t => ({
            ...t,
            isCompleted: !!completions[t.id],
            completedAt: completions[t.id]?.completed_at || null
          })),
          completedCount: dayTasks.filter(t => !!completions[t.id]).length,
          totalCount: dayTasks.length
        };
      }).filter(d => d.totalCount > 0); // Only include days with tasks

      // Calculate totals
      const totalTasks = tasksResult.rows.length;
      const completedTasks = Object.keys(completions).length;

      res.json({
        success: true,
        data: {
          person: personResult.rows[0],
          weekStart: formatDate(weekStart),
          weekEnd: formatDate(weekEnd),
          submission,
          tasksByDay,
          totalTasks,
          completedTasks,
          progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Start/resume weekly submission
router.post('/weekly/:personId/start',
  authenticate,
  validate([
    param('personId').isUUID().withMessage('Invalid person ID')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { personId } = req.params;
      const userId = req.user?.id;

      const weekStart = getWeekStart();
      const weekEnd = getWeekEnd(weekStart);

      // Check if submission already exists
      let result = await db.query(
        `SELECT * FROM checklist_person_weekly_submissions
         WHERE person_id = $1 AND week_start = $2`,
        [personId, formatDate(weekStart)]
      );

      if (result.rows.length) {
        // Already exists, return it
        res.json({ success: true, data: result.rows[0], resumed: true });
        return;
      }

      // Create new submission
      result = await db.query(
        `INSERT INTO checklist_person_weekly_submissions
         (person_id, week_start, week_end, user_id, status, started_at)
         VALUES ($1, $2, $3, $4, 'in_progress', CURRENT_TIMESTAMP)
         RETURNING *`,
        [personId, formatDate(weekStart), formatDate(weekEnd), userId]
      );

      logger.info(`Weekly submission started for person ${personId} by user ${userId}`);

      res.status(201).json({ success: true, data: result.rows[0], resumed: false });
    } catch (error) {
      next(error);
    }
  }
);

// Mark task complete
router.post('/weekly/:personId/task/:taskId/complete',
  authenticate,
  validate([
    param('personId').isUUID().withMessage('Invalid person ID'),
    param('taskId').isUUID().withMessage('Invalid task ID'),
    body('notes').optional().isString()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { personId, taskId } = req.params;
      const { notes } = req.body;
      const userId = req.user?.id;

      const weekStart = getWeekStart();

      // Get or create submission
      let submissionResult = await db.query(
        `SELECT * FROM checklist_person_weekly_submissions
         WHERE person_id = $1 AND week_start = $2`,
        [personId, formatDate(weekStart)]
      );

      let submission = submissionResult.rows[0];

      if (!submission) {
        // Auto-create submission
        submissionResult = await db.query(
          `INSERT INTO checklist_person_weekly_submissions
           (person_id, week_start, week_end, user_id, status, started_at)
           VALUES ($1, $2, $3, $4, 'in_progress', CURRENT_TIMESTAMP)
           RETURNING *`,
          [personId, formatDate(weekStart), formatDate(getWeekEnd(weekStart)), userId]
        );
        submission = submissionResult.rows[0];
      }

      // Mark task complete
      const result = await db.query(
        `INSERT INTO checklist_person_task_completions
         (submission_id, task_id, completed_by, notes)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (submission_id, task_id) DO UPDATE SET
           completed_at = CURRENT_TIMESTAMP,
           completed_by = $3,
           notes = $4
         RETURNING *`,
        [submission.id, taskId, userId, notes || null]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// Unmark task (delete completion)
router.delete('/weekly/:personId/task/:taskId/complete',
  authenticate,
  validate([
    param('personId').isUUID().withMessage('Invalid person ID'),
    param('taskId').isUUID().withMessage('Invalid task ID')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { personId, taskId } = req.params;

      const weekStart = getWeekStart();

      // Get submission
      const submissionResult = await db.query(
        `SELECT * FROM checklist_person_weekly_submissions
         WHERE person_id = $1 AND week_start = $2`,
        [personId, formatDate(weekStart)]
      );

      if (!submissionResult.rows.length) {
        throw new AppError('No active submission found', 404, 'SUBMISSION_NOT_FOUND');
      }

      const submission = submissionResult.rows[0];

      // Delete completion
      await db.query(
        `DELETE FROM checklist_person_task_completions
         WHERE submission_id = $1 AND task_id = $2`,
        [submission.id, taskId]
      );

      res.json({ success: true, message: 'Task unmarked' });
    } catch (error) {
      next(error);
    }
  }
);

// Submit the week
router.post('/weekly/:personId/submit',
  authenticate,
  validate([
    param('personId').isUUID().withMessage('Invalid person ID'),
    body('comments').optional().isString()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { personId } = req.params;
      const { comments } = req.body;

      const weekStart = getWeekStart();

      // Get submission
      const submissionResult = await db.query(
        `SELECT * FROM checklist_person_weekly_submissions
         WHERE person_id = $1 AND week_start = $2`,
        [personId, formatDate(weekStart)]
      );

      if (!submissionResult.rows.length) {
        throw new AppError('No active submission found', 404, 'SUBMISSION_NOT_FOUND');
      }

      const submission = submissionResult.rows[0];

      if (submission.status === 'completed') {
        throw new AppError('Week already submitted', 400, 'ALREADY_SUBMITTED');
      }

      // Update submission
      const result = await db.query(
        `UPDATE checklist_person_weekly_submissions
         SET status = 'completed', submitted_at = CURRENT_TIMESTAMP, comments = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [comments || submission.comments, submission.id]
      );

      logger.info(`Weekly submission completed for person ${personId}`);

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// ===== HISTORY/TRACKER =====

// Get all submissions (admin can see all, others see their own)
router.get('/submissions',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { personId, status, limit = 50, offset = 0 } = req.query;
      const isAdmin = req.user?.role === 'admin';
      const userId = req.user?.id;

      let query_str = `
        SELECT
          s.*,
          p.name as person_name,
          p.color as person_color,
          u.name as submitted_by_name,
          (SELECT COUNT(*) FROM checklist_person_task_completions WHERE submission_id = s.id) as completed_count,
          (SELECT COUNT(*) FROM checklist_person_tasks WHERE person_id = s.person_id AND active = true) as total_tasks
        FROM checklist_person_weekly_submissions s
        JOIN checklist_persons p ON s.person_id = p.id
        LEFT JOIN users u ON s.user_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramCount = 1;

      if (personId) {
        query_str += ` AND s.person_id = $${paramCount++}`;
        params.push(personId);
      }

      if (status) {
        query_str += ` AND s.status = $${paramCount++}`;
        params.push(status);
      }

      // Non-admins can only see their own submissions
      if (!isAdmin) {
        query_str += ` AND s.user_id = $${paramCount++}`;
        params.push(userId);
      }

      query_str += ` ORDER BY s.week_start DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
      params.push(limit, offset);

      const result = await db.query(query_str, params);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }
);

// Get submission details
router.get('/submissions/:id',
  authenticate,
  validate([
    param('id').isUUID().withMessage('Invalid submission ID')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const submissionResult = await db.query(
        `SELECT
          s.*,
          p.name as person_name,
          p.color as person_color,
          u.name as submitted_by_name
        FROM checklist_person_weekly_submissions s
        JOIN checklist_persons p ON s.person_id = p.id
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.id = $1`,
        [id]
      );

      if (!submissionResult.rows.length) {
        throw new AppError('Submission not found', 404, 'SUBMISSION_NOT_FOUND');
      }

      const submission = submissionResult.rows[0];

      // Get completions with task details
      const completionsResult = await db.query(
        `SELECT
          c.*,
          t.task_text,
          t.day_of_week,
          t.position,
          u.name as completed_by_name
        FROM checklist_person_task_completions c
        JOIN checklist_person_tasks t ON c.task_id = t.id
        LEFT JOIN users u ON c.completed_by = u.id
        WHERE c.submission_id = $1
        ORDER BY t.day_of_week, t.position`,
        [id]
      );

      res.json({
        success: true,
        data: {
          ...submission,
          completions: completionsResult.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
