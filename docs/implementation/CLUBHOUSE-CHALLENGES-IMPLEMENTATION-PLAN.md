# Clubhouse Challenges Implementation Plan

## Overview
Complete implementation plan for the Clubhouse Challenges system, integrating with existing ClubOS infrastructure, HubSpot CRM, Skedda booking platform, and TrackMan scoring system.

## Phase 1: Database Foundation (Week 1)

### 1.1 Core Schema Extensions
- [ ] Create migration `004_challenges_core.sql`
  - Extend Users table with challenge-specific fields
  - Add Season table for seasonal tracking
  - Create RankAssignment table for rank history
  - Add rank_tiers enum (House, Amateur, Bronze, Silver, Gold, Pro, Champion, Legend)

### 1.2 Challenge Tables
- [ ] Create migration `005_challenges_system.sql`
  - Challenge table with all game configuration
  - Stake table for locked wagers
  - Result table for outcomes
  - Audit table for dispute tracking
  - Challenge_settings for TrackMan configs

### 1.3 Gamification Tables
- [ ] Create migration `006_gamification_features.sql`
  - ChampionMarker table for tournament winners
  - Badge catalog table with categories
  - UserBadge junction table
  - Badge_rules for trigger definitions
  - CC_transactions for ClubCoin ledger

### 1.4 Extend Existing Tables
- [ ] Update customer_profiles:
  - Add cc_balance (DECIMAL)
  - Add credibility_score (INTEGER 0-100)
  - Add current_rank_id (FK to rank_tiers)
  - Add total_challenges_played
  - Add total_challenges_won
  - Add win_rate
  - Add highest_rank_achieved

## Phase 2: Backend Services (Week 2-3)

### 2.1 ClubCoin Service
- [ ] Create `/backend/src/services/clubCoinService.ts`
  - Balance management functions
  - Transaction logging with audit trail
  - Mint/burn functions for bonuses
  - Transfer functions for challenge payouts
  - Balance validation before stakes

### 2.2 TrackMan Integration
- [ ] Create `/backend/src/services/trackmanService.ts`
  - Settings catalog sync
  - Course/tee/wind configuration pull
  - Result verification webhook handler
  - Round data validation
  - Score card parsing

### 2.3 Challenge Engine
- [ ] Create `/backend/src/services/challengeService.ts`
  - Challenge creation with validation
  - Stake locking mechanism
  - Accept/decline logic
  - Play synchronization
  - Resolution calculator
  - Bonus computation
  - No-show penalty handler

### 2.4 Rank System
- [ ] Create `/backend/src/services/rankService.ts`
  - Percentile calculator for CC earnings
  - Rank assignment by cut lines
  - Tournament override handler
  - Seasonal reset processor
  - Rank history tracking

### 2.5 Badge Engine
- [ ] Create `/backend/src/services/badgeService.ts`
  - Rule evaluation engine
  - Trigger system for achievements
  - Badge awarding logic
  - Progress tracking
  - Badge catalog management

### 2.6 HubSpot Integration Enhancement
- [ ] Extend `/backend/src/services/hubspotService.ts`
  - Add challenge activity tracking
  - Update contact properties with rank/badges
  - Create challenge engagement timeline events
  - Sync CC balance as custom property

### 2.7 Skedda Integration
- [ ] Create `/backend/src/services/skeddaChallengeService.ts`
  - Link bookings to challenge plays
  - Verify bay/time for challenge rounds
  - Auto-detect challenge round starts
  - Booking reminder for pending challenges

## Phase 3: API Layer (Week 3-4)

### 3.1 Challenge APIs
- [ ] POST `/api/challenges` - Create challenge
- [ ] GET `/api/challenges` - List user's challenges
- [ ] GET `/api/challenges/:id` - Challenge details
- [ ] POST `/api/challenges/:id/accept` - Accept challenge
- [ ] POST `/api/challenges/:id/decline` - Decline with reason
- [ ] POST `/api/challenges/:id/play-sync` - Submit round data
- [ ] POST `/api/challenges/:id/resolve` - Auto/manual resolution
- [ ] POST `/api/challenges/:id/dispute` - File dispute
- [ ] GET `/api/challenges/pending` - Pending invites
- [ ] GET `/api/challenges/active` - In-progress challenges

