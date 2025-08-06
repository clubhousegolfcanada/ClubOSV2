import OpenAI from 'openai';
import { AssistantService } from '../../../services/assistantService';
import { logger } from '../../../utils/logger';
import { config } from '../../../utils/envValidator';
import { db } from '../../../utils/database';
import { assistantFileManager } from '../../../services/assistantFileManager';
import { knowledgeSearchService } from '../../../services/knowledgeSearchService';

// Mock dependencies
jest.mock('openai');
jest.mock('../../../utils/logger');
jest.mock('../../../utils/envValidator', () => ({
  config: {
    OPENAI_API_KEY: 'test-api-key'
  }
}));
jest.mock('../../../utils/database');
jest.mock('../../../services/assistantFileManager', () => ({
  assistantFileManager: {
    updateKnowledge: jest.fn().mockResolvedValue({ success: true })
  }
}));
jest.mock('../../../services/knowledgeSearchService');

const mockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;
const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedDb = db as jest.Mocked<typeof db>;

describe('AssistantService', () => {
  let service: AssistantService;
  let mockOpenAIInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock OpenAI instance
    mockOpenAIInstance = {
      beta: {
        threads: {
          create: jest.fn(),
          messages: {
            create: jest.fn(),
            list: jest.fn()
          },
          runs: {
            createAndPoll: jest.fn()
          }
        },
        assistants: {
          retrieve: jest.fn()
        }
      }
    };
    
    mockedOpenAI.mockImplementation(() => mockOpenAIInstance);
    
    // Set up environment variables
    process.env.BOOKING_ACCESS_GPT_ID = 'asst_booking';
    process.env.EMERGENCY_GPT_ID = 'asst_emergency';
    process.env.TECH_SUPPORT_GPT_ID = 'asst_tech';
    process.env.BRAND_MARKETING_GPT_ID = 'asst_brand';
    
    // Mock database
    mockedDb.query = jest.fn();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.BOOKING_ACCESS_GPT_ID;
    delete process.env.EMERGENCY_GPT_ID;
    delete process.env.TECH_SUPPORT_GPT_ID;
    delete process.env.BRAND_MARKETING_GPT_ID;
  });

  describe('constructor', () => {
    it('should initialize with OpenAI API key', () => {
      service = new AssistantService();

      expect(mockedOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        organization: undefined,
        project: undefined
      });
      expect(assistantFileManager.initializeKnowledgeFiles).toHaveBeenCalled();
    });

    it('should handle missing API key', () => {
      (config as any).OPENAI_API_KEY = '';
      
      service = new AssistantService();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'AssistantService: OpenAI API key not configured, assistant features disabled'
      );
    });
  });

  describe('getAssistantResponse', () => {
    beforeEach(() => {
      service = new AssistantService();
    });

    it('should get assistant response successfully', async () => {
      const mockThread = { id: 'thread_123' };
      const mockRun = {
        status: 'completed',
        thread_id: 'thread_123'
      };
      const mockMessages = {
        data: [
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: {
                  value: 'Here is your booking confirmation'
                }
              }
            ]
          }
        ]
      };

      mockOpenAIInstance.beta.threads.create.mockResolvedValue(mockThread);
      mockOpenAIInstance.beta.threads.runs.create.mockResolvedValue({ id: 'run_123' });
      mockOpenAIInstance.beta.threads.runs.retrieve.mockResolvedValue(mockRun);
      mockOpenAIInstance.beta.threads.messages.list.mockResolvedValue(mockMessages);

      const result = await service.getAssistantResponse(
        'booking',
        'I need to book a bay',
        { userId: 'user123' }
      );

      expect(result).toMatchObject({
        response: 'Here is your booking confirmation',
        assistantId: 'asst_booking',
        threadId: 'thread_123'
      });
      expect(mockOpenAIInstance.beta.threads.create).toHaveBeenCalled();
      expect(mockOpenAIInstance.beta.threads.messages.create).toHaveBeenCalledWith(
        'thread_123',
        {
          role: 'user',
          content: 'I need to book a bay'
        }
      );
    });

    it('should handle JSON responses', async () => {
      const mockThread = { id: 'thread_123' };
      const mockRun = {
        status: 'completed',
        thread_id: 'thread_123'
      };
      const jsonResponse = {
        action: 'booking',
        details: { bay: 1, time: '2pm' }
      };
      const mockMessages = {
        data: [
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: {
                  value: `\`\`\`json\n${JSON.stringify(jsonResponse)}\n\`\`\`\nBooking confirmed`
                }
              }
            ]
          }
        ]
      };

      mockOpenAIInstance.beta.threads.create.mockResolvedValue(mockThread);
      mockOpenAIInstance.beta.threads.runs.create.mockResolvedValue({ id: 'run_123' });
      mockOpenAIInstance.beta.threads.runs.retrieve.mockResolvedValue(mockRun);
      mockOpenAIInstance.beta.threads.messages.list.mockResolvedValue(mockMessages);

      const result = await service.getAssistantResponse(
        'booking',
        'Book bay 1 at 2pm',
        { userId: 'user123' }
      );

      expect(result.structured).toEqual(jsonResponse);
      expect(result.response).toContain('Booking confirmed');
    });

    it('should handle errors gracefully', async () => {
      mockOpenAIInstance.beta.threads.create.mockRejectedValue(
        new Error('API Error')
      );

      await expect(
        service.getAssistantResponse('booking', 'test', { userId: 'user123' })
      ).rejects.toThrow('API Error');
      
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to get assistant response:',
        expect.any(Error)
      );
    });
  });

  describe('updateAssistantKnowledge', () => {
    beforeEach(() => {
      service = new AssistantService();
    });

    it('should update assistant knowledge', async () => {
      const knowledge = {
        fact: 'Updated booking process',
        tags: ['booking', 'procedure'],
        intent: 'add' as const,
        category: 'booking',
        key: 'new-procedure'
      };

      const result = await service.updateAssistantKnowledge(
        'booking',
        knowledge
      );

      expect(assistantFileManager.updateKnowledge).toHaveBeenCalledWith(
        'asst_booking',
        expect.objectContaining({
          fact: 'Updated booking process'
        })
      );
    });
  });
});