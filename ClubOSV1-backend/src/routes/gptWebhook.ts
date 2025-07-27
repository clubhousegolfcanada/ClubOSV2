// src/routes/gptWebhook.ts

import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import crypto from 'crypto';
import OpenAI from 'openai';
// import { getGPTFunctionHandler } from '../services/gpt/secureGPTFunctionHandler';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Webhook endpoint for OpenAI function calls
router.post('/webhook', 
  // Use JSON parser instead of raw body - OpenAI doesn't send signature headers
  express.json(),
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const webhookId = `webhook-${Date.now()}`;
    
    try {
      // OpenAI Assistants don't send signature headers, so we skip verification
      // In production, you might want to add IP allowlisting or other security measures
      
      // Log the incoming request for debugging
      logger.info('[GPT Webhook] Incoming request', {
        webhookId,
        headers: req.headers,
        body: req.body
      });

      // Parse the request directly from req.body (already parsed by express.json())
      const data = req.body;
      
      logger.info('Webhook received', {
        webhookId,
        type: data.type,
        assistantId: data.assistant?.id,
        threadId: data.thread?.id
      });

      // 3. Handle different webhook types
      if (data.type === 'thread.run.requires_action') {
        const run = data.data;
        const toolCalls = run.required_action?.submit_tool_outputs?.tool_calls || [];
        
        const toolOutputs = [];
        
        for (const toolCall of toolCalls) {
          if (toolCall.type === 'function') {
            try {
              // TODO: Re-enable when GPT function handler is fixed
              const result = { success: false, error: 'GPT functions temporarily disabled' };
              
              toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify(result)
              });
            } catch (error: any) {
              logger.error('Function execution error', {
                webhookId,
                function: toolCall.function.name,
                error: error.message
              });
              
              toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify({
                  success: false,
                  error: error.message
                })
              });
            }
          }
        }

        // 4. Submit tool outputs back to OpenAI
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        await openai.beta.threads.runs.submitToolOutputs(
          data.thread.id,
          run.id,
          { tool_outputs: toolOutputs }
        );

        const duration = Date.now() - startTime;
        logger.info('Webhook processed successfully', {
          webhookId,
          duration,
          toolCallsProcessed: toolOutputs.length
        });

        res.json({ 
          success: true,
          processed: toolOutputs.length,
          duration
        });

      } else {
        // Handle other webhook types if needed
        logger.info('Unhandled webhook type', {
          webhookId,
          type: data.type
        });
        
        res.json({ 
          success: true,
          message: 'Webhook received but no action required'
        });
      }

    } catch (error: any) {
      logger.error('Webhook processing error', {
        webhookId,
        error: error.message,
        stack: error.stack
      });

      // Don't expose internal errors
      res.status(500).json({ 
        error: 'Webhook processing failed',
        webhookId
      });
    }
  }
);

// Health check endpoint for OpenAI to verify webhook is working
router.get('/webhook/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    configured: true // Webhook is always configured now since we don't need a secret
  });
});

// Test endpoint for function execution (development only)
if (process.env.NODE_ENV === 'development') {
  router.post('/test-function',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Rename 'arguments' to 'args' to avoid reserved word conflict
        const { function_name, arguments: args, assistant_id = 'test' } = req.body;

        if (!function_name) {
          throw new AppError('MISSING_PARAMETER', 'function_name is required', 400);
        }

        // TODO: Re-enable when GPT function handler is fixed
        const result = { success: false, error: 'GPT functions temporarily disabled' };

        res.json(result);

      } catch (error) {
        next(error);
      }
    }
  );

  // Get function metrics (development only)
  router.get('/metrics', (req: Request, res: Response) => {
    // TODO: Re-enable when GPT function handler is fixed
    const metrics = {}; // getGPTFunctionHandler().getMetrics();
    const health = { status: 'disabled' }; // getGPTFunctionHandler().getHealthStatus();
    
    res.json({
      health,
      metrics: metrics, // Fixed: no need for Object.fromEntries on empty object
      timestamp: new Date().toISOString()
    });
  });
}

export default router;
