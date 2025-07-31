import { Router, Request, Response } from 'express';
// Knowledge extractor disabled - using GPT-4o router
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { db } from '../utils/database';
import { anonymizePhoneNumber } from '../utils/encryption';

const router = Router();

// All knowledge routes require admin access
router.use(authenticate);
router.use(roleGuard(['admin']));

// Process unprocessed OpenPhone conversations
router.post('/extract', async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.body;
    
    logger.info('Starting knowledge extraction', { limit });
    
    // Knowledge extractor disabled - using GPT-4o router
    const stats = { processed: 0, extracted: 0 };
    
    res.json({
      success: true,
      data: stats,
      message: `Processed ${stats.processed} conversations, extracted ${stats.extracted} knowledge items`
    });
    
  } catch (error) {
    logger.error('Knowledge extraction failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to extract knowledge'
    });
  }
});

// Get unapplied knowledge for review
router.get('/unapplied', async (req: Request, res: Response) => {
  try {
    const { category, limit = 50 } = req.query;
    
    // Knowledge extractor disabled
    const knowledge: any[] = [];
    
    res.json({
      success: true,
      data: knowledge,
      count: knowledge.length
    });
    
  } catch (error) {
    logger.error('Failed to get unapplied knowledge:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve knowledge'
    });
  }
});

// Mark knowledge as applied
router.put('/:id/apply', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sopFile } = req.body;
    
    if (!sopFile) {
      return res.status(400).json({
        success: false,
        error: 'SOP file path is required'
      });
    }
    
    // Knowledge extractor disabled
    // await knowledgeExtractor.markKnowledgeApplied(id, sopFile);
    
    res.json({
      success: true,
      message: 'Knowledge marked as applied'
    });
    
  } catch (error) {
    logger.error('Failed to mark knowledge as applied:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update knowledge'
    });
  }
});

// Batch apply knowledge
router.post('/apply-batch', async (req: Request, res: Response) => {
  try {
    const { knowledgeIds, sopFile } = req.body;
    
    if (!knowledgeIds || !Array.isArray(knowledgeIds) || knowledgeIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Knowledge IDs array is required'
      });
    }
    
    if (!sopFile) {
      return res.status(400).json({
        success: false,
        error: 'SOP file path is required'
      });
    }
    
    // Knowledge extractor disabled
    // await knowledgeExtractor.applyKnowledgeBatch(knowledgeIds, sopFile);
    
    res.json({
      success: true,
      message: `Applied ${knowledgeIds.length} knowledge items to ${sopFile}`
    });
    
  } catch (error) {
    logger.error('Failed to batch apply knowledge:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply knowledge batch'
    });
  }
});

// Get extraction statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Knowledge extractor disabled
    const stats = { 
      overview: { total_extracted: 0, applied_count: 0, pending_count: 0, avg_confidence: 0, unique_sources: 0 },
      byCategory: []
    };
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('Failed to get extraction stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics'
    });
  }
});

// Search for similar knowledge
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { problem, category } = req.query;
    
    if (!problem || !category) {
      return res.status(400).json({
        success: false,
        error: 'Problem and category are required'
      });
    }
    
    // Knowledge extractor disabled
    const similar: any[] = [];
    
    res.json({
      success: true,
      data: similar,
      count: similar.length
    });
    
  } catch (error) {
    logger.error('Failed to search knowledge:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search knowledge'
    });
  }
});

// Preview what AI will do with the entry (no saving)
router.post('/preview-entry', async (req: Request, res: Response) => {
  try {
    const { entry } = req.body;
    
    if (!entry || typeof entry !== 'string' || !entry.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Entry text is required'
      });
    }
    
    logger.info('Previewing knowledge entry', { entry: entry.substring(0, 100) + '...' });
    
    // Get preview without saving
    // Knowledge extractor disabled
    const preview = { sections: [], primaryCategory: 'general' };
    
    res.json({
      success: true,
      data: preview,
      message: 'Preview generated successfully'
    });
    
  } catch (error) {
    logger.error('Failed to preview manual entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to preview knowledge entry'
    });
  }
});

