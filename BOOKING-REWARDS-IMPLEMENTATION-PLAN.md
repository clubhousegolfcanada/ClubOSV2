# Booking Rewards Implementation Plan - 25 ClubCoins per Booking

## Executive Summary
Implement an automated reward system that grants customers 25 ClubCoins when they complete a booking at Clubhouse 24/7 Golf. This will integrate with the existing HubSpot booking tracking and ClubCoin economy.

## Current System Analysis

### HubSpot Integration
- **Existing**: HubSpot API integration for customer names and contact search
- **Booking Tracking**: Customer bookings are fetched from HubSpot deals
- **Contact Matching**: Phone numbers and emails used to match customers
- **Deal Properties**: booking_date, booking_time, location, box_number stored in HubSpot

### ClubCoin System
- **Service**: Robust `clubCoinService` with credit/debit/transfer capabilities
- **Transaction Types**: stake_lock, challenge_win, bonus, admin_grant, initial_grant
- **Database**: cc_transactions table tracks all coin movements
- **Balance Tracking**: customer_profiles.cc_balance stores current balance
- **Audit Trail**: Complete transaction history with balance_before/after

### Missing Components
- No webhook receiver for HubSpot deal events
- No automated booking completion detection
- No booking reward transaction type

## Implementation Architecture

### Phase 1: Database Updates
1. **Add new transaction type**
   - Add 'booking_reward' to CC transaction types
   - Create booking_rewards tracking table
   
2. **Migration SQL**
```sql
-- Add booking rewards tracking
CREATE TABLE IF NOT EXISTS booking_rewards (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  hubspot_deal_id VARCHAR(255) UNIQUE NOT NULL,
  booking_date DATE NOT NULL,
  location VARCHAR(100),
  box_number VARCHAR(50),
  cc_awarded INTEGER DEFAULT 25,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_booking_reward UNIQUE(user_id, hubspot_deal_id)
);

CREATE INDEX idx_booking_rewards_user ON booking_rewards(user_id);
CREATE INDEX idx_booking_rewards_date ON booking_rewards(booking_date);
```

### Phase 2: HubSpot Webhook Integration
1. **Create webhook endpoint** `/api/webhooks/hubspot/bookings`
2. **Subscribe to HubSpot events**:
   - Deal property changes (when dealstage = 'completed' or similar)
   - Deal associations (when linked to contact)
3. **Webhook handler logic**:
   - Verify webhook signature
   - Extract deal and contact information
   - Check if booking is completed
   - Award ClubCoins if not already awarded

### Phase 3: Booking Completion Service
```typescript
// bookingRewardService.ts
class BookingRewardService {
  async processCompletedBooking(hubspotDealId: string, contactId: string) {
    // 1. Find user by HubSpot contact ID
    const user = await this.findUserByHubSpotContact(contactId);
    if (!user) return;
    
    // 2. Check if already rewarded
    const existing = await db.query(
      'SELECT 1 FROM booking_rewards WHERE hubspot_deal_id = $1',
      [hubspotDealId]
    );
    if (existing.rows.length > 0) return;
    
    // 3. Award ClubCoins
    await clubCoinService.credit({
      userId: user.id,
      type: 'booking_reward',
      amount: 25,
      description: 'Booking completion reward',
      metadata: { hubspotDealId, contactId }
    });
    
    // 4. Record the reward
    await db.query(
      `INSERT INTO booking_rewards 
       (user_id, hubspot_deal_id, booking_date, cc_awarded) 
       VALUES ($1, $2, NOW(), 25)`,
      [user.id, hubspotDealId]
    );
    
    // 5. Send notification (optional)
    await this.notifyUserOfReward(user.id);
  }
}
```

### Phase 4: Manual Sync for Historical Bookings
1. **Create sync endpoint** for admins to trigger manual sync
2. **Fetch all deals** from HubSpot with completed status
3. **Process each booking** checking if reward already given
4. **Bulk award** ClubCoins for eligible past bookings

