import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// Check SOP embeddings
router.get('/check-embeddings', authenticate, async (req: Request, res: Response) => {
  try {
    const results: any = {};
    
    // 1. Count total SOP embeddings
    const totalCount = await db.query('SELECT COUNT(*) as count FROM sop_embeddings');
    results.totalEmbeddings = parseInt(totalCount.rows[0].count);
    
    // 2. Count by assistant
    const byAssistant = await db.query(`
      SELECT assistant, COUNT(*) as count 
      FROM sop_embeddings 
      GROUP BY assistant 
      ORDER BY count DESC
    `);
    results.byAssistant = byAssistant.rows;
    
    // 3. Search for specific terms
    const searchTerms = ['7iron', 'fan', 'bettergolf', 'nick', 'ClubOS', 'support'];
    results.termSearches = {};
    
    for (const term of searchTerms) {
      const termResult = await db.query(`
        SELECT COUNT(*) as count
        FROM sop_embeddings
        WHERE title ILIKE $1 OR content ILIKE $1
      `, [`%${term}%`]);
      
      results.termSearches[term] = parseInt(termResult.rows[0].count);
    }
    
    // 4. Get sample documents
    const samples = await db.query(`
      SELECT id, assistant, title, 
        SUBSTRING(content, 1, 100) as content_preview,
        created_at
      FROM sop_embeddings
      ORDER BY created_at DESC
      LIMIT 5
    `);
    results.recentSamples = samples.rows;
    
    // 5. Check if extracted_knowledge has any data
    const ekCount = await db.query('SELECT COUNT(*) as count FROM extracted_knowledge');
    results.extractedKnowledgeCount = parseInt(ekCount.rows[0].count);
    
    res.json({
      success: true,
      data: results,
      message: results.totalEmbeddings > 0 
        ? `Found ${results.totalEmbeddings} documents in SOP embeddings` 
        : 'No documents found in SOP embeddings'
    });
    
  } catch (error) {
    logger.error('SOP check failed:', error);
    res.status(500).json({
      success: false,
      error: String(error)
    });
  }
});

export default router;