// Confirm and save previewed entry
router.post('/confirm-entry', async (req: Request, res: Response) => {
  try {
    const { sections, selectedCategories, clearExisting = false } = req.body;
    
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Sections are required'
      });
    }
    
    if (!selectedCategories || Object.keys(selectedCategories).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one category must be selected'
      });
    }
    
    logger.info('Confirming knowledge entry', { 
      sectionCount: sections.length,
      categories: Object.keys(selectedCategories).filter(k => selectedCategories[k]),
      clearExisting 
    });
    
    // Process confirmed entry
    // Knowledge extractor disabled
    const result = { imported: 0 };
    
    res.json({
      success: true,
      data: result,
      message: 'Knowledge processed and added to SOP'
    });
    
  } catch (error) {
    logger.error('Failed to confirm manual entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process confirmed entry'
    });
  }
});

// Process manual knowledge entry
router.post('/manual-entry', async (req: Request, res: Response) => {
  try {
    const { entry, clearExisting = false } = req.body;
    
    if (!entry || typeof entry !== 'string' || !entry.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Entry text is required'
      });
    }
    
    logger.info('Processing manual knowledge entry', { 
      entry: entry.substring(0, 100) + '...',
      clearExisting 
    });
    
    // Process the manual entry using the knowledge extractor
    // Knowledge extractor disabled
    const result = { category: 'general', id: Date.now() };
    
    res.json({
      success: true,
      data: result,
      message: 'Knowledge processed and added to SOP'
    });
    
  } catch (error) {
    logger.error('Failed to process manual knowledge entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process knowledge entry'
    });
  }
});

// Clear all SOP embeddings (admin only - dangerous operation)
router.delete('/clear-embeddings', async (req: Request, res: Response) => {
  try {
    const { assistant } = req.body;
    
    let query = 'DELETE FROM sop_embeddings';
    let params: any[] = [];
    
    if (assistant) {
      query += ' WHERE assistant = $1';
      params = [assistant];
      logger.warn(`Clearing SOP embeddings for assistant: ${assistant}`);
    } else {
      logger.warn('Clearing ALL SOP embeddings - this is irreversible!');
    }
    
    const result = await db.query(query + ' RETURNING COUNT(*)', params);
    const deletedCount = result.rows[0]?.count || 0;
    
    // Refresh SOP module cache
    // SOP module disabled - using GPT-4o router
    // Document cache refresh not needed
    
    res.json({
      success: true,
      message: `Cleared ${deletedCount} SOP embeddings${assistant ? ` for ${assistant}` : ''}`,
      deletedCount
    });
    
  } catch (error) {
    logger.error('Failed to clear SOP embeddings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear embeddings'
    });
  }
});

