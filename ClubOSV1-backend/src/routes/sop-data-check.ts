import { Router, Request, Response } from 'express';
import { query } from '../utils/db';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    // Get total count
    const countResult = await query('SELECT COUNT(*) as total FROM sop_embeddings');
    
    // Get count by assistant
    const assistantResult = await query(`
      SELECT assistant, COUNT(*) as count 
      FROM sop_embeddings 
      GROUP BY assistant 
      ORDER BY count DESC
    `);
    
    // Search for specific terms
    const searchTerms = ['7iron', 'bettergolf', 'fan', 'nick', 'clubos'];
    const searchResults = {};
    
    for (const term of searchTerms) {
      const result = await query(`
        SELECT id, assistant, title, 
               substring(content, 1, 200) as content_preview
        FROM sop_embeddings 
        WHERE content ILIKE $1 OR title ILIKE $1
        LIMIT 3
      `, [`%${term}%`]);
      
      searchResults[term] = {
        count: result.rows.length,
        samples: result.rows
      };
    }
    
    // Get recent entries
    const recentResult = await query(`
      SELECT id, assistant, title, created_at
      FROM sop_embeddings 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    res.json({
      total: countResult.rows[0]?.total || 0,
      byAssistant: assistantResult.rows,
      searchResults,
      recentEntries: recentResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;