import { db } from '../utils/database';
import { logger } from '../utils/logger';

// Your ClubOS knowledge content
const knowledgeContent = [
  {
    problem: "What is ClubOS Support Subscription?",
    solution: "ClubOS Support Subscription is built by real sim operators, for unattended facilities that need real support. It provides 24/7 embedded support to replace the chaos of relying on owners or part-timers for late-night tech issues, system resets, refund calls, access issues, or booking disputes.",
    category: "general",
    confidence: 0.9
  },
  {
    problem: "What support does ClubOS provide outside the sim?",
    solution: "Outside-the-sim support handles customer questions before/after sessions including: booking/payment issues, access problems, forgotten items, and general questions. It works through QR code signage in every bay for instant SMS support, a facility support line (text-only), answers matched to your pre-filled policies, and all interactions are logged.",
    category: "general",
    confidence: 0.9
  },
  {
    problem: "What support does ClubOS provide inside the sim?",
    solution: "Inside-the-sim support helps during live sessions with: TrackMan/Foresight troubleshooting, remote resets, live SMS walk-throughs, and optional video monitoring. Setup includes secure remote desktop software, discreet bay camera (1 per bay), ClubOS intake form, access system (Kisi/Ubiquiti), UPS backup (recommended), and booking/refund access.",
    category: "tech",
    confidence: 0.9
  },
  {
    problem: "What makes ClubOS different?",
    solution: "ClubOS has REAL PEOPLE - 100% operator-led with 5+ sim support specialists who complete refunds based on your SOP when needed. You only get involved if we can't solve it. FULL TRANSPARENCY - Every ticket logged, timestamped session data, and monthly insights and escalation trends.",
    category: "general",
    confidence: 0.9
  },
  {
    problem: "What are ClubOS performance metrics?",
    solution: "ClubOS has proven results: 10,000+ bookings supported, 220+ 5-star customer reviews, 99.98% resolution without owner involvement, and estimated response time to customer is less than 1 minute with fixes in less than 5 minutes.",
    category: "general",
    confidence: 0.9
  },
  {
    problem: "What is ClubOS pricing?",
    solution: "ClubOS pricing: $2500 initial setup cost, $500 per simulator per month (1-2 days revenue in season) to be almost fully hands off and able to open more locations. Limits are in place for negligence issues.",
    category: "general",
    confidence: 0.9
  },
  {
    problem: "What is 7iron?",
    solution: "7iron is a golf club, specifically an iron used for medium-distance shots, typically 130-170 yards depending on the player's skill level.",
    category: "brand",
    confidence: 0.8
  },
  {
    problem: "What is fan in golf context?",
    solution: "In golf, 'fan' can refer to either spectators who enjoy watching golf, or the motion of fanning the club face open during the swing.",
    category: "brand",
    confidence: 0.8
  },
  {
    problem: "What is bettergolf?",
    solution: "BetterGolf refers to improvement techniques, training methods, and resources designed to help golfers enhance their game and lower their scores.",
    category: "brand",
    confidence: 0.8
  },
  {
    problem: "Who is Nick in golf?",
    solution: "Nick could refer to various golf professionals or instructors. Without more context, this could be Nick Faldo, Nick Price, or a local golf instructor named Nick.",
    category: "brand",
    confidence: 0.7
  }
];

async function importKnowledge() {
  try {
    logger.info('Starting knowledge import to database...');
    
    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS extracted_knowledge (
        id SERIAL PRIMARY KEY,
        category VARCHAR(50) NOT NULL,
        problem TEXT NOT NULL,
        solution TEXT NOT NULL,
        confidence FLOAT DEFAULT 0.8,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Import each knowledge item
    let imported = 0;
    for (const item of knowledgeContent) {
      try {
        await db.query(`
          INSERT INTO extracted_knowledge (category, problem, solution, confidence, metadata)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          item.category,
          item.problem,
          item.solution,
          item.confidence,
          { source: 'manual_import', importDate: new Date().toISOString() }
        ]);
        imported++;
        logger.info(`Imported: ${item.problem.substring(0, 50)}...`);
      } catch (err) {
        logger.error(`Failed to import: ${item.problem}`, err);
      }
    }
    
    logger.info(`Successfully imported ${imported} knowledge items`);
    
    // Verify import
    const count = await db.query('SELECT COUNT(*) as count FROM extracted_knowledge');
    logger.info(`Total knowledge items in database: ${count.rows[0].count}`);
    
  } catch (error) {
    logger.error('Import failed:', error);
  } finally {
    await db.end();
  }
}

// Run the import
importKnowledge().catch(console.error);