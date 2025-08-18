# Friends System Implementation Plan for ClubCoin Wagering

## Overview
Comprehensive friends system to enable social connections and ClubCoin wagering between customers. All users must have email (required) and optionally phone number for friend discovery.

## Current System Analysis

### Existing Infrastructure
- **Users Table**: Already has email (required), phone (optional), name, role system
- **Customer Profiles**: Extended profile with display_name, bio, avatar, privacy settings
- **Friendships Table**: Already exists with pending/accepted/blocked states
- **Authentication**: Customer signup flow with email validation
- **Database**: PostgreSQL with proper constraints and triggers

### Key Findings
- Friend limit enforcement (250 max) already in triggers
- Privacy settings for profile visibility (public/friends/private)
- Bi-directional friendship tracking in place
- Customer profiles auto-created on user registration

## Phase 1: Enhanced Friends Discovery & Management

### 1.1 Database Schema Updates
```sql
-- Add friend discovery features to existing schema
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS 
  invitation_method VARCHAR(20) DEFAULT 'in_app', -- email, phone, in_app, qr_code
  invitation_message TEXT,
  mutual_friends_count INTEGER DEFAULT 0,
  friendship_source VARCHAR(50); -- search, booking, event, suggestion

-- Friend invitations for non-users
CREATE TABLE IF NOT EXISTS friend_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES users(id),
  invitee_email VARCHAR(255),
  invitee_phone VARCHAR(50),
  invitation_code VARCHAR(20) UNIQUE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, expired
  message TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
  
  CHECK (invitee_email IS NOT NULL OR invitee_phone IS NOT NULL)
);

-- Friend suggestions based on mutual connections
CREATE TABLE IF NOT EXISTS friend_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  suggested_user_id UUID NOT NULL REFERENCES users(id),
  reason VARCHAR(50), -- mutual_friends, same_location, similar_handicap
  mutual_friends INTEGER DEFAULT 0,
  score FLOAT DEFAULT 0, -- Relevance score
  dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, suggested_user_id)
);

-- Contact sync for friend discovery
CREATE TABLE IF NOT EXISTS contact_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  contact_hash VARCHAR(64) NOT NULL, -- SHA256 of email/phone
  contact_type VARCHAR(10) NOT NULL, -- email, phone
  matched_user_id UUID REFERENCES users(id),
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, contact_hash),
  INDEX idx_contact_hash (contact_hash)
);
```

### 1.2 Friend Discovery Features

#### Email-Based Discovery
- Search by exact email match
- Invite via email if not registered
- Auto-match when invited user signs up

#### Phone-Based Discovery  
- Search by phone number (formatted)
- SMS invitation with deep link
- Auto-match on registration

#### Smart Suggestions
- Mutual friends algorithm
- Same clubhouse location
- Similar skill level (handicap)
- Frequent co-bookings

### 1.3 Privacy & Security
- Hash contacts for privacy (SHA256)
- Opt-in contact sync
- Block list management
- Report inappropriate users
- GDPR compliance for contact data

## Phase 2: Friends API Endpoints

### 2.1 Core Friend Management
```typescript
// GET /api/friends - List user's friends
// GET /api/friends/pending - Pending friend requests
// POST /api/friends/request - Send friend request
// PUT /api/friends/:id/accept - Accept request
// PUT /api/friends/:id/reject - Reject request
// DELETE /api/friends/:id - Remove friend
// PUT /api/friends/:id/block - Block user

// Friend Discovery
// POST /api/friends/search - Search by email/phone
// POST /api/friends/invite - Invite non-user
// GET /api/friends/suggestions - Get AI suggestions
// POST /api/friends/sync-contacts - Sync phone contacts

// Privacy
// GET /api/friends/blocked - List blocked users
// PUT /api/friends/privacy - Update privacy settings
```

### 2.2 Implementation Structure
```typescript
// src/routes/friends.ts
interface FriendRequest {
  targetEmail?: string;
  targetPhone?: string;
  targetUserId?: string;
  message?: string;
}

interface FriendSearchParams {
  query: string; // email or phone
  type: 'email' | 'phone' | 'name';
}

interface ContactSync {
  contacts: Array<{
    email?: string;
    phone?: string;
    name?: string;
  }>;
}
```

## Phase 3: Customer UI Implementation

