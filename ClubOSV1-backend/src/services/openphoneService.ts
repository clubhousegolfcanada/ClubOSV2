import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

interface OpenPhoneConfig {
  apiKey: string;
  apiUrl?: string;
}

interface OpenPhoneConversation {
  id: string;
  phoneNumber: string;
  contact?: {
    id: string;
    name: string;
    phoneNumber: string;
  };
  messages: Array<{
    id: string;
    text: string;
    direction: 'inbound' | 'outbound';
    createdAt: string;
    from: string;
    to: string;
  }>;
  lastMessageAt: string;
  createdAt: string;
}

export class OpenPhoneService {
  private client: AxiosInstance;
  private isConfigured: boolean;

  constructor(config?: OpenPhoneConfig) {
    const apiKey = config?.apiKey || process.env.OPENPHONE_API_KEY;
    const apiUrl = config?.apiUrl || process.env.OPENPHONE_API_URL || 'https://api.openphone.com/v1';

    this.isConfigured = !!apiKey;

    if (this.isConfigured) {
      this.client = axios.create({
        baseURL: apiUrl,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info('OpenPhone service initialized');
    } else {
      logger.warn('OpenPhone API key not configured');
      this.client = axios.create(); // Dummy client
    }
  }

  /**
   * Fetch recent conversations from OpenPhone
   */
  async fetchRecentConversations(limit: number = 50): Promise<OpenPhoneConversation[]> {
    if (!this.isConfigured) {
      logger.warn('OpenPhone not configured, cannot fetch conversations');
      return [];
    }

    try {
      logger.info(`Fetching ${limit} recent conversations from OpenPhone`);
      
      const response = await this.client.get('/conversations', {
        params: {
          limit,
          sort: 'lastMessageAt:desc'
        }
      });

      const conversations = response.data.data || [];
      logger.info(`Fetched ${conversations.length} conversations from OpenPhone`);

      return conversations;
    } catch (error: any) {
      logger.error('Failed to fetch OpenPhone conversations:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Fetch messages for a specific conversation
   */
  async fetchConversationMessages(conversationId: string): Promise<any[]> {
    if (!this.isConfigured) {
      return [];
    }

    try {
      const response = await this.client.get(`/conversations/${conversationId}/messages`, {
        params: {
          limit: 100,
          sort: 'createdAt:asc'
        }
      });

      return response.data.data || [];
    } catch (error: any) {
      logger.error(`Failed to fetch messages for conversation ${conversationId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Import historical conversations into our database
   */
  async importHistoricalConversations(daysBack: number = 30): Promise<{
    imported: number;
    skipped: number;
    errors: number;
  }> {
    if (!this.isConfigured || !db.initialized) {
      logger.warn('Cannot import conversations - OpenPhone or database not configured');
      return { imported: 0, skipped: 0, errors: 0 };
    }

    const stats = {
      imported: 0,
      skipped: 0,
      errors: 0
    };

    try {
      // Calculate date range
      const since = new Date();
      since.setDate(since.getDate() - daysBack);

      logger.info(`Importing OpenPhone conversations from last ${daysBack} days`);

      // Fetch conversations
      const conversations = await this.fetchRecentConversations(100);

      for (const conversation of conversations) {
        try {
          // Check if conversation is within date range
          const conversationDate = new Date(conversation.lastMessageAt || conversation.createdAt);
          if (conversationDate < since) {
            continue;
          }

          // Check if already imported
          const existing = await db.query(
            `SELECT id FROM openphone_conversations WHERE metadata->>'openPhoneId' = $1`,
            [conversation.id]
          );

          if (existing.rows.length > 0) {
            stats.skipped++;
            continue;
          }

          // Fetch full message history
          const messages = await this.fetchConversationMessages(conversation.id);

          // Store in database
          await db.query(`
            INSERT INTO openphone_conversations 
            (phone_number, customer_name, employee_name, messages, metadata)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            conversation.phoneNumber || conversation.contact?.phoneNumber || 'Unknown',
            conversation.contact?.name || 'Unknown Customer',
            'Historical Import',
            JSON.stringify(messages),
            {
              openPhoneId: conversation.id,
              imported: true,
              importedAt: new Date().toISOString(),
              lastMessageAt: conversation.lastMessageAt
            }
          ]);

          stats.imported++;
          logger.info(`Imported conversation ${conversation.id}`);

          // Rate limiting - be nice to their API
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
          logger.error(`Failed to import conversation ${conversation.id}:`, error);
          stats.errors++;
        }
      }

      logger.info('Historical import complete:', stats);
      return stats;

    } catch (error) {
      logger.error('Failed to import historical conversations:', error);
      throw error;
    }
  }

  /**
   * Send an SMS message via OpenPhone
   */
  async sendMessage(to: string, from: string, text: string): Promise<any> {
    if (!this.isConfigured) {
      throw new Error('OpenPhone not configured');
    }

    try {
      logger.info('Sending OpenPhone message', { to, from, text: text.substring(0, 50) });
      
      const response = await this.client.post('/messages', {
        to,
        from,
        text
      });

      // Store message in database
      await this.storeOutboundMessage({
        id: response.data.id,
        to,
        from,
        text,
        status: 'sent',
        createdAt: new Date().toISOString()
      });

      return response.data;
    } catch (error: any) {
      logger.error('Failed to send OpenPhone message:', error.response?.data || error.message);
      
      // Store failed message
      await this.storeOutboundMessage({
        id: `failed_${Date.now()}`,
        to,
        from,
        text,
        status: 'failed',
        error: error.message,
        createdAt: new Date().toISOString()
      });
      
      throw error;
    }
  }

  private async storeOutboundMessage(message: any) {
    const phoneNumber = message.to;
    
    // Update conversation with new message
    const existingConv = await db.query(
      'SELECT id, messages FROM openphone_conversations WHERE phone_number = $1',
      [phoneNumber]
    );
    
    if (existingConv.rows.length > 0) {
      const messages = [...(existingConv.rows[0].messages || []), message];
      await db.query(
        'UPDATE openphone_conversations SET messages = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(messages), existingConv.rows[0].id]
      );
    } else {
      // Create new conversation with phone number as customer name
      await db.query(
        `INSERT INTO openphone_conversations 
         (phone_number, customer_name, messages, created_at, updated_at) 
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [phoneNumber, phoneNumber, JSON.stringify([message])]
      );
    }
  }

  /**
   * Get contact details by phone number
   */
  async getContactByPhone(phoneNumber: string): Promise<any> {
    if (!this.isConfigured) {
      return null;
    }

    try {
      const response = await this.client.get('/contacts', {
        params: {
          phoneNumber: phoneNumber,
          limit: 1
        }
      });

      if (response.data.data && response.data.data.length > 0) {
        return response.data.data[0];
      }
      return null;
    } catch (error: any) {
      logger.error('Failed to fetch contact:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Get phone numbers associated with the account
   */
  async getPhoneNumbers(): Promise<any[]> {
    if (!this.isConfigured) {
      return [];
    }

    try {
      const response = await this.client.get('/phone-numbers');
      return response.data.data || [];
    } catch (error: any) {
      logger.error('Failed to fetch phone numbers:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      await this.getPhoneNumbers();
      logger.info('OpenPhone API connection successful');
      return true;
    } catch (error) {
      logger.error('OpenPhone API connection failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const openPhoneService = new OpenPhoneService();