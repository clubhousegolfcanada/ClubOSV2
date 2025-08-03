import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { openPhoneService } from './openphoneService';
import ninjaoneService from './ninjaone';
import { isAutomationEnabled, logAutomationUsage } from '../routes/ai-automations';

interface AutomationResponse {
  handled: boolean;
  response?: string;
  requiresConfirmation?: boolean;
  confirmationKey?: string;
}

interface PendingConfirmation {
  featureKey: string;
  phoneNumber: string;
  action: () => Promise<void>;
  expiresAt: Date;
}

// Store pending confirmations in memory (could be moved to Redis later)
const pendingConfirmations = new Map<string, PendingConfirmation>();

export class AIAutomationService {
  /**
   * Process incoming message and check if it matches any automation patterns
   */
  async processMessage(phoneNumber: string, message: string, conversationId?: string): Promise<AutomationResponse> {
    const lowerMessage = message.toLowerCase().trim();
    
    // Check for confirmation responses first
    if (lowerMessage === 'yes' || lowerMessage === 'y') {
      const confirmation = await this.handleConfirmation(phoneNumber);
      if (confirmation.handled) {
        return confirmation;
      }
    }
    
    // Check gift card automation
    const giftCardResponse = await this.checkGiftCardAutomation(lowerMessage, conversationId);
    if (giftCardResponse.handled) return giftCardResponse;
    
    // Check hours automation
    const hoursResponse = await this.checkHoursAutomation(lowerMessage, conversationId);
    if (hoursResponse.handled) return hoursResponse;
    
    // Check membership automation
    const membershipResponse = await this.checkMembershipAutomation(lowerMessage, conversationId);
    if (membershipResponse.handled) return membershipResponse;
    
    // Check trackman reset automation
    const trackmanResponse = await this.checkTrackmanResetAutomation(lowerMessage, phoneNumber, conversationId);
    if (trackmanResponse.handled) return trackmanResponse;
    
    // Check simulator reboot automation
    const simulatorResponse = await this.checkSimulatorRebootAutomation(lowerMessage, phoneNumber, conversationId);
    if (simulatorResponse.handled) return simulatorResponse;
    
    // Check TV restart automation
    const tvResponse = await this.checkTVRestartAutomation(lowerMessage, phoneNumber, conversationId);
    if (tvResponse.handled) return tvResponse;
    
    return { handled: false };
  }
  
  /**
   * Check if message is asking about gift cards
   */
  private async checkGiftCardAutomation(message: string, conversationId?: string): Promise<AutomationResponse> {
    const startTime = Date.now();
    
    try {
      if (!await isAutomationEnabled('gift_cards')) {
        return { handled: false };
      }
      
      // Get feature config
      const featureResult = await db.query(
        'SELECT config FROM ai_automation_features WHERE feature_key = $1',
        ['gift_cards']
      );
      
      if (featureResult.rows.length === 0) {
        return { handled: false };
      }
      
      const config = featureResult.rows[0].config;
      
      // Multiple patterns for gift card detection
      const giftCardPatterns = [
        // Direct mentions
        /gift\s*card/i,
        /gift\s*certificate/i,
        /gift\s*cert/i,
        // Questions about gifts
        /(?:buy|purchase|get)\s+(?:a\s+)?gift/i,
        /gift\s+for\s+(?:my|a|someone)/i,
        /present\s+for/i,
        // Common phrasings
        /(?:do|does)\s+(?:you|clubhouse)\s+(?:have|offer|sell)\s+gift/i,
        /(?:can|could)\s+(?:i|we)\s+(?:buy|get|purchase)\s+(?:a\s+)?gift/i,
        /looking\s+for\s+(?:a\s+)?gift/i,
        /need\s+(?:a\s+)?gift/i,
        // Holiday/occasion related
        /(?:birthday|christmas|holiday)\s+(?:gift|present)/i
      ];
      
      // Check confidence based on pattern matches
      let confidenceScore = 0;
      let matchedPatterns = [];
      
      for (const pattern of giftCardPatterns) {
        if (pattern.test(message)) {
          confidenceScore += 0.3;
          matchedPatterns.push(pattern.source);
        }
      }
      
      // Boost confidence for certain strong indicators
      if (/how\s+(?:do|can)\s+(?:i|we)\s+(?:buy|purchase|get)\s+(?:a\s+)?gift\s*card/i.test(message)) {
        confidenceScore = 1.0; // Very high confidence
      }
      
      // Check for negative indicators (reduce confidence)
      const negativePatterns = [
        /received\s+(?:a\s+)?gift\s*card/i, // Already has one
        /use\s+(?:my|a)\s+gift\s*card/i, // Asking about using, not buying
        /balance/i, // Checking balance
        /redeem/i // Redeeming existing card
      ];
      
      for (const pattern of negativePatterns) {
        if (pattern.test(message)) {
          confidenceScore -= 0.4;
        }
      }
      
      // Log the analysis for learning
      await this.logPatternAnalysis('gift_cards', message, matchedPatterns, confidenceScore);
      
      // Only respond if confidence is high enough
      const minConfidence = config.minConfidence || 0.7;
      if (confidenceScore < minConfidence) {
        return { handled: false };
      }
      
      // Log successful automation
      await logAutomationUsage('gift_cards', {
        conversationId,
        triggerType: 'automatic',
        inputData: { message },
        outputData: { response: config.response_template },
        success: true,
        executionTimeMs: Date.now() - startTime
      });
      
      return {
        handled: true,
        response: config.response_template || 'You can purchase gift cards at www.clubhouse247golf.com/giftcard/purchase. Gift cards are available in various denominations and can be used for bay time, food, and beverages.'
      };
    } catch (error) {
      logger.error('Gift card automation error:', error);
      
      await logAutomationUsage('gift_cards', {
        conversationId,
        triggerType: 'automatic',
        inputData: { message },
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: Date.now() - startTime
      });
      
      return { handled: false };
    }
  }
  
