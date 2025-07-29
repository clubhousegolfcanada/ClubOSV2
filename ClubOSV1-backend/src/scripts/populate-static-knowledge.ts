import { db } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

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
  }
];

async function populateStaticKnowledge() {
  console.log('Populating static knowledge base...\n');
  
  try {
    // Check if table exists and create if not
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
    
    console.log('Knowledge base table ready.');
    
    // Insert each knowledge item
    let inserted = 0;
    for (const item of staticKnowledge) {
      try {
        await db.query(`
          INSERT INTO knowledge_base 
          (id, category, subcategory, issue, symptoms, solutions, priority, 
           timeEstimate, customerScript, escalationPath, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING
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
        console.log(`✓ Added: ${item.issue}`);
      } catch (err) {
        console.error(`✗ Failed to add: ${item.issue}`, err);
      }
    }
    
    console.log(`\nSuccessfully added ${inserted} knowledge items.`);
    
    // Show summary
    const summary = await db.query(`
      SELECT category, COUNT(*) as count 
      FROM knowledge_base 
      GROUP BY category
    `);
    
    console.log('\nKnowledge base summary:');
    summary.rows.forEach((row: any) => {
      console.log(`  ${row.category}: ${row.count} items`);
    });
    
  } catch (error) {
    console.error('Error populating knowledge base:', error);
  } finally {
    await db.end();
  }
}

// Run the population
populateStaticKnowledge().catch(console.error);