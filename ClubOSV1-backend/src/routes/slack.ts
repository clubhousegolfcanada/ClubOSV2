import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { validate, requestValidation } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { slackFallback } from '../services/slackFallback';
// JSON operations removed - using PostgreSQL
import { UserRequest, SystemConfig } from '../types';
import { AppError } from '../middleware/errorHandler';
import { 
  handleSlackUrlVerification, 
  applySlackSecurity,
  captureRawBody 
} from '../middleware/slackSecurity';

const router = Router();

// Send message directly to Slack (internal API)
router.post('/message', 
  authenticate, // Re-enabled - Frontend auth fixed
  validate(requestValidation.slackMessage),
  async (req: Request, res: Response, next: NextFunction) => {
    const requestId = uuidv4();
    const sessionId = (req as any).requestId || uuidv4();

    try {
      // Check if Slack is configured
      const config = await readJsonFile<SystemConfig>('systemConfig.json');
      if (!config.slackFallbackEnabled) {
        throw new AppError('SLACK_DISABLED', 'Slack integration is currently disabled', 503);
      }

      // Create user request object with user info
      // Fetch complete user data if authenticated
      let completeUser = null;
      
      // Debug logging
      logger.info('Slack message - User from request:', {
        userId: req.user?.id,
        userEmail: req.user?.email,
        userName: req.user?.name,
        userRole: req.user?.role
      });
      
      if (req.user) {
        const users = await readJsonFile<any[]>('users.json');
        completeUser = users.find(u => u.id === req.user!.id);
        // Remove password from user data
        if (completeUser) {
          const { password, ...userWithoutPassword } = completeUser;
          completeUser = userWithoutPassword;
        }
      }
      
      const userRequest: UserRequest & { user?: any } = {
        id: requestId,
        requestDescription: req.body.requestDescription,
        location: req.body.location,
        smartAssistEnabled: false,
        timestamp: new Date().toISOString(),
        status: 'pending',
        sessionId,
        user: completeUser || req.user // Use complete user data if available
      };

      // Log the request
      await appendToJsonArray('userLogs.json', userRequest);

      try {
        // Send to Slack
        await slackFallback.sendDirectMessage(userRequest);

        // Update request status
        const completedRequest = {
          ...userRequest,
          status: 'completed' as const,
          slackMessageSent: true,
          completedAt: new Date().toISOString()
        };

        await appendToJsonArray('userLogs.json', completedRequest);

        logger.info('Slack message sent successfully', { requestId });

        res.json({
          success: true,
          data: {
            requestId,
            message: 'Request sent to Slack successfully',
            timestamp: userRequest.timestamp
          }
        });

      } catch (slackError) {
        logger.error('Failed to send Slack message:', slackError);
        
        // Update request status to failed
        const failedRequest = {
          ...userRequest,
          status: 'failed' as const,
          error: slackError instanceof Error ? slackError.message : 'Unknown error',
          failedAt: new Date().toISOString()
        };

        await appendToJsonArray('userLogs.json', failedRequest);

        throw new AppError(
          'SLACK_SEND_FAILED',
          'Failed to send message to Slack',
          503,
          slackError
        );
      }

    } catch (error) {
      next(error);
    }
  }
);

// Slack webhook endpoint (for receiving messages from Slack)
// Apply signature verification
router.post('/webhook',
  handleSlackUrlVerification, // Handle URL verification first
  applySlackSecurity, // Then verify signature
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Slack webhook received (verified)', {
        type: req.body.type,
        event: req.body.event?.type
      });

      // Handle different Slack event types
      const { type, event } = req.body;

      // Event callback
      if (type === 'event_callback') {
        // Log the event
        await appendToJsonArray('logs/slack-events.json', {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          eventType: event?.type,
          event: event,
          verified: true,
          raw: req.body
        });

        // Handle different event types
        switch (event?.type) {
          case 'message':
            // Handle incoming messages
            logger.info('Slack message received', { 
              user: event.user,
              text: event.text,
              channel: event.channel
            });
            
            // Process the message if it's not from a bot
            if (!event.bot_id) {
              await processSlackMessage(event);
            }
            break;
          
          case 'app_mention':
            // Handle mentions
            logger.info('App mentioned in Slack', {
              user: event.user,
              text: event.text,
              channel: event.channel
            });
            
            await processSlackMention(event);
            break;

          default:
            logger.info('Unhandled Slack event type', { type: event?.type });
        }
      }

      // Default response
      res.json({ ok: true });

    } catch (error) {
      logger.error('Slack webhook error:', error);
      // Slack expects a 200 response even on errors
      res.status(200).json({ ok: false, error: 'Internal error' });
    }
  }
);

