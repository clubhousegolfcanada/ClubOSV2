-- Migration: 006_gamification_features.sql
-- Description: Gamification tables - badges, champion markers, achievements
-- Created: 2025-08-19
-- Author: ClubOS Development Team

-- ============================================
-- BADGE CATEGORIES
-- ============================================

CREATE TYPE badge_category AS ENUM (
  'challenges',    -- Challenge-related achievements
  'wins',         -- Victory achievements
  'streaks',      -- Streak achievements
  'oddities',     -- Unusual achievements
  'social',       -- Social/friend achievements
  'seasonal',     -- Season-specific achievements
  'special'       -- Special event badges
);

CREATE TYPE badge_tier AS ENUM (
  'common',       -- Basic achievements
  'uncommon',     -- Moderate difficulty
  'rare',         -- Difficult to achieve
  'epic',         -- Very difficult
  'legendary'     -- Extremely rare
);

-- ============================================
-- BADGES CATALOG
-- ============================================

CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Badge identification
  key VARCHAR(100) UNIQUE NOT NULL, -- Unique identifier like 'serial_challenger'
  name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  
  -- Categorization
  category badge_category NOT NULL,
  tier badge_tier NOT NULL DEFAULT 'common',
  
  -- Display
  icon_url TEXT,
  icon_emoji VARCHAR(10), -- Fallback emoji
  display_order INTEGER DEFAULT 0,
  
  -- Requirements (JSON for flexibility)
  requirements JSONB NOT NULL DEFAULT '{}',
  /* Example:
    {
      "type": "challenge_count",
      "value": 5,
      "period": "season",
      "conditions": {
        "min_wager": 50,
        "unique_opponents": true
      }
    }
  */
  
  -- Tracking
  is_active BOOLEAN DEFAULT true,
  is_secret BOOLEAN DEFAULT false, -- Hidden until earned
  times_awarded INTEGER DEFAULT 0,
  
  -- Seasonal/limited
  is_seasonal BOOLEAN DEFAULT false,
  season_id UUID REFERENCES seasons(id),
  available_from TIMESTAMP WITH TIME ZONE,
  available_until TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for badge queries
CREATE INDEX idx_badges_active ON badges(is_active, category);
CREATE INDEX idx_badges_seasonal ON badges(season_id) WHERE is_seasonal = true;

-- ============================================
-- USER BADGES
-- ============================================

CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  
  -- Award details
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  season_id UUID REFERENCES seasons(id),
  
  -- Progress tracking (for progressive badges)
  progress JSONB DEFAULT '{}',
  progress_percentage INTEGER DEFAULT 100, -- 0-100
  
  -- Context (what triggered the award)
  trigger_type VARCHAR(100), -- 'challenge_complete', 'season_end', 'manual', etc.
  trigger_id UUID, -- Reference to challenge, etc.
  trigger_data JSONB DEFAULT '{}',
  
  -- Display preferences
  is_featured BOOLEAN DEFAULT false, -- User chose to feature this badge
  display_order INTEGER,
  
  UNIQUE(user_id, badge_id)
);

-- Create indexes for user badge queries
CREATE INDEX idx_user_badges_user ON user_badges(user_id, earned_at DESC);
CREATE INDEX idx_user_badges_badge ON user_badges(badge_id);
CREATE INDEX idx_user_badges_featured ON user_badges(user_id, is_featured) WHERE is_featured = true;

-- ============================================
-- CHAMPION MARKERS
-- ============================================

CREATE TABLE IF NOT EXISTS champion_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  
  -- Event details
  event_id UUID REFERENCES events(id),
  event_name VARCHAR(200) NOT NULL, -- "Clubhouse Open 2025", "East Coast Open", etc.
  event_type VARCHAR(50) NOT NULL, -- 'flagship', 'major', 'seasonal', 'special'
  
  -- Achievement details
  year INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 1, -- 1st, 2nd, 3rd place
  
  -- Display
  marker_name VARCHAR(50) NOT NULL, -- 'Etched', 'Crowned', 'Stamped', etc.
  display_text VARCHAR(200), -- "2025 Clubhouse Open Champion"
  icon_url TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true, -- Can be deactivated but not deleted
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiry for seasonal markers
  
  -- Bonus effect
  bonus_multiplier DECIMAL(3,2) DEFAULT 0.20, -- 20% bonus when defeated
  
  awarded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, event_id)
);