### 3.1 Friends Page Components
```typescript
// src/pages/friends.tsx
- FriendsList: Current friends with ClubCoin balance
- PendingRequests: Incoming/outgoing requests
- FriendSearch: Email/phone search
- FriendSuggestions: Smart recommendations
- InviteFriends: External invitations

// src/components/friends/
- FriendCard.tsx: Display friend info + wager button
- FriendSearch.tsx: Search interface
- ContactImport.tsx: Phone contact sync
- FriendInvite.tsx: Email/SMS invitations
- PrivacySettings.tsx: Control visibility
```

### 3.2 UI Flow
1. **Onboarding**: Prompt to import contacts
2. **Discovery**: Search or browse suggestions  
3. **Connection**: Send/accept requests
4. **Engagement**: View ClubCoin balance, initiate wagers
5. **Management**: Block, remove, privacy controls

### 3.3 Mobile-First Design
- Swipeable friend cards
- Pull-to-refresh friend list
- Quick action buttons (Wager, Message, View Profile)
- Contact permission handling
- Deep linking for invitations

## Phase 4: ClubCoin Integration Points

### 4.1 Friend-Enabled Features
- Display ClubCoin balance on friend cards
- "Wager" button on friend profiles
- Wager history between friends
- Friend leaderboards
- Group wagers for teams

### 4.2 Wager Flow Integration
```typescript
// When initiating wager from friends page
1. Select friend → Show their ClubCoin balance
2. Choose wager amount (5/10/25 CC$)
3. Select booking or create new
4. Send wager invitation
5. Track pending wagers in friends list
```

## Phase 5: HubSpot CRM Sync Architecture

### 5.1 Sync Strategy
```typescript
// Bi-directional sync with HubSpot
interface HubSpotContact {
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  properties: {
    clubos_user_id: string;
    clubcoin_balance: number;
    total_friends: number;
    home_location: string;
    lifetime_wagers: number;
    high_roller_status: boolean;
  };
}
```

### 5.2 Sync Implementation
```typescript
// src/services/hubspotFriendsSync.ts
- syncUserToHubSpot(): Create/update contact
- syncFriendshipsToHubSpot(): Update relationship data
- syncClubCoinActivity(): Track wagering metrics
- webhookHandler(): Real-time updates

// Sync triggers:
- User registration/update
- Friend connection made
- ClubCoin balance change
- Wager completed
```

### 5.3 HubSpot Custom Properties
```
clubos_user_id (text)
clubos_friend_count (number)
clubos_friend_ids (multi-checkbox)
clubcoin_balance (number)
clubcoin_lifetime_earned (number)
clubcoin_lifetime_wagered (number)
high_roller_tier (dropdown)
preferred_location (dropdown)
last_wager_date (date)
wager_win_rate (number)
```

## Phase 6: Implementation Timeline

### Week 1: Database & Backend
- [ ] Create migration for new tables
- [ ] Implement friend discovery queries
- [ ] Build friends API endpoints
- [ ] Add contact hashing service
- [ ] Create invitation system

### Week 2: Frontend UI
- [ ] Build friends page layout
- [ ] Implement search interface
- [ ] Create friend cards component
- [ ] Add contact import flow
- [ ] Implement privacy settings

### Week 3: Integration
- [ ] Connect to ClubCoin system
- [ ] Add wager initiation from friends
- [ ] Implement friend suggestions algorithm
- [ ] Create notification system
- [ ] Add deep linking

### Week 4: HubSpot & Testing
- [ ] Setup HubSpot properties
- [ ] Build sync service
- [ ] Implement webhooks
- [ ] End-to-end testing
- [ ] Performance optimization

## Security Considerations

1. **Data Protection**
   - Hash all contact data before storage
   - Encrypt sensitive friend data
   - Rate limit friend requests
   - Validate all phone/email formats

2. **Privacy Controls**
   - Granular visibility settings
   - Opt-in for all features
   - Easy blocking/reporting
   - GDPR-compliant data handling

3. **Abuse Prevention**
   - Max 10 friend requests per day
   - Cooldown on rejected requests
   - Report system for harassment
   - Admin moderation tools

## Success Metrics

1. **Adoption**
   - % of users with >1 friend
   - Average friends per user
   - Friend request acceptance rate

2. **Engagement**
   - Daily active friends
   - Wagers between friends
   - Friend-sourced signups

3. **Technical**
   - Friend search response time
   - Sync latency with HubSpot
   - Contact match rate

## Next Steps

1. Review and approve plan
2. Create detailed technical specifications
3. Set up HubSpot development environment
4. Begin Phase 1 implementation
5. Establish testing protocols

---

This system provides the foundation for ClubCoin wagering by establishing trusted social connections through email/phone verification, enabling the quiet wagering system described in the ClubCoin plan.