import request from 'supertest';
import express from 'express';
import llmRoutes from '../../../routes/llm';
import { errorHandler } from '../../../middleware/errorHandler';
import { LLMService } from '../../../services/llmService';

// Mock the LLM service
jest.mock('../../../services/llmService');

// Mock authentication middleware
jest.mock('../../../middleware/auth', () => ({
  optionalAuth: (req: any, res: any, next: any) => next()
}));

// Mock validation middleware
jest.mock('../../../middleware/validation', () => ({
  validateLLMRequest: (req: any, res: any, next: any) => next()
}));

describe('LLM API Integration Tests', () => {
  let app: express.Application;
  let mockLLMService: jest.Mocked<LLMService>;

  beforeEach(() => {
    // Create fresh Express app for each test
    app = express();
    app.use(express.json());
    app.use('/api/llm', llmRoutes);
    app.use(errorHandler);

    // Reset mocks
    jest.clearAllMocks();
    
    // Get mocked instance
    mockLLMService = new LLMService() as jest.Mocked<LLMService>;
    (LLMService as jest.MockedClass<typeof LLMService>).mockImplementation(() => mockLLMService);
  });

  describe('POST /api/llm/request', () => {
    it('should process request with LLM when enabled', async () => {
      mockLLMService.isConfigured.mockReturnValue(true);
      mockLLMService.processRequest.mockResolvedValue({
        route: 'booking',
        reasoning: 'User wants to make a reservation',
        confidence: 0.95,
        extractedInfo: {
          intent: 'book_bay',
          date: 'tomorrow',
          time: '3pm'
        },
        requestId: 'req-123',
        timestamp: new Date().toISOString()
      });

      const response = await request(app)
        .post('/api/llm/request')
        .send({
          description: 'I want to book a bay for tomorrow at 3pm',
          userId: 'user123'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        route: 'booking',
        confidence: 0.95,
        reasoning: 'User wants to make a reservation',
        extractedInfo: {
          intent: 'book_bay',
          date: 'tomorrow',
          time: '3pm'
        }
      });

      expect(mockLLMService.processRequest).toHaveBeenCalledWith(
        'I want to book a bay for tomorrow at 3pm',
        'user123'
      );
    });

    it('should fallback to local routing when LLM is not configured', async () => {
      mockLLMService.isConfigured.mockReturnValue(false);
      mockLLMService.routeWithoutLLM.mockReturnValue({
        route: 'booking',
        reasoning: 'Matched booking keywords',
        confidence: 0.6,
        requestId: 'req-124',
        timestamp: new Date().toISOString()
      });

      const response = await request(app)
        .post('/api/llm/request')
        .send({
          description: 'book a bay',
          userId: 'user123'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        route: 'booking',
        confidence: 0.6,
        reasoning: 'Matched booking keywords',
        llmUsed: false
      });

      expect(mockLLMService.routeWithoutLLM).toHaveBeenCalledWith('book a bay');
    });

    it('should handle LLM processing errors', async () => {
      mockLLMService.isConfigured.mockReturnValue(true);
      mockLLMService.processRequest.mockRejectedValue(new Error('OpenAI API error'));
      mockLLMService.routeWithoutLLM.mockReturnValue({
        route: 'general',
        reasoning: 'Fallback due to error',
        confidence: 0.3,
        requestId: 'req-125',
        timestamp: new Date().toISOString()
      });

      const response = await request(app)
        .post('/api/llm/request')
        .send({
          description: 'test request',
          userId: 'user123'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        route: 'general',
        confidence: 0.3,
        llmUsed: false,
        fallbackReason: 'LLM processing failed'
      });
    });

    it('should validate request body', async () => {
      // Remove our mock to test actual validation
      jest.unmock('../../../middleware/validation');
      
      const response = await request(app)
        .post('/api/llm/request')
        .send({
          // Missing required description field
          userId: 'user123'
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should include forced route when specified', async () => {
      mockLLMService.isConfigured.mockReturnValue(true);
      mockLLMService.processRequest.mockResolvedValue({
        route: 'booking', // LLM suggests booking
        reasoning: 'User wants to make a reservation',
        confidence: 0.95,
        extractedInfo: {},
        requestId: 'req-126',
        timestamp: new Date().toISOString()
      });

      const response = await request(app)
        .post('/api/llm/request')
        .send({
          description: 'test request',
          userId: 'user123',
          forceRoute: 'tech' // Force to tech route
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        route: 'tech', // Should use forced route
        forcedRoute: true
      });
    });
  });

  describe('GET /api/llm/status', () => {
    it('should return LLM configuration status', async () => {
      mockLLMService.isConfigured.mockReturnValue(true);

      const response = await request(app)
        .get('/api/llm/status')
        .expect(200);

      expect(response.body).toMatchObject({
        configured: true,
        model: expect.any(String),
        features: {
          smartRouting: true,
          contextExtraction: true,
          confidenceScoring: true
        }
      });
    });

    it('should indicate when LLM is not configured', async () => {
      mockLLMService.isConfigured.mockReturnValue(false);

      const response = await request(app)
        .get('/api/llm/status')
        .expect(200);

      expect(response.body).toMatchObject({
        configured: false,
        model: null,
        features: {
          smartRouting: false,
          contextExtraction: false,
          confidenceScoring: false
        }
      });
    });
  });

  describe('POST /api/llm/test', () => {
    it('should test LLM routing without saving', async () => {
      mockLLMService.isConfigured.mockReturnValue(true);
      mockLLMService.processRequest.mockResolvedValue({
        route: 'emergency',
        reasoning: 'Detected emergency keywords',
        confidence: 0.99,
        extractedInfo: {
          type: 'fire',
          location: 'bay 3'
        },
        requestId: 'test-123',
        timestamp: new Date().toISOString()
      });

      const response = await request(app)
        .post('/api/llm/test')
        .send({
          description: 'Fire in bay 3!'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        testMode: true,
        route: 'emergency',
        confidence: 0.99,
        reasoning: 'Detected emergency keywords'
      });
    });
  });
});
