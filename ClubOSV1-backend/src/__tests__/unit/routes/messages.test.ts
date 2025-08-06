// Mock dependencies BEFORE importing the router
jest.mock('../../../utils/database');
jest.mock('../../../services/hubspotService');
jest.mock('../../../services/openphoneService');
jest.mock('../../../services/messageAssistantService');
jest.mock('../../../services/aiAutomationService');
jest.mock('../../../middleware/auth', () => ({
  authenticate: jest.fn((req: any, res: any, next: any) => next()),
  requireAuth: jest.fn((req: any, res: any, next: any) => next())
}));
jest.mock('../../../middleware/roleGuard', () => ({
  roleGuard: jest.fn(() => (req: any, res: any, next: any) => next())
}));
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

import request from 'supertest';
import express from 'express';
import messagesRouter from '../../../routes/messages';
import { db } from '../../../utils/database';
import { hubspotService } from '../../../services/hubspotService';
import { openPhoneService } from '../../../services/openphoneService';
import { messageAssistantService } from '../../../services/messageAssistantService';

const mockedDb = db as jest.Mocked<typeof db>;

describe('Messages API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/messages', messagesRouter);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/messages/health', () => {
    it('should return health status with OpenPhone connection info', async () => {
      // Mock the service methods
      (openPhoneService as any).testConnection = jest.fn().mockResolvedValue(true);
      (hubspotService as any).isHubSpotConnected = jest.fn().mockReturnValue(true);

      const response = await request(app)
        .get('/api/messages/health')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.status).toBe('ok');
      expect(response.body.data.openPhone.connected).toBe(true);
      expect(response.body.data.hubspotConnected).toBe(true);
    });

    it('should handle OpenPhone connection failure', async () => {
      (openPhoneService as any).testConnection = jest.fn().mockRejectedValue(new Error('Connection failed'));
      (hubspotService as any).isHubSpotConnected = jest.fn().mockReturnValue(false);

      const response = await request(app)
        .get('/api/messages/health')
        .expect(200);

      expect(response.body.status).toBe('degraded');
      expect(response.body.openPhone.connected).toBe(false);
    });
  });

  describe('GET /api/messages/conversations', () => {
    it('should return conversations list with snake_case format', async () => {
      // Mock table exists check
      mockedDb.query.mockResolvedValueOnce({
        rows: [{ exists: true }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock column check
      mockedDb.query.mockResolvedValueOnce({
        rows: [
          { column_name: 'unread_count' },
          { column_name: 'last_read_at' },
          { column_name: 'updated_at' }
        ],
        rowCount: 3,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock conversations query
      mockedDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            phone_number: '+15551234567',
            customer_name: 'John Doe',
            employee_name: 'Agent Smith',
            messages: [
              { text: 'Hello', created_at: '2024-08-06T10:00:00Z' }
            ],
            unread_count: 2,
            last_read_at: null,
            created_at: new Date('2024-08-05T10:00:00Z'),
            updated_at: new Date('2024-08-06T10:00:00Z')
          }
        ],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock HubSpot enrichment
      (hubspotService as any).searchByPhone = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/messages/conversations')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveLength(1);
      
      // Verify snake_case format is preserved
      const conversation = response.body.data[0];
      expect(conversation).toHaveProperty('phone_number');
      expect(conversation).toHaveProperty('customer_name');
      expect(conversation).toHaveProperty('employee_name');
      expect(conversation).toHaveProperty('unread_count');
      expect(conversation).toHaveProperty('last_read_at');
    });

    it('should handle pagination parameters', async () => {
      // Mock table exists
      mockedDb.query.mockResolvedValueOnce({
        rows: [{ exists: true }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock column check
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock conversations query with pagination
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      await request(app)
        .get('/api/messages/conversations?limit=10&offset=20')
        .expect(200);

      // Check that pagination was applied in query
      const lastCall = mockedDb.query.mock.calls[2];
      expect(lastCall[0]).toContain('LIMIT');
      expect(lastCall[0]).toContain('OFFSET');
      expect(lastCall[1]).toContain(10);
      expect(lastCall[1]).toContain(20);
    });

    it('should handle search functionality', async () => {
      // Mock table exists
      mockedDb.query.mockResolvedValueOnce({
        rows: [{ exists: true }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock column check
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock search query
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      await request(app)
        .get('/api/messages/conversations?search=john')
        .expect(200);

      // Check that search was applied in query
      const lastCall = mockedDb.query.mock.calls[2];
      expect(lastCall[0]).toContain('phone_number LIKE');
      expect(lastCall[0]).toContain('customer_name ILIKE');
      expect(lastCall[1]).toContain('%john%');
    });

    it('should enrich conversations with HubSpot data', async () => {
      // Mock table exists
      mockedDb.query.mockResolvedValueOnce({
        rows: [{ exists: true }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock column check
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock conversations with unknown customer name
      mockedDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            phone_number: '+15551234567',
            customer_name: 'Unknown',
            messages: []
          }
        ],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock HubSpot enrichment
      (hubspotService as any).searchByPhone = jest.fn().mockResolvedValue({
        id: 'hubspot-123',
        name: 'John Doe',
        phone: '+15551234567',
        company: 'Test Company'
      });

      const response = await request(app)
        .get('/api/messages/conversations')
        .expect(200);

      const conversation = response.body.data[0];
      expect(conversation.customer_name).toBe('John Doe');
      expect(conversation.hubspot_company).toBe('Test Company');
      expect(conversation.hubspot_enriched).toBe(true);
    });

    it('should handle missing table gracefully', async () => {
      // Mock table doesn't exist
      mockedDb.query.mockResolvedValueOnce({
        rows: [{ exists: false }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const response = await request(app)
        .get('/api/messages/conversations')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toEqual([]);
    });

    it('should handle column missing errors', async () => {
      // Mock table exists
      mockedDb.query.mockResolvedValueOnce({
        rows: [{ exists: true }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock column check - no columns exist
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock query error for missing column
      const columnError: any = new Error('column "unread_count" does not exist');
      columnError.code = '42703';
      mockedDb.query.mockRejectedValueOnce(columnError);

      const response = await request(app)
        .get('/api/messages/conversations')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /api/messages/conversations/:phoneNumber', () => {
    const phoneNumber = '+15551234567';
    const encodedPhone = encodeURIComponent(phoneNumber);

    it('should return single conversation with messages', async () => {
      // Mock conversation query
      mockedDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'conv_123',
          phone_number: phoneNumber,
          customer_name: 'John Doe',
          messages: [
            { text: 'Hello', direction: 'inbound', created_at: '2024-08-06T10:00:00Z' },
            { text: 'Hi there!', direction: 'outbound', created_at: '2024-08-06T10:01:00Z' }
          ]
        }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock mark as read update
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      });

      const response = await request(app)
        .get(`/api/messages/conversations/${encodedPhone}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('conversation');
      expect(response.body.data.conversation.phone_number).toBe(phoneNumber);
      expect(response.body.data).toHaveProperty('messages');
      expect(response.body.data.messages).toHaveLength(2);
    });

    it('should return 404 for non-existent conversation', async () => {
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      await request(app)
        .get('/api/messages/conversations/+19999999999')
        .expect(404);
    });

    it('should mark messages as read', async () => {
      // Mock conversation exists
      mockedDb.query.mockResolvedValueOnce({
        rows: [{ 
          phone_number: phoneNumber,
          messages: []
        }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock mark as read update
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      });

      await request(app)
        .get(`/api/messages/conversations/${encodedPhone}`)
        .expect(200);

      // Verify mark as read was called
      expect(mockedDb.query).toHaveBeenCalledTimes(2);
      const updateCall = mockedDb.query.mock.calls[1];
      expect(updateCall[0]).toContain('UPDATE openphone_conversations');
    });
  });

  describe('GET /api/messages/conversations/:phoneNumber/full-history', () => {
    const phoneNumber = '+15551234567';
    const encodedPhone = encodeURIComponent(phoneNumber);

    it('should return merged conversation history', async () => {
      // Mock multiple conversations
      mockedDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'conv_1',
            conversation_id: 'conv_1',
            messages: [
              { text: 'Message 1', created_at: '2024-08-01T10:00:00Z' },
              { text: 'Message 2', created_at: '2024-08-01T11:00:00Z' }
            ],
            created_at: new Date('2024-08-01T10:00:00Z')
          },
          {
            id: 'conv_2',
            conversation_id: 'conv_2',
            messages: [
              { text: 'Message 3', created_at: '2024-08-05T10:00:00Z' },
              { text: 'Message 4', created_at: '2024-08-05T11:00:00Z' }
            ],
            created_at: new Date('2024-08-05T10:00:00Z')
          }
        ],
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const response = await request(app)
        .get(`/api/messages/conversations/${encodedPhone}/full-history`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('conversations');
      expect(response.body.data.conversations).toHaveLength(2);
      expect(response.body.data).toHaveProperty('totalConversations', 2);
      expect(response.body.data).toHaveProperty('totalMessages', 4);
    });

    it('should handle empty history', async () => {
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const response = await request(app)
        .get(`/api/messages/conversations/${encodedPhone}/full-history`)
        .expect(200);

      expect(response.body.data.conversations).toHaveLength(0);
      expect(response.body.data.totalMessages).toBe(0);
    });
  });

  describe('POST /api/messages/conversations/:phoneNumber/suggest-response', () => {
    const phoneNumber = '+15551234567';
    const encodedPhone = encodeURIComponent(phoneNumber);

    it('should generate AI response suggestion', async () => {
      // Mock conversation history
      mockedDb.query.mockResolvedValueOnce({
        rows: [{
          messages: [
            { text: 'I need help with booking', direction: 'inbound' },
            { text: 'Sure, I can help!', direction: 'outbound' }
          ]
        }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock AI response from messageAssistantService
      (messageAssistantService as any).generateSuggestedResponse = jest.fn().mockResolvedValue({
        suggestedText: 'I can help you book a simulator bay. What date and time works best for you?',
        confidence: 0.85
      });

      const response = await request(app)
        .post(`/api/messages/conversations/${encodedPhone}/suggest-response`)
        .send({ context: 'Customer wants to book' })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('suggestion');
      expect(response.body.data.suggestion).toContain('book a simulator');
      expect(response.body.data).toHaveProperty('confidence', 0.85);
    });

    it('should handle missing context with template response', async () => {
      // Mock conversation history
      mockedDb.query.mockResolvedValueOnce({
        rows: [{
          messages: []
        }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock template response when no context
      (messageAssistantService as any).generateSuggestedResponse = jest.fn().mockResolvedValue({
        suggestedText: 'Thank you for your message. How can I help you today?',
        confidence: 0.3
      });

      const response = await request(app)
        .post(`/api/messages/conversations/${encodedPhone}/suggest-response`)
        .send({})
        .expect(200);

      expect(response.body.data.confidence).toBeLessThan(0.5);
    });
  });

  describe('POST /api/messages/send', () => {
    it('should send a message successfully', async () => {
      const phoneNumber = '+15551234567';
      
      // Mock send message
      (openPhoneService as any).sendMessage = jest.fn().mockResolvedValue({
        id: 'msg_123',
        text: 'Test message',
        to: phoneNumber,
        from: process.env.OPENPHONE_DEFAULT_NUMBER,
        created_at: new Date().toISOString()
      });

      // Mock database insert
      mockedDb.query.mockResolvedValueOnce({
        rows: [{ id: 1 }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      });

      const response = await request(app)
        .post('/api/messages/send')
        .send({
          to: phoneNumber,
          text: 'Test message'
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect((openPhoneService as any).sendMessage).toHaveBeenCalledWith(
        phoneNumber,
        expect.any(String),
        'Test message',
        expect.any(Object)
      );
    });

    it('should validate phone number format', async () => {
      const response = await request(app)
        .post('/api/messages/send')
        .send({
          to: 'invalid-phone',
          text: 'Test message'
        })
        .expect(400);

      expect(response.body.status).toBe('error');
    });

    it('should validate message text is provided', async () => {
      const response = await request(app)
        .post('/api/messages/send')
        .send({
          to: '+15551234567',
          text: ''
        })
        .expect(400);

      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/messages/unread-count', () => {
    it('should return unread count', async () => {
      mockedDb.query.mockResolvedValueOnce({
        rows: [{ total_unread: 5 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const response = await request(app)
        .get('/api/messages/unread-count')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('count', 5);
    });

    it('should handle no unread messages', async () => {
      mockedDb.query.mockResolvedValueOnce({
        rows: [{ total_unread: 0 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const response = await request(app)
        .get('/api/messages/unread-count')
        .expect(200);

      expect(response.body.data.count).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockedDb.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/messages/conversations')
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.error).toContain('Failed to fetch conversations');
    });
  });
});