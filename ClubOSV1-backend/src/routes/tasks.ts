import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

const router = Router();

// GET /api/tasks - Get all tasks for the authenticated operator
router.get('/', authenticate, async (req, res) => {
  try {
    const tasks = await db.getTasks(req.user!.id);
    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    logger.error('Failed to get tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tasks'
    });
  }
});

// POST /api/tasks - Create a new task
router.post('/', authenticate, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Task text is required'
      });
    }

    const task = await db.createTask({
      operator_id: req.user!.id,
      text: text.trim()
    });

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    logger.error('Failed to create task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create task'
    });
  }
});

// PATCH /api/tasks/:id - Update task completion status
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_completed } = req.body;

    if (typeof is_completed !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'is_completed must be a boolean'
      });
    }

    await db.updateTask(id, req.user!.id, { is_completed });

    res.json({
      success: true
    });
  } catch (error) {
    logger.error('Failed to update task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update task'
    });
  }
});

// DELETE /api/tasks/:id - Delete a task
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    await db.deleteTask(id, req.user!.id);

    res.json({
      success: true
    });
  } catch (error) {
    logger.error('Failed to delete task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete task'
    });
  }
});

export default router;