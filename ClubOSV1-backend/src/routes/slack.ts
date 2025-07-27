import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { validate, requestValidation } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { slackFallback } from '../services/slackFallback';
import axios from 'axios';
// JSON operations removed - using PostgreSQL
import { UserRequest, SystemConfig } from '../types';
import { db } from '../utils/database';
import { AppError } from '../middleware/errorHandler';
import { 
  handleSlackUrlVerification, 
  applySlackSecurity 
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
      // Check if Slack is configured from database
      const configResult = await db.query(
        'SELECT value FROM system_config WHERE key = $1',
        ['slack_notifications']
      );
      const slackConfig = configResult.rows[0]?.value || { enabled: true };
      
      if (!slackConfig.enabled) {
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
        completeUser = await db.findUserById(req.user.id);
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

      // Log the request to database
      await db.createCustomerInteraction({
        user_id: req.user?.id,
        user_email: req.user?.email,
        request_text: userRequest.requestDescription,
        response_text: 'Sent to Slack',
        route: 'Slack',
        confidence: 1.0,
        session_id: sessionId
      });

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

        // Request completed - stored in database via customer_interactions

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

        // Request failed - logged in database via customer_interactions

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

// Slack Events API endpoint (Phase 2: Reply tracking)
router.post('/events',
  handleSlackUrlVerification, // Handle URL verification first
  applySlackSecurity, // Then verify signature
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Slack events API received (verified)', {
        type: req.body.type,
        event: req.body.event?.type
      });

      // Handle different Slack event types
      const { type, event } = req.body;

      // URL verification challenge
      if (type === 'url_verification') {
        return res.json({ challenge: req.body.challenge });
      }

      // Event callback
      if (type === 'event_callback') {
        // Log Slack event for debugging
        logger.info('Slack event received', {
          eventType: event?.type,
          event: event,
          verified: true
        });

        // Handle different event types
        switch (event?.type) {
          case 'message':
            // Only process threaded replies (not direct messages)
            if (event.thread_ts && !event.bot_id) {
              logger.info('Slack thread reply received', { 
                user: event.user,
                text: event.text,
                channel: event.channel,
                thread_ts: event.thread_ts
              });
              
              await storeSlackReply(event);
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
      logger.error('Slack events API error:', error);
      // Slack expects a 200 response even on errors
      res.status(200).json({ ok: false, error: 'Internal error' });
    }
  }
);

// Legacy webhook endpoint (keeping for compatibility)
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
        // Log Slack event for debugging
        logger.info('Slack event received', {
          eventType: event?.type,
          event: event,
          verified: true
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
    // Get system config from database
    const configResult = await db.query(
      'SELECT value FROM system_config WHERE key = $1',
      ['slack_notifications']
    );
    const slackConfig = configResult.rows[0]?.value || { enabled: true };
    
    // Get stats from customer interactions
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const statsResult = await db.query(
      `SELECT COUNT(*) as total,
              COUNT(CASE WHEN created_at > $1 THEN 1 END) as recent,
              COUNT(CASE WHEN created_at > $1 AND route = 'Slack' THEN 1 END) as slack_messages
       FROM customer_interactions`,
      [last24Hours]
    );
    const stats = statsResult.rows[0];

    res.json({
      success: true,
      data: {
        enabled: slackConfig.enabled,
        webhookConfigured: Boolean(process.env.SLACK_WEBHOOK_URL),
        signingSecretConfigured: Boolean(process.env.SLACK_SIGNING_SECRET),
        channel: process.env.SLACK_CHANNEL || '#clubos-requests',
        stats: {
          totalMessages: parseInt(stats.slack_messages) || 0,
          last24Hours: parseInt(stats.recent) || 0,
          successfulMessages: 0, // Would need additional tracking
          failedMessages: 0 // Would need additional tracking
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get Slack replies for a specific thread using Slack API
router.get('/thread-replies/:threadTs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { threadTs } = req.params;
    const botToken = process.env.SLACK_BOT_TOKEN;
    
    if (!botToken) {
      return res.status(500).json({
        success: false,
        error: 'Slack bot token not configured'
      });
    }
    
    // Call Slack API directly to get thread replies
    const slackResponse = await axios.get('https://slack.com/api/conversations.replies', {
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json'
      },
      params: {
        channel: process.env.SLACK_CHANNEL_ID || process.env.SLACK_CHANNEL || '#clubos-assistants',
        ts: threadTs
      }
    });
    
    if (!slackResponse.data.ok) {
      throw new Error(`Slack API error: ${slackResponse.data.error}`);
    }
    
    // Skip the first message (original) and return only replies
    const replies = slackResponse.data.messages.slice(1).map((msg: any) => ({
      user: msg.user,
      text: msg.text,
      ts: msg.ts,
      timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
      user_name: msg.user // We'll enhance this with user info later if needed
    }));
    
    res.json({
      success: true,
      data: {
        threadTs,
        replies,
        count: replies.length
      }
    });
  } catch (error) {
    logger.error('Failed to fetch thread replies:', error);
    next(error);
  }
});

// Get all recent Slack conversations with replies
router.get('/conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    
    // Get conversations with reply counts
    const conversationsResult = await db.query(
      `SELECT 
        sm.*,
        COUNT(sr.id) as reply_count,
        MAX(sr.timestamp) as last_reply_at
       FROM slack_messages sm
       LEFT JOIN slack_replies sr ON sm.slack_thread_ts = sr.thread_ts
       GROUP BY sm.id
       ORDER BY COALESCE(MAX(sr.timestamp), sm.created_at) DESC
       LIMIT $1`,
      [limit]
    );
    
    res.json({
      success: true,
      data: {
        conversations: conversationsResult.rows,
        count: conversationsResult.rows.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Test Slack connection
router.post('/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get system config from database
    const configResult = await db.query(
      'SELECT value FROM system_config WHERE key = $1',
      ['slack_notifications']
    );
    const slackConfig = configResult.rows[0]?.value || { enabled: true };
    
    if (!slackConfig.enabled) {
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
          ts: Math.floor(Date.now() / 1000).toString()
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
async function storeSlackReply(event: any) {
  try {
    // Store the Slack reply in the database
    await db.query(
      `INSERT INTO slack_replies 
       (thread_ts, user_name, user_id, text, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        event.thread_ts,
        event.user_profile?.display_name || event.user_profile?.real_name || 'Unknown User',
        event.user,
        event.text,
        new Date(parseFloat(event.ts) * 1000) // Convert Slack timestamp to Date
      ]
    );
    
    logger.info('Slack reply stored successfully', { 
      thread_ts: event.thread_ts,
      user: event.user,
      text: event.text.substring(0, 50) + '...'
    });
    
    // TODO: Trigger real-time notification to frontend (WebSocket/SSE)
    
  } catch (error) {
    logger.error('Failed to store Slack reply:', error);
    throw error;
  }
}

async function processSlackMessage(event: any) {
  // Process incoming Slack messages (legacy handler)
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
