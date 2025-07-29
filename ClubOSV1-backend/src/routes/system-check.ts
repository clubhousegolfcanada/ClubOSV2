import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { semanticSearch } from '../services/semanticSearch';
// SOP module disabled - using GPT-4o router

const router = Router();

// Simple system check endpoint
router.get('/check', authenticate, async (req: Request, res: Response) => {
  try {
    const checks = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      configuration: {
        openaiConfigured: !!process.env.OPENAI_API_KEY,
        openaiKeyPrefix: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 7) + '...' : 'NOT SET',
        useIntelligentSOP: process.env.USE_INTELLIGENT_SOP === 'true',
        sopShadowMode: process.env.SOP_SHADOW_MODE === 'true',
        sopConfidenceThreshold: process.env.SOP_CONFIDENCE_THRESHOLD || '0.75'
      },
      services: {
        database: false,
        semanticSearch: false,
        sopModule: false,
        semanticSearchWorking: false,
        semanticSearchError: undefined as string | undefined
      },
      data: {
        extractedKnowledgeCount: 0,
        brandCategoryCount: 0,
        sevenIronCount: 0
      }
    };
    
    // Check database
    try {
      const dbTest = await db.query('SELECT 1 as test');
      checks.services.database = dbTest.rows[0].test === 1;
      
      if (checks.services.database) {
        // Count documents
        const totalCount = await db.query('SELECT COUNT(*) as count FROM extracted_knowledge');
        checks.data.extractedKnowledgeCount = parseInt(totalCount.rows[0].count);
        
        const brandCount = await db.query(`
          SELECT COUNT(*) as count 
          FROM extracted_knowledge 
          WHERE category = 'brand'
        `);
        checks.data.brandCategoryCount = parseInt(brandCount.rows[0].count);
        
        const sevenIronCount = await db.query(`
          SELECT COUNT(*) as count 
          FROM extracted_knowledge 
          WHERE problem ILIKE '%7iron%' OR solution ILIKE '%7iron%'
        `);
        checks.data.sevenIronCount = parseInt(sevenIronCount.rows[0].count);
      }
    } catch (err) {
      logger.error('Database check failed:', err);
    }
    
    // Check semantic search
    checks.services.semanticSearch = !!(semanticSearch as any).openai;
    
    // Check SOP module
    // SOP module disabled - using GPT-4o router
    const sopStatus = { 
      isInitialized: false, 
      documentCount: 0, 
      embeddingCount: 0,
      message: 'SOP module disabled - using GPT-4o router' 
    };
    checks.services.sopModule = sopStatus.initialized;
    
    // Test semantic search if available
    if (checks.services.semanticSearch) {
      try {
        const testResults = await semanticSearch.searchKnowledge('test', { limit: 1 });
        checks.services.semanticSearchWorking = true;
      } catch (err) {
        checks.services.semanticSearchWorking = false;
        checks.services.semanticSearchError = String(err);
      }
    }
    
    res.json({
      success: true,
      checks
    });
    
  } catch (error) {
    logger.error('System check failed:', error);
    res.status(500).json({
      success: false,
      error: String(error)
    });
  }
});

// Quick test endpoint
router.post('/test-search', authenticate, async (req: Request, res: Response) => {
  const { query } = req.body;
  const testQuery = query || '7iron';
  
  try {
    const results: any = {
      query: testQuery,
      timestamp: new Date().toISOString()
    };
    
    // Direct DB search
    const dbResults = await db.query(`
      SELECT id, problem, solution, category, confidence
      FROM extracted_knowledge
      WHERE problem ILIKE $1 OR solution ILIKE $1
      LIMIT 5
    `, [`%${testQuery}%`]);
    
    results.directDatabase = {
      count: dbResults.rows.length,
      results: dbResults.rows
    };
    
    // Semantic search test
    if ((semanticSearch as any).openai) {
      try {
        const semanticResults = await semanticSearch.searchKnowledge(testQuery, {
          limit: 5,
          includeAllCategories: true
        });
        results.semanticSearch = {
          count: semanticResults.length,
          results: semanticResults
        };
      } catch (err) {
        results.semanticSearch = {
          error: String(err)
        };
      }
    } else {
      results.semanticSearch = {
        error: 'OpenAI not configured'
      };
    }
    
    res.json({
      success: true,
      results
    });
    
  } catch (error) {
    logger.error('Test search failed:', error);
    res.status(500).json({
      success: false,
      error: String(error)
    });
  }
});

export default router;