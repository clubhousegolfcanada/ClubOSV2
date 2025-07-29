import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { adminOnly } from '../middleware/roleGuard';
import { db } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const router = Router();

// Essential operational knowledge for Clubhouse 24/7 Golf
const staticKnowledge = [
  // Emergency procedures
  {
    category: 'emergency',
    subcategory: 'fire',
    issue: 'Fire alarm or smoke detected',
    symptoms: ['fire alarm', 'smoke', 'burning smell', 'fire'],
    solutions: [
      'Immediately evacuate all customers through nearest exit',
      'Call 911',
      'Do not attempt to fight the fire',
      'Meet at designated assembly point in parking lot',
      'Account for all customers and staff'
    ],
    priority: 'high',
    timeEstimate: 'Immediate',
    customerScript: 'Please evacuate immediately through the nearest exit. Leave your belongings and proceed to the parking lot.',
    escalationPath: '911 → Manager on call → Owner'
  },
  {
    category: 'emergency',
    subcategory: 'medical',
    issue: 'Customer injury or medical emergency',
    symptoms: ['injury', 'hurt', 'medical emergency', 'unconscious', 'chest pain', 'broken bone'],
    solutions: [
      'Call 911 if serious',
      'Do not move injured person unless in immediate danger',
      'Provide first aid if trained',
      'Clear area around injured person',
      'Document incident thoroughly'
    ],
    priority: 'high',
    timeEstimate: 'Immediate',
    customerScript: 'Help is on the way. Please remain calm and try not to move.',
    escalationPath: '911 → Manager → Insurance company'
  },
  {
    category: 'emergency',
    subcategory: 'security',
    issue: 'Security threat or suspicious behavior',
    symptoms: ['threat', 'suspicious', 'violence', 'weapon', 'threatening'],
    solutions: [
      'Do not confront the individual',
      'Call 911 immediately',
      'Lock doors if safe to do so',
      'Alert other staff discretely',
      'Preserve any video evidence'
    ],
    priority: 'high',
    timeEstimate: 'Immediate',
    customerScript: 'Your safety is our priority. Please move to a secure area.',
    escalationPath: '911 → Manager → Owner'
  },
  
  // Technical support
  {
    category: 'tech',
    subcategory: 'trackman',
    issue: 'TrackMan screen is frozen',
    symptoms: ['trackman frozen', 'screen frozen', 'trackman not responding', 'stuck', 'wont work'],
    solutions: [
      'Press and hold power button on TrackMan unit for 10 seconds',
      'Wait 30 seconds, then power back on',
      'If still frozen, restart the computer from NinjaOne',
      'Check all cable connections',
      'Verify TrackMan software is running (should auto-start)'
    ],
    priority: 'medium',
    timeEstimate: '5-10 minutes',
    customerScript: 'I can fix that for you right away. Give me just a moment to restart the system.',
    escalationPath: 'Tech Support → TrackMan Support (1-800-XXX-XXXX)'
  },
  {
    category: 'tech',
    subcategory: 'trackman',
    issue: 'Ball not being detected by TrackMan',
    symptoms: ['ball not detected', 'no ball flight', 'trackman not reading', 'sensor issue', 'not tracking'],
    solutions: [
      'Check ball placement - must be on designated tee area',
      'Clean camera lenses with microfiber cloth',
      'Verify lighting is adequate',
      'Check for obstructions in camera view',
      'Calibrate sensors if needed (Settings → Calibration)'
    ],
    priority: 'medium',
    timeEstimate: '3-5 minutes',
    customerScript: 'Let me check the sensors for you. Sometimes they just need a quick adjustment.',
    escalationPath: 'Tech Support → TrackMan Support'
  },
  {
    category: 'tech',
    subcategory: 'display',
    issue: 'Projector or screen issues',
    symptoms: ['no picture', 'projector off', 'black screen', 'display problem', 'cant see'],
    solutions: [
      'Check projector power and connections',
      'Verify HDMI cable is connected properly',
      'Use NinjaOne to restart display software',
      'Check projector filter (may need cleaning)',
      'Adjust projector settings if image is distorted'
    ],
    priority: 'medium',
    timeEstimate: '5-10 minutes',
    customerScript: 'Let me get that display working for you. This usually just takes a moment to fix.',
    escalationPath: 'Tech Support → AV Contractor'
  },
  
  // Booking & Access
  {
    category: 'booking',
    subcategory: 'access',
    issue: 'Customer locked out - forgot door code',
    symptoms: ['locked out', 'cant get in', 'forgot code', 'door wont open', 'access denied'],
    solutions: [
      'Verify customer identity through booking system',
      'Check their booking is active and paid',
      'Provide temporary access code',
      'Reset their permanent code if needed',
      'Test door access before ending support'
    ],
    priority: 'high',
    timeEstimate: '2-3 minutes',
    customerScript: 'I can help you get in right away. Let me just verify your booking first.',
    escalationPath: 'Support → Manager'
  },
  {
    category: 'booking',
    subcategory: 'refund',
    issue: 'Customer requesting refund',
    symptoms: ['refund', 'money back', 'cancel booking', 'charge dispute'],
    solutions: [
      'Check refund policy (24 hours notice required)',
      'Verify reason for refund request',
      'Process through booking system if eligible',
      'Offer credit for future use as alternative',
      'Document reason and resolution'
    ],
    priority: 'medium',
    timeEstimate: '5-10 minutes',
    customerScript: 'I understand you need a refund. Let me check your booking and our policy to see what I can do for you.',
    escalationPath: 'Support → Manager → Owner'
  },
  {
    category: 'booking',
    subcategory: 'modification',
    issue: 'Customer wants to change booking time',
    symptoms: ['change time', 'reschedule', 'different time', 'modify booking'],
    solutions: [
      'Check availability for requested time',
      'Modify booking in system',
      'Send confirmation email',
      'Update access code if needed',
      'Verify customer has new details'
    ],
    priority: 'low',
    timeEstimate: '3-5 minutes',
    customerScript: 'I can help you change your booking time. Let me check availability for you.',
    escalationPath: 'None'
  },
  
  // Brand/General info
  {
    category: 'brand',
    subcategory: 'hours',
    issue: 'What are your hours of operation?',
    symptoms: ['hours', 'open', 'closed', 'what time', 'when open'],
    solutions: [
      'We are open 24/7 for members',
      'Walk-ins welcome based on availability',
      'Busiest times: Weekdays 5-8pm, Weekends 10am-6pm',
      'Booking recommended for peak times'
    ],
    priority: 'low',
    timeEstimate: '1 minute',
    customerScript: 'We\'re open 24/7! Members can access anytime with their code, and walk-ins are welcome based on availability.',
    escalationPath: 'None'
  },
  {
    category: 'brand',
    subcategory: 'membership',
    issue: 'How do I become a member?',
    symptoms: ['membership', 'member', 'join', 'sign up', 'monthly'],
    solutions: [
      'Visit our website to sign up online',
      'Choose from monthly or annual plans',
      'Members get 24/7 access and discounted rates',
      'First month includes 2 free guest passes',
      'Corporate memberships available'
    ],
    priority: 'low',
    timeEstimate: '2 minutes',
    customerScript: 'Becoming a member is easy! You can sign up on our website or I can help you right now. We have monthly and annual options.',
    escalationPath: 'Sales team'
  },
  {
    category: 'brand',
    subcategory: 'pricing',
    issue: 'What are your rates?',
    symptoms: ['price', 'cost', 'how much', 'rates', 'expensive'],
    solutions: [
      'Hourly rates vary by time and day',
      'Members receive 20-30% discount',
      'Group packages available',
      'Check website for current pricing',
      'Happy hour specials on weekdays'
    ],
    priority: 'low',
    timeEstimate: '2 minutes',
    customerScript: 'Our rates vary by time and day. Members get significant discounts. Would you like to hear about our membership options?',
    escalationPath: 'Sales team'
  }
];

