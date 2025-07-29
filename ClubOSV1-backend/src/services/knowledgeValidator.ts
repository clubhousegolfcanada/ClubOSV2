import { OpenAI } from 'openai';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import fs from 'fs/promises';
import path from 'path';

interface ValidationResult {
  id: string;
  title: string;
  status: 'valid' | 'duplicate' | 'outdated' | 'irrelevant' | 'needs_update';
  reason?: string;
  suggestedAction?: string;
  duplicateOf?: string;
  confidence: number;
}

export class KnowledgeValidatorService {
  private openai: OpenAI | null = null;
  
  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }
  
  /**
   * Export all knowledge for review
   */
  async exportForValidation(outputPath: string): Promise<void> {
    logger.info('Exporting knowledge base for validation...');
    
    try {
      // Get all documents grouped by assistant
      const result = await db.query(`
        SELECT assistant, 
               json_agg(json_build_object(
                 'id', id,
                 'title', title,
                 'content', content,
                 'created_at', created_at,
                 'metadata', metadata
               ) ORDER BY created_at DESC) as documents
        FROM sop_embeddings
        GROUP BY assistant
      `);
      
      const exportData: {
        exportDate: string;
        totalDocuments: number;
        byAssistant: Record<string, any[]>;
      } = {
        exportDate: new Date().toISOString(),
        totalDocuments: 0,
        byAssistant: {}
      };
      
      for (const row of result.rows) {
        const documents = row.documents as any[];
        exportData.byAssistant[row.assistant] = documents;
        exportData.totalDocuments += documents.length;
      }
      
      // Write to file
      await fs.writeFile(
        outputPath,
        JSON.stringify(exportData, null, 2),
        'utf-8'
      );
      
      logger.info(`Exported ${exportData.totalDocuments} documents to ${outputPath}`);
      
      // Also create a markdown report for easier review
      const reportPath = outputPath.replace('.json', '-report.md');
      await this.generateMarkdownReport(exportData, reportPath);
      
    } catch (error) {
      logger.error('Export failed:', error);
      throw error;
    }
  }
  
  /**
   * Generate a human-readable markdown report
   */
  private async generateMarkdownReport(data: any, outputPath: string): Promise<void> {
    let report = `# Knowledge Base Export Report\n\n`;
    report += `**Export Date:** ${data.exportDate}\n`;
    report += `**Total Documents:** ${data.totalDocuments}\n\n`;
    
    for (const [assistant, docs] of Object.entries(data.byAssistant)) {
      const documents = docs as any[];
      report += `## ${assistant.toUpperCase()} Assistant (${documents.length} documents)\n\n`;
      
      for (const doc of documents) {
        report += `### ${doc.title}\n`;
        report += `**ID:** ${doc.id}\n`;
        report += `**Created:** ${doc.created_at}\n\n`;
        report += `${doc.content.substring(0, 500)}${doc.content.length > 500 ? '...' : ''}\n\n`;
        report += `---\n\n`;
      }
    }
    
    await fs.writeFile(outputPath, report, 'utf-8');
    logger.info(`Generated markdown report at ${outputPath}`);
  }
  
  /**
   * Validate knowledge using GPT-4o
   */
  async validateWithAI(limit: number = 10): Promise<ValidationResult[]> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }
    
    logger.info('Starting AI validation of knowledge base...');
    
    // Get sample of documents to validate
    const result = await db.query(`
      SELECT id, assistant, title, content, metadata
      FROM sop_embeddings
      ORDER BY RANDOM()
      LIMIT $1
    `, [limit]);
    
    const validationResults: ValidationResult[] = [];
    
    for (const doc of result.rows) {
      try {
        const validation = await this.validateSingleDocument(doc);
        validationResults.push(validation);
        
        // Log issues
        if (validation.status !== 'valid') {
          logger.warn(`Validation issue found:`, {
            id: doc.id,
            title: doc.title,
            status: validation.status,
            reason: validation.reason
          });
        }
        
      } catch (error) {
        logger.error(`Failed to validate document ${doc.id}:`, error);
      }
    }
    
    return validationResults;
  }
  
  /**
   * Validate a single document
   */
  private async validateSingleDocument(doc: any): Promise<ValidationResult> {
    const prompt = `Analyze this knowledge base entry for quality and relevance:

Title: ${doc.title}
Category: ${doc.assistant}
Content: ${doc.content}

Evaluate for:
1. Is this content relevant and useful for a golf simulator business?
2. Is it duplicate information that exists elsewhere?
3. Is the information current and accurate?
4. Is it in the correct category (brand/tech/booking/emergency)?
5. Could it be improved or clarified?

Return a JSON object:
{
  "status": "valid|duplicate|outdated|irrelevant|needs_update",
  "reason": "explanation of the status",
  "suggestedAction": "what should be done",
  "confidence": 0.0-1.0
}`;

    const response = await this.openai!.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a knowledge base quality analyst for a golf simulator business.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });
    
    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      id: doc.id,
      title: doc.title,
      status: analysis.status || 'valid',
      reason: analysis.reason,
      suggestedAction: analysis.suggestedAction,
      confidence: analysis.confidence || 0.5
    };
  }
  
  /**
   * Find duplicate content
   */
  async findDuplicates(): Promise<any[]> {
    logger.info('Searching for duplicate content...');
    
    const result = await db.query(`
      WITH content_similarity AS (
        SELECT 
          a.id as id1,
          a.title as title1,
          b.id as id2,
          b.title as title2,
          similarity(a.content, b.content) as content_sim,
          similarity(a.title, b.title) as title_sim
        FROM sop_embeddings a
        CROSS JOIN sop_embeddings b
        WHERE a.id < b.id
          AND (
            similarity(a.content, b.content) > 0.8
            OR similarity(a.title, b.title) > 0.9
          )
      )
      SELECT * FROM content_similarity
      ORDER BY content_sim DESC, title_sim DESC
    `);
    
    return result.rows;
  }
  
  /**
   * Clean up duplicates and invalid entries
   */
  async cleanup(validationResults: ValidationResult[]): Promise<void> {
    logger.info('Starting cleanup based on validation results...');
    
    let deleted = 0;
    let updated = 0;
    
    for (const result of validationResults) {
      try {
        if (result.status === 'duplicate' || result.status === 'irrelevant') {
          // Delete the entry
          await db.query('DELETE FROM sop_embeddings WHERE id = $1', [result.id]);
          deleted++;
          logger.info(`Deleted ${result.status} entry: ${result.title}`);
          
        } else if (result.status === 'needs_update' && result.suggestedAction) {
          // Log for manual review
          logger.info(`Needs update: ${result.title} - ${result.suggestedAction}`);
          updated++;
        }
      } catch (error) {
        logger.error(`Failed to cleanup ${result.id}:`, error);
      }
    }
    
    logger.info(`Cleanup complete: ${deleted} deleted, ${updated} marked for update`);
  }
  
  /**
   * Generate a validation report
   */
  async generateValidationReport(): Promise<any> {
    const stats = await db.query(`
      SELECT 
        assistant,
        COUNT(*) as total,
        COUNT(DISTINCT title) as unique_titles,
        AVG(LENGTH(content)) as avg_content_length,
        MIN(created_at) as oldest,
        MAX(created_at) as newest
      FROM sop_embeddings
      GROUP BY assistant
    `);
    
    const duplicates = await this.findDuplicates();
    
    return {
      timestamp: new Date().toISOString(),
      statistics: stats.rows,
      duplicateCount: duplicates.length,
      topDuplicates: duplicates.slice(0, 10),
      recommendations: [
        duplicates.length > 10 ? 'High number of duplicates detected - consider deduplication' : null,
        'Review content in each category for relevance',
        'Consider consolidating similar entries'
      ].filter(Boolean)
    };
  }
}

export const knowledgeValidator = new KnowledgeValidatorService();