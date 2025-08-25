# ClubOS Tier System & All-Time Rankings Documentation

## Overview

The ClubOS tier system is a gamification feature that categorizes players based on their **total ClubCoin (CC) earnings**. It provides visual recognition, progression tracking, and creates a competitive hierarchy within the golf simulator community.

## Tier Structure

### 6 Tier Levels (Introduced in v1.14.41)

| Tier | Name | CC Required | Icon | Color Theme | Border Color |
|------|------|-------------|------|-------------|--------------|
| 1 | **Junior** | 0-199 CC | Star ⭐ | Gray | Gray-200 |
| 2 | **House** | 200-749 CC | Trophy 🏆 | ClubOS Green (#0B3D3A) | Green/30 |
| 3 | **Amateur** | 750-1,999 CC | Award 🏅 | Blue | Blue-300/50 |
| 4 | **Pro** | 2,000-4,999 CC | Crown 👑 | Purple | Purple-300/50 |
| 5 | **Master** | 5,000-9,999 CC | Sparkles ✨ | Amber/Gold | Amber-400/50 |
| 6 | **Legend** | 10,000+ CC | Gem 💎 | Purple Gradient | Purple-400/50 |

### Note on "Legend" Tier
- Added in frontend (TierBadge.tsx) but not in database enum
- Database only has 5 tiers (junior, house, amateur, pro, master)
- Legend tier (10,000+ CC) exists in UI only for aspirational purposes

## All-Time Rankings Page

### Location
- **Route**: `/customer/leaderboard`
- **Tab**: "All Time" (rightmost tab)

### Features

1. **Four Leaderboard Types**:
   - Pro League (TrackMan embed)
   - House League (TrackMan embed)
   - Closest to Pin (TrackMan embed)
   - **All Time** (Custom ClubOS implementation)

2. **All-Time Leaderboard Data**:
   - Fetches from `/api/leaderboard/alltime`
   - Shows top 100 players by default
   - Ranked by `total_cc_earned` (lifetime earnings)
   - Secondary sort by `cc_balance` (current balance)
   - Tertiary sort by name (alphabetical)

3. **Visual Elements**:
   - **Rank Number**: Gold for 1st, Silver for 2nd, Bronze for 3rd
   - **Tier Icon**: Shows next to player name based on CC balance
   - **Tier Border**: Subtle left border color based on tier
   - **Rank Change Indicators**: 
     - Green up arrow with number for rank improvement
     - Red down arrow for rank decline
     - Gray dash for no change
   - **Achievement Badges**: Up to 3 featured achievements
   - **Champion Marker**: Yellow badge for tournament champions

4. **Interactive Features**:
   - **Search**: Filter players by name
   - **Pull-to-Refresh**: Mobile gesture support
   - **Virtual Scrolling**: Loads more players as you scroll
   - **Friend Requests**: Send requests directly from leaderboard
   - **Profile Links**: Click player to view their profile

## Technical Implementation

### Frontend Components

1. **`TierBadge.tsx`**:
   - Core tier display component
   - `calculateTierFromCC()`: Determines tier from CC amount
   - `TierProgressBar`: Shows progression to next tier
   - Exports tier configurations for reuse

2. **`LeaderboardList.tsx`**:
   - Main leaderboard display component
   - Handles data fetching and refresh
   - Applies tier-based styling
   - Virtual scrolling for performance
   - Friend request functionality

3. **Visual Hierarchy**:
   ```
   Legend (Purple gradient) - Most prestigious
   Master (Gold/Amber) - Elite status
   Pro (Purple) - Advanced players
   Amateur (Blue) - Intermediate
   House (Green) - Regular members
   Junior (Gray) - Beginners
   ```

### Backend Implementation

1. **Database Schema**:
   ```sql
   customer_profiles:
   - cc_balance: Current ClubCoin balance
   - total_cc_earned: Lifetime CC earnings (determines tier)
   - current_rank: Stored tier (enum)
   - previous_rank: For calculating rank changes
   - highest_rank_achieved: Best tier ever reached
   ```

2. **Tier Calculation**:
   - Database function: `calculate_user_tier(earned_cc INTEGER)`
   - Automatically updates on CC changes
   - Tracks tier progression history

3. **API Endpoint** (`/api/leaderboard/alltime`):
   ```javascript
   Returns:
   - user_id, name
   - rank (position in leaderboard)
   - rank_tier (database tier)
   - cc_balance (current balance)
   - total_challenges_won/played
   - win_rate
   - rank_change (movement since last update)
   - featured_achievements
   - friend status
   ```

## Tier Benefits (Planned)

From `tier_benefits` table structure:
- Booking discounts
- Early booking privileges
- Monthly CC bonuses
- Special perks (JSON configurable)

Currently not actively implemented but database ready.

## Display Locations

1. **All-Time Leaderboard**: 
   - Full tier visualization with borders and icons
   - Most prominent display of tier system

2. **Customer Dashboard**:
   - Tier icon replaces generic trophy
   - Shows current tier status

3. **Profile Page**:
   - Tier badge with progression bar
   - Shows CC needed for next tier
   - Subtle accent colors

4. **Challenge Lists**:
   - Small tier icons next to player names
   - Quick tier identification

## User Experience Flow

1. **New User**: Starts as Junior (0 CC)
2. **Earns CC**: Through challenges, bonuses, rewards
3. **Tier Progression**: Automatic as CC accumulates
4. **Visual Recognition**: Icon and colors update everywhere
5. **Leaderboard Position**: Climbs all-time rankings
6. **Achievement**: Reaching Legend status (10,000+ CC)

## Key Design Decisions

1. **Subtlety**: Tier visuals are understated, not overwhelming
2. **Consistency**: Same tier colors/icons everywhere
3. **Mobile-First**: All tier displays work on small screens
4. **Performance**: Virtual scrolling for large leaderboards
5. **Engagement**: Creates long-term progression goals

## Recent Updates (v1.14.41)

- Added Legend tier for 10,000+ CC players
- Implemented subtle left borders on leaderboard
- Replaced generic icons with tier-specific stencils
- Added tier colors to profile pages
- Maintained minimalist design aesthetic

## Future Enhancements

1. **Tier Rewards**: Activate booking discounts and perks
2. **Seasonal Tiers**: Reset tiers each season
3. **Tier Challenges**: Special challenges for each tier
4. **Tier Leaderboards**: Separate rankings within tiers
5. **Tier Notifications**: Celebrate tier promotions
6. **Tier Analytics**: Track tier distribution and progression

## Summary

The tier system transforms ClubCoin earnings into a visual ranking system that:
- Provides instant status recognition
- Creates progression goals
- Enhances competitive atmosphere
- Rewards long-term engagement
- Maintains clean, professional aesthetics

The all-time leaderboard serves as the primary showcase for this system, displaying the complete competitive hierarchy of all ClubOS players based on their lifetime achievements.