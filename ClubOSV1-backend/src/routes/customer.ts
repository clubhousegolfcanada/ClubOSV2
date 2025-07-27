import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { llmService } from '../services/llmService';
import { assistantService } from '../services/assistantService';
// JSON operations removed - using PostgreSQL
import { UserRequest, ProcessedRequest, SystemConfig, BotRoute } from '../types';
import { validate } from '../middleware/validation';
import { body } from 'express-validator';
import { publicLimiter } from '../middleware/security';

const router = Router();

// Public endpoint for customer-facing ClubOS Boy
router.post('/ask',
  publicLimiter, // More relaxed rate limiting for public kiosk
  validate([
    body('question')
      .trim()
      .notEmpty()
      .withMessage('Please ask a question')
      .isLength({ min: 5, max: 500 })
      .withMessage('Question must be between 5 and 500 characters')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = uuidv4();
    const sessionId = `customer-${Date.now()}`;

    try {
      // Load system config
      // Database-based config - JSON operations removed
      const config = { llmEnabled: true }; // TODO: Get from database
      
      if (!config.llmEnabled) {
        return res.json({
          success: true,
          data: {
            response: "I'm temporarily unavailable. Please ask our staff for assistance.",
            isOffline: true
          }
        });
      }

      // Create customer request
      const customerRequest: UserRequest = {
        id: requestId,
        requestDescription: req.body.question,
        smartAssistEnabled: true,
        timestamp: new Date().toISOString(),
        status: 'processing',
        sessionId,
        userId: 'customer-kiosk',
        location: req.body.location || 'Customer Kiosk'
        // metadata removed - not part of UserRequest interface
      };

      // Log the request - using database now
      // await appendToJsonArray('customerRequests.json', customerRequest);

      try {
        // Process with LLM for routing
        const llmResponse = await llmService.processRequest(
          customerRequest.requestDescription,
          'customer',
          {
            location: customerRequest.location,
            routePreference: 'Auto',
            sessionId: customerRequest.sessionId,
            isCustomerFacing: true
          }
        );
        
        // Get assistant response
        const assistantResponse = await assistantService.getAssistantResponse(
          llmResponse.route,
          customerRequest.requestDescription,
          {
            location: customerRequest.location,
            sessionId: customerRequest.sessionId,
            isCustomerFacing: true
          }
        );
        
        // Merge responses
        llmResponse.response = assistantResponse.response;
        
        const processedRequest: ProcessedRequest = {
          ...customerRequest,
          botRoute: llmResponse.route as BotRoute,
          llmResponse: llmResponse as any, // Type casting for compatibility
          status: 'completed',
          processingTime: Date.now() - startTime
        };

        // Log successful response - using database now
        // await appendToJsonArray('customerRequests.json', processedRequest);

        // Format response for customer display
        res.json({
          success: true,
          data: {
            response: processedRequest.llmResponse?.response || 
                     "I'll help you with that. A staff member will assist you shortly.",
            processingTime: processedRequest.processingTime,
            // category: processedRequest.llmResponse?.category || 'information' // Property doesn't exist
          }
        });

      } catch (llmError) {
        logger.error('Customer request processing failed:', llmError);
        
        // Friendly fallback for customers
        res.json({
          success: true,
          data: {
            response: "I'm having a bit of trouble understanding. Please try asking in a different way, or ask our friendly staff for help!",
            isError: true
          }
        });
      }

    } catch (error) {
      logger.error('Customer endpoint error:', error);
      
      res.json({
        success: true,
        data: {
          response: "I'm having trouble right now. Please ask a staff member for help.",
          isError: true
        }
      });
    }
  }
);

// Get customer request statistics (for staff)
router.get('/stats',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Database-based logs - JSON operations removed
      const logs: ProcessedRequest[] = []; // TODO: Get from database
      
      // Calculate stats from last 7 days
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentLogs = logs.filter(log => 
        new Date(log.timestamp) > oneWeekAgo
      );
      
      // Get most common questions
      const questionFrequency: Record<string, number> = {};
      recentLogs.forEach(log => {
        const normalized = log.requestDescription.toLowerCase().trim();
        questionFrequency[normalized] = (questionFrequency[normalized] || 0) + 1;
      });
      
      const topQuestions = Object.entries(questionFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([question, count]) => ({ question, count }));
      
      res.json({
        success: true,
        data: {
          totalRequests: recentLogs.length,
          averagePerDay: recentLogs.length / 7,
          topQuestions,
          routeDistribution: recentLogs.reduce((acc, log) => {
            acc[log.botRoute] = (acc[log.botRoute] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
