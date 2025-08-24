-- Migration: 005_challenges_system.sql
-- Description: Challenge system tables - challenges, stakes, results, audit
-- Created: 2025-08-19
-- Author: ClubOS Development Team

-- ============================================
-- CHALLENGE STATUS ENUM
-- ============================================

CREATE TYPE challenge_status AS ENUM (
  'draft',          -- Created but not sent
  'pending',        -- Sent, awaiting acceptance
  'accepted',       -- Accepted, stakes locked
  'active',         -- In play period
  'awaiting_sync',  -- One player completed, waiting for other
  'ready_resolve',  -- Both completed, ready to resolve
  'resolved',       -- Winner determined, payouts done
  'expired',        -- Time expired without completion
  'cancelled',      -- Cancelled by creator or system
  'disputed'        -- Under dispute review
);

-- ============================================
-- CHALLENGES
-- ============================================

CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Participants
  creator_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  acceptor_id UUID REFERENCES "Users"(id) ON DELETE CASCADE,
  
  -- Challenge configuration
  settings_catalog_id UUID REFERENCES challenge_settings_catalog(id),
  course_id VARCHAR(100) NOT NULL,
  course_name VARCHAR(200) NOT NULL,
  
  -- TrackMan settings (cached from catalog or custom)
  tee_type VARCHAR(50),
  wind_speed VARCHAR(50),
  wind_direction VARCHAR(50),
  pin_position VARCHAR(50),
  game_mode VARCHAR(100),
  scoring_type VARCHAR(50) NOT NULL,
  holes INTEGER DEFAULT 18,
  
  -- Full settings JSON for exact replication
  trackman_settings JSONB NOT NULL DEFAULT '{}',
  
  -- Wager and stakes
  wager_amount DECIMAL(15,2) NOT NULL CHECK (wager_amount > 0),
  creator_stake_amount DECIMAL(15,2), -- 30% of wager
  acceptor_stake_amount DECIMAL(15,2), -- 70% of wager
  total_pot DECIMAL(15,2), -- Sum of stakes
  
  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expiry_days INTEGER NOT NULL CHECK (expiry_days IN (7, 14, 30)),
  
  -- Play tracking
  creator_played_at TIMESTAMP WITH TIME ZONE,
  acceptor_played_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status challenge_status NOT NULL DEFAULT 'draft',
  
  -- Optional message/notes
  creator_note TEXT,
  acceptor_note TEXT,
  
  -- Results (populated after resolution)
  winner_user_id UUID REFERENCES "Users"(id),
  creator_score DECIMAL(10,2),
  acceptor_score DECIMAL(10,2),
  
  -- Bonuses applied
  rank_gap_bonus DECIMAL(15,2) DEFAULT 0,
  champion_bonus DECIMAL(15,2) DEFAULT 0,
  total_bonus DECIMAL(15,2) DEFAULT 0,
  final_payout DECIMAL(15,2),
  
  -- Metadata
  season_id UUID REFERENCES seasons(id),
  is_rematch BOOLEAN DEFAULT false,
  previous_challenge_id UUID REFERENCES challenges(id),
  
  -- Anti-spam
  decline_count INTEGER DEFAULT 0,
  decline_reasons TEXT[],
  
  CONSTRAINT valid_stakes CHECK (
    (status IN ('draft', 'pending') OR (creator_stake_amount IS NOT NULL AND acceptor_stake_amount IS NOT NULL))
  ),
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Create indexes for challenge queries
CREATE INDEX idx_challenges_creator ON challenges(creator_id, status);
CREATE INDEX idx_challenges_acceptor ON challenges(acceptor_id, status);
CREATE INDEX idx_challenges_status ON challenges(status, expires_at);
CREATE INDEX idx_challenges_expires ON challenges(expires_at) WHERE status IN ('accepted', 'active', 'awaiting_sync');
CREATE INDEX idx_challenges_season ON challenges(season_id, resolved_at);

-- ============================================
-- STAKES
-- ============================================