-- Create indexes for champion marker queries
CREATE INDEX idx_champion_markers_user ON champion_markers(user_id, is_active);
CREATE INDEX idx_champion_markers_year ON champion_markers(year, event_type);

-- ============================================
-- BADGE RULES ENGINE
-- ============================================

CREATE TABLE IF NOT EXISTS badge_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  
  -- Rule configuration
  rule_type VARCHAR(50) NOT NULL, -- 'counter', 'streak', 'condition', 'milestone', 'special'
  
  -- Trigger conditions
  trigger_event VARCHAR(100) NOT NULL, -- 'challenge_win', 'challenge_complete', 'season_end', etc.
  
  -- Rule logic (SQL expression or function name)
  evaluation_sql TEXT,
  evaluation_function VARCHAR(200),
  
  -- Parameters
  parameters JSONB DEFAULT '{}',
  
  -- Execution
  is_active BOOLEAN DEFAULT true,
  check_frequency VARCHAR(20) DEFAULT 'on_event', -- 'on_event', 'daily', 'weekly', 'season_end'
  last_checked_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(badge_id, rule_type)
);

-- Create index for rule evaluation
CREATE INDEX idx_badge_rules_active ON badge_rules(trigger_event, is_active);

-- ============================================
-- BADGE PROGRESS TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS badge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  
  -- Progress data
  current_value DECIMAL(15,2) DEFAULT 0,
  target_value DECIMAL(15,2) NOT NULL,
  progress_percentage INTEGER DEFAULT 0, -- 0-100
  
  -- Tracking details
  progress_data JSONB DEFAULT '{}', -- Flexible storage for complex progress
  
  -- Status
  is_complete BOOLEAN DEFAULT false,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(user_id, badge_id)
);

-- Create indexes for progress queries
CREATE INDEX idx_badge_progress_user ON badge_progress(user_id, is_complete);
CREATE INDEX idx_badge_progress_badge ON badge_progress(badge_id);

-- ============================================
-- INITIAL BADGE CATALOG
-- ============================================

-- Insert initial badges with dry, adult clubhouse tone
INSERT INTO badges (key, name, description, category, tier, requirements, icon_emoji) VALUES
-- Challenge badges
('serial_challenger', 'Serial Challenger', 'Created 10 challenges. Someone needs a hobby.', 'challenges', 'common', 
  '{"type": "challenge_count", "value": 10, "action": "created"}', '🎯'),

('relentless', 'Relentless', '25 challenges in a season. Touch grass occasionally.', 'challenges', 'uncommon',
  '{"type": "challenge_count", "value": 25, "period": "season"}', '⚡'),

('terms_and_conditions', 'Terms and Conditions', 'Created 5 distinct rule sets. Lawyer up.', 'challenges', 'uncommon',
  '{"type": "unique_settings", "value": 5}', '📋'),

-- Win badges
('the_tax_man', 'The Tax Man', 'Most CC won in a season. Collecting dues.', 'wins', 'epic',
  '{"type": "season_leader", "metric": "cc_won"}', '💰'),

('collector', 'Collector', 'Defeated 10 unique opponents. Building a resume.', 'wins', 'uncommon',
  '{"type": "unique_wins", "value": 10}', '📊'),

('giant_killer', 'Giant Killer', 'Beat 3 higher-rank players in a season. David approves.', 'wins', 'rare',
  '{"type": "uprank_wins", "value": 3, "period": "season"}', '⚔️'),

