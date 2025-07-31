import { db } from '../utils/database';
import { logger } from '../utils/logger';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  category: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

class PromptTemplateService {
  /**
   * Get a template by name
   */
  async getTemplate(name: string): Promise<PromptTemplate | null> {
    try {
      const result = await db.query(
        'SELECT * FROM ai_prompt_templates WHERE name = $1 AND is_active = true',
        [name]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get prompt template:', error);
      return null;
    }
  }

  /**
   * Get all templates by category
   */
  async getTemplatesByCategory(category: string): Promise<PromptTemplate[]> {
    try {
      const result = await db.query(
        'SELECT * FROM ai_prompt_templates WHERE category = $1 AND is_active = true ORDER BY name',
        [category]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Failed to get templates by category:', error);
      return [];
    }
  }

  /**
   * Update a template
   */
  async updateTemplate(
    id: string, 
    template: string, 
    userId: string,
    reason?: string
  ): Promise<boolean> {
    const client = await db.getPool().connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current template for history
      const current = await client.query(
        'SELECT template FROM ai_prompt_templates WHERE id = $1',
        [id]
      );
      
      if (current.rows.length === 0) {
        throw new Error('Template not found');
      }
      
      // Update template
      await client.query(
        'UPDATE ai_prompt_templates SET template = $1, updated_by = $2, updated_at = NOW() WHERE id = $3',
        [template, userId, id]
      );
      
      // Record history
      await client.query(
        `INSERT INTO ai_prompt_template_history 
         (template_id, old_template, new_template, changed_by, change_reason) 
         VALUES ($1, $2, $3, $4, $5)`,
        [id, current.rows[0].template, template, userId, reason || 'Manual update']
      );
      
      await client.query('COMMIT');
      
      logger.info('Prompt template updated', { 
        templateId: id, 
        userId,
        reason 
      });
      
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update template:', error);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Get template history
   */
  async getTemplateHistory(templateId: string, limit: number = 10): Promise<any[]> {
    try {
      const result = await db.query(
        `SELECT 
          h.*,
          u.name as changed_by_name,
          u.email as changed_by_email
         FROM ai_prompt_template_history h
         LEFT JOIN users u ON h.changed_by = u.id
         WHERE h.template_id = $1
         ORDER BY h.changed_at DESC
         LIMIT $2`,
        [templateId, limit]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Failed to get template history:', error);
      return [];
    }
  }

  /**
   * Apply template with variables
   */
  applyTemplate(template: string, variables: Record<string, string>): string {
    let result = template;
    
    // Replace all variables in the template
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, value || '');
    }
    
    return result;
  }
}

export const promptTemplateService = new PromptTemplateService();