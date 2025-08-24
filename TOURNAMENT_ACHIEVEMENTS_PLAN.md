# Tournament Achievements System - Complete Implementation Plan

## 🎯 Overview
A comprehensive achievement system that allows operators to award tournament badges, special achievements, and recognition to users. These achievements will be displayed on profiles, leaderboards, and challenge pages, creating a richer competitive environment.

## 🏆 Achievement Categories

### 1. **Tournament Achievements**
- 🥇 **Tournament Champion** - 1st place finish
- 🥈 **Tournament Runner-Up** - 2nd place finish  
- 🥉 **Tournament Bronze** - 3rd place finish
- 🎯 **Tournament Participant** - Participated in tournament
- 🏌️ **Hole-in-One** - Achieved hole-in-one in tournament
- ⛳ **Longest Drive** - Won longest drive competition
- 🎯 **Closest to Pin** - Won closest to pin competition
- 🦅 **Eagle Club** - Scored an eagle in tournament
- 🐦 **Birdie Machine** - Most birdies in tournament
- 💎 **Perfect Round** - Shot under par in tournament

### 2. **Seasonal Achievements**
- 🌸 **Spring Champion** - Won spring season tournament
- ☀️ **Summer Champion** - Won summer season tournament
- 🍂 **Fall Champion** - Won fall season tournament
- ❄️ **Winter Champion** - Won winter season tournament
- 📅 **Season MVP** - Best overall performance in season
- 🔥 **Hot Streak** - Won multiple tournaments in a row

### 3. **Special Recognition**
- 🌟 **Club Legend** - Lifetime achievement award
- 💫 **Rising Star** - Most improved player
- 🤝 **Sportsmanship Award** - Excellent conduct
- 🎉 **Anniversary Member** - Membership milestones
- 🏅 **Grand Slam** - Won all major tournaments
- 👑 **King of the Hill** - Held #1 rank for extended period

### 4. **Milestone Achievements** (Auto-awarded)
- 🎮 **100 Rounds** - Played 100 rounds
- 💰 **High Roller** - Won 1000+ CC in challenges
- 🎯 **Sharpshooter** - 75%+ challenge win rate
- 🚀 **Rookie of the Year** - Best new player
- 📈 **Comeback Kid** - Biggest rank improvement

## 📊 Database Schema

### New Tables

```sql
-- Achievement definitions
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'tournament_champion_2024_spring'
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL, -- 'tournament', 'seasonal', 'special', 'milestone'
  icon VARCHAR(10), -- emoji icon
  badge_url VARCHAR(255), -- optional custom badge image
  rarity VARCHAR(20) DEFAULT 'common', -- 'common', 'rare', 'epic', 'legendary'
  points INTEGER DEFAULT 0, -- achievement points value
  is_active BOOLEAN DEFAULT true,
  auto_award BOOLEAN DEFAULT false, -- if true, system can auto-award
  auto_criteria JSONB, -- criteria for auto-awarding
  metadata JSONB, -- additional data (tournament name, date, etc.)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User achievements (awards)
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id),
  awarded_by UUID REFERENCES users(id), -- operator who awarded it
  awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason TEXT, -- optional reason/notes
  tournament_id VARCHAR(100), -- reference to tournament if applicable
  display_priority INTEGER DEFAULT 0, -- higher = more prominent display
  is_featured BOOLEAN DEFAULT false, -- featured on profile
  expires_at TIMESTAMP, -- for temporary achievements
  metadata JSONB, -- additional context (score, placement, etc.)
  UNIQUE(user_id, achievement_id, tournament_id) -- prevent duplicates
);

-- Achievement display preferences
CREATE TABLE achievement_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  show_achievements BOOLEAN DEFAULT true,
  featured_achievements UUID[] DEFAULT '{}', -- up to 3 featured
  display_order VARCHAR(20) DEFAULT 'recent', -- 'recent', 'rarity', 'points'
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX idx_achievements_category ON achievements(category);
CREATE INDEX idx_achievements_auto_award ON achievements(auto_award) WHERE auto_award = true;
CREATE INDEX idx_user_achievements_featured ON user_achievements(user_id, is_featured) WHERE is_featured = true;
```

## 🖥️ Operator Interface

### Achievement Management Page (`/operator/achievements`)

