import { IncomingWebhook, IncomingWebhookResult } from '@slack/webhook';
import { logger } from '../utils/logger';
import { SlackMessage, UserRequest, ProcessedRequest, SlackMessageRecord } from '../types';
import { query } from '../utils/db';

export class SlackFallbackService {
  private webhook: IncomingWebhook;
  private enabled: boolean;

  constructor() {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL || '';
    this.enabled = Boolean(webhookUrl);
    
    if (this.enabled) {
      this.webhook = new IncomingWebhook(webhookUrl);
      logger.info('Slack fallback service initialized');
    } else {
      logger.warn('Slack webhook URL not configured, fallback disabled');
    }
  }

  async sendMessage(message: SlackMessage): Promise<IncomingWebhookResult> {
    if (!this.enabled) {
      throw new Error('Slack fallback is not configured');
    }

    try {
      const result = await this.webhook.send(message);
      logger.info('Slack message sent successfully');
      return result;
    } catch (error) {
      logger.error('Failed to send Slack message:', error);
      throw error;
    }
  }

  // Helper to extract thread timestamp from Slack webhook response
  private extractThreadTs(response: any): string | undefined {
    // Slack webhook response doesn't directly provide thread_ts
    // We'll generate a unique identifier that can be used for tracking
    // In a real implementation with Slack API, we'd get the actual thread_ts
    return `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Save Slack message record to database
  private async saveSlackMessage(
    userId: string | undefined,
    requestId: string | undefined,
    message: SlackMessage,
    threadTs: string,
    requestDescription?: string,
    location?: string,
    route?: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO slack_messages 
        (user_id, request_id, slack_thread_ts, slack_channel, original_message, 
         request_description, location, route)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          requestId,
          threadTs,
          message.channel || process.env.SLACK_CHANNEL || '#clubos-requests',
          JSON.stringify(message),
          requestDescription,
          location,
          route
        ]
      );
      logger.info('Slack message record saved', { threadTs, requestId });
    } catch (error) {
      logger.error('Failed to save Slack message record:', error);
      // Don't throw - we don't want to fail the entire operation
    }
  }

  async sendFallbackNotification(request: UserRequest & { user?: any }, error: string): Promise<string | undefined> {
    // Build user information string
    let userInfo = 'Unknown User';
    if (request.user) {
      userInfo = request.user.name;
      if (request.user.email) {
        userInfo += ` (${request.user.email})`;
      }
      if (request.user.phone) {
        userInfo += ` | Phone: ${request.user.phone}`;
      }
    }

    const message: SlackMessage = {
      channel: process.env.SLACK_CHANNEL || '#clubos-requests',
      username: 'ClubOSV1 Bot',
      text: 'LLM Processing Failed - Manual Review Required',
      attachments: [
        {
          color: 'warning',
          title: 'Request Details',
          text: request.requestDescription,
          fields: [
            {
              title: 'From',
              value: userInfo,
              short: false
            },
            {
              title: 'Location',
              value: request.location || 'Not specified',
              short: true
            },
            {
              title: 'Request ID',
              value: request.id,
              short: true
            },
            {
              title: 'Error',
              value: error,
              short: false
            }
          ],
          footer: 'ClubOSV1 Fallback System',
          ts: Date.now() / 1000
        }
      ]
    };

    const result = await this.sendMessage(message);
    const threadTs = this.extractThreadTs(result);
    
    // Save to database
    if (threadTs) {
      await this.saveSlackMessage(
        request.userId,
        request.id,
        message,
        threadTs,
        request.requestDescription,
        request.location,
        request.routePreference
      );
    }
    
    return threadTs;
  }

  async sendDirectMessage(request: UserRequest & { user?: any }): Promise<string | undefined> {
    // Build user information string
    let userInfo = 'Unknown User';
    if (request.user) {
      userInfo = request.user.name;
      if (request.user.email) {
        userInfo += ` (${request.user.email})`;
      }
      if (request.user.phone) {
        userInfo += ` | Phone: ${request.user.phone}`;
      }
    }

    const message: SlackMessage = {
      channel: process.env.SLACK_CHANNEL || '#clubos-requests',
      username: 'ClubOSV1 Bot',
      text: 'New Request (Direct to Slack)',
      attachments: [
        {
          color: 'good',
          title: 'Request Details',
          text: request.requestDescription,
          fields: [
            {
              title: 'From',
              value: userInfo,
              short: false
            },
            {
              title: 'Location',
              value: request.location || 'Not specified',
              short: true
            },
            {
              title: 'Request ID',
              value: request.id,
              short: true
            },
            {
              title: 'Timestamp',
              value: new Date(request.timestamp).toLocaleString(),
              short: true
            },
            {
              title: 'Role',
              value: request.user?.role ? request.user.role.charAt(0).toUpperCase() + request.user.role.slice(1) : 'N/A',
              short: true
            }
          ],
          footer: 'ClubOSV1 Direct Message',
          ts: Date.now() / 1000
        }
      ]
    };

    const result = await this.sendMessage(message);
    const threadTs = this.extractThreadTs(result);
    
    // Save to database
    if (threadTs) {
      await this.saveSlackMessage(
        request.userId,
        request.id,
        message,
        threadTs,
        request.requestDescription,
        request.location,
        request.routePreference
      );
    }
    
    return threadTs;
  }

  async sendProcessedNotification(processed: ProcessedRequest): Promise<string | undefined> {
    const message: SlackMessage = {
      channel: process.env.SLACK_CHANNEL || '#clubos-requests',
      username: 'ClubOSV1 Bot',
      text: 'Request Processed Successfully',
      attachments: [
        {
          color: 'good',
          title: 'Processing Summary',
          text: processed.llmResponse?.response || 'Request processed',
          fields: [
            {
              title: 'Bot Route',
              value: processed.botRoute,
              short: true
            },
            {
              title: 'Confidence',
              value: `${(processed.llmResponse?.confidence || 0) * 100}%`,
              short: true
            },
            {
              title: 'Processing Time',
              value: `${processed.processingTime}ms`,
              short: true
            },
            {
              title: 'Status',
              value: processed.status,
              short: true
            }
          ],
          footer: 'ClubOSV1 LLM Processing',
          ts: Date.now() / 1000
        }
      ]
    };

    const result = await this.sendMessage(message);
    const threadTs = this.extractThreadTs(result);
    
    // Save to database if this is related to a specific request
    if (threadTs && processed.id) {
      await this.saveSlackMessage(
        processed.userId,
        processed.id,
        message,
        threadTs,
        processed.requestDescription,
        processed.location,
        processed.botRoute
      );
    }
    
    return threadTs;
  }

  async sendTicketNotification(ticket: any): Promise<string | undefined> {
    // Build creator information string
    let creatorInfo = ticket.createdBy.name || ticket.createdBy.email;
    if (ticket.createdBy.email && ticket.createdBy.name) {
      creatorInfo = `${ticket.createdBy.name} (${ticket.createdBy.email})`;
    }
    if (ticket.createdBy.phone) {
      creatorInfo += ` | Phone: ${ticket.createdBy.phone}`;
    }

    // Add @mention for facilities tickets
    let notificationText = `New ${ticket.priority.toUpperCase()} Priority Ticket Created`;
    if (ticket.category === 'facilities' && process.env.FACILITIES_SLACK_USER) {
      notificationText = `<@${process.env.FACILITIES_SLACK_USER}> - ${notificationText} (Facilities)`;
    }

    // Use facilities channel if specified and ticket is facilities
    const channel = (ticket.category === 'facilities' && process.env.FACILITIES_SLACK_CHANNEL) 
      ? process.env.FACILITIES_SLACK_CHANNEL 
      : (process.env.SLACK_CHANNEL || '#clubos-requests');

    const message: SlackMessage = {
      channel,
      username: 'ClubOSV1 Bot',
      text: notificationText,
      attachments: [
        {
          color: ticket.priority === 'urgent' ? 'danger' : ticket.priority === 'high' ? 'warning' : 'good',
          title: `${ticket.title}`,
          text: ticket.description,
          fields: [
            {
              title: 'Category',
              value: `${ticket.category.charAt(0).toUpperCase() + ticket.category.slice(1)}`,
              short: true
            },
            {
              title: 'Priority',
              value: ticket.priority.toUpperCase(),
              short: true
            },
            {
              title: 'Location',
              value: ticket.location || 'Not specified',
              short: true
            },
            {
              title: 'Created By',
              value: creatorInfo,
              short: false
            },
            {
              title: 'Ticket ID',
              value: ticket.id,
              short: true
            },
            {
              title: 'Status',
              value: ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1),
              short: true
            }
          ],
          footer: 'ClubOSV1 Ticket System',
          ts: Date.now() / 1000
        }
      ]
    };

    const result = await this.sendMessage(message);
    const threadTs = this.extractThreadTs(result);
    
    // Save to database
    if (threadTs) {
      await this.saveSlackMessage(
        ticket.createdBy.id,
        ticket.id,
        message,
        threadTs,
        ticket.description,
        ticket.location,
        'Ticket'
      );
    }
    
    return threadTs;
  }

  async sendUnhelpfulFeedbackNotification(feedback: any): Promise<string | undefined> {
    // Build user information string
    let userInfo = feedback.userEmail || 'Unknown User';
    
    const message: SlackMessage = {
      channel: process.env.SLACK_CHANNEL || '#clubos-requests',
      username: 'ClubOSV1 Bot',
      text: 'UNHELPFUL RESPONSE ALERT',
      attachments: [
        {
          color: 'danger', // Red color for unhelpful feedback
          title: 'User Marked Response as Not Helpful',
          text: `Request: "${feedback.requestDescription}"`,
          fields: [
            {
              title: 'AI Response Given',
              value: feedback.response,
              short: false
            },
            {
              title: 'Route Used',
              value: feedback.route,
              short: true
            },
            {
              title: 'Confidence',
              value: `${Math.round((feedback.confidence || 0) * 100)}%`,
              short: true
            },
            {
              title: 'Location',
              value: feedback.location || 'Not specified',
              short: true
            },
            {
              title: 'Reported By',
              value: userInfo,
              short: true
            },
            {
              title: 'Timestamp',
              value: new Date(feedback.timestamp).toLocaleString(),
              short: true
            },
            {
              title: 'Feedback ID',
              value: feedback.id,
              short: true
            }
          ],
          footer: 'ClubOSV1 Feedback System - Action Required',
          ts: Date.now() / 1000
        }
      ]
    };

    const result = await this.sendMessage(message);
    const threadTs = this.extractThreadTs(result);
    
    // Save to database
    if (threadTs) {
      await this.saveSlackMessage(
        feedback.userId,
        feedback.id,
        message,
        threadTs,
        feedback.requestDescription,
        feedback.location,
        feedback.route
      );
    }
    
    return threadTs;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Get Slack message by thread timestamp
  async getSlackMessage(threadTs: string): Promise<SlackMessageRecord | null> {
    try {
      const result = await query(
        'SELECT * FROM slack_messages WHERE slack_thread_ts = $1',
        [threadTs]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get Slack message:', error);
      return null;
    }
  }
}

export const slackFallback = new SlackFallbackService();