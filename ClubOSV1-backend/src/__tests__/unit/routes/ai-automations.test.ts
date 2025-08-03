import request from 'supertest';
import { app } from '../../../index';
import { db } from '../../../utils/db';
import { authenticate } from '../../../middleware/auth';
import { generateToken } from '../../../middleware/auth';

// Mock dependencies
jest.mock('../../../utils/db');
jest.mock('../../../utils/logger');

const mockDb = db as jest.Mocked<typeof db>;

describe('AI Automations Routes', () => {
  let adminToken: string;
  let operatorToken: string;
  let supportToken: string;
  
  beforeAll(() => {
    // Generate test tokens
    adminToken = generateToken({
      userId: 'admin-user',
      email: 'admin@test.com',
      role: 'admin',
      sessionId: 'admin-session',
      name: 'Admin User'
    });
    
    operatorToken = generateToken({
      userId: 'operator-user',
      email: 'operator@test.com',
      role: 'operator',
      sessionId: 'operator-session',
      name: 'Operator User'
    });
    
    supportToken = generateToken({
      userId: 'support-user',
      email: 'support@test.com',
      role: 'support',
      sessionId: 'support-session',
      name: 'Support User'
    });
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/ai-automations', () => {
    it('should return list of automation features for admin', async () => {
      const mockFeatures = [
        {
          id: 1,
          feature_key: 'gift_cards',
          name: 'Gift Card Inquiries',
          description: 'Auto-respond to gift card questions',
          enabled: true,
          category: 'customer_service',
          config: {},
          usage_count: 10
        }
      ];
      
      mockDb.query.mockResolvedValueOnce({ rows: mockFeatures });
      
      const response = await request(app)
        .get('/api/ai-automations')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.features).toEqual(mockFeatures);
    });
    
    it('should allow operator access', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      
      const response = await request(app)
        .get('/api/ai-automations')
        .set('Authorization', `Bearer ${operatorToken}`);
      
      expect(response.status).toBe(200);
    });
    
    it('should deny support role access', async () => {
      const response = await request(app)
        .get('/api/ai-automations')
        .set('Authorization', `Bearer ${supportToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/Forbidden|permissions/i);
    });
    
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/ai-automations');
      
      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/ai-automations/:featureKey/toggle', () => {
    it('should toggle feature enabled state', async () => {
      const mockFeature = {
        id: 1,
        feature_key: 'gift_cards',
        enabled: false,
        usage_count: 5
      };
      
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockFeature] }) // Get feature
        .mockResolvedValueOnce({ rows: [{ ...mockFeature, enabled: true }] }); // Update
      
      const response = await request(app)
        .put('/api/ai-automations/gift_cards/toggle')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: true });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.feature.enabled).toBe(true);
    });
    
    it('should return 404 for non-existent feature', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      
      const response = await request(app)
        .put('/api/ai-automations/non_existent/toggle')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: true });
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Feature not found');
    });
  });

  describe('PUT /api/ai-automations/:featureKey/config', () => {
    it('should update feature configuration', async () => {
      const mockFeature = {
        id: 1,
        feature_key: 'gift_cards',
        config: { responseSource: 'assistant' }
      };
      
      const newConfig = {
        responseSource: 'hardcoded',
        hardcodedResponse: 'Visit our website for gift cards!',
        maxResponses: 2
      };
      
      mockDb.query.mockResolvedValueOnce({ 
        rows: [{ ...mockFeature, config: newConfig }] 
      });
      
      const response = await request(app)
        .put('/api/ai-automations/gift_cards/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ config: newConfig });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.feature.config).toEqual(newConfig);
    });
    
    it('should validate config object', async () => {
      const response = await request(app)
        .put('/api/ai-automations/gift_cards/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ config: 'invalid' });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid configuration data');
    });
  });

  describe('GET /api/ai-automations/:featureKey/usage', () => {
    it('should return usage statistics', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Get feature
        .mockResolvedValueOnce({ rows: [{ total_uses: 50 }] }) // Total usage
        .mockResolvedValueOnce({ rows: [] }); // Daily breakdown
      
      const response = await request(app)
        .get('/api/ai-automations/gift_cards/usage')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ days: 7 });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalUses).toBe(50);
    });
  });

  describe('POST /api/ai-automations/bulk-toggle', () => {
    it('should toggle multiple features by category', async () => {
      mockDb.query.mockResolvedValueOnce({ 
        rows: [{ feature_key: 'gift_cards' }, { feature_key: 'trackman_reset' }]
      });
      
      const response = await request(app)
        .post('/api/ai-automations/bulk-toggle')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          category: 'customer_service',
          enabled: true 
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.updatedFeatures).toHaveLength(2);
    });
  });

  describe('GET /api/ai-automations/conversation-stats', () => {
    it('should return conversation statistics by assistant type', async () => {
      const mockStats = [
        {
          assistant_type: 'TechSupport',
          conversation_count: 100,
          unique_customers: 50,
          total_messages: 300
        }
      ];
      
      mockDb.query
        .mockResolvedValueOnce({ rows: mockStats }) // Type distribution
        .mockResolvedValueOnce({ rows: [] }) // Automation stats
        .mockResolvedValueOnce({ rows: [] }); // Daily trends
      
      const response = await request(app)
        .get('/api/ai-automations/conversation-stats')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.distribution).toEqual(mockStats);
    });
  });
});