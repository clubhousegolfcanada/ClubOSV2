# 🎯 Signup Enhancements & Leaderboard Integration Plan

## Overview
Enhance the customer signup experience with automatic rewards and social features to boost engagement from day one.

---

## 📋 Features to Implement

### 1. **Automatic 100 ClubCoins for New Signups**
- **What**: Every new customer gets 100 CC (ClubCoins) upon account creation
- **Why**: Immediate engagement, allows participation in challenges right away
- **Where**: Backend signup endpoint `/auth/signup`

### 2. **Automatic Leaderboard Entry**
- **What**: New users automatically join the seasonal leaderboard with starting rank
- **Why**: Immediate visibility in competitive ecosystem
- **Where**: Signup process triggers leaderboard entry

### 3. **Friend Requests from Leaderboard**
- **What**: Add "Send Friend Request" button on All-Time leaderboard entries
- **Why**: Easy social connections with other players
- **Where**: Customer leaderboard page

### 4. **Friend Request Inbox**
- **What**: Dedicated inbox for pending friend requests
- **Why**: Clear management of social connections
- **Where**: Friends page with notification badge

---

## 🏗️ Implementation Steps

### Phase 1: Backend Foundation (Database & API)

#### 1.1 Database Updates
```sql
-- Already have clubcoins table, need to ensure:
-- 1. Default balance entry on signup
-- 2. Transaction logging for signup bonus

-- Friend requests table (if not exists)
CREATE TABLE IF NOT EXISTS friend_requests (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER REFERENCES users(id),
  recipient_id INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP,
  UNIQUE(sender_id, recipient_id)
);

-- Add indexes for performance
CREATE INDEX idx_friend_requests_recipient ON friend_requests(recipient_id, status);
CREATE INDEX idx_friend_requests_sender ON friend_requests(sender_id, status);
```

#### 1.2 Signup Endpoint Updates
- Modify `/auth/signup` to:
  1. Create user account
  2. Add 100 CC initial balance
  3. Create "Signup Bonus" transaction
  4. Add to current season leaderboard
  5. Initialize rank at "House" tier

### Phase 2: Frontend - Signup Flow

#### 2.1 Signup Confirmation
- Show welcome message with CC bonus
- Display: "Welcome! You've received 100 ClubCoins to start challenging friends!"
- Auto-redirect to profile or challenges page

### Phase 3: Leaderboard Integration

#### 3.1 All-Time Leaderboard UI
```tsx
// Add to each leaderboard row:
<button 
  onClick={() => sendFriendRequest(player.id)}
  className="add-friend-btn"
>
  <UserPlus size={16} />
  Add Friend
</button>
```

#### 3.2 Friend Request API
```typescript
// New endpoints needed:
POST /api/friends/request
  - Send friend request to user
  - Check if already friends
  - Prevent duplicate requests

GET /api/friends/requests
  - Get pending requests (received)
  - Include sender info
  
PUT /api/friends/request/:id/accept
PUT /api/friends/request/:id/reject
  - Handle request responses
```

### Phase 4: Friend Request Inbox

#### 4.1 UI Components
- **Inbox Tab** on Friends page
- **Badge** showing pending count
- **Request Cards** with:
  - Sender name & avatar
  - Rank/tier badge
  - Accept/Reject buttons
  - Time received

#### 4.2 Notifications
- Red dot on Friends navigation item
- Count badge on Inbox tab
- Toast notifications for new requests

---

## 🎨 UI/UX Mockup

### Friend Request Flow
```
All-Time Leaderboard
┌─────────────────────────────────┐
│ #1 TigerWoods97  🏆 Legend      │
│    18,450 CC    [Add Friend +]  │
├─────────────────────────────────┤
│ #2 HappyGilmore  ⭐ Champion    │
│    15,200 CC    [Add Friend +]  │
└─────────────────────────────────┘
         ↓ Click
    Friend Request Sent!
         ↓
    Friends Page → Inbox
┌─────────────────────────────────┐
│ Friend Requests (3)             │
├─────────────────────────────────┤
│ 🔵 TigerWoods97 wants to connect│
│    Legend Rank • 2 hours ago    │
│    [Accept ✓]  [Decline ✗]      │
└─────────────────────────────────┘
```

---

## 📊 Database Schema Updates

### Current Tables to Modify:
1. **users** - No changes needed
2. **clubcoins** - Add signup bonus transaction
3. **seasons_participants** - Auto-add on signup
4. **friends** - Link accepted requests

### New Table:
- **friend_requests** - Track pending/rejected requests

---

## 🔄 API Endpoints

### Modified Endpoints:
- `POST /auth/signup` - Add CC bonus & leaderboard entry

### New Endpoints:
- `POST /api/friends/request` - Send friend request
- `GET /api/friends/requests` - Get pending requests
- `PUT /api/friends/request/:id/accept` - Accept request
- `PUT /api/friends/request/:id/reject` - Reject request
- `GET /api/friends/requests/count` - Get unread count

---

## ⚡ Performance Considerations

1. **Caching**: Cache friend request counts
2. **Rate Limiting**: Limit friend requests (10/hour)
3. **Batch Operations**: Process multiple requests together
4. **Indexes**: Proper database indexes for queries

---

## 🧪 Testing Requirements

1. **Signup Flow**:
   - Verify 100 CC credited
   - Check transaction log
   - Confirm leaderboard entry

2. **Friend Requests**:
   - Send from leaderboard
   - Receive in inbox
   - Accept/reject flow
   - Duplicate prevention

3. **Edge Cases**:
   - Already friends
   - Blocked users
   - Request to self
   - Deleted accounts

---

## 📈 Success Metrics

- New user engagement rate
- Friend connections per user
- Challenge participation rate
- CC usage in first 24 hours

---

## 🚀 Deployment Steps

1. Database migrations
2. Backend API updates
3. Frontend components
4. Testing in staging
5. Production deployment
6. Monitor metrics

---

## Timeline Estimate

- **Phase 1**: 2-3 hours (Backend)
- **Phase 2**: 1 hour (Signup UI)
- **Phase 3**: 2-3 hours (Leaderboard)
- **Phase 4**: 2-3 hours (Inbox)
- **Testing**: 1-2 hours
- **Total**: ~10 hours

---

## Next Steps

1. Review and approve plan
2. Create database migration
3. Update signup endpoint
4. Build friend request system
5. Implement UI components
6. Test thoroughly
7. Deploy to production