-- Migration: 004_challenges_core.sql
-- Description: Core tables for Clubhouse Challenges system
-- Created: 2025-08-19
-- Author: ClubOS Development Team

-- ============================================
-- RANK SYSTEM
-- ============================================

-- Create rank enum type
CREATE TYPE rank_tier AS ENUM (
  'house',      -- New/unranked users
  'amateur',    -- Bottom 10%
  'bronze',     -- Next 25%
  'silver',     -- Next 30%
  'gold',       -- Next 20%
  'pro',        -- Next 10%
  'champion',   -- Next 4%
  'legend'      -- Top 1%
);

-- ============================================
-- SEASONS
-- ============================================

-- Season tracking for rank resets
CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL, -- "Winter 2025", "Q1 2025", etc.
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_type VARCHAR(20) NOT NULL, -- 'monthly', 'quarterly', 'semi_annual'
  status VARCHAR(20) DEFAULT 'upcoming', -- upcoming, active, completed, archived
  
  -- Season configuration
  rank_cut_lines JSONB NOT NULL DEFAULT '{
    "legend": 0.01,
    "champion": 0.05,
    "pro": 0.15,
    "gold": 0.35,
    "silver": 0.65,
    "bronze": 0.90,
    "amateur": 1.0
  }',
  
  -- Season stats (populated at end)
  total_players INTEGER DEFAULT 0,
  total_challenges INTEGER DEFAULT 0,
  total_cc_circulated DECIMAL(15,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_season_dates CHECK (end_date > start_date)
);

-- Create index for active season lookup
CREATE INDEX idx_seasons_status ON seasons(status, start_date);
CREATE INDEX idx_seasons_dates ON seasons(start_date, end_date);

-- ============================================
-- RANK ASSIGNMENTS
-- ============================================

-- Track user ranks per season
CREATE TABLE IF NOT EXISTS rank_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  
  -- Rank data
  rank rank_tier NOT NULL DEFAULT 'house',
  percentile DECIMAL(5,4) NOT NULL, -- 0.0000 to 1.0000
  cc_earned DECIMAL(15,2) DEFAULT 0,
  
  -- Performance metrics
  challenges_played INTEGER DEFAULT 0,
  challenges_won INTEGER DEFAULT 0,
  win_rate DECIMAL(5,4) DEFAULT 0, -- 0.0000 to 1.0000
  
  -- Bonuses earned
  rank_gap_bonuses DECIMAL(15,2) DEFAULT 0,
  champion_bonuses DECIMAL(15,2) DEFAULT 0,
  total_bonuses DECIMAL(15,2) DEFAULT 0,
  
  -- Ranking position
  season_rank INTEGER, -- 1st, 2nd, 3rd, etc.
  location_rank INTEGER, -- Rank within home location
  
  -- Tournament override
  tournament_override BOOLEAN DEFAULT false,
  override_reason TEXT,
  
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, season_id)
);

-- Create indexes for rank lookups
CREATE INDEX idx_rank_assignments_user ON rank_assignments(user_id, season_id);
CREATE INDEX idx_rank_assignments_season ON rank_assignments(season_id, rank);
CREATE INDEX idx_rank_assignments_percentile ON rank_assignments(season_id, percentile);

-- ============================================
-- EXTEND CUSTOMER PROFILES
-- ============================================

-- Add challenge-specific fields to customer profiles
ALTER TABLE customer_profiles 
ADD COLUMN IF NOT EXISTS cc_balance DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS credibility_score INTEGER DEFAULT 100 CHECK (credibility_score >= 0 AND credibility_score <= 100),
ADD COLUMN IF NOT EXISTS current_rank rank_tier DEFAULT 'house',
ADD COLUMN IF NOT EXISTS highest_rank_achieved rank_tier DEFAULT 'house',
ADD COLUMN IF NOT EXISTS total_challenges_played INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_challenges_won INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cc_earned DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cc_spent DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS challenge_win_rate DECIMAL(5,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_challenge_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS challenge_streak INTEGER DEFAULT 0, -- Positive for wins, negative for losses
ADD COLUMN IF NOT EXISTS max_win_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_loss_streak INTEGER DEFAULT 0;

-- ============================================
-- CLUBCOIN TRANSACTIONS
-- ============================================

-- Track all ClubCoin transactions for audit
CREATE TABLE IF NOT EXISTS cc_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  
  -- Transaction details
  type VARCHAR(50) NOT NULL, -- 'stake_lock', 'stake_refund', 'challenge_win', 'challenge_loss', 'bonus', 'admin_grant', 'admin_deduct'
  amount DECIMAL(15,2) NOT NULL,
  balance_before DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  
  -- Reference to source
  challenge_id UUID, -- Will reference challenges table
  season_id UUID REFERENCES seasons(id),
  
  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_transaction_amount CHECK (amount != 0)
);