  /**
   * Check if message is asking about hours of operation
   */
  private async checkHoursAutomation(message: string, conversationId?: string): Promise<AutomationResponse> {
    const startTime = Date.now();
    
    try {
      if (!await isAutomationEnabled('hours_of_operation')) {
        return { handled: false };
      }
      
      const featureResult = await db.query(
        'SELECT config FROM ai_automation_features WHERE feature_key = $1',
        ['hours_of_operation']
      );
      
      if (featureResult.rows.length === 0) {
        return { handled: false };
      }
      
      const config = featureResult.rows[0].config;
      const keywords = config.keywords || ['hours', 'open', 'close', 'when are you'];
      
      const hasKeyword = keywords.some((keyword: string) => message.includes(keyword.toLowerCase()));
      
      if (!hasKeyword) {
        return { handled: false };
      }
      
      await logAutomationUsage('hours_of_operation', {
        conversationId,
        triggerType: 'automatic',
        inputData: { message },
        outputData: { response: config.response_template },
        success: true,
        executionTimeMs: Date.now() - startTime
      });
      
      return {
        handled: true,
        response: config.response_template || 'We are open Monday-Thursday 11am-10pm, Friday 11am-11pm, Saturday 10am-11pm, and Sunday 10am-9pm.'
      };
    } catch (error) {
      logger.error('Hours automation error:', error);
      return { handled: false };
    }
  }
  
  /**
   * Check if message is asking about membership
   */
  private async checkMembershipAutomation(message: string, conversationId?: string): Promise<AutomationResponse> {
    const startTime = Date.now();
    
    try {
      if (!await isAutomationEnabled('membership_info')) {
        return { handled: false };
      }
      
      const featureResult = await db.query(
        'SELECT config FROM ai_automation_features WHERE feature_key = $1',
        ['membership_info']
      );
      
      if (featureResult.rows.length === 0) {
        return { handled: false };
      }
      
      const config = featureResult.rows[0].config;
      const keywords = config.keywords || ['membership', 'member', 'monthly', 'benefits'];
      
      const hasKeyword = keywords.some((keyword: string) => message.includes(keyword.toLowerCase()));
      
      if (!hasKeyword) {
        return { handled: false };
      }
      
      await logAutomationUsage('membership_info', {
        conversationId,
        triggerType: 'automatic',
        inputData: { message },
        outputData: { response: config.response_template },
        success: true,
        executionTimeMs: Date.now() - startTime
      });
      
      return {
        handled: true,
        response: config.response_template || 'We offer monthly memberships with benefits including priority booking, discounts on bay time, and exclusive member events. Visit our website or stop by to learn more!'
      };
    } catch (error) {
      logger.error('Membership automation error:', error);
      return { handled: false };
    }
  }
  
