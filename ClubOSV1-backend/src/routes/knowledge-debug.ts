import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { adminOnly } from '../middleware/roleGuard';
import { db } from '../utils/database';
import { knowledgeLoader } from '../knowledge-base/knowledgeLoader';
import { logger } from '../utils/logger';

const router = Router();

// Debug search functionality
router.post('/search', authenticate, async (req: Request, res: Response) => {
  const { query, testTerms } = req.body;
  const searchQuery = query || '7iron fan bettergolf nick';
  const terms = testTerms || ['7iron', 'fan', 'bettergolf', 'nick'];
  
  try {
    const results: any = {
      searchQuery,
      timestamp: new Date().toISOString(),
      extractedKnowledge: {
        total: 0,
        byCategory: {},
        samples: []
      },
      searchResults: {},
      directQueries: {}
    };
    
    // 1. Check extracted knowledge count
    const ekCount = await db.query('SELECT COUNT(*) as count FROM extracted_knowledge');
    results.extractedKnowledge.total = ekCount.rows[0].count;
    
    // 2. Check categories
    const categories = await db.query(`
      SELECT category, COUNT(*) as count 
      FROM extracted_knowledge 
      GROUP BY category
    `);
    categories.rows.forEach((row: any) => {
      results.extractedKnowledge.byCategory[row.category] = row.count;
    });
    
    // 3. Sample relevant entries
    const samples = await db.query(`
      SELECT id, category, problem, solution, confidence 
      FROM extracted_knowledge 
      WHERE problem ILIKE '%7iron%' 
         OR problem ILIKE '%fan%' 
         OR problem ILIKE '%bettergolf%' 
         OR problem ILIKE '%nick%'
         OR solution ILIKE '%7iron%' 
         OR solution ILIKE '%fan%' 
         OR solution ILIKE '%bettergolf%' 
         OR solution ILIKE '%nick%'
      LIMIT 10
    `);
    results.extractedKnowledge.samples = samples.rows;
    
    // 4. Test each search method
    for (const term of terms) {
      results.searchResults[term] = {
        asyncDB: [],
        syncSearch: [],
        findSolution: []
      };
      
      // Test async DB search
      try {
        const asyncResults = await knowledgeLoader.searchKnowledgeDB(term);
        results.searchResults[term].asyncDB = asyncResults.slice(0, 3).map((r: any) => ({
          issue: r.issue,
          category: r.category,
          source: r.source,
          confidence: r.confidence
        }));
      } catch (err) {
        results.searchResults[term].asyncDB = { error: String(err) };
      }
      
      // Test sync search (what LocalProvider uses)
      try {
        const syncResults = knowledgeLoader.searchKnowledge(term);
        results.searchResults[term].syncSearch = syncResults.slice(0, 3);
      } catch (err) {
        results.searchResults[term].syncSearch = { error: String(err) };
      }
      
      // Test findSolution
      try {
        const solutions = await knowledgeLoader.findSolution([term]);
        results.searchResults[term].findSolution = solutions.slice(0, 3).map((s: any) => ({
          issue: s.issue,
          category: s.category,
          matchScore: s.matchScore,
          source: s.source
        }));
      } catch (err) {
        results.searchResults[term].findSolution = { error: String(err) };
      }
    }
    
    // 5. Direct database queries to verify data exists
    results.directQueries.exact = await db.query(`
      SELECT COUNT(*) as count 
      FROM extracted_knowledge 
      WHERE problem ILIKE '%7iron%' 
         OR solution ILIKE '%7iron%'
    `).then(r => r.rows[0].count).catch(e => ({ error: String(e) }));
    
    results.directQueries.fuzzy = await db.query(`
      SELECT problem, solution, confidence 
      FROM extracted_knowledge 
      WHERE to_tsvector('english', problem || ' ' || solution) @@ to_tsquery('english', '7iron | fan | bettergolf | nick')
      LIMIT 5
    `).then(r => r.rows).catch(e => ({ error: String(e) }));
    
    // 6. Check if knowledgeLoader is initialized
    results.knowledgeLoaderStatus = {
      initialized: (knowledgeLoader as any).dbInitialized || false
    };
    
    res.json({
      success: true,
      data: results
    });
    
  } catch (error) {
    logger.error('Knowledge debug search failed:', error);
    res.status(500).json({ 
      success: false, 
      error: String(error),
      message: 'Debug search failed'
    });
  }
});

