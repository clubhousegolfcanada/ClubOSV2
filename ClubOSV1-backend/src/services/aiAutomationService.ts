import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { openPhoneService } from './openphoneService';
import ninjaoneService from './ninjaone';
import { isAutomationEnabled, logAutomationUsage } from '../routes/ai-automations';
import { assistantService } from './assistantService';

interface AutomationResponse {
  handled: boolean;
  response?: string;
  requiresConfirmation?: boolean;
  confirmationKey?: string;
  assistantType?: string;
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
    
    // First, determine which assistant would handle this query
    const route = this.determineRoute(lowerMessage);
    
    // Log the routing decision
    logger.info('AI Automation routing decision', {
      phoneNumber: phoneNumber.slice(-4),
      route,
      messagePreview: message.substring(0, 50)
    });
    
    // Only process automations for the appropriate assistant type
    switch (route) {
      case 'BrandTone':
        // Check gift card automation
        const giftCardResponse = await this.checkGiftCardAutomation(lowerMessage, conversationId);
        if (giftCardResponse.handled) return { ...giftCardResponse, assistantType: route };
        
        // Check hours automation
        const hoursResponse = await this.checkHoursAutomation(lowerMessage, conversationId);
        if (hoursResponse.handled) return { ...hoursResponse, assistantType: route };
        
        // Check membership automation
        const membershipResponse = await this.checkMembershipAutomation(lowerMessage, conversationId);
        if (membershipResponse.handled) return { ...membershipResponse, assistantType: route };
        break;
        
      case 'TechSupport':
        // Check trackman reset automation
        const trackmanResponse = await this.checkTrackmanResetAutomation(lowerMessage, phoneNumber, conversationId);
        if (trackmanResponse.handled) return { ...trackmanResponse, assistantType: route };
        
        // Check simulator reboot automation
        const simulatorResponse = await this.checkSimulatorRebootAutomation(lowerMessage, phoneNumber, conversationId);
        if (simulatorResponse.handled) return { ...simulatorResponse, assistantType: route };
        
        // Check TV restart automation
        const tvResponse = await this.checkTVRestartAutomation(lowerMessage, phoneNumber, conversationId);
        if (tvResponse.handled) return { ...tvResponse, assistantType: route };
        break;
        
      case 'Booking & Access':
        // Future: Add booking-related automations here
        break;
        
      case 'Emergency':
        // Never automate emergency responses
        break;
    }
    
