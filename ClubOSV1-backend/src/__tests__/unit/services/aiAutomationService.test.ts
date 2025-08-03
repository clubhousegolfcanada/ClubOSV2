import { jest } from '@jest/globals';
import { aiAutomationService } from '../../../services/aiAutomationService';
import { db } from '../../../utils/database';
import { logger } from '../../../utils/logger';
import { assistantService } from '../../../services/assistantService';

// Mock dependencies
jest.mock('../../../utils/database');
jest.mock('../../../utils/logger');
jest.mock('../../../services/assistantService');
jest.mock('../../../services/aiAutomationPatterns');

const mockDb = db as jest.Mocked<typeof db>;
const mockAssistantService = assistantService as jest.Mocked<typeof assistantService>;

describe('AI Automation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-ignore
    mockDb.query = jest.fn().mockResolvedValue({ rows: [] });
    mockDb.initialized = true;
  });

  describe('processMessage', () => {
    it('should detect gift card automation', async () => {
      // Mock enabled gift card automation
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          feature_key: 'gift_cards',
          enabled: true,
          config: {
            responseSource: 'hardcoded',
            hardcodedResponse: 'You can purchase gift cards at https://example.com/gift-cards'
          }
        }]
      });

      const result = await aiAutomationService.processMessage(
        '+1234567890',
        'Do you sell gift cards?',
        'conv123'
      );

      expect(result.handled).toBe(true);
      expect(result.response).toContain('gift cards');
    });

    it('should detect trackman reset automation', async () => {
      // Mock enabled trackman automation
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          feature_key: 'trackman_reset',
          enabled: true,
          config: {
            responseSource: 'assistant'
          }
        }]
      });

      const result = await aiAutomationService.processMessage(
        '+1234567890',
        'The trackman is frozen on bay 3',
        'conv123'
      );

      expect(result.handled).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
    });

    it('should return null for no matching automation', async () => {
      // Mock no enabled automations
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await aiAutomationService.processMessage(
        '+1234567890',
        'What time do you open?',
        'conv123'
      );

      expect(result.handled).toBe(false);
    });
  });

  describe('additional automations', () => {
    it('should handle booking change automation', async () => {
      // Mock enabled booking change automation
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          feature_key: 'booking_change',
          enabled: true,
          config: {
            responseSource: 'hardcoded',
            hardcodedResponse: 'No problem! Just let us know what change you need'
          }
        }]
      });

      const result = await aiAutomationService.processMessage(
        '+1234567890',
        'I need to change my booking',
        'conv123'
      );

      expect(result.handled).toBe(true);
      expect(result.response).toContain('No problem');
    });
  });
});