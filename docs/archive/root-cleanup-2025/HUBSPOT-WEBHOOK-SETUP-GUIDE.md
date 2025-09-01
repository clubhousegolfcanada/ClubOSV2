# Complete HubSpot Webhook Implementation Guide

## Complete To-Do List

### Backend Development Tasks
- [ ] 1. Create database migration for booking_rewards table
- [ ] 2. Implement HubSpot webhook receiver endpoint
- [ ] 3. Create booking rewards processing job
- [ ] 4. Add webhook signature verification
- [ ] 5. Add routes to backend index
- [ ] 6. Add environment variables
- [ ] 7. Test webhook endpoint locally
- [ ] 8. Deploy backend to Railway
- [ ] 9. Create admin monitoring endpoint

### HubSpot Configuration Tasks
- [ ] 10. Access HubSpot account settings
- [ ] 11. Create webhook subscription
- [ ] 12. Configure deal property mappings
- [ ] 13. Set up webhook URL
- [ ] 14. Test webhook delivery
- [ ] 15. Monitor webhook logs

## Step-by-Step Implementation

### Step 1: Database Migration
Create file: `ClubOSV1-backend/src/database/migrations/110_booking_rewards.sql`

```sql
-- UP
CREATE TABLE IF NOT EXISTS booking_rewards (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  hubspot_deal_id VARCHAR(255) UNIQUE NOT NULL,
  booking_date TIMESTAMP NOT NULL,
  reward_date TIMESTAMP NOT NULL,
  location VARCHAR(100),
  box_number VARCHAR(50),
  cc_awarded INTEGER DEFAULT 25,
  status VARCHAR(20) DEFAULT 'pending', -- pending, awarded, failed, cancelled
  awarded_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_booking_rewards_status_date ON booking_rewards(status, reward_date);
CREATE INDEX idx_booking_rewards_user ON booking_rewards(user_id);
CREATE INDEX idx_booking_rewards_hubspot ON booking_rewards(hubspot_deal_id);

-- DOWN
DROP TABLE IF EXISTS booking_rewards;
```

Run migration:
```bash
cd ClubOSV1-backend
npm run db:migrate
```

### Step 2: Create Webhook Receiver
Create file: `ClubOSV1-backend/src/routes/webhooks/hubspotBookings.ts`

```typescript
import { Router, Request, Response } from 'express';
import { db } from '../../utils/database';
import { logger } from '../../utils/logger';
import crypto from 'crypto';

const router = Router();

// Verify HubSpot webhook signature
function verifyHubSpotSignature(req: Request): boolean {
  const signature = req.headers['x-hubspot-signature'] as string;
  const secret = process.env.HUBSPOT_WEBHOOK_SECRET;
  
  if (!signature || !secret) {
    return false;
  }
  
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  return signature === hash;
}

// Main webhook handler
router.post('/booking-completed', async (req: Request, res: Response) => {
  try {
    // Verify webhook signature (optional but recommended)
    if (process.env.NODE_ENV === 'production' && !verifyHubSpotSignature(req)) {
      logger.warn('Invalid HubSpot webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // HubSpot sends an array of events
    const events = Array.isArray(req.body) ? req.body : [req.body];
    
    for (const event of events) {
      await processBookingEvent(event);
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Webhook processing error:', error);
    // Return 200 to prevent HubSpot retries for processing errors
    res.status(200).json({ error: 'Processing failed' });
  }
});

async function processBookingEvent(event: any) {
  try {
    // Extract deal information
    const dealId = event.objectId || event.dealId;
    const properties = event.properties || {};
    
    // Check if this is a completed booking
    const dealStage = properties.dealstage || properties.hs_deal_stage;
    if (dealStage !== 'closedwon' && dealStage !== 'completed') {
      logger.info(`Skipping deal ${dealId} with stage: ${dealStage}`);
      return;
    }
    
    // Extract booking details
    const bookingDate = properties.booking_date || 
                       properties.closedate || 
                       properties.hs_closedate;
    const location = properties.location || 'Unknown';
    const boxNumber = properties.box_number || properties.bay_number || '';
    
    // Find associated contact
    const contactId = properties.associatedContactId || 
                     properties.contact_id ||
                     event.associatedContactIds?.[0];
    
    if (!contactId || !bookingDate) {
      logger.warn(`Missing required fields for deal ${dealId}`);
      return;
    }
    
    // Find user by HubSpot contact ID
    const userResult = await db.query(`
      SELECT user_id FROM customer_profiles 
      WHERE hubspot_contact_id = $1
      LIMIT 1
    `, [contactId]);
    
    if (userResult.rows.length === 0) {
      // Try to find by phone number if contact ID doesn't match
      const phone = properties.contact_phone || properties.phone;
      if (phone) {
        const phoneResult = await db.query(`
          SELECT cp.user_id 
          FROM customer_profiles cp
          JOIN users u ON u.id = cp.user_id
          WHERE u.phone = $1
          LIMIT 1
        `, [phone]);
        
        if (phoneResult.rows.length > 0) {
          userResult.rows = phoneResult.rows;
          // Update the HubSpot contact ID for future use
          await db.query(`
            UPDATE customer_profiles 
            SET hubspot_contact_id = $1 
            WHERE user_id = $2
          `, [contactId, phoneResult.rows[0].user_id]);
        } else {
          logger.warn(`No user found for HubSpot contact ${contactId}`);
          return;
        }
      } else {
        logger.warn(`No user found for HubSpot contact ${contactId}`);
        return;
      }
    }
    
    const userId = userResult.rows[0].user_id;
    
    // Calculate reward date (7 days after booking)
    const rewardDate = new Date(bookingDate);
    rewardDate.setDate(rewardDate.getDate() + 7);
    
    // Queue the reward
    await db.query(`
      INSERT INTO booking_rewards (
        user_id, 
        hubspot_deal_id, 
        booking_date, 
        reward_date,
        location,
        box_number,
        cc_awarded,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      ON CONFLICT (hubspot_deal_id) 
      DO UPDATE SET 
        booking_date = EXCLUDED.booking_date,
        reward_date = EXCLUDED.reward_date,
        location = EXCLUDED.location,
        box_number = EXCLUDED.box_number,
        updated_at = NOW()
      WHERE booking_rewards.status = 'pending'
    `, [userId, dealId, bookingDate, rewardDate, location, boxNumber, 25]);
    
    logger.info(`Queued booking reward for user ${userId}, deal ${dealId}, due ${rewardDate.toISOString()}`);
  } catch (error) {
    logger.error(`Error processing booking event:`, error);
    throw error;
  }
}

// Webhook for deal updates (cancellations)
router.post('/booking-updated', async (req: Request, res: Response) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    
    for (const event of events) {
      const dealId = event.objectId;
      const properties = event.properties || {};
      const dealStage = properties.dealstage || properties.hs_deal_stage;
      
      // If deal is cancelled or lost
      if (dealStage === 'closedlost' || dealStage === 'cancelled') {
        // Cancel any pending rewards
        await db.query(`
          UPDATE booking_rewards 
          SET status = 'cancelled', 
              updated_at = NOW() 
          WHERE hubspot_deal_id = $1 
          AND status = 'pending'
        `, [dealId]);
        
        logger.info(`Cancelled pending reward for deal ${dealId}`);
      }
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Webhook update error:', error);
    res.status(200).json({ error: 'Processing failed' });
  }
});

export default router;
```

### Step 3: Create Processing Job
Create file: `ClubOSV1-backend/src/jobs/bookingRewards.ts`

```typescript
import { db } from '../utils/database';
import { clubCoinService } from '../services/clubCoinService';
import { logger } from '../utils/logger';

export async function processBookingRewards() {
  logger.info('Starting booking rewards processing job');
  
  try {
    // Find all pending rewards that are due
    const pendingRewards = await db.query(`
      SELECT br.*, u.name as user_name, u.email as user_email
      FROM booking_rewards br
      JOIN users u ON u.id = br.user_id
      WHERE br.status = 'pending' 
      AND br.reward_date <= NOW()
      ORDER BY br.reward_date ASC
      LIMIT 100
    `);
    
    logger.info(`Found ${pendingRewards.rows.length} pending rewards to process`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const reward of pendingRewards.rows) {
      try {
        // Award the coins
        await clubCoinService.credit({
          userId: reward.user_id,
          type: 'booking_reward',
          amount: reward.cc_awarded,
          description: `Booking reward - Thank you for playing at ${reward.location}!`,
          metadata: { 
            hubspot_deal_id: reward.hubspot_deal_id,
            booking_date: reward.booking_date,
            location: reward.location,
            box_number: reward.box_number
          }
        });
        
        // Mark as awarded
        await db.query(`
          UPDATE booking_rewards 
          SET status = 'awarded', 
              awarded_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
        `, [reward.id]);
        
        logger.info(`✅ Awarded ${reward.cc_awarded} CC to ${reward.user_name} for booking on ${reward.booking_date}`);
        successCount++;
        
      } catch (error: any) {
        logger.error(`Failed to award booking reward ${reward.id}:`, error);
        
        // Mark as failed with error message
        await db.query(`
          UPDATE booking_rewards 
          SET status = 'failed',
              error_message = $2,
              updated_at = NOW()
          WHERE id = $1
        `, [reward.id, error.message]);
        
        failCount++;
      }
    }
    
    logger.info(`Booking rewards job completed: ${successCount} awarded, ${failCount} failed`);
    
  } catch (error) {
    logger.error('Booking rewards job failed:', error);
    throw error;
  }
}

// Schedule the job to run every hour
let jobInterval: NodeJS.Timeout | null = null;

export function startBookingRewardsJob() {
  // Run immediately on startup
  processBookingRewards();
  
  // Then run every hour
  jobInterval = setInterval(() => {
    processBookingRewards();
  }, 60 * 60 * 1000); // 1 hour
  
  logger.info('Booking rewards job scheduled to run hourly');
}

export function stopBookingRewardsJob() {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
  }
}
```

### Step 4: Add to Backend Index
Update: `ClubOSV1-backend/src/index.ts`

```typescript
// Add near other imports
import hubspotBookingWebhook from './routes/webhooks/hubspotBookings';
import { startBookingRewardsJob } from './jobs/bookingRewards';

// Add webhook route (after other routes)
app.use('/api/webhooks/hubspot', hubspotBookingWebhook);

// Start the booking rewards job (after server starts)
startBookingRewardsJob();
```

### Step 5: Add Environment Variables
Add to `ClubOSV1-backend/.env`:

```env
# HubSpot Webhook Configuration
HUBSPOT_WEBHOOK_SECRET=generate_a_random_secret_here
BOOKING_REWARD_AMOUNT=25
BOOKING_REWARD_DELAY_DAYS=7
```

Generate a secret:
```bash
openssl rand -hex 32
```

### Step 6: Create Admin Monitoring Endpoint
Add to: `ClubOSV1-backend/src/routes/admin/bookingRewards.ts`

```typescript
import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { roleGuard } from '../../middleware/roleGuard';
import { db } from '../../utils/database';

const router = Router();

// Get pending rewards
router.get('/pending', authenticate, roleGuard('admin'), async (req, res) => {
  try {
    const pending = await db.query(`
      SELECT br.*, u.name, u.email
      FROM booking_rewards br
      JOIN users u ON u.id = br.user_id
      WHERE status = 'pending'
      ORDER BY reward_date ASC
    `);
    
    res.json({
      success: true,
      count: pending.rows.length,
      rewards: pending.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending rewards' });
  }
});

// Get reward statistics
router.get('/stats', authenticate, roleGuard('admin'), async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(cc_awarded) as total_cc
      FROM booking_rewards
      GROUP BY status
    `);
    
    res.json({
      success: true,
      stats: stats.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Manually trigger reward processing
router.post('/process', authenticate, roleGuard('admin'), async (req, res) => {
  try {
    const { processBookingRewards } = require('../../jobs/bookingRewards');
    await processBookingRewards();
    res.json({ success: true, message: 'Processing triggered' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process rewards' });
  }
});

export default router;
```

## HubSpot Configuration Guide

### Step 1: Access HubSpot Settings
1. Log into HubSpot account
2. Click the Settings gear icon (top right)
3. Navigate to: **Integrations** → **Private Apps**

### Step 2: Create Private App (if not exists)
1. Click **Create a private app**
2. Name: "ClubOS Integration"
3. Scopes needed:
   - `crm.objects.deals.read`
   - `crm.objects.contacts.read`
   - `webhooks`

### Step 3: Set Up Webhooks
1. In your private app, go to **Webhooks** tab
2. Click **Create subscription**
3. Configure as follows:

**Subscription 1 - Deal Completed:**
- Object type: **Deal**
- Event: **Property change**
- Property to monitor: **dealstage**
- Active: **Yes**

**Subscription 2 - Deal Updated (for cancellations):**
- Object type: **Deal**
- Event: **Property change**
- Property to monitor: **dealstage**
- Active: **Yes**

### Step 4: Configure Webhook URL
For each subscription:

1. **Target URL**: 
   - For completed bookings: `https://your-railway-backend.up.railway.app/api/webhooks/hubspot/booking-completed`
   - For updates: `https://your-railway-backend.up.railway.app/api/webhooks/hubspot/booking-updated`

2. **Method**: POST

3. **Authentication**: 
   - Type: **API key**
   - Header name: `X-HubSpot-Signature`
   - API key value: (use the secret from your .env file)

### Step 5: Property Mappings
Ensure these deal properties exist in HubSpot:
- `booking_date` - Date of the booking
- `location` - Which location (Bedford, Dartmouth, etc.)
- `box_number` or `bay_number` - Which simulator bay
- `contact_id` - Associated contact

To create custom properties:
1. Go to **Settings** → **Objects** → **Deals**
2. Click **Manage deal properties**
3. Click **Create property**
4. Add the properties listed above

### Step 6: Test Webhook
1. HubSpot provides a **Test** button in webhook settings
2. Click it to send a test payload
3. Check Railway logs: `railway logs`
4. Look for: "Queued booking reward for user..."

### Step 7: Production Testing
1. Create a test deal in HubSpot
2. Associate it with a known customer contact
3. Change deal stage to "Closed Won"
4. Check backend logs for webhook receipt
5. Check database for pending reward:
```sql
SELECT * FROM booking_rewards ORDER BY created_at DESC LIMIT 5;
```

## Local Testing

### Test webhook endpoint:
```bash
curl -X POST http://localhost:4000/api/webhooks/hubspot/booking-completed \
  -H "Content-Type: application/json" \
  -d '[{
    "objectId": "test-deal-123",
    "properties": {
      "dealstage": "closedwon",
      "booking_date": "2025-08-16",
      "location": "Bedford",
      "box_number": "2",
      "associatedContactId": "test-contact-456"
    }
  }]'
```

### Test reward processing:
```bash
curl -X POST http://localhost:4000/api/admin/booking-rewards/process \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

## Monitoring

### Check pending rewards:
```bash
curl http://localhost:4000/api/admin/booking-rewards/pending \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### View statistics:
```bash
curl http://localhost:4000/api/admin/booking-rewards/stats \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

## Troubleshooting

### Webhook not firing?
1. Check HubSpot webhook logs: **Settings** → **Integrations** → **Private Apps** → Your App → **Monitoring**
2. Verify webhook URL is correct and publicly accessible
3. Check Railway logs for incoming requests

### Users not found?
1. Ensure customer has `hubspot_contact_id` in database
2. Check phone number matching as fallback
3. Verify contact exists in HubSpot

### Rewards not processing?
1. Check job is running: Look for "Booking rewards job scheduled" in logs
2. Verify reward_date has passed (must be 7+ days old)
3. Check for errors in booking_rewards.error_message

### Manual fixes:
```sql
-- Reset a failed reward to pending
UPDATE booking_rewards 
SET status = 'pending', error_message = NULL 
WHERE hubspot_deal_id = 'DEAL_ID';

-- Force immediate processing (set reward date to now)
UPDATE booking_rewards 
SET reward_date = NOW() 
WHERE id = REWARD_ID;
```

## Complete Deployment Checklist

- [ ] Create database migration file
- [ ] Create webhook receiver file
- [ ] Create processing job file
- [ ] Create admin endpoints file
- [ ] Update backend index.ts
- [ ] Add environment variables
- [ ] Run database migration locally
- [ ] Test webhook endpoint locally
- [ ] Commit and push to git
- [ ] Deploy to Railway
- [ ] Verify deployment succeeded
- [ ] Configure HubSpot webhooks
- [ ] Set webhook secret in HubSpot
- [ ] Test with HubSpot test button
- [ ] Create test deal in HubSpot
- [ ] Verify webhook received
- [ ] Check pending rewards in database
- [ ] Wait for job to run (or trigger manually)
- [ ] Verify coins awarded
- [ ] Monitor for 24 hours