// Slack slash commands endpoint
router.post('/commands',
  applySlackSecurity, // Verify signature
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { command, text, user_id, channel_id, response_url } = req.body;
      
      logger.info('Slack slash command received', {
        command,
        text,
        user_id,
        channel_id
      });

      // Handle different commands
      switch (command) {
        case '/clubos':
          // Process the command
          const requestId = uuidv4();
          const userRequest: UserRequest = {
            id: requestId,
            requestDescription: text,
            smartAssistEnabled: true,
            timestamp: new Date().toISOString(),
            status: 'processing',
            sessionId: `slack-${user_id}`,
            userId: user_id
          };

          // Process asynchronously
          processSlackCommand(userRequest, response_url);

          // Immediate response
          return res.json({
            response_type: 'ephemeral',
            text: `Processing your request: "${text}"\nRequest ID: ${requestId}`
          });

        case '/booking':
          return res.json({
            response_type: 'ephemeral',
            text: 'Please use the ClubOSV1 web interface for bookings: ' + 
                  (process.env.FRONTEND_URL || 'http://localhost:3000')
          });

        case '/help':
          return res.json({
            response_type: 'ephemeral',
            text: getHelpText()
          });

        default:
          return res.json({
            response_type: 'ephemeral',
            text: `Unknown command: ${command}`
          });
      }
    } catch (error) {
      logger.error('Slack command error:', error);
      res.json({
        response_type: 'ephemeral',
        text: 'An error occurred processing your command. Please try again.'
      });
    }
  }
);

// Slack interactive components endpoint
router.post('/interactive',
  applySlackSecurity, // Verify signature
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = JSON.parse(req.body.payload);
      
      logger.info('Slack interactive component triggered', {
        type: payload.type,
        user: payload.user,
        actions: payload.actions
      });

      // Handle different interaction types
      switch (payload.type) {
        case 'block_actions':
          await handleBlockActions(payload);
          break;
        
        case 'view_submission':
          await handleViewSubmission(payload);
          break;
        
        case 'shortcut':
          await handleShortcut(payload);
          break;
      }

      return res.json({
        text: 'Action received and processed'
      });
    } catch (error) {
      logger.error('Slack interactive error:', error);
      res.json({
        text: 'Error processing interaction'
      });
    }
  }
);

// Get Slack integration status
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await readJsonFile<SystemConfig>('systemConfig.json');
    const logs = await readJsonFile<any[]>('userLogs.json');
    
    // Get stats for Slack messages
    const slackLogs = logs.filter(log => !log.smartAssistEnabled);
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogs = slackLogs.filter(log => new Date(log.timestamp) > last24Hours);

    res.json({
      success: true,
      data: {
        enabled: config.slackFallbackEnabled,
        webhookConfigured: Boolean(process.env.SLACK_WEBHOOK_URL),
        signingSecretConfigured: Boolean(process.env.SLACK_SIGNING_SECRET),
        channel: process.env.SLACK_CHANNEL || '#clubos-requests',
        stats: {
          totalMessages: slackLogs.length,
          last24Hours: recentLogs.length,
          successfulMessages: recentLogs.filter(log => log.status === 'completed').length,
          failedMessages: recentLogs.filter(log => log.status === 'failed').length
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Test Slack connection
router.post('/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await readJsonFile<SystemConfig>('systemConfig.json');
    
    if (!config.slackFallbackEnabled) {
      throw new AppError('SLACK_DISABLED', 'Slack integration is currently disabled', 503);
    }

    const testMessage = {
      channel: process.env.SLACK_CHANNEL || '#clubos-requests',
      username: 'ClubOSV1 Bot',
      icon_emoji: ':test_tube:',
      text: 'Test message from ClubOSV1',
      attachments: [
        {
          color: 'good',
          title: 'Connection Test',
          text: 'This is a test message to verify Slack integration',
          fields: [
            {
              title: 'Timestamp',
              value: new Date().toISOString(),
              short: true
            },
            {
              title: 'Environment',
              value: process.env.NODE_ENV || 'development',
              short: true
            },
            {
              title: 'Signature Verification',
              value: process.env.SLACK_SIGNING_SECRET ? 'Configured' : 'Not configured',
              short: true
            }
          ],
          footer: 'ClubOSV1 Test',
          ts: Date.now() / 1000
        }
      ]
    };

    await slackFallback.sendMessage(testMessage);

    res.json({
      success: true,
      message: 'Test message sent successfully',
      channel: testMessage.channel
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions
async function processSlackMessage(event: any) {
  // Process incoming Slack messages
  logger.info('Processing Slack message', { text: event.text });
  // Add your message processing logic here
}

async function processSlackMention(event: any) {
  // Process app mentions
  logger.info('Processing Slack mention', { text: event.text });
  // Add your mention processing logic here
}

async function processSlackCommand(request: UserRequest, responseUrl: string) {
  // Process slash commands asynchronously
  try {
    // You can integrate with your LLM service here
    logger.info('Processing Slack command', { requestId: request.id });
    
    // Send delayed response to Slack
    // This would be implemented with axios to post to responseUrl
  } catch (error) {
    logger.error('Failed to process Slack command', error);
  }
}

async function handleBlockActions(payload: any) {
  // Handle interactive block actions
  logger.info('Handling block actions', { actions: payload.actions });
}

async function handleViewSubmission(payload: any) {
  // Handle modal/view submissions
  logger.info('Handling view submission', { view: payload.view });
}

async function handleShortcut(payload: any) {
  // Handle shortcuts
  logger.info('Handling shortcut', { shortcut: payload.shortcut });
}

function getHelpText(): string {
  return `*ClubOSV1 Slack Commands*

Available commands:
• \`/clubos [request]\` - Submit a request to ClubOSV1
• \`/booking\` - Get link to booking interface
• \`/help\` - Show this help message

Examples:
• \`/clubos The simulator in bay 3 is not turning on\`
• \`/clubos Need to book a tournament for next Saturday\`

For more information, visit: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`;
}

export default router;