    return { handled: false, assistantType: route };
  }
  
  /**
   * Get the assistant type for a message (public method for external use)
   */
  getAssistantType(message: string): string {
    return this.determineRoute(message);
  }
  
  /**
   * Determine which assistant route this message belongs to
   * (Matches logic from llmService.ts)
   */
  private determineRoute(description: string): string {
    const lowerDescription = description.toLowerCase();
    
    // Emergency - highest priority
    if (lowerDescription.includes('emergency') || lowerDescription.includes('fire') || 
        lowerDescription.includes('injury') || lowerDescription.includes('hurt') || 
        lowerDescription.includes('accident') || lowerDescription.includes('smoke') ||
        lowerDescription.includes('security') || lowerDescription.includes('threat')) {
      return 'Emergency';
    } 
    // Booking & Access
    else if (lowerDescription.includes('unlock') || lowerDescription.includes('door') || 
             lowerDescription.includes('access') || lowerDescription.includes('locked') || 
             lowerDescription.includes('key') || lowerDescription.includes('book') || 
             lowerDescription.includes('reservation') || lowerDescription.includes('cancel') || 
             lowerDescription.includes('reschedule') || lowerDescription.includes('return') || 
             lowerDescription.includes('refund') || lowerDescription.includes('card won') ||
             lowerDescription.includes('can\'t get in') || lowerDescription.includes('payment')) {
      return 'Booking & Access';
    } 
    // TechSupport
    else if (lowerDescription.includes('trackman') || lowerDescription.includes('frozen') || 
             lowerDescription.includes('technical') || lowerDescription.includes('screen') || 
             lowerDescription.includes('equipment') || lowerDescription.includes('tech') || 
             lowerDescription.includes('support') || lowerDescription.includes('issue') || 
             lowerDescription.includes('problem') || lowerDescription.includes('fix') || 
             lowerDescription.includes('broken') || lowerDescription.includes('restart') || 
             lowerDescription.includes('reboot') || lowerDescription.includes('simulator') ||
             lowerDescription.includes('how do i use') || lowerDescription.includes('not working') ||
             lowerDescription.includes('ball') || lowerDescription.includes('tracking') ||
             lowerDescription.includes('sensor') || lowerDescription.includes('calibrat')) {
      return 'TechSupport';
    } 
    // BrandTone
    else if ((lowerDescription.includes('member') && (lowerDescription.includes('ship') || lowerDescription.includes('become'))) || 
             (lowerDescription.includes('price') || lowerDescription.includes('cost') || lowerDescription.includes('how much')) || 
             lowerDescription.includes('gift card') || lowerDescription.includes('promotion') ||
             lowerDescription.includes('hours') || lowerDescription.includes('loyalty')) {
      return 'BrandTone';
    }
    
    // Default to TechSupport
    return 'TechSupport';
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
      
      // Check response limit
      const responseCount = await this.getResponseCount(conversationId || '', 'gift_cards');
      const maxResponses = await this.getMaxResponses('gift_cards');
      
      if (responseCount >= maxResponses) {
        logger.info('Response limit reached for gift_cards', { conversationId, responseCount, maxResponses });
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
      
      // Get response based on configured source
      let responseText: string;
      const responseSource = config.responseSource || 'database';
      
      if (responseSource === 'hardcoded' && config.hardcodedResponse) {
        // Use the hardcoded response from config
        responseText = config.hardcodedResponse;
        logger.info('Using hardcoded response for gift_cards');
      } else {
        // Query the Booking & Access assistant - it will check database first, then OpenAI
        try {
          const assistantResponse = await assistantService.getAssistantResponse(
            'Booking & Access',
            message,
            { isCustomerFacing: true, conversationId } // Mark as customer-facing for proper response formatting
          );
          
          responseText = assistantResponse.response;
          
          // Only proceed if we got a valid response
          if (!responseText || responseText.length < 10) {
            logger.warn('Assistant returned empty response for gift card query');
            return { handled: false };
          }
        } catch (assistantError) {
          logger.error('Failed to get assistant response for gift card automation:', assistantError);
          return { handled: false };
        }
      }
      
      // Transform response to be direct to customer
      responseText = this.ensureCustomerFacingResponse(responseText);
      
      // Log successful automation and increment response count
      await logAutomationUsage('gift_cards', {
        conversationId,
        triggerType: 'automatic',
        inputData: { message },
        outputData: { response: responseText },
        success: true,
        executionTimeMs: Date.now() - startTime
      });
      
      // Increment response count
      await this.incrementResponseCount(conversationId || '', 'gift_cards');
      
      // Store in assistant knowledge for learning (only if from assistant)
      if (responseSource !== 'hardcoded') {
        await this.storeInAssistantKnowledge('Booking & Access', message, responseText, 'gift_cards');
      }
      
      return {
        handled: true,
        response: responseText,
        assistantType: 'Booking & Access'
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
      
      // Check response limit
      const responseCount = await this.getResponseCount(conversationId || '', 'hours_of_operation');
      const maxResponses = await this.getMaxResponses('hours_of_operation');
      
      if (responseCount >= maxResponses) {
        logger.info('Response limit reached for hours_of_operation', { conversationId, responseCount, maxResponses });
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
      
      // Get response based on configured source
      let responseText: string;
      const responseSource = config.responseSource || 'database';
      
      if (responseSource === 'hardcoded' && config.hardcodedResponse) {
        responseText = config.hardcodedResponse;
        logger.info('Using hardcoded response for hours_of_operation');
      } else {
        try {
          const assistantResponse = await assistantService.getAssistantResponse(
            'BrandTone',  // Hours info is handled by BrandTone assistant
            message,
            { isCustomerFacing: true, conversationId }
          );
          
          responseText = assistantResponse.response;
          
          if (!responseText || responseText.length < 10) {
            logger.warn('Assistant returned empty response for hours query');
            return { handled: false };
          }
        } catch (assistantError) {
          logger.error('Failed to get assistant response for hours:', assistantError);
          return { handled: false };
        }
      }
      
      // Transform response to be direct to customer
      responseText = this.ensureCustomerFacingResponse(responseText);
      
      await logAutomationUsage('hours_of_operation', {
        conversationId,
        triggerType: 'automatic',
        inputData: { message },
        outputData: { response: responseText },
        success: true,
        executionTimeMs: Date.now() - startTime
      });
      
      await this.incrementResponseCount(conversationId || '', 'hours_of_operation');
      
      if (responseSource !== 'hardcoded') {
        await this.storeInAssistantKnowledge('BrandTone', message, responseText, 'hours_of_operation');
      }
      
      return {
        handled: true,
        response: responseText,
        assistantType: 'BrandTone'
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
      
      // Check response limit
      const responseCount = await this.getResponseCount(conversationId || '', 'membership_info');
      const maxResponses = await this.getMaxResponses('membership_info');
      
      if (responseCount >= maxResponses) {
        logger.info('Response limit reached for membership_info', { conversationId, responseCount, maxResponses });
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
      
      // Get response based on configured source
      let responseText: string;
      const responseSource = config.responseSource || 'database';
      
      if (responseSource === 'hardcoded' && config.hardcodedResponse) {
        responseText = config.hardcodedResponse;
        logger.info('Using hardcoded response for membership_info');
      } else {
        try {
          const assistantResponse = await assistantService.getAssistantResponse(
            'BrandTone',  // Hours info is handled by BrandTone assistant
            message,
            { isCustomerFacing: true, conversationId }
          );
          
          responseText = assistantResponse.response;
          
          if (!responseText || responseText.length < 10) {
            logger.warn('Assistant returned empty response for membership query');
            return { handled: false };
          }
        } catch (assistantError) {
          logger.error('Failed to get assistant response for membership:', assistantError);
          return { handled: false };
        }
      }
      
      // Transform response to be direct to customer
      responseText = this.ensureCustomerFacingResponse(responseText);
      
      await logAutomationUsage('membership_info', {
        conversationId,
        triggerType: 'automatic',
        inputData: { message },
        outputData: { response: responseText },
        success: true,
        executionTimeMs: Date.now() - startTime
      });
      
      await this.incrementResponseCount(conversationId || '', 'membership_info');
      
      if (responseSource !== 'hardcoded') {
        await this.storeInAssistantKnowledge('BrandTone', message, responseText, 'membership_info');
      }
      
      return {
        handled: true,
        response: responseText,
        assistantType: 'BrandTone'
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
      
      // Create a natural response based on what the customer said
      let response = config.confirmation_message;
      
      // Customize response based on the issue described
      if (/not\s+(?:tracking|picking\s+up|detecting)\s+(?:my\s+)?balls?/i.test(message)) {
        response = "I see the Trackman isn't detecting your shots properly. If you signed in to your Trackman account before starting, I can reset the system quickly and you can pick back up through the 'My Activities' button. Let me know and I'll reset it.";
      } else if (/screen\s+(?:is\s+)?(?:frozen|stuck|black)/i.test(message)) {
        response = "I understand the screen is frozen. If you signed in to your Trackman account before starting, I can reset the system quickly and you can pick back up through the 'My Activities' button. Let me know and I'll reset it.";
      } else if (/frozen/i.test(message) && bayNumber) {
        response = `I see bay ${bayNumber} is experiencing issues. If you signed in to your Trackman account before starting, I can reset the system quickly and you can pick back up through the 'My Activities' button. Let me know and I'll reset it.`;
      }
      
      return {
        handled: true,
        response,
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
      
      // Customize confirmation response based on the action type
      let confirmationResponse = 'Action confirmed and initiated. I\'ll send you an update once it\'s complete.';
      
      if (confirmationToExecute.featureKey === 'trackman_reset') {
        confirmationResponse = "Great! I'm resetting the Trackman system now. This should take about 2 minutes. Once it's back up, you can sign back in and use the 'My Activities' button to continue where you left off.";
      } else if (confirmationToExecute.featureKey === 'simulator_reboot') {
        confirmationResponse = "I'm rebooting the simulator PC now. This will take 5-7 minutes. I'll let you know when it's ready to use again.";
      } else if (confirmationToExecute.featureKey === 'tv_restart') {
        confirmationResponse = "I'm restarting the TV system now. The display should be back up in just a moment.";
      }
      
      return {
        handled: true,
        response: confirmationResponse
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
   * Track messages that weren't automated (for learning opportunities)
   */
  async trackMissedAutomation(
    phoneNumber: string,
    message: string,
    conversationId?: string
  ): Promise<void> {
    try {
      // Determine assistant type for learning
      const assistantType = this.determineRoute(message);
      
      // Store the unanswered query
      await db.query(`
        INSERT INTO ai_automation_rules 
        (feature_id, rule_type, rule_data, priority, enabled)
        VALUES (
          (SELECT id FROM ai_automation_features WHERE feature_key = 'learning_tracker'),
          'missed_automation',
          $1,
          50,
          false
        )
      `, [
        JSON.stringify({
          phoneNumber,
          message: message.substring(0, 500),
          assistantType,
          conversationId,
          timestamp: new Date().toISOString(),
          awaitingResponse: true
        })
      ]);
    } catch (error) {
      logger.debug('Failed to track missed automation:', error);
    }
  }
  
  /**
   * Learn from staff responses to messages we didn't automate
   */
  async learnFromStaffResponse(
    phoneNumber: string,
    staffResponse: string,
    staffUserId?: string
  ): Promise<void> {
    try {
      // Find recent unanswered queries from this phone number
      const recentQueries = await db.query(`
        SELECT id, rule_data
        FROM ai_automation_rules
        WHERE rule_type = 'missed_automation'
        AND rule_data->>'phoneNumber' = $1
        AND rule_data->>'awaitingResponse' = 'true'
        AND created_at > NOW() - INTERVAL '1 hour'
        ORDER BY created_at DESC
        LIMIT 5
      `, [phoneNumber]);
      
      if (recentQueries.rows.length === 0) return;
      
      // Check if staff response contains key automation triggers
      const lowerResponse = staffResponse.toLowerCase();
      let detectedFeature: string | null = null;
      let extractedInfo: any = {};
      
      // Check for gift card response
      if (lowerResponse.includes('clubhouse247golf.com/giftcard') || 
          lowerResponse.includes('gift card') && lowerResponse.includes('purchase')) {
        detectedFeature = 'gift_cards';
        extractedInfo = {
          url: 'www.clubhouse247golf.com/giftcard/purchase',
          pattern: 'gift card purchase'
        };
      }
      // Check for Trackman reset response
      else if (lowerResponse.includes('reset') && 
               (lowerResponse.includes('trackman') || lowerResponse.includes('my activities'))) {
        detectedFeature = 'trackman_reset';
        extractedInfo = {
          pattern: 'trackman reset with activities recovery'
        };
      }
      // Check for hours response
      else if (lowerResponse.match(/\d{1,2}(am|pm)\s*-\s*\d{1,2}(am|pm)/i)) {
        detectedFeature = 'hours_of_operation';
        extractedInfo = {
          hours: lowerResponse.match(/\d{1,2}(am|pm)\s*-\s*\d{1,2}(am|pm)/gi)
        };
      }
      
      if (detectedFeature) {
        // Mark queries as responded
        for (const query of recentQueries.rows) {
          const data = query.rule_data;
          data.awaitingResponse = false;
          data.staffResponse = staffResponse.substring(0, 500);
          data.detectedFeature = detectedFeature;
          data.extractedInfo = extractedInfo;
          data.respondedAt = new Date().toISOString();
          
          await db.query(
            'UPDATE ai_automation_rules SET rule_data = $1 WHERE id = $2',
            [JSON.stringify(data), query.id]
          );
          
          // Log this as a learning opportunity
          logger.info('Detected learning opportunity', {
            feature: detectedFeature,
            originalQuery: data.message,
            staffResponse: staffResponse.substring(0, 100)
          });
          
          // Update the feature's learned patterns
          await this.addLearnedPattern(detectedFeature, data.message, staffResponse);
        }
      }
    } catch (error) {
      logger.error('Failed to learn from staff response:', error);
    }
  }
  
  /**
   * Add a learned pattern from staff interaction
   */
  private async addLearnedPattern(
    featureKey: string,
    customerMessage: string,
    staffResponse: string
  ): Promise<void> {
    try {
      const featureResult = await db.query(
        'SELECT id, config FROM ai_automation_features WHERE feature_key = $1',
        [featureKey]
      );
      
      if (featureResult.rows.length === 0) return;
      
      const feature = featureResult.rows[0];
      const config = feature.config || {};
      
      // Initialize learned conversations if not exists
      if (!config.learnedConversations) {
        config.learnedConversations = [];
      }
      
      // Add this conversation
      config.learnedConversations.push({
        customerMessage: customerMessage.substring(0, 200),
        staffResponse: staffResponse.substring(0, 200),
        learnedAt: new Date().toISOString()
      });
      
      // Keep only last 100 learned conversations
      if (config.learnedConversations.length > 100) {
        config.learnedConversations = config.learnedConversations.slice(-100);
      }
      
      // Extract common phrases from customer messages
      const allCustomerMessages = config.learnedConversations.map(c => c.customerMessage.toLowerCase());
      const phraseFrequency = new Map<string, number>();
      
      // Count 2-3 word phrases
      allCustomerMessages.forEach(msg => {
        const words = msg.split(/\s+/);
        for (let i = 0; i < words.length - 1; i++) {
          const phrase2 = words.slice(i, i + 2).join(' ');
          const phrase3 = i < words.length - 2 ? words.slice(i, i + 3).join(' ') : null;
          
          if (phrase2.length > 4) {
            phraseFrequency.set(phrase2, (phraseFrequency.get(phrase2) || 0) + 1);
          }
          if (phrase3 && phrase3.length > 6) {
            phraseFrequency.set(phrase3, (phraseFrequency.get(phrase3) || 0) + 1);
          }
        }
      });
      
      // Store frequent phrases (seen 3+ times)
      config.frequentPhrases = Array.from(phraseFrequency.entries())
        .filter(([_, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20) // Top 20 phrases
        .map(([phrase, count]) => ({ phrase, count }));
      
      // Update config
      await db.query(
        'UPDATE ai_automation_features SET config = $1 WHERE id = $2',
        [JSON.stringify(config), feature.id]
      );
      
      logger.info('Updated learned patterns', {
        featureKey,
        totalConversations: config.learnedConversations.length,
        frequentPhrases: config.frequentPhrases.length
      });
    } catch (error) {
      logger.error('Failed to add learned pattern:', error);
    }
  }
  
  /**
   * Store automation response in assistant knowledge for future reference
   */
  private async storeInAssistantKnowledge(
    route: string, 
    query: string, 
    response: string,
    featureKey: string
  ): Promise<void> {
    try {
      // Map route to assistant ID
      const assistantMap: Record<string, string> = {
        'Emergency': 'asst_jOWRzC9eOMRsupRqMWR5hc89',
        'Booking & Access': 'asst_E2CrYEtb5CKJGPZYdE7z7VAq',
        'TechSupport': 'asst_Xax6THdGRHYJwPbRi9OoQrRF',
        'BrandTone': 'asst_1vMUEQ7oTIYrCFG1BhgpwMkw'
      };
      
      const assistantId = assistantMap[route];
      if (!assistantId) return;
      
      // Check if assistant knowledge exists
      const existing = await db.query(
        'SELECT knowledge FROM assistant_knowledge WHERE assistant_id = $1',
        [assistantId]
      );
      
      let knowledge = existing.rows[0]?.knowledge || {};
      
      // Add automation response to knowledge
      if (!knowledge.automatedResponses) {
        knowledge.automatedResponses = {};
      }
      
      if (!knowledge.automatedResponses[featureKey]) {
        knowledge.automatedResponses[featureKey] = [];
      }
      
      // Store the Q&A pair
      knowledge.automatedResponses[featureKey].push({
        query: query.substring(0, 200), // Truncate for privacy
        response,
        timestamp: new Date().toISOString(),
        confidence: 'high'
      });
      
      // Keep only last 50 examples per feature
      if (knowledge.automatedResponses[featureKey].length > 50) {
        knowledge.automatedResponses[featureKey] = 
          knowledge.automatedResponses[featureKey].slice(-50);
      }
      
      // Update or insert
      if (existing.rows.length > 0) {
        await db.query(
          'UPDATE assistant_knowledge SET knowledge = $1, updated_at = NOW() WHERE assistant_id = $2',
          [JSON.stringify(knowledge), assistantId]
        );
      } else {
        await db.query(
          'INSERT INTO assistant_knowledge (assistant_id, route, knowledge) VALUES ($1, $2, $3)',
          [assistantId, route, JSON.stringify(knowledge)]
        );
      }
    } catch (error) {
      logger.debug('Failed to store in assistant knowledge:', error);
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
  
  /**
   * Transform response to ensure it's direct to customer
   * Converts "Tell them..." or "Inform the customer..." to direct speech
   */
  private ensureCustomerFacingResponse(response: string): string {
    if (!response) return response;
    
    // Common patterns where AI might speak about the customer instead of to them
    const transformations: Array<[RegExp, string]> = [
      // "Tell them..." patterns
      [/^tell (?:them|the customer|the member) (?:that )?/i, ''],
      [/^inform (?:them|the customer|the member) (?:that )?/i, ''],
      [/^let (?:them|the customer|the member) know (?:that )?/i, ''],
      [/^respond with:?\s*/i, ''],
      [/^reply with:?\s*/i, ''],
      [/^say:?\s*/i, ''],
      
      // "The customer can..." → "You can..."
      [/\b(?:the|a) (?:customer|member|user|guest|person) can\b/gi, 'You can'],
      [/\b(?:the|a) (?:customer|member|user|guest|person) (?:is|are)\b/gi, 'You are'],
      [/\b(?:the|a) (?:customer|member|user|guest|person) (?:has|have)\b/gi, 'You have'],
      [/\b(?:the|a) (?:customer|member|user|guest|person) (?:will|would)\b/gi, 'You will'],
      [/\b(?:the|a) (?:customer|member|user|guest|person) (?:should|must)\b/gi, 'You should'],
      [/\b(?:the|a) (?:customer|member|user|guest|person) needs?\b/gi, 'You need'],
      [/\b(?:the|a) (?:customer's|member's|user's|guest's|person's)\b/gi, 'Your'],
      
      // "They can..." → "You can..."
      [/\bthey can\b/gi, 'You can'],
      [/\bthey are\b/gi, 'You are'],
      [/\bthey have\b/gi, 'You have'],
      [/\bthey will\b/gi, 'You will'],
      [/\bthey should\b/gi, 'You should'],
      [/\bthey need\b/gi, 'You need'],
      [/\btheir\b/gi, 'Your'],
      [/\bthem\b/gi, 'You'],
    ];
    
    let transformed = response;
    
    // Apply transformations
    for (const [pattern, replacement] of transformations) {
      transformed = transformed.replace(pattern, replacement);
    }
    
    // Clean up any double spaces or weird formatting
    transformed = transformed.trim().replace(/\s+/g, ' ');
    
    // Ensure first letter is capitalized
    if (transformed.length > 0) {
      transformed = transformed.charAt(0).toUpperCase() + transformed.slice(1);
    }
    
    return transformed;
  }
  
  /**
   * Get response count for a conversation and feature
   */
  private async getResponseCount(conversationId: string, featureKey: string): Promise<number> {
    try {
      const result = await db.query(
        `SELECT response_count FROM ai_automation_response_tracking 
         WHERE conversation_id = $1 AND feature_key = $2`,
        [conversationId, featureKey]
      );
      
      return result.rows[0]?.response_count || 0;
    } catch (error) {
      logger.error('Failed to get response count:', error);
      return 0;
    }
  }
  
  /**
   * Increment response count for a conversation and feature
   */
  private async incrementResponseCount(conversationId: string, featureKey: string): Promise<void> {
    try {
      await db.query(
        `INSERT INTO ai_automation_response_tracking 
         (conversation_id, phone_number, feature_key, response_count, last_response_at)
         VALUES ($1, '', $2, 1, NOW())
         ON CONFLICT (conversation_id, feature_key)
         DO UPDATE SET 
           response_count = ai_automation_response_tracking.response_count + 1,
           last_response_at = NOW()`,
        [conversationId, featureKey]
      );
    } catch (error) {
      logger.error('Failed to increment response count:', error);
    }
  }
  
  /**
   * Get max responses allowed for a feature
   */
  private async getMaxResponses(featureKey: string): Promise<number> {
    try {
      const result = await db.query(
        `SELECT config->>'maxResponses' as max_responses 
         FROM ai_automation_features 
         WHERE feature_key = $1`,
        [featureKey]
      );
      
      const maxResponses = parseInt(result.rows[0]?.max_responses || '2');
      return maxResponses;
    } catch (error) {
      logger.error('Failed to get max responses:', error);
      return 2; // Default to 2
    }
  }
}

// Export singleton instance
export const aiAutomationService = new AIAutomationService();