-- Create indexes for transaction lookups
CREATE INDEX idx_cc_transactions_user ON cc_transactions(user_id, created_at DESC);
CREATE INDEX idx_cc_transactions_type ON cc_transactions(type, created_at DESC);
CREATE INDEX idx_cc_transactions_challenge ON cc_transactions(challenge_id) WHERE challenge_id IS NOT NULL;

-- ============================================
-- CHALLENGE SETTINGS CATALOG
-- ============================================

-- Store TrackMan settings templates
CREATE TABLE IF NOT EXISTS challenge_settings_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'stroke_play', 'closest_to_pin', 'long_drive', etc.
  
  -- TrackMan configuration
  course_id VARCHAR(100) NOT NULL,
  course_name VARCHAR(200) NOT NULL,
  tee_type VARCHAR(50),
  wind_speed VARCHAR(50),
  wind_direction VARCHAR(50),
  pin_position VARCHAR(50),
  game_mode VARCHAR(100),
  
  -- Scoring configuration
  scoring_type VARCHAR(50) NOT NULL, -- 'lowest_score', 'highest_score', 'total_distance', etc.
  holes INTEGER DEFAULT 18,
  time_limit_minutes INTEGER,
  
  -- Additional settings
  settings_json JSONB DEFAULT '{}',
  
  -- Popularity tracking
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for catalog lookups
CREATE INDEX idx_challenge_settings_active ON challenge_settings_catalog(is_active, category);
CREATE INDEX idx_challenge_settings_popular ON challenge_settings_catalog(times_used DESC);

-- ============================================
-- SEASONAL CC EARNINGS
-- ============================================

-- Track CC earnings per user per season for fast queries
CREATE TABLE IF NOT EXISTS seasonal_cc_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  
  -- Earnings breakdown
  cc_from_wins DECIMAL(15,2) DEFAULT 0,
  cc_from_bonuses DECIMAL(15,2) DEFAULT 0,
  cc_from_achievements DECIMAL(15,2) DEFAULT 0,
  cc_lost DECIMAL(15,2) DEFAULT 0,
  cc_net DECIMAL(15,2) DEFAULT 0, -- Total earned - lost
  
  -- Activity metrics
  challenges_created INTEGER DEFAULT 0,
  challenges_accepted INTEGER DEFAULT 0,
  challenges_completed INTEGER DEFAULT 0,
  no_shows INTEGER DEFAULT 0,
  disputes_filed INTEGER DEFAULT 0,
  
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, season_id)
);

-- Create indexes for leaderboard queries
CREATE INDEX idx_seasonal_cc_earnings_user ON seasonal_cc_earnings(user_id, season_id);
CREATE INDEX idx_seasonal_cc_earnings_leaderboard ON seasonal_cc_earnings(season_id, cc_net DESC);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get current active season
CREATE OR REPLACE FUNCTION get_current_season()
RETURNS UUID AS $$
DECLARE
  current_season_id UUID;
BEGIN
  SELECT id INTO current_season_id
  FROM seasons
  WHERE status = 'active'
  AND CURRENT_TIMESTAMP BETWEEN start_date AND end_date
  ORDER BY start_date DESC
  LIMIT 1;
  
  RETURN current_season_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate user percentile in season
CREATE OR REPLACE FUNCTION calculate_user_percentile(
  p_user_id UUID,
  p_season_id UUID
) RETURNS DECIMAL AS $$
DECLARE
  user_cc DECIMAL;
  total_users INTEGER;
  users_below INTEGER;
  percentile DECIMAL;