CREATE TABLE IF NOT EXISTS stakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  
  -- Stake details
  role VARCHAR(20) NOT NULL CHECK (role IN ('creator', 'acceptor')),
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  percentage DECIMAL(5,4) NOT NULL, -- 0.30 for creator, 0.70 for acceptor
  
  -- Status
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMP WITH TIME ZONE,
  is_refunded BOOLEAN DEFAULT false,
  refunded_at TIMESTAMP WITH TIME ZONE,
  refund_reason TEXT,
  
  -- Transaction references
  lock_transaction_id UUID REFERENCES cc_transactions(id),
  refund_transaction_id UUID REFERENCES cc_transactions(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(challenge_id, user_id)
);

-- Create indexes for stake queries
CREATE INDEX idx_stakes_challenge ON stakes(challenge_id);
CREATE INDEX idx_stakes_user ON stakes(user_id, is_locked);

-- ============================================
-- CHALLENGE RESULTS
-- ============================================

CREATE TABLE IF NOT EXISTS challenge_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  
  -- Winner determination
  winner_user_id UUID NOT NULL REFERENCES "Users"(id),
  loser_user_id UUID NOT NULL REFERENCES "Users"(id),
  is_tie BOOLEAN DEFAULT false,
  
  -- Scores
  winner_score DECIMAL(10,2),
  loser_score DECIMAL(10,2),
  score_difference DECIMAL(10,2),
  
  -- Pot and payouts
  base_pot DECIMAL(15,2) NOT NULL,
  rank_gap_bonus DECIMAL(15,2) DEFAULT 0,
  champion_bonus DECIMAL(15,2) DEFAULT 0,
  legend_bonus DECIMAL(15,2) DEFAULT 0,
  total_bonus DECIMAL(15,2) DEFAULT 0,
  final_payout DECIMAL(15,2) NOT NULL,
  
  -- Bonus calculation details
  winner_rank rank_tier,
  loser_rank rank_tier,
  rank_gap INTEGER DEFAULT 0,
  loser_was_champion BOOLEAN DEFAULT false,
  
  -- TrackMan verification
  winner_trackman_round_id VARCHAR(200),
  loser_trackman_round_id VARCHAR(200),
  winner_trackman_data JSONB,
  loser_trackman_data JSONB,
  
  -- Resolution method
  resolution_type VARCHAR(50) NOT NULL, -- 'auto', 'manual', 'no_show', 'expired', 'admin'
  resolved_by UUID REFERENCES "Users"(id),
  resolution_notes TEXT,
  
  resolved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(challenge_id)
);

-- Create indexes for result queries
CREATE INDEX idx_results_winner ON challenge_results(winner_user_id, resolved_at DESC);
CREATE INDEX idx_results_loser ON challenge_results(loser_user_id, resolved_at DESC);
CREATE INDEX idx_results_challenge ON challenge_results(challenge_id);

-- ============================================
-- CHALLENGE PLAYS
-- ============================================

-- Track individual play sessions for challenges
CREATE TABLE IF NOT EXISTS challenge_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  
  -- Play session data
  played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  bay_number VARCHAR(20),
  location VARCHAR(100),
  
  -- TrackMan data
  trackman_round_id VARCHAR(200) UNIQUE,
  trackman_session_id VARCHAR(200),
  score DECIMAL(10,2),
  
  -- Full TrackMan payload for verification
  trackman_data JSONB,
  
  -- Skedda booking reference
  booking_id VARCHAR(200),
  booking_verified BOOLEAN DEFAULT false,
  
  -- Validation
  settings_match BOOLEAN DEFAULT false,
  is_valid BOOLEAN DEFAULT false,
  validation_errors TEXT[],
  
  -- Device/location tracking for disputes
  ip_address INET,
  user_agent TEXT,
  
  UNIQUE(challenge_id, user_id)
);

-- Create indexes for play queries
CREATE INDEX idx_plays_challenge ON challenge_plays(challenge_id);
CREATE INDEX idx_plays_user ON challenge_plays(user_id, played_at DESC);
CREATE INDEX idx_plays_trackman ON challenge_plays(trackman_round_id) WHERE trackman_round_id IS NOT NULL;

-- ============================================
-- CHALLENGE AUDIT LOG
-- ============================================