// Get static knowledge status
router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const count = await db.query('SELECT COUNT(*) as count FROM knowledge_base');
    const categories = await db.query(`
      SELECT category, COUNT(*) as count 
      FROM knowledge_base 
      GROUP BY category
    `);
    
    res.json({
      success: true,
      data: {
        total: count.rows[0].count,
        byCategory: categories.rows
      }
    });
  } catch (error) {
    logger.error('Failed to get knowledge status:', error);
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

// Initialize static knowledge base
router.post('/initialize', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    // Create table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id UUID PRIMARY KEY,
        category VARCHAR(50) NOT NULL,
        subcategory VARCHAR(50),
        issue TEXT NOT NULL,
        symptoms TEXT[] NOT NULL,
        solutions TEXT[] NOT NULL,
        priority VARCHAR(20),
        timeEstimate VARCHAR(50),
        customerScript TEXT,
        escalationPath TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Check if already populated
    const existing = await db.query('SELECT COUNT(*) as count FROM knowledge_base');
    if (existing.rows[0].count > 0) {
      return res.json({
        success: true,
        message: 'Knowledge base already initialized',
        count: existing.rows[0].count
      });
    }
    
    // Insert knowledge items
    let inserted = 0;
    const errors: any[] = [];
    
    for (const item of staticKnowledge) {
      try {
        await db.query(`
          INSERT INTO knowledge_base 
          (id, category, subcategory, issue, symptoms, solutions, priority, 
           timeEstimate, customerScript, escalationPath, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          uuidv4(),
          item.category,
          item.subcategory,
          item.issue,
          item.symptoms,
          item.solutions,
          item.priority,
          item.timeEstimate,
          item.customerScript,
          item.escalationPath,
          {}
        ]);
        inserted++;
      } catch (err) {
        errors.push({ issue: item.issue, error: err });
      }
    }
    
    res.json({
      success: true,
      message: 'Static knowledge base initialized',
      inserted,
      total: staticKnowledge.length,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    logger.error('Failed to initialize knowledge base:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to initialize knowledge base' 
    });
  }
});

// Clear static knowledge (admin only)
router.delete('/clear', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await db.query('DELETE FROM knowledge_base');
    res.json({
      success: true,
      message: 'Static knowledge base cleared',
      deleted: result.rowCount
    });
  } catch (error) {
    logger.error('Failed to clear knowledge base:', error);
    res.status(500).json({ success: false, error: 'Failed to clear' });
  }
});

export default router;