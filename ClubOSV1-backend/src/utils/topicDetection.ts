/**
 * Topic Detection Utility for V3-PLS
 *
 * Detects message topics from content using pattern keywords.
 * Used for topic-aware operator lockouts - allows AI to respond to
 * different topics while keeping the same topic locked.
 *
 * @version v1.25.38
 */

export type MessageTopic =
  | 'booking'
  | 'tech_support'
  | 'access'
  | 'gift_cards'
  | 'hours'
  | 'pricing'
  | 'membership'
  | 'general';

interface TopicPattern {
  topic: MessageTopic;
  patterns: RegExp[];
  priority: number; // Higher priority checked first
}

/**
 * Topic patterns with priority ordering.
 * More specific topics have higher priority to avoid false matches.
 */
const TOPIC_PATTERNS: TopicPattern[] = [
  {
    topic: 'tech_support',
    priority: 100,
    patterns: [
      /broken|stuck|frozen|not\s*working|doesn'?t\s*work|won'?t\s*(start|turn|work)/i,
      /trackman|simulator|sim\b|screen|projector|sensor|camera|mic|microphone/i,
      /black\s*screen|blank\s*screen|no\s*display|error|crash|glitch|bug/i,
      /restart|reboot|reset|turn\s*(on|off)|power/i,
      /lag|slow|freeze|unresponsiv/i,
    ]
  },
  {
    topic: 'access',
    priority: 90,
    patterns: [
      /door|code|access|get\s*in|locked|unlock|entry|pin|keypad/i,
      /can'?t\s*(get\s*in|enter|open)|let\s*me\s*in/i,
      /gate|entrance|exit/i,
    ]
  },
  {
    topic: 'booking',
    priority: 80,
    patterns: [
      /book|reserv|tee\s*time|schedule|appointment|slot/i,
      /cancel|reschedule|extend|change\s*(my|the)\s*(time|booking|reservation)/i,
      /availab|open\s*(slot|time|bay)/i,
      /when\s*can\s*i\s*(come|book|play)/i,
    ]
  },
  {
    topic: 'gift_cards',
    priority: 70,
    patterns: [
      /gift\s*card|voucher|certificate/i,
      /purchase\s*(a\s*)?(gift|card)|buy\s*(a\s*)?(gift|card)/i,
      /redeem|balance/i,
    ]
  },
  {
    topic: 'pricing',
    priority: 60,
    patterns: [
      /price|cost|how\s*much|rate|fee|charge/i,
      /per\s*(hour|person|session)|hourly/i,
      /discount|deal|promo|coupon/i,
    ]
  },
  {
    topic: 'membership',
    priority: 55,
    patterns: [
      /member|subscription|plan|package/i,
      /sign\s*up|join|enroll/i,
      /monthly|annual|yearly/i,
    ]
  },
  {
    topic: 'hours',
    priority: 50,
    patterns: [
      /hours?|open|close|closing|when\s*(do\s*you|are\s*you)/i,
      /what\s*time|until\s*when/i,
      /today|tomorrow|weekend|holiday/i,
    ]
  },
];

/**
 * Detect the topic of a message based on its content.
 * Returns the highest priority matching topic, or 'general' if no match.
 *
 * @param message - The message text to analyze
 * @returns The detected topic category
 *
 * @example
 * detectMessageTopic("Can I book a bay for 5pm?") // 'booking'
 * detectMessageTopic("The TrackMan is frozen") // 'tech_support'
 * detectMessageTopic("Hello!") // 'general'
 */
export function detectMessageTopic(message: string): MessageTopic {
  if (!message || typeof message !== 'string') {
    return 'general';
  }

  const normalizedMessage = message.toLowerCase().trim();

  // Sort by priority (highest first)
  const sortedPatterns = [...TOPIC_PATTERNS].sort((a, b) => b.priority - a.priority);

  for (const topicPattern of sortedPatterns) {
    for (const pattern of topicPattern.patterns) {
      if (pattern.test(normalizedMessage)) {
        return topicPattern.topic;
      }
    }
  }

  return 'general';
}

/**
 * Get all available topic categories.
 * Useful for UI display and documentation.
 */
export function getAvailableTopics(): MessageTopic[] {
  return ['booking', 'tech_support', 'access', 'gift_cards', 'hours', 'pricing', 'membership', 'general'];
}

/**
 * Check if two topics are the same (for lockout comparison).
 * 'general' topic is treated as distinct from all other topics.
 */
export function isSameTopic(topic1: MessageTopic | string | null, topic2: MessageTopic | string | null): boolean {
  // Null/undefined treated as general
  const t1 = topic1 || 'general';
  const t2 = topic2 || 'general';

  return t1 === t2;
}

/**
 * Get a human-readable label for a topic.
 */
export function getTopicLabel(topic: MessageTopic): string {
  const labels: Record<MessageTopic, string> = {
    booking: 'Booking & Reservations',
    tech_support: 'Technical Support',
    access: 'Door & Access',
    gift_cards: 'Gift Cards',
    hours: 'Hours & Schedule',
    pricing: 'Pricing & Rates',
    membership: 'Membership',
    general: 'General Inquiry',
  };

  return labels[topic] || 'General Inquiry';
}
