# Active Challenges Complete Pathway Documentation

## Overview
This document traces the complete pathway for how active challenges are fetched, processed, and displayed in the ClubOS system.

## Backend Flow

### 1. Database Storage
- **Table**: `challenges`
- **Key Status Values**:
  - `pending` - Challenge created, waiting for acceptance
  - `accepted` - Challenge accepted, ready to play
  - `active` - Challenge in progress
  - `awaiting_sync` - One player has completed
  - `ready_resolve` - Both players completed
  - `resolved` - Challenge finished
  - `expired` - Challenge expired before acceptance

### 2. API Endpoints

#### Primary Endpoint: `/api/challenges/my-challenges`
**Location**: `ClubOSV1-backend/src/routes/challenges.ts:231-318`

**Process**:
1. Authenticates user via JWT token
2. Executes SQL query that:
   - Joins `challenges` with `users` table for names
   - Joins `customer_profiles` for ranks
   - Left joins `challenge_plays` for scores
   - Filters by user ID (creator OR acceptor)
   - Orders by status (pending first, then active, then resolved)
   - Returns up to 100 challenges

**Data Transformation**:
```javascript
{
  id: challenge.id,
  status: display_status || status,
  opponent_name: (calculated based on user),
  wagerAmount: parseFloat(wager_amount),
  totalPot: parseFloat(total_pot),
  expiresAt: expires_at,
  courseName: course_name,
  creatorScore: creator_played_score,
  acceptorScore: acceptor_played_score
}
```

#### Secondary Endpoints (currently unused):
- `/api/challenges/active` - Returns only active challenges
- `/api/challenges/pending` - Returns only pending challenges
- `/api/challenges/history` - Returns completed challenges

## Frontend Flow

### 1. Data Fetching
**Location**: `ClubOSV1-frontend/src/pages/customer/compete.tsx`

#### Loading Process (lines 157-199):
```javascript
const loadChallenges = async () => {
  // Fetches from /api/challenges/my-challenges
  // Filters based on challengeFilter state:
  // - 'all': Shows everything
  // - 'active': Filters for status === 'active' || 'accepted'
  // - 'pending': Filters for status === 'pending'
  // - 'history': Filters for status === 'resolved' || 'expired' || 'declined'
}
```

### 2. UI Display Structure

#### Component Location (lines 499-611):
```
Compete Page
├── Header with CC Balance
├── Tab Navigation
│   ├── Challenges (with pending count badge)
│   ├── Competitors
│   ├── Leaderboard
│   └── Requests
└── Content Area
    └── Challenges Tab
        ├── Filter Pills (All/Active/Pending/History)
        └── Challenge Cards
```

#### Challenge Card Display (lines 547-607):
Each challenge card shows:
- **Opponent Name**: vs {opponent_name}
- **Rank Icon**: Visual indicator of opponent's rank
- **Status Badge**: Color-coded status indicator
  - Yellow: Pending
  - Green: Active/Accepted
  - Gray: Resolved
  - Red: Expired/Declined
- **Wager Amount**: Amount in CC
- **Time Remaining**: Calculated from expires_at
- **Action Buttons** (for pending challenges):
  - Accept button (green)
  - Decline button (gray)

### 3. User Interactions

#### Challenge Navigation:
- **Clicking on active/resolved challenge**: Routes to `/customer/challenges/{id}`
- **Pending challenges**: Don't navigate, show Accept/Decline buttons

#### Accept Challenge Flow:
```javascript
handleAcceptChallenge(challengeId) {
  // POST to /api/challenges/{id}/accept
  // Updates local state
  // Shows success toast
  // Refreshes challenge list
}
```

#### Decline Challenge Flow:
```javascript
handleDeclineChallenge(challengeId) {
  // POST to /api/challenges/{id}/decline
  // Updates local state
  // Shows confirmation
  // Refreshes challenge list
}
```

## Data Flow Summary

1. **User opens Compete page** → Frontend calls `/api/challenges/my-challenges`
2. **Backend queries database** → Returns all user's challenges with opponent info
3. **Frontend receives data** → Filters based on selected tab filter
4. **UI renders challenge cards** → Shows status, opponent, wager, actions
5. **User interacts** → Accept/Decline/Navigate to details
6. **State updates** → Refreshes list, updates UI

## Key Issues Fixed

1. **Empty Array Bug**: The `/api/challenges/my-challenges` endpoint was returning empty array (TODO placeholder)
2. **Solution**: Implemented full query to fetch all challenges with proper joins and formatting

## Current Status Colors & States

- **Pending** (Yellow): Waiting for acceptance
- **Active/Accepted** (Green): In progress
- **Resolved** (Gray): Completed
- **Expired/Declined** (Red): No longer valid

## Notes

- The frontend fetches ALL challenges and filters client-side
- Active challenges include both 'accepted' and 'active' statuses
- The 50/50 stake split is now implemented (was 30/70)
- CC balances are deducted when challenge is accepted
- Challenges expire based on expiry_days (7, 14, or 30 days)