### 3.2 Leaderboard APIs
- [ ] GET `/api/leaderboards/seasonal` - Current season rankings
- [ ] GET `/api/leaderboards/all-time` - Historical CC leaders
- [ ] GET `/api/leaderboards/activity` - Recent challenge feed
- [ ] GET `/api/leaderboards/location/:id` - Location-specific

### 3.3 Profile APIs
- [ ] GET `/api/profile/:userId/challenges` - Challenge history
- [ ] GET `/api/profile/:userId/badges` - Earned badges
- [ ] GET `/api/profile/:userId/stats` - Challenge statistics
- [ ] GET `/api/profile/:userId/rank-history` - Rank progression

### 3.4 Admin APIs
- [ ] GET `/api/admin/challenges/disputes` - Dispute queue
- [ ] POST `/api/admin/challenges/:id/review` - Resolve dispute
- [ ] POST `/api/admin/challenges/settings` - Update configs
- [ ] GET `/api/admin/challenges/metrics` - System metrics
- [ ] POST `/api/admin/users/:id/sanctions` - Apply restrictions

## Phase 4: Frontend UI (Week 4-5)

### 4.1 Challenge Components
- [ ] Create `/frontend/src/components/challenges/ChallengeCreator.tsx`
  - Opponent selector with search
  - Course/settings picker
  - Wager slider with stake preview
  - Expiry selector
  - Bonus calculator display

- [ ] Create `/frontend/src/components/challenges/ChallengeCard.tsx`
  - Status indicator
  - Countdown timer
  - Action buttons
  - Quick stats
  - Stake amounts

- [ ] Create `/frontend/src/components/challenges/ChallengeAcceptor.tsx`
  - Rule review panel
  - Stake confirmation
  - Accept/decline buttons
  - Counter-offer option

### 4.2 New Customer Pages
- [ ] Create `/frontend/src/pages/customer/challenges.tsx`
  - Active challenges list
  - Pending invites
  - Create challenge button
  - Filter/sort options

- [ ] Create `/frontend/src/pages/customer/leaderboards.tsx`
  - Tab navigation (Seasonal/All-time/Activity)
  - Rank badges display
  - Champion markers
  - CC totals
  - Search/filter

### 4.3 Profile Enhancements
- [ ] Update `/frontend/src/pages/customer/profile.tsx`
  - Add rank display with icon
  - Badge showcase shelf
  - Challenge stats card
  - CC balance widget
  - Rank history graph
  - Champion markers

### 4.4 UI Integration Points
- [ ] Update CustomerNavigation:
  - Add Challenges menu item
  - Show pending challenge count badge
  - Add CC balance in header

- [ ] Update customer dashboard:
  - Active challenges widget
  - Rank progress card
  - Recent badges earned
  - Quick challenge creation

## Phase 5: Notification System (Week 5)

### 5.1 Challenge Notifications
- [ ] Challenge received
- [ ] Challenge accepted/declined
- [ ] 72-hour expiry warning
- [ ] 12-hour expiry warning
- [ ] Challenge completed
- [ ] Challenge resolved (win/loss)
- [ ] Dispute filed
- [ ] Dispute resolved

### 5.2 Achievement Notifications
- [ ] Badge earned
- [ ] Rank promotion/demotion
- [ ] CC milestone reached
- [ ] Champion marker awarded

### 5.3 Integration Points
- [ ] Push notifications via existing system
- [ ] Email notifications via HubSpot
- [ ] In-app toast notifications
- [ ] SMS for urgent (optional)

## Phase 6: Jobs & Automation (Week 6)

