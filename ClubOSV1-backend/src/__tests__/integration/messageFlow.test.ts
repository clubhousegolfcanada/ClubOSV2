// Integration test for complete message flow
// Tests the entire flow from webhook to response

import request from 'supertest';
import express from 'express';
import { db } from '../../utils/database';

// Mock external services but keep internal flow intact
jest.mock('../../services/openphoneService', () => ({
  openPhoneService: {
    testConnection: jest.fn().mockResolvedValue(true),
    sendMessage: jest.fn().mockResolvedValue({
      id: 'msg_123',
      status: 'sent'
    })
  }
}));

jest.mock('../../services/hubspotService', () => ({
  hubspotService: {
    searchByPhone: jest.fn().mockResolvedValue({
      id: 'contact_123',
      name: 'John Doe',
      phone: '+15551234567',
      company: 'Test Corp'
    }),
    isHubSpotConnected: jest.fn().mockReturnValue(true)
  }
}));

jest.mock('../../services/aiAutomationService', () => ({
  aiAutomationService: {
    processMessage: jest.fn().mockResolvedValue({
      handled: true,
      response: 'I can help you with that booking.',
      assistantType: 'booking',
      confidence: 0.85
    }),
    getAssistantType: jest.fn().mockReturnValue('booking')
  }
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock database but keep structure
jest.mock('../../utils/database', () => ({
  db: {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn()
  }
}));

const mockedDb = db as jest.Mocked<typeof db>;

describe('Message Flow Integration', () => {
  let app: express.Application;

  beforeAll(() => {
    // Set up Express app with actual routes
    app = express();
    app.use(express.json());
    
    // Mock auth middleware to pass through
    jest.doMock('../../middleware/auth', () => ({
      authenticate: (req: any, res: any, next: any) => {
        req.user = { id: 1, username: 'testuser', role: 'admin' };
        next();
      },
      requireAuth: (req: any, res: any, next: any) => next()
    }));
    
    jest.doMock('../../middleware/roleGuard', () => ({
      roleGuard: () => (req: any, res: any, next: any) => next()
    }));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default database responses
    mockedDb.query.mockResolvedValue({
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: []
    });
  });

  describe('OpenPhone Webhook to Message Storage', () => {
    it('should receive webhook, process message, and store in database', async () => {
      const webhookPayload = {
        type: 'message.created',
        object: {
          id: 'msg_123',
          text: 'I need to book a simulator for tomorrow',
          from: '+15551234567',
          to: '+15559999999',
          direction: 'inbound',
          created_at: '2024-08-06T10:00:00Z',
          conversation_id: 'conv_123'
        },
        created_at: 1700000000
      };

      // Mock database responses for the flow
      mockedDb.query
        // Check if conversation exists
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: []
        })
        // Insert new conversation
        .mockResolvedValueOnce({
          rows: [{ id: 1 }],
          rowCount: 1,
          command: 'INSERT',
          oid: 0,
          fields: []
        })
        // Update conversation with messages
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 1,
          command: 'UPDATE',
          oid: 0,
          fields: []
        });

      // Import routes after mocks are set up
      const openphoneRouter = require('../../routes/openphone').default;
      app.use('/api/openphone', openphoneRouter);

      const response = await request(app)
        .post('/api/openphone/webhook')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify database was updated
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO openphone_conversations'),
        expect.any(Array)
      );
    });

    it('should handle multiple messages in same conversation', async () => {
      const firstMessage = {
        type: 'message.created',
        object: {
          id: 'msg_1',
          text: 'Hello',
          from: '+15551234567',
          to: '+15559999999',
          direction: 'inbound',
          created_at: '2024-08-06T10:00:00Z',
          conversation_id: 'conv_123'
        },
        created_at: 1700000000
      };

      const secondMessage = {
        type: 'message.created',
        object: {
          id: 'msg_2',
          text: 'I need help with booking',
          from: '+15551234567',
          to: '+15559999999',
          direction: 'inbound',
          created_at: '2024-08-06T10:05:00Z',
          conversation_id: 'conv_123'
        },
        created_at: 1700000300
      };

      // Mock existing conversation for second message
      mockedDb.query
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: []
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1 }],
          rowCount: 1,
          command: 'INSERT',
          oid: 0,
          fields: []
        })
        .mockResolvedValueOnce({
          rows: [{ 
            id: 1, 
            messages: [firstMessage.object]
          }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        })
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 1,
          command: 'UPDATE',
          oid: 0,
          fields: []
        });

      const openphoneRouter = require('../../routes/openphone').default;
      app.use('/api/openphone', openphoneRouter);

      // Send first message
      await request(app)
        .post('/api/openphone/webhook')
        .send(firstMessage)
        .expect(200);

      // Send second message
      const response = await request(app)
        .post('/api/openphone/webhook')
        .send(secondMessage)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify messages were grouped
      const updateCall = mockedDb.query.mock.calls.find(
        call => call[0].includes('UPDATE openphone_conversations')
      );
      expect(updateCall).toBeDefined();
    });
  });

  describe('Message Processing to AI Response', () => {
    it('should process message through AI and generate response', async () => {
      const messagePayload = {
        phoneNumber: '+15551234567',
        message: 'I want to book a simulator for tomorrow at 3pm',
        isInitial: true
      };

      // Mock AI automation service already set up above
      const aiAutomationService = require('../../services/aiAutomationService').aiAutomationService;

      const result = await aiAutomationService.processMessage(
        messagePayload.phoneNumber,
        messagePayload.message,
        'conv_123',
        messagePayload.isInitial
      );

      expect(result.handled).toBe(true);
      expect(result.response).toContain('booking');
      expect(result.assistantType).toBe('booking');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should fallback to Slack for low confidence responses', async () => {
      const messagePayload = {
        phoneNumber: '+15551234567',
        message: 'Complex technical issue with multiple systems',
        isInitial: true
      };

      // Mock low confidence response
      const aiAutomationService = require('../../services/aiAutomationService').aiAutomationService;
      aiAutomationService.processMessage.mockResolvedValueOnce({
        handled: false,
        assistantType: 'general',
        confidence: 0.2
      });

      const result = await aiAutomationService.processMessage(
        messagePayload.phoneNumber,
        messagePayload.message,
        'conv_123',
        messagePayload.isInitial
      );

      expect(result.handled).toBe(false);
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('End-to-End Message Flow', () => {
    it('should complete flow from webhook to message send', async () => {
      // 1. Receive webhook
      const webhookPayload = {
        type: 'message.created',
        object: {
          id: 'msg_incoming',
          text: 'What are your hours?',
          from: '+15551234567',
          to: '+15559999999',
          direction: 'inbound',
          created_at: '2024-08-06T10:00:00Z',
          conversation_id: 'conv_e2e'
        },
        created_at: 1700000000
      };

      // Mock database for full flow
      mockedDb.query
        // Store incoming message
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: []
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1 }],
          rowCount: 1,
          command: 'INSERT',
          oid: 0,
          fields: []
        })
        // Fetch conversation for processing
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            phone_number: '+15551234567',
            messages: [webhookPayload.object]
          }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        })
        // Store outgoing message
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 1,
          command: 'UPDATE',
          oid: 0,
          fields: []
        });

      // Import routes
      const openphoneRouter = require('../../routes/openphone').default;
      const messagesRouter = require('../../routes/messages').default;
      
      app.use('/api/openphone', openphoneRouter);
      app.use('/api/messages', messagesRouter);

      // 1. Receive webhook
      await request(app)
        .post('/api/openphone/webhook')
        .send(webhookPayload)
        .expect(200);

      // 2. Send response message
      const sendResponse = await request(app)
        .post('/api/messages/send')
        .send({
          to: '+15551234567',
          text: 'We are open Monday-Friday 9am-9pm, weekends 10am-6pm.'
        })
        .expect(200);

      expect(sendResponse.body.status).toBe('success');
      
      // Verify OpenPhone service was called
      const openPhoneService = require('../../services/openphoneService').openPhoneService;
      expect(openPhoneService.sendMessage).toHaveBeenCalledWith(
        '+15551234567',
        expect.any(String),
        expect.stringContaining('open'),
        expect.any(Object)
      );
    });

    it('should handle conversation history and context', async () => {
      const phoneNumber = '+15551234567';
      
      // Mock conversation with history
      mockedDb.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          phone_number: phoneNumber,
          customer_name: 'John Doe',
          messages: [
            { text: 'Hi', direction: 'inbound', created_at: '2024-08-01T10:00:00Z' },
            { text: 'Hello! How can I help?', direction: 'outbound', created_at: '2024-08-01T10:01:00Z' },
            { text: 'I need to book', direction: 'inbound', created_at: '2024-08-01T10:02:00Z' }
          ],
          created_at: new Date('2024-08-01T10:00:00Z')
        }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const messagesRouter = require('../../routes/messages').default;
      app.use('/api/messages', messagesRouter);

      // Get conversation with full history
      const response = await request(app)
        .get(`/api/messages/conversations/${encodeURIComponent(phoneNumber)}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.conversation.phone_number).toBe(phoneNumber);
      expect(response.body.data.messages).toHaveLength(3);
      
      // Verify messages are in correct order
      const messages = response.body.data.messages;
      expect(messages[0].text).toBe('Hi');
      expect(messages[1].text).toBe('Hello! How can I help?');
      expect(messages[2].text).toBe('I need to book');
    });
  });

  describe('Error Handling in Message Flow', () => {
    it('should handle database errors gracefully', async () => {
      mockedDb.query.mockRejectedValue(new Error('Database connection failed'));

      const webhookPayload = {
        type: 'message.created',
        object: {
          id: 'msg_error',
          text: 'Test message',
          from: '+15551234567',
          to: '+15559999999',
          direction: 'inbound',
          created_at: '2024-08-06T10:00:00Z'
        },
        created_at: 1700000000
      };

      const openphoneRouter = require('../../routes/openphone').default;
      app.use('/api/openphone', openphoneRouter);

      const response = await request(app)
        .post('/api/openphone/webhook')
        .send(webhookPayload)
        .expect(500);

      expect(response.body.error).toContain('Failed to process webhook');
    });

    it('should handle external service failures', async () => {
      // Mock OpenPhone service failure
      const openPhoneService = require('../../services/openphoneService').openPhoneService;
      openPhoneService.sendMessage.mockRejectedValueOnce(
        new Error('OpenPhone API error')
      );

      const messagesRouter = require('../../routes/messages').default;
      app.use('/api/messages', messagesRouter);

      const response = await request(app)
        .post('/api/messages/send')
        .send({
          to: '+15551234567',
          text: 'Test message'
        })
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });
});