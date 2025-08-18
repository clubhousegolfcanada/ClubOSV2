import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { cachedLLMService as llmService } from '../services/llmServiceCached';
import { assistantService } from '../services/assistantService';
import { slackFallback } from '../services/slackFallback';
// JSON operations removed - using PostgreSQL
import { UserRequest, ProcessedRequest, SystemConfig, BotRoute } from '../types';
import { AppError } from '../middleware/errorHandler';
import { validate, requestValidation } from '../middleware/validation';
import { body } from 'express-validator';
import { strictLimiter } from '../middleware/security';
import { authenticate } from '../middleware/auth';
import { roleGuard, adminOrOperator } from '../middleware/roleGuard';
import OpenAI from 'openai';

// Only initialize OpenAI if API key is present
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

const router = Router();

// Simple test endpoint to verify route is accessible
router.get('/ping', (req: Request, res: Response) => {
  res.json({ message: 'pong', timestamp: new Date().toISOString() });
});

// Simple health check
router.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    llmEnabled: llmService?.isEnabled() || false,
    assistantEnabled: !!assistantService
  });
});

// Cache system config to avoid reading file on every request
let cachedConfig: SystemConfig | null = null;
let configLastLoaded = 0;
const CONFIG_CACHE_TTL = 60000; // 1 minute

async function getSystemConfig(): Promise<SystemConfig> {
  const now = Date.now();
  if (!cachedConfig || now - configLastLoaded > CONFIG_CACHE_TTL) {
    // Return default config for now - can be stored in database later
    cachedConfig = {
      environment: process.env.NODE_ENV || 'development',
      llmProvider: 'openai',
      features: {
        smartAssist: true,
        bookings: true,
        tickets: true,
        slack: true
      },
      limits: {
        maxRequestsPerDay: 1000,
        maxTokensPerRequest: 4000
      }
    };
    configLastLoaded = now;
  }
  return cachedConfig!;
}

// Add a test endpoint without validation to isolate the issue
router.post('/test-direct', async (req: Request, res: Response) => {
  try {
    res.json({
      received: req.body,
      smartAssistEnabled: {
        value: req.body.smartAssistEnabled,
        type: typeof req.body.smartAssistEnabled,
        truthyCheck: !!req.body.smartAssistEnabled,
        strictEqualsTrue: req.body.smartAssistEnabled === true,
        strictEqualsFalse: req.body.smartAssistEnabled === false,
        equalsStringTrue: req.body.smartAssistEnabled === 'true',
        equalsStringFalse: req.body.smartAssistEnabled === 'false'
      }
    });
  } catch (error) {
    logger.error('Error in test-direct:', error);
    res.status(500).json({ error: 'Test endpoint failed' });
  }
});

// Debug middleware to log request before validation
const debugMiddleware = (req: Request, res: Response, next: NextFunction) => {
  logger.info('PRE-VALIDATION Request body:', {
    body: req.body,
    smartAssistEnabled: req.body.smartAssistEnabled,
    smartAssistType: typeof req.body.smartAssistEnabled,
    headers: req.headers['content-type']
  });
  next();
};

// Add health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'LLM service is running'
  });
});

// Optimized request processing with single API call
router.post('/request', 
  authenticate,  // Re-enabled authentication
  adminOrOperator,  // Re-enabled role check
  debugMiddleware, // Log before validation
  // strictLimiter, // TEMPORARILY DISABLED due to Railway proxy issues
  // validate(requestValidation.llmRequest), // TEMPORARILY DISABLED for debugging
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = uuidv4();
    const sessionId = (req as any).requestId || uuidv4();

    try {
      // Use cached config
      const config = await getSystemConfig();
      
      // LLM is always enabled for now
      // if (!config.llmEnabled) {
      //   throw new AppError('LLM_DISABLED', 'LLM processing is currently disabled', 503);
      // }

      // Fetch full user info if authenticated
      let fullUser = null;
      if (req.user) {
        try {
          const { db } = await import('../utils/database');
          if (db.isEnabled()) {
            fullUser = await db.findUserById(req.user.id);
          }
        } catch (err) {
          logger.warn('Failed to fetch user info', { userId: req.user.id, error: err });
        }
      }
      // REMOVED: Demo mode bypass that allowed unauthenticated requests
      // Authentication is now strictly required

      // Log raw request body first
      logger.info('Raw request body received:', {
        body: JSON.stringify(req.body),
        headers: req.headers['content-type']
      });
      
      // Check if this is a customer kiosk request
      const isCustomerKiosk = req.body.requestDescription?.startsWith('[CUSTOMER KIOSK]') || 
                            req.body.metadata?.source === 'customer_kiosk';
      
      // Debug logging
      logger.info('Request processing debug', {
        fullBody: req.body,
        smartAssistEnabled: req.body.smartAssistEnabled,
        smartAssistType: typeof req.body.smartAssistEnabled,
        isCustomerKiosk,
        willSendToSlack: isCustomerKiosk || !req.body.smartAssistEnabled,
        requestDescription: req.body.requestDescription?.substring(0, 50)
      });
      
      // For customer kiosk requests, always send to Slack
      if (isCustomerKiosk || !req.body.smartAssistEnabled) {
        // Send directly to Slack
        const userRequest: UserRequest & { user?: any } = {
          id: requestId,
          requestDescription: req.body.requestDescription,
          location: req.body.location,
          smartAssistEnabled: false,
          timestamp: new Date().toISOString(),
          status: 'sent_to_slack',
          sessionId,
          userId: req.user?.id || 'customer-kiosk',
          user: fullUser ? {
            id: fullUser.id,
            name: fullUser.name,
            email: fullUser.email,
            phone: fullUser.phone,
            role: fullUser.role
          } : isCustomerKiosk ? { name: 'Customer Kiosk', role: 'customer' } : undefined
        };
        
        // Log the request to database asynchronously (don't wait)
        import('../utils/database').then(({ db }) => {
          if (db.isEnabled()) {
            db.createRequestLog({
              method: 'POST',
              path: '/api/llm/request',
              user_id: req.user?.id,
              ip_address: req.ip,
              user_agent: req.get('user-agent')
            }).catch(err => logger.error('Failed to log request', err));
          }
        }).catch(err => logger.error('Failed to import database', err));
        
        // Send to Slack and capture thread ID
        const slackThreadTs = await slackFallback.sendDirectMessage(userRequest);
        
        // Update the processed request with Slack thread ID
        const processedRequest: ProcessedRequest = {
          ...userRequest,
          botRoute: 'Slack',
          slackThreadTs,
          status: 'sent_to_slack' as any,
          processingTime: Date.now() - startTime
        };
        
        // Log to database asynchronously
        import('../utils/database').then(({ db }) => {
          if (db.isEnabled()) {
            db.createCustomerInteraction({
              user_id: req.user?.id,
              user_email: req.user?.email,
              request_text: userRequest.requestDescription,
              response_text: 'Sent to Slack support team',
              route: 'Slack',
              confidence: 1.0
            }).catch(err => logger.error('Failed to log interaction', err));
          }
        }).catch(err => logger.error('Failed to import database', err));
        
        return res.json({
          success: true,
          data: {
            requestId: userRequest.id,
            status: 'sent_to_slack',
            message: 'Your request has been sent to our support team',
            slackThreadTs
          }
        });
      }

      // Create user request for LLM processing
      const userRequest: UserRequest & { user?: any } = {
        id: requestId,
        requestDescription: req.body.requestDescription,
        location: req.body.location,
        routePreference: req.body.routePreference,
        smartAssistEnabled: true,
        timestamp: new Date().toISOString(),
        status: 'processing',
        sessionId,
        userId: req.user?.id || 'demo-user',
        user: fullUser ? {
          id: fullUser.id,
          name: fullUser.name,
          email: fullUser.email,
          phone: fullUser.phone,
          role: fullUser.role
        } : undefined
      };

      let processedRequest: ProcessedRequest;
      let slackThreadTs: string | undefined;

      try {
        // OPTIMIZATION: Skip the routing LLM call if user specified a route
        let targetRoute = userRequest.routePreference;
        let llmResponse: any = null;
        
        if (!targetRoute || targetRoute === 'Auto') {
          // Only call LLM router if we need to determine the route
          const routingStart = Date.now();
          llmResponse = await llmService.processRequest(
            userRequest.requestDescription,
            userRequest.userId,
            {
              location: userRequest.location,
              sessionId: userRequest.sessionId
            }
          );
          targetRoute = llmResponse.route;
          logger.info('LLM routing took:', { duration: Date.now() - routingStart, route: targetRoute });
        } else {
          // Create a minimal response for logging
          llmResponse = {
            route: targetRoute,
            confidence: 1.0,
            reasoning: 'User specified route',
            extractedInfo: {}
          };
        }
        
        // Now get the actual response from the assistant
        let assistantResponse;
        try {
          logger.info('Calling assistant service', { targetRoute });
          const assistantStart = Date.now();
          
          // Normalize route names for consistency
          const normalizeRoute = (route: string): string => {
            const routeMap: Record<string, string> = {
              'Booking&Access': 'Booking & Access',
              'booking': 'Booking & Access',
              'access': 'Booking & Access',
              'emergency': 'Emergency',
              'Emergency': 'Emergency',
              'tech': 'TechSupport',
              'TechSupport': 'TechSupport',
              'brand': 'BrandTone',
              'BrandTone': 'BrandTone',
              'general': 'BrandTone',
              'Auto': 'Auto'
            };
            return routeMap[route] || route;
          };
          
          const assistantRoute = normalizeRoute(targetRoute);
          
          assistantResponse = assistantService ? await assistantService.getAssistantResponse(
            assistantRoute,
            userRequest.requestDescription,
            {
              location: userRequest.location,
              sessionId: userRequest.sessionId
            }
          ) : null;
          logger.info('Assistant response took:', { duration: Date.now() - assistantStart, route: targetRoute });
          
          if (assistantResponse) {
            // Use the assistant's response
            llmResponse.response = assistantResponse.response;
            llmResponse.extractedInfo = {
              ...llmResponse.extractedInfo,
              assistantId: assistantResponse.assistantId,
              threadId: assistantResponse.threadId
            };
            
            // Add structured response data if available
            if (assistantResponse.structured) {
              llmResponse.structuredResponse = assistantResponse.structured;
              llmResponse.category = assistantResponse.category;
              llmResponse.priority = assistantResponse.priority;
              llmResponse.actions = assistantResponse.actions;
              llmResponse.metadata = assistantResponse.metadata;
              llmResponse.escalation = assistantResponse.escalation;
            }
          } else {
            throw new Error('Assistant service not available');
          }
        } catch (assistantError) {
          logger.warn('Failed to get assistant response, using fallback', {
            error: assistantError,
            route: targetRoute
          });
          // Provide a helpful fallback response
          llmResponse.response = `I'll help you with your ${targetRoute} request. ${getQuickResponse(targetRoute, userRequest.requestDescription)}`;
        }
        
        processedRequest = {
          ...userRequest,
          botRoute: targetRoute,
          llmResponse,
          status: 'completed',
          processingTime: Date.now() - startTime,
          slackThreadTs,
          user: userRequest.user // Ensure user info is preserved
        };

        // Check if this is an emergency or high priority request that needs immediate Slack notification
        const isEmergency = targetRoute === 'Emergency';
        const isHighPriority = llmResponse?.extractedInfo?.suggestedPriority === 'high' || 
                              llmResponse?.extractedInfo?.suggestedPriority === 'urgent';
        
        // Check system configuration for Slack notification settings
        try {
          const { db } = await import('../utils/database');
          const configResult = await db.query(
            'SELECT value FROM system_config WHERE key = $1',
            ['slack_notifications']
          );
          
          if (configResult.rows.length > 0) {
            const slackConfig = configResult.rows[0].value;
            
            // ALWAYS send Slack notification for emergencies or high priority
            // OR if configured to send on LLM success
            if (config.features?.slack && slackConfig.enabled && 
                (isEmergency || isHighPriority || slackConfig.sendOnLLMSuccess)) {
              
              // Add emergency flag to the request for special handling
              if (isEmergency || isHighPriority) {
                processedRequest.isEmergency = true;
                processedRequest.priority = llmResponse?.extractedInfo?.suggestedPriority || 'high';
              }
              
              slackFallback.sendProcessedNotification(processedRequest)
                .then(threadTs => {
                  processedRequest.slackThreadTs = threadTs;
                  logger.info('Slack notification sent', { 
                    threadTs,
                    isEmergency,
                    isHighPriority,
                    route: targetRoute,
                    priority: processedRequest.priority
                  });
                })
                .catch(err => logger.error('Failed to send Slack notification', err));
            }
          }
        } catch (err) {
          logger.warn('Failed to check Slack notification config', err);
        }

      } catch (llmError) {
        logger.error('LLM processing failed:', llmError);
        
        // Fallback to local routing or Slack
        if (config.features?.slack) {
          slackThreadTs = await slackFallback.sendFallbackNotification(
            userRequest as UserRequest & { user?: any },
            llmError instanceof Error ? llmError.message : 'Unknown error'
          );
        }

        // Use local routing as fallback
        const fallbackResponse = llmService.routeWithoutLLM(req.body.requestDescription);
        const fallbackRoute = fallbackResponse.route;
        
        processedRequest = {
          ...userRequest,
          botRoute: fallbackRoute as BotRoute,
          status: 'fallback',
          processingTime: Date.now() - startTime,
          error: 'LLM processing failed, used fallback routing',
          slackThreadTs
        };
      }

      // Calculate total time if client start time was provided
      const totalProcessingTime = req.body.clientStartTime 
        ? Date.now() - req.body.clientStartTime 
        : processedRequest.processingTime;

      // Log to database asynchronously - don't wait
      import('../utils/database').then(({ db }) => {
        if (db.isEnabled()) {
          db.createCustomerInteraction({
            user_id: req.user?.id,
            user_email: req.user?.email,
            request_text: userRequest.requestDescription,
            response_text: processedRequest.llmResponse?.response || 'Processing...',
            route: processedRequest.botRoute || 'unknown',
            confidence: processedRequest.llmResponse?.confidence || 0,
            // suggested_priority: processedRequest.llmResponse?.extractedInfo?.suggestedPriority,
            session_id: sessionId,
            metadata: {
              processingTime: totalProcessingTime,
              serverProcessingTime: processedRequest.processingTime,
              // extractedInfo: processedRequest.llmResponse?.extractedInfo
            }
          }).catch(err => logger.error('Failed to log', err));
          
          // Update or create session
          db.query(
            `INSERT INTO conversation_sessions (session_id, user_id, last_activity, context)
             VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
             ON CONFLICT (session_id) 
             DO UPDATE SET last_activity = CURRENT_TIMESTAMP, 
                          context = conversation_sessions.context || $3`,
            [
              sessionId,
              req.user?.id,
              JSON.stringify({
                lastRequest: userRequest.requestDescription,
                lastRoute: processedRequest.botRoute,
                timestamp: new Date().toISOString()
              })
            ]
          ).catch(err => logger.error('Failed to update session', err));
        }
      }).catch(err => logger.error('Failed to import database', err));

      // Check if response came from local knowledge
      const isLocalKnowledge = processedRequest.llmResponse?.assistantId?.startsWith('LOCAL-KNOWLEDGE-');
      const displayRoute = isLocalKnowledge 
        ? `Local Knowledge (${processedRequest.botRoute})`
        : processedRequest.botRoute;
      
      res.json({
        success: true,
        data: {
          requestId: processedRequest.id,
          botRoute: displayRoute,
          llmResponse: {
            route: displayRoute,
            response: processedRequest.llmResponse?.response || 'I\'m having trouble understanding your request. Please try rephrasing or contact support.',
            confidence: processedRequest.llmResponse?.confidence || 0.5,
            suggestedActions: processedRequest.llmResponse?.suggestedActions || [],
            reasoning: processedRequest.llmResponse?.reasoning,
            // extractedInfo: processedRequest.llmResponse?.extractedInfo,
            isAssistantResponse: !!processedRequest.llmResponse?.response,
            isLocalKnowledge: isLocalKnowledge,
            dataSource: isLocalKnowledge ? 'LOCAL_DATABASE' : 'OPENAI_API',
            // Include structured response data if available (future features)
            structured: processedRequest.llmResponse?.structured,
            // category: processedRequest.llmResponse?.category,
            // priority: processedRequest.llmResponse?.priority,
            // actions: processedRequest.llmResponse?.actions,
            metadata: processedRequest.llmResponse?.metadata,
            // escalation: processedRequest.llmResponse?.escalation
          },
          processingTime: processedRequest.processingTime,
          status: processedRequest.status,
          slackThreadTs: processedRequest.slackThreadTs
        }
      });

    } catch (error) {
      logger.error('Request processing failed:', error);
      
      // Log failed request asynchronously
      const failedRequest: ProcessedRequest = {
        id: requestId,
        requestDescription: req.body.requestDescription || '',
        smartAssistEnabled: true,
        timestamp: new Date().toISOString(),
        status: 'failed',
        sessionId,
        botRoute: 'Auto',
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      import('../utils/database').then(({ db }) => {
        if (db.isEnabled()) {
          db.createRequestLog({
            method: 'POST',
            path: '/api/llm/request',
            user_id: req.user?.id,
            ip_address: req.ip,
            user_agent: req.get('user-agent'),
            error: error instanceof Error ? error.message : 'Unknown error'
          }).catch(() => {});
        }
      }).catch(() => {});
      
      // Return error response instead of passing to error handler
      // This ensures CORS headers are set
      return res.status(500).json({
        success: false,
        error: {
          code: 'PROCESSING_ERROR',  
          message: error instanceof Error ? error.message : 'Failed to process request',
          requestId
        }
      });
    }
  }
);

// Helper function for quick responses
function getQuickResponse(route: string, description: string): string {
  const responses: Record<string, string> = {
    'Emergency': 'Follow emergency protocols: ensure safety, call 911 if needed, contact management, and document the incident.',
    'Booking & Access': 'I\'ll help you manage this booking/access issue. Check the system for customer details and follow standard procedures.',
    'TechSupport': 'I\'ll guide you through troubleshooting this equipment issue. Start with basic diagnostics.',
    'BrandTone': 'I\'ll help you create appropriate customer communications for this situation.'
  };
  return responses[route] || 'I\'ll assist you with this operational matter.';
}

// Get LLM status - temporarily remove auth for demo
router.get('/status', /* authenticate, */ async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await getSystemConfig();
    // TODO: Implement request logs in database
    const logs: ProcessedRequest[] = [];
    
    // Calculate stats from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogs = logs.filter(log => 
      new Date(log.timestamp) > oneDayAgo && log.smartAssistEnabled
    );
    
    const stats = {
      totalRequests: recentLogs.length,
      successfulRequests: recentLogs.filter(log => log.status === 'completed').length,
      fallbackRequests: recentLogs.filter(log => log.status === 'fallback').length,
      failedRequests: recentLogs.filter(log => log.status === 'failed').length,
      averageProcessingTime: recentLogs.length > 0
        ? recentLogs.reduce((sum, log) => sum + log.processingTime, 0) / recentLogs.length
        : 0,
      routeDistribution: recentLogs.reduce((acc, log) => {
        acc[log.botRoute] = (acc[log.botRoute] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    res.json({
      success: true,
      data: {
        enabled: config.llmEnabled && llmService.isEnabled(),
        provider: 'OpenAI',
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        stats,
        config: {
          llmEnabled: config.llmEnabled,
          slackFallbackEnabled: config.slackFallbackEnabled,
          maxRetries: config.maxRetries,
          requestTimeout: config.requestTimeout
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Test LLM routing - admin and operator only
router.post('/test', 
  authenticate,
  adminOrOperator,
  validate([
    body('description')
      .trim()
      .notEmpty()
      .withMessage('Description is required')
      .isLength({ min: 5, max: 500 })
      .withMessage('Description must be between 5 and 500 characters')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { description } = req.body;

      // Test both LLM and local routing
      const localResponse = llmService.routeWithoutLLM(description);
      const localRoute = localResponse.route;
      
      let llmRoute = null;
      let llmResponse = null;
      
      if (llmService.isEnabled()) {
        try {
          const testRequest: UserRequest = {
            id: 'test-' + uuidv4(),
            requestDescription: description,
            smartAssistEnabled: true,
            timestamp: new Date().toISOString(),
            status: 'processing',
            sessionId: 'test'
          };
          
          llmResponse = await llmService.processRequest(description, 'test-user', { sessionId: 'test' });
          llmRoute = llmResponse.route;
        } catch (err) {
          logger.error('Test LLM processing failed:', err);
        }
      }

      res.json({
        success: true,
        data: {
          description,
          localRoute,
          llmRoute,
          llmResponse,
          llmAvailable: llmService.isEnabled()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Debug endpoint to check what's happening
router.post('/debug-request',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { requestDescription } = req.body;
      
      // Check LLM service
      const llmEnabled = llmService.isEnabled();
      const llmStatus = await llmService.getRouterStatus();
      
      // Try to process with LLM
      let llmResponse = null;
      let llmError = null;
      try {
        llmResponse = await llmService.processRequest(requestDescription, 'debug-user');
      } catch (err: any) {
        llmError = err.message;
      }
      
      // Check system config
      const config = await getSystemConfig();
      
      res.json({
        success: true,
        debug: {
          llmEnabled,
          llmStatus,
          llmResponse,
          llmError,
          systemConfig: {
            llmEnabled: config.llmEnabled,
            provider: process.env.OPENAI_API_KEY ? 'OpenAI configured' : 'No API key'
          },
          assistantIds: {
            booking: process.env.BOOKING_ACCESS_GPT_ID || 'Not configured',
            emergency: process.env.EMERGENCY_GPT_ID || 'Not configured',
            tech: process.env.TECH_SUPPORT_GPT_ID || 'Not configured',
            brand: process.env.BRAND_MARKETING_GPT_ID || 'Not configured'
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Debug assistant response parsing
router.post('/debug-assistant',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { route, message } = req.body;
      
      if (!route || !message) {
        return res.status(400).json({
          success: false,
          error: 'Route and message are required'
        });
      }
      
      // Test the assistant service directly
      let assistantResponse = null;
      let parseError = null;
      let rawResponse = null;
      
      try {
        // Get the raw response first
        assistantResponse = await assistantService.getAssistantResponse(
          route,
          message,
          {}
        );
        
        // Store the raw response for debugging
        rawResponse = assistantResponse;
        
        logger.info('Debug assistant raw response:', {
          response: assistantResponse.response?.substring(0, 200) + '...',
          hasStructured: !!assistantResponse.structured,
          category: assistantResponse.category,
          priority: assistantResponse.priority,
          actionsCount: assistantResponse.actions?.length || 0
        });
      } catch (err: any) {
        parseError = err.message;
        logger.error('Debug assistant error:', err);
      }
      
      res.json({
        success: true,
        debug: {
          route,
          message,
          assistantResponse: rawResponse,
          parseError,
          responsePreview: rawResponse?.response?.substring(0, 500),
          hasStructuredData: !!rawResponse?.structured,
          structuredKeys: rawResponse?.structured ? Object.keys(rawResponse.structured) : [],
          responseSummary: {
            length: rawResponse?.response?.length || 0,
            hasJson: rawResponse?.response?.includes('{') && rawResponse?.response?.includes('}'),
            startsWithJson: rawResponse?.response?.trim().startsWith('{'),
            category: rawResponse?.category,
            priority: rawResponse?.priority,
            actionsCount: rawResponse?.actions?.length || 0
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/llm/suggest-response - Generate AI response suggestion for dashboard
router.post('/suggest-response', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conversationId, context } = req.body;
    
    if (!context) {
      return res.status(400).json({
        success: false,
        message: 'Context is required'
      });
    }

    // Get relevant knowledge base entries
    const knowledgeQuery = await db.query(`
      SELECT content, confidence_score 
      FROM knowledge_store 
      WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
      ORDER BY confidence_score DESC
      LIMIT 3
    `, [context]);

    // Build enhanced context with knowledge base
    let enhancedContext = context;
    if (knowledgeQuery.rows.length > 0) {
      enhancedContext += '\n\nRelevant Information:\n';
      knowledgeQuery.rows.forEach((row: any) => {
        enhancedContext += `- ${row.content}\n`;
      });
    }

    // Generate response using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant for a golf club. Generate a friendly, professional response to the customer's message. 
          Use the provided context and knowledge base information to give an accurate, helpful response.
          Keep responses concise (2-3 sentences max) and conversational.
          If you're not sure about something, suggest they contact the club directly.`
        },
        {
          role: 'user',
          content: enhancedContext
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    const suggestion = completion.choices[0]?.message?.content || '';
    
    // Calculate confidence based on knowledge base matches
    const confidence = knowledgeQuery.rows.length > 0 
      ? Math.min(95, 70 + (knowledgeQuery.rows.length * 8))
      : 60;

    // Log the suggestion
    await db.query(`
      INSERT INTO llm_logs (
        user_id, prompt, response, model, tokens_used, 
        response_time_ms, success, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
      req.user?.id,
      context,
      suggestion,
      'gpt-4-turbo-preview',
      completion.usage?.total_tokens || 0,
      0, // Response time would need to be calculated
      true
    ]);

    res.json({
      success: true,
      suggestion,
      confidence,
      knowledgeMatches: knowledgeQuery.rows.length
    });
  } catch (error) {
    logger.error('Error generating response suggestion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate suggestion',
      suggestion: 'I can help you with that. Let me check our information and get back to you shortly.',
      confidence: 50
    });
  }
});

export default router;
