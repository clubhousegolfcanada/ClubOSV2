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
  ('tier.junior.min', '0'),
  ('tier.junior.max', '199'),
  ('tier.house.min', '200'),
  ('tier.house.max', '749'),
  ('tier.amateur.min', '750'),
  ('tier.amateur.max', '1999'),
  ('tier.pro.min', '2000'),
  ('tier.pro.max', '4999'),
  ('tier.master.min', '5000');

-- Update existing rank calculation
UPDATE customer_profiles
SET rank_tier = CASE
  WHEN total_cc_earned >= 5000 THEN 'master'::rank_tier
  WHEN total_cc_earned >= 2000 THEN 'pro'::rank_tier
  WHEN total_cc_earned >= 750 THEN 'amateur'::rank_tier
  WHEN total_cc_earned >= 200 THEN 'house'::rank_tier
  ELSE 'junior'::rank_tier
END;
```

### Tier Benefits Implementation

#### Junior (0-199 CC)
- Base simulator access
- Can book standard times
- Participate in challenges
- View leaderboards
- Welcome bonus opportunities

#### House (200-749 CC)
- Everything in Junior, plus:
- 5% booking discount
- Early access to weekend slots (1 day)
- House badge on profile
- Monthly CC bonus (+10 CC)

#### Amateur (750-1,999 CC)
- Everything in House, plus:
- 10% booking discount
- Priority booking (2 days early)
- Amateur badge and profile customization
- Monthly CC bonus (+25 CC)
- Access to Amateur-only tournaments

#### Pro (2,000-4,999 CC)
- Everything in Amateur, plus:
- 15% booking discount
- VIP booking priority (3 days early)
- Pro badge and premium profile
- Monthly CC bonus (+50 CC)
- Free entry to special events
- Priority challenge matching

#### Master (5,000+ CC)
- Everything in Pro, plus:
- 20% booking discount
- Master booking priority (4 days early)
- Master badge and elite profile
- Monthly CC bonus (+100 CC)
- Personal booking assistant
- Complimentary guest passes (4/month)
- Master-only lounge access
- Special tournament invitations

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
- Junior: 30% (new users)
- House: 35% (regular users)
- Amateur: 20% (active users)
- Pro: 12% (dedicated users)
- Master: 3% (elite users)

### Adjustment Triggers
- If >40% stay in Junior after 6 months → Lower House threshold
- If >5% reach Master in Year 1 → Raise Master threshold
- If challenge bets average <50 CC → Adjust tier benefits
- If <20% reach Amateur by Year 2 → Lower Amateur threshold

## Future Expansions

### Seasonal Tiers
- Reset certain benefits quarterly
- Seasonal challenges for bonus CC
- Limited-time tier boost events

### Sub-Tiers
- Junior I, II (0-99, 100-199)
- House I, II, III (200-349, 350-549, 550-749)
- Amateur I, II, III (750-1149, 1150-1549, 1550-1999)
- Pro I, II (2000-3499, 3500-4999)
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
-- Update existing enum in new migration
-- First rename old values to transition
ALTER TYPE rank_tier RENAME TO rank_tier_old;
CREATE TYPE rank_tier AS ENUM ('junior', 'house', 'amateur', 'pro', 'master');

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

-- Insert default tier benefits
INSERT INTO tier_benefits (tier, booking_discount, early_booking_days, monthly_cc_bonus, perks) VALUES
  ('junior', 0, 0, 0, '{"welcome_bonus": true}'),
  ('house', 5, 1, 10, '{"weekend_early_access": true}'),
  ('amateur', 10, 2, 25, '{"tournaments": true}'),
  ('pro', 15, 3, 50, '{"vip_events": true}'),
  ('master', 20, 4, 100, '{"lounge_access": true, "guest_passes": 4}')
ON CONFLICT (tier) DO UPDATE SET
  booking_discount = EXCLUDED.booking_discount,
  early_booking_days = EXCLUDED.early_booking_days,
  monthly_cc_bonus = EXCLUDED.monthly_cc_bonus,
  perks = EXCLUDED.perks;
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
- New users to reach House within 6-12 months
- Active users to reach Amateur within 2-3 years
- Dedicated users to reach Pro within 3-4 years
- Only the most elite to achieve Master status
- Natural distribution that encourages engagement without being unattainable