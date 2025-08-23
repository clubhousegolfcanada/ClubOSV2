# Profile Page Real-Time Updates - Implementation Plan

## Current State Analysis

### ✅ What's Working
1. **Database Structure**: `customer_profiles` table has all necessary fields:
   - `cc_balance` - Current ClubCoin balance
   - `total_cc_earned` - Total CC earned all-time
   - `total_challenges_won` - Win count
   - `total_challenges_played` - Total games played
   - `challenge_win_rate` - Win percentage
   - `challenge_streak` - Current streak (+ for wins, - for losses)
   - `max_win_streak` / `max_loss_streak` - Best streaks

2. **Update Mechanism**: `updateWinLossStats()` in challengeService updates:
   - Winner: increments `total_challenges_won`, updates streak
   - Loser: updates loss streak
   - BUT: Missing `total_challenges_played` increment for both!

3. **CC Balance Updates**: ClubCoinService properly credits/debits balances

### ❌ Current Issues

1. **Profile Page Fetching Wrong Data**:
   - Uses `/api/challenges/cc-balance` for balance (correct)
   - Uses `/api/challenges/my-challenges` and counts manually (inefficient)
   - Should use data directly from `customer_profiles` table

2. **Missing Updates**:
   - `total_challenges_played` not incrementing
   - `challenge_win_rate` not recalculating
   - `total_cc_earned` not tracking properly
   - `last_challenge_at` not updating

3. **No Real-Time Updates**:
   - Profile page doesn't refresh after challenge completion
   - User must manually refresh to see new stats

## Implementation Tasks

### Phase 1: Fix Database Updates ⚡

#### Task 1.1: Create Comprehensive Stats Update Trigger
```sql
-- Migration 109_fix_profile_stats_tracking.sql
CREATE OR REPLACE FUNCTION update_challenge_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- When challenge moves to 'resolved' status
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    -- Update both players' total_challenges_played
    UPDATE customer_profiles 
    SET 
      total_challenges_played = total_challenges_played + 1,
      last_challenge_at = CURRENT_TIMESTAMP
    WHERE user_id IN (NEW.creator_id, NEW.acceptor_id);
    
    -- Update winner stats
    IF NEW.winner_user_id IS NOT NULL THEN
      UPDATE customer_profiles 
      SET 
        total_challenges_won = total_challenges_won + 1,
        challenge_win_rate = CASE 
          WHEN total_challenges_played > 0 
          THEN (total_challenges_won + 1)::decimal / (total_challenges_played)::decimal
          ELSE 1.0
        END
      WHERE user_id = NEW.winner_user_id;
    END IF;
    
    -- Recalculate win rates for both players
    UPDATE customer_profiles 
    SET challenge_win_rate = 
      CASE 
        WHEN total_challenges_played > 0 
        THEN total_challenges_won::decimal / total_challenges_played::decimal
        ELSE 0
      END
    WHERE user_id IN (NEW.creator_id, NEW.acceptor_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_challenge_stats_trigger
AFTER UPDATE ON challenges
FOR EACH ROW
EXECUTE FUNCTION update_challenge_stats();
```

#### Task 1.2: Fix CC Earned Tracking
```sql
-- Add trigger for cc_transactions to update total_cc_earned
CREATE OR REPLACE FUNCTION update_cc_earned()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type IN ('challenge_win', 'challenge_stake_return', 'daily_bonus', 'achievement_bonus') THEN
    UPDATE customer_profiles 
    SET total_cc_earned = total_cc_earned + NEW.amount
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cc_earned_trigger
AFTER INSERT ON cc_transactions
FOR EACH ROW
EXECUTE FUNCTION update_cc_earned();
```

### Phase 2: Create Dedicated Profile Stats API 📊

#### Task 2.1: New Profile Stats Endpoint
```typescript
// routes/profileStats.ts
router.get('/api/profile/stats/:userId?', authenticate, async (req, res) => {
  const userId = req.params.userId || req.user.id;
  
  const stats = await db.query(`
    SELECT 
      cp.cc_balance,
      cp.total_cc_earned,
      cp.total_cc_spent,
      cp.total_challenges_played,
      cp.total_challenges_won,
      cp.challenge_win_rate,
      cp.challenge_streak,
      cp.max_win_streak,
      cp.max_loss_streak,
      cp.current_rank,
      cp.highest_rank_achieved,
      cp.last_challenge_at,
      cp.credibility_score,
      u.created_at as member_since,
      (SELECT COUNT(*) FROM friendships 
       WHERE (user_id = $1 OR friend_id = $1) 
       AND status = 'accepted') as friend_count,
      (SELECT COUNT(*) FROM bookings 
       WHERE customer_id = $1) as total_bookings
    FROM customer_profiles cp
    JOIN users u ON u.id = cp.user_id
    WHERE cp.user_id = $1
  `, [userId]);
  
  res.json({ success: true, data: stats.rows[0] });
});
```

### Phase 3: Real-Time Updates via WebSockets 🔄

