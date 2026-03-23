/**
 * Import script: Load Quo conversations and website content into the ClubAI knowledge base.
 *
 * Usage:
 *   npx tsx src/scripts/import-clubai-knowledge.ts
 *   railway run npx tsx src/scripts/import-clubai-knowledge.ts
 *
 * This script:
 * 1. Parses conversations_cleaned.json — extracts Q&A pairs from real team conversations
 * 2. Imports website content (how-to, pricing, coaching, info pages)
 * 3. Generates embeddings for each entry via OpenAI text-embedding-3-small
 * 4. Stores everything in the clubai_knowledge table for RAG search
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import {
  generateEmbeddingsBatch,
  clearKnowledge,
  getKnowledgeStats,
} from '../services/clubaiKnowledgeService';

// ============================================
// CONVERSATION PARSING
// ============================================

interface ThreadMessage {
  timestamp: string;
  direction: string;
  sender: string;
  is_auto_response: boolean;
  body: string;
}

interface Conversation {
  conversation_id: string;
  customer_number: string;
  intent: string;
  resolution: string[];
  ai_assessment: string;
  message_count: number;
  customer_messages: number;
  business_human_messages: number;
  business_auto_messages: number;
  thread: ThreadMessage[];
}

interface QAPair {
  conversation_id: string;
  intent: string;
  customer_message: string;
  team_response: string;
  location: string | null;
  resolution: string[];
  confidence: number;
}

/**
 * Extract Q&A pairs from a conversation thread.
 * Looks for customer messages followed by human (non-auto) team responses.
 */
function extractQAPairs(conv: Conversation): QAPair[] {
  const pairs: QAPair[] = [];
  const thread = conv.thread;

  // Skip conversations with no human responses
  if (conv.business_human_messages === 0) return pairs;

  // Detect location from messages
  const locationKeywords: Record<string, string> = {
    'bedford': 'Bedford',
    'dartmouth': 'Dartmouth',
    'truro': 'Truro',
    'river oaks': 'River Oaks',
    'bayers lake': 'Bayers Lake',
    'bayers': 'Bayers Lake',
    'meaghers': 'River Oaks',
  };

  let detectedLocation: string | null = null;
  const allText = thread.map(m => m.body.toLowerCase()).join(' ');
  for (const [keyword, loc] of Object.entries(locationKeywords)) {
    if (allText.includes(keyword)) {
      detectedLocation = loc;
      break;
    }
  }

  // Walk through the thread looking for customer→team response pairs
  for (let i = 0; i < thread.length; i++) {
    const msg = thread[i];

    // Find customer messages (not auto-responses)
    if (msg.sender !== 'customer' || msg.is_auto_response) continue;

    const customerMsg = msg.body.trim();
    if (customerMsg.length < 5) continue; // Skip very short messages like "Ok" or "Thanks"

    // Look for the next human team response
    let teamResponse = '';
    for (let j = i + 1; j < thread.length; j++) {
      const reply = thread[j];

      // If another customer message comes first, stop
      if (reply.sender === 'customer' && !reply.is_auto_response) break;

      // Collect human team responses (skip auto-responses)
      if (reply.sender === 'clubhouse' && !reply.is_auto_response) {
        if (teamResponse) teamResponse += '\n';
        teamResponse += reply.body.trim();
      }
    }

    if (!teamResponse || teamResponse.length < 10) continue;

    // Skip purely social exchanges ("Thanks!" / "No problem!")
    const socialPatterns = /^(thanks|thank you|no problem|np|ok|okay|perfect|great|awesome|sounds good|👍|🙏)/i;
    if (socialPatterns.test(customerMsg) && customerMsg.length < 30) continue;

    // Calculate confidence based on conversation quality
    let confidence = 0.7;
    if (conv.resolution.includes('resolved')) confidence += 0.1;
    if (conv.business_human_messages >= 3) confidence += 0.05; // Substantive exchange
    if (conv.ai_assessment === 'fully_ai') confidence += 0.05; // Simple enough for AI
    confidence = Math.min(confidence, 0.95);

    pairs.push({
      conversation_id: conv.conversation_id,
      intent: conv.intent,
      customer_message: customerMsg,
      team_response: teamResponse,
      location: detectedLocation,
      resolution: conv.resolution,
      confidence,
    });
  }

  return pairs;
}

