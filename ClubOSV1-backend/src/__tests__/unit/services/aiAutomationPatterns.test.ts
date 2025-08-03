import { findBestAutomation, automationPatterns } from '../../../services/aiAutomationPatterns';

describe('AI Automation Patterns', () => {
  describe('Gift Card Detection', () => {
    it('should detect gift card inquiries', () => {
      const testCases = [
        'Do you sell gift cards?',
        'I want to buy a gift card',
        'How can I purchase gift cards?',
        'Gift card for my friend',
        'Where can I get gift cards?'
      ];

      testCases.forEach(message => {
        const result = findBestAutomation(message);
        expect(result?.feature).toBe('gift_cards');
        expect(result?.confidence).toBeGreaterThanOrEqual(0.7);
      });
    });

    it('should not detect gift cards in unrelated messages', () => {
      const testCases = [
        'What time do you open?',
        'I need help with my booking',
        'The simulator is broken',
        'Can I change my reservation?'
      ];

      testCases.forEach(message => {
        const result = findBestAutomation(message);
        if (result?.feature === 'gift_cards') {
          expect(result?.confidence || 0).toBeLessThan(0.7);
        }
      });
    });
  });

  describe('Trackman Reset Detection', () => {
    it('should detect trackman issues', () => {
      const testCases = [
        'Trackman is frozen',
        'The trackman on bay 3 is not working',
        'Trackman stuck',
        'Can you reset the trackman?',
        'Trackman needs a reboot'
      ];

      testCases.forEach(message => {
        const result = findBestAutomation(message);
        expect(result?.feature).toBe('trackman_reset');
        expect(result?.confidence).toBeGreaterThanOrEqual(0.7);
      });
    });

    it('should detect bay-specific trackman issues', () => {
      const testCases = [
        'Trackman on bay 3 is frozen',
        'Bay 5 trackman not working',
        'Trackman frozen on bay 12'
      ];

      testCases.forEach(message => {
        const result = findBestAutomation(message);
        expect(result?.feature).toBe('trackman_reset');
        expect(result?.confidence).toBeGreaterThanOrEqual(0.7);
      });
    });

    it('should not trigger for positive trackman mentions', () => {
      const testCases = [
        'Trackman is working great',
        'Love the trackman',
        'Trackman is perfect today'
      ];

      testCases.forEach(message => {
        const result = findBestAutomation(message);
        // Should either not match or have low confidence
        if (result?.feature === 'trackman_reset') {
          expect(result?.confidence).toBeLessThan(0.7);
        }
      });
    });
  });

  describe('Booking Change Detection', () => {
    it('should detect booking change requests', () => {
      const testCases = [
        'I need to change my booking',
        'Can I modify my reservation?',
        'Need to reschedule my tee time',
        'I want to change my booking time',
        'Can you update my reservation?'
      ];

      testCases.forEach(message => {
        const result = findBestAutomation(message);
        expect(result?.feature).toBe('booking_change');
        expect(result?.confidence).toBeGreaterThanOrEqual(0.7);
      });
    });

    it('should not trigger for new booking requests', () => {
      const testCases = [
        'I want to make a new booking',
        'Can I book a tee time?',
        'Create a reservation for me'
      ];

      testCases.forEach(message => {
        const result = findBestAutomation(message);
        // Should not match booking_change
        expect(result?.feature).not.toBe('booking_change');
      });
    });
  });

  describe('Pattern Matching Edge Cases', () => {
    it('should handle messages with multiple potential matches', () => {
      const message = 'I want to buy a gift card and also my trackman is frozen';
      const result = findBestAutomation(message);
      
      // Should detect one or the other with high confidence
      expect(['gift_cards', 'trackman_reset']).toContain(result?.feature);
      expect(result?.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should handle empty or invalid messages', () => {
      const testCases = ['', '   ', '!!!', '123'];
      
      testCases.forEach(message => {
        const result = findBestAutomation(message);
        expect(result?.feature).toBeNull();
      });
    });

    it('should return highest confidence match when multiple patterns match', () => {
      // A message that could match multiple patterns
      const message = 'Can I change my gift card order?';
      const result = findBestAutomation(message);
      
      // Should match one with reasonable confidence
      expect(result?.feature).toBeTruthy();
      expect(result?.confidence).toBeGreaterThan(0);
    });
  });
});