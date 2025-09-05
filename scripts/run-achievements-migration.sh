#!/bin/bash

# Run only the UP portion of the achievements migration

psql "postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway" << 'EOF'
-- Achievement rarity enum
CREATE TYPE achievement_rarity AS ENUM ('common', 'rare', 'epic', 'legendary');

-- Achievement category enum
CREATE TYPE achievement_category AS ENUM ('tournament', 'seasonal', 'special', 'milestone', 'challenge');

-- Achievement definitions table
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category achievement_category NOT NULL,
  icon VARCHAR(10),
  badge_url VARCHAR(255),
  rarity achievement_rarity DEFAULT 'common',
  points INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  auto_award BOOLEAN DEFAULT false,
  auto_criteria JSONB,
  display_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User achievements (awards)
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  awarded_by UUID REFERENCES users(id),
  awarded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  tournament_id VARCHAR(100),
  display_priority INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, achievement_id, tournament_id)
);

-- Achievement display preferences
CREATE TABLE IF NOT EXISTS achievement_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  show_achievements BOOLEAN DEFAULT true,
  featured_achievements UUID[] DEFAULT '{}',
  display_order VARCHAR(20) DEFAULT 'recent',
  hide_achievements UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_awarded_at ON user_achievements(awarded_at DESC);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
