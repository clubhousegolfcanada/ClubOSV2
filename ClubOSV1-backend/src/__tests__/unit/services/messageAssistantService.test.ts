import { MessageAssistantService } from '../../../services/messageAssistantService';
import { assistantService } from '../../../services/assistantService';
import { db } from '../../../utils/database';
import { logger } from '../../../utils/logger';
import { hubspotService } from '../../../services/hubspotService';

// Mock dependencies
jest.mock('../../../services/assistantService', () => ({
  assistantService: {
    getAssistantResponse: jest.fn()
  }
}));

jest.mock('../../../utils/database', () => ({
  db: {
    query: jest.fn(),
    createMessageSuggestion: jest.fn(),
    approveSuggestion: jest.fn(),
    markSuggestionAsSent: jest.fn()
  }
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../../services/hubspotService', () => ({
  hubspotService: {
    searchByPhone: jest.fn()
  }
}));

describe('MessageAssistantService', () => {
  let service: MessageAssistantService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    service = new MessageAssistantService();
  });

  describe('generateSuggestedResponse', () => {
    it('should generate a suggested response for customer messages', async () => {
      const mockMessages = [
        { 
          from: '+14031234567', 
          to: '+14037654321', 
          text: 'What are your hours?',
          direction: 'inbound',
          createdAt: new Date().toISOString()
        }
      ];

      const mockAssistantResponse = {
        response: 'We are open 24/7!',
        assistantId: 'asst_brand',
        threadId: 'thread_123',
        confidence: 0.9
      };

      const mockHubspotContact = {
        id: 'contact_123',
        name: 'John Doe',
        company: 'Test Company'
      };

      (assistantService.getAssistantResponse as jest.Mock).mockResolvedValue(mockAssistantResponse);
      (hubspotService.searchByPhone as jest.Mock).mockResolvedValue(mockHubspotContact);
      (db.createMessageSuggestion as jest.Mock).mockResolvedValue({
        id: 'suggestion_123',
        ...mockAssistantResponse
      });

      const result = await service.generateSuggestedResponse(
        'conv_123',
        '+14031234567',
        mockMessages,
        'user_123'
      );

      expect(result).toMatchObject({
        id: 'suggestion_123',
        suggestedText: 'We are open 24/7!',
        confidence: 0.9
      });

      expect(assistantService.getAssistantResponse).toHaveBeenCalledWith(
        'BrandTone',
        'What are your hours?',
        expect.objectContaining({
          isCustomerFacing: true,
          conversationHistory: expect.stringContaining('What are your hours?')
        })
      );
    });

    it('should handle booking-related messages', async () => {
      const mockMessages = [
        { 
          from: '+14031234567', 
          text: 'I need to book a simulator',
          direction: 'inbound',
          createdAt: new Date().toISOString()
        }
      ];

      const mockAssistantResponse = {
        response: 'I can help you book a simulator. Visit our website at...',
        assistantId: 'asst_booking',
        threadId: 'thread_123',
        confidence: 0.95
      };

      (assistantService.getAssistantResponse as jest.Mock).mockResolvedValue(mockAssistantResponse);
      (db.createMessageSuggestion as jest.Mock).mockResolvedValue({
        id: 'suggestion_124',
        ...mockAssistantResponse
      });

      await service.generateSuggestedResponse(
        'conv_124',
        '+14031234567',
        mockMessages,
        'user_123'
      );

      expect(assistantService.getAssistantResponse).toHaveBeenCalledWith(
        'Booking & Access',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should handle tech support messages', async () => {
      const mockMessages = [
        { 
          from: '+14031234567', 
          text: 'The trackman is not working',
          direction: 'inbound',
          createdAt: new Date().toISOString()
        }
      ];

      const mockAssistantResponse = {
        response: 'I understand the TrackMan is having issues. Let me help...',
        assistantId: 'asst_tech',
        threadId: 'thread_125',
        confidence: 0.92
      };

      (assistantService.getAssistantResponse as jest.Mock).mockResolvedValue(mockAssistantResponse);
      (db.createMessageSuggestion as jest.Mock).mockResolvedValue({
        id: 'suggestion_125',
        ...mockAssistantResponse
      });

      await service.generateSuggestedResponse(
        'conv_125',
        '+14031234567',
        mockMessages,
        'user_123'
      );

      expect(assistantService.getAssistantResponse).toHaveBeenCalledWith(
        'TechSupport',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should handle emergency messages', async () => {
      const mockMessages = [
        { 
          from: '+14031234567', 
          text: 'There is water leaking from the ceiling!',
          direction: 'inbound',
          createdAt: new Date().toISOString()
        }
      ];

      const mockAssistantResponse = {
        response: 'This is an emergency. Please evacuate the area immediately...',
        assistantId: 'asst_emergency',
        threadId: 'thread_126',
        confidence: 0.98
      };

      (assistantService.getAssistantResponse as jest.Mock).mockResolvedValue(mockAssistantResponse);
      (db.createMessageSuggestion as jest.Mock).mockResolvedValue({
        id: 'suggestion_126',
        ...mockAssistantResponse
      });

      await service.generateSuggestedResponse(
        'conv_126',
        '+14031234567',
        mockMessages,
        'user_123'
      );

      expect(assistantService.getAssistantResponse).toHaveBeenCalledWith(
        'Emergency',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should include conversation history in context', async () => {
      const mockMessages = [
        { 
          from: '+14031234567', 
          text: 'Hi, I have a question',
          direction: 'inbound',
          createdAt: new Date(Date.now() - 60000).toISOString()
        },
        {
          from: '+14037654321',
          text: 'Hello! How can I help you?',
          direction: 'outbound',
          createdAt: new Date(Date.now() - 30000).toISOString()
        },
        { 
          from: '+14031234567', 
          text: 'What are your membership prices?',
          direction: 'inbound',
          createdAt: new Date().toISOString()
        }
      ];

      (assistantService.getAssistantResponse as jest.Mock).mockResolvedValue({
        response: 'Our membership prices are...',
        assistantId: 'asst_brand',
        threadId: 'thread_127',
        confidence: 0.9
      });

      (db.createMessageSuggestion as jest.Mock).mockResolvedValue({
        id: 'suggestion_127'
      });

      await service.generateSuggestedResponse(
        'conv_127',
        '+14031234567',
        mockMessages,
        'user_123'
      );

      expect(assistantService.getAssistantResponse).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          conversationHistory: expect.stringContaining('Hi, I have a question')
        })
      );
    });

    it('should handle errors gracefully', async () => {
      const mockMessages = [
        { 
          from: '+14031234567', 
          text: 'Test message',
          direction: 'inbound',
          createdAt: new Date().toISOString()
        }
      ];

      (assistantService.getAssistantResponse as jest.Mock).mockRejectedValue(
        new Error('Assistant API error')
      );

      await expect(
        service.generateSuggestedResponse(
          'conv_128',
          '+14031234567',
          mockMessages,
          'user_123'
        )
      ).rejects.toThrow('Assistant API error');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to generate suggested response:',
        expect.any(Error)
      );
    });
  });

  describe('getSuggestion', () => {
    it('should retrieve a suggestion by ID', async () => {
      const mockSuggestion = {
        id: 'suggestion_123',
        conversation_id: 'conv_123',
        suggested_text: 'Test response',
        confidence: 0.9,
        sent: false
      };

      (db.query as jest.Mock).mockResolvedValue({
        rows: [mockSuggestion]
      });

      const result = await service.getSuggestion('suggestion_123');

      expect(result).toMatchObject({
        id: 'suggestion_123',
        conversationId: 'conv_123',
        suggestedText: 'Test response',
        confidence: 0.9,
        sent: false
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM message_suggestions'),
        ['suggestion_123']
      );
    });

    it('should return null for non-existent suggestion', async () => {
      (db.query as jest.Mock).mockResolvedValue({
        rows: []
      });

      const result = await service.getSuggestion('non_existent');

      expect(result).toBeNull();
    });
  });

  describe('approveSuggestion', () => {
    it('should approve a suggestion', async () => {
      await service.approveSuggestion('suggestion_123', 'user_123');

      expect(db.approveSuggestion).toHaveBeenCalledWith(
        'suggestion_123',
        'user_123'
      );
    });
  });

  describe('markSuggestionAsSent', () => {
    it('should mark suggestion as sent', async () => {
      await service.markSuggestionAsSent('suggestion_123');

      expect(db.markSuggestionAsSent).toHaveBeenCalledWith('suggestion_123');
    });
  });

  describe('getConversationStats', () => {
    it('should return conversation statistics', async () => {
      const mockStats = {
        totalSuggestions: 100,
        approvedSuggestions: 80,
        sentSuggestions: 75,
        averageConfidence: 0.87,
        routeBreakdown: {
          BrandTone: 40,
          'Booking & Access': 30,
          TechSupport: 20,
          Emergency: 10
        }
      };

      (db.query as jest.Mock).mockImplementation((query) => {
        if (query.includes('COUNT(*)')) {
          return { rows: [{ total_suggestions: 100 }] };
        }
        if (query.includes('approved_by')) {
          return { rows: [{ approved_suggestions: 80 }] };
        }
        if (query.includes('sent = true')) {
          return { rows: [{ sent_suggestions: 75 }] };
        }
        if (query.includes('AVG(confidence)')) {
          return { rows: [{ average_confidence: 0.87 }] };
        }
        if (query.includes('GROUP BY route')) {
          return { 
            rows: [
              { route: 'BrandTone', count: '40' },
              { route: 'Booking & Access', count: '30' },
              { route: 'TechSupport', count: '20' },
              { route: 'Emergency', count: '10' }
            ]
          };
        }
        return { rows: [] };
      });

      const result = await service.getConversationStats(30);

      expect(result).toMatchObject({
        totalSuggestions: 100,
        approvedSuggestions: 80,
        sentSuggestions: 75,
        averageConfidence: 0.87
      });

      expect(result.routeBreakdown).toMatchObject({
        BrandTone: 40,
        'Booking & Access': 30,
        TechSupport: 20,
        Emergency: 10
      });
    });
  });

  describe('route detection', () => {
    const testCases = [
      { text: 'I need to book a bay', expectedRoute: 'Booking & Access' },
      { text: 'How do I make a reservation?', expectedRoute: 'Booking & Access' },
      { text: 'The door is locked', expectedRoute: 'Booking & Access' },
      { text: 'TrackMan is frozen', expectedRoute: 'TechSupport' },
      { text: 'Screen is not working', expectedRoute: 'TechSupport' },
      { text: 'There is a fire!', expectedRoute: 'Emergency' },
      { text: 'Water is leaking', expectedRoute: 'Emergency' },
      { text: 'What are your hours?', expectedRoute: 'BrandTone' },
      { text: 'Tell me about membership', expectedRoute: 'BrandTone' }
    ];

    testCases.forEach(({ text, expectedRoute }) => {
      it(`should detect "${expectedRoute}" route for "${text}"`, async () => {
        const mockMessages = [
          { 
            from: '+14031234567', 
            text,
            direction: 'inbound',
            createdAt: new Date().toISOString()
          }
        ];

        (assistantService.getAssistantResponse as jest.Mock).mockResolvedValue({
          response: 'Test response',
          assistantId: 'test',
          threadId: 'thread_test',
          confidence: 0.9
        });

        (db.createMessageSuggestion as jest.Mock).mockResolvedValue({
          id: 'suggestion_test'
        });

        await service.generateSuggestedResponse(
          'conv_test',
          '+14031234567',
          mockMessages,
          'user_123'
        );

        expect(assistantService.getAssistantResponse).toHaveBeenCalledWith(
          expectedRoute,
          expect.any(String),
          expect.any(Object)
        );
      });
    });
  });
});