CREATE TABLE IF NOT EXISTS challenge_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  
  -- Audit entry
  event_type VARCHAR(100) NOT NULL, -- 'created', 'sent', 'accepted', 'declined', 'played', 'resolved', 'disputed', etc.
  user_id UUID REFERENCES "Users"(id),
  
  -- State tracking
  old_status challenge_status,
  new_status challenge_status,
  
  -- Event details
  event_data JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit queries
CREATE INDEX idx_audit_challenge ON challenge_audit(challenge_id, created_at DESC);
CREATE INDEX idx_audit_event ON challenge_audit(event_type, created_at DESC);
CREATE INDEX idx_audit_user ON challenge_audit(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- ============================================
-- CHALLENGE DISPUTES
-- ============================================

CREATE TABLE IF NOT EXISTS challenge_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  
  -- Dispute filing
  filed_by UUID NOT NULL REFERENCES "Users"(id),
  filed_against UUID REFERENCES "Users"(id),
  filed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Dispute details
  dispute_type VARCHAR(50) NOT NULL, -- 'wrong_settings', 'invalid_score', 'no_show', 'cheating', 'other'
  description TEXT NOT NULL,
  evidence JSONB DEFAULT '[]', -- Array of evidence items
  
  -- Resolution
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'under_review', 'resolved', 'dismissed'
  reviewed_by UUID REFERENCES "Users"(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  resolution VARCHAR(20), -- 'upheld', 'dismissed', 'partial', 'refund_both'
  resolution_notes TEXT,
  
  -- Actions taken
  cc_adjustments JSONB DEFAULT '{}', -- Any CC corrections applied
  sanctions_applied JSONB DEFAULT '{}', -- Any user sanctions
  
  -- Priority for review
  priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  
  UNIQUE(challenge_id)
);

-- Create indexes for dispute queries
CREATE INDEX idx_disputes_status ON challenge_disputes(status, priority, filed_at);
CREATE INDEX idx_disputes_user ON challenge_disputes(filed_by);
CREATE INDEX idx_disputes_challenge ON challenge_disputes(challenge_id);

-- ============================================
-- NO-SHOW TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS challenge_no_shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  
  -- No-show details
  role VARCHAR(20) NOT NULL CHECK (role IN ('creator', 'acceptor')),
  expected_by TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Penalties applied
  cc_forfeited DECIMAL(15,2) DEFAULT 0,
  credibility_penalty INTEGER DEFAULT 0,
  
  -- Tracking
  is_repeat_offender BOOLEAN DEFAULT false,
  no_show_count INTEGER DEFAULT 1,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(challenge_id, user_id)
);

