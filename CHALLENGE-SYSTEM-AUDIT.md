# Challenge System Audit & Documentation

## Overview
The ClubOS Challenge System enables customers to create head-to-head golf challenges with ClubCoin wagering, TrackMan integration, and comprehensive statistics tracking.

## Key Features Implemented

### 1. Challenge Creation Flow
- **4-step wizard**: Opponent selection → Course/Settings → Wager → Review
- **Skip TrackMan Settings Option**: Users can select "Decide outside of the challenge" to create challenges without specifying TrackMan settings
- **Friend Pre-selection**: Users can click a friend in the Compete page to pre-select them
- **Validation**: Checks CC balance, wager limits (10-10,000 CC), and prevents duplicate challenges

### 2. TrackMan Settings Flexibility
- **With TrackMan Settings**: Full configuration including course, tee position, pins, wind, firmness, attempts, and scoring format
- **Without TrackMan Settings** (NEW): 
  - Select "Decide outside of the challenge" option
  - Backend accepts challenges without courseId
  - Players arrange settings manually outside the system
  - Database migration 103 makes course_id nullable

### 3. Challenge Lifecycle

#### Creation → Acceptance
1. Creator proposes challenge with 50/50 stake split
2. Challenge expires in 7/14/30 days if not accepted
3. Acceptor reviews and accepts/declines
4. On acceptance, both stakes are locked via ClubCoin service

#### Play → Resolution
1. Players complete rounds (with or without TrackMan)
2. Scores synced via `/api/challenges/:id/play-sync` endpoint
3. System auto-resolves when both scores recorded
4. Winner receives total pot plus any bonuses

#### Profile Updates
- Win/loss statistics updated in customer_profiles
- Challenge streaks tracked (win/loss)
- Total challenges played/won maintained
- Rank calculations updated after resolution

### 4. ClubCoin Integration
- **Balance Checking**: Validates sufficient CC before challenge creation
- **Stake Locking**: Locks stakes on acceptance via clubCoinService
- **Payout Processing**: Winner receives full pot
- **Bonus Awards**: Champion markers get 20% bonus on victories
- **Transaction Ledger**: All CC movements tracked

### 5. Data Flow & Storage

#### Database Tables
- `challenges`: Core challenge data
- `challenge_plays`: Individual play records with scores
- `stakes`: Stake amounts and status
- `customer_profiles`: Updated with win/loss stats
- `cc_transactions`: ClubCoin transaction history

#### API Endpoints
- `POST /api/challenges`: Create new challenge
- `GET /api/challenges/my-challenges`: List user's challenges
- `POST /api/challenges/:id/accept`: Accept challenge
- `POST /api/challenges/:id/decline`: Decline challenge
- `POST /api/challenges/:id/play-sync`: Submit scores
- `POST /api/challenges/:id/dispute`: File dispute

### 6. Frontend Components

#### Compete Page (`/customer/compete`)
- 4 tabs: Challenges, Competitors, Leaderboard, Requests
- Filter challenges by status (all, active, pending, history)
- Friend management with challenge buttons
- Real-time CC balance display

#### Create Challenge Page (`/customer/challenges/create`)
- Progressive 4-step form
- Friend search and selection
- Course dropdown with "Decide outside" option
- Wager calculator with stake breakdown
- Review screen with all details

#### Challenge Detail Page (`/customer/challenges/[id]`)
- Challenge status and timeline
- Player cards with ranks and stats
- Score display when completed
- Action buttons (accept/decline/dispute)

## Code Changes Made

### Frontend Changes
1. **create.tsx**: Added logic to handle "DECIDE_LATER" course selection
   - Conditionally shows/hides TrackMan settings grid
   - Sends different payload based on selection
   - Displays info message when deciding outside

### Backend Changes
1. **challenges.ts**: Made courseId optional in validation
2. **challengeService.ts**: 
   - Made courseId optional in CreateChallengeDto interface
   - Added separate duplicate checking for "decide later" challenges
3. **Migration 103**: Created to make course_id nullable in database

## Testing Checklist

### ✅ Completed
- [x] Review create challenge implementation
- [x] Verify skip TrackMan settings option works
- [x] Fix backend to handle optional courseId
- [x] Test challenge creation flow
- [x] Audit profile update integration
- [x] Verify ClubCoin service integration

### 🔄 Pending Verification
- [ ] End-to-end test with actual users
- [ ] Score submission via play-sync
- [ ] Automatic resolution and payout
- [ ] Leaderboard updates after wins
- [ ] Rank recalculation trigger

## Known Limitations
1. Score submission currently requires TrackMan integration
2. Manual score entry not yet implemented for "decide later" challenges
3. Dispute resolution process needs admin interface

## Recommendations
1. Add manual score entry form for non-TrackMan challenges
2. Implement challenge history view with filters
3. Add push notifications for challenge events
4. Create admin dashboard for dispute management
5. Add challenge statistics to user profiles

## Security Considerations
- Rate limiting on challenge creation (10/hour, 5 high-value/day)
- Credibility scoring affects challenge limits
- Duplicate challenge prevention
- Stake validation before locking CC
- Transaction atomicity with database transactions

## Integration Points
- **ClubCoin Service**: Balance checks, stake locking, payouts
- **Badge Rules Engine**: Awards achievements based on wins
- **Rank Calculation Service**: Updates ranks after challenges
- **Notification Service**: Alerts for challenge events
- **TrackMan Integration**: Optional score verification

## Database Schema
```sql
-- challenges table (simplified)
CREATE TABLE challenges (
  id UUID PRIMARY KEY,
  creator_id VARCHAR NOT NULL,
  acceptor_id VARCHAR NOT NULL, 
  course_id VARCHAR, -- Now nullable for "decide later"
  course_name VARCHAR NOT NULL,
  wager_amount DECIMAL NOT NULL,
  status challenge_status NOT NULL,
  trackman_settings JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- challenge_plays table
CREATE TABLE challenge_plays (
  challenge_id UUID REFERENCES challenges(id),
  user_id VARCHAR,
  score INTEGER,
  trackman_round_id VARCHAR,
  played_at TIMESTAMP,
  PRIMARY KEY (challenge_id, user_id)
);
```

## Success Metrics
- Challenge creation rate
- Acceptance rate (accepted/total invites)
- Completion rate (resolved/accepted)
- Average pot size
- Dispute rate
- User retention in challenge system

## Future Enhancements
1. **Team Challenges**: 2v2 or larger group challenges
2. **Tournament Mode**: Multi-round elimination brackets
3. **Handicap System**: Fair play adjustments
4. **Challenge Templates**: Save favorite settings
5. **Spectator Mode**: Watch live challenges
6. **Challenge Analytics**: Performance insights and trends