```typescript
interface AchievementManagementUI {
  // Main sections
  sections: {
    awardAchievement: {
      userSearch: SearchBar; // Search users by name/email
      achievementSelector: {
        categories: TabGroup; // Tournament, Seasonal, Special
        achievements: GridView; // Visual grid of achievements
        customReason: TextArea; // Optional notes
      };
      previewCard: AchievementPreview; // Shows how it will look
      awardButton: Button; // Confirm award
    };
    
    manageAchievements: {
      userList: DataTable; // List of users with achievements
      filters: {
        category: Select;
        dateRange: DatePicker;
        tournament: Select;
      };
      bulkActions: {
        awardToMultiple: Button;
        removeAchievement: Button;
      };
    };
    
    tournamentMode: {
      quickAward: {
        tournament: Select; // Select tournament
        placements: {
          first: UserSelect;
          second: UserSelect;
          third: UserSelect;
          special: MultiSelect; // Hole-in-one, longest drive, etc.
        };
        awardAll: Button; // Award all at once
      };
    };
    
    achievementStats: {
      totalAwarded: StatCard;
      mostCommon: StatCard;
      recentAwards: Timeline;
      leaderboard: AchievementLeaderboard;
    };
  };
}
```

### Award Achievement Flow

```typescript
// Operator clicks award achievement icon next to user
async function awardAchievement(userId: string, achievementId: string, metadata?: any) {
  // 1. Validate operator permission
  // 2. Check if already awarded
  // 3. Create achievement record
  // 4. Send notification to user
  // 5. Update user's achievement count
  // 6. Trigger celebration animation (if user is online)
}
```

## 🎨 Frontend Display

### 1. **Profile Page Achievements Section**

```tsx
<AchievementsSection>
  {/* Featured Achievements - User's top 3 */}
  <FeaturedAchievements>
    <AchievementBadge 
      icon="🏆"
      name="Summer Champion 2024"
      rarity="legendary"
      glowEffect={true}
    />
  </FeaturedAchievements>
  
  {/* Achievement Stats */}
  <AchievementStats>
    <div>Total: 12</div>
    <div>Points: 1,250</div>
    <div>Rarest: Club Legend</div>
  </AchievementStats>
  
  {/* All Achievements Grid */}
  <AchievementsGrid>
    {achievements.map(achievement => (
      <AchievementCard 
        key={achievement.id}
        {...achievement}
        onClick={() => showAchievementDetails(achievement)}
      />
    ))}
  </AchievementsGrid>
</AchievementsSection>
```

### 2. **Leaderboard Achievement Display**

```tsx
<LeaderboardRow>
  <Rank>1</Rank>
  <UserInfo>
    <Name>Mike Belair</Name>
    {/* Achievement badges next to name */}
    <AchievementBadges>
      <Badge icon="🏆" tooltip="Tournament Champion" />
      <Badge icon="👑" tooltip="King of the Hill" />
      <Badge icon="🔥" tooltip="Hot Streak" />
    </AchievementBadges>
  </UserInfo>
  <Stats>125 CC | 1W/1P</Stats>
</LeaderboardRow>
```

### 3. **Challenge/Compete Page Display**

```tsx
<CompetitorCard>
  <UserHeader>
    <Avatar />
    <UserDetails>
      <Name>Alanna Belair</Name>
      <Rank>House</Rank>
    </UserDetails>
    {/* Achievement showcase */}
    <AchievementShowcase>
      <MiniAchievement icon="🥈" />
      <MiniAchievement icon="🎯" />
      <MoreBadge count={5} /> {/* +5 more */}
    </AchievementShowcase>
  </UserHeader>
  <ChallengeButton />
</CompetitorCard>
```

### 4. **Achievement Detail Modal**

```tsx
<AchievementModal>
  <BadgeDisplay>
    <AnimatedBadge icon="🏆" size="large" />
  </BadgeDisplay>
  <AchievementInfo>
    <Title>Tournament Champion</Title>
    <Description>Won the Summer 2024 Tournament</Description>
    <Metadata>
      <div>Awarded: Aug 15, 2024</div>
      <div>By: Operator Mike</div>
      <div>Rarity: Legendary</div>
      <div>Points: 500</div>
    </Metadata>
  </AchievementInfo>
  <ShareButton>Share Achievement</ShareButton>
</AchievementModal>
```

## 🔧 Implementation Steps

### Phase 1: Database & Backend (Week 1)
1. Create migration 110_tournament_achievements.sql
2. Build achievements service (`/services/achievementService.ts`)
3. Create API endpoints:
   - `POST /api/achievements/award` - Award achievement
   - `GET /api/achievements/user/:userId` - Get user achievements
   - `GET /api/achievements/available` - List all achievements
   - `DELETE /api/achievements/revoke` - Revoke achievement
