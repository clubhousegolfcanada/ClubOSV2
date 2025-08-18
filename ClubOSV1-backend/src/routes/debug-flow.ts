import { Router } from 'express';
import { logger } from '../utils/logger';
import { cachedLLMService } from '../services/llmServiceCached';
import { cacheService } from '../services/cacheService';
import { assistantService } from '../services/assistantService';
import { knowledgeSearchService } from '../services/knowledgeSearchService';
import { db } from '../utils/database';

const router = Router();

/**
 * Debug endpoint to trace the EXACT flow of a request
 * This will show you: Redis → Database → OpenAI
 */
router.post('/trace-flow', async (req, res) => {
  const { question = "What are the hours for the golf simulator?" } = req.body;
  const flow: any[] = [];
  const startTime = Date.now();

  try {
    // Step 1: Check Redis Cache
    const cacheKey = cacheService.generateKey('llm:response', {
      description: question.substring(0, 200)
    });
    
    flow.push({
      step: 1,
      action: 'CHECK_REDIS_CACHE',
      cacheKey,
      timestamp: Date.now() - startTime
    });

    const cachedResult = await cacheService.get(cacheKey);
    
    if (cachedResult) {
      flow.push({
        step: 2,
        action: 'CACHE_HIT',
        result: 'Found in Redis!',
        data: cachedResult,
        timestamp: Date.now() - startTime
      });
      
      return res.json({
        flow,
        totalTime: Date.now() - startTime,
        source: 'REDIS_CACHE'
      });
    }

    flow.push({
      step: 2,
      action: 'CACHE_MISS',
      result: 'Not in Redis, continuing...',
      timestamp: Date.now() - startTime
    });

    // Step 2: Check Database Knowledge
    flow.push({
      step: 3,
      action: 'CHECK_DATABASE_KNOWLEDGE',
      query: question,
      timestamp: Date.now() - startTime
    });

    // Search knowledge_store table
    const knowledgeResults = await db.query(`
      SELECT key, value, confidence, metadata
      FROM knowledge_store
      WHERE searchable_content ILIKE $1
      OR key ILIKE $1
      ORDER BY confidence DESC
      LIMIT 5
    `, [`%${question.split(' ').slice(0, 3).join('%')}%`]);

    flow.push({
      step: 4,
      action: 'DATABASE_SEARCH_RESULT',
      found: knowledgeResults.rows.length,
      results: knowledgeResults.rows,
      timestamp: Date.now() - startTime
    });

    // Try knowledgeSearchService
    const knowledgeSearch = await knowledgeSearchService.searchKnowledge(question, 'BrandTone', 5);
    
    flow.push({
      step: 5,
      action: 'KNOWLEDGE_SERVICE_SEARCH',
      found: knowledgeSearch.length,
      results: knowledgeSearch,
      timestamp: Date.now() - startTime
    });

    // Step 3: Route with LLM
    flow.push({
      step: 6,
      action: 'LLM_ROUTING',
      description: 'Determining which assistant to use',
      timestamp: Date.now() - startTime
    });

    const routingResult = await cachedLLMService.routeRequest(question);
    
    flow.push({
      step: 7,
      action: 'ROUTE_DETERMINED',
      route: routingResult.route,
      confidence: routingResult.confidence,
      timestamp: Date.now() - startTime
    });

    // Step 4: Call OpenAI Assistant
    flow.push({
      step: 8,
      action: 'CALLING_OPENAI_ASSISTANT',
      route: routingResult.route,
      assistantId: process.env[`${routingResult.route.toUpperCase().replace(' ', '_')}_GPT_ID`],
      timestamp: Date.now() - startTime
    });

    let assistantResponse;
    if (assistantService) {
      assistantResponse = await assistantService.getAssistantResponse(
        routingResult.route,
        question,
        { sessionId: 'debug-' + Date.now() }
      );
      
      flow.push({
        step: 9,
        action: 'OPENAI_ASSISTANT_RESPONSE',
        response: assistantResponse.response.substring(0, 200) + '...',
        assistantId: assistantResponse.assistantId,
        threadId: assistantResponse.threadId,
        timestamp: Date.now() - startTime
      });
    } else {
      flow.push({
        step: 9,
        action: 'NO_ASSISTANT_SERVICE',
        fallback: 'Would use fallback response',
        timestamp: Date.now() - startTime
      });
    }

    // Step 5: Cache the response
    if (assistantResponse) {
      await cacheService.set(cacheKey, assistantResponse, { ttl: 3600 });
      
      flow.push({
        step: 10,
        action: 'CACHED_TO_REDIS',
        ttl: 3600,
        timestamp: Date.now() - startTime
      });
    }

    // Final summary
    const summary = {
      flow,
      totalTime: Date.now() - startTime,
      dataSources: {
        redis: cachedResult ? 'HIT' : 'MISS',
        database: knowledgeResults.rows.length > 0 ? `Found ${knowledgeResults.rows.length} results` : 'No results',
        knowledgeService: knowledgeSearch.length > 0 ? `Found ${knowledgeSearch.length} results` : 'No results',
        openai: assistantResponse ? 'Called' : 'Not called'
      },
      actualSource: assistantResponse ? 'OPENAI_ASSISTANT' : 'UNKNOWN',
      explanation: `
        The system flow is:
        1. Check Redis cache (${cachedResult ? 'HIT' : 'MISS'})
        2. Search database knowledge (Found: ${knowledgeResults.rows.length})
        3. Route request with LLM (Route: ${routingResult?.route})
        4. Call OpenAI Assistant (${assistantResponse ? 'Success' : 'Failed'})
        5. Cache response in Redis
        
        IMPORTANT: The system ALWAYS calls OpenAI Assistant, even if database has answers!
        The database knowledge is searched but NOT USED in the response.
      `
    };

    res.json(summary);

  } catch (error) {
    flow.push({
      step: 'ERROR',
      error: error.message,
      timestamp: Date.now() - startTime
    });
    
    res.status(500).json({
      error: 'Flow trace failed',
      flow,
      message: error.message
    });
  }
});

/**
 * Test if database knowledge is ever used
 */
router.get('/test-database-usage', async (req, res) => {
  try {
    // Check what's actually in the knowledge tables
    const tables = [
      'knowledge_store',
      'assistant_knowledge',
      'extracted_knowledge',
      'knowledge_audit_log'
    ];
    
    const results: any = {};
    
    for (const table of tables) {
      try {
        const count = await db.query(`SELECT COUNT(*) FROM ${table}`);
        const sample = await db.query(`SELECT * FROM ${table} LIMIT 3`);
        
        results[table] = {
          count: count.rows[0].count,
          sample: sample.rows,
          status: count.rows[0].count > 0 ? 'HAS_DATA' : 'EMPTY'
        };
      } catch (err) {
        results[table] = {
          error: err.message,
          status: 'TABLE_ERROR'
        };
      }
    }
    
    // Check if knowledge search is ever called
    const searchLogs = await db.query(`
      SELECT * FROM api_usage 
      WHERE endpoint LIKE '%knowledge%' 
      ORDER BY created_at DESC 
      LIMIT 10
    `).catch(() => ({ rows: [] }));
    
    res.json({
      knowledgeTables: results,
      recentKnowledgeAPICalls: searchLogs.rows,
      analysis: {
        hasKnowledgeData: Object.values(results).some((r: any) => r.count > 0),
        isKnowledgeBeingQueried: searchLogs.rows.length > 0,
        conclusion: 'The system has knowledge in the database but ALWAYS uses OpenAI instead!'
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Database test failed',
      message: error.message
    });
  }
});

export default router;