#### Task 3.1: Add Socket.io for Real-Time Updates
```typescript
// services/realtimeService.ts
export class RealtimeService {
  emitProfileUpdate(userId: string, stats: any) {
    io.to(`user:${userId}`).emit('profile:updated', stats);
  }
  
  emitChallengeResolved(challengeId: string, result: any) {
    const { winnerId, loserId } = result;
    
    // Notify both players
    io.to(`user:${winnerId}`).emit('challenge:resolved', {
      challengeId,
      result: 'won',
      ...result
    });
    
    io.to(`user:${loserId}`).emit('challenge:resolved', {
      challengeId,
      result: 'lost',
      ...result
    });
  }
}
```

#### Task 3.2: Frontend Socket Integration
```typescript
// hooks/useProfileStats.ts
export function useProfileStats(userId?: string) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Initial fetch
    fetchProfileStats(userId);
    
    // Subscribe to updates
    socket.on('profile:updated', (newStats) => {
      setStats(newStats);
    });
    
    socket.on('challenge:resolved', async () => {
      // Refetch stats when challenge resolves
      await fetchProfileStats(userId);
    });
    
    return () => {
      socket.off('profile:updated');
      socket.off('challenge:resolved');
    };
  }, [userId]);
  
  return { stats, loading, refetch: () => fetchProfileStats(userId) };
}
```

### Phase 4: Optimize Profile Page 🚀

#### Task 4.1: Refactor Profile Component
```typescript
// pages/customer/profile.tsx
const { stats, loading, refetch } = useProfileStats(user?.id);

// Remove multiple API calls, use single stats object
const profileData = {
  ccBalance: stats?.cc_balance || 0,
  totalChallenges: stats?.total_challenges_played || 0,
  totalWins: stats?.total_challenges_won || 0,
  winRate: stats?.challenge_win_rate || 0,
  currentStreak: stats?.challenge_streak || 0,
  longestStreak: stats?.max_win_streak || 0,
  rank: stats?.current_rank || 'House',
  totalEarned: stats?.total_cc_earned || 0,
  memberSince: stats?.member_since,
  friendCount: stats?.friend_count || 0,
  totalBookings: stats?.total_bookings || 0
};
```

### Phase 5: Add Auto-Refresh & Notifications 🔔

#### Task 5.1: Auto-Refresh on Tab Focus
```typescript
useEffect(() => {
  const handleFocus = () => {
    if (document.visibilityState === 'visible') {
      refetch(); // Refresh stats when user returns to tab
    }
  };
  
  document.addEventListener('visibilitychange', handleFocus);
  return () => document.removeEventListener('visibilitychange', handleFocus);
}, []);
```

#### Task 5.2: Show Update Notifications
```typescript
// When stats update via socket
socket.on('profile:updated', (newStats) => {
  const oldBalance = stats?.cc_balance || 0;
  const newBalance = newStats.cc_balance || 0;
  
  if (newBalance > oldBalance) {
    toast.success(`+${newBalance - oldBalance} CC earned!`);
  }
  
  setStats(newStats);
});
```

## Testing Checklist

### Database Tests
- [ ] Create challenge, verify both players' `total_challenges_played` increments
- [ ] Resolve challenge, verify winner's `total_challenges_won` increments
- [ ] Verify `challenge_win_rate` recalculates correctly
- [ ] Verify `total_cc_earned` updates on win
- [ ] Verify `challenge_streak` updates properly

### API Tests
- [ ] Profile stats endpoint returns all fields
- [ ] Stats update after challenge resolution
- [ ] CC balance matches actual transactions

### Frontend Tests
- [ ] Profile page loads with correct stats
- [ ] Stats update without page refresh after challenge
- [ ] Socket connection maintains across page navigation
- [ ] Notifications appear for stat changes

## Rollout Plan

### Day 1: Database Fixes
1. Deploy migration 109 to fix stat tracking
2. Run data correction script for existing users
3. Monitor for any trigger errors

### Day 2: API Updates
1. Deploy new profile stats endpoint
2. Update profile page to use new endpoint
3. Remove old inefficient API calls

### Day 3: Real-Time Features
1. Deploy Socket.io integration
2. Enable real-time updates for profile
3. Add notifications for stat changes

### Day 4: Polish & Testing
1. Add auto-refresh on tab focus
2. Comprehensive testing
3. Performance monitoring

## Performance Metrics

### Before Optimization
- Profile page load: 3-4 API calls
- Stats accuracy: ~70% (missing updates)
- Real-time updates: None

### After Optimization
- Profile page load: 1 API call
- Stats accuracy: 100%
- Real-time updates: < 100ms latency

## Rollback Plan

If issues arise:
1. Disable Socket.io updates (feature flag)
2. Revert to old API endpoints
3. Keep database triggers (they're non-breaking)

## Success Criteria

✅ Profile stats update immediately after challenge resolution
✅ CC balance always matches actual balance
✅ Win rate calculates correctly
✅ No manual refresh needed to see updates
✅ Page load time < 500ms