### 6.1 Scheduled Jobs
- [ ] Create `/backend/src/jobs/challengeExpiry.ts`
  - Run hourly
  - Check expired challenges
  - Apply no-show penalties
  - Refund stakes

- [ ] Create `/backend/src/jobs/seasonalReset.ts`
  - Configurable schedule
  - Calculate final ranks
  - Archive season data
  - Reset CC totals
  - Assign new ranks

- [ ] Create `/backend/src/jobs/badgeEvaluator.ts`
  - Run after each challenge
  - Check badge criteria
  - Award new badges
  - Update progress

### 6.2 Webhook Handlers
- [ ] TrackMan round completion
- [ ] Skedda booking confirmation
- [ ] HubSpot contact updates

## Phase 7: Admin Tools (Week 6-7)

### 7.1 Operations Pages
- [ ] Create `/frontend/src/pages/operations/challenges.tsx`
  - Dispute review queue
  - Challenge metrics dashboard
  - User sanctions interface
  - System configuration

### 7.2 Configuration Panel
- [ ] Season duration settings
- [ ] Rank cut line adjustments
- [ ] Bonus multiplier configs
- [ ] Badge catalog management
- [ ] Rate limit settings
- [ ] Credibility thresholds

## Phase 8: Testing & Security (Week 7)

### 8.1 Test Coverage
- [ ] Unit tests for challenge mechanics
- [ ] Integration tests for TrackMan sync
- [ ] E2E tests for challenge lifecycle
- [ ] Load tests for leaderboards
- [ ] Security tests for stake handling

### 8.2 Security Implementation
- [ ] Tamper-proof state transitions
- [ ] Signed webhook payloads
- [ ] Rate limiting per user
- [ ] Fraud detection rules
- [ ] Audit trail verification

## Phase 9: Analytics & Monitoring (Week 8)

### 9.1 Metrics Implementation
- [ ] Challenge creation rate
- [ ] Acceptance rate
- [ ] Completion rate
- [ ] No-show rate by rank
- [ ] CC circulation metrics
- [ ] Rank distribution health
- [ ] Badge award frequency

### 9.2 Dashboards
- [ ] Real-time challenge activity
- [ ] CC economy health
- [ ] User engagement metrics
- [ ] Dispute frequency
- [ ] System performance

## Phase 10: Launch Preparation (Week 8)

### 10.1 Beta Testing
- [ ] Internal testing with staff
- [ ] Closed beta with select users
- [ ] Bug fixes and refinements
- [ ] Performance optimization

### 10.2 Documentation
- [ ] User guide for challenges
- [ ] Admin operation manual
- [ ] API documentation
- [ ] Badge catalog with descriptions

### 10.3 Marketing Prep
- [ ] Launch announcement content
- [ ] Tutorial videos
- [ ] Badge reveal campaign
- [ ] Initial CC distribution plan

## Integration Checkpoints

### Existing System Integration
- [ ] Verify auth flow with existing user system
- [ ] Test customer role permissions
- [ ] Ensure mobile responsiveness
- [ ] Validate with existing notification system
- [ ] Check HubSpot data sync
- [ ] Confirm Skedda booking linkage
- [ ] Test with production database

### Performance Targets
- Challenge creation: < 500ms
- Leaderboard load: < 1s
- Profile with badges: < 750ms
- Real-time updates via WebSocket

### Rollback Plan
- Feature flags for gradual rollout
- Database migration rollback scripts
- Cache clearing procedures
- Emergency disable switch

## Next Immediate Steps

1. Start with database migrations (Phase 1.1)
2. Create ClubCoin service foundation
3. Build basic challenge CRUD APIs
4. Implement minimal UI for testing
5. Add TrackMan webhook handler

## Notes

- All timestamps in America/Toronto timezone
- CC balance stored as DECIMAL(10,2)
- Use existing role system (customer role)
- Leverage existing notification infrastructure
- Build on current React/Next.js/TypeScript stack
- Maintain mobile-first responsive design
- Follow existing ClubOS coding patterns