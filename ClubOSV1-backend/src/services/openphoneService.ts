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
    const apiUrl = config?.apiUrl || process.env.OPENPHONE_API_URL || 'https://api.openphone.com/v3';

    this.isConfigured = !!apiKey;

    if (this.isConfigured) {
      this.client = axios.create({
        baseURL: apiUrl,
        headers: {
          'Authorization': apiKey, // OpenPhone expects the API key directly, not with Bearer prefix
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

          // Extract phone number from conversation or first message
          let phoneNumber = conversation.phoneNumber || conversation.contact?.phoneNumber;
          
          // If no phone number in conversation, try to extract from messages
          if (!phoneNumber && messages.length > 0) {
            const firstMessage = messages[0];
            if (firstMessage.direction === 'incoming' || firstMessage.direction === 'inbound') {
              phoneNumber = firstMessage.from;
            } else {
              phoneNumber = Array.isArray(firstMessage.to) ? firstMessage.to[0] : firstMessage.to;
            }
          }
          
          if (!phoneNumber || phoneNumber === 'Unknown') {
            logger.warn('Skipping conversation without valid phone number', {
              conversationId: conversation.id,
              phoneNumber: phoneNumber
            });
            stats.skipped++;
            continue;
          }

          // Store in database with better phone number extraction
          await db.query(`
            INSERT INTO openphone_conversations 
            (phone_number, customer_name, employee_name, messages, metadata, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          `, [
            phoneNumber,
            conversation.contact?.name || phoneNumber, // Use phone as fallback name
            'Historical Import',
            JSON.stringify(messages),
            {
              openPhoneId: conversation.id,
              imported: true,
              importedAt: new Date().toISOString(),
              lastMessageAt: conversation.lastMessageAt,
              originalData: conversation // Store original for debugging
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
  async sendMessage(to: string, from: string, text: string, options?: { userId?: string; setInboxStatus?: 'done' }): Promise<any> {
    if (!this.isConfigured) {
      throw new Error('OpenPhone not configured');
    }

    try {
      logger.info('Sending OpenPhone message', { to, from, text: text.substring(0, 50) });
      
      // Get the API key from the main client
      const apiKey = this.client.defaults.headers['Authorization'] as string;
      
      // Log the authorization format for debugging
      logger.debug('OpenPhone authorization format:', {
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey ? apiKey.length : 0,
        apiKeyPreview: apiKey ? `${apiKey.substring(0, 10)}...` : 'none'
      });
      
      // Create a separate client for v1 API
      const v1Client = axios.create({
        baseURL: 'https://api.openphone.com/v1',
        headers: {
          'Authorization': apiKey, // Direct API key format
          'Content-Type': 'application/json'
        }
      });
      
      // Build request payload according to OpenPhone v1 API
      const payload: any = {
        content: text,
        from: from,
        to: [to] // API expects an array
      };
      
      // Add optional fields if provided
      if (options?.userId) {
        payload.userId = options.userId;
      }
      if (options?.setInboxStatus) {
        payload.setInboxStatus = options.setInboxStatus;
      }
      
      logger.debug('OpenPhone API payload:', payload);
      
      // Format the request according to OpenPhone v1 API
      const response = await v1Client.post('/messages', payload);

      // Store message in database
      await this.storeOutboundMessage({
        id: response.data.data?.id || response.data.id,
        to,
        from,
        text,
        status: 'sent',
        createdAt: new Date().toISOString()
      });

      return response.data;
    } catch (error: any) {
      logger.error('Failed to send OpenPhone message:', {
        error: error.response?.data || error.message,
        status: error.response?.status,
        headers: error.response?.headers
      });
      
      // Store failed message
      await this.storeOutboundMessage({
        id: `failed_${Date.now()}`,
        to,
        from,
        text,
        status: 'failed',
        error: error.response?.data?.message || error.message,
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
      // Get the API key from the main client
      const apiKey = this.client.defaults.headers['Authorization'] as string;
      
      // Use v1 API for phone numbers
      const v1Client = axios.create({
        baseURL: 'https://api.openphone.com/v1',
        headers: {
          'Authorization': apiKey, // Direct API key format
          'Content-Type': 'application/json'
        }
      });
      
      const response = await v1Client.get('/phone-numbers');
      return response.data.data || [];
    } catch (error: any) {
      logger.error('Failed to fetch phone numbers:', error.response?.data || error.message);
      return [];
    }
  }
  
  /**
   * Get phone number details by phone number
   */
  async getPhoneNumberDetails(phoneNumber: string): Promise<any> {
    if (!this.isConfigured) {
      return null;
    }

    try {
      const phoneNumbers = await this.getPhoneNumbers();
      return phoneNumbers.find(pn => pn.phoneNumber === phoneNumber) || null;
    } catch (error: any) {
      logger.error('Failed to get phone number details:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Get OpenPhone users
   */
  async getUsers(): Promise<any[]> {
    if (!this.isConfigured) {
      return [];
    }

    try {
      const apiKey = this.client.defaults.headers['Authorization'] as string;
      
      const v1Client = axios.create({
        baseURL: 'https://api.openphone.com/v1',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      const response = await v1Client.get('/users');
      return response.data.data || [];
    } catch (error: any) {
      logger.error('Failed to fetch OpenPhone users:', error.response?.data || error.message);
      return [];
    }
  }
  
  /**
   * Get OpenPhone user by phone number
   */
  async getUserByPhoneNumber(phoneNumber: string): Promise<any> {
    if (!this.isConfigured) {
      return null;
    }

    try {
      const phoneNumbers = await this.getPhoneNumbers();
      const phoneNumberData = phoneNumbers.find(pn => pn.phoneNumber === phoneNumber);
      
      if (phoneNumberData?.userId) {
        const users = await this.getUsers();
        return users.find(u => u.id === phoneNumberData.userId) || null;
      }
      
      return null;
    } catch (error: any) {
      logger.error('Failed to get user by phone number:', error.response?.data || error.message);
      return null;
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