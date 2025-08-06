import request from 'supertest';
import express from 'express';
import { db } from '../../../utils/database';
import { logger } from '../../../utils/logger';
import { openPhoneService } from '../../../services/openphoneService';
import { hubspotService } from '../../../services/hubspotService';
import { notificationService } from '../../../services/notificationService';
import { aiAutomationService } from '../../../services/aiAutomationService';

// Import utilities
import { insertOpenPhoneConversation, updateOpenPhoneConversation } from '../../../utils/openphone-db-helpers';
import { ensureOpenPhoneColumns } from '../../../utils/database-helpers';

// Mock dependencies
jest.mock('../../../utils/database');
jest.mock('../../../utils/logger');
jest.mock('../../../services/openphoneService');
jest.mock('../../../services/hubspotService');
jest.mock('../../../services/notificationService');
jest.mock('../../../services/aiAutomationService');
jest.mock('../../../utils/openphone-db-helpers');
jest.mock('../../../utils/database-helpers');

const mockedDb = db as jest.Mocked<typeof db>;
const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedOpenPhone = openPhoneService as jest.Mocked<typeof openPhoneService>;
const mockedHubspot = hubspotService as jest.Mocked<typeof hubspotService>;
const mockedNotification = notificationService as jest.Mocked<typeof notificationService>;
const mockedAIAutomation = aiAutomationService as jest.Mocked<typeof aiAutomationService>;
const mockedInsertConversation = insertOpenPhoneConversation as jest.Mock;
const mockedUpdateConversation = updateOpenPhoneConversation as jest.Mock;
const mockedEnsureColumns = ensureOpenPhoneColumns as jest.Mock;

// Create test app
const app = express();
app.use(express.json());

// We'll import the router dynamically to avoid initialization issues
let openphoneRouter: any;