-- Streak badges
('hot_hand', 'Hot Hand', '5 wins in a row. Someone call the fire department.', 'streaks', 'uncommon',
  '{"type": "win_streak", "value": 5}', '🔥'),

('cooldown_needed', 'Cooldown Needed', '5 losses in a row. It happens.', 'streaks', 'common',
  '{"type": "loss_streak", "value": 5}', '❄️'),

-- Oddity badges
('ghosted', 'Ghosted', 'Accepted then failed to play. Commitment issues.', 'oddities', 'common',
  '{"type": "no_show", "value": 1}', '👻'),

('bay_rat', 'Bay Rat', '100+ hours in a quarter. Consider vitamin D.', 'oddities', 'rare',
  '{"type": "hours_played", "value": 100, "period": "quarter"}', '🐀'),

('sudden_death', 'Sudden Death', 'Won 3 challenges by 1 stroke. Living dangerously.', 'oddities', 'uncommon',
  '{"type": "close_wins", "value": 3, "margin": 1}', '💀'),

('night_owl', 'Night Owl', 'Completed 5 challenges after 10pm. Sleep is overrated.', 'oddities', 'common',
  '{"type": "late_plays", "value": 5, "after_hour": 22}', '🦉'),

('morning_glory', 'Morning Glory', 'Completed 5 challenges before 8am. Psychopath.', 'oddities', 'uncommon',
  '{"type": "early_plays", "value": 5, "before_hour": 8}', '🌅'),

('perfectionist', 'Perfectionist', 'Shot under par in 10 challenges. Show off.', 'oddities', 'rare',
  '{"type": "under_par_rounds", "value": 10}', '✨'),

('risk_taker', 'Risk Taker', 'Wagered 1000+ CC in a single challenge. Big money, no whammies.', 'oddities', 'epic',
  '{"type": "high_wager", "value": 1000}', '🎰'),

('grudge_match', 'Grudge Match', 'Played same opponent 5 times. Get a room.', 'oddities', 'common',
  '{"type": "repeat_opponent", "value": 5}', '🥊'),

('comeback_kid', 'Comeback Kid', 'Won after being down 5+ strokes. Never give up.', 'oddities', 'rare',
  '{"type": "comeback_win", "deficit": 5}', '🔄'),

('untouchable', 'Untouchable', 'Won 10 challenges without opponent scoring under 80. Dominant.', 'oddities', 'epic',
  '{"type": "dominant_wins", "value": 10, "opponent_min_score": 80}', '🛡️')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if user has a champion marker
CREATE OR REPLACE FUNCTION user_has_champion_marker(
  p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  has_marker BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 
    FROM champion_markers 
    WHERE user_id = p_user_id 
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  ) INTO has_marker;
  
  RETURN has_marker;
END;
$$ LANGUAGE plpgsql;

