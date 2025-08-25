# Leaderboard Sorting Implementation Plan

## Current State
- Leaderboard is hardcoded to sort by `total_cc_earned DESC`
- Frontend displays: rank, name, CC balance, wins, win rate
- No UI controls for changing sort order
- Data available: total_cc_earned, cc_balance, total_challenges_won, win_rate

## Proposed Sorting Options

### 1. Sort By Options
- **Total ClubCoins** (default) - total_cc_earned DESC
- **Current Balance** - cc_balance DESC  
- **Total Wins** - total_challenges_won DESC
- **Win Rate** - challenge_win_rate DESC (min 10 games)
- **Achievement Points** - achievement_points DESC

### 2. API Changes

#### Backend Endpoint Update
```typescript
// GET /api/leaderboard/alltime?sort=cc_earned&limit=100
// sort options: cc_earned, cc_balance, wins, win_rate, achievements
```

#### SQL Query Modifications
- Add dynamic ORDER BY clause based on sort parameter
- Maintain secondary/tertiary sort for tie-breaking
- Keep ROW_NUMBER() for consistent ranking

### 3. Frontend Changes

#### Sort Dropdown UI
```tsx
// Add above the leaderboard, next to search
<select value={sortBy} onChange={handleSortChange}>
  <option value="cc_earned">Total ClubCoins</option>
  <option value="cc_balance">Current Balance</option>
  <option value="wins">Total Wins</option>
  <option value="win_rate">Win Rate</option>
  <option value="achievements">Achievement Points</option>
</select>
```

#### State Management
- Add sortBy state to LeaderboardList component
- Pass sort parameter to API call
- Cache results per sort option

### 4. Implementation Steps

1. **Backend (leaderboard.ts)**
   - Add sort query parameter validation
   - Build dynamic ORDER BY clause
   - Update ROW_NUMBER() window function
   - Add metadata showing current sort

2. **Frontend (LeaderboardList.tsx)**
   - Add sort dropdown component
   - Add sortBy state (default: 'cc_earned')
   - Update API call with sort parameter
   - Style dropdown to match design

3. **Testing**
   - Verify each sort option works correctly
   - Check tie-breaking logic
   - Test with users having NULL values
   - Ensure rank numbers update properly

### 5. Sort Logic Details

#### Total ClubCoins (Default)
```sql
ORDER BY COALESCE(cp.total_cc_earned, 0) DESC, 
         COALESCE(cp.cc_balance, 0) DESC, 
         u.name ASC
```

#### Current Balance
```sql
ORDER BY COALESCE(cp.cc_balance, 0) DESC,
         COALESCE(cp.total_cc_earned, 0) DESC,
         u.name ASC
```

#### Total Wins
```sql
ORDER BY COALESCE(cp.total_challenges_won, 0) DESC,
         COALESCE(cp.challenge_win_rate, 0) DESC,
         u.name ASC
```

#### Win Rate (min 10 games)
```sql
ORDER BY CASE 
           WHEN COALESCE(cp.total_challenges_played, 0) < 10 THEN -1
           ELSE COALESCE(cp.challenge_win_rate, 0)
         END DESC,
         COALESCE(cp.total_challenges_won, 0) DESC,
         u.name ASC
```

#### Achievement Points
```sql
ORDER BY COALESCE(cp.achievement_points, 0) DESC,
         COALESCE(cp.achievement_count, 0) DESC,
         u.name ASC
```

### 6. UI/UX Considerations

- Sort dropdown should be mobile-friendly
- Show current sort in metadata/subtitle
- Consider adding sort direction toggle (ASC/DESC)
- Highlight sorted column in table
- Maintain scroll position on sort change
- Add loading state during re-sort

### 7. Performance Optimizations

- Add database indexes for commonly sorted columns
- Consider caching sorted results
- Implement pagination for large datasets
- Use React.memo to prevent unnecessary re-renders

## Next Steps

1. Implement backend sort parameter handling
2. Add frontend sort dropdown UI
3. Test all sort combinations
4. Update documentation