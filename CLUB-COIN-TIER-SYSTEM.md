# ClubOS V1 - Club Coin Tier System Design

## System Parameters
- **Booking Reward**: 25 CC per booking
- **Max Challenge Bet**: 300 CC
- **Average User**: 5-10 bookings/year
- **Power User**: 150 bookings/year (extreme top)

## Existing Database Structure
Found in migrations:
- `rank_tier` enum: 'house', 'putter', 'iron', 'driver' (migration 004) - NEEDS UPDATE
- `rank_history` table tracks rank changes (migration 108)
- Rank based on `total_cc_earned` field

## Proposed Tier System

### Tier Thresholds & Names

| Tier | Name | CC Required | Typical User Profile | Benefits |
|------|------|-------------|---------------------|----------|
| 1 | **Junior** | 0-199 CC | New members, 0-7 bookings | Base access |
| 2 | **House** | 200-749 CC | Regular members, 8-29 bookings | 5% booking discount |
| 3 | **Amateur** | 750-1,999 CC | Active members, 30-79 bookings | 10% discount + priority booking |
| 4 | **Pro** | 2,000-4,999 CC | Dedicated members, 80-199 bookings | 15% discount + VIP perks |
| 5 | **Master** | 5,000+ CC | Elite members, 200+ bookings | 20% discount + Master privileges |

### Tier Progression Timeline

#### Year 1 Scenario (Average User)
- 8 bookings × 25 CC = 200 CC from bookings
- 2-3 small challenge wins = 50-100 CC
- **Total**: 250-300 CC → **Reaches House**

#### Year 2 Scenario (Average User)
- 8 bookings × 25 CC = 200 CC
- 5-6 challenge participations = 100-200 CC
- **Total**: 550-700 CC → **Solidly House**

#### Year 3 Scenario (Active User)
- 15 bookings × 25 CC = 375 CC
- Regular challenge participation = 200-300 CC
- **Total**: 1,125-1,375 CC → **Reaches Amateur**

#### Power User Scenario (Year 1)
- 150 bookings × 25 CC = 3,750 CC
- Challenge participation = 500-1000 CC
- **Total**: 4,250-4,750 CC → **Reaches Pro**

#### Elite User Scenario (Year 2)
- Continued high activity
- **Reaches Master status**

### Challenge Betting Patterns

Based on max 300 CC bets and tier distribution:

| Tier | Typical Bet Range | Risk Profile |
|------|------------------|--------------|
| Junior | 10-25 CC | Conservative, learning |
| House | 25-75 CC | Moderate, regular |
| Amateur | 50-150 CC | Confident, experienced |
| Pro | 100-250 CC | High stakes, competitive |
| Master | 150-300 CC | Elite, strategic |

### CC Economy Balance

#### Income Sources
1. **Bookings**: Primary steady income (25 CC each)
2. **Challenge Wins**: Variable income (10-300 CC)
3. **Promotions**: Occasional bonuses
4. **Referrals**: Future expansion

#### Spending Options
1. **Challenge Bets**: Primary sink (risk/reward)
2. **Shop Items**: Future merchandise
3. **Event Entry Fees**: Special tournaments
4. **Gift Cards**: Conversion to real value

### Migration Strategy

```sql
-- Add tier thresholds to system
INSERT INTO system_settings (key, value) VALUES
  ('tier.house.min', '0'),
  ('tier.house.max', '249'),
  ('tier.putter.min', '250'),
  ('tier.putter.max', '999'),
  ('tier.iron.min', '1000'),
  ('tier.iron.max', '3749'),
  ('tier.driver.min', '3750');

-- Update existing rank calculation
UPDATE customer_profiles
SET rank_tier = CASE
  WHEN total_cc_earned >= 3750 THEN 'driver'::rank_tier
  WHEN total_cc_earned >= 1000 THEN 'iron'::rank_tier
  WHEN total_cc_earned >= 250 THEN 'putter'::rank_tier
  ELSE 'house'::rank_tier
END;
```

### Tier Benefits Implementation