// ============================================
// WEBSITE CONTENT
// ============================================

interface WebsiteEntry {
  url: string;
  page_section: string;
  content: string;
  intent: string | null;
}

/**
 * Structured website content from the 4 pages.
 * This is the actual content scraped from clubhouse247golf.com on 2026-03-23.
 */
function getWebsiteContent(): WebsiteEntry[] {
  return [
    // ---- HOW-TO PAGE ----
    {
      url: 'https://www.clubhouse247golf.com/howto',
      page_section: 'How-To > Black or Frozen Screen',
      intent: 'sim_frozen',
      content: `Black or Frozen Screen fix:
1. Press the Windows key (⊞ near bottom-left of keyboard)
2. Locate the green and orange TrackMan icons at the bottom of the screen in the taskbar
3. Right-click each icon and select Close
4. Double-click the orange TrackMan icon on the desktop to restart it
5. Wait about one minute for it to fully load
Note: If you're not signed into your TrackMan account, you may lose your round progress. If you are signed in, you can resume from "My Activities" on the main screen.
If this doesn't fix it, text 902-707-3748 for support.`,
    },
    {
      url: 'https://www.clubhouse247golf.com/howto',
      page_section: 'How-To > Ball Not Picking Up',
      intent: 'ball_not_registering',
      content: `Ball Not Picking Up or Registering:
- Use only clean white balls (the ones provided at the location)
- Remove all other balls from the hitting area — extra balls confuse the sensor
If it's still not tracking:
1. Press the Windows key
2. Find the green and orange TrackMan icons in the taskbar
3. Right-click each and close them
4. Double-click the orange TrackMan icon on the desktop
5. Wait about one minute for it to load
6. Start a new round or range session
Note: If not signed into TrackMan, you may lose round progress. If signed in, pick up from "My Activities."`,
    },
    {
      url: 'https://www.clubhouse247golf.com/howto',
      page_section: 'How-To > Side Screens Off',
      intent: 'side_screens',
      content: `Side Screens Off: Look under the center logo on the TV for a power button. Press it once — the TrackMan display should come up.`,
    },
    {
      url: 'https://www.clubhouse247golf.com/howto',
      page_section: 'How-To > Side Screens No View Selected',
      intent: 'side_screens',
      content: `Side Screens showing "No View Selected":
1. Press the Windows key
2. Find the green and orange TrackMan icons in the taskbar
3. Right-click each and close them
4. Double-click the orange TrackMan icon on the desktop
5. Wait about one minute
6. Start a round or go to the range — the side screens should connect
Note: If not signed into TrackMan, you may lose round progress.`,
    },
    {
      url: 'https://www.clubhouse247golf.com/howto',
      page_section: 'How-To > TrackMan Login Issues',
      intent: 'login_qr_issue',
      content: `TrackMan Login Issues / QR Code Not Working:
- You do NOT need an account to play. Select "Guest" on the screen to start immediately.
- If you're getting password errors or lockout messages, cancel the login and tap "Guest."
- Playing as Guest means your stats and round progress won't be saved.
- We recommend downloading the TrackMan app and creating an account at home before your next visit for the best experience.`,
    },
    {
      url: 'https://www.clubhouse247golf.com/howto',
      page_section: 'How-To > Can\'t Get In',
      intent: 'door_access',
      content: `Can't Get Into the Location:
- You must have a valid booking, and your access link activates within 10 minutes of your booking start time.
- Check your text messages and email spam folder for the access link.
- The door handle does NOT turn — just pull the door open after clicking the link.
- If the link doesn't work, call 902-707-3748 and press 1 for immediate assistance.`,
    },
    {
      url: 'https://www.clubhouse247golf.com/howto',
      page_section: 'How-To > House Rules',
      intent: 'general_inquiry',
      content: `House Rules:
- Leave the space clean for the next member
- Maximum 4 people per box
- Need more time? Book an extension — unbooked overtime is charged at 2x the regular rate
- Use only the provided new balls to protect the screens
- Light food is okay, but no alcohol
- Keep noise and music at respectful levels if others are nearby
- Report any damage immediately`,
    },

    // ---- PRICING PAGE ----
    {
      url: 'https://www.clubhouse247golf.com/pricing',
      page_section: 'Pricing > Standard Rate',
      intent: 'pricing',
      content: `Standard Rate: $35/hr + tax
Applies on Saturdays, Sundays, and 1PM to midnight any day.
Includes: Bluetooth audio, wireless charging, bottled water.
Minimum 1 hour booking. If you stay past your booking, extend in the app to avoid extra charges.
Full support available 7AM-9PM.`,
    },
    {
      url: 'https://www.clubhouse247golf.com/pricing',
      page_section: 'Pricing > Morning Rate',
      intent: 'pricing',
      content: `Discounted Morning Rate: $25/hr + tax
Available 5AM to 1PM on weekdays (not weekends).
Includes free cold bottled water.
Perfect for stopping in to maintain your swing through the winter.
Minimum 1 hour booking.`,
    },
    {
      url: 'https://www.clubhouse247golf.com/pricing',
      page_section: 'Pricing > Late Night Rate',
      intent: 'pricing',
      content: `Late-Night Rate: $15/hr + tax
Available midnight to 5AM, Monday through Friday only (not weekends).
Includes free cold bottled water.
Minimum 1 hour booking. Limited support after hours (full support 7AM-9PM).
Great for range rats, night owls, and grinders.`,
    },

    // ---- CLUB COACH PAGE ----
    {
      url: 'https://www.clubhouse247golf.com/clubcoach',
      page_section: 'Coaching > Andrew Noseworthy',
      intent: 'general_inquiry',
      content: `Golf Coaching — Andrew Noseworthy (Available at Dartmouth, Bedford, Halifax locations):
PGA of Canada member with over 20 years of teaching experience. Former Head Professional at Oakfield Golf & Country Club and Director of Instruction at The Links at Brunello. Uses video, notes, and a detailed practice plan after every session.
Pricing:
- Private 1-hour lesson: $100
- 3 lessons package: $275
- 5 lessons package: $425
- Couples rates available on request
- Junior golfers: 25% discount off adult rates
Contact: golfpronose@gmail.com
Note: Coaches are not employees of Clubhouse and do not speak on behalf of Clubhouse. Please allow up to 24 hours to be contacted.`,
    },
    {
      url: 'https://www.clubhouse247golf.com/clubcoach',
      page_section: 'Coaching > Scott Frizzell',
      intent: 'general_inquiry',
      content: `Golf Coaching — Scott Frizzell (Available at Dartmouth, Bedford locations):
PGA professional with over 20 years of experience. Started at the Canadian Golf Academy. Spent 13 years at The Links at Montague. Twice named Player of the Year in NS and PEI. Taught thousands of golfers with focus on core fundamentals.
Pricing:
- Private 1-hour lesson: $70
- 3 lessons: $180
- 5 lessons: $275
- 10 lessons (shareable): $500
- Couples rates available on request
Contact: scottjfrizzell@gmail.com
Note: Coaches are not employees of Clubhouse and do not speak on behalf of Clubhouse. Please allow up to 24 hours to be contacted.`,
    },

    // ---- INFO/FAQ PAGE ----
    {
      url: 'https://www.clubhouse247golf.com/info',
      page_section: 'FAQ > What is the cost?',
      intent: 'pricing',
      content: `What is the cost? Pricing varies by time of day: $35/hr standard (1PM-midnight & weekends), $25/hr mornings (5AM-1PM weekdays), $15/hr late night (midnight-5AM weekdays). All rates plus tax. Check clubhouse247golf.com/pricing for current rates.`,
    },
    {
      url: 'https://www.clubhouse247golf.com/info',
      page_section: 'FAQ > Who is it for?',
      intent: 'general_inquiry',
      content: `Who is it for? Clubhouse welcomes all skill levels — beginners to pros. You can bring your own clubs, rent right-hand clubs, or just come to hang out with friends. We have games available for kids as young as 4 years old. Great for families, date nights, or solo practice.`,
    },
    {
      url: 'https://www.clubhouse247golf.com/info',
      page_section: 'FAQ > Why Clubhouse?',
      intent: 'general_inquiry',
      content: `Why Clubhouse? We offer a private, premium simulator experience with putting zones, wireless charging, club data displays, monthly competitions, and the latest TrackMan launch monitor technology — all at unmatched value.`,
    },
    {
      url: 'https://www.clubhouse247golf.com/info',
      page_section: 'FAQ > How does it work?',
      intent: 'general_inquiry',
      content: `How does it work?
1. Book your time online at clubhouse247golf.com
2. You'll receive an unlock link and QR code via email and text about 10 minutes before your booking
3. Click the link to unlock the door (the handle doesn't turn — just pull)
4. Go to your assigned box and start playing — choose courses, range, or games
5. Need help? Text 902-707-3748 for support
The access link works from 10 minutes before to 10 minutes after your booking time.`,
    },
    {
      url: 'https://www.clubhouse247golf.com/info',
      page_section: 'FAQ > Rules and Tips',
      intent: 'general_inquiry',
      content: `Rules and First Time Tips: Check the how-to page at clubhouse247golf.com/howto for step-by-step guides and troubleshooting. Light food is allowed but no alcohol at any time.`,
    },

    // ---- LOCATIONS ----
    {
      url: 'https://www.clubhouse247golf.com/info',
      page_section: 'Locations',
      intent: 'general_inquiry',
      content: `Clubhouse 24/7 Golf Locations:
- Bedford: 299 Rocky Lake Drive, Unit 3
- Dartmouth: 219 Waverley Road, Unit E
- River Oaks: 3909 NS-357, Meaghers Grant
- Bayers Lake (Halifax): 102 Chain Lake Dr, Unit 1A
- Truro: 245 Robie St Unit 124E (Truro Mall — has an outside entrance, does not require the mall to be open)
Head Office: 5684 West Street Unit 102, Halifax
Phone: 902-707-3748
Email: booking@clubhouse247golf.com`,
    },
  ];
}

// ============================================
// MAIN IMPORT FUNCTION
// ============================================

async function runImport() {
  console.log('=== ClubAI Knowledge Base Import ===\n');

  // Step 1: Load conversations
  console.log('Loading conversations...');
  const conversationsPath = join(__dirname, '..', '..', '..', 'ClubhouseAI', 'conversations_cleaned.json');
  let conversations: Conversation[];
  try {
    const raw = readFileSync(conversationsPath, 'utf-8');
    conversations = JSON.parse(raw);
    console.log(`Loaded ${conversations.length} conversations`);
  } catch (error) {
    console.error('Failed to load conversations file:', error);
    console.log('Trying alternate path...');
    try {
      const altPath = join(process.cwd(), '..', 'ClubhouseAI', 'conversations_cleaned.json');
      const raw = readFileSync(altPath, 'utf-8');
      conversations = JSON.parse(raw);
      console.log(`Loaded ${conversations.length} conversations from alternate path`);
    } catch {
      console.error('Could not find conversations_cleaned.json. Skipping conversation import.');
      conversations = [];
    }
  }

  // Step 2: Extract Q&A pairs
  console.log('\nExtracting Q&A pairs from conversations...');
  const allPairs: QAPair[] = [];
  for (const conv of conversations) {
    const pairs = extractQAPairs(conv);
    allPairs.push(...pairs);
  }
  console.log(`Extracted ${allPairs.length} Q&A pairs from ${conversations.length} conversations`);

  // Deduplicate very similar pairs (exact customer message match)
  const seen = new Set<string>();
  const uniquePairs: QAPair[] = [];
  for (const pair of allPairs) {
    const key = pair.customer_message.toLowerCase().trim().substring(0, 100);
    if (!seen.has(key)) {
      seen.add(key);
      uniquePairs.push(pair);
    }
  }
  console.log(`After deduplication: ${uniquePairs.length} unique Q&A pairs`);

  // Step 3: Get website content
  const websiteEntries = getWebsiteContent();
  console.log(`\nWebsite content: ${websiteEntries.length} entries from 4 pages`);

  // Step 4: Clear existing knowledge and reimport
  console.log('\nClearing existing knowledge...');
  const clearedConv = await clearKnowledge('conversation');
  const clearedWeb = await clearKnowledge('website');
  console.log(`Cleared ${clearedConv} conversation entries, ${clearedWeb} website entries`);

  // Step 5: Generate embeddings and insert conversations
  console.log('\nGenerating embeddings for conversations...');
  const convTexts = uniquePairs.map(p => `Customer: ${p.customer_message}\nResponse: ${p.team_response}`);
  const convEmbeddings = await generateEmbeddingsBatch(convTexts);

  let convInserted = 0;
  let convFailed = 0;
  for (let i = 0; i < uniquePairs.length; i++) {
    const pair = uniquePairs[i];
    const embedding = convEmbeddings[i];

    if (!embedding) {
      convFailed++;
      continue;
    }

    try {
      await db.query(`
        INSERT INTO clubai_knowledge
          (source_type, intent, customer_message, team_response, source_id, location, metadata, embedding, embedding_generated_at, confidence_score)
        VALUES
          ('conversation', $1, $2, $3, $4, $5, $6, $7, NOW(), $8)
      `, [
        pair.intent,
        pair.customer_message,
        pair.team_response,
        pair.conversation_id,
        pair.location,
        JSON.stringify({ resolution: pair.resolution }),
        embedding,
        pair.confidence,
      ]);
      convInserted++;
    } catch (error) {
      convFailed++;
      if (convFailed <= 3) console.error(`Failed to insert conversation:`, error);
    }

    // Progress log every 100
    if ((i + 1) % 100 === 0) {
      console.log(`  Conversations: ${i + 1}/${uniquePairs.length} processed (${convInserted} inserted, ${convFailed} failed)`);
    }
  }
  console.log(`Conversations complete: ${convInserted} inserted, ${convFailed} failed`);

  // Step 6: Generate embeddings and insert website content
  console.log('\nGenerating embeddings for website content...');
  const webTexts = websiteEntries.map(e => e.content);
  const webEmbeddings = await generateEmbeddingsBatch(webTexts);

  let webInserted = 0;
  let webFailed = 0;
  for (let i = 0; i < websiteEntries.length; i++) {
    const entry = websiteEntries[i];
    const embedding = webEmbeddings[i];

    if (!embedding) {
      webFailed++;
      continue;
    }

    try {
      await db.query(`
        INSERT INTO clubai_knowledge
          (source_type, intent, team_response, source_url, page_section, metadata, embedding, embedding_generated_at, confidence_score)
        VALUES
          ('website', $1, $2, $3, $4, $5, $6, NOW(), 0.9)
      `, [
        entry.intent,
        entry.content,
        entry.url,
        entry.page_section,
        JSON.stringify({}),
        embedding,
      ]);
      webInserted++;
    } catch (error) {
      webFailed++;
      console.error(`Failed to insert website entry "${entry.page_section}":`, error);
    }
  }
  console.log(`Website complete: ${webInserted} inserted, ${webFailed} failed`);

  // Step 7: Final stats
  const stats = await getKnowledgeStats();
  console.log('\n=== Import Complete ===');
  console.log(`Total entries: ${stats.total}`);
  console.log(`  Conversations: ${stats.conversations}`);
  console.log(`  Website: ${stats.website}`);
  console.log(`  Manual: ${stats.manual}`);
  console.log(`  With embeddings: ${stats.withEmbeddings}`);
  console.log(`  Avg confidence: ${stats.avgConfidence.toFixed(3)}`);
}

// Run the import
runImport()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  });