  /**
   * Check if message is about Trackman issues
   */
  private async checkTrackmanResetAutomation(message: string, phoneNumber: string, conversationId?: string): Promise<AutomationResponse> {
    const startTime = Date.now();
    
    try {
      if (!await isAutomationEnabled('trackman_reset')) {
        return { handled: false };
      }
      
      // Multiple patterns for system freeze detection
      const systemPatterns = [
        // Direct Trackman mentions
        /track\s*man/i,
        /tracking\s+(?:system|unit)/i,
        // Screen/display issues
        /screen\s+(?:is\s+)?(?:frozen|stuck|black|blank)/i,
        /display\s+(?:is\s+)?(?:frozen|stuck|not\s+working)/i,
        /monitor\s+(?:is\s+)?(?:frozen|stuck)/i,
        // Simulator issues
        /simulator\s+(?:is\s+)?(?:frozen|stuck|crashed)/i,
        /sim\s+(?:is\s+)?(?:frozen|stuck)/i,
        // Ball tracking issues
        /(?:not|isn't|won't)\s+(?:tracking|picking\s+up|detecting)\s+(?:my\s+)?balls?/i,
        /balls?\s+(?:not|aren't)\s+(?:registering|showing|tracking)/i,
        /(?:can't|cannot)\s+(?:see|track|detect)\s+(?:my\s+)?balls?/i,
        // General freeze descriptions
        /(?:everything|system|it)\s+(?:is\s+)?(?:frozen|stuck|crashed)/i,
        /nothing\s+(?:is\s+)?working/i,
        /(?:need|needs)\s+(?:a\s+)?(?:reset|restart|reboot)/i
      ];
      
      // Problem indicators
      const problemPatterns = [
        /frozen/i,
        /stuck/i,
        /(?:not|isn't|won't)\s+(?:work|respond|load)/i,
        /crashed/i,
        /blank/i,
        /black\s+screen/i,
        /(?:need|needs)\s+(?:to\s+be\s+)?(?:reset|restarted|rebooted)/i
      ];
      
      // Check confidence based on pattern matches
      let confidenceScore = 0;
      let matchedPatterns = [];
      let isTrackmanIssue = false;
      
      // Check for system mentions
      for (const pattern of systemPatterns) {
        if (pattern.test(message)) {
          confidenceScore += 0.4;
          matchedPatterns.push(pattern.source);
          if (/track\s*man/i.test(pattern.source)) {
            isTrackmanIssue = true;
          }
        }
      }
      
      // Check for problem indicators
      for (const pattern of problemPatterns) {
        if (pattern.test(message)) {
          confidenceScore += 0.3;
          matchedPatterns.push(pattern.source);
        }
      }
      
      // Boost confidence for very clear indicators
      if (/track\s*man\s+(?:is\s+)?(?:frozen|stuck|not\s+working)/i.test(message)) {
        confidenceScore = 1.0;
        isTrackmanIssue = true;
      }
      if (/(?:simulator|sim|screen)\s+(?:is\s+)?frozen/i.test(message)) {
        confidenceScore = 0.9;
      }
      if (/not\s+(?:tracking|picking\s+up|detecting)\s+(?:my\s+)?balls?/i.test(message)) {
        confidenceScore = 0.9;
        isTrackmanIssue = true;
      }
      
      // Log the analysis for learning
      await this.logPatternAnalysis('trackman_reset', message, matchedPatterns, confidenceScore);
      
      // Only respond if confidence is high enough
      const minConfidence = 0.7;
      if (confidenceScore < minConfidence) {
        return { handled: false };
      }
      
      // Extract bay number if mentioned
      const bayMatch = message.match(/bay\s*(\d+)|sim\s*(\d+)|simulator\s*(\d+)/i);
      const bayNumber = bayMatch ? (bayMatch[1] || bayMatch[2] || bayMatch[3]) : null;
      
      const featureResult = await db.query(
        'SELECT config FROM ai_automation_features WHERE feature_key = $1',
        ['trackman_reset']
      );
      
      const config = featureResult.rows[0].config;
      
      // Store pending confirmation
      const confirmationKey = `${phoneNumber}_trackman_${Date.now()}`;
      pendingConfirmations.set(confirmationKey, {
        featureKey: 'trackman_reset',
        phoneNumber,
        action: async () => {
          await this.executeTrackmanReset(bayNumber, conversationId);
        },
        expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      });
      
      // Clean up old confirmations
      this.cleanupExpiredConfirmations();
      
      await logAutomationUsage('trackman_reset', {
        conversationId,
        triggerType: 'automatic',
        inputData: { message, bayNumber },
        outputData: { requiresConfirmation: true },
        success: true,
        executionTimeMs: Date.now() - startTime
      });
      
      const bayInfo = bayNumber ? ` on bay ${bayNumber}` : '';
      return {
        handled: true,
        response: config.confirmation_message || `I can reset the Trackman${bayInfo} for you. This will take about 2 minutes. Please ensure no one is actively using the bay. Reply YES to proceed.`,
        requiresConfirmation: true,
        confirmationKey
      };
    } catch (error) {
      logger.error('Trackman automation error:', error);
      return { handled: false };
    }
  }
  
  /**
   * Check if message is about simulator PC issues
   */
  private async checkSimulatorRebootAutomation(message: string, phoneNumber: string, conversationId?: string): Promise<AutomationResponse> {
    const startTime = Date.now();
    
    try {
      if (!await isAutomationEnabled('simulator_reboot')) {
        return { handled: false };
      }
      
      const simulatorKeywords = ['simulator', 'sim', 'pc', 'computer'];
      const issueKeywords = ['frozen', 'stuck', 'not working', 'broken', 'reset', 'restart', 'reboot', 'crash'];
      
      const hasSimulator = simulatorKeywords.some(keyword => message.includes(keyword));
      const hasIssue = issueKeywords.some(keyword => message.includes(keyword));
      
      if (!hasSimulator || !hasIssue) {
        return { handled: false };
      }
      
      const bayMatch = message.match(/bay\s*(\d+)|sim\s*(\d+)|simulator\s*(\d+)/i);
      const bayNumber = bayMatch ? (bayMatch[1] || bayMatch[2] || bayMatch[3]) : null;
      
      const featureResult = await db.query(
        'SELECT config FROM ai_automation_features WHERE feature_key = $1',
        ['simulator_reboot']
      );
      
      const config = featureResult.rows[0].config;
      
      const confirmationKey = `${phoneNumber}_simulator_${Date.now()}`;
      pendingConfirmations.set(confirmationKey, {
        featureKey: 'simulator_reboot',
        phoneNumber,
        action: async () => {
          await this.executeSimulatorReboot(bayNumber, conversationId);
        },
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });
      
      this.cleanupExpiredConfirmations();
      
      await logAutomationUsage('simulator_reboot', {
        conversationId,
        triggerType: 'automatic',
        inputData: { message, bayNumber },
        outputData: { requiresConfirmation: true },
        success: true,
        executionTimeMs: Date.now() - startTime
      });
      
      const bayInfo = bayNumber ? ` on bay ${bayNumber}` : '';
      return {
        handled: true,
        response: config.confirmation_message || `I can reboot the simulator PC${bayInfo}. This will take 5-7 minutes and the bay will be unavailable during this time. Reply YES to proceed.`,
        requiresConfirmation: true,
        confirmationKey
      };
    } catch (error) {
      logger.error('Simulator automation error:', error);
      return { handled: false };
    }
  }
  
  /**
   * Check if message is about TV/display issues
   */
  private async checkTVRestartAutomation(message: string, phoneNumber: string, conversationId?: string): Promise<AutomationResponse> {
    const startTime = Date.now();
    
    try {
      if (!await isAutomationEnabled('tv_restart')) {
        return { handled: false };
      }
      
      const tvKeywords = ['tv', 'screen', 'display', 'monitor'];
      const issueKeywords = ['frozen', 'black', 'blank', 'not working', 'no signal', 'restart'];
      
      const hasTV = tvKeywords.some(keyword => message.includes(keyword));
      const hasIssue = issueKeywords.some(keyword => message.includes(keyword));
      
      if (!hasTV || !hasIssue) {
        return { handled: false };
      }
      
      const bayMatch = message.match(/bay\s*(\d+)|sim\s*(\d+)|simulator\s*(\d+)/i);
      const bayNumber = bayMatch ? (bayMatch[1] || bayMatch[2] || bayMatch[3]) : null;
      
      const featureResult = await db.query(
        'SELECT config FROM ai_automation_features WHERE feature_key = $1',
        ['tv_restart']
      );
      
      const config = featureResult.rows[0].config;
      
      const confirmationKey = `${phoneNumber}_tv_${Date.now()}`;
      pendingConfirmations.set(confirmationKey, {
        featureKey: 'tv_restart',
        phoneNumber,
        action: async () => {
          await this.executeTVRestart(bayNumber, conversationId);
        },
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });
      
      this.cleanupExpiredConfirmations();
      
      await logAutomationUsage('tv_restart', {
        conversationId,
        triggerType: 'automatic',
        inputData: { message, bayNumber },
        outputData: { requiresConfirmation: true },
        success: true,
        executionTimeMs: Date.now() - startTime
      });
      
      const bayInfo = bayNumber ? ` on bay ${bayNumber}` : '';
      return {
        handled: true,
        response: config.confirmation_message || `I can restart the TV system${bayInfo}. This will briefly interrupt the display. Reply YES to proceed.`,
        requiresConfirmation: true,
        confirmationKey
      };
    } catch (error) {
      logger.error('TV automation error:', error);
      return { handled: false };
    }
  }
  
  /**
   * Handle confirmation responses
   */
  private async handleConfirmation(phoneNumber: string): Promise<AutomationResponse> {
    // Find pending confirmation for this phone number
    let confirmationToExecute: PendingConfirmation | null = null;
    let keyToDelete: string | null = null;
    
    for (const [key, confirmation] of pendingConfirmations.entries()) {
      if (confirmation.phoneNumber === phoneNumber && confirmation.expiresAt > new Date()) {
        confirmationToExecute = confirmation;
        keyToDelete = key;
        break;
      }
    }
    
    if (!confirmationToExecute || !keyToDelete) {
      return { handled: false };
    }
    
    // Remove from pending
    pendingConfirmations.delete(keyToDelete);
    
    try {
      // Execute the action
      await confirmationToExecute.action();
      
      await logAutomationUsage(confirmationToExecute.featureKey, {
        triggerType: 'automatic',
        success: true,
        userConfirmed: true
      });
      
      return {
        handled: true,
        response: 'Action confirmed and initiated. I\'ll send you an update once it\'s complete.'
      };
    } catch (error) {
      logger.error('Failed to execute confirmed action:', error);
      
      await logAutomationUsage(confirmationToExecute.featureKey, {
        triggerType: 'automatic',
        success: false,
        userConfirmed: true,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        handled: true,
        response: 'I encountered an error while executing that action. Our team has been notified.'
      };
    }
  }
  
  /**
   * Execute Trackman reset via NinjaOne
   */
  private async executeTrackmanReset(bayNumber: string | null, conversationId?: string) {
    try {
      // TODO: Get device ID from bay number mapping
      const deviceId = 'TRACKMAN_DEVICE_ID'; // This should be mapped from config
      const scriptId = 'TRACKMAN_RESET_SCRIPT_ID';
      
      const job = await ninjaoneService.executeScript(deviceId, scriptId, { bayNumber });
      
      logger.info('Trackman reset initiated', { bayNumber, jobId: job.jobId });
      
      // TODO: Monitor job status and send completion message
    } catch (error) {
      logger.error('Failed to execute Trackman reset:', error);
      throw error;
    }
  }
  
  /**
   * Execute Simulator reboot via NinjaOne
   */
  private async executeSimulatorReboot(bayNumber: string | null, conversationId?: string) {
    try {
      const deviceId = 'SIMULATOR_DEVICE_ID';
      const scriptId = 'SIMULATOR_REBOOT_SCRIPT_ID';
      
      const job = await ninjaoneService.executeScript(deviceId, scriptId, { bayNumber });
      
      logger.info('Simulator reboot initiated', { bayNumber, jobId: job.jobId });
    } catch (error) {
      logger.error('Failed to execute simulator reboot:', error);
      throw error;
    }
  }
  
  /**
   * Execute TV restart via NinjaOne
   */
  private async executeTVRestart(bayNumber: string | null, conversationId?: string) {
    try {
      const deviceId = 'TV_DEVICE_ID';
      const scriptId = 'TV_RESTART_SCRIPT_ID';
      
      const job = await ninjaoneService.executeScript(deviceId, scriptId, { bayNumber });
      
      logger.info('TV restart initiated', { bayNumber, jobId: job.jobId });
    } catch (error) {
      logger.error('Failed to execute TV restart:', error);
      throw error;
    }
  }
  
  /**
   * Clean up expired confirmations
   */
  private cleanupExpiredConfirmations() {
    const now = new Date();
    for (const [key, confirmation] of pendingConfirmations.entries()) {
      if (confirmation.expiresAt < now) {
        pendingConfirmations.delete(key);
      }
    }
  }
  
  /**
   * Log pattern analysis for learning
   */
  private async logPatternAnalysis(
    featureKey: string, 
    message: string, 
    matchedPatterns: string[], 
    confidenceScore: number
  ): Promise<void> {
    try {
      // Store pattern analysis in the automation rules table for learning
      const featureResult = await db.query(
        'SELECT id FROM ai_automation_features WHERE feature_key = $1',
        [featureKey]
      );
      
      if (featureResult.rows.length === 0) return;
      
      const featureId = featureResult.rows[0].id;
      
      // Log the analysis
      await db.query(`
        INSERT INTO ai_automation_rules 
        (feature_id, rule_type, rule_data, priority, enabled)
        VALUES ($1, 'pattern_analysis', $2, $3, false)
      `, [
        featureId,
        JSON.stringify({
          message: message.substring(0, 500), // Truncate for privacy
          matchedPatterns,
          confidenceScore,
          timestamp: new Date().toISOString()
        }),
        Math.round(confidenceScore * 100) // Use confidence as priority
      ]);
    } catch (error) {
      logger.debug('Failed to log pattern analysis:', error);
    }
  }
  
  /**
   * Learn from successful interactions
   * Called when we know an automation was correct (e.g., user confirmed or didn't complain)
   */
  async learnFromInteraction(
    featureKey: string, 
    message: string, 
    wasSuccessful: boolean
  ): Promise<void> {
    try {
      const featureResult = await db.query(
        'SELECT id, config FROM ai_automation_features WHERE feature_key = $1',
        [featureKey]
      );
      
      if (featureResult.rows.length === 0) return;
      
      const feature = featureResult.rows[0];
      const config = feature.config || {};
      
      // Extract key phrases from successful interactions
      if (wasSuccessful) {
        const words = message.toLowerCase().split(/\s+/);
        const phrases = [];
        
        // Extract 2-3 word phrases
        for (let i = 0; i < words.length - 1; i++) {
          phrases.push(words.slice(i, i + 2).join(' '));
          if (i < words.length - 2) {
            phrases.push(words.slice(i, i + 3).join(' '));
          }
        }
        
        // Update learned patterns in config
        const learnedPatterns = config.learnedPatterns || {};
        phrases.forEach(phrase => {
          if (phrase.length > 3) { // Ignore very short phrases
            learnedPatterns[phrase] = (learnedPatterns[phrase] || 0) + 1;
          }
        });
        
        // Keep only patterns seen multiple times
        const significantPatterns = Object.entries(learnedPatterns)
          .filter(([_, count]) => count as number > 2)
          .reduce((acc, [pattern, count]) => {
            acc[pattern] = count;
            return acc;
          }, {} as Record<string, any>);
        
        config.learnedPatterns = significantPatterns;
        
        // Update config
        await db.query(
          'UPDATE ai_automation_features SET config = $1 WHERE id = $2',
          [JSON.stringify(config), feature.id]
        );
        
        logger.info('Learned from successful interaction', {
          featureKey,
          newPatterns: Object.keys(significantPatterns).length
        });
      }
    } catch (error) {
      logger.error('Failed to learn from interaction:', error);
    }
  }
}

// Export singleton instance
export const aiAutomationService = new AIAutomationService();