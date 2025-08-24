# Simple Booking Rewards Implementation - 7-Day Delay

## Core Concept
Award 25 ClubCoins to customers 7 days after their booking date (not when booked, but after they've actually played). This delay ensures they showed up and completed their session.

## Simplest Implementation

### 1. Database Migration (1 file)
```sql
-- migrations/110_booking_rewards.sql
CREATE TABLE booking_rewards (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  hubspot_deal_id VARCHAR(255) UNIQUE NOT NULL,
  booking_date TIMESTAMP NOT NULL,
  reward_date TIMESTAMP NOT NULL, -- booking_date + 7 days
  cc_awarded INTEGER DEFAULT 25,
  status VARCHAR(20) DEFAULT 'pending', -- pending, awarded, failed
  awarded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_booking_reward UNIQUE(hubspot_deal_id)
);

CREATE INDEX idx_booking_rewards_status_date ON booking_rewards(status, reward_date);
```

### 2. Daily Cron Job (1 file)
```typescript
// ClubOSV1-backend/src/jobs/bookingRewards.ts
import { db } from '../utils/database';
import { clubCoinService } from '../services/clubCoinService';
import { logger } from '../utils/logger';

export async function processBookingRewards() {
  try {
    // Find all pending rewards that are due (7+ days old)
    const pendingRewards = await db.query(`
      SELECT br.*, u.name as user_name
      FROM booking_rewards br
      JOIN users u ON u.id = br.user_id
      WHERE br.status = 'pending' 
      AND br.reward_date <= NOW()
      LIMIT 100
    `);

    for (const reward of pendingRewards.rows) {
      try {
        // Award the coins
        await clubCoinService.credit({
          userId: reward.user_id,
          type: 'booking_reward',
          amount: reward.cc_awarded,
          description: `Booking reward - Thank you for playing!`,
          metadata: { 
            hubspot_deal_id: reward.hubspot_deal_id,
            booking_date: reward.booking_date
          }
        });

        // Mark as awarded
        await db.query(`
          UPDATE booking_rewards 
          SET status = 'awarded', awarded_at = NOW()
          WHERE id = $1
        `, [reward.id]);

        logger.info(`Awarded ${reward.cc_awarded} CC to ${reward.user_name} for booking`);
      } catch (error) {
        logger.error(`Failed to award booking reward ${reward.id}:`, error);
        // Mark as failed for manual review
        await db.query(`
          UPDATE booking_rewards 
          SET status = 'failed'
          WHERE id = $1
        `, [reward.id]);
      }
    }
  } catch (error) {
    logger.error('Booking rewards job failed:', error);
  }
}

// Run daily at 10 AM
export function scheduleBookingRewards() {
  // Simple version - just call from existing job scheduler
  // Or use node-cron if you want standalone
  setInterval(() => {
    const hour = new Date().getHours();
    if (hour === 10) {
      processBookingRewards();
    }
  }, 60 * 60 * 1000); // Check every hour
}
```

### 3. HubSpot Webhook Receiver (1 file)
```typescript
// ClubOSV1-backend/src/routes/webhooks/hubspot.ts
import { Router } from 'express';
import { db } from '../../utils/database';
import { logger } from '../../utils/logger';

const router = Router();

router.post('/booking-completed', async (req, res) => {
  try {
    const { objectId, properties } = req.body;
    
    // Extract deal properties
    const bookingDate = properties.booking_date || properties.closedate;
    const contactId = properties.contact_id;
    
    if (!bookingDate || !contactId) {
      return res.status(200).json({ message: 'Missing required fields' });
    }
    
    // Find user by HubSpot contact
    const userResult = await db.query(`
      SELECT user_id FROM customer_profiles 
      WHERE hubspot_contact_id = $1
      LIMIT 1
    `, [contactId]);
    
    if (userResult.rows.length === 0) {
      logger.warn(`No user found for HubSpot contact ${contactId}`);
      return res.status(200).json({ message: 'User not found' });
    }
    
    const userId = userResult.rows[0].user_id;
    const rewardDate = new Date(bookingDate);
    rewardDate.setDate(rewardDate.getDate() + 7);
    
    // Queue the reward for 7 days later
    await db.query(`
      INSERT INTO booking_rewards (
        user_id, 
        hubspot_deal_id, 
        booking_date, 
        reward_date,
        cc_awarded
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (hubspot_deal_id) DO NOTHING
    `, [userId, objectId, bookingDate, rewardDate, 25]);
    
    logger.info(`Queued booking reward for user ${userId}, due ${rewardDate}`);
    res.status(200).json({ success: true });
    
  } catch (error) {
    logger.error('Webhook processing error:', error);
    res.status(200).json({ error: 'Processing failed' });
  }
});

export default router;
```

### 4. Add to Backend Index (1 line)
```typescript
// ClubOSV1-backend/src/index.ts
import bookingWebhook from './routes/webhooks/hubspot';
app.use('/api/webhooks/hubspot', bookingWebhook);

// Add to job scheduler
import { scheduleBookingRewards } from './jobs/bookingRewards';
scheduleBookingRewards();
```

## That's It! 

Total implementation: 4 files, ~150 lines of code

## How It Works
1. **HubSpot sends webhook** when booking is completed
2. **System records** the booking and schedules reward for 7 days later
3. **Daily job runs** and awards coins to eligible bookings
4. **Users receive** 25 CC automatically a week after playing

## Configuration
```env
# Add to .env
BOOKING_REWARD_AMOUNT=25
BOOKING_REWARD_DELAY_DAYS=7
HUBSPOT_WEBHOOK_SECRET=your_secret_here
```

## Testing
```bash
# Test webhook manually
curl -X POST http://localhost:4000/api/webhooks/hubspot/booking-completed \
  -H "Content-Type: application/json" \
  -d '{
    "objectId": "test-deal-123",
    "properties": {
      "booking_date": "2025-08-16",
      "contact_id": "hubspot-contact-456"
    }
  }'

# Run reward job manually
npm run job:booking-rewards
```

## Admin Tools (Optional)
```typescript
// Simple admin endpoint to check pending rewards
router.get('/admin/booking-rewards/pending', authenticate, requireRole('admin'), async (req, res) => {
  const pending = await db.query(`
    SELECT br.*, u.name, u.email
    FROM booking_rewards br
    JOIN users u ON u.id = br.user_id
    WHERE status = 'pending'
    ORDER BY reward_date ASC
  `);
  res.json(pending.rows);
});
```

## Future Expansions (When Needed)

### Easy Add-ons:
1. **Variable rewards** - Change cc_awarded based on booking type
2. **Bonus multipliers** - 2x coins on weekends
3. **Streak bonuses** - Extra coins for weekly bookings
4. **Email notifications** - Send "You earned coins!" emails
5. **Manual override** - Admin tool to award immediately
6. **Cancellation handling** - Webhook for cancelled bookings

### Just update the webhook handler:
```typescript
// Example: Different rewards by location
const rewardAmount = properties.location === 'Bedford' ? 30 : 25;

// Example: Weekend bonus
const dayOfWeek = new Date(bookingDate).getDay();
const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
const rewardAmount = isWeekend ? 50 : 25;
```

## Why This Approach?

✅ **Dead simple** - Minimal code, easy to understand
✅ **Reliable** - Batch processing won't miss rewards
✅ **Expandable** - Easy to add features later
✅ **No notifications needed** - Coins just appear after a week
✅ **Idempotent** - Can't double-award same booking
✅ **Auditable** - Complete record of all rewards

## Deployment Steps
1. Run database migration
2. Deploy backend with webhook endpoint
3. Configure HubSpot webhook in their dashboard
4. Test with a real booking
5. Monitor daily job logs

Total time to implement: **Half a day**