#### House (0-249 CC)
- Base simulator access
- Can book standard times
- Participate in challenges
- View leaderboards

#### Putter (250-999 CC)
- Everything in House, plus:
- 5% booking discount
- Early access to weekend slots (1 day)
- Putter badge on profile
- Monthly CC bonus (+10 CC)

#### Iron (1,000-3,749 CC)
- Everything in Putter, plus:
- 10% booking discount
- Priority booking (2 days early)
- Iron badge and profile customization
- Quarterly CC bonus (+50 CC)
- Access to Iron-only tournaments

#### Driver (3,750+ CC)
- Everything in Iron, plus:
- 15% booking discount
- VIP booking priority (3 days early)
- Driver badge and premium profile
- Monthly CC bonus (+100 CC)
- Free entry to special events
- Personal booking assistant
- Complimentary guest passes (2/month)

## Implementation Checklist

- [ ] Create tier calculation function
- [ ] Update profile displays with tier badges
- [ ] Implement tier-based booking discounts
- [ ] Add tier progression notifications
- [ ] Create tier benefits UI component
- [ ] Update leaderboard with tier indicators
- [ ] Add tier history tracking
- [ ] Implement tier-based challenge matchmaking
- [ ] Create tier promotion animations
- [ ] Add admin tier management tools

## Monitoring & Adjustments

### Key Metrics to Track
1. **Distribution**: % of users in each tier
2. **Progression Rate**: Average time to reach each tier
3. **Engagement**: Challenge participation by tier
4. **Retention**: User activity correlation with tier

### Target Distribution (Mature System)
- House: 40% (new/casual users)
- Putter: 35% (regular users)
- Iron: 20% (active users)
- Driver: 5% (elite users)

### Adjustment Triggers
- If >50% stay in House after 6 months → Lower Putter threshold
- If >10% reach Driver in Year 1 → Raise Driver threshold
- If challenge bets average <50 CC → Adjust tier benefits

## Future Expansions

### Seasonal Tiers
- Reset certain benefits quarterly
- Seasonal challenges for bonus CC
- Limited-time tier boost events

### Sub-Tiers
- House I, II, III (0-82, 83-165, 166-249)
- Visual progress within each tier
- Mini-rewards at sub-tier boundaries

### Special Achievements
- "Founding Member" badge for early adopters
- "Challenge Master" for 50+ wins
- "Booking Legend" for 100+ bookings
- "Perfect Month" for daily activity

## Technical Implementation

### Database Changes
```sql
-- Already exists in migration 004
CREATE TYPE rank_tier AS ENUM ('house', 'putter', 'iron', 'driver');

-- Add to customer_profiles if not exists
ALTER TABLE customer_profiles
ADD COLUMN IF NOT EXISTS tier_updated_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS tier_benefits_claimed JSONB DEFAULT '{}';

-- Create tier benefits table
CREATE TABLE IF NOT EXISTS tier_benefits (
  tier rank_tier PRIMARY KEY,
  booking_discount INTEGER DEFAULT 0,
  early_booking_days INTEGER DEFAULT 0,
  monthly_cc_bonus INTEGER DEFAULT 0,
  perks JSONB DEFAULT '{}'
);
```

### API Endpoints
```typescript
// GET /api/tiers/current
// Returns user's current tier and progress

// GET /api/tiers/benefits
// Returns all tier benefits

// POST /api/tiers/claim-bonus
// Claims monthly tier bonus

// GET /api/tiers/leaderboard
// Returns tier-based leaderboard
```

## Conclusion

This tier system is designed to:
1. **Reward engagement** through bookings and challenges
2. **Create aspirational goals** with clear progression
3. **Balance accessibility** with exclusivity
4. **Drive retention** through tier benefits
5. **Scale appropriately** with your user base growth

The thresholds are calibrated for:
- New users to reach Putter within 6-12 months
- Active users to reach Iron within 2-3 years
- Only the most dedicated to achieve Driver status
- Natural distribution that encourages engagement without being unattainable