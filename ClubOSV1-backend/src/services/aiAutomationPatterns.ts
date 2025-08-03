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
      { pattern: /(?:change|modify|different|reschedule).*(?:booking|reservation)/i, weight: 0.7, description: 'Change keywords with booking' }
    ],
    negative: [
      { pattern: /(?:cancel|cancellation)/i, weight: -0.5, description: 'Cancel not change' },
      { pattern: /(?:confirm|confirmation)/i, weight: -0.4, description: 'Confirmation request' },
      { pattern: /(?:new|create|make)\s+(?:a\s+)?(?:booking|reservation)/i, weight: -0.5, description: 'New booking not change' },
      { pattern: /(?:check|view|see)\s+(?:my|our)?\s*(?:booking|reservation)/i, weight: -0.4, description: 'Checking booking not changing' }
    ],
    minConfidence: 0.7
  },
  
  gift_cards: {
    patterns: [
      // Direct mentions with high confidence
      { pattern: /gift\s*cards?/i, weight: 0.4, description: 'Direct gift card mention' },
      { pattern: /gift\s*certificates?/i, weight: 0.4, description: 'Gift certificate mention' },
      { pattern: /e-?gift\s*cards?/i, weight: 0.5, description: 'E-gift card mention' },
      
      // Purchase intent
      { pattern: /(?:buy|purchase|get|order)\s+(?:a\s+)?gift/i, weight: 0.6, description: 'Purchase intent with gift' },
      { pattern: /(?:how|where)\s+(?:do|can)\s+(?:i|we)\s+(?:buy|purchase|get)\s+(?:a\s+)?gift/i, weight: 0.9, description: 'How to purchase gift' },
      { pattern: /(?:want|need|looking\s+for)\s+(?:a\s+)?gift\s*(?:card|certificate)?/i, weight: 0.5, description: 'Want/need gift' },
      
      // Questions about availability
      { pattern: /(?:do|does)\s+(?:you|clubhouse|the club)\s+(?:have|offer|sell)\s+gift/i, weight: 0.7, description: 'Asking if we have gifts' },
      { pattern: /(?:can|could)\s+(?:i|we|someone)\s+(?:buy|get|purchase)\s+(?:a\s+)?gift/i, weight: 0.6, description: 'Can I buy gift' },
      { pattern: /(?:is|are)\s+(?:there|gift)\s+(?:cards?|certificates?)\s+available/i, weight: 0.7, description: 'Gift availability' },
      
      // Present/gift giving context
      { pattern: /(?:birthday|christmas|holiday|anniversary)\s+(?:gift|present)/i, weight: 0.5, description: 'Occasion gift' },
      { pattern: /gift\s+(?:for|to)\s+(?:my|a|someone|friend|family)/i, weight: 0.6, description: 'Gift for someone' },
      { pattern: /present\s+for\s+(?:someone|my|a)/i, weight: 0.4, description: 'Present for someone' },
      { pattern: /surprise\s+(?:gift|someone)/i, weight: 0.4, description: 'Surprise gift' },
      
      // Common variations
      { pattern: /golf\s+gift/i, weight: 0.5, description: 'Golf gift' },
      { pattern: /simulator\s+gift/i, weight: 0.5, description: 'Simulator gift' },
      { pattern: /bay\s+time\s+gift/i, weight: 0.6, description: 'Bay time gift' },
      
      // Indirect mentions
      { pattern: /something\s+for\s+(?:a\s+)?golfer/i, weight: 0.3, description: 'Something for golfer' },
      { pattern: /(?:good|great|perfect)\s+(?:gift|present)\s+(?:idea|option)/i, weight: 0.4, description: 'Gift idea' }
    ],
    negative: [
      { pattern: /(?:received|got|have)\s+(?:a\s+)?gift\s*card/i, weight: -0.5, description: 'Already has gift card' },
      { pattern: /(?:use|redeem|spend)\s+(?:my|a|the)\s+gift\s*card/i, weight: -0.6, description: 'Using existing card' },
      { pattern: /gift\s*card\s+(?:balance|amount|value)/i, weight: -0.5, description: 'Checking balance' },
      { pattern: /(?:lost|missing|stolen)\s+(?:my|a)\s+gift\s*card/i, weight: -0.4, description: 'Lost card' },
      { pattern: /gift\s*card\s+(?:expire|expiration|expired)/i, weight: -0.4, description: 'Expiration question' }
    ],
    minConfidence: 0.7
  },
  
  hours_of_operation: {
    patterns: [
      // Direct time questions
      { pattern: /what\s+(?:are\s+)?(?:your|the)\s+hours/i, weight: 0.9, description: 'What are your hours' },
      { pattern: /(?:what|when)\s+(?:time|hours)\s+(?:do|are)\s+you\s+open/i, weight: 0.9, description: 'What time open' },
      { pattern: /(?:what|when)\s+(?:time|hours)\s+(?:do|are)\s+you\s+close/i, weight: 0.9, description: 'What time close' },
      
      // Open/closed questions
      { pattern: /are\s+you\s+(?:currently\s+)?open/i, weight: 0.8, description: 'Are you open' },
      { pattern: /are\s+you\s+(?:still\s+)?closed/i, weight: 0.8, description: 'Are you closed' },
      { pattern: /(?:is|are)\s+(?:clubhouse|you|the club)\s+open\s+(?:right\s+)?now/i, weight: 0.8, description: 'Open right now' },
      
      // Day-specific questions
      { pattern: /open\s+(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|weekend)/i, weight: 0.8, description: 'Open on specific day' },
      { pattern: /hours\s+(?:on|for)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|weekend)/i, weight: 0.8, description: 'Hours for specific day' },
      
      // Time-specific questions
      { pattern: /open\s+(?:at|until|till)\s+\d+/i, weight: 0.7, description: 'Open at/until time' },
      { pattern: /close\s+(?:at|by)\s+\d+/i, weight: 0.7, description: 'Close at time' },
      { pattern: /\d+\s*(?:am|pm)\s+(?:open|close)/i, weight: 0.7, description: 'Time with open/close' },
      
      // Holiday/special hours
      { pattern: /(?:holiday|christmas|thanksgiving|new\s+year)\s+hours/i, weight: 0.7, description: 'Holiday hours' },
      { pattern: /special\s+hours/i, weight: 0.6, description: 'Special hours' },
      
      // General availability
      { pattern: /when\s+(?:can|could)\s+(?:i|we)\s+(?:come|visit|play)/i, weight: 0.5, description: 'When can I come' },
      { pattern: /(?:latest|earliest)\s+(?:i|we)\s+can\s+(?:book|play|come)/i, weight: 0.6, description: 'Latest/earliest time' },
      
      // Operating/business hours
      { pattern: /(?:operating|business|operation)\s+hours/i, weight: 0.8, description: 'Operating hours' },
      { pattern: /schedule/i, weight: 0.4, description: 'Schedule mention' }
    ],
    negative: [
      { pattern: /(?:book|reserve|reservation)\s+hours/i, weight: -0.3, description: 'Booking hours' },
      { pattern: /happy\s+hour/i, weight: -0.4, description: 'Happy hour' },
      { pattern: /peak\s+hours/i, weight: -0.3, description: 'Peak hours' }
    ],
    minConfidence: 0.6
  },
  
  membership_info: {
    patterns: [
      // Direct membership questions
      { pattern: /(?:tell\s+me\s+about|what\s+(?:is|are))\s+(?:your\s+)?membership/i, weight: 0.9, description: 'Tell about membership' },
      { pattern: /membership\s+(?:info|information|details|options|plans)/i, weight: 0.8, description: 'Membership info' },
      { pattern: /(?:do|does)\s+(?:you|clubhouse)\s+(?:have|offer)\s+membership/i, weight: 0.8, description: 'Do you offer membership' },
      
      // Benefits and perks
      { pattern: /membership\s+(?:benefits|perks|advantages|features)/i, weight: 0.8, description: 'Membership benefits' },
      { pattern: /(?:what\s+do|what\s+does)\s+(?:a\s+)?membership\s+(?:include|get|offer)/i, weight: 0.8, description: 'What membership includes' },
      { pattern: /(?:member|membership)\s+(?:discount|savings|deals)/i, weight: 0.7, description: 'Member discounts' },
      
      // Cost and pricing
      { pattern: /(?:membership|member)\s+(?:cost|price|pricing|fee)/i, weight: 0.8, description: 'Membership cost' },
      { pattern: /how\s+much\s+(?:is|for)\s+(?:a\s+)?membership/i, weight: 0.9, description: 'How much membership' },
      { pattern: /monthly\s+(?:membership|fee|cost)/i, weight: 0.7, description: 'Monthly membership' },
      
      // Joining/signing up
      { pattern: /(?:how|where)\s+(?:do|can)\s+(?:i|we)\s+(?:join|sign\s+up|become\s+a\s+member)/i, weight: 0.9, description: 'How to join' },
      { pattern: /(?:want|interested)\s+(?:to|in)\s+(?:join|joining|membership|becoming\s+a\s+member)/i, weight: 0.8, description: 'Want to join' },
      { pattern: /(?:apply|application)\s+(?:for\s+)?membership/i, weight: 0.7, description: 'Apply for membership' },
      
      // Types of membership
      { pattern: /(?:types|kinds|levels)\s+of\s+membership/i, weight: 0.7, description: 'Types of membership' },
      { pattern: /(?:annual|yearly|monthly)\s+membership/i, weight: 0.6, description: 'Membership duration' },
      { pattern: /(?:individual|family|corporate|group)\s+membership/i, weight: 0.6, description: 'Membership categories' },
      
      // General member questions
      { pattern: /member\s+(?:rate|pricing|access)/i, weight: 0.6, description: 'Member rates' },
      { pattern: /(?:worth|value)\s+(?:it\s+)?(?:to\s+)?(?:get|getting)\s+(?:a\s+)?membership/i, weight: 0.7, description: 'Worth getting membership' }
    ],
    negative: [
      { pattern: /(?:cancel|cancell?ing)\s+(?:my\s+)?membership/i, weight: -0.5, description: 'Cancel membership' },
      { pattern: /(?:already|current)\s+(?:a\s+)?member/i, weight: -0.4, description: 'Already member' },
      { pattern: /(?:renew|renewal)\s+(?:my\s+)?membership/i, weight: -0.4, description: 'Renew membership' },
      { pattern: /member\s+(?:card|number|id)/i, weight: -0.3, description: 'Member card/ID' }
    ],
    minConfidence: 0.6
  }
};

/**
 * Calculate confidence score for a message matching a feature
 */
export function calculateConfidence(
  message: string, 
  feature: keyof typeof automationPatterns
): { confidence: number; matches: string[]; negatives: string[] } {
  const config = automationPatterns[feature];
  const lowerMessage = message.toLowerCase();
  
  let totalScore = 0;
  const matches: string[] = [];
  const negatives: string[] = [];
  
  // Check positive patterns
  for (const { pattern, weight, description } of config.patterns) {
    if (pattern.test(lowerMessage)) {
      totalScore += weight;
      matches.push(description);
    }
  }
  
  // Check negative patterns
  for (const { pattern, weight, description } of config.negative) {
    if (pattern.test(lowerMessage)) {
      totalScore += weight; // weight is already negative
      negatives.push(description);
    }
  }
  
  // Ensure confidence is between 0 and 1
  const confidence = Math.max(0, Math.min(1, totalScore));
  
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