-- Create indexes for no-show queries
CREATE INDEX idx_no_shows_user ON challenge_no_shows(user_id, created_at DESC);
CREATE INDEX idx_no_shows_challenge ON challenge_no_shows(challenge_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Calculate stake amounts based on wager
CREATE OR REPLACE FUNCTION calculate_stake_amounts(
  p_wager DECIMAL,
  p_creator_percentage DECIMAL DEFAULT 0.30,
  p_acceptor_percentage DECIMAL DEFAULT 0.70
) RETURNS TABLE (
  creator_stake DECIMAL,
  acceptor_stake DECIMAL,
  total_pot DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(p_wager * p_creator_percentage, 2) AS creator_stake,
    ROUND(p_wager * p_acceptor_percentage, 2) AS acceptor_stake,
    ROUND(p_wager * (p_creator_percentage + p_acceptor_percentage), 2) AS total_pot;
END;
$$ LANGUAGE plpgsql;

-- Calculate rank gap between users
CREATE OR REPLACE FUNCTION calculate_rank_gap(
  p_rank1 rank_tier,
  p_rank2 rank_tier
) RETURNS INTEGER AS $$
DECLARE
  rank_values JSONB := '{
    "house": 0,
    "amateur": 1,
    "bronze": 2,
    "silver": 3,
    "gold": 4,
    "pro": 5,
    "champion": 6,
    "legend": 7
  }'::JSONB;
  rank1_value INTEGER;
  rank2_value INTEGER;
BEGIN
  rank1_value := (rank_values->>p_rank1::TEXT)::INTEGER;
  rank2_value := (rank_values->>p_rank2::TEXT)::INTEGER;
  
  RETURN ABS(rank1_value - rank2_value);
END;
$$ LANGUAGE plpgsql;

-- Calculate bonus amount based on pot and bonuses
CREATE OR REPLACE FUNCTION calculate_challenge_bonus(
  p_pot DECIMAL,
  p_winner_rank rank_tier,
  p_loser_rank rank_tier,
  p_loser_is_champion BOOLEAN DEFAULT false
) RETURNS TABLE (
  rank_gap_bonus DECIMAL,
  champion_bonus DECIMAL,
  total_bonus DECIMAL
) AS $$
DECLARE
  rank_gap INTEGER;
  rank_bonus DECIMAL := 0;
  champ_bonus DECIMAL := 0;
BEGIN
  -- Calculate rank gap bonus (10% per gap, max 20%)
  rank_gap := calculate_rank_gap(p_winner_rank, p_loser_rank);
  
  -- Only apply if winner is lower rank than loser
  IF p_winner_rank < p_loser_rank THEN
    rank_bonus := LEAST(p_pot * 0.10 * rank_gap, p_pot * 0.20);
  END IF;
  
  -- Champion bonus (20% if loser was champion)
  IF p_loser_is_champion THEN
    champ_bonus := p_pot * 0.20;
  END IF;
  
  RETURN QUERY
  SELECT 
    ROUND(rank_bonus, 2) AS rank_gap_bonus,
    ROUND(champ_bonus, 2) AS champion_bonus,
    ROUND(rank_bonus + champ_bonus, 2) AS total_bonus;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-set expiry date when challenge is created
CREATE OR REPLACE FUNCTION set_challenge_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NEW.created_at + (NEW.expiry_days || ' days')::INTERVAL;
  END IF;
  
  -- Set stake amounts
  IF NEW.creator_stake_amount IS NULL THEN
    NEW.creator_stake_amount := ROUND(NEW.wager_amount * 0.30, 2);
  END IF;
  
  IF NEW.acceptor_stake_amount IS NULL THEN
    NEW.acceptor_stake_amount := ROUND(NEW.wager_amount * 0.70, 2);
  END IF;
  
  NEW.total_pot := NEW.creator_stake_amount + NEW.acceptor_stake_amount;
  
  -- Set current season
  IF NEW.season_id IS NULL THEN
    NEW.season_id := get_current_season();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER challenge_before_insert
BEFORE INSERT ON challenges
FOR EACH ROW EXECUTE FUNCTION set_challenge_expiry();

-- Log all challenge status changes
CREATE OR REPLACE FUNCTION log_challenge_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO challenge_audit (
      challenge_id,
      event_type,
      old_status,
      new_status,
      event_data
    ) VALUES (
      NEW.id,
      'status_change',
      OLD.status,
      NEW.status,
      jsonb_build_object(
        'changed_at', CURRENT_TIMESTAMP,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER challenge_status_audit
AFTER UPDATE ON challenges
FOR EACH ROW EXECUTE FUNCTION log_challenge_status_change();

-- ============================================
-- ROLLBACK SUPPORT
-- ============================================

-- DOWN migration (for rollback)
/*
DROP TRIGGER IF EXISTS challenge_status_audit ON challenges;
DROP TRIGGER IF EXISTS challenge_before_insert ON challenges;
DROP FUNCTION IF EXISTS log_challenge_status_change();
DROP FUNCTION IF EXISTS set_challenge_expiry();
DROP FUNCTION IF EXISTS calculate_challenge_bonus(DECIMAL, rank_tier, rank_tier, BOOLEAN);
DROP FUNCTION IF EXISTS calculate_rank_gap(rank_tier, rank_tier);
DROP FUNCTION IF EXISTS calculate_stake_amounts(DECIMAL, DECIMAL, DECIMAL);
DROP TABLE IF EXISTS challenge_no_shows CASCADE;
DROP TABLE IF EXISTS challenge_disputes CASCADE;
DROP TABLE IF EXISTS challenge_audit CASCADE;
DROP TABLE IF EXISTS challenge_plays CASCADE;
DROP TABLE IF EXISTS challenge_results CASCADE;
DROP TABLE IF EXISTS stakes CASCADE;
DROP TABLE IF EXISTS challenges CASCADE;
DROP TYPE IF EXISTS challenge_status CASCADE;
*/