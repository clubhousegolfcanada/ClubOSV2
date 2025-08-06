// Mock dependencies first
jest.mock('../../../utils/envValidator', () => ({
  config: {
    OPENAI_API_KEY: 'test-api-key',
    OPENAI_MODEL: 'gpt-4-turbo-preview',
    OPENAI_MAX_TOKENS: '500',
    OPENAI_TEMPERATURE: '0.3'
  }
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../../services/llm', () => ({
  LLMRouter: jest.fn().mockImplementation(() => ({
    addProvider: jest.fn(),
    query: jest.fn(),
    isConfigured: jest.fn().mockReturnValue(true)
  })),
  OpenAIProvider: jest.fn(),
  AnthropicProvider: jest.fn(),
  LocalProvider: jest.fn()
}));

import { LLMService } from '../../../services/llmService';
import { LLMRouter } from '../../../services/llm';

describe('LLMService', () => {
  let llmService: LLMService;
  let mockRouter: any;

  beforeEach(() => {
    // Clear mocks
    jest.clearAllMocks();
    
    // Set up environment
    process.env.OPENAI_API_KEY = 'test-api-key';
    
    // Create mock router
    mockRouter = {
      addProvider: jest.fn(),
      query: jest.fn(),
      isConfigured: jest.fn().mockReturnValue(true)
    };
    
    // Mock LLMRouter constructor
    (LLMRouter as jest.Mock).mockImplementation(() => mockRouter);
    
    // Create service instance
    llmService = new LLMService();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  describe('processRequest', () => {
    it('should route to booking bot for reservation requests', async () => {
      const mockResponse = {
        content: JSON.stringify({
          route: 'BookingBot',
          confidence: 0.95,
          reason: 'User wants to make a reservation'
        }),
        provider: 'openai',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      };
      
      mockRouter.query.mockResolvedValue(mockResponse);
      
      const result = await llmService.processRequest('I want to book a simulator for tomorrow at 3pm');
      
      expect(result).toEqual({
        route: 'BookingBot',
        confidence: 0.95,
        reason: 'User wants to make a reservation'
      });
      expect(mockRouter.query).toHaveBeenCalled();
    });

    it('should route to emergency bot for urgent issues', async () => {
      const mockResponse = {
        content: JSON.stringify({
          route: 'EmergencyBot',
          confidence: 0.98,
          reason: 'User reports power outage'
        }),
        provider: 'openai',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      };
      
      mockRouter.query.mockResolvedValue(mockResponse);
      
      const result = await llmService.processRequest('Power is out in the whole facility!');
      
      expect(result).toEqual({
        route: 'EmergencyBot',
        confidence: 0.98,
        reason: 'User reports power outage'
      });
    });

    it('should handle API errors gracefully', async () => {
      mockRouter.query.mockRejectedValue(new Error('API Error'));
      
      const result = await llmService.processRequest('Test message');
      
      // Should fallback to routeWithoutLLM
      expect(result.route).toBeDefined();
      expect(result.confidence).toBeLessThanOrEqual(0.5);
    });

    it('should handle invalid JSON response', async () => {
      const mockResponse = {
        content: 'Invalid JSON',
        provider: 'openai',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      };
      
      mockRouter.query.mockResolvedValue(mockResponse);
      
      const result = await llmService.processRequest('Test message');
      
      // Should fallback to routeWithoutLLM
      expect(result.route).toBeDefined();
      expect(result.confidence).toBeLessThanOrEqual(0.5);
    });

    it('should handle missing route in response', async () => {
      const mockResponse = {
        content: JSON.stringify({
          confidence: 0.8,
          reason: 'Some reason'
        }),
        provider: 'openai',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      };
      
      mockRouter.query.mockResolvedValue(mockResponse);
      
      const result = await llmService.processRequest('Test message');
      
      // Should fallback to routeWithoutLLM
      expect(result.route).toBeDefined();
    });
  });

  describe('routeWithoutLLM', () => {
    it('should route booking requests correctly', () => {
      const bookingKeywords = [
        'book a bay',
        'reserve simulator',
        'schedule a session',
        'availability tomorrow'
      ];
      
      bookingKeywords.forEach(keyword => {
        const result = llmService.routeWithoutLLM(keyword);
        expect(result.route).toBe('BookingBot');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    it('should route access requests correctly', () => {
      const accessKeywords = [
        'locked out',
        "can't get in",
        'door code',
        'key fob not working'
      ];
      
      accessKeywords.forEach(keyword => {
        const result = llmService.routeWithoutLLM(keyword);
        expect(result.route).toBe('EmergencyBot');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    it('should route emergency requests correctly', () => {
      const emergencyKeywords = [
        'emergency',
        'urgent help',
        'fire alarm',
        'water leak'
      ];
      
      emergencyKeywords.forEach(keyword => {
        const result = llmService.routeWithoutLLM(keyword);
        expect(result.route).toBe('EmergencyBot');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    it('should route tech support requests correctly', () => {
      const techKeywords = [
        'trackman not working',
        'screen frozen',
        'simulator broken',
        'software issue'
      ];
      
      techKeywords.forEach(keyword => {
        const result = llmService.routeWithoutLLM(keyword);
        expect(result.route).toBe('TechSupport');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    it('should default to general for unknown requests', () => {
      const generalMessages = [
        'hello',
        'what are your hours',
        'tell me about memberships',
        'do you have gift cards'
      ];
      
      generalMessages.forEach(message => {
        const result = llmService.routeWithoutLLM(message);
        expect(result.route).toBe('GeneralBot');
        expect(result.confidence).toBeLessThanOrEqual(0.3);
      });
    });
  });

  describe('isConfigured', () => {
    it('should return true when API key is configured', () => {
      mockRouter.isConfigured.mockReturnValue(true);
      expect(llmService.isConfigured()).toBe(true);
    });

    it('should return false when API key is not configured', () => {
      mockRouter.isConfigured.mockReturnValue(false);
      expect(llmService.isConfigured()).toBe(false);
    });
  });
});