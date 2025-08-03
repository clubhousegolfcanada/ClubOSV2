/**
 * Advanced pattern matching for AI automations
 * Uses multiple detection strategies for better accuracy
 */

interface PatternMatch {
  pattern: RegExp;
  weight: number;
  description: string;
}

interface NegativePattern {
  pattern: RegExp;
  weight: number;
  description: string;
}

export const automationPatterns = {
  booking_change: {
    patterns: [
      // Direct change requests
      { pattern: /(?:can|could)\s+(?:i|we)\s+(?:change|modify|update|move)\s+(?:my|our|the)?\s*(?:booking|reservation|time|slot)/i, weight: 0.9, description: 'Can I change my booking' },
      { pattern: /(?:can|could)\s+you\s+(?:change|modify|update|move)\s+(?:my|our|the)?\s*(?:booking|reservation|time|slot)/i, weight: 0.9, description: 'Can you change my booking' },
      { pattern: /(?:need|want)\s+to\s+(?:change|modify|update|move)\s+(?:my|our|the)?\s*(?:booking|reservation|time|slot)/i, weight: 0.9, description: 'Need to change booking' },
      { pattern: /(?:how|is it possible)\s+to\s+(?:change|modify|update|move)\s+(?:my|our|the)?\s*(?:booking|reservation)/i, weight: 0.8, description: 'How to change booking' },
      
      // Reschedule mentions
      { pattern: /(?:reschedule|re-schedule)\s+(?:my|our|the)?\s*(?:booking|reservation|time|slot)?/i, weight: 0.9, description: 'Reschedule booking' },
      { pattern: /(?:can|could)\s+(?:i|we)\s+reschedule/i, weight: 0.9, description: 'Can I reschedule' },
      
      // Time/date change requests
      { pattern: /(?:change|move)\s+(?:it|this|that)\s+to\s+(?:a\s+)?(?:different|another|new)\s+(?:time|date|day)/i, weight: 0.8, description: 'Change to different time' },
      { pattern: /(?:different|another|new)\s+(?:time|date|day)\s+(?:for|instead)/i, weight: 0.7, description: 'Different time request' },
      
      // Modification requests
      { pattern: /(?:modify|adjustment|alteration)\s+(?:to\s+)?(?:my|our|the)?\s*(?:booking|reservation)/i, weight: 0.8, description: 'Modify booking' },
      { pattern: /(?:make|need)\s+(?:a\s+)?(?:change|modification|adjustment)\s+to\s+(?:my|our|the)?\s*(?:booking|reservation)/i, weight: 0.8, description: 'Make change to booking' },
      
      // Switch/swap mentions
      { pattern: /(?:switch|swap)\s+(?:my|our|the)?\s*(?:booking|reservation|time|slot)/i, weight: 0.8, description: 'Switch booking' },
      { pattern: /(?:move|change)\s+(?:my|our|the)?\s*(?:booking|reservation)\s+(?:from|to)/i, weight: 0.8, description: 'Move booking from/to' },
      
      // Earlier/later requests
      { pattern: /(?:earlier|later|sooner)\s+(?:time|slot|booking|reservation)/i, weight: 0.7, description: 'Earlier/later time' },
      { pattern: /(?:push|move)\s+(?:back|forward|up)\s+(?:my|our|the)?\s*(?:booking|reservation|time)/i, weight: 0.8, description: 'Push booking back/forward' },
      
      // General booking questions with change intent
      { pattern: /(?:booking|reservation).*(?:change|modify|different|reschedule)/i, weight: 0.7, description: 'Booking with change keywords' },
      { pattern: /(?:change|modify|different|reschedule).*(?:booking|reservation)/i, weight: 0.7, description: 'Change keywords with booking' },
      
      // Change gift card order - might be about changing a booking for gift card purchase
      { pattern: /(?:change|modify|update).*gift\s*card.*order/i, weight: 0.5, description: 'Change gift card order' }
    ],
    negative: [
      { pattern: /(?:new|first|initial)\s+(?:booking|reservation)/i, weight: -0.4, description: 'New booking request' },
      { pattern: /(?:make|create|book)\s+(?:a\s+)?(?:booking|reservation)/i, weight: -0.4, description: 'Create booking' },
      { pattern: /(?:cancel|delete|remove)\s+(?:my\s+)?(?:booking|reservation)/i, weight: -0.3, description: 'Cancel booking' }
    ],
    minConfidence: 0.7
  },
  
  gift_cards: {
    patterns: [
      // Direct mentions with high confidence
      { pattern: /gift\s*cards?/i, weight: 0.4, description: 'Direct gift card mention' },
      { pattern: /gift\s*certificates?/i, weight: 0.4, description: 'Gift certificate mention' },
      { pattern: /gift\s*vouchers?/i, weight: 0.35, description: 'Gift voucher mention' },
      
      // Purchase/buy intent
      { pattern: /(?:buy|purchase|get)\s+(?:a\s+)?gift\s*(?:card|certificate|voucher)/i, weight: 0.9, description: 'Buy gift card' },
      { pattern: /(?:where|how)\s+(?:can|do)\s+(?:i|we)\s+(?:buy|purchase|get)\s+(?:a\s+)?gift/i, weight: 0.8, description: 'Where to buy gift' },
      { pattern: /(?:sell|offer|have)\s+gift\s*(?:cards?|certificates?|vouchers?)/i, weight: 0.8, description: 'Sell gift cards' },
      
      // Gift-giving intent
      { pattern: /(?:give|send)\s+(?:a\s+)?gift\s*(?:card|certificate|voucher)/i, weight: 0.7, description: 'Give gift card' },
      { pattern: /gift\s*(?:card|certificate|voucher)\s+(?:for|as)\s+(?:a\s+)?(?:present|gift|birthday|christmas)/i, weight: 0.8, description: 'Gift card as present' },
      { pattern: /gift\s*(?:card|certificate|voucher)\s+for\s+(?:my\s+)?(?:someone|friend|family|him|her|them)/i, weight: 0.8, description: 'Gift card for someone' },
      { pattern: /(?:present|gift)\s+for\s+(?:someone|friend|family|him|her|them)/i, weight: 0.5, description: 'Present for someone' },
      
      // Questions about gift cards
      { pattern: /(?:do|does)\s+(?:you|clubhouse)\s+(?:sell|offer|have)\s+gift/i, weight: 0.8, description: 'Do you sell gift' },
      { pattern: /(?:can|could)\s+(?:i|we)\s+(?:buy|purchase|get)\s+(?:a\s+)?gift/i, weight: 0.8, description: 'Can I buy gift' },
      { pattern: /gift\s*card\s+(?:options|choices|amounts|denominations)/i, weight: 0.7, description: 'Gift card options' },
      
      // Online/physical mentions
      { pattern: /(?:online|website|digital|physical)\s+gift\s*(?:cards?|certificates?)/i, weight: 0.7, description: 'Online gift cards' },
      { pattern: /gift\s*(?:cards?|certificates?)\s+(?:online|website|digital|physical)/i, weight: 0.7, description: 'Gift cards online' },
      
      // Value/amount questions
      { pattern: /(?:how\s+much|what\s+amounts?|denominations?)\s+(?:for\s+)?gift\s*(?:cards?|certificates?)/i, weight: 0.7, description: 'Gift card amounts' },
      { pattern: /\$\d+\s+gift\s*(?:card|certificate)/i, weight: 0.8, description: 'Dollar amount gift card' },
      
      // General gift inquiries
      { pattern: /(?:looking|searching)\s+for\s+(?:a\s+)?gift/i, weight: 0.4, description: 'Looking for gift' },
      { pattern: /(?:need|want)\s+(?:a\s+)?gift\s+(?:idea|suggestion)/i, weight: 0.3, description: 'Need gift idea' },
      
      // Gift card order changes/management
      { pattern: /gift\s*card.*order/i, weight: 0.5, description: 'Gift card order' }
    ],
    negative: [
      { pattern: /(?:redeem|use|activate|check)\s+(?:my\s+)?gift\s*card/i, weight: -0.4, description: 'Redeem gift card' },
      { pattern: /gift\s*card\s+(?:balance|number|code)/i, weight: -0.4, description: 'Gift card balance' },
      { pattern: /(?:lost|stolen|expired)\s+gift\s*card/i, weight: -0.3, description: 'Lost gift card' },
      { pattern: /gift\s*card\s+(?:not|isn't|won't)\s+work/i, weight: -0.3, description: 'Gift card not working' }
    ],
    minConfidence: 0.7
  },
  
  trackman_reset: {
    patterns: [
      // Direct trackman mentions with issues
      { pattern: /trackman.*(?:frozen|stuck|freeze|hang|not\s+work|broken|issue|problem|error)/i, weight: 0.9, description: 'Trackman frozen/stuck' },
      { pattern: /(?:frozen|stuck|freeze|hang|not\s+work|broken|issue|problem|error).*trackman/i, weight: 0.9, description: 'Issue with trackman' },
      
      // Reset/reboot requests
      { pattern: /(?:reset|reboot|restart|power\s+cycle).*trackman/i, weight: 0.9, description: 'Reset trackman' },
      { pattern: /trackman.*(?:reset|reboot|restart|power\s+cycle)/i, weight: 0.9, description: 'Trackman reset' },
      
      // Bay-specific mentions
      { pattern: /bay\s+\d+.*trackman.*(?:frozen|stuck|not\s+work|broken)/i, weight: 0.85, description: 'Bay X trackman issue' },
      { pattern: /trackman.*bay\s+\d+.*(?:frozen|stuck|not\s+work|broken)/i, weight: 0.85, description: 'Trackman bay X issue' },
      
      // General trackman problems
      { pattern: /trackman.*(?:won't|wont|cant|can't)\s+(?:start|load|work)/i, weight: 0.8, description: 'Trackman won\'t start' },
      { pattern: /trackman.*(?:black\s+screen|blank\s+screen|no\s+display)/i, weight: 0.8, description: 'Trackman screen issue' },
      { pattern: /trackman.*(?:crashed|crash|freezing|hanging)/i, weight: 0.8, description: 'Trackman crashed' },
      
      // Help requests
      { pattern: /(?:help|fix|check).*trackman/i, weight: 0.7, description: 'Help with trackman' },
      { pattern: /trackman.*(?:help|fix|check)/i, weight: 0.7, description: 'Trackman help' },
      
      // Not responding
      { pattern: /trackman.*(?:not|isn't|isnt)\s+(?:responding|response)/i, weight: 0.8, description: 'Trackman not responding' },
      { pattern: /trackman.*(?:unresponsive|dead|down)/i, weight: 0.8, description: 'Trackman unresponsive' }
    ],
    negative: [
      { pattern: /trackman.*(?:work|fine|good|great|perfect)/i, weight: -0.8, description: 'Trackman working fine' },
      { pattern: /love.*trackman/i, weight: -0.6, description: 'Positive trackman mention' },
      { pattern: /trackman.*(?:accurate|amazing|awesome)/i, weight: -0.6, description: 'Positive trackman feedback' }
    ],
    minConfidence: 0.7
  }
};

/**
 * Calculate confidence score for a message matching a feature
 */
export function calculateConfidence(
  message: string, 
  feature: keyof typeof automationPatterns
): {
  confidence: number;
  matches: string[];
  negatives: string[];
} {
  const patterns = automationPatterns[feature];
  const normalizedMessage = message.toLowerCase();
  
  let totalWeight = 0;
  const matches: string[] = [];
  const negatives: string[] = [];
  
  // Check positive patterns
  patterns.patterns.forEach(({ pattern, weight, description }) => {
    if (pattern.test(normalizedMessage)) {
      totalWeight += weight;
      matches.push(description);
    }
  });
  
  // Check negative patterns
  patterns.negative.forEach(({ pattern, weight, description }) => {
    if (pattern.test(normalizedMessage)) {
      totalWeight += weight; // Weight is already negative
      negatives.push(description);
    }
  });
  
  // Normalize confidence to 0-1 range
  // For better scoring, we'll consider confidence based on the highest weighted pattern
  // rather than the sum of all patterns (which would require matching everything)
  const maxSingleWeight = Math.max(...patterns.patterns.map(p => p.weight));
  const confidence = Math.max(0, Math.min(1, totalWeight));
  
  return { confidence, matches, negatives };
}

/**
 * Find the best matching automation for a message
 */
export function findBestAutomation(message: string): {
  feature: string | null;
  confidence: number;
  matches: string[];
  negatives: string[];
} {
  let bestMatch = {
    feature: null as string | null,
    confidence: 0,
    matches: [] as string[],
    negatives: [] as string[]
  };
  
  for (const feature of Object.keys(automationPatterns) as Array<keyof typeof automationPatterns>) {
    const result = calculateConfidence(message, feature);
    const minConfidence = automationPatterns[feature].minConfidence;
    
    if (result.confidence >= minConfidence && result.confidence > bestMatch.confidence) {
      bestMatch = {
        feature,
        confidence: result.confidence,
        matches: result.matches,
        negatives: result.negatives
      };
    }
  }
  
  return bestMatch;
}