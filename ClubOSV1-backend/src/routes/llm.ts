import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { llmService } from '../services/llmService';
import { assistantService } from '../services/assistantService';
import { slackFallback } from '../services/slackFallback';
import { appendToJsonArray, readJsonFile } from '../utils/fileUtils';
import { UserRequest, ProcessedRequest, SystemConfig } from '../types';
import { AppError } from '../middleware/errorHandler';
import { validate, requestValidation } from '../middleware/validation';
import { body } from 'express-validator';
import { strictLimiter } from '../middleware/security';
import { authenticate } from '../middleware/auth';
import { roleGuard, adminOrOperator } from '../middleware/roleGuard';

const router = Router();

// Process request with LLM - temporarily remove auth for demo
router.post('/request', 
  // authenticate,  // Commented out for demo
  // adminOrOperator,  // Commented out for demo
  strictLimiter, // Apply strict rate limiting
  validate(requestValidation.llmRequest), // Apply validation
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = uuidv4();
    const sessionId = (req as any).requestId || uuidv4();

    try {
      // Load system config
      const config = await readJsonFile<SystemConfig>('systemConfig.json');
      
      if (!config.llmEnabled) {
        throw new AppError('LLM_DISABLED', 'LLM processing is currently disabled', 503);
      }

      // Fetch full user info if authenticated
      let fullUser = null;
      if (req.user) {
        try {
          const users = await readJsonFile<any[]>('users.json');
          fullUser = users.find(u => u.id === req.user!.id);
        } catch (err) {
          logger.warn('Failed to fetch user info', { userId: req.user.id });
        }
      }

      // Create user request object with user info
      const userRequest: UserRequest & { user?: any } = {
        id: requestId,
        requestDescription: req.body.requestDescription,
        location: req.body.location,
        routePreference: req.body.routePreference,
        smartAssistEnabled: true,
        timestamp: new Date().toISOString(),
        status: 'processing',
        sessionId,
        userId: req.user?.id || 'demo-user', // Add user ID if authenticated
        user: fullUser ? {
          id: fullUser.id,
          name: fullUser.name,
          email: fullUser.email,
          phone: fullUser.phone,
          role: fullUser.role
        } : undefined
      };

      // Log the request
      await appendToJsonArray('userLogs.json', userRequest);

      let processedRequest: ProcessedRequest;

      try {
        // Process with LLM for routing
        const llmResponse = await llmService.processRequest(
          userRequest.requestDescription,
          userRequest.userId,
          {
            location: userRequest.location,
            routePreference: userRequest.routePreference,
            sessionId: userRequest.sessionId
          }
        );
        
        // Now get the actual response from the assistant
        let assistantResponse;
        try {
          // If user specified a route preference, use that instead
          const targetRoute = userRequest.routePreference && userRequest.routePreference !== 'Auto' 
            ? userRequest.routePreference 
            : llmResponse.route;
          
          logger.info('Calling assistant service', { targetRoute });
          
          assistantResponse = await assistantService.getAssistantResponse(
            targetRoute,
            userRequest.requestDescription,
            {
              location: userRequest.location,
              sessionId: userRequest.sessionId
            }
          );
          
          // Merge the routing info with the actual assistant response
          llmResponse.response = assistantResponse.response;
          llmResponse.extractedInfo = {
            ...llmResponse.extractedInfo,
            assistantId: assistantResponse.assistantId,
            threadId: assistantResponse.threadId
          };
        } catch (assistantError) {
          logger.warn('Failed to get assistant response, using LLM response', {
            error: assistantError,
            route: llmResponse.route
          });
          // If assistant fails, we still have the LLM response
        }
        
        processedRequest = {
          ...userRequest,
          botRoute: llmResponse.route,
          llmResponse,
          status: 'completed',
          processingTime: Date.now() - startTime
        };

        // Send success notification to Slack if configured
        if (config.slackFallbackEnabled) {
          slackFallback.sendProcessedNotification(processedRequest).catch(err => {
            logger.error('Failed to send Slack notification:', err);
          });
        }

      } catch (llmError) {
        logger.error('LLM processing failed:', llmError);
        
        // Fallback to local routing or Slack
        if (config.slackFallbackEnabled) {
          await slackFallback.sendFallbackNotification(
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
          error: 'LLM processing failed, used fallback routing'
        };
      }

      // Calculate total time if client start time was provided
      const totalProcessingTime = req.body.clientStartTime 
        ? Date.now() - req.body.clientStartTime 
        : processedRequest.processingTime;

      // Update the log with processing result
      await appendToJsonArray('userLogs.json', {
        ...processedRequest,
        processingTime: totalProcessingTime, // Use total time for logs
        serverProcessingTime: processedRequest.processingTime // Keep server time separately
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
            isAssistantResponse: !!processedRequest.llmResponse?.response
          },
          processingTime: processedRequest.processingTime, // Return server processing time
          status: processedRequest.status
        }
      });

    } catch (error) {
      logger.error('Request processing failed:', error);
      
      // Log failed request
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
      
      await appendToJsonArray('userLogs.json', failedRequest);
      
      next(error);
    }
  }
);

// Get LLM status - temporarily remove auth for demo
router.get('/status', /* authenticate, */ async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await readJsonFile<SystemConfig>('systemConfig.json');
    const logs = await readJsonFile<ProcessedRequest[]>('userLogs.json');
    
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
      const config = await readJsonFile<SystemConfig>('systemConfig.json');
      
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

export default router;