-- Get user's featured badges
CREATE OR REPLACE FUNCTION get_user_featured_badges(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 5
) RETURNS TABLE (
  badge_key VARCHAR,
  badge_name VARCHAR,
  badge_tier badge_tier,
  earned_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.key,
    b.name,
    b.tier,
    ub.earned_at
  FROM user_badges ub
  JOIN badges b ON b.id = ub.badge_id
  WHERE ub.user_id = p_user_id
  AND ub.is_featured = true
  ORDER BY ub.display_order, ub.earned_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Award badge to user
CREATE OR REPLACE FUNCTION award_badge(
  p_user_id UUID,
  p_badge_key VARCHAR,
  p_trigger_type VARCHAR DEFAULT 'manual',
  p_trigger_id UUID DEFAULT NULL,
  p_trigger_data JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
  badge_id_var UUID;
  already_has BOOLEAN;
BEGIN
  -- Get badge ID
  SELECT id INTO badge_id_var
  FROM badges
  WHERE key = p_badge_key AND is_active = true;
  
  IF badge_id_var IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user already has this badge
  SELECT EXISTS(
    SELECT 1 FROM user_badges 
    WHERE user_id = p_user_id AND badge_id = badge_id_var
  ) INTO already_has;
  
  IF already_has THEN
    RETURN FALSE;
  END IF;
  
  -- Award the badge
  INSERT INTO user_badges (
    user_id,
    badge_id,
    season_id,
    trigger_type,
    trigger_id,
    trigger_data
  ) VALUES (
    p_user_id,
    badge_id_var,
    get_current_season(),
    p_trigger_type,
    p_trigger_id,
    p_trigger_data
  );
  
  -- Update badge award count
  UPDATE badges 
  SET times_awarded = times_awarded + 1
  WHERE id = badge_id_var;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update badge updated_at
CREATE TRIGGER update_badges_updated_at
BEFORE UPDATE ON badges
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update badge progress updated_at
CREATE TRIGGER update_badge_progress_updated_at
BEFORE UPDATE ON badge_progress
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- BADGE EVALUATION FUNCTIONS
-- ============================================

-- Evaluate challenge count badges
CREATE OR REPLACE FUNCTION evaluate_challenge_badges(
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  challenge_count INTEGER;
  season_challenges INTEGER;
BEGIN
  -- Get total challenges
  SELECT total_challenges_played INTO challenge_count
  FROM customer_profiles
  WHERE user_id = p_user_id;
  
  -- Serial Challenger (10 challenges)
  IF challenge_count >= 10 THEN
    PERFORM award_badge(p_user_id, 'serial_challenger', 'auto', NULL, 
      jsonb_build_object('challenge_count', challenge_count));
  END IF;
  
  -- Get season challenges
  SELECT challenges_played INTO season_challenges
  FROM rank_assignments
  WHERE user_id = p_user_id AND season_id = get_current_season();
  
  -- Relentless (25 in season)
  IF season_challenges >= 25 THEN
    PERFORM award_badge(p_user_id, 'relentless', 'auto', NULL,
      jsonb_build_object('season_challenges', season_challenges));
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Evaluate streak badges
CREATE OR REPLACE FUNCTION evaluate_streak_badges(
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  current_streak INTEGER;
BEGIN
  -- Get current streak from profile
  SELECT challenge_streak INTO current_streak
  FROM customer_profiles
  WHERE user_id = p_user_id;
  
  -- Hot Hand (5 win streak)
  IF current_streak >= 5 THEN
    PERFORM award_badge(p_user_id, 'hot_hand', 'auto', NULL,
      jsonb_build_object('streak', current_streak));
  END IF;
  
  -- Cooldown Needed (5 loss streak)
  IF current_streak <= -5 THEN
    PERFORM award_badge(p_user_id, 'cooldown_needed', 'auto', NULL,
      jsonb_build_object('streak', current_streak));
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROLLBACK SUPPORT
-- ============================================

-- DOWN migration (for rollback)
/*
DROP TRIGGER IF EXISTS update_badge_progress_updated_at ON badge_progress;
DROP TRIGGER IF EXISTS update_badges_updated_at ON badges;
DROP FUNCTION IF EXISTS evaluate_streak_badges(UUID);
DROP FUNCTION IF EXISTS evaluate_challenge_badges(UUID);
DROP FUNCTION IF EXISTS award_badge(UUID, VARCHAR, VARCHAR, UUID, JSONB);
DROP FUNCTION IF EXISTS get_user_featured_badges(UUID, INTEGER);
DROP FUNCTION IF EXISTS user_has_champion_marker(UUID);
DROP TABLE IF EXISTS badge_progress CASCADE;
DROP TABLE IF EXISTS badge_rules CASCADE;
DROP TABLE IF EXISTS champion_markers CASCADE;
DROP TABLE IF EXISTS user_badges CASCADE;
DROP TABLE IF EXISTS badges CASCADE;
DROP TYPE IF EXISTS badge_tier CASCADE;
DROP TYPE IF EXISTS badge_category CASCADE;
*/