import { IncomingWebhook } from '@slack/webhook';
import { logger } from '../utils/logger';
import { SlackMessage, UserRequest, ProcessedRequest } from '../types';

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

  async sendMessage(message: SlackMessage): Promise<void> {
    if (!this.enabled) {
      throw new Error('Slack fallback is not configured');
    }

    try {
      await this.webhook.send(message);
      logger.info('Slack message sent successfully');
    } catch (error) {
      logger.error('Failed to send Slack message:', error);
      throw error;
    }
  }

  async sendFallbackNotification(request: UserRequest & { user?: any }, error: string): Promise<void> {
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

    await this.sendMessage(message);
  }

  async sendDirectMessage(request: UserRequest & { user?: any }): Promise<void> {
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

    await this.sendMessage(message);
  }

  async sendProcessedNotification(processed: ProcessedRequest): Promise<void> {
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

    await this.sendMessage(message);
  }

  async sendTicketNotification(ticket: any): Promise<void> {
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

    await this.sendMessage(message);
  }

  async sendUnhelpfulFeedbackNotification(feedback: any): Promise<void> {
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

    await this.sendMessage(message);
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export const slackFallback = new SlackFallbackService();