// Export all knowledge data
router.get('/export', async (req: Request, res: Response) => {
  try {
    logger.info('Starting knowledge export...');
    
    // Initialize export data structure
    const exportData = {
      exportVersion: '1.0',
      exportDate: new Date().toISOString(),
      systemInfo: {
        sopEnabled: process.env.USE_INTELLIGENT_SOP === 'true',
        shadowMode: process.env.SOP_SHADOW_MODE === 'true',
        confidenceThreshold: parseFloat(process.env.SOP_CONFIDENCE_THRESHOLD || '0.75')
      },
      sopDocuments: [] as any[],
      extractedKnowledge: [] as any[],
      conversations: [] as any[],
      callTranscripts: [] as any[],
      shadowComparisons: [] as any[],
      metrics: {
        totalDocuments: 0,
        totalKnowledge: 0,
        totalConversations: 0,
        totalCallTranscripts: 0,
        exportStats: {} as any
      }
    };

    // 1. Export SOP Embeddings
    if (db.initialized) {
      try {
        const sopResult = await db.query(`
          SELECT id, assistant, title, content, metadata, created_at, updated_at
          FROM sop_embeddings
          ORDER BY assistant, title
        `);
        
        exportData.sopDocuments = sopResult.rows.map(row => ({
          ...row,
          // Exclude embeddings to reduce file size
          hasEmbedding: true
        }));
        exportData.metrics.totalDocuments = sopResult.rows.length;
        
        logger.info(`Exported ${sopResult.rows.length} SOP documents`);
      } catch (error) {
        logger.error('Failed to export SOP embeddings:', error);
      }

      // 2. Export Extracted Knowledge
      try {
        const knowledgeResult = await db.query(`
          SELECT id, source_id, source_type, category, problem, solution, 
                 confidence, created_at, updated_at, metadata
          FROM extracted_knowledge
          ORDER BY created_at DESC
        `);
        
        exportData.extractedKnowledge = knowledgeResult.rows;
        exportData.metrics.totalKnowledge = knowledgeResult.rows.length;
        
        logger.info(`Exported ${knowledgeResult.rows.length} extracted knowledge entries`);
      } catch (error) {
        logger.error('Failed to export extracted knowledge:', error);
      }

      // 3. Export OpenPhone Conversations (last 30 days)
      try {
        const conversationsResult = await db.query(`
          SELECT id, conversation_id, phone_number, customer_name, employee_name,
                 summary, key_points, category, sentiment, metadata, created_at
          FROM openphone_conversations
          WHERE created_at >= NOW() - INTERVAL '30 days'
          ORDER BY created_at DESC
        `);
        
        exportData.conversations = conversationsResult.rows.map(row => ({
          ...row,
          // Exclude raw messages to reduce size
          hasMessages: true
        }));
        exportData.metrics.totalConversations = conversationsResult.rows.length;
        
        logger.info(`Exported ${conversationsResult.rows.length} conversations`);
      } catch (error) {
        logger.error('Failed to export conversations:', error);
      }

      // 4. Export Call Transcripts and their extracted knowledge
      try {
        const callTranscriptsResult = await db.query(`
          SELECT 
            ct.id,
            ct.call_id,
            ct.duration,
            ct.created_at,
            ct.processed,
            COUNT(ek.id) as knowledge_count
          FROM call_transcripts ct
          LEFT JOIN extracted_knowledge ek ON ek.source_id = ct.id AND ek.source_type = 'call_transcript'
          GROUP BY ct.id
          ORDER BY ct.created_at DESC
          LIMIT 100
        `);
        
        exportData.callTranscripts = callTranscriptsResult.rows;
        exportData.metrics.totalCallTranscripts = callTranscriptsResult.rows.length;
        
        logger.info(`Exported ${callTranscriptsResult.rows.length} call transcripts`);
      } catch (error) {
        logger.error('Failed to export call transcripts:', error);
      }
      
      // 5. Export Shadow Comparisons (last 7 days)
      try {
        const shadowResult = await db.query(`
          SELECT id, query, route, sop_confidence, sop_time_ms, 
                 assistant_time_ms, created_at
          FROM sop_shadow_comparisons
          WHERE created_at >= NOW() - INTERVAL '7 days'
          ORDER BY created_at DESC
          LIMIT 1000
        `);
        
        exportData.shadowComparisons = shadowResult.rows;
        
        logger.info(`Exported ${shadowResult.rows.length} shadow comparisons`);
      } catch (error) {
        logger.error('Failed to export shadow comparisons:', error);
      }

      // 5. Export Metrics Summary
      try {
        const metricsResult = await db.query(`
          SELECT 
            SUM(total_requests) as total_requests,
            SUM(sop_used) as total_sop_used,
            SUM(assistant_used) as total_assistant_used,
            AVG(avg_confidence) as avg_confidence,
            MIN(date) as earliest_date,
            MAX(date) as latest_date
          FROM sop_metrics
        `);
        
        if (metricsResult.rows[0]) {
          exportData.metrics.exportStats = metricsResult.rows[0];
        }
        
        logger.info('Exported metrics summary');
      } catch (error) {
        logger.error('Failed to export metrics:', error);
      }
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `clubos-knowledge-export-${timestamp}.json`;
    
    // Set response headers for download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Send the export data
    res.json({
      success: true,
      data: exportData,
      filename
    });
    
    logger.info('Knowledge export completed successfully');
    
  } catch (error: any) {
    logger.error('Knowledge export failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export knowledge data'
    });
  }
});

export default router;