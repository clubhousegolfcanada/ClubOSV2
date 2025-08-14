import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

const router = Router();

// GET /api/prompts - Get all prompt templates
router.get('/', authenticate, roleGuard(['admin', 'operator']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prompts = await db.query(`
      SELECT 
        id,
        name,
        category,
        prompt_text,
        description,
        is_active,
        variables,
        created_at,
        updated_at
      FROM prompt_templates
      WHERE is_active = true
      ORDER BY category, name
    `);
    
    res.json({
      success: true,
      data: prompts.rows
    });
  } catch (error) {
    logger.error('Error fetching prompts:', error);
    next(error);
  }
});

// POST /api/prompts - Create new prompt
router.post('/', authenticate, roleGuard(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, category, prompt_text, description, variables } = req.body;
    
    const result = await db.query(`
      INSERT INTO prompt_templates (
        name, category, prompt_text, description, variables, is_active, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, true, NOW(), NOW()
      ) RETURNING *
    `, [name, category, prompt_text, description, variables || []]);
    
    logger.info('Prompt created:', { 
      promptId: result.rows[0].id, 
      createdBy: req.user?.id 
    });
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error creating prompt:', error);
    next(error);
  }
});

// PUT /api/prompts/:id - Update prompt
router.put('/:id', authenticate, roleGuard(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, category, prompt_text, description, variables, is_active } = req.body;
    
    const result = await db.query(`
      UPDATE prompt_templates
      SET 
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        prompt_text = COALESCE($3, prompt_text),
        description = COALESCE($4, description),
        variables = COALESCE($5, variables),
        is_active = COALESCE($6, is_active),
        updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `, [name, category, prompt_text, description, variables, is_active, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Prompt not found'
      });
    }
    
    logger.info('Prompt updated:', { 
      promptId: id, 
      updatedBy: req.user?.id 
    });
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error updating prompt:', error);
    next(error);
  }
});

// DELETE /api/prompts/:id - Delete prompt
router.delete('/:id', authenticate, roleGuard(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Soft delete by setting is_active to false
    const result = await db.query(`
      UPDATE prompt_templates
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Prompt not found'
      });
    }
    
    logger.info('Prompt deleted:', { 
      promptId: id, 
      deletedBy: req.user?.id 
    });
    
    res.json({
      success: true,
      message: 'Prompt deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting prompt:', error);
    next(error);
  }
});

export default router;