4. Add achievement data to existing endpoints (leaderboard, profile, friends)

### Phase 2: Operator Interface (Week 1)
1. Create `/pages/operator/achievements.tsx`
2. Build achievement selector component
3. Add award achievement button to user lists
4. Create bulk award interface for tournaments
5. Add achievement statistics dashboard

### Phase 3: Customer Display (Week 2)
1. Add achievements section to profile page
2. Update LeaderboardList component to show badges
3. Update compete page competitor cards
4. Create achievement detail modal
5. Add achievement showcase to challenge cards

### Phase 4: Auto-Award System (Week 2)
1. Create achievement criteria evaluator
2. Add triggers for milestone achievements
3. Build scheduled job for checking criteria
4. Add notification system for new achievements

### Phase 5: Polish & Testing (Week 3)
1. Add celebration animations
2. Create achievement sharing functionality
3. Add achievement filtering/sorting
4. Performance optimization for badge loading
5. Comprehensive testing

## 🎯 Success Metrics

- **Engagement**: 50% of users view achievements weekly
- **Participation**: 30% increase in tournament participation
- **Retention**: 20% increase in user return rate
- **Social**: Users share achievements on social media
- **Competition**: Increased challenge activity around tournaments

## 🚀 Future Enhancements

### V2 Features
- **Achievement Chains**: Complete series for bonus rewards
- **Team Achievements**: Awards for team competitions
- **Seasonal Themes**: Special themed badges
- **Achievement Store**: Redeem points for rewards
- **Custom Badges**: Upload custom tournament badges
- **Achievement API**: Third-party tournament integration

### V3 Features
- **NFT Achievements**: Blockchain-verified achievements
- **Global Rankings**: Cross-club achievement leaderboard
- **Achievement Challenges**: Special challenges to earn badges
- **Trading System**: Trade/gift achievements
- **AR Badges**: View achievements in AR

## 📝 Sample Achievement Data

```typescript
const sampleAchievements = [
  {
    code: 'tournament_champion_2024_summer',
    name: 'Summer Champion 2024',
    description: 'Won the Summer 2024 Club Championship',
    category: 'tournament',
    icon: '🏆',
    rarity: 'legendary',
    points: 500
  },
  {
    code: 'hole_in_one_2024',
    name: 'Ace Master',
    description: 'Scored a hole-in-one in tournament play',
    category: 'tournament',
    icon: '🎯',
    rarity: 'epic',
    points: 300
  },
  {
    code: 'challenge_streak_10',
    name: 'Unstoppable',
    description: 'Won 10 challenges in a row',
    category: 'milestone',
    icon: '🔥',
    rarity: 'rare',
    points: 200,
    auto_award: true,
    auto_criteria: {
      type: 'challenge_streak',
      value: 10
    }
  }
];
```

## 🔐 Security Considerations

- Only operators/admins can award achievements
- Audit log for all achievement awards/revocations
- Rate limiting on achievement endpoints
- Validation to prevent duplicate awards
- Secure badge image uploads (if custom badges)
- Privacy settings for achievement visibility

## 📱 Mobile Responsiveness

- Touch-friendly achievement cards
- Swipeable achievement carousel
- Optimized badge images for mobile
- Bottom sheet for achievement details
- Share to social media integration

## 🎨 Design System

### Achievement Rarity Colors
- **Common**: Gray (#6B7280)
- **Rare**: Blue (#3B82F6)
- **Epic**: Purple (#8B5CF6)
- **Legendary**: Gold (#F59E0B)

### Badge Sizes
- **Mini**: 16x16px (leaderboard)
- **Small**: 24x24px (lists)
- **Medium**: 32x32px (cards)
- **Large**: 64x64px (profile featured)
- **XL**: 128x128px (detail modal)

### Animation Effects
- **Award**: Confetti burst + glow effect
- **Hover**: Subtle float + shine
- **Legendary**: Rotating glow border
- **New**: Pulse animation for 24 hours

## ✅ Definition of Done

- [ ] Database schema implemented and migrated
- [ ] Backend API endpoints functional
- [ ] Operator interface complete
- [ ] Achievements display on profile
- [ ] Achievements show on leaderboard
- [ ] Achievements visible on compete page
- [ ] Auto-award system working
- [ ] Mobile responsive design
- [ ] Performance optimized
- [ ] Documentation complete
- [ ] Testing coverage > 80%