CREATE INDEX IF NOT EXISTS idx_achievements_code ON achievements(code);
CREATE INDEX IF NOT EXISTS idx_achievements_auto_award ON achievements(auto_award) WHERE auto_award = true;
CREATE INDEX IF NOT EXISTS idx_user_achievements_featured ON user_achievements(user_id, is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_user_achievements_tournament ON user_achievements(tournament_id) WHERE tournament_id IS NOT NULL;

-- Function to update achievement counts in customer_profiles
CREATE OR REPLACE FUNCTION update_achievement_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE customer_profiles 
    SET 
      achievement_count = (
        SELECT COUNT(*) FROM user_achievements 
        WHERE user_id = NEW.user_id
      ),
      achievement_points = (
        SELECT COALESCE(SUM(a.points), 0) 
        FROM user_achievements ua
        JOIN achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = NEW.user_id
      )
    WHERE user_id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE customer_profiles 
    SET 
      achievement_count = (
        SELECT COUNT(*) FROM user_achievements 
        WHERE user_id = OLD.user_id
      ),
      achievement_points = (
        SELECT COALESCE(SUM(a.points), 0) 
        FROM user_achievements ua
        JOIN achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = OLD.user_id
      )
    WHERE user_id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update achievement counts
CREATE TRIGGER update_achievement_count_trigger
AFTER INSERT OR DELETE ON user_achievements
FOR EACH ROW
EXECUTE FUNCTION update_achievement_count();

-- Add achievement columns to customer_profiles
ALTER TABLE customer_profiles 
ADD COLUMN IF NOT EXISTS achievement_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS achievement_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rarest_achievement UUID REFERENCES achievements(id),
ADD COLUMN IF NOT EXISTS latest_achievement_at TIMESTAMP WITH TIME ZONE;

-- Insert initial achievements
INSERT INTO achievements (code, name, description, category, icon, rarity, points, is_active) VALUES
-- Tournament Achievements
('tournament_champion', 'Tournament Champion', 'Won 1st place in a tournament', 'tournament', '🏆', 'legendary', 500, true),
('tournament_runner_up', 'Tournament Runner-Up', 'Won 2nd place in a tournament', 'tournament', '🥈', 'epic', 300, true),
('tournament_bronze', 'Tournament Bronze', 'Won 3rd place in a tournament', 'tournament', '🥉', 'rare', 200, true),
('tournament_participant', 'Tournament Participant', 'Participated in a tournament', 'tournament', '🎯', 'common', 50, true),
('hole_in_one', 'Hole in One', 'Achieved a hole-in-one in tournament play', 'tournament', '⛳', 'legendary', 1000, true),
('longest_drive', 'Longest Drive', 'Won the longest drive competition', 'tournament', '💪', 'epic', 250, true),
('closest_to_pin', 'Closest to Pin', 'Won the closest to pin competition', 'tournament', '🎯', 'rare', 150, true),
('eagle_club', 'Eagle Club', 'Scored an eagle in tournament play', 'tournament', '🦅', 'epic', 300, true),
('birdie_machine', 'Birdie Machine', 'Most birdies in a tournament', 'tournament', '🐦', 'rare', 200, true),

-- Seasonal Achievements
('spring_champion', 'Spring Champion', 'Won the spring season championship', 'seasonal', '🌸', 'legendary', 600, true),
('summer_champion', 'Summer Champion', 'Won the summer season championship', 'seasonal', '☀️', 'legendary', 600, true),
('fall_champion', 'Fall Champion', 'Won the fall season championship', 'seasonal', '🍂', 'legendary', 600, true),
('winter_champion', 'Winter Champion', 'Won the winter season championship', 'seasonal', '❄️', 'legendary', 600, true),
('season_mvp', 'Season MVP', 'Best overall performance in a season', 'seasonal', '⭐', 'epic', 400, true),

-- Special Recognition
('club_legend', 'Club Legend', 'Lifetime achievement award', 'special', '🌟', 'legendary', 2000, true),
('rising_star', 'Rising Star', 'Most improved player', 'special', '💫', 'epic', 300, true),
('sportsmanship', 'Sportsmanship Award', 'Exemplary conduct and fair play', 'special', '🤝', 'rare', 200, true),
('grand_slam', 'Grand Slam', 'Won all major tournaments in a year', 'special', '👑', 'legendary', 1500, true),
('king_of_the_hill', 'King of the Hill', 'Held #1 rank for 30+ days', 'special', '👑', 'epic', 500, true),

-- Milestone Achievements (auto-awardable)
('first_challenge', 'First Challenge', 'Completed your first challenge', 'milestone', '🎮', 'common', 25, true),
('challenge_veteran', 'Challenge Veteran', 'Played 50 challenges', 'milestone', '🎯', 'rare', 100, true),
('challenge_master', 'Challenge Master', 'Played 100 challenges', 'milestone', '🏅', 'epic', 250, true),
('win_streak_5', 'Hot Streak', 'Won 5 challenges in a row', 'milestone', '🔥', 'rare', 150, true),
('win_streak_10', 'Unstoppable', 'Won 10 challenges in a row', 'milestone', '💥', 'epic', 300, true),
('high_roller', 'High Roller', 'Won 1000+ CC from challenges', 'milestone', '💰', 'epic', 400, true),
('sharpshooter', 'Sharpshooter', 'Achieved 75% win rate (min 20 games)', 'milestone', '🎯', 'epic', 350, true),
('centurion', 'Centurion', 'Played 100 rounds', 'milestone', '💯', 'rare', 200, true),
('comeback_kid', 'Comeback Kid', 'Won after being down by 5+ strokes', 'milestone', '📈', 'rare', 150, true),
('perfect_round', 'Perfect Round', 'Shot under par in a round', 'milestone', '⛳', 'epic', 300, true),

-- Challenge Achievements
('david_goliath', 'David vs Goliath', 'Beat a player 3+ ranks above you', 'challenge', '🗿', 'epic', 300, true),
('friendly_rivalry', 'Friendly Rivalry', 'Played 10+ challenges with same friend', 'challenge', '🤜', 'common', 50, true),
('night_owl', 'Night Owl', 'Won a challenge after midnight', 'challenge', '🦉', 'common', 50, true),
('early_bird', 'Early Bird', 'Won a challenge before 7am', 'challenge', '🌅', 'common', 50, true),
('weekend_warrior', 'Weekend Warrior', 'Won 10 challenges on weekends', 'challenge', '⚔️', 'rare', 100, true)
ON CONFLICT (code) DO NOTHING;

-- Function to check and auto-award milestone achievements
CREATE OR REPLACE FUNCTION check_milestone_achievements(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_stats RECORD;
  v_achievement RECORD;
BEGIN
  -- Get user stats
  SELECT 
    cp.total_challenges_played,
    cp.total_challenges_won,
    cp.challenge_win_rate,
    cp.challenge_streak,
    cp.max_win_streak,
    cp.total_cc_earned,
    cp.total_rounds
  INTO v_stats
  FROM customer_profiles cp
  WHERE cp.user_id = p_user_id;

  -- Check each auto-awardable achievement
  FOR v_achievement IN 
    SELECT * FROM achievements 
    WHERE auto_award = true AND is_active = true
  LOOP
    -- Check if already awarded
    IF NOT EXISTS (
      SELECT 1 FROM user_achievements 
      WHERE user_id = p_user_id AND achievement_id = v_achievement.id
    ) THEN
      -- Check criteria based on achievement code
      IF (v_achievement.code = 'first_challenge' AND v_stats.total_challenges_played >= 1) OR
         (v_achievement.code = 'challenge_veteran' AND v_stats.total_challenges_played >= 50) OR
         (v_achievement.code = 'challenge_master' AND v_stats.total_challenges_played >= 100) OR
         (v_achievement.code = 'win_streak_5' AND v_stats.max_win_streak >= 5) OR
         (v_achievement.code = 'win_streak_10' AND v_stats.max_win_streak >= 10) OR
         (v_achievement.code = 'high_roller' AND v_stats.total_cc_earned >= 1000) OR
         (v_achievement.code = 'sharpshooter' AND v_stats.challenge_win_rate >= 0.75 AND v_stats.total_challenges_played >= 20) OR
         (v_achievement.code = 'centurion' AND v_stats.total_rounds >= 100)
      THEN
        -- Award the achievement
        INSERT INTO user_achievements (user_id, achievement_id, reason)
        VALUES (p_user_id, v_achievement.id, 'Auto-awarded for meeting criteria');
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Verify the migration worked
SELECT COUNT(*) as total_achievements FROM achievements;
EOF

echo "✅ Achievement migration completed successfully!"