describe('OpenPhone Webhook Routes', () => {
  beforeAll(() => {
    // Import router after mocks are set up
    openphoneRouter = require('../../../routes/openphone').default;
    app.use('/openphone', openphoneRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedEnsureColumns.mockResolvedValue(undefined);
  });

  describe('POST /openphone/webhook', () => {
    describe('OpenPhone v3 webhook format', () => {
      it('should process incoming message with v3 wrapped format', async () => {
        const webhookPayload = {
          object: {
            type: 'message.created',
            id: 'msg_123',
            conversationId: 'conv_456',
            from: '+19024567890',
            to: '+19027073748',
            body: 'Test message from customer',
            direction: 'incoming',
            createdAt: '2025-08-06T12:00:00Z'
          }
        };

        // Mock database query for existing conversation check
        mockedDb.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: []
        });

        // Mock HubSpot lookup
        mockedHubspot.searchByPhone.mockResolvedValue({
          id: 'hubspot-123',
          name: 'John Doe',
          phone: '+15551234567',
          company: 'Test Company'
        });

        // Mock AI automation
        mockedAIAutomation.getAssistantType.mockReturnValue('general');
        mockedAIAutomation.processMessage.mockResolvedValue({
          handled: false,
          assistantType: 'general'
        });

        const response = await request(app)
          .post('/openphone/webhook')
          .send(webhookPayload);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ received: true });

        // Verify conversation was inserted
        expect(mockedInsertConversation).toHaveBeenCalledWith(
          expect.objectContaining({
            phoneNumber: '+19024567890',
            customerName: 'John Doe',
            messages: expect.arrayContaining([
              expect.objectContaining({
                from: '+19024567890',
                to: '+19027073748',
                text: 'Test message from customer',
                direction: 'inbound'
              })
            ])
          })
        );

        // Verify HubSpot was called for incoming message
        expect(mockedHubspot.searchByPhone).toHaveBeenCalledWith('+19024567890');
      });

      it('should handle outgoing message correctly', async () => {
        const webhookPayload = {
          object: {
            type: 'message.created',
            id: 'msg_124',
            conversationId: 'conv_456',
            from: '+19027073748',
            to: '+19024567890',
            body: 'Response from operator',
            direction: 'outgoing',
            createdAt: '2025-08-06T12:01:00Z'
          }
        };

        // Mock database query for existing conversation
        mockedDb.query.mockResolvedValueOnce({
          rows: [{
            id: 'existing_conv_id',
            phone_number: '+19024567890',
            messages: [],
            minutes_since_last_message: 5
          }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        });

        const response = await request(app)
          .post('/openphone/webhook')
          .send(webhookPayload);

        expect(response.status).toBe(200);

        // Verify conversation was updated (not inserted)
        expect(mockedUpdateConversation).toHaveBeenCalled();
        expect(mockedInsertConversation).not.toHaveBeenCalled();
      });
    });

    describe('Phone number extraction', () => {
      it('should extract phone number from various fields', async () => {
        const webhookPayload = {
          object: {
            type: 'message.created',
            phoneNumber: '+19024567890', // Fallback field
            body: 'Test message',
            direction: 'incoming'
          }
        };

        mockedDb.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: []
        });

        await request(app)
          .post('/openphone/webhook')
          .send(webhookPayload);

        expect(mockedInsertConversation).toHaveBeenCalledWith(
          expect.objectContaining({
            phoneNumber: '+19024567890'
          })
        );
      });

      it('should handle missing phone number gracefully', async () => {
        const webhookPayload = {
          object: {
            type: 'message.created',
            body: 'Test message',
            direction: 'incoming'
          }
        };

        mockedDb.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: []
        });

        const response = await request(app)
          .post('/openphone/webhook')
          .send(webhookPayload);

        expect(response.status).toBe(200);
        expect(mockedLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to extract phone number'),
          expect.any(Object)
        );
      });
    });

    describe('Message grouping', () => {
      it('should group messages within 1 hour window', async () => {
        const webhookPayload = {
          object: {
            type: 'message.created',
            from: '+19024567890',
            to: '+19027073748',
            body: 'Follow-up message',
            direction: 'incoming',
            createdAt: '2025-08-06T12:30:00Z'
          }
        };

        // Mock existing conversation within time window
        mockedDb.query.mockResolvedValueOnce({
          rows: [{
            id: 'existing_conv_id',
            phone_number: '+19024567890',
            messages: [{ text: 'Previous message' }],
            minutes_since_last_message: 30 // Within 1 hour
          }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        });

        await request(app)
          .post('/openphone/webhook')
          .send(webhookPayload);

        // Should update existing conversation
        expect(mockedUpdateConversation).toHaveBeenCalled();
        expect(mockedInsertConversation).not.toHaveBeenCalled();
      });

      it('should create new conversation after 1 hour gap', async () => {
        const webhookPayload = {
          object: {
            type: 'message.created',
            from: '+19024567890',
            to: '+19027073748',
            body: 'New conversation',
            direction: 'incoming',
            createdAt: '2025-08-06T14:00:00Z'
          }
        };

        // Mock existing conversation outside time window
        mockedDb.query.mockResolvedValueOnce({
          rows: [{
            id: 'old_conv_id',
            phone_number: '+19024567890',
            messages: [{ text: 'Old message' }],
            minutes_since_last_message: 90 // More than 1 hour
          }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        });

        await request(app)
          .post('/openphone/webhook')
          .send(webhookPayload);

        // Should create new conversation
        expect(mockedInsertConversation).toHaveBeenCalled();
        expect(mockedUpdateConversation).not.toHaveBeenCalled();
      });
    });

    describe('Webhook signature verification', () => {
      it('should accept webhook with valid signature', async () => {
        process.env.OPENPHONE_WEBHOOK_SECRET = 'test-secret';
        
        const webhookPayload = { 
          object: { 
            type: 'message.created',
            from: '+19024567890',
            body: 'Test' 
          } 
        };
        
        // Calculate correct signature
        const crypto = require('crypto');
        const signature = crypto
          .createHmac('sha256', 'test-secret')
          .update(JSON.stringify(webhookPayload))
          .digest('hex');

        mockedDb.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: []
        });

        const response = await request(app)
          .post('/openphone/webhook')
          .set('x-openphone-signature', signature)
          .send(webhookPayload);

        expect(response.status).toBe(200);
      });

      it('should reject webhook with invalid signature when secret is configured', async () => {
        process.env.OPENPHONE_WEBHOOK_SECRET = 'test-secret';
        
        const response = await request(app)
          .post('/openphone/webhook')
          .set('x-openphone-signature', 'invalid-signature')
          .send({ object: { type: 'message.created' } });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'Invalid signature' });
      });
    });
  });

  describe('POST /openphone/webhook-debug', () => {
    it('should log webhook data for debugging', async () => {
      const webhookPayload = {
        test: 'data',
        nested: { field: 'value' }
      };

      const response = await request(app)
        .post('/openphone/webhook-debug')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true, debug: true });
      expect(mockedLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('RAW OPENPHONE WEBHOOK DEBUG'),
        expect.any(Object)
      );
    });
  });
});