// Test the entire request flow
router.post('/test-flow', authenticate, async (req: Request, res: Response) => {
  const { description } = req.body;
  const testDescription = description || 'What is 7iron?';
  
  try {
    // Import LocalProvider
    const { LocalProvider } = await import('../services/llm/LocalProvider');
    const localProvider = new LocalProvider();
    
    // Test the provider directly
    const result = await localProvider.processRequest(testDescription);
    
    // Also get what it searched for using knowledgeLoader
    const searchResults = await knowledgeLoader.unifiedSearch(testDescription, {
      includeStatic: true,
      includeExtracted: true,
      includeSOPEmbeddings: true
    });
    const solutions = await knowledgeLoader.findSolution([testDescription]);
    
    res.json({
      success: true,
      data: {
        testDescription,
        providerResult: result,
        searchResults: searchResults.slice(0, 5),
        solutions: solutions.slice(0, 5),
        knowledgeFound: searchResults.length > 0 || solutions.length > 0
      }
    });
    
  } catch (error) {
    logger.error('Test flow failed:', error);
    res.status(500).json({ 
      success: false, 
      error: String(error) 
    });
  }
});

// Verify extracted knowledge count and samples
router.get('/verify-extracted', authenticate, async (req: Request, res: Response) => {
  try {
    const stats: any = {};
    
    // Total count
    const totalCount = await db.query('SELECT COUNT(*) as count FROM extracted_knowledge');
    stats.totalDocuments = totalCount.rows[0].count;
    
    // By category
    const byCategory = await db.query(`
      SELECT category, COUNT(*) as count 
      FROM extracted_knowledge 
      GROUP BY category 
      ORDER BY count DESC
    `);
    stats.byCategory = byCategory.rows;
    
    // Search for specific terms
    const searchTerms = ['7iron', 'fan', 'bettergolf', 'nick'];
    stats.searchResults = {};
    
    for (const term of searchTerms) {
      const count = await db.query(`
        SELECT COUNT(*) as count
        FROM extracted_knowledge
        WHERE problem ILIKE $1 OR solution ILIKE $1
      `, [`%${term}%`]);
      
      const samples = await db.query(`
        SELECT problem, solution, confidence, category
        FROM extracted_knowledge
        WHERE problem ILIKE $1 OR solution ILIKE $1
        LIMIT 3
      `, [`%${term}%`]);
      
      stats.searchResults[term] = {
        count: count.rows[0].count,
        samples: samples.rows
      };
    }
    
    // Recent uploads
    const recent = await db.query(`
      SELECT problem, category, confidence, created_at
      FROM extracted_knowledge
      ORDER BY created_at DESC
      LIMIT 10
    `);
    stats.recentUploads = recent.rows;
    
    // Test unified search
    const testSearches = ['7iron', 'golf tips', 'bettergolf'];
    stats.unifiedSearchTests = {};
    
    for (const query of testSearches) {
      const results = await knowledgeLoader.unifiedSearch(query, {
        includeExtracted: true,
        limit: 3
      });
      stats.unifiedSearchTests[query] = {
        found: results.length,
        results: results.map(r => ({
          issue: r.issue.substring(0, 50),
          source: r.source,
          confidence: r.confidence
        }))
      };
    }
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('Failed to verify extracted knowledge:', error);
    res.status(500).json({ 
      success: false, 
      error: String(error) 
    });
  }
});

export default router;