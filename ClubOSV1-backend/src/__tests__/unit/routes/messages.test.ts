import request from 'supertest';
import express from 'express';
import { db } from '../../../utils/database';
import { logger } from '../../../utils/logger';
import { authenticate } from '../../../middleware/auth';
import { errorHandler } from '../../../middleware/errorHandler';

// Mock dependencies first
jest.mock('../../../utils/database');
jest.mock('../../../utils/logger');
jest.mock('../../../middleware/auth');
jest.mock('../../../services/openphoneService');
jest.mock('../../../services/aiAutomationService');
jest.mock('../../../services/assistantService');

// Import the router after mocks are set up
const messagesRouter = require('../../../routes/messages').default;

const mockedDb = db as jest.Mocked<typeof db>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

// Import services to get access to mocked versions
import { openPhoneService } from '../../../services/openphoneService';
import { aiAutomationService } from '../../../services/aiAutomationService';
import { assistantService } from '../../../services/assistantService';

const mockOpenPhoneService = openPhoneService as jest.Mocked<typeof openPhoneService>;
const mockAiAutomationService = aiAutomationService as jest.Mocked<typeof aiAutomationService>;
const mockAssistantService = assistantService as jest.Mocked<typeof assistantService>;

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/messages', messagesRouter);
app.use(errorHandler);

describe('Messages Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock authentication middleware
    (authenticate as jest.Mock).mockImplementation((req, res, next) => {
      req.user = { id: 'user-123', role: 'operator' };
      next();
    });
    
    mockedDb.query = jest.fn();
  });

  describe('GET /messages/conversations', () => {
    it('should fetch conversations successfully', async () => {
      const mockConversations = {
        rows: [
          {
            id: 'conv-1',
            phone_number: '+1234567890',
            customer_name: 'John Doe',
            messages: [{ text: 'Hello' }],
            unread_count: 2,
            updated_at: '2024-01-01T00:00:00Z'
          },
          {
            id: 'conv-2',
            phone_number: '+0987654321',
            customer_name: 'Jane Smith',
            messages: [{ text: 'Hi there' }],
            unread_count: 0,
            updated_at: '2024-01-02T00:00:00Z'
          }
        ]
      };

      mockedDb.query.mockResolvedValue(mockConversations);

      const response = await request(app)
        .get('/messages/conversations')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: mockConversations.rows
      });
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT ON (phone_number)'),
        expect.any(Array)
      );
    });

    it('should handle database errors', async () => {
      mockedDb.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/messages/conversations')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Failed to fetch conversations'
      });
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to fetch conversations:',
        expect.any(Error)
      );
    });

    it('should apply search filter', async () => {
      mockedDb.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/messages/conversations?search=john')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND (LOWER(customer_name) LIKE LOWER($'),
        expect.arrayContaining(['%john%'])
      );
    });
  });

  describe('GET /messages/conversation/:phoneNumber', () => {
    it('should fetch specific conversation', async () => {
      const mockConversation = {
        rows: [{
          id: 'conv-1',
          phone_number: '+1234567890',
          messages: [
            { text: 'Hello', direction: 'inbound' },
            { text: 'Hi there', direction: 'outbound' }
          ]
        }]
      };

      mockedDb.query.mockResolvedValue(mockConversation);

      const response = await request(app)
        .get('/messages/conversation/+1234567890')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: mockConversation.rows[0]
      });
    });

    it('should return 404 for non-existent conversation', async () => {
      mockedDb.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/messages/conversation/+9999999999')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Conversation not found'
      });
    });
  });

  describe('POST /messages/send', () => {
    it('should send message successfully', async () => {
      const mockSentMessage = {
        id: 'msg-123',
        text: 'Test message',
        status: 'sent'
      };

      mockOpenPhoneService.sendMessage.mockResolvedValue(mockSentMessage);
      mockedDb.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/messages/send')
        .set('Authorization', 'Bearer test-token')
        .send({
          phoneNumber: '+1234567890',
          message: 'Test message'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: mockSentMessage
      });
      expect(mockOpenPhoneService.sendMessage).toHaveBeenCalledWith(
        '+1234567890',
        'Test message'
      );
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/messages/send')
        .set('Authorization', 'Bearer test-token')
        .send({
          phoneNumber: '+1234567890'
          // missing message
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /messages/analyze', () => {
    it('should analyze message for AI automation', async () => {
      const mockAnalysis = {
        feature: 'gift_cards',
        confidence: 0.95,
        shouldTrigger: true,
        response: 'I can help you with gift cards.'
      };

      mockAiAutomationService.analyzeMessage.mockResolvedValue(mockAnalysis);

      const response = await request(app)
        .post('/messages/analyze')
        .set('Authorization', 'Bearer test-token')
        .send({
          message: 'I want to buy a gift card',
          phoneNumber: '+1234567890'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: mockAnalysis
      });
      expect(mockAiAutomationService.analyzeMessage).toHaveBeenCalledWith(
        'I want to buy a gift card',
        { phoneNumber: '+1234567890' }
      );
    });
  });

  describe('POST /messages/mark-read', () => {
    it('should mark conversation as read', async () => {
      mockedDb.query.mockResolvedValue({ 
        rows: [{ phone_number: '+1234567890' }] 
      });

      const response = await request(app)
        .post('/messages/mark-read')
        .set('Authorization', 'Bearer test-token')
        .send({
          phoneNumber: '+1234567890'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Conversation marked as read'
      });
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE openphone_conversations'),
        expect.arrayContaining(['+1234567890', 'user-123'])
      );
    });
  });

  describe('GET /messages/unread-count', () => {
    it('should get unread message count', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [{ count: '5' }]
      });

      const response = await request(app)
        .get('/messages/unread-count')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: { count: 5 }
      });
    });
  });

  describe('POST /messages/suggested-response', () => {
    it('should generate suggested response', async () => {
      const mockResponse = 'Thank you for contacting us. We will help you shortly.';
      
      mockAssistantService.generateSuggestedResponse
        .mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/messages/suggested-response')
        .set('Authorization', 'Bearer test-token')
        .send({
          message: 'I need help',
          context: { phoneNumber: '+1234567890' }
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: { response: mockResponse }
      });
      expect(mockAssistantService.generateSuggestedResponse).toHaveBeenCalledWith(
        'I need help',
        { phoneNumber: '+1234567890' }
      );
    });
  });

  describe('POST /messages/sync', () => {
    it('should sync OpenPhone conversations', async () => {
      mockOpenPhoneService.syncConversationsToDB
        .mockResolvedValue(undefined);

      const response = await request(app)
        .post('/messages/sync')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Sync initiated'
      });
      expect(mockOpenPhoneService.syncConversationsToDB).toHaveBeenCalled();
    });

    it('should handle sync errors', async () => {
      mockOpenPhoneService.syncConversationsToDB
        .mockRejectedValue(new Error('Sync failed'));

      const response = await request(app)
        .post('/messages/sync')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Failed to sync conversations'
      });
    });
  });
});