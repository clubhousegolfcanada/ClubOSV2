import { LLMService } from '../../../services/llmService';
import OpenAI from 'openai';
import { mockDeep } from 'jest-mock-extended';

// Mock OpenAI
jest.mock('openai');

// Mock config
jest.mock('../../../utils/envValidator', () => ({
  config: {
    OPENAI_API_KEY: 'test-api-key',
    OPENAI_MODEL: 'gpt-4-turbo-preview',
    OPENAI_MAX_TOKENS: '500',
    OPENAI_TEMPERATURE: '0.3'
  }
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

describe('LLMService', () => {
  let llmService: LLMService;
  let mockOpenAI: any;

  beforeEach(() => {
    // Create mock OpenAI instance
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };

    // Mock the OpenAI constructor
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAI);

    // Create new instance for each test
    llmService = new LLMService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processRequest', () => {
    it('should route to booking bot for reservation requests', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              route: 'booking',
              reasoning: 'User wants to make a reservation',
              confidence: 0.95,
              extractedInfo: {
                intent: 'book_bay',
                date: 'tomorrow',
                time: '3pm'
              }
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await llmService.processRequest(
        'I want to book a bay for tomorrow at 3pm',
        'user123'
      );

      expect(result).toEqual({
        route: 'booking',
        reasoning: 'User wants to make a reservation',
        confidence: 0.95,
        extractedInfo: {
          intent: 'book_bay',
          date: 'tomorrow',
          time: '3pm'
        },
        requestId: expect.any(String),
        timestamp: expect.any(String)
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4-turbo-preview',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user', content: 'I want to book a bay for tomorrow at 3pm' })
        ]),
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      });
    });

    it('should route to emergency bot for urgent issues', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              route: 'emergency',
              reasoning: 'Fire alarm mentioned - urgent safety issue',
              confidence: 0.98,
              extractedInfo: {
                type: 'fire',
                location: 'bay 3'
              }
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await llmService.processRequest(
        'Fire alarm going off in bay 3!',
        'user456'
      );

      expect(result.route).toBe('emergency');
      expect(result.confidence).toBe(0.98);
    });

    it('should handle API errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      await expect(llmService.processRequest('test request', 'user123'))
        .rejects.toThrow('Failed to process request with LLM');
    });

    it('should handle invalid JSON response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Not valid JSON'
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      await expect(llmService.processRequest('test request', 'user123'))
        .rejects.toThrow('Invalid response format from LLM');
    });

    it('should handle missing route in response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              reasoning: 'Some reasoning',
              confidence: 0.8
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      await expect(llmService.processRequest('test request', 'user123'))
        .rejects.toThrow('Invalid response format from LLM');
    });
  });

  describe('routeWithoutLLM', () => {
    it('should route booking requests correctly', () => {
      const bookingRequests = [
        'book a bay',
        'make a reservation',
        'cancel my booking',
        'check availability'
      ];

      bookingRequests.forEach(request => {
        const result = llmService.routeWithoutLLM(request);
        expect(result.route).toBe('booking');
        expect(result.confidence).toBeLessThan(0.7);
      });
    });

    it('should route access requests correctly', () => {
      const accessRequests = [
        'unlock the door',
        'grant access to John',
        'my key card isn\'t working',
        'revoke access'
      ];

      accessRequests.forEach(request => {
        const result = llmService.routeWithoutLLM(request);
        expect(result.route).toBe('access');
      });
    });

    it('should route emergency requests correctly', () => {
      const emergencyRequests = [
        'fire in the building',
        'someone is injured',
        'emergency help needed',
        'accident in bay 5'
      ];

      emergencyRequests.forEach(request => {
        const result = llmService.routeWithoutLLM(request);
        expect(result.route).toBe('emergency');
        expect(result.confidence).toBeGreaterThan(0.7);
      });
    });

    it('should route tech support requests correctly', () => {
      const techRequests = [
        'simulator not working',
        'screen is broken',
        'software crashed',
        'trackman error'
      ];

      techRequests.forEach(request => {
        const result = llmService.routeWithoutLLM(request);
        expect(result.route).toBe('tech');
      });
    });

    it('should default to general for unknown requests', () => {
      const generalRequests = [
        'hello there',
        'what\'s the weather',
        'random text'
      ];

      generalRequests.forEach(request => {
        const result = llmService.routeWithoutLLM(request);
        expect(result.route).toBe('general');
        expect(result.confidence).toBeLessThan(0.5);
      });
    });
  });

  describe('isConfigured', () => {
    it('should return true when API key is configured', () => {
      expect(llmService.isConfigured()).toBe(true);
    });

    it('should return false when API key is not configured', () => {
      // Create a new instance with no API key
      jest.resetModules();
      jest.mock('../../../utils/envValidator', () => ({
        config: {
          OPENAI_API_KEY: undefined
        }
      }));

      const LLMServiceModule = require('../../../services/llmService');
      const serviceWithoutKey = new LLMServiceModule.LLMService();

      expect(serviceWithoutKey.isConfigured()).toBe(false);
    });
  });
});
