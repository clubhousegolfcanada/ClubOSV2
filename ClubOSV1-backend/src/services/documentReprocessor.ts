import { OpenAI } from 'openai';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

export class DocumentReprocessorService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!
    });
  }

  /**
   * Reprocess all documents with better titles and metadata
   */
  async reprocessAllDocuments(): Promise<any> {
    logger.info('Starting document reprocessing...');
    
    // Get all documents
    const result = await db.query(`
      SELECT id, assistant, title, content, metadata
      FROM sop_embeddings
      ORDER BY created_at ASC
    `);
    
    const stats = {
      total: result.rows.length,
      processed: 0,
      improved: 0,
      errors: 0
    };
    
    for (const doc of result.rows) {
      try {
        const improved = await this.improveDocument(doc);
        if (improved) {
          stats.improved++;
        }
        stats.processed++;
        
        if (stats.processed % 10 === 0) {
          logger.info(`Reprocessing progress: ${stats.processed}/${stats.total}`);
        }
      } catch (error) {
        logger.error(`Error reprocessing document ${doc.id}:`, error);
        stats.errors++;
      }
    }
    
    return stats;
  }

  /**
   * Improve a single document's title and metadata
   */
  private async improveDocument(doc: any): Promise<boolean> {
    // Skip if already has a good title
    if (doc.title.includes(' - ') && doc.title.length > 30) {
      return false;
    }
    
    const prompt = `Analyze this document and create a HIGHLY SEARCHABLE title and metadata.

Current Title: ${doc.title}
Content: ${doc.content}

Create an improved title that:
1. Includes ALL key terms, names, codes, and topics
2. Is 50-100 characters long
3. Front-loads the most important search terms
4. Uses " - " to separate major concepts

Examples of GOOD titles:
- "Clubhouse Brand Colors - Purple #503285 and Grey #7B7B7B - Official Hex Codes"
- "7-iron Competitor Profile - Nick Wang Owner - Trackman Golf Simulator Facility"
- "Trackman Reset Procedure - Hold Green Power Button 8 Seconds - Troubleshooting"
- "Power Outage Emergency Response - Update Skedda Bookings - Contact Utilities"

Also extract all searchable terms and metadata.

Return JSON:
{
  "improvedTitle": "New descriptive title with all key terms",
  "searchTerms": ["all", "searchable", "words", "names", "codes"],
  "entities": {
    "people": ["Nick Wang", "etc"],
    "companies": ["7-iron", "Better Golf", "etc"],
    "products": ["Trackman", "Skedda", "etc"]
  },
  "metadata": {
    "hasColorCodes": true/false,
    "colorCodes": ["#503285", "#7B7B7B"],
    "hasProcedures": true/false,
    "procedureTypes": ["reset", "troubleshooting", "emergency"],
    "documentType": "brand-guide|competitor-info|procedure|policy"
  }
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating searchable document titles and metadata.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      if (result.improvedTitle && result.improvedTitle !== doc.title) {
        // Update the document
        const existingMetadata = typeof doc.metadata === 'string' ? 
          JSON.parse(doc.metadata) : doc.metadata || {};
        
        const newMetadata = {
          ...existingMetadata,
          ...result.metadata,
          searchTerms: result.searchTerms,
          entities: result.entities,
          originalTitle: doc.title,
          reprocessedAt: new Date().toISOString()
        };
        
        await db.query(`
          UPDATE sop_embeddings
          SET title = $1,
              metadata = $2
          WHERE id = $3
        `, [result.improvedTitle, JSON.stringify(newMetadata), doc.id]);
        
        logger.info(`Improved document title: "${doc.title}" → "${result.improvedTitle}"`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Failed to improve document ${doc.id}:`, error);
      throw error;
    }
  }

  /**
   * Fix color palette documents specifically
   */
  async fixColorDocuments(): Promise<void> {
    logger.info('Fixing color palette documents...');
    
    // Find documents that might be about colors
    const result = await db.query(`
      SELECT id, title, content, assistant
      FROM sop_embeddings
      WHERE assistant = 'brand'
      AND (
        LOWER(title) LIKE '%color%' 
        OR LOWER(title) LIKE '%palette%'
        OR LOWER(title) LIKE '%brand%'
        OR LOWER(content) LIKE '%#503285%'
        OR LOWER(content) LIKE '%purple%'
        OR LOWER(content) LIKE '%grey%'
      )
    `);
    
    logger.info(`Found ${result.rows.length} potential color documents to fix`);
    
    for (const doc of result.rows) {
      // Check if content has wrong colors
      if (doc.content.includes('#ABC123') || doc.content.includes('Green')) {
        logger.warn(`Document "${doc.title}" has incorrect color data!`);
        
        // You might want to update with correct data
        const correctColorData = {
          primary_colors: {
            purple: "#503285",
            grey: "#7B7B7B"
          },
          usage: "Clubhouse brand colors for all marketing materials"
        };
        
        // For now, just log what needs to be fixed
        logger.info(`Needs update: ${doc.id} - ${doc.title}`);
      }
    }
  }
}

export const documentReprocessor = new DocumentReprocessorService();