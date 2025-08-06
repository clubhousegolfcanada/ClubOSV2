// Mock dependencies BEFORE importing
jest.mock('../../../utils/database');
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));
jest.mock('../../../services/assistantService');
jest.mock('../../../services/slackFallback');
jest.mock('../../../services/openphoneService');

import { aiAutomationService } from '../../../services/aiAutomationService';
import { db } from '../../../utils/database';
import { assistantService } from '../../../services/assistantService';
import { slackFallback } from '../../../services/slackFallback';
import { openPhoneService } from '../../../services/openphoneService';

const mockedDb = db as jest.Mocked<typeof db>;

describe('AI Automation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockedDb.query.mockResolvedValue({
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: []
    });
  });

  describe('getAssistantType', () => {
    it('should detect booking-related keywords', () => {
      const bookingMessages = [
        'I want to book a bay',
        'Can I reserve a simulator?',
        'What times are available?',
        'I need to schedule a session',
        'Book me for tomorrow'
      ];

      bookingMessages.forEach(message => {
        const result = aiAutomationService.getAssistantType(message);
        expect(result).toBe('booking');
      });
    });

    it('should detect emergency keywords', () => {
      const emergencyMessages = [
        'The simulator is broken',
        'Everything is down',
        'Emergency! Need help',
        'System crashed',
        'Power outage in the building'
      ];

      emergencyMessages.forEach(message => {
        const result = aiAutomationService.getAssistantType(message);
        expect(result).toBe('emergency');
      });
    });

    it('should detect tech support keywords', () => {
      const techMessages = [
        'Trackman not working',
        'Screen is frozen',
        'Can\'t connect to wifi',
        'The app won\'t load',
        'Software issue with the simulator'
      ];

      techMessages.forEach(message => {
        const result = aiAutomationService.getAssistantType(message);
        expect(result).toBe('tech_support');
      });
    });

    it('should default to general for unmatched messages', () => {
      const generalMessages = [
        'Hello',
        'What are your hours?',
        'Do you sell gift cards?',
        'Tell me about your facility'
      ];

      generalMessages.forEach(message => {
        const result = aiAutomationService.getAssistantType(message);
        expect(result).toBe('general');
      });
    });
  });

  describe('processMessage', () => {
    const mockPhoneNumber = '+15551234567';
    const mockCustomerName = 'John Doe';

    beforeEach(() => {
      // Mock feature flags enabled by default
      mockedDb.query.mockImplementation((query: string) => {
        if (query.includes('ai_automation_features')) {
          return Promise.resolve({
            rows: [
              { feature_key: 'gift_cards', enabled: true, confidence_threshold: 0.5 },
              { feature_key: 'trackman_issues', enabled: true, confidence_threshold: 0.6 },
              { feature_key: 'hours_info', enabled: true, confidence_threshold: 0.4 }
            ],
            rowCount: 3,
            command: 'SELECT',
            oid: 0,
            fields: []
          });
        }
        return Promise.resolve({
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: []
        });
      });
    });

    it('should process initial message and detect automation triggers', async () => {
      const message = 'I want to buy a gift card';
      
      // Mock assistant response
      (assistantService as any).getAssistantResponse = jest.fn().mockResolvedValue({
        response: 'You can purchase gift cards at our website.',
        assistantType: 'general',
        confidence: 0.85
      });

      const result = await aiAutomationService.processMessage(
        message,
        mockPhoneNumber,
        mockCustomerName,
        true // isInitial
      );

      expect(result).toHaveProperty('handled');
      expect(result).toHaveProperty('assistantType');
      expect(result).toHaveProperty('response');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should handle follow-up messages differently', async () => {
      const message = 'Thank you';
      
      const result = await aiAutomationService.processMessage(
        message,
        mockPhoneNumber,
        mockCustomerName,
        false // not initial
      );

      expect(result.handled).toBe(false);
      expect(result.assistantType).toBe('general');
    });

    it('should respect feature flags', async () => {
      // Mock feature disabled
      mockedDb.query.mockResolvedValueOnce({
        rows: [
          { feature_key: 'gift_cards', enabled: false, confidence_threshold: 0.5 }
        ],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const message = 'I want to buy a gift card';
      
      const result = await aiAutomationService.processMessage(
        message,
        mockPhoneNumber,
        mockCustomerName,
        true
      );

      // Should not trigger automation if feature is disabled
      expect(result.handled).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      // Mock database error
      mockedDb.query.mockRejectedValueOnce(new Error('Database error'));

      const message = 'Test message';
      
      const result = await aiAutomationService.processMessage(
        message,
        mockPhoneNumber,
        mockCustomerName,
        true
      );

      expect(result.handled).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Pattern Matching', () => {
    it('should match gift card patterns', () => {
      const giftCardMessages = [
        'How do I buy a gift card?',
        'I need gift certificates',
        'Can I purchase a voucher?',
        'Do you have gift cards available?'
      ];

      giftCardMessages.forEach(message => {
        const patterns = aiAutomationService.getMatchingPatterns(message);
        expect(patterns).toContain('gift_cards');
      });
    });

    it('should match trackman issue patterns', () => {
      const trackmanMessages = [
        'Trackman is not working',
        'The trackman is broken',
        'Trackman won\'t turn on',
        'Issues with trackman'
      ];

      trackmanMessages.forEach(message => {
        const patterns = aiAutomationService.getMatchingPatterns(message);
        expect(patterns).toContain('trackman_issues');
      });
    });

    it('should match hours information patterns', () => {
      const hoursMessages = [
        'What are your hours?',
        'When do you open?',
        'What time do you close?',
        'Are you open on Sunday?'
      ];

      hoursMessages.forEach(message => {
        const patterns = aiAutomationService.getMatchingPatterns(message);
        expect(patterns).toContain('hours_info');
      });
    });

    it('should match membership patterns', () => {
      const membershipMessages = [
        'Tell me about memberships',
        'How much is a membership?',
        'I want to become a member',
        'What are the membership benefits?'
      ];

      membershipMessages.forEach(message => {
        const patterns = aiAutomationService.getMatchingPatterns(message);
        expect(patterns).toContain('membership_info');
      });
    });

    it('should return empty array for non-matching messages', () => {
      const nonMatchingMessages = [
        'Hello there',
        'Nice weather today',
        'Random text'
      ];

      nonMatchingMessages.forEach(message => {
        const patterns = aiAutomationService.getMatchingPatterns(message);
        expect(patterns).toEqual([]);
      });
    });
  });

  describe('Confidence Scoring', () => {
    it('should calculate confidence based on pattern matches', () => {
      const testCases = [
        { message: 'gift card', expectedMin: 0.7 },
        { message: 'I want to buy a gift card for my friend', expectedMin: 0.8 },
        { message: 'Do you sell anything?', expectedMin: 0 }
      ];

      testCases.forEach(({ message, expectedMin }) => {
        const confidence = aiAutomationService.calculateConfidence(message);
        if (expectedMin > 0) {
          expect(confidence).toBeGreaterThanOrEqual(expectedMin);
        } else {
          expect(confidence).toBe(0);
        }
      });
    });

    it('should respect confidence thresholds', async () => {
      // Mock high confidence threshold
      mockedDb.query.mockResolvedValueOnce({
        rows: [
          { feature_key: 'gift_cards', enabled: true, confidence_threshold: 0.95 }
        ],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const message = 'gift card'; // Lower confidence message
      
      const result = await aiAutomationService.processMessage(
        message,
        '+15551234567',
        'John Doe',
        true
      );

      // Should not trigger if confidence is below threshold
      expect(result.handled).toBe(false);
    });
  });

  describe('Statistics Tracking', () => {
    it('should track automation usage', async () => {
      const message = 'I want to buy a gift card';
      
      // Mock assistant response
      (assistantService as any).getAssistantResponse = jest.fn().mockResolvedValue({
        response: 'You can purchase gift cards at our website.',
        assistantType: 'general',
        confidence: 0.85
      });

      // Mock database insert for stats
      const statInsertSpy = jest.fn().mockResolvedValue({
        rows: [{ id: 1 }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      });
      
      mockedDb.query.mockImplementation((query: string) => {
        if (query.includes('INSERT INTO ai_automation_usage')) {
          return statInsertSpy();
        }
        if (query.includes('ai_automation_features')) {
          return Promise.resolve({
            rows: [
              { feature_key: 'gift_cards', enabled: true, confidence_threshold: 0.5 }
            ],
            rowCount: 1,
            command: 'SELECT',
            oid: 0,
            fields: []
          });
        }
        return Promise.resolve({
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: []
        });
      });

      await aiAutomationService.processMessage(
        message,
        '+15551234567',
        'John Doe',
        true
      );

      // Verify statistics were tracked
      expect(statInsertSpy).toHaveBeenCalled();
    });
  });

  describe('Fallback Handling', () => {
    it('should fallback to Slack when confidence is low', async () => {
      const message = 'Complex question about something unusual';
      
      // Mock low confidence response
      (assistantService as any).getAssistantResponse = jest.fn().mockResolvedValue({
        response: 'I\'m not sure about that.',
        assistantType: 'general',
        confidence: 0.2
      });

      // Mock Slack fallback
      const slackSpy = jest.fn().mockResolvedValue({ ok: true });
      (slackFallback as any).sendMessage = slackSpy;

      const result = await aiAutomationService.processMessage(
        message,
        '+15551234567',
        'John Doe',
        true
      );

      expect(result.confidence).toBeLessThan(0.5);
      expect(slackSpy).toHaveBeenCalled();
    });

    it('should not fallback to Slack when confidence is high', async () => {
      const message = 'What are your hours?';
      
      // Mock high confidence response
      (assistantService as any).getAssistantResponse = jest.fn().mockResolvedValue({
        response: 'We are open Monday-Friday 9am-9pm.',
        assistantType: 'general',
        confidence: 0.9
      });

      // Mock Slack fallback
      const slackSpy = jest.fn();
      (slackFallback as any).sendMessage = slackSpy;

      const result = await aiAutomationService.processMessage(
        message,
        '+15551234567',
        'John Doe',
        true
      );

      expect(result.confidence).toBeGreaterThan(0.5);
      expect(slackSpy).not.toHaveBeenCalled();
    });
  });
});

// Export helper functions for testing
export const testHelpers = {
  getAssistantType: (message: string) => aiAutomationService.getAssistantType(message),
  getMatchingPatterns: (message: string) => aiAutomationService.getMatchingPatterns(message),
  calculateConfidence: (message: string) => aiAutomationService.calculateConfidence(message)
};