BEGIN
  -- Get user's CC for the season
  SELECT cc_net INTO user_cc
  FROM seasonal_cc_earnings
  WHERE user_id = p_user_id AND season_id = p_season_id;
  
  IF user_cc IS NULL THEN
    RETURN 1.0; -- Bottom percentile if no earnings
  END IF;
  
  -- Count total active users in season
  SELECT COUNT(*) INTO total_users
  FROM seasonal_cc_earnings
  WHERE season_id = p_season_id AND cc_net > 0;
  
  -- Count users with less CC
  SELECT COUNT(*) INTO users_below
  FROM seasonal_cc_earnings
  WHERE season_id = p_season_id AND cc_net < user_cc;
  
  -- Calculate percentile (0 = top, 1 = bottom)
  percentile := 1.0 - (users_below::DECIMAL / GREATEST(total_users, 1));
  
  RETURN percentile;
END;
$$ LANGUAGE plpgsql;

-- Function to determine rank from percentile
CREATE OR REPLACE FUNCTION get_rank_from_percentile(
  p_percentile DECIMAL,
  p_cut_lines JSONB DEFAULT NULL
) RETURNS rank_tier AS $$
DECLARE
  cut_lines JSONB;
  rank rank_tier;
BEGIN
  -- Use provided cut lines or defaults
  cut_lines := COALESCE(p_cut_lines, '{
    "legend": 0.01,
    "champion": 0.05,
    "pro": 0.15,
    "gold": 0.35,
    "silver": 0.65,
    "bronze": 0.90,
    "amateur": 1.0
  }'::JSONB);
  
  -- Determine rank based on percentile
  IF p_percentile <= (cut_lines->>'legend')::DECIMAL THEN
    rank := 'legend';
  ELSIF p_percentile <= (cut_lines->>'champion')::DECIMAL THEN
    rank := 'champion';
  ELSIF p_percentile <= (cut_lines->>'pro')::DECIMAL THEN
    rank := 'pro';
  ELSIF p_percentile <= (cut_lines->>'gold')::DECIMAL THEN
    rank := 'gold';
  ELSIF p_percentile <= (cut_lines->>'silver')::DECIMAL THEN
    rank := 'silver';
  ELSIF p_percentile <= (cut_lines->>'bronze')::DECIMAL THEN
    rank := 'bronze';
  ELSIF p_percentile <= (cut_lines->>'amateur')::DECIMAL THEN
    rank := 'amateur';
  ELSE
    rank := 'house';
  END IF;
  
  RETURN rank;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for challenge settings
CREATE TRIGGER update_challenge_settings_updated_at
BEFORE UPDATE ON challenge_settings_catalog
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert first season (can be adjusted)
INSERT INTO seasons (
  name,
  start_date,
  end_date,
  duration_type,
  status
) VALUES (
  'Winter 2025',
  '2025-01-01 00:00:00-05',
  '2025-03-31 23:59:59-05',
  'quarterly',
  'active'
) ON CONFLICT DO NOTHING;

-- ============================================
-- ROLLBACK SUPPORT
-- ============================================

-- DOWN migration (for rollback)
/*
DROP TRIGGER IF EXISTS update_challenge_settings_updated_at ON challenge_settings_catalog;
DROP FUNCTION IF EXISTS get_rank_from_percentile(DECIMAL, JSONB);
DROP FUNCTION IF EXISTS calculate_user_percentile(UUID, UUID);
DROP FUNCTION IF EXISTS get_current_season();
DROP TABLE IF EXISTS seasonal_cc_earnings CASCADE;
DROP TABLE IF EXISTS challenge_settings_catalog CASCADE;
DROP TABLE IF EXISTS cc_transactions CASCADE;
ALTER TABLE customer_profiles 
  DROP COLUMN IF EXISTS cc_balance,
  DROP COLUMN IF EXISTS credibility_score,
  DROP COLUMN IF EXISTS current_rank,
  DROP COLUMN IF EXISTS highest_rank_achieved,
  DROP COLUMN IF EXISTS total_challenges_played,
  DROP COLUMN IF EXISTS total_challenges_won,
  DROP COLUMN IF EXISTS total_cc_earned,
  DROP COLUMN IF EXISTS total_cc_spent,
  DROP COLUMN IF EXISTS challenge_win_rate,
  DROP COLUMN IF EXISTS last_challenge_at,
  DROP COLUMN IF EXISTS challenge_streak,
  DROP COLUMN IF EXISTS max_win_streak,
  DROP COLUMN IF EXISTS max_loss_streak;
DROP TABLE IF EXISTS rank_assignments CASCADE;
DROP TABLE IF EXISTS seasons CASCADE;
DROP TYPE IF EXISTS rank_tier CASCADE;
*/