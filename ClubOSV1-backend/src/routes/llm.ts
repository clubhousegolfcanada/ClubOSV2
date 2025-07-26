import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { llmService } from '../services/llmService';
import { assistantService } from '../services/assistantService';
import { slackFallback } from '../services/slackFallback';
// JSON operations removed - using PostgreSQL
import { UserRequest, ProcessedRequest, SystemConfig } from '../types';
import { AppError } from '../middleware/errorHandler';
import { validate, requestValidation } from '../middleware/validation';
import { body } from 'express-validator';
import { strictLimiter } from '../middleware/security';
import { authenticate } from '../middleware/auth';
import { roleGuard, adminOrOperator } from '../middleware/roleGuard';

const router = Router();

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

// Optimized request processing with single API call
router.post('/request', 
  // authenticate,  // Commented out for demo
  // adminOrOperator,  // Commented out for demo
  debugMiddleware, // Log before validation
  // strictLimiter, // TEMPORARILY DISABLED due to Railway proxy issues
  validate(requestValidation.llmRequest), // Apply validation
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
          fullUser = await db.findUserById(req.user.id);
        } catch (err) {
          logger.warn('Failed to fetch user info', { userId: req.user.id });
        }
      }

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
          db.createRequestLog({
            method: 'POST',
            path: '/api/llm/request',
            user_id: req.user?.id,
            ip_address: req.ip,
            user_agent: req.get('user-agent')
          }).catch(err => logger.error('Failed to log request', err));
        });
        
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
          db.createCustomerInteraction({
            user_id: req.user?.id,
            user_email: req.user?.email,
            request_text: userRequest.requestDescription,
            response_text: 'Sent to Slack support team',
            route: 'Slack',
            confidence: 1.0
          }).catch(err => logger.error('Failed to log interaction', err));
        });
        
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
          
          assistantResponse = assistantService ? await assistantService.getAssistantResponse(
            targetRoute,
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
          slackThreadTs
        };

        // Send success notification to Slack if configured (async)
        if (config.features?.slack) {
          slackFallback.sendProcessedNotification(processedRequest)
            .then(threadTs => {
              processedRequest.slackThreadTs = threadTs;
              // Thread ID logged with initial request
            })
            .catch(err => logger.error('Failed to send Slack notification', err));
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
          botRoute: fallbackRoute,
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
        db.createCustomerInteraction({
          user_id: req.user?.id,
          user_email: req.user?.email,
          request_text: userRequest.requestDescription,
          response_text: processedRequest.llmResponse?.response || 'Processing...',
          route: processedRequest.botRoute || 'unknown',
          confidence: processedRequest.llmResponse?.confidence || 0,
          metadata: {
            processingTime: totalProcessingTime,
            serverProcessingTime: processedRequest.processingTime
          }
        }).catch(err => logger.error('Failed to log', err));
      });

      res.json({
        success: true,
        data: {
          requestId: processedRequest.id,
          botRoute: processedRequest.botRoute,
          llmResponse: {
            route: processedRequest.botRoute,
            response: processedRequest.llmResponse?.response || 'I\'m having trouble understanding your request. Please try rephrasing or contact support.',
            confidence: processedRequest.llmResponse?.confidence || 0.5,
            suggestedActions: processedRequest.llmResponse?.extractedInfo?.solutions || processedRequest.llmResponse?.suggestedActions || [],
            reasoning: processedRequest.llmResponse?.reasoning,
            extractedInfo: processedRequest.llmResponse?.extractedInfo,
            isAssistantResponse: !!processedRequest.llmResponse?.response,
            // Include structured response data if available
            structured: processedRequest.llmResponse?.structuredResponse,
            category: processedRequest.llmResponse?.category,
            priority: processedRequest.llmResponse?.priority,
            actions: processedRequest.llmResponse?.actions,
            metadata: processedRequest.llmResponse?.metadata,
            escalation: processedRequest.llmResponse?.escalation
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
        db.createRequestLog({
          method: 'POST',
          path: '/api/llm/request',
          user_id: req.user?.id,
          ip_address: req.ip,
          user_agent: req.get('user-agent'),
          error: error instanceof Error ? error.message : 'Unknown error'
        }).catch(() => {});
      });
      
      next(error);
    }
  }
);

// Helper function for quick responses
function getQuickResponse(route: string, description: string): string {
  const responses: Record<string, string> = {
    'Emergency': 'For immediate assistance, please call 911 or contact facility management.',
    'Booking&Access': 'I can help with booking changes, access issues, or reservations.',
    'TechSupport': 'I\'ll help troubleshoot your technical issue.',
    'BrandTone': 'I\'d be happy to provide information about our services and offerings.'
  };
  return responses[route] || 'Let me help you with that request.';
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
          
          llmResponse = await llmService.processRequest(testRequest);
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

export default router;
