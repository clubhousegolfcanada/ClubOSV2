import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validation';
import { body, param } from 'express-validator';
import { promptTemplateService } from '../services/promptTemplateService';
import { logger } from '../utils/logger';

const router = Router();

// Get all prompt templates (admin only)
router.get('/',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next) => {
    try {
      const { category } = req.query;
      
      const templates = category 
        ? await promptTemplateService.getTemplatesByCategory(category as string)
        : await promptTemplateService.getTemplatesByCategory('customer_message');
      
      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      logger.error('Failed to get prompt templates:', error);
      next(error);
    }
  }
);

// Get specific template by name
router.get('/:name',
  authenticate,
  roleGuard(['admin']),
  validate([
    param('name').isString().notEmpty()
  ]),
  async (req: Request, res: Response, next) => {
    try {
      const template = await promptTemplateService.getTemplate(req.params.name);
      
      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }
      
      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      logger.error('Failed to get prompt template:', error);
      next(error);
    }
  }
);

// Update template
router.put('/:id',
  authenticate,
  roleGuard(['admin']),
  validate([
    param('id').isUUID(),
    body('template').isString().notEmpty().withMessage('Template content is required'),
    body('reason').optional().isString()
  ]),
  async (req: Request, res: Response, next) => {
    try {
      const { template, reason } = req.body;
      
      const success = await promptTemplateService.updateTemplate(
        req.params.id,
        template,
        req.user!.id,
        reason
      );
      
      if (!success) {
        return res.status(400).json({
          success: false,
          error: 'Failed to update template'
        });
      }
      
      logger.info('Prompt template updated', {
        templateId: req.params.id,
        userId: req.user!.id,
        reason
      });
      
      res.json({
        success: true,
        message: 'Template updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update prompt template:', error);
      next(error);
    }
  }
);

// Get template history
router.get('/:id/history',
  authenticate,
  roleGuard(['admin']),
  validate([
    param('id').isUUID()
  ]),
  async (req: Request, res: Response, next) => {
    try {
      const history = await promptTemplateService.getTemplateHistory(
        req.params.id,
        20 // Last 20 changes
      );
      
      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('Failed to get template history:', error);
      next(error);
    }
  }
);

export default router;