### Phase 5: User Interface Updates
1. **Dashboard notification** when coins are awarded
2. **Transaction history** shows booking rewards
3. **Booking page** displays potential reward
4. **Profile stats** includes total booking rewards earned

## Technical Implementation Steps

### Step 1: Database Migration
```bash
# Create and run migration
npm run db:migrate
```

### Step 2: HubSpot Webhook Setup
1. Register webhook URL in HubSpot app settings
2. Subscribe to deal.propertyChange events
3. Filter for dealstage changes to 'closedwon' or equivalent

### Step 3: Backend Services
```typescript
// routes/webhooks/hubspot.ts
router.post('/bookings', verifyHubSpotSignature, async (req, res) => {
  const { objectId, propertyName, propertyValue } = req.body;
  
  if (propertyName === 'dealstage' && propertyValue === 'closedwon') {
    await bookingRewardService.processCompletedBooking(objectId);
  }
  
  res.status(200).send('OK');
});
```

### Step 4: Testing Strategy
1. **Unit tests** for reward service
2. **Integration tests** for webhook handling
3. **Manual testing** with test HubSpot deals
4. **Monitoring** for duplicate rewards

## Alternative Approach: Polling Strategy
If webhooks are not feasible:

1. **Scheduled job** runs every hour
2. **Query HubSpot** for recently completed deals
3. **Process new completions** since last check
4. **Award coins** for eligible bookings

```typescript
// jobs/bookingRewardPoller.ts
async function pollForCompletedBookings() {
  const lastCheck = await getLastPollTimestamp();
  const deals = await hubspotService.getDealsModifiedSince(lastCheck);
  
  for (const deal of deals) {
    if (deal.properties.dealstage === 'closedwon') {
      await bookingRewardService.processCompletedBooking(deal.id);
    }
  }
  
  await updateLastPollTimestamp();
}
```

## Security Considerations
1. **Idempotency**: Ensure coins can't be awarded twice for same booking
2. **Webhook verification**: Validate HubSpot signatures
3. **Rate limiting**: Protect webhook endpoint
4. **Audit logging**: Track all coin awards
5. **Rollback capability**: Admin tools to reverse incorrect awards

## Monitoring & Analytics
1. **Track metrics**:
   - Total coins awarded per day/week/month
   - Average bookings per user
   - Conversion rate (bookings to rewards)
2. **Alerts**:
   - Failed webhook processing
   - Unusual reward patterns
   - System errors

## Rollout Plan
1. **Week 1**: Database changes and service implementation
2. **Week 2**: HubSpot webhook integration and testing
3. **Week 3**: Historical data sync and UI updates
4. **Week 4**: Production deployment and monitoring

## Configuration Required
```env
# .env additions
HUBSPOT_WEBHOOK_SECRET=xxx
BOOKING_REWARD_AMOUNT=25
BOOKING_REWARD_ENABLED=true
```

## Success Metrics
- 100% of completed bookings receive rewards
- Zero duplicate rewards
- < 5 minute delay from booking to reward
- Customer satisfaction increase
- Booking frequency increase

## Future Enhancements
1. **Tiered rewards**: More coins for premium bookings
2. **Streak bonuses**: Extra coins for consecutive bookings
3. **Location multipliers**: Different rewards per location
4. **Special events**: Double coin weekends
5. **Referral bonuses**: Coins for bringing friends

## Risk Mitigation
1. **Webhook failures**: Implement retry logic and dead letter queue
2. **HubSpot API limits**: Use caching and batch operations
3. **Database failures**: Transaction rollback and error recovery
4. **Coin inflation**: Monitor economy and adjust rewards as needed

## Estimated Timeline
- **Development**: 3-5 days
- **Testing**: 2-3 days  
- **Deployment**: 1 day
- **Total**: 1-2 weeks

## Dependencies
- HubSpot API access with deal read permissions
- HubSpot webhook configuration access
- Database migration capabilities
- Production deployment pipeline