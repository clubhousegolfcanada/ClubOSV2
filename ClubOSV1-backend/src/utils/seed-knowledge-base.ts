import { query } from './db';
import { logger } from './logger';

// Sample knowledge base data for ClubOS
const knowledgeBaseData = [
  // Booking & Access issues
  {
    category: 'booking',
    subcategory: 'access',
    issue: 'Door won\'t unlock with access code',
    symptoms: ['door locked', 'access code not working', 'can\'t get in', 'locked out'],
    solutions: [
      'Verify access code is correct and active',
      'Check if booking is for current time',
      'Try manual override: hold # for 3 seconds then enter code',
      'Contact support for remote unlock'
    ],
    priority: 'high',
    time_estimate: '2-5 minutes',
    customer_script: 'I understand you\'re having trouble accessing the facility. Let me help you get in. First, can you confirm your booking time and the access code you\'re using?',
    escalation_path: 'If code verification fails, contact on-call support for remote unlock'
  },
  {
    category: 'booking',
    subcategory: 'cancellation',
    issue: 'Customer wants to cancel booking and get refund',
    symptoms: ['cancel booking', 'refund', 'return booking', 'cancel reservation'],
    solutions: [
      'Check cancellation policy (24 hours notice for full refund)',
      'Process cancellation in booking system',
      'Initiate refund through payment processor',
      'Send confirmation email'
    ],
    priority: 'medium',
    time_estimate: '5-10 minutes',
    customer_script: 'I can help you cancel your booking. Per our policy, cancellations made 24+ hours in advance receive a full refund. Let me check your booking details.',
    escalation_path: 'For disputes or special circumstances, escalate to manager'
  },
  
  // Technical Support issues
  {
    category: 'technical',
    subcategory: 'trackman',
    issue: 'TrackMan not detecting shots',
    symptoms: ['trackman not working', 'no shot data', 'trackman frozen', 'not detecting'],
    solutions: [
      'Restart TrackMan unit (power button on back)',
      'Check ball placement on tee (must be in detection zone)',
      'Verify camera lens is clean',
      'Recalibrate if needed (Settings > Calibrate)'
    ],
    priority: 'high',
    time_estimate: '5-15 minutes',
    customer_script: 'I see the TrackMan isn\'t detecting your shots. This is usually a quick fix. First, let\'s try restarting the unit - there\'s a power button on the back. Hold it for 5 seconds.',
    escalation_path: 'If restart fails, dispatch technician'
  },
  {
    category: 'technical',
    subcategory: 'display',
    issue: 'Projector screen is black or frozen',
    symptoms: ['screen black', 'display frozen', 'no image', 'projector not working'],
    solutions: [
      'Check projector power and connections',
      'Restart simulator computer',
      'Switch HDMI input source',
      'Reset display settings in TrackMan software'
    ],
    priority: 'high',
    time_estimate: '10-20 minutes',
    customer_script: 'I understand the display isn\'t working properly. Let\'s troubleshoot this together. Can you see if the projector power light is on?',
    escalation_path: 'If hardware issue suspected, schedule maintenance'
  },
  
  // Emergency issues
  {
    category: 'emergency',
    subcategory: 'medical',
    issue: 'Customer injury or medical emergency',
    symptoms: ['injury', 'hurt', 'medical emergency', 'accident', 'fell', 'hit by club'],
    solutions: [
      'Call 911 immediately for serious injuries',
      'Provide first aid kit location (front desk)',
      'Document incident for insurance',
      'Contact facility manager'
    ],
    priority: 'urgent',
    time_estimate: 'Immediate',
    customer_script: 'I\'m very concerned about your safety. Are you seriously injured? If you need immediate medical attention, please call 911. We have a first aid kit at the front desk.',
    escalation_path: 'Always escalate medical emergencies to manager and call 911 if needed'
  },
  {
    category: 'emergency',
    subcategory: 'facility',
    issue: 'Power outage affecting facility',
    symptoms: ['power out', 'no electricity', 'lights out', 'everything off'],
    solutions: [
      'Check main breaker panel',
      'Verify if outage is building-wide or local',
      'Contact utility company if widespread',
      'Activate emergency lighting if available'
    ],
    priority: 'urgent',
    time_estimate: '30-60 minutes',
    customer_script: 'I see we\'re experiencing a power issue. For your safety, please remain calm. Emergency lighting should activate shortly. Let me check if this is affecting the entire facility.',
    escalation_path: 'Contact facility manager and utility company immediately'
  },
  
  // General/Brand inquiries
  {
    category: 'general',
    subcategory: 'membership',
    issue: 'Membership pricing and benefits inquiry',
    symptoms: ['membership cost', 'membership benefits', 'pricing', 'how much', 'rates'],
    solutions: [
      'Provide current membership tiers and pricing',
      'Explain member benefits (priority booking, discounts)',
      'Offer trial membership if available',
      'Schedule tour if interested'
    ],
    priority: 'low',
    time_estimate: '5-10 minutes',
    customer_script: 'I\'d be happy to tell you about our membership options! We have several tiers designed to fit different playing frequencies and budgets. Would you like to hear about our most popular option?',
    escalation_path: 'For custom packages or group rates, connect with sales team'
  }
];

export async function seedKnowledgeBase() {
  try {
    logger.info('Seeding knowledge base with sample data...');
    
    // Check if data already exists
    const existing = await query('SELECT COUNT(*) as count FROM knowledge_base');
    if (existing.rows[0].count > 0) {
      logger.info('Knowledge base already has data, skipping seed');
      return;
    }
    
    // Insert sample data
    for (const item of knowledgeBaseData) {
      await query(
        `INSERT INTO knowledge_base 
         (category, subcategory, issue, symptoms, solutions, priority, 
          time_estimate, customer_script, escalation_path, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          item.category,
          item.subcategory,
          item.issue,
          item.symptoms,
          item.solutions,
          item.priority,
          item.time_estimate,
          item.customer_script,
          item.escalation_path,
          JSON.stringify({})
        ]
      );
    }
    
    logger.info(`✅ Seeded knowledge base with ${knowledgeBaseData.length} items`);
  } catch (error) {
    logger.error('Failed to seed knowledge base:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedKnowledgeBase()
    .then(() => {
      logger.info('Knowledge base seeding completed');
      process.exit(0);
    })
    .catch(err => {
      logger.error('Knowledge base seeding failed:', err);
      process.exit(1);
    });
}