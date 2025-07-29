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
  const { description, route } = req.body;
  const testDescription = description || 'What is 7iron?';
  const testRoute = route || 'BrandTone';
  
  try {
    const diagnostics: any = {
      testDescription,
      testRoute,
      steps: []
    };
    
    // Step 1: Check if SOP module is enabled
    const sopEnabled = process.env.USE_INTELLIGENT_SOP === 'true';
    diagnostics.steps.push({
      step: 'Check SOP module',
      enabled: sopEnabled,
      shadowMode: process.env.SOP_SHADOW_MODE === 'true'
    });
    
    // Step 2: Test knowledge search directly
    diagnostics.steps.push({
      step: 'Direct knowledge search',
      query: testDescription
    });
    
    const knowledgeResults = await knowledgeLoader.unifiedSearch(testDescription, {
      includeStatic: true,
      includeExtracted: true,
      includeSOPEmbeddings: true,
      assistant: testRoute,
      limit: 5
    });
    
    diagnostics.knowledgeSearchResults = {
      found: knowledgeResults.length,
      results: knowledgeResults.map(r => ({
        issue: r.issue,
        source: r.source,
        category: r.category,
        confidence: r.confidence
      }))
    };
    
    // Step 3: Check what assistant service does
    if (sopEnabled) {
      const { intelligentSOPModule } = await import('../services/intelligentSOPModule');
      const sopDocs = await intelligentSOPModule.findRelevantContext(testDescription, testRoute);
      
      diagnostics.sopModuleResults = {
        documentsFound: sopDocs.length,
        documents: sopDocs.slice(0, 3).map(d => ({
          title: d.title,
          source: d.metadata?.source,
          confidence: d.metadata?.confidence
        }))
      };
      
      // Try processing with SOP
      const sopResponse = await intelligentSOPModule.processWithContext(testDescription, testRoute);
      diagnostics.sopResponse = {
        hasResponse: !!sopResponse.response,
        confidence: sopResponse.confidence,
        source: sopResponse.source,
        responsePreview: sopResponse.response?.substring(0, 100)
      };
    }
    
    // Step 4: Check what would happen in assistant service
    diagnostics.routeMapping = {
      inputRoute: testRoute,
      wouldSearchCategory: {
        'BrandTone': 'brand',
        'TechSupport': 'tech',
        'Emergency': 'emergency',
        'Booking & Access': 'booking'
      }[testRoute] || 'general'
    };
    
    // Step 5: Direct database query
    const category = diagnostics.routeMapping.wouldSearchCategory;
    const dbQuery = await db.query(`
      SELECT COUNT(*) as total,
        COUNT(CASE WHEN problem ILIKE $1 OR solution ILIKE $1 THEN 1 END) as matching
      FROM extracted_knowledge
      WHERE category = $2
    `, [`%${testDescription}%`, category]);
    
    diagnostics.directDatabaseCheck = {
      category,
      totalInCategory: dbQuery.rows[0].total,
      matchingQuery: dbQuery.rows[0].matching
    };
    
    // Step 6: Get some samples from the category
    const samples = await db.query(`
      SELECT problem, solution, confidence
      FROM extracted_knowledge
      WHERE category = $1
      ORDER BY confidence DESC
      LIMIT 5
    `, [category]);
    
    diagnostics.categorySamples = samples.rows;
    
    res.json({
      success: true,
      data: diagnostics
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

// Quick diagnostic for why knowledge isn't found
router.post('/diagnose', authenticate, async (req: Request, res: Response) => {
  const { query } = req.body;
  const testQuery = query || 'What is 7iron?';
  
  try {
    const diagnosis: any = {
      query: testQuery,
      timestamp: new Date().toISOString(),
      checks: []
    };
    
    // 1. Check environment settings
    diagnosis.environment = {
      USE_INTELLIGENT_SOP: process.env.USE_INTELLIGENT_SOP,
      SOP_SHADOW_MODE: process.env.SOP_SHADOW_MODE,
      SOP_CONFIDENCE_THRESHOLD: process.env.SOP_CONFIDENCE_THRESHOLD || '0.75'
    };
    
    // 2. Check if knowledge exists in database
    const searchTerms = testQuery.toLowerCase().split(' ').filter(w => w.length > 2);
    diagnosis.searchTerms = searchTerms;
    
    // 3. Search each category
    const categories = ['brand', 'tech', 'booking', 'emergency', 'general'];
    diagnosis.categorySearches = {};
    
    for (const category of categories) {
      const result = await db.query(`
        SELECT COUNT(*) as count
        FROM extracted_knowledge
        WHERE category = $1
        AND (
          problem ILIKE ANY($2::text[])
          OR solution ILIKE ANY($2::text[])
        )
      `, [category, searchTerms.map(t => `%${t}%`)]);
      
      diagnosis.categorySearches[category] = {
        matches: result.rows[0].count
      };
      
      // Get a sample if matches found
      if (result.rows[0].count > 0) {
        const sample = await db.query(`
          SELECT problem, solution, confidence
          FROM extracted_knowledge
          WHERE category = $1
          AND (
            problem ILIKE ANY($2::text[])
            OR solution ILIKE ANY($2::text[])
          )
          LIMIT 1
        `, [category, searchTerms.map(t => `%${t}%`)]);
        
        diagnosis.categorySearches[category].sample = sample.rows[0];
      }
    }
    
    // 4. Test unified search
    const unifiedResults = await knowledgeLoader.unifiedSearch(testQuery, {
      includeExtracted: true,
      includeStatic: true,
      includeSOPEmbeddings: true
    });
    
    diagnosis.unifiedSearch = {
      resultsFound: unifiedResults.length,
      topResults: unifiedResults.slice(0, 3).map(r => ({
        issue: r.issue,
        category: r.category,
        source: r.source,
        confidence: r.confidence
      }))
    };
    
    // 5. If SOP is enabled, check what it would do
    if (process.env.USE_INTELLIGENT_SOP === 'true') {
      diagnosis.sopModuleCheck = {
        enabled: true,
        wouldSearchBrandCategory: true
      };
      
      // Check if the SOP module can find the knowledge
      const { intelligentSOPModule } = await import('../services/intelligentSOPModule');
      const sopDocs = await intelligentSOPModule.findRelevantContext(testQuery, 'BrandTone');
      
      diagnosis.sopModuleCheck.documentsFound = sopDocs.length;
      diagnosis.sopModuleCheck.documents = sopDocs.slice(0, 3).map(d => ({
        title: d.title,
        metadata: d.metadata
      }));
    }
    
    // 6. Recommendations
    diagnosis.recommendations = [];
    
    if (diagnosis.categorySearches.brand.matches > 0 && process.env.USE_INTELLIGENT_SOP === 'true') {
      diagnosis.recommendations.push('Knowledge exists in brand category but SOP module may not be finding it');
      diagnosis.recommendations.push('Try disabling SOP module temporarily: set USE_INTELLIGENT_SOP=false');
    }
    
    if (unifiedResults.length > 0) {
      diagnosis.recommendations.push('Knowledge is findable through unified search');
      diagnosis.recommendations.push('Issue may be with SOP module response generation');
    }
    
    res.json({
      success: true,
      diagnosis
    });
    
  } catch (error) {
    logger.error('Diagnosis failed:', error);
    res.status(500).json({ 
      success: false, 
      error: String(error) 
    });
  }
});

// Toggle SOP module (for testing)
router.post('/toggle-sop', authenticate, adminOnly, async (req: Request, res: Response) => {
  const { enabled } = req.body;
  
  try {
    // This only affects the current instance, not persistent
    process.env.USE_INTELLIGENT_SOP = enabled ? 'true' : 'false';
    
    res.json({
      success: true,
      message: `SOP module ${enabled ? 'enabled' : 'disabled'} for this instance`,
      current: {
        USE_INTELLIGENT_SOP: process.env.USE_INTELLIGENT_SOP,
        SOP_SHADOW_MODE: process.env.SOP_SHADOW_MODE
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: String(error) 
    });
  }
});

export default router;