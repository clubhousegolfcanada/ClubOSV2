-- =====================================================
-- CONSOLIDATED PRODUCTION BASELINE
-- Generated: 2025-08-24T12:32:50.433Z
-- Purpose: Captures actual production database state
-- =====================================================

-- This migration represents the current production state
-- It should only be run on a fresh database

-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- MIGRATION TRACKING
-- =====================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  version character varying(255) NOT NULL,
  name character varying(255) NOT NULL,
  executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  checksum character varying(64),
  execution_time_ms integer,
  success boolean DEFAULT true,
  error_message text,
  rollback_sql text,
  PRIMARY KEY (version)
);

-- Mark this baseline as applied
INSERT INTO schema_migrations (version, name, checksum) 
VALUES ('200', 'consolidated_production_baseline', MD5('consolidated_production_baseline'))
ON CONFLICT (version) DO NOTHING;

-- =====================================================
-- TABLES
-- =====================================================

-- Table: Users
CREATE TABLE IF NOT EXISTS Users (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'support'::character varying,
  phone VARCHAR(50),
  createdAt TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  lastLogin TIMESTAMP WITHOUT TIME ZONE,
  isActive BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITHOUT TIME ZONE,
  PRIMARY KEY (id),
  CONSTRAINT Users_email_key UNIQUE (email),
  CONSTRAINT valid_role CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'operator'::character varying, 'support'::character varying, 'kiosk'::character varying])::text[])))
);

-- Table: access_logs
CREATE TABLE IF NOT EXISTS access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  createdAt TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Table: users
CREATE TABLE IF NOT EXISTS users (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'support'::character varying,
  phone VARCHAR(50),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITHOUT TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  PRIMARY KEY (id),
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT valid_role CHECK (((role)::text = ANY (ARRAY['admin'::text, 'operator'::text, 'support'::text, 'kiosk'::text, 'customer'::text])))
);

-- Table: achievement_preferences
CREATE TABLE IF NOT EXISTS achievement_preferences (
  user_id UUID NOT NULL,
  show_achievements BOOLEAN DEFAULT true,
  featured_achievements uuid[] DEFAULT '{}'::uuid[],
  display_order VARCHAR(20) DEFAULT 'recent'::character varying,
  hide_achievements uuid[] DEFAULT '{}'::uuid[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
);

-- Table: achievements
CREATE TABLE IF NOT EXISTS achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(10),
  badge_url VARCHAR(255),
  points INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  auto_award BOOLEAN DEFAULT false,
  auto_criteria JSONB,
  display_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  category VARCHAR(50) DEFAULT 'custom'::character varying,
  rarity VARCHAR(50) DEFAULT 'special'::character varying,
  PRIMARY KEY (id),
  CONSTRAINT achievements_code_key UNIQUE (code)
);

-- Table: admin_actions
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  target_user_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Table: ai_automation_features
CREATE TABLE IF NOT EXISTS ai_automation_features (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  feature_key VARCHAR(100) NOT NULL,
  feature_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}'::jsonb,
  required_permissions varchar[],
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  allow_follow_up BOOLEAN DEFAULT true,
  PRIMARY KEY (id),
  CONSTRAINT ai_automation_features_feature_key_key UNIQUE (feature_key)
);

-- Table: knowledge_store
CREATE TABLE IF NOT EXISTS knowledge_store (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  confidence DOUBLE PRECISION DEFAULT 0.5,
  verification_status VARCHAR(20) DEFAULT 'learned'::character varying,
  source_count INTEGER DEFAULT 1,
  replaces uuid[],
  superseded_by UUID,
  usage_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  search_vector TSVECTOR,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  created_by UUID,
  last_accessed TIMESTAMP WITHOUT TIME ZONE,
  expires_at TIMESTAMP WITHOUT TIME ZONE,
  category VARCHAR(100),
  source_type VARCHAR(50) DEFAULT 'manual'::character varying,
  source_id VARCHAR(255),
  source_table VARCHAR(100),
  PRIMARY KEY (id),
  CONSTRAINT knowledge_store_key_key UNIQUE (key),
  CONSTRAINT knowledge_store_confidence_check CHECK (((confidence >= (0)::double precision) AND (confidence <= (1)::double precision))),
  CONSTRAINT knowledge_store_verification_status_check CHECK (((verification_status)::text = ANY ((ARRAY['verified'::character varying, 'learned'::character varying, 'pending'::character varying, 'rejected'::character varying])::text[])))
);

-- Table: openphone_conversations
CREATE TABLE IF NOT EXISTS openphone_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20),
  customer_name VARCHAR(255),
  employee_name VARCHAR(255),
  messages JSONB NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  processed BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  conversation_id VARCHAR(255),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  unread_count INTEGER DEFAULT 0,
  last_read_at TIMESTAMP WITH TIME ZONE,
  knowledge_extracted BOOLEAN DEFAULT false,
  extraction_result JSONB,
  knowledge_id UUID,
  PRIMARY KEY (id),
  CONSTRAINT openphone_conversations_conversation_id_key UNIQUE (conversation_id)
);

-- Table: ai_automation_actions
CREATE TABLE IF NOT EXISTS ai_automation_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  feature_key VARCHAR(50),
  conversation_id UUID,
  action_type VARCHAR(50) NOT NULL,
  action_data JSONB DEFAULT '{}'::jsonb,
  executed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  response_text TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (id)
);

-- Table: ai_automation_response_tracking
CREATE TABLE IF NOT EXISTS ai_automation_response_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  conversation_id UUID,
  feature_key VARCHAR(50),
  response_count INTEGER DEFAULT 1,
  last_response_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT ai_automation_response_tracking_conversation_id_feature_key_key UNIQUE (conversation_id, feature_key)
);

-- Table: ai_automation_rules
CREATE TABLE IF NOT EXISTS ai_automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  feature_id UUID,
  rule_type VARCHAR(50),
  rule_data JSONB NOT NULL,
  priority INTEGER DEFAULT 100,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Table: ai_automation_usage
CREATE TABLE IF NOT EXISTS ai_automation_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  feature_id UUID,
  conversation_id UUID,
  trigger_type VARCHAR(50),
  input_data JSONB,
  output_data JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  execution_time_ms INTEGER,
  user_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Table: ai_prompt_templates
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT ai_prompt_templates_name_key UNIQUE (name)
);

-- Table: ai_prompt_template_history
CREATE TABLE IF NOT EXISTS ai_prompt_template_history (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  template_id UUID,
  old_template TEXT,
  new_template TEXT,
  changed_by UUID,
  changed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  change_reason TEXT,
  PRIMARY KEY (id)
);

-- Table: assistant_knowledge
CREATE TABLE IF NOT EXISTS assistant_knowledge (
  id INTEGER NOT NULL DEFAULT nextval('assistant_knowledge_id_seq'::regclass),
  assistant_id VARCHAR(255) NOT NULL,
  route VARCHAR(255) NOT NULL,
  knowledge JSONB NOT NULL,
  version VARCHAR(50) DEFAULT '1.0'::character varying,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Table: auth_logs
CREATE TABLE IF NOT EXISTS auth_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID,
  action VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  createdAt TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Table: seasons
CREATE TABLE IF NOT EXISTS seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'upcoming'::character varying,
  rank_cut_lines JSONB NOT NULL DEFAULT '{"pro": 0.15, "gold": 0.35, "bronze": 0.90, "legend": 0.01, "silver": 0.65, "amateur": 1.0, "champion": 0.05}'::jsonb,
  total_players INTEGER DEFAULT 0,
  total_challenges INTEGER DEFAULT 0,
  total_cc_circulated NUMERIC(15, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT false,
  PRIMARY KEY (id),
  CONSTRAINT valid_season_dates CHECK ((end_date > start_date))
);

-- Table: badges
CREATE TABLE IF NOT EXISTS badges (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  category badge_category NOT NULL,
  tier badge_tier NOT NULL DEFAULT 'common'::badge_tier,
  icon_url TEXT,
  icon_emoji VARCHAR(10),
  display_order INTEGER DEFAULT 0,
  requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  is_secret BOOLEAN DEFAULT false,
  times_awarded INTEGER DEFAULT 0,
  is_seasonal BOOLEAN DEFAULT false,
  season_id UUID,
  available_from TIMESTAMP WITH TIME ZONE,
  available_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT badges_key_key UNIQUE (key)
);

-- Table: badge_progress
CREATE TABLE IF NOT EXISTS badge_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL,
  current_value NUMERIC(15, 2) DEFAULT 0,
  target_value NUMERIC(15, 2) NOT NULL,
  progress_percentage INTEGER DEFAULT 0,
  progress_data JSONB DEFAULT '{}'::jsonb,
  is_complete BOOLEAN DEFAULT false,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id),
  CONSTRAINT badge_progress_user_id_badge_id_key UNIQUE (user_id, badge_id)
);

-- Table: badge_rules
CREATE TABLE IF NOT EXISTS badge_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  badge_id UUID NOT NULL,
  rule_type VARCHAR(50) NOT NULL,
  trigger_event VARCHAR(100) NOT NULL,
  evaluation_sql TEXT,
  evaluation_function VARCHAR(200),
  parameters JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  check_frequency VARCHAR(20) DEFAULT 'on_event'::character varying,
  last_checked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT badge_rules_badge_id_rule_type_key UNIQUE (badge_id, rule_type)
);

-- Table: teams
CREATE TABLE IF NOT EXISTS teams (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  team_type VARCHAR(50) NOT NULL,
  is_public BOOLEAN DEFAULT false,
  max_members INTEGER DEFAULT 16,
  join_code VARCHAR(20),
  created_by UUID NOT NULL,
  captain_id UUID,
  total_rounds INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  logo_url TEXT,
  primary_color VARCHAR(7),
  secondary_color VARCHAR(7),
  home_location VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id),
  CONSTRAINT teams_join_code_key UNIQUE (join_code),
  CONSTRAINT teams_max_members_check CHECK ((max_members <= 16)),
  CONSTRAINT valid_team_size CHECK (((max_members >= 2) AND (max_members <= 16)))
);

-- Table: events
CREATE TABLE IF NOT EXISTS events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  event_type VARCHAR(50) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location VARCHAR(100) NOT NULL,
  bay_assignments text[],
  max_participants INTEGER DEFAULT 16,
  min_participants INTEGER DEFAULT 2,
  registration_deadline TIMESTAMP WITH TIME ZONE,
  is_public BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  entry_fee NUMERIC(10, 2),
  prize_pool NUMERIC(10, 2),
  scoring_format VARCHAR(50),
  rounds INTEGER DEFAULT 1,
  holes_per_round INTEGER DEFAULT 18,
  handicap_enabled BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  is_official BOOLEAN DEFAULT false,
  team_id UUID,
  trackman_event_id VARCHAR(100),
  auto_scoring BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'draft'::character varying,
  winner_user_id UUID,
  winner_team_id UUID,
  final_scores JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id),
  CONSTRAINT events_max_participants_check CHECK ((max_participants <= 16))
);

-- Table: booking_shares
CREATE TABLE IF NOT EXISTS booking_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  booking_id VARCHAR(200) NOT NULL,
  shared_by UUID NOT NULL,
  booking_date TIMESTAMP WITH TIME ZONE NOT NULL,
  bay_number VARCHAR(20),
  duration_minutes INTEGER,
  location VARCHAR(100),
  visibility VARCHAR(20) DEFAULT 'friends'::character varying,
  team_id UUID,
  event_id UUID,
  max_participants INTEGER DEFAULT 4,
  allow_join_requests BOOLEAN DEFAULT true,
  tags text[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id)
);

-- Table: booking_participants
CREATE TABLE IF NOT EXISTS booking_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  booking_share_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status VARCHAR(20) DEFAULT 'confirmed'::character varying,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT booking_participants_booking_share_id_user_id_key UNIQUE (booking_share_id, user_id)
);

-- Table: booking_rewards
CREATE TABLE IF NOT EXISTS booking_rewards (
  id INTEGER NOT NULL DEFAULT nextval('booking_rewards_id_seq'::regclass),
  user_id UUID NOT NULL,
  hubspot_deal_id VARCHAR(255) NOT NULL,
  booking_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  reward_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  location VARCHAR(100),
  box_number VARCHAR(50),
  cc_awarded INTEGER DEFAULT 25,
  status VARCHAR(20) DEFAULT 'pending'::character varying,
  awarded_at TIMESTAMP WITHOUT TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT booking_rewards_hubspot_deal_id_key UNIQUE (hubspot_deal_id)
);

-- Table: bookings
CREATE TABLE IF NOT EXISTS bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  simulator_id VARCHAR(255) NOT NULL,
  start_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  duration INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL,
  recurring_days int4[],
  status VARCHAR(50) NOT NULL DEFAULT 'confirmed'::character varying,
  createdAt TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP WITHOUT TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (id),
  CONSTRAINT bookings_duration_check CHECK (((duration >= 30) AND (duration <= 240))),
  CONSTRAINT bookings_type_check CHECK (((type)::text = ANY ((ARRAY['single'::character varying, 'recurring'::character varying])::text[])))
);

-- Table: cc_transactions
CREATE TABLE IF NOT EXISTS cc_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  balance_before NUMERIC(15, 2) NOT NULL,
  balance_after NUMERIC(15, 2) NOT NULL,
  challenge_id UUID,
  season_id UUID,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT valid_transaction_amount CHECK ((amount <> (0)::numeric))
);

-- Table: challenge_settings_catalog
CREATE TABLE IF NOT EXISTS challenge_settings_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  course_id VARCHAR(100) NOT NULL,
  course_name VARCHAR(200) NOT NULL,
  tee_type VARCHAR(50),
  wind_speed VARCHAR(50),
  wind_direction VARCHAR(50),
  pin_position VARCHAR(50),
  game_mode VARCHAR(100),
  scoring_type VARCHAR(50) NOT NULL,
  holes INTEGER DEFAULT 18,
  time_limit_minutes INTEGER,
  settings_json JSONB DEFAULT '{}'::jsonb,
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Table: challenges
CREATE TABLE IF NOT EXISTS challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  acceptor_id UUID,
  settings_catalog_id UUID,
  course_id VARCHAR(100) NOT NULL,
  course_name VARCHAR(200) NOT NULL,
  tee_type VARCHAR(50),
  wind_speed VARCHAR(50),
  wind_direction VARCHAR(50),
  pin_position VARCHAR(50),
  game_mode VARCHAR(100),
  scoring_type VARCHAR(50) NOT NULL,
  holes INTEGER DEFAULT 18,
  trackman_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  wager_amount NUMERIC(15, 2) NOT NULL,
  creator_stake_amount NUMERIC(15, 2),
  acceptor_stake_amount NUMERIC(15, 2),
  total_pot NUMERIC(15, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expiry_days INTEGER NOT NULL,
  creator_played_at TIMESTAMP WITH TIME ZONE,
  acceptor_played_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  status challenge_status NOT NULL DEFAULT 'draft'::challenge_status,
  creator_note TEXT,
  acceptor_note TEXT,
  winner_user_id UUID,
  creator_score NUMERIC(10, 2),
  acceptor_score NUMERIC(10, 2),
  rank_gap_bonus NUMERIC(15, 2) DEFAULT 0,
  champion_bonus NUMERIC(15, 2) DEFAULT 0,
  total_bonus NUMERIC(15, 2) DEFAULT 0,
  final_payout NUMERIC(15, 2),
  season_id UUID,
  is_rematch BOOLEAN DEFAULT false,
  previous_challenge_id UUID,
  decline_count INTEGER DEFAULT 0,
  decline_reasons text[],
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT challenges_wager_amount_check CHECK ((wager_amount > (0)::numeric)),
  CONSTRAINT challenges_expiry_days_check CHECK ((expiry_days = ANY (ARRAY[7, 14, 30]))),
  CONSTRAINT valid_stakes CHECK (((status = ANY (ARRAY['draft'::challenge_status, 'pending'::challenge_status])) OR ((creator_stake_amount IS NOT NULL) AND (acceptor_stake_amount IS NOT NULL)))),
  CONSTRAINT valid_expiry CHECK ((expires_at > created_at))
);

-- Table: challenge_audit
CREATE TABLE IF NOT EXISTS challenge_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  user_id UUID,
  old_status challenge_status,
  new_status challenge_status,
  event_data JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Table: challenge_disputes
CREATE TABLE IF NOT EXISTS challenge_disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL,
  filed_by UUID NOT NULL,
  filed_against UUID,
  filed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  dispute_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  evidence JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) DEFAULT 'pending'::character varying,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  resolution VARCHAR(20),
  resolution_notes TEXT,
  cc_adjustments JSONB DEFAULT '{}'::jsonb,
  sanctions_applied JSONB DEFAULT '{}'::jsonb,
  priority VARCHAR(20) DEFAULT 'normal'::character varying,
  PRIMARY KEY (id),
  CONSTRAINT challenge_disputes_challenge_id_key UNIQUE (challenge_id)
);

-- Table: challenge_no_shows
CREATE TABLE IF NOT EXISTS challenge_no_shows (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL,
  expected_by TIMESTAMP WITH TIME ZONE NOT NULL,
  cc_forfeited NUMERIC(15, 2) DEFAULT 0,
  credibility_penalty INTEGER DEFAULT 0,
  is_repeat_offender BOOLEAN DEFAULT false,
  no_show_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT challenge_no_shows_challenge_id_user_id_key UNIQUE (challenge_id, user_id),
  CONSTRAINT challenge_no_shows_role_check CHECK (((role)::text = ANY ((ARRAY['creator'::character varying, 'acceptor'::character varying])::text[])))
);

-- Table: challenge_plays
CREATE TABLE IF NOT EXISTS challenge_plays (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL,
  user_id UUID NOT NULL,
  played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  bay_number VARCHAR(20),
  location VARCHAR(100),
  trackman_round_id VARCHAR(200),
  trackman_session_id VARCHAR(200),
  score NUMERIC(10, 2),
  trackman_data JSONB,
  booking_id VARCHAR(200),
  booking_verified BOOLEAN DEFAULT false,
  settings_match BOOLEAN DEFAULT false,
  is_valid BOOLEAN DEFAULT false,
  validation_errors text[],
  ip_address INET,
  user_agent TEXT,
  PRIMARY KEY (id),
  CONSTRAINT challenge_plays_challenge_id_user_id_key UNIQUE (challenge_id, user_id),
  CONSTRAINT challenge_plays_trackman_round_id_key UNIQUE (trackman_round_id)
);

-- Table: challenge_results
CREATE TABLE IF NOT EXISTS challenge_results (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL,
  winner_user_id UUID NOT NULL,
  loser_user_id UUID NOT NULL,
  is_tie BOOLEAN DEFAULT false,
  winner_score NUMERIC(10, 2),
  loser_score NUMERIC(10, 2),
  score_difference NUMERIC(10, 2),
  base_pot NUMERIC(15, 2) NOT NULL,
  rank_gap_bonus NUMERIC(15, 2) DEFAULT 0,
  champion_bonus NUMERIC(15, 2) DEFAULT 0,
  legend_bonus NUMERIC(15, 2) DEFAULT 0,
  total_bonus NUMERIC(15, 2) DEFAULT 0,
  final_payout NUMERIC(15, 2) NOT NULL,
  winner_rank rank_tier,
  loser_rank rank_tier,
  rank_gap INTEGER DEFAULT 0,
  loser_was_champion BOOLEAN DEFAULT false,
  winner_trackman_round_id VARCHAR(200),
  loser_trackman_round_id VARCHAR(200),
  winner_trackman_data JSONB,
  loser_trackman_data JSONB,
  resolution_type VARCHAR(50) NOT NULL,
  resolved_by UUID,
  resolution_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT challenge_results_challenge_id_key UNIQUE (challenge_id)
);

-- Table: challenge_winner_selections
CREATE TABLE IF NOT EXISTS challenge_winner_selections (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL,
  user_id UUID NOT NULL,
  selected_winner_id UUID NOT NULL,
  selected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT challenge_winner_selections_challenge_id_user_id_key UNIQUE (challenge_id, user_id)
);

-- Table: champion_markers
CREATE TABLE IF NOT EXISTS champion_markers (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_id UUID,
  event_name VARCHAR(200) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  year INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 1,
  marker_name VARCHAR(50) NOT NULL,
  display_text VARCHAR(200),
  icon_url TEXT,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  bonus_multiplier NUMERIC(3, 2) DEFAULT 0.20,
  awarded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT champion_markers_user_id_event_id_key UNIQUE (user_id, event_id)
);

-- Table: checklist_submissions
CREATE TABLE IF NOT EXISTS checklist_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,
  location VARCHAR(100) NOT NULL,
  completed_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_tasks INTEGER NOT NULL,
  completion_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  comments TEXT,
  ticket_created BOOLEAN DEFAULT false,
  ticket_id UUID,
  PRIMARY KEY (id),
  CONSTRAINT checklist_submissions_category_check CHECK (((category)::text = ANY ((ARRAY['cleaning'::character varying, 'tech'::character varying])::text[]))),
  CONSTRAINT checklist_submissions_type_check CHECK (((type)::text = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'quarterly'::character varying])::text[])))
);

-- Table: checklist_task_customizations
CREATE TABLE IF NOT EXISTS checklist_task_customizations (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,
  task_id VARCHAR(100) NOT NULL,
  custom_label TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT checklist_task_customizations_category_type_task_id_key UNIQUE (category, type, task_id)
);

-- Table: clubhouse_locations
CREATE TABLE IF NOT EXISTS clubhouse_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  address_line1 VARCHAR(200) NOT NULL,
  address_line2 VARCHAR(200),
  city VARCHAR(100) NOT NULL,
  province VARCHAR(50) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(2) DEFAULT 'CA'::character varying,
  phone VARCHAR(20),
  email VARCHAR(100),
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  timezone VARCHAR(50) DEFAULT 'America/Halifax'::character varying,
  total_bays INTEGER NOT NULL,
  trackman_bays INTEGER DEFAULT 0,
  regular_bays INTEGER DEFAULT 0,
  operating_hours JSONB DEFAULT '{}'::jsonb,
  has_bar BOOLEAN DEFAULT false,
  has_food BOOLEAN DEFAULT false,
  has_lessons BOOLEAN DEFAULT false,
  has_leagues BOOLEAN DEFAULT false,
  has_events BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  hero_image_url TEXT,
  logo_url TEXT,
  gallery_urls text[],
  skedda_venue_id VARCHAR(100),
  skedda_space_ids JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Table: clubhouse_announcements
CREATE TABLE IF NOT EXISTS clubhouse_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  clubhouse_id UUID,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  announcement_type VARCHAR(50),
  priority VARCHAR(20) DEFAULT 'normal'::character varying,
  is_active BOOLEAN DEFAULT true,
  show_in_app BOOLEAN DEFAULT true,
  show_on_website BOOLEAN DEFAULT false,
  target_locations uuid[],
  start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Table: contact_sync
CREATE TABLE IF NOT EXISTS contact_sync (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contact_hash VARCHAR(64) NOT NULL,
  contact_type VARCHAR(10) NOT NULL,
  contact_name VARCHAR(255),
  matched_user_id UUID,
  match_confidence DOUBLE PRECISION DEFAULT 1.0,
  friendship_status VARCHAR(20),
  synced_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(50),
  PRIMARY KEY (id),
  CONSTRAINT contact_sync_user_id_contact_hash_key UNIQUE (user_id, contact_hash)
);

-- Table: conversation_sessions
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  user_id UUID,
  started_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  context JSONB,
  active BOOLEAN DEFAULT true,
  PRIMARY KEY (id),
  CONSTRAINT conversation_sessions_session_id_key UNIQUE (session_id)
);

-- Table: customer_interactions
CREATE TABLE IF NOT EXISTS customer_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email VARCHAR(255),
  request_text TEXT NOT NULL,
  response_text TEXT,
  route VARCHAR(50),
  confidence NUMERIC(3, 2),
  metadata JSONB DEFAULT '{}'::jsonb,
  createdAt TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  suggested_priority VARCHAR(20),
  session_id VARCHAR(255),
  PRIMARY KEY (id)
);

-- Table: customer_profiles
CREATE TABLE IF NOT EXISTS customer_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  display_name VARCHAR(100),
  bio TEXT,
  avatar_url TEXT,
  handicap NUMERIC(3, 1),
  home_location VARCHAR(100),
  profile_visibility VARCHAR(20) DEFAULT 'friends'::character varying,
  show_bookings BOOLEAN DEFAULT true,
  show_stats BOOLEAN DEFAULT true,
  show_friends BOOLEAN DEFAULT false,
  max_friends INTEGER DEFAULT 250,
  max_teams INTEGER DEFAULT 5,
  preferred_tee_time VARCHAR(20),
  preferred_bay_type VARCHAR(20),
  notification_preferences JSONB DEFAULT '{}'::jsonb,
  total_rounds INTEGER DEFAULT 0,
  average_score NUMERIC(5, 2),
  best_score INTEGER,
  favorite_course VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  cc_balance NUMERIC(15, 2) DEFAULT 0,
  credibility_score INTEGER DEFAULT 100,
  current_rank rank_tier DEFAULT 'house'::rank_tier,
  highest_rank_achieved rank_tier DEFAULT 'house'::rank_tier,
  total_challenges_played INTEGER DEFAULT 0,
  total_challenges_won INTEGER DEFAULT 0,
  total_cc_earned NUMERIC(15, 2) DEFAULT 0,
  total_cc_spent NUMERIC(15, 2) DEFAULT 0,
  challenge_win_rate NUMERIC(5, 4) DEFAULT 0,
  last_challenge_at TIMESTAMP WITH TIME ZONE,
  challenge_streak INTEGER DEFAULT 0,
  max_win_streak INTEGER DEFAULT 0,
  max_loss_streak INTEGER DEFAULT 0,
  previous_rank INTEGER,
  rank_last_updated TIMESTAMP WITHOUT TIME ZONE,
  achievement_count INTEGER DEFAULT 0,
  achievement_points INTEGER DEFAULT 0,
  rarest_achievement UUID,
  latest_achievement_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id),
  CONSTRAINT customer_profiles_user_id_key UNIQUE (user_id),
  CONSTRAINT customer_profiles_credibility_score_check CHECK (((credibility_score >= 0) AND (credibility_score <= 100)))
);

-- Table: door_access_log
CREATE TABLE IF NOT EXISTS door_access_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  location VARCHAR(100),
  door_name VARCHAR(255),
  door_id VARCHAR(255),
  action VARCHAR(50),
  user_id VARCHAR(255),
  username VARCHAR(255),
  duration INTEGER,
  success BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (id)
);

-- Table: event_participants
CREATE TABLE IF NOT EXISTS event_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  user_id UUID NOT NULL,
  team_id UUID,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  registration_status VARCHAR(20) DEFAULT 'registered'::character varying,
  check_in_time TIMESTAMP WITH TIME ZONE,
  total_score INTEGER,
  handicap_applied NUMERIC(3, 1),
  final_position INTEGER,
  prize_amount NUMERIC(10, 2),
  round_scores JSONB DEFAULT '[]'::jsonb,
  PRIMARY KEY (id),
  CONSTRAINT event_participants_event_id_user_id_key UNIQUE (event_id, user_id)
);

-- Table: extracted_knowledge
CREATE TABLE IF NOT EXISTS extracted_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  source_id UUID,
  source_type VARCHAR(20),
  category VARCHAR(50),
  problem TEXT NOT NULL,
  solution TEXT NOT NULL,
  confidence DOUBLE PRECISION,
  applied_to_sop BOOLEAN DEFAULT false,
  sop_file VARCHAR(255),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Table: feedback
CREATE TABLE IF NOT EXISTS feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id UUID,
  user_email VARCHAR(255),
  request_description TEXT NOT NULL,
  location VARCHAR(255),
  route VARCHAR(50),
  response TEXT,
  confidence NUMERIC(3, 2),
  is_useful BOOLEAN NOT NULL DEFAULT false,
  feedback_type VARCHAR(50),
  feedback_source VARCHAR(50) DEFAULT 'user'::character varying,
  slack_thread_ts VARCHAR(255),
  slack_user_name VARCHAR(255),
  slack_user_id VARCHAR(255),
  slack_channel VARCHAR(255),
  original_request_id UUID,
  createdAt TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Table: friend_activities
CREATE TABLE IF NOT EXISTS friend_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  activity_type VARCHAR(50) NOT NULL,
  activity_data JSONB DEFAULT '{}'::jsonb,
  wager_id UUID,
  booking_id VARCHAR(200),
  event_id UUID,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Table: friend_groups
CREATE TABLE IF NOT EXISTS friend_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  max_members INTEGER DEFAULT 10,
  allow_wagers BOOLEAN DEFAULT true,
  default_wager_amount NUMERIC(10, 2) DEFAULT 10,
  total_wagers INTEGER DEFAULT 0,
  total_wagered NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Table: friend_group_members
CREATE TABLE IF NOT EXISTS friend_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role VARCHAR(20) DEFAULT 'member'::character varying,
  joined_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  invited_by UUID,
  wagers_participated INTEGER DEFAULT 0,
  total_wagered NUMERIC(10, 2) DEFAULT 0,
  total_won NUMERIC(10, 2) DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT friend_group_members_group_id_user_id_key UNIQUE (group_id, user_id)
);

-- Table: friend_invitations
CREATE TABLE IF NOT EXISTS friend_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL,
  invitee_email VARCHAR(255),
  invitee_phone VARCHAR(50),
  invitee_name VARCHAR(255),
  invitation_code VARCHAR(20) DEFAULT "substring"(md5((random())::text), 1, 8),
  status VARCHAR(20) DEFAULT 'pending'::character varying,
  message TEXT,
  sent_via VARCHAR(20),
  sent_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reminder_sent_at TIMESTAMP WITHOUT TIME ZONE,
  accepted_at TIMESTAMP WITHOUT TIME ZONE,
  accepted_user_id UUID,
  expires_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (CURRENT_TIMESTAMP + '30 days'::interval),
  metadata JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (id),
  CONSTRAINT friend_invitations_invitation_code_key UNIQUE (invitation_code),
  CONSTRAINT friend_invitations_check CHECK (((invitee_email IS NOT NULL) OR (invitee_phone IS NOT NULL)))
);

-- Table: friend_notification_preferences
CREATE TABLE IF NOT EXISTS friend_notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  friend_requests BOOLEAN DEFAULT true,
  friend_accepts BOOLEAN DEFAULT true,
  friend_suggestions BOOLEAN DEFAULT false,
  wager_invites BOOLEAN DEFAULT true,
  friend_bookings BOOLEAN DEFAULT true,
  friend_achievements BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME WITHOUT TIME ZONE,
  quiet_hours_end TIME WITHOUT TIME ZONE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT friend_notification_preferences_user_id_key UNIQUE (user_id)
);

-- Table: friend_suggestions
CREATE TABLE IF NOT EXISTS friend_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  suggested_user_id UUID NOT NULL,
  reason VARCHAR(50),
  mutual_friends_count INTEGER DEFAULT 0,
  mutual_friends_list uuid[],
  shared_events_count INTEGER DEFAULT 0,
  shared_bookings_count INTEGER DEFAULT 0,
  relevance_score DOUBLE PRECISION DEFAULT 0,
  dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMP WITHOUT TIME ZONE,
  sent_request BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT friend_suggestions_user_id_suggested_user_id_key UNIQUE (user_id, suggested_user_id)
);

-- Table: friendships
CREATE TABLE IF NOT EXISTS friendships (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'::character varying,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP WITH TIME ZONE,
  blocked_at TIMESTAMP WITH TIME ZONE,
  blocked_by UUID,
  invitation_method VARCHAR(20) DEFAULT 'in_app'::character varying,
  invitation_message TEXT,
  mutual_friends_count INTEGER DEFAULT 0,
  friendship_source VARCHAR(50),
  clubcoin_wagers_count INTEGER DEFAULT 0,
  clubcoin_wagers_total NUMERIC(10, 2) DEFAULT 0,
  last_wager_date TIMESTAMP WITHOUT TIME ZONE,
  PRIMARY KEY (id),
  CONSTRAINT friendships_user_id_friend_id_key UNIQUE (user_id, friend_id),
  CONSTRAINT friendships_check CHECK ((user_id <> friend_id)),
  CONSTRAINT friendships_no_self_friend CHECK ((user_id <> friend_id))
);

-- Table: hubspot_cache
CREATE TABLE IF NOT EXISTS hubspot_cache (
  phone_number VARCHAR(20) NOT NULL,
  customer_name VARCHAR(255),
  company VARCHAR(255),
  email VARCHAR(255),
  hubspot_contact_id VARCHAR(255),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (phone_number)
);

-- Table: hubspot_contact_cache
CREATE TABLE IF NOT EXISTS hubspot_contact_cache (
  phone_number VARCHAR(50) NOT NULL,
  contact_id VARCHAR(255),
  full_name VARCHAR(255),
  email VARCHAR(255),
  company VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_synced_at TIMESTAMP WITHOUT TIME ZONE,
  PRIMARY KEY (phone_number)
);

-- Table: knowledge_audit_log
CREATE TABLE IF NOT EXISTS knowledge_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  action VARCHAR(50) NOT NULL,
  category VARCHAR(100),
  key TEXT,
  new_value TEXT,
  previous_value TEXT,
  user_id UUID,
  user_name VARCHAR(255),
  assistant_target VARCHAR(50),
  metadata JSONB DEFAULT '{}'::jsonb,
  slack_notified BOOLEAN DEFAULT false,
  PRIMARY KEY (id)
);

-- Table: knowledge_base
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,
  subcategory VARCHAR(50),
  issue VARCHAR(255) NOT NULL,
  symptoms text[],
  solutions text[],
  priority VARCHAR(20),
  time_estimate VARCHAR(50),
  customer_script TEXT,
  escalation_path TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Table: knowledge_captures
CREATE TABLE IF NOT EXISTS knowledge_captures (
  id VARCHAR(255) NOT NULL,
  source VARCHAR(50) NOT NULL,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  assistant VARCHAR(50) NOT NULL,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  verified_by VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (id),
  CONSTRAINT knowledge_captures_source_check CHECK (((source)::text = ANY ((ARRAY['slack'::character varying, 'chat'::character varying, 'ticket'::character varying, 'manual'::character varying])::text[])))
);

-- Table: knowledge_patterns
CREATE TABLE IF NOT EXISTS knowledge_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  pattern VARCHAR(255) NOT NULL,
  pattern_type VARCHAR(50),
  occurrence_count INTEGER DEFAULT 1,
  current_best_solution TEXT,
  current_best_confidence DOUBLE PRECISION DEFAULT 0.5,
  current_best_source UUID,
  alternatives JSONB DEFAULT '[]'::jsonb,
  first_seen TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  last_seen TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT knowledge_patterns_pattern_key UNIQUE (pattern)
);

-- Table: knowledge_extraction_log
CREATE TABLE IF NOT EXISTS knowledge_extraction_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  conversation_id VARCHAR(255),
  extraction_type VARCHAR(50),
  extracted_data JSONB,
  confidence DOUBLE PRECISION,
  action_taken VARCHAR(50),
  knowledge_id UUID,
  pattern_id UUID,
  skip_reason TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Table: learning_metrics
CREATE TABLE IF NOT EXISTS learning_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  metric_type VARCHAR(50) NOT NULL,
  assistant VARCHAR(50),
  value DOUBLE PRECISION NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Table: message_suggestions
CREATE TABLE IF NOT EXISTS message_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  conversation_id VARCHAR(255) NOT NULL,
  phone_number_hash VARCHAR(64) NOT NULL,
  message_id VARCHAR(255) NOT NULL,
  suggested_text TEXT NOT NULL,
  suggested_text_encrypted TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  context TEXT,
  created_by UUID NOT NULL,
  approved BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMP WITHOUT TIME ZONE,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITHOUT TIME ZONE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT message_suggestions_message_id_key UNIQUE (message_id)
);

-- Table: migration_history
CREATE TABLE IF NOT EXISTS migration_history (
  id INTEGER NOT NULL DEFAULT nextval('migration_history_id_seq'::regclass),
  version VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64),
  execution_time_ms INTEGER,
  applied_by VARCHAR(255),
  PRIMARY KEY (id),
  CONSTRAINT migration_history_version_key UNIQUE (version)
);

-- Table: migration_locks
CREATE TABLE IF NOT EXISTS migration_locks (
  id INTEGER NOT NULL DEFAULT 1,
  locked_at TIMESTAMP WITHOUT TIME ZONE,
  locked_by VARCHAR(255),
  PRIMARY KEY (id),
  CONSTRAINT single_lock CHECK ((id = 1))
);

-- Table: migrations
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER NOT NULL DEFAULT nextval('migrations_id_seq'::regclass),
  filename VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT migrations_filename_key UNIQUE (filename)
);

-- Table: push_subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  last_used_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  failed_attempts INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint)
);

-- Table: notification_history
CREATE TABLE IF NOT EXISTS notification_history (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID,
  subscription_id UUID,
  type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  status VARCHAR(20) DEFAULT 'pending'::character varying,
  error TEXT,
  sent_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  clicked_at TIMESTAMP WITHOUT TIME ZONE,
  PRIMARY KEY (id)
);

-- Table: notification_preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID NOT NULL,
  messages_enabled BOOLEAN DEFAULT true,
  tickets_enabled BOOLEAN DEFAULT true,
  system_enabled BOOLEAN DEFAULT true,
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME WITHOUT TIME ZONE DEFAULT '22:00:00'::time without time zone,
  quiet_hours_end TIME WITHOUT TIME ZONE DEFAULT '08:00:00'::time without time zone,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (user_id)
);

-- Table: public_requests
CREATE TABLE IF NOT EXISTS public_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL,
  source_id VARCHAR(255),
  customer_info JSONB DEFAULT '{}'::jsonb,
  request_text TEXT NOT NULL,
  response_text TEXT,
  route VARCHAR(50),
  confidence DOUBLE PRECISION,
  assistant_used VARCHAR(50),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Table: rank_assignments
CREATE TABLE IF NOT EXISTS rank_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  season_id UUID NOT NULL,
  rank_tier rank_tier NOT NULL DEFAULT 'house'::rank_tier,
  percentile NUMERIC(5, 4) NOT NULL,
  cc_earned NUMERIC(15, 2) DEFAULT 0,
  challenges_played INTEGER DEFAULT 0,
  challenges_won INTEGER DEFAULT 0,
  win_rate NUMERIC(5, 4) DEFAULT 0,
  rank_gap_bonuses NUMERIC(15, 2) DEFAULT 0,
  champion_bonuses NUMERIC(15, 2) DEFAULT 0,
  total_bonuses NUMERIC(15, 2) DEFAULT 0,
  season_rank INTEGER,
  location_rank INTEGER,
  tournament_override BOOLEAN DEFAULT false,
  override_reason TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT rank_assignments_user_id_season_id_key UNIQUE (user_id, season_id)
);

-- Table: rank_history
CREATE TABLE IF NOT EXISTS rank_history (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  old_rank INTEGER,
  new_rank INTEGER,
  changed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reason VARCHAR(100),
  PRIMARY KEY (id)
);

-- Table: remote_action_history
CREATE TABLE IF NOT EXISTS remote_action_history (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  action_type VARCHAR(50) NOT NULL,
  location VARCHAR(100),
  device_id VARCHAR(255),
  user_id UUID,
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Table: request_logs
CREATE TABLE IF NOT EXISTS request_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  method VARCHAR(10) NOT NULL,
  path VARCHAR(500) NOT NULL,
  status_code INTEGER,
  response_time INTEGER,
  user_id UUID,
  ip_address VARCHAR(45),
  user_agent TEXT,
  error TEXT,
  createdAt TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Table: schema_migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64),
  execution_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  rollback_sql TEXT,
  PRIMARY KEY (version)
);

-- Table: scoreboards
CREATE TABLE IF NOT EXISTS scoreboards (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  event_id UUID,
  team_id UUID,
  season VARCHAR(50),
  standings JSONB NOT NULL DEFAULT '[]'::jsonb,
  scoring_system VARCHAR(50),
  include_handicap BOOLEAN DEFAULT true,
  min_rounds_required INTEGER DEFAULT 1,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  locked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Table: seasonal_cc_earnings
CREATE TABLE IF NOT EXISTS seasonal_cc_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  season_id UUID NOT NULL,
  cc_from_wins NUMERIC(15, 2) DEFAULT 0,
  cc_from_bonuses NUMERIC(15, 2) DEFAULT 0,
  cc_from_achievements NUMERIC(15, 2) DEFAULT 0,
  cc_lost NUMERIC(15, 2) DEFAULT 0,
  cc_net NUMERIC(15, 2) DEFAULT 0,
  challenges_created INTEGER DEFAULT 0,
  challenges_accepted INTEGER DEFAULT 0,
  challenges_completed INTEGER DEFAULT 0,
  no_shows INTEGER DEFAULT 0,
  disputes_filed INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT seasonal_cc_earnings_user_id_season_id_key UNIQUE (user_id, season_id)
);

-- Table: slack_messages
CREATE TABLE IF NOT EXISTS slack_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID,
  request_id UUID,
  slack_thread_ts VARCHAR(255),
  slack_channel VARCHAR(255) NOT NULL,
  slack_message_ts VARCHAR(255),
  original_message TEXT NOT NULL,
  request_description TEXT,
  location VARCHAR(255),
  route VARCHAR(50),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT slack_messages_slack_thread_ts_key UNIQUE (slack_thread_ts)
);

-- Table: slack_replies
CREATE TABLE IF NOT EXISTS slack_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  thread_ts VARCHAR(255) NOT NULL,
  user_name VARCHAR(255),
  user_id VARCHAR(255) NOT NULL,
  text TEXT NOT NULL,
  timestamp TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Table: slack_thread_resolutions
CREATE TABLE IF NOT EXISTS slack_thread_resolutions (
  thread_ts VARCHAR(255) NOT NULL,
  original_query TEXT NOT NULL,
  final_resolution TEXT,
  was_helpful BOOLEAN,
  resolver VARCHAR(255),
  resolved_at TIMESTAMP WITHOUT TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (thread_ts)
);

-- Table: sop_drafts
CREATE TABLE IF NOT EXISTS sop_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  assistant VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(50) DEFAULT 'draft'::character varying,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  published_at TIMESTAMP WITHOUT TIME ZONE,
  PRIMARY KEY (id),
  CONSTRAINT sop_drafts_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'rejected'::character varying])::text[])))
);

-- Table: sop_embeddings
CREATE TABLE IF NOT EXISTS sop_embeddings (
  id VARCHAR(255) NOT NULL,
  assistant VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  embedding TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Table: sop_metrics
CREATE TABLE IF NOT EXISTS sop_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  total_requests INTEGER DEFAULT 0,
  sop_used INTEGER DEFAULT 0,
  assistant_used INTEGER DEFAULT 0,
  sop_avg_confidence DOUBLE PRECISION,
  sop_avg_response_time_ms DOUBLE PRECISION,
  assistant_avg_response_time_ms DOUBLE PRECISION,
  PRIMARY KEY (id)
);

-- Table: sop_shadow_comparisons
CREATE TABLE IF NOT EXISTS sop_shadow_comparisons (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  route VARCHAR(50) NOT NULL,
  assistant_response TEXT,
  sop_response TEXT,
  sop_confidence DOUBLE PRECISION,
  assistant_time_ms INTEGER,
  sop_time_ms INTEGER,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Table: sop_update_log
CREATE TABLE IF NOT EXISTS sop_update_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  document_id VARCHAR(255) NOT NULL,
  reason TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  applied_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  backup_path TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  PRIMARY KEY (id)
);

-- Table: sop_update_queue
CREATE TABLE IF NOT EXISTS sop_update_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  document_id VARCHAR(255) NOT NULL,
  original_content TEXT NOT NULL,
  suggested_content TEXT NOT NULL,
  reason TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(50) DEFAULT 'pending_review'::character varying,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  reviewed_at TIMESTAMP WITHOUT TIME ZONE,
  review_notes TEXT,
  PRIMARY KEY (id),
  CONSTRAINT sop_update_queue_status_check CHECK (((status)::text = ANY ((ARRAY['pending_review'::character varying, 'approved'::character varying, 'rejected'::character varying, 'applied'::character varying])::text[])))
);

-- Table: stakes
CREATE TABLE IF NOT EXISTS stakes (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  percentage NUMERIC(5, 4) NOT NULL,
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMP WITH TIME ZONE,
  is_refunded BOOLEAN DEFAULT false,
  refunded_at TIMESTAMP WITH TIME ZONE,
  refund_reason TEXT,
  lock_transaction_id UUID,
  refund_transaction_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT stakes_challenge_id_user_id_key UNIQUE (challenge_id, user_id),
  CONSTRAINT stakes_role_check CHECK (((role)::text = ANY ((ARRAY['creator'::character varying, 'acceptor'::character varying])::text[]))),
  CONSTRAINT stakes_amount_check CHECK ((amount > (0)::numeric))
);

-- Table: system_config
CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updatedAt TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (key)
);

-- Table: system_settings
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  category VARCHAR(50),
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT system_settings_key_key UNIQUE (key)
);

-- Table: team_members
CREATE TABLE IF NOT EXISTS team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role VARCHAR(20) DEFAULT 'member'::character varying,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  invited_by UUID,
  rounds_played INTEGER DEFAULT 0,
  average_score NUMERIC(5, 2),
  PRIMARY KEY (id),
  CONSTRAINT team_members_team_id_user_id_key UNIQUE (team_id, user_id)
);

-- Table: tickets
CREATE TABLE IF NOT EXISTS tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open'::character varying,
  priority VARCHAR(50) NOT NULL,
  location VARCHAR(255),
  created_by_id UUID NOT NULL,
  created_by_name VARCHAR(255) NOT NULL,
  created_by_email VARCHAR(255) NOT NULL,
  created_by_phone VARCHAR(50),
  assigned_to_id UUID,
  assigned_to_name VARCHAR(255),
  assigned_to_email VARCHAR(255),
  createdAt TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITHOUT TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (id),
  CONSTRAINT tickets_category_check CHECK (((category)::text = ANY ((ARRAY['facilities'::character varying, 'tech'::character varying])::text[]))),
  CONSTRAINT tickets_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'in-progress'::character varying, 'resolved'::character varying, 'closed'::character varying])::text[]))),
  CONSTRAINT tickets_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'urgent'::character varying])::text[])))
);

-- Table: ticket_comments
CREATE TABLE IF NOT EXISTS ticket_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL,
  text TEXT NOT NULL,
  created_by_id UUID NOT NULL,
  created_by_name VARCHAR(255) NOT NULL,
  created_by_email VARCHAR(255) NOT NULL,
  created_by_phone VARCHAR(50),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Table: usage_logs
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10),
  status_code INTEGER,
  response_time_ms INTEGER,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Table: user_achievements
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  achievement_id UUID NOT NULL,
  awarded_by UUID,
  awarded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  tournament_id VARCHAR(100),
  display_priority INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (id),
  CONSTRAINT user_achievements_user_id_achievement_id_tournament_id_key UNIQUE (user_id, achievement_id, tournament_id)
);

-- Table: user_badges
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  season_id UUID,
  progress JSONB DEFAULT '{}'::jsonb,
  progress_percentage INTEGER DEFAULT 100,
  trigger_type VARCHAR(100),
  trigger_id UUID,
  trigger_data JSONB DEFAULT '{}'::jsonb,
  is_featured BOOLEAN DEFAULT false,
  display_order INTEGER,
  PRIMARY KEY (id),
  CONSTRAINT user_badges_user_id_badge_id_key UNIQUE (user_id, badge_id)
);

-- Table: user_blocks
CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  blocked_user_id UUID NOT NULL,
  reason VARCHAR(100),
  notes TEXT,
  blocked_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  hide_from_suggestions BOOLEAN DEFAULT true,
  block_messages BOOLEAN DEFAULT true,
  block_wagers BOOLEAN DEFAULT true,
  PRIMARY KEY (id),
  CONSTRAINT user_blocks_user_id_blocked_user_id_key UNIQUE (user_id, blocked_user_id)
);

-- Table: user_clubhouses
CREATE TABLE IF NOT EXISTS user_clubhouses (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  clubhouse_id UUID NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  first_visit_date DATE,
  last_visit_date DATE,
  total_visits INTEGER DEFAULT 0,
  total_hours_played NUMERIC(10, 2) DEFAULT 0,
  preferred_bay_numbers int4[],
  preferred_time_slots JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT user_clubhouses_user_id_clubhouse_id_key UNIQUE (user_id, clubhouse_id)
);

-- Table: user_settings
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  setting_key VARCHAR(255) NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT user_settings_user_id_setting_key_key UNIQUE (user_id, setting_key)
);

-- =====================================================
-- FOREIGN KEY CONSTRAINTS
-- =====================================================
ALTER TABLE achievement_preferences ADD CONSTRAINT achievement_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE admin_actions ADD CONSTRAINT admin_actions_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE admin_actions ADD CONSTRAINT admin_actions_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE ai_automation_actions ADD CONSTRAINT ai_automation_actions_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES openphone_conversations (id);
ALTER TABLE ai_automation_actions ADD CONSTRAINT ai_automation_actions_feature_key_fkey FOREIGN KEY (feature_key) REFERENCES ai_automation_features (feature_key);
ALTER TABLE ai_automation_response_tracking ADD CONSTRAINT ai_automation_response_tracking_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES openphone_conversations (id);
ALTER TABLE ai_automation_response_tracking ADD CONSTRAINT ai_automation_response_tracking_feature_key_fkey FOREIGN KEY (feature_key) REFERENCES ai_automation_features (feature_key);
ALTER TABLE ai_automation_rules ADD CONSTRAINT ai_automation_rules_feature_id_fkey FOREIGN KEY (feature_id) REFERENCES ai_automation_features (id);
ALTER TABLE ai_automation_usage ADD CONSTRAINT ai_automation_usage_feature_id_fkey FOREIGN KEY (feature_id) REFERENCES ai_automation_features (id);
ALTER TABLE ai_prompt_template_history ADD CONSTRAINT ai_prompt_template_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES users (id);
ALTER TABLE ai_prompt_template_history ADD CONSTRAINT ai_prompt_template_history_template_id_fkey FOREIGN KEY (template_id) REFERENCES ai_prompt_templates (id) ON DELETE CASCADE;
ALTER TABLE ai_prompt_templates ADD CONSTRAINT ai_prompt_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id);
ALTER TABLE ai_prompt_templates ADD CONSTRAINT ai_prompt_templates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users (id);
ALTER TABLE badge_progress ADD CONSTRAINT badge_progress_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES badges (id) ON DELETE CASCADE;
ALTER TABLE badge_rules ADD CONSTRAINT badge_rules_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES badges (id) ON DELETE CASCADE;
ALTER TABLE badges ADD CONSTRAINT badges_season_id_fkey FOREIGN KEY (season_id) REFERENCES seasons (id);
ALTER TABLE booking_participants ADD CONSTRAINT booking_participants_booking_share_id_fkey FOREIGN KEY (booking_share_id) REFERENCES booking_shares (id) ON DELETE CASCADE;
ALTER TABLE booking_participants ADD CONSTRAINT booking_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE booking_rewards ADD CONSTRAINT booking_rewards_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE booking_shares ADD CONSTRAINT booking_shares_event_id_fkey FOREIGN KEY (event_id) REFERENCES events (id);
ALTER TABLE booking_shares ADD CONSTRAINT booking_shares_shared_by_fkey FOREIGN KEY (shared_by) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE booking_shares ADD CONSTRAINT booking_shares_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams (id);
ALTER TABLE cc_transactions ADD CONSTRAINT cc_transactions_season_id_fkey FOREIGN KEY (season_id) REFERENCES seasons (id);
ALTER TABLE challenge_audit ADD CONSTRAINT challenge_audit_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES challenges (id) ON DELETE CASCADE;
ALTER TABLE challenge_disputes ADD CONSTRAINT challenge_disputes_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES challenges (id) ON DELETE CASCADE;
ALTER TABLE challenge_no_shows ADD CONSTRAINT challenge_no_shows_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES challenges (id) ON DELETE CASCADE;
ALTER TABLE challenge_plays ADD CONSTRAINT challenge_plays_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES challenges (id) ON DELETE CASCADE;
ALTER TABLE challenge_results ADD CONSTRAINT challenge_results_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES challenges (id) ON DELETE CASCADE;
ALTER TABLE challenge_winner_selections ADD CONSTRAINT challenge_winner_selections_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES challenges (id) ON DELETE CASCADE;
ALTER TABLE challenge_winner_selections ADD CONSTRAINT challenge_winner_selections_selected_winner_id_fkey FOREIGN KEY (selected_winner_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE challenge_winner_selections ADD CONSTRAINT challenge_winner_selections_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE challenges ADD CONSTRAINT challenges_previous_challenge_id_fkey FOREIGN KEY (previous_challenge_id) REFERENCES challenges (id);
ALTER TABLE challenges ADD CONSTRAINT challenges_season_id_fkey FOREIGN KEY (season_id) REFERENCES seasons (id);
ALTER TABLE challenges ADD CONSTRAINT challenges_settings_catalog_id_fkey FOREIGN KEY (settings_catalog_id) REFERENCES challenge_settings_catalog (id);
ALTER TABLE champion_markers ADD CONSTRAINT champion_markers_event_id_fkey FOREIGN KEY (event_id) REFERENCES events (id);
ALTER TABLE checklist_submissions ADD CONSTRAINT checklist_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE clubhouse_announcements ADD CONSTRAINT clubhouse_announcements_clubhouse_id_fkey FOREIGN KEY (clubhouse_id) REFERENCES clubhouse_locations (id) ON DELETE CASCADE;
ALTER TABLE clubhouse_announcements ADD CONSTRAINT clubhouse_announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id);
ALTER TABLE contact_sync ADD CONSTRAINT contact_sync_matched_user_id_fkey FOREIGN KEY (matched_user_id) REFERENCES users (id);
ALTER TABLE contact_sync ADD CONSTRAINT contact_sync_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE customer_profiles ADD CONSTRAINT customer_profiles_rarest_achievement_fkey FOREIGN KEY (rarest_achievement) REFERENCES achievements (id);
ALTER TABLE event_participants ADD CONSTRAINT event_participants_event_id_fkey FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;
ALTER TABLE event_participants ADD CONSTRAINT event_participants_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams (id);
ALTER TABLE event_participants ADD CONSTRAINT event_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE events ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id);
ALTER TABLE events ADD CONSTRAINT events_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams (id);
ALTER TABLE events ADD CONSTRAINT events_winner_team_id_fkey FOREIGN KEY (winner_team_id) REFERENCES teams (id);
ALTER TABLE events ADD CONSTRAINT events_winner_user_id_fkey FOREIGN KEY (winner_user_id) REFERENCES users (id);
ALTER TABLE friend_activities ADD CONSTRAINT friend_activities_event_id_fkey FOREIGN KEY (event_id) REFERENCES events (id);
ALTER TABLE friend_activities ADD CONSTRAINT friend_activities_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE friend_activities ADD CONSTRAINT friend_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE friend_group_members ADD CONSTRAINT friend_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES friend_groups (id) ON DELETE CASCADE;
ALTER TABLE friend_group_members ADD CONSTRAINT friend_group_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES users (id);
ALTER TABLE friend_group_members ADD CONSTRAINT friend_group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE friend_groups ADD CONSTRAINT friend_groups_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE friend_notification_preferences ADD CONSTRAINT friend_notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE friend_suggestions ADD CONSTRAINT friend_suggestions_suggested_user_id_fkey FOREIGN KEY (suggested_user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE friend_suggestions ADD CONSTRAINT friend_suggestions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE friendships ADD CONSTRAINT friendships_blocked_by_fkey FOREIGN KEY (blocked_by) REFERENCES users (id);
ALTER TABLE friendships ADD CONSTRAINT friendships_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE friendships ADD CONSTRAINT friendships_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE knowledge_extraction_log ADD CONSTRAINT knowledge_extraction_log_knowledge_id_fkey FOREIGN KEY (knowledge_id) REFERENCES knowledge_store (id);
ALTER TABLE knowledge_extraction_log ADD CONSTRAINT knowledge_extraction_log_pattern_id_fkey FOREIGN KEY (pattern_id) REFERENCES knowledge_patterns (id);
ALTER TABLE knowledge_patterns ADD CONSTRAINT knowledge_patterns_current_best_source_fkey FOREIGN KEY (current_best_source) REFERENCES knowledge_store (id);
ALTER TABLE knowledge_store ADD CONSTRAINT knowledge_store_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id);
ALTER TABLE knowledge_store ADD CONSTRAINT knowledge_store_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES knowledge_store (id);
ALTER TABLE message_suggestions ADD CONSTRAINT message_suggestions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users (id);
ALTER TABLE message_suggestions ADD CONSTRAINT message_suggestions_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id);
ALTER TABLE notification_history ADD CONSTRAINT notification_history_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES push_subscriptions (id) ON DELETE SET NULL;
ALTER TABLE notification_history ADD CONSTRAINT notification_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE openphone_conversations ADD CONSTRAINT openphone_conversations_knowledge_id_fkey FOREIGN KEY (knowledge_id) REFERENCES knowledge_store (id);
ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE rank_assignments ADD CONSTRAINT rank_assignments_season_id_fkey FOREIGN KEY (season_id) REFERENCES seasons (id) ON DELETE CASCADE;
ALTER TABLE rank_history ADD CONSTRAINT rank_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE remote_action_history ADD CONSTRAINT remote_action_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE scoreboards ADD CONSTRAINT scoreboards_event_id_fkey FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE;
ALTER TABLE scoreboards ADD CONSTRAINT scoreboards_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams (id);
ALTER TABLE seasonal_cc_earnings ADD CONSTRAINT seasonal_cc_earnings_season_id_fkey FOREIGN KEY (season_id) REFERENCES seasons (id) ON DELETE CASCADE;
ALTER TABLE stakes ADD CONSTRAINT stakes_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES challenges (id) ON DELETE CASCADE;
ALTER TABLE stakes ADD CONSTRAINT stakes_lock_transaction_id_fkey FOREIGN KEY (lock_transaction_id) REFERENCES cc_transactions (id);
ALTER TABLE stakes ADD CONSTRAINT stakes_refund_transaction_id_fkey FOREIGN KEY (refund_transaction_id) REFERENCES cc_transactions (id);
ALTER TABLE team_members ADD CONSTRAINT team_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES users (id);
ALTER TABLE team_members ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE;
ALTER TABLE team_members ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE teams ADD CONSTRAINT teams_captain_id_fkey FOREIGN KEY (captain_id) REFERENCES users (id);
ALTER TABLE teams ADD CONSTRAINT teams_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id);
ALTER TABLE ticket_comments ADD CONSTRAINT ticket_comments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE;
ALTER TABLE usage_logs ADD CONSTRAINT usage_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE user_achievements ADD CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES achievements (id) ON DELETE CASCADE;
ALTER TABLE user_achievements ADD CONSTRAINT user_achievements_awarded_by_fkey FOREIGN KEY (awarded_by) REFERENCES users (id);
ALTER TABLE user_achievements ADD CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE user_badges ADD CONSTRAINT user_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES badges (id) ON DELETE CASCADE;
ALTER TABLE user_badges ADD CONSTRAINT user_badges_season_id_fkey FOREIGN KEY (season_id) REFERENCES seasons (id);
ALTER TABLE user_clubhouses ADD CONSTRAINT user_clubhouses_clubhouse_id_fkey FOREIGN KEY (clubhouse_id) REFERENCES clubhouse_locations (id) ON DELETE CASCADE;
ALTER TABLE user_clubhouses ADD CONSTRAINT user_clubhouses_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

-- =====================================================
-- INDEXES
-- =====================================================

-- Indexes for access_logs
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON public.access_logs USING btree ("createdAt");
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON public.access_logs USING btree (user_id);

-- Indexes for achievements
CREATE INDEX IF NOT EXISTS idx_achievements_auto_award ON public.achievements USING btree (auto_award) WHERE (auto_award = true);
CREATE INDEX IF NOT EXISTS idx_achievements_code ON public.achievements USING btree (code);

-- Indexes for admin_actions
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id ON public.admin_actions USING btree (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON public.admin_actions USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target_user ON public.admin_actions USING btree (target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_type ON public.admin_actions USING btree (action_type);

-- Indexes for ai_automation_features
CREATE INDEX IF NOT EXISTS idx_ai_features_category ON public.ai_automation_features USING btree (category);
CREATE INDEX IF NOT EXISTS idx_ai_features_enabled ON public.ai_automation_features USING btree (enabled);

-- Indexes for ai_automation_rules
CREATE INDEX IF NOT EXISTS idx_ai_rules_feature ON public.ai_automation_rules USING btree (feature_id);

-- Indexes for ai_automation_usage
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON public.ai_automation_usage USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON public.ai_automation_usage USING btree (feature_id);

-- Indexes for ai_prompt_template_history
CREATE INDEX IF NOT EXISTS idx_ai_prompt_template_history_template ON public.ai_prompt_template_history USING btree (template_id);

-- Indexes for ai_prompt_templates
CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_category ON public.ai_prompt_templates USING btree (category);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_name ON public.ai_prompt_templates USING btree (name);

-- Indexes for assistant_knowledge
CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_assistant_id ON public.assistant_knowledge USING btree (assistant_id);

-- Indexes for auth_logs
CREATE INDEX IF NOT EXISTS idx_auth_logs_action ON public.auth_logs USING btree (action);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON public.auth_logs USING btree ("createdAt");
CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id ON public.auth_logs USING btree (user_id);

-- Indexes for badge_progress
CREATE INDEX IF NOT EXISTS idx_badge_progress_badge ON public.badge_progress USING btree (badge_id);
CREATE INDEX IF NOT EXISTS idx_badge_progress_user ON public.badge_progress USING btree (user_id, is_complete);

-- Indexes for badge_rules
CREATE INDEX IF NOT EXISTS idx_badge_rules_active ON public.badge_rules USING btree (trigger_event, is_active);

-- Indexes for badges
CREATE INDEX IF NOT EXISTS idx_badges_active ON public.badges USING btree (is_active, category);
CREATE INDEX IF NOT EXISTS idx_badges_seasonal ON public.badges USING btree (season_id) WHERE (is_seasonal = true);

-- Indexes for booking_participants
CREATE INDEX IF NOT EXISTS idx_booking_participants_user ON public.booking_participants USING btree (user_id);

-- Indexes for booking_rewards
CREATE INDEX IF NOT EXISTS idx_booking_rewards_hubspot ON public.booking_rewards USING btree (hubspot_deal_id);
CREATE INDEX IF NOT EXISTS idx_booking_rewards_status_date ON public.booking_rewards USING btree (status, reward_date);
CREATE INDEX IF NOT EXISTS idx_booking_rewards_user ON public.booking_rewards USING btree (user_id);

-- Indexes for booking_shares
CREATE INDEX IF NOT EXISTS idx_booking_shares_date ON public.booking_shares USING btree (booking_date);
CREATE INDEX IF NOT EXISTS idx_booking_shares_event ON public.booking_shares USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_booking_shares_shared_by ON public.booking_shares USING btree (shared_by);

-- Indexes for bookings
CREATE INDEX IF NOT EXISTS idx_bookings_simulator_id ON public.bookings USING btree (simulator_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON public.bookings USING btree (start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings USING btree (status);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings USING btree (user_id);

-- Indexes for cc_transactions
CREATE INDEX IF NOT EXISTS idx_cc_transactions_challenge ON public.cc_transactions USING btree (challenge_id) WHERE (challenge_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_cc_transactions_type ON public.cc_transactions USING btree (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_transactions_user ON public.cc_transactions USING btree (user_id, created_at DESC);

-- Indexes for challenge_audit
CREATE INDEX IF NOT EXISTS idx_audit_challenge ON public.challenge_audit USING btree (challenge_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event ON public.challenge_audit USING btree (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.challenge_audit USING btree (user_id, created_at DESC) WHERE (user_id IS NOT NULL);

-- Indexes for challenge_disputes
CREATE INDEX IF NOT EXISTS idx_disputes_challenge ON public.challenge_disputes USING btree (challenge_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.challenge_disputes USING btree (status, priority, filed_at);
CREATE INDEX IF NOT EXISTS idx_disputes_user ON public.challenge_disputes USING btree (filed_by);

-- Indexes for challenge_no_shows
CREATE INDEX IF NOT EXISTS idx_no_shows_challenge ON public.challenge_no_shows USING btree (challenge_id);
CREATE INDEX IF NOT EXISTS idx_no_shows_user ON public.challenge_no_shows USING btree (user_id, created_at DESC);

-- Indexes for challenge_plays
CREATE INDEX IF NOT EXISTS idx_plays_challenge ON public.challenge_plays USING btree (challenge_id);
CREATE INDEX IF NOT EXISTS idx_plays_trackman ON public.challenge_plays USING btree (trackman_round_id) WHERE (trackman_round_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_plays_user ON public.challenge_plays USING btree (user_id, played_at DESC);

-- Indexes for challenge_results
CREATE INDEX IF NOT EXISTS idx_results_challenge ON public.challenge_results USING btree (challenge_id);
CREATE INDEX IF NOT EXISTS idx_results_loser ON public.challenge_results USING btree (loser_user_id, resolved_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_winner ON public.challenge_results USING btree (winner_user_id, resolved_at DESC);

-- Indexes for challenge_settings_catalog
CREATE INDEX IF NOT EXISTS idx_challenge_settings_active ON public.challenge_settings_catalog USING btree (is_active, category);
CREATE INDEX IF NOT EXISTS idx_challenge_settings_popular ON public.challenge_settings_catalog USING btree (times_used DESC);

-- Indexes for challenge_winner_selections
CREATE INDEX IF NOT EXISTS idx_winner_selections_challenge ON public.challenge_winner_selections USING btree (challenge_id);
CREATE INDEX IF NOT EXISTS idx_winner_selections_timestamp ON public.challenge_winner_selections USING btree (selected_at DESC);
CREATE INDEX IF NOT EXISTS idx_winner_selections_user ON public.challenge_winner_selections USING btree (user_id);

-- Indexes for challenges
CREATE INDEX IF NOT EXISTS idx_challenges_acceptor ON public.challenges USING btree (acceptor_id, status);
CREATE INDEX IF NOT EXISTS idx_challenges_creator ON public.challenges USING btree (creator_id, status);
CREATE INDEX IF NOT EXISTS idx_challenges_expires ON public.challenges USING btree (expires_at) WHERE (status = ANY (ARRAY['accepted'::challenge_status, 'active'::challenge_status, 'awaiting_sync'::challenge_status]));
CREATE INDEX IF NOT EXISTS idx_challenges_season ON public.challenges USING btree (season_id, resolved_at);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges USING btree (status, expires_at);

-- Indexes for champion_markers
CREATE INDEX IF NOT EXISTS idx_champion_markers_user ON public.champion_markers USING btree (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_champion_markers_year ON public.champion_markers USING btree (year, event_type);

-- Indexes for checklist_submissions
CREATE INDEX IF NOT EXISTS idx_checklist_submissions_category ON public.checklist_submissions USING btree (category);
CREATE INDEX IF NOT EXISTS idx_checklist_submissions_completion_time ON public.checklist_submissions USING btree (completion_time DESC);
CREATE INDEX IF NOT EXISTS idx_checklist_submissions_location ON public.checklist_submissions USING btree (location);
CREATE INDEX IF NOT EXISTS idx_checklist_submissions_type ON public.checklist_submissions USING btree (type);
CREATE INDEX IF NOT EXISTS idx_checklist_submissions_user_id ON public.checklist_submissions USING btree (user_id);

-- Indexes for clubhouse_announcements
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.clubhouse_announcements USING btree (is_active, start_date, end_date);

-- Indexes for clubhouse_locations
CREATE INDEX IF NOT EXISTS idx_clubhouse_locations_active ON public.clubhouse_locations USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_clubhouse_locations_city ON public.clubhouse_locations USING btree (city);

-- Indexes for contact_sync
CREATE INDEX IF NOT EXISTS idx_contact_hash ON public.contact_sync USING btree (contact_hash);
CREATE INDEX IF NOT EXISTS idx_matched_user ON public.contact_sync USING btree (matched_user_id);

-- Indexes for conversation_sessions
CREATE INDEX IF NOT EXISTS idx_sessions_active ON public.conversation_sessions USING btree (active);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON public.conversation_sessions USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.conversation_sessions USING btree (user_id);

-- Indexes for customer_interactions
CREATE INDEX IF NOT EXISTS idx_customer_interactions_created_at ON public.customer_interactions USING btree ("createdAt");
CREATE INDEX IF NOT EXISTS idx_customer_interactions_user_id ON public.customer_interactions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_session ON public.customer_interactions USING btree (session_id);

-- Indexes for customer_profiles
CREATE INDEX IF NOT EXISTS idx_customer_profiles_user_id ON public.customer_profiles USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_visibility ON public.customer_profiles USING btree (profile_visibility);

-- Indexes for door_access_log
CREATE INDEX IF NOT EXISTS idx_door_access_log_created_at ON public.door_access_log USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_door_access_log_location ON public.door_access_log USING btree (location);
CREATE INDEX IF NOT EXISTS idx_door_access_log_user_id ON public.door_access_log USING btree (user_id);

-- Indexes for event_participants
CREATE INDEX IF NOT EXISTS idx_event_participants_event_id ON public.event_participants USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user_id ON public.event_participants USING btree (user_id);

-- Indexes for events
CREATE INDEX IF NOT EXISTS idx_events_created_by ON public.events USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON public.events USING btree (start_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events USING btree (status);
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events USING btree (event_type);

-- Indexes for extracted_knowledge
CREATE INDEX IF NOT EXISTS idx_extracted_knowledge_applied ON public.extracted_knowledge USING btree (applied_to_sop);
CREATE INDEX IF NOT EXISTS idx_extracted_knowledge_category ON public.extracted_knowledge USING btree (category);

-- Indexes for feedback
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback USING btree ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_is_useful ON public.feedback USING btree (is_useful);
CREATE INDEX IF NOT EXISTS idx_feedback_slack_thread ON public.feedback USING btree (slack_thread_ts);
CREATE INDEX IF NOT EXISTS idx_feedback_source ON public.feedback USING btree (feedback_source);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback USING btree (user_id);

-- Indexes for friend_activities
CREATE INDEX IF NOT EXISTS idx_friend_activity_users ON public.friend_activities USING btree (user_id, friend_id, created_at DESC);

-- Indexes for friend_group_members
CREATE INDEX IF NOT EXISTS idx_friend_group_members_group ON public.friend_group_members USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_friend_group_members_user ON public.friend_group_members USING btree (user_id);

-- Indexes for friend_groups
CREATE INDEX IF NOT EXISTS idx_friend_groups_owner ON public.friend_groups USING btree (owner_id);

-- Indexes for friend_invitations
CREATE INDEX IF NOT EXISTS idx_friend_invitations_code ON public.friend_invitations USING btree (invitation_code);
CREATE INDEX IF NOT EXISTS idx_friend_invitations_email ON public.friend_invitations USING btree (invitee_email) WHERE (invitee_email IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_friend_invitations_inviter ON public.friend_invitations USING btree (inviter_id);
CREATE INDEX IF NOT EXISTS idx_friend_invitations_phone ON public.friend_invitations USING btree (invitee_phone) WHERE (invitee_phone IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_friend_invitations_status ON public.friend_invitations USING btree (status);

-- Indexes for friend_suggestions
CREATE INDEX IF NOT EXISTS idx_friend_suggestions_mutual ON public.friend_suggestions USING btree (user_id, mutual_friends_count DESC);
CREATE INDEX IF NOT EXISTS idx_friend_suggestions_user ON public.friend_suggestions USING btree (user_id, dismissed, relevance_score DESC);

-- Indexes for friendships
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON public.friendships USING btree (friend_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON public.friendships USING btree (status);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON public.friendships USING btree (user_id, status);

-- Indexes for hubspot_cache
CREATE INDEX IF NOT EXISTS idx_hubspot_cache_updated ON public.hubspot_cache USING btree (updated_at);

-- Indexes for knowledge_audit_log
CREATE INDEX IF NOT EXISTS idx_knowledge_audit_category ON public.knowledge_audit_log USING btree (category);
CREATE INDEX IF NOT EXISTS idx_knowledge_audit_target ON public.knowledge_audit_log USING btree (assistant_target);
CREATE INDEX IF NOT EXISTS idx_knowledge_audit_timestamp ON public.knowledge_audit_log USING btree ("timestamp" DESC);

-- Indexes for knowledge_base
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON public.knowledge_base USING btree (category);
CREATE INDEX IF NOT EXISTS idx_knowledge_symptoms ON public.knowledge_base USING gin (symptoms);

-- Indexes for knowledge_captures
CREATE INDEX IF NOT EXISTS idx_knowledge_captures_assistant ON public.knowledge_captures USING btree (assistant);
CREATE INDEX IF NOT EXISTS idx_knowledge_captures_confidence ON public.knowledge_captures USING btree (confidence DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_captures_created_at ON public.knowledge_captures USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_captures_source ON public.knowledge_captures USING btree (source);

-- Indexes for knowledge_extraction_log
CREATE INDEX IF NOT EXISTS idx_extraction_action ON public.knowledge_extraction_log USING btree (action_taken);
CREATE INDEX IF NOT EXISTS idx_extraction_conversation ON public.knowledge_extraction_log USING btree (conversation_id);
CREATE INDEX IF NOT EXISTS idx_extraction_created ON public.knowledge_extraction_log USING btree (created_at DESC);

-- Indexes for knowledge_patterns
CREATE INDEX IF NOT EXISTS idx_patterns_last_seen ON public.knowledge_patterns USING btree (last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_patterns_occurrence ON public.knowledge_patterns USING btree (occurrence_count DESC);
CREATE INDEX IF NOT EXISTS idx_patterns_pattern ON public.knowledge_patterns USING btree (pattern);

-- Indexes for knowledge_store
CREATE INDEX IF NOT EXISTS idx_knowledge_confidence ON public.knowledge_store USING btree (confidence DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_expires ON public.knowledge_store USING btree (expires_at) WHERE (expires_at IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_knowledge_key_pattern ON public.knowledge_store USING btree (key text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_search ON public.knowledge_store USING gin (search_vector);
CREATE INDEX IF NOT EXISTS idx_knowledge_updated ON public.knowledge_store USING btree (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_usage ON public.knowledge_store USING btree (usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_value ON public.knowledge_store USING gin (value);
CREATE INDEX IF NOT EXISTS idx_knowledge_verification ON public.knowledge_store USING btree (verification_status);

-- Indexes for learning_metrics
CREATE INDEX IF NOT EXISTS idx_learning_metrics_created_at ON public.learning_metrics USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_metrics_type ON public.learning_metrics USING btree (metric_type);

-- Indexes for message_suggestions
CREATE INDEX IF NOT EXISTS idx_message_suggestions_conversation ON public.message_suggestions USING btree (conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_suggestions_phone_hash ON public.message_suggestions USING btree (phone_number_hash);

-- Indexes for notification_history
CREATE INDEX IF NOT EXISTS idx_notification_history_status ON public.notification_history USING btree (status, sent_at);
CREATE INDEX IF NOT EXISTS idx_notification_history_user_date ON public.notification_history USING btree (user_id, sent_at);

-- Indexes for openphone_conversations
CREATE INDEX IF NOT EXISTS idx_conversations_knowledge_extracted ON public.openphone_conversations USING btree (knowledge_extracted) WHERE (knowledge_extracted = false);
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_processed ON public.openphone_conversations USING btree (processed);
CREATE INDEX IF NOT EXISTS idx_openphone_phone_number ON public.openphone_conversations USING btree (phone_number);
CREATE INDEX IF NOT EXISTS idx_openphone_updated_at ON public.openphone_conversations USING btree (updated_at DESC);

-- Indexes for push_subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions USING btree (endpoint);
CREATE INDEX IF NOT EXISTS idx_push_subs_user_active ON public.push_subscriptions USING btree (user_id, is_active);

-- Indexes for rank_assignments
CREATE INDEX IF NOT EXISTS idx_rank_assignments_percentile ON public.rank_assignments USING btree (season_id, percentile);
CREATE INDEX IF NOT EXISTS idx_rank_assignments_season ON public.rank_assignments USING btree (season_id, rank_tier);
CREATE INDEX IF NOT EXISTS idx_rank_assignments_user ON public.rank_assignments USING btree (user_id, season_id);

-- Indexes for rank_history
CREATE INDEX IF NOT EXISTS idx_rank_history_changed_at ON public.rank_history USING btree (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_rank_history_user_id ON public.rank_history USING btree (user_id);

-- Indexes for request_logs
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON public.request_logs USING btree ("createdAt");
CREATE INDEX IF NOT EXISTS idx_request_logs_path ON public.request_logs USING btree (path);

-- Indexes for scoreboards
CREATE INDEX IF NOT EXISTS idx_scoreboards_event ON public.scoreboards USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_scoreboards_season ON public.scoreboards USING btree (season);
CREATE INDEX IF NOT EXISTS idx_scoreboards_team ON public.scoreboards USING btree (team_id);

-- Indexes for seasonal_cc_earnings
CREATE INDEX IF NOT EXISTS idx_seasonal_cc_earnings_leaderboard ON public.seasonal_cc_earnings USING btree (season_id, cc_net DESC);
CREATE INDEX IF NOT EXISTS idx_seasonal_cc_earnings_user ON public.seasonal_cc_earnings USING btree (user_id, season_id);

-- Indexes for seasons
CREATE INDEX IF NOT EXISTS idx_seasons_dates ON public.seasons USING btree (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_seasons_is_active ON public.seasons USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_seasons_status ON public.seasons USING btree (status, start_date);

-- Indexes for slack_messages
CREATE INDEX IF NOT EXISTS idx_slack_messages_created_at ON public.slack_messages USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_slack_messages_request_id ON public.slack_messages USING btree (request_id);
CREATE INDEX IF NOT EXISTS idx_slack_messages_thread_ts ON public.slack_messages USING btree (slack_thread_ts);
CREATE INDEX IF NOT EXISTS idx_slack_messages_user_id ON public.slack_messages USING btree (user_id);

-- Indexes for slack_replies
CREATE INDEX IF NOT EXISTS idx_slack_replies_created_at ON public.slack_replies USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_slack_replies_thread_ts ON public.slack_replies USING btree (thread_ts);
CREATE INDEX IF NOT EXISTS idx_slack_replies_timestamp ON public.slack_replies USING btree ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_slack_replies_user_id ON public.slack_replies USING btree (user_id);

-- Indexes for slack_thread_resolutions
CREATE INDEX IF NOT EXISTS idx_slack_thread_resolutions_resolved_at ON public.slack_thread_resolutions USING btree (resolved_at DESC);

-- Indexes for sop_drafts
CREATE INDEX IF NOT EXISTS idx_sop_drafts_assistant ON public.sop_drafts USING btree (assistant);
CREATE INDEX IF NOT EXISTS idx_sop_drafts_status ON public.sop_drafts USING btree (status);

-- Indexes for sop_embeddings
CREATE INDEX IF NOT EXISTS idx_sop_embeddings_assistant ON public.sop_embeddings USING btree (assistant);

-- Indexes for sop_update_log
CREATE INDEX IF NOT EXISTS idx_sop_update_log_applied_at ON public.sop_update_log USING btree (applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_sop_update_log_document_id ON public.sop_update_log USING btree (document_id);

-- Indexes for sop_update_queue
CREATE INDEX IF NOT EXISTS idx_sop_update_queue_confidence ON public.sop_update_queue USING btree (confidence DESC);
CREATE INDEX IF NOT EXISTS idx_sop_update_queue_status ON public.sop_update_queue USING btree (status);

-- Indexes for stakes
CREATE INDEX IF NOT EXISTS idx_stakes_challenge ON public.stakes USING btree (challenge_id);
CREATE INDEX IF NOT EXISTS idx_stakes_user ON public.stakes USING btree (user_id, is_locked);

-- Indexes for system_settings
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON public.system_settings USING btree (category);

-- Indexes for team_members
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members USING btree (team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members USING btree (user_id);

-- Indexes for teams
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON public.teams USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_teams_type ON public.teams USING btree (team_type);

-- Indexes for ticket_comments
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON public.ticket_comments USING btree (ticket_id);

-- Indexes for tickets
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_id ON public.tickets USING btree (assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON public.tickets USING btree (category);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets USING btree ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by_id ON public.tickets USING btree (created_by_id);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON public.tickets USING btree (priority);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets USING btree (status);

-- Indexes for user_achievements
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON public.user_achievements USING btree (achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_awarded_at ON public.user_achievements USING btree (awarded_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_achievements_featured ON public.user_achievements USING btree (user_id, is_featured) WHERE (is_featured = true);
CREATE INDEX IF NOT EXISTS idx_user_achievements_tournament ON public.user_achievements USING btree (tournament_id) WHERE (tournament_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON public.user_achievements USING btree (user_id);

-- Indexes for user_badges
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON public.user_badges USING btree (badge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_featured ON public.user_badges USING btree (user_id, is_featured) WHERE (is_featured = true);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges USING btree (user_id, earned_at DESC);

-- Indexes for user_blocks
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks USING btree (blocked_user_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_user ON public.user_blocks USING btree (user_id);

-- Indexes for user_clubhouses
CREATE INDEX IF NOT EXISTS idx_user_clubhouses_primary ON public.user_clubhouses USING btree (user_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_user_clubhouses_user ON public.user_clubhouses USING btree (user_id);

-- Indexes for user_settings
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings USING btree (user_id);

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users USING btree (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users USING btree (role);

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Default badges
INSERT INTO badges (id, key, name, description, category, tier, icon_emoji, display_order, requirements, is_active, is_secret, times_awarded, is_seasonal, created_at, updated_at) VALUES ('7809daff-7eb3-406c-a4cd-7952bb382271', 'bay_rat', 'Bay Rat', '100+ hours in a quarter. Consider vitamin D.', 'oddities', 'rare', '🐀', 0, '{"type":"hours_played","value":100,"period":"quarter"}'::jsonb, true, false, 0, false, '"2025-08-19T16:12:19.388Z"'::jsonb, '"2025-08-19T16:12:19.388Z"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO badges (id, key, name, description, category, tier, icon_emoji, display_order, requirements, is_active, is_secret, times_awarded, is_seasonal, created_at, updated_at) VALUES ('2a8efaf8-5a24-486f-9789-e8f380d48157', 'collector', 'Collector', 'Defeated 10 unique opponents. Building a resume.', 'wins', 'uncommon', '📊', 0, '{"type":"unique_wins","value":10}'::jsonb, true, false, 0, false, '"2025-08-19T16:12:19.388Z"'::jsonb, '"2025-08-19T16:12:19.388Z"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO badges (id, key, name, description, category, tier, icon_emoji, display_order, requirements, is_active, is_secret, times_awarded, is_seasonal, created_at, updated_at) VALUES ('7ed6a79e-278e-4156-a7d7-ebc9768085cc', 'comeback_kid', 'Comeback Kid', 'Won after being down 5+ strokes. Never give up.', 'oddities', 'rare', '🔄', 0, '{"type":"comeback_win","deficit":5}'::jsonb, true, false, 0, false, '"2025-08-19T16:12:19.388Z"'::jsonb, '"2025-08-19T16:12:19.388Z"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO badges (id, key, name, description, category, tier, icon_emoji, display_order, requirements, is_active, is_secret, times_awarded, is_seasonal, created_at, updated_at) VALUES ('9d4d7275-ca58-4ab2-9114-43f0681938f0', 'cooldown_needed', 'Cooldown Needed', '5 losses in a row. It happens.', 'streaks', 'common', '❄️', 0, '{"type":"loss_streak","value":5}'::jsonb, true, false, 0, false, '"2025-08-19T16:12:19.388Z"'::jsonb, '"2025-08-19T16:12:19.388Z"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO badges (id, key, name, description, category, tier, icon_emoji, display_order, requirements, is_active, is_secret, times_awarded, is_seasonal, created_at, updated_at) VALUES ('ad2f3e54-d071-4503-a6a8-fc9d6d96ba91', 'ghosted', 'Ghosted', 'Accepted then failed to play. Commitment issues.', 'oddities', 'common', '👻', 0, '{"type":"no_show","value":1}'::jsonb, true, false, 0, false, '"2025-08-19T16:12:19.388Z"'::jsonb, '"2025-08-19T16:12:19.388Z"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO badges (id, key, name, description, category, tier, icon_emoji, display_order, requirements, is_active, is_secret, times_awarded, is_seasonal, created_at, updated_at) VALUES ('ffafa5b8-5210-4e21-8737-f242917a842b', 'giant_killer', 'Giant Killer', 'Beat 3 higher-rank players in a season. David approves.', 'wins', 'rare', '⚔️', 0, '{"type":"uprank_wins","value":3,"period":"season"}'::jsonb, true, false, 0, false, '"2025-08-19T16:12:19.388Z"'::jsonb, '"2025-08-19T16:12:19.388Z"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO badges (id, key, name, description, category, tier, icon_emoji, display_order, requirements, is_active, is_secret, times_awarded, is_seasonal, created_at, updated_at) VALUES ('7994c658-a68b-4c30-8bf2-fff798377c17', 'grudge_match', 'Grudge Match', 'Played same opponent 5 times. Get a room.', 'oddities', 'common', '🥊', 0, '{"type":"repeat_opponent","value":5}'::jsonb, true, false, 0, false, '"2025-08-19T16:12:19.388Z"'::jsonb, '"2025-08-19T16:12:19.388Z"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO badges (id, key, name, description, category, tier, icon_emoji, display_order, requirements, is_active, is_secret, times_awarded, is_seasonal, created_at, updated_at) VALUES ('e0346a9d-03c9-49c2-aae5-1126e0e1c655', 'hot_hand', 'Hot Hand', '5 wins in a row. Someone call the fire department.', 'streaks', 'uncommon', '🔥', 0, '{"type":"win_streak","value":5}'::jsonb, true, false, 0, false, '"2025-08-19T16:12:19.388Z"'::jsonb, '"2025-08-19T16:12:19.388Z"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO badges (id, key, name, description, category, tier, icon_emoji, display_order, requirements, is_active, is_secret, times_awarded, is_seasonal, created_at, updated_at) VALUES ('6d8ab1c8-2907-409c-81e5-7ed3ee5582a8', 'morning_glory', 'Morning Glory', 'Completed 5 challenges before 8am. Psychopath.', 'oddities', 'uncommon', '🌅', 0, '{"type":"early_plays","value":5,"before_hour":8}'::jsonb, true, false, 0, false, '"2025-08-19T16:12:19.388Z"'::jsonb, '"2025-08-19T16:12:19.388Z"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO badges (id, key, name, description, category, tier, icon_emoji, display_order, requirements, is_active, is_secret, times_awarded, is_seasonal, created_at, updated_at) VALUES ('6e17aba7-101e-4b7e-9f56-f055220a26e8', 'night_owl', 'Night Owl', 'Completed 5 challenges after 10pm. Sleep is overrated.', 'oddities', 'common', '🦉', 0, '{"type":"late_plays","value":5,"after_hour":22}'::jsonb, true, false, 0, false, '"2025-08-19T16:12:19.388Z"'::jsonb, '"2025-08-19T16:12:19.388Z"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO badges (id, key, name, description, category, tier, icon_emoji, display_order, requirements, is_active, is_secret, times_awarded, is_seasonal, created_at, updated_at) VALUES ('314aad14-3d9e-4482-9ead-8409f29ac8ab', 'perfectionist', 'Perfectionist', 'Shot under par in 10 challenges. Show off.', 'oddities', 'rare', '✨', 0, '{"type":"under_par_rounds","value":10}'::jsonb, true, false, 0, false, '"2025-08-19T16:12:19.388Z"'::jsonb, '"2025-08-19T16:12:19.388Z"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO badges (id, key, name, description, category, tier, icon_emoji, display_order, requirements, is_active, is_secret, times_awarded, is_seasonal, created_at, updated_at) VALUES ('53aefae6-14f5-40f5-ade6-1fe53920fa11', 'relentless', 'Relentless', '25 challenges in a season. Touch grass occasionally.', 'challenges', 'uncommon', '⚡', 0, '{"type":"challenge_count","value":25,"period":"season"}'::jsonb, true, false, 0, false, '"2025-08-19T16:12:19.388Z"'::jsonb, '"2025-08-19T16:12:19.388Z"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO badges (id, key, name, description, category, tier, icon_emoji, display_order, requirements, is_active, is_secret, times_awarded, is_seasonal, created_at, updated_at) VALUES ('3a4fcb01-8adb-40a1-a7f2-e506986e4a80', 'risk_taker', 'Risk Taker', 'Wagered 1000+ CC in a single challenge. Big money, no whammies.', 'oddities', 'epic', '🎰', 0, '{"type":"high_wager","value":1000}'::jsonb, true, false, 0, false, '"2025-08-19T16:12:19.388Z"'::jsonb, '"2025-08-19T16:12:19.388Z"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO badges (id, key, name, description, category, tier, icon_emoji, display_order, requirements, is_active, is_secret, times_awarded, is_seasonal, created_at, updated_at) VALUES ('1d9ca249-0805-42b7-8f7e-8b056beb4258', 'serial_challenger', 'Serial Challenger', 'Created 10 challenges. Someone needs a hobby.', 'challenges', 'common', '🎯', 0, '{"type":"challenge_count","value":10,"action":"created"}'::jsonb, true, false, 0, false, '"2025-08-19T16:12:19.388Z"'::jsonb, '"2025-08-19T16:12:19.388Z"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO badges (id, key, name, description, category, tier, icon_emoji, display_order, requirements, is_active, is_secret, times_awarded, is_seasonal, created_at, updated_at) VALUES ('d4d70e6d-15ef-4cec-a132-bbb674b9dd60', 'sudden_death', 'Sudden Death', 'Won 3 challenges by 1 stroke. Living dangerously.', 'oddities', 'uncommon', '💀', 0, '{"type":"close_wins","value":3,"margin":1}'::jsonb, true, false, 0, false, '"2025-08-19T16:12:19.388Z"'::jsonb, '"2025-08-19T16:12:19.388Z"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO badges (id, key, name, description, category, tier, icon_emoji, display_order, requirements, is_active, is_secret, times_awarded, is_seasonal, created_at, updated_at) VALUES ('64308885-8fdd-43cb-b850-52818a4dba7e', 'terms_and_conditions', 'Terms and Conditions', 'Created 5 distinct rule sets. Lawyer up.', 'challenges', 'uncommon', '📋', 0, '{"type":"unique_settings","value":5}'::jsonb, true, false, 0, false, '"2025-08-19T16:12:19.388Z"'::jsonb, '"2025-08-19T16:12:19.388Z"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO badges (id, key, name, description, category, tier, icon_emoji, display_order, requirements, is_active, is_secret, times_awarded, is_seasonal, created_at, updated_at) VALUES ('379a7cde-7623-482b-8156-a8ccdd629b92', 'the_tax_man', 'The Tax Man', 'Most CC won in a season. Collecting dues.', 'wins', 'epic', '💰', 0, '{"type":"season_leader","metric":"cc_won"}'::jsonb, true, false, 0, false, '"2025-08-19T16:12:19.388Z"'::jsonb, '"2025-08-19T16:12:19.388Z"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO badges (id, key, name, description, category, tier, icon_emoji, display_order, requirements, is_active, is_secret, times_awarded, is_seasonal, created_at, updated_at) VALUES ('e08617ac-394c-46f0-9d24-c29e0dd703bb', 'untouchable', 'Untouchable', 'Won 10 challenges without opponent scoring under 80. Dominant.', 'oddities', 'epic', '🛡️', 0, '{"type":"dominant_wins","value":10,"opponent_min_score":80}'::jsonb, true, false, 0, false, '"2025-08-19T16:12:19.388Z"'::jsonb, '"2025-08-19T16:12:19.388Z"'::jsonb) ON CONFLICT (key) DO NOTHING;

-- Default achievements
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('0de5c167-bb70-4d5f-9435-9b0c945e3393', 'sportsmanship', 'Sportsmanship Award', 'Exemplary conduct and fair play', '🤝', 200, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('0df70cdf-f72f-4a66-a7dc-7735eff3c2c0', 'sharpshooter', 'Sharpshooter', 'Achieved 75% win rate (min 20 games)', '🎯', 350, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('1c7d17d1-55fa-43d2-9407-6aa5a912bedd', 'win_streak_10', 'Unstoppable', 'Won 10 challenges in a row', '💥', 300, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('1fe1cd81-5be6-4dcb-a7b3-35da3ac20ffc', 'night_owl', 'Night Owl', 'Won a challenge after midnight', '🦉', 50, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('214ac0a6-0bcb-4430-9a82-60a35c7f9d3a', 'comeback_kid', 'Comeback Kid', 'Won after being down by 5+ strokes', '📈', 150, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('242474ce-806d-4b6f-8028-e2b4883e0994', 'centurion', 'Centurion', 'Played 100 rounds', '💯', 200, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('285c63cc-4b19-4ad0-a7dd-800f326bb022', 'tournament_participant', 'Tournament Participant', 'Participated in a tournament', '🎯', 50, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('2d44d2f0-4655-4da8-80fd-8592b8ddc3e8', 'longest_drive', 'Longest Drive', 'Won the longest drive competition', '💪', 250, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('2f713828-b666-4a69-8ac8-3ed394dd4f7b', 'summer_champion', 'Summer Champion', 'Won the summer season championship', '☀️', 600, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('3806b550-aba4-420b-8f68-eb4ec77ecc8c', 'challenge_master', 'Challenge Master', 'Played 100 challenges', '🏅', 250, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('4fcb7073-4c60-40c8-85a6-cae7f58d4169', 'fall_champion', 'Fall Champion', 'Won the fall season championship', '🍂', 600, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('569620c1-0486-4ded-ab25-792f2cde33e4', 'rising_star', 'Rising Star', 'Most improved player', '💫', 300, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('598986ad-3e20-4c75-b504-90bfad920592', 'weekend_warrior', 'Weekend Warrior', 'Won 10 challenges on weekends', '⚔️', 100, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('61c0f1d8-6839-435d-8b5d-7033e8605dd2', 'spring_champion', 'Spring Champion', 'Won the spring season championship', '🌸', 600, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('6276e92b-d7f4-4900-880e-3816574ec667', 'perfect_round', 'Perfect Round', 'Shot under par in a round', '⛳', 300, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('64985893-689e-44f5-93b2-0657ca27e49e', 'grand_slam', 'Grand Slam', 'Won all major tournaments in a year', '👑', 1500, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('6597cc60-f391-4e88-b6c2-2d6e0b3dccde', 'closest_to_pin', 'Closest to Pin', 'Won the closest to pin competition', '🎯', 150, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('788c39a1-3bd2-4d00-9b01-37018d42eed2', 'challenge_veteran', 'Challenge Veteran', 'Played 50 challenges', '🎯', 100, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('82116ec7-5f5b-4ad5-8052-8b227722eee7', 'tournament_runner_up', 'Tournament Runner-Up', 'Won 2nd place in a tournament', '🥈', 300, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('83e50c8d-6798-4024-bc5b-cf5edc63b1da', 'tournament_bronze', 'Tournament Bronze', 'Won 3rd place in a tournament', '🥉', 200, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('88f814f7-d239-42eb-987e-b94a0db530ab', 'win_streak_5', 'Hot Streak', 'Won 5 challenges in a row', '🔥', 150, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('8fcdffee-92c3-4c6e-b5b6-7a64aa64de7e', 'friendly_rivalry', 'Friendly Rivalry', 'Played 10+ challenges with same friend', '🤜', 50, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('9412837e-44f0-4711-b934-0ede50a95e88', 'tournament_champion', 'Tournament Champion', 'Won 1st place in a tournament', '🏆', 500, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('b64edcda-a206-4931-93db-7b44ea0e38c9', 'first_challenge', 'First Challenge', 'Completed your first challenge', '🎮', 25, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('bab0c90a-83a7-4897-a93a-c442bf48990e', 'birdie_machine', 'Birdie Machine', 'Most birdies in a tournament', '🐦', 200, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('c8a7d9b5-2902-45b1-9ad6-6d4c074ada52', 'david_goliath', 'David vs Goliath', 'Beat a player 3+ ranks above you', '🗿', 300, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('d4728a10-1645-441b-87a5-e096e244e1a8', 'early_bird', 'Early Bird', 'Won a challenge before 7am', '🌅', 50, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('d57fc0e9-847a-42f7-a7be-a9abf9495043', 'season_mvp', 'Season MVP', 'Best overall performance in a season', '⭐', 400, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('d6f2a873-f23a-4870-a8e1-11918f5d2edc', 'club_legend', 'Club Legend', 'Lifetime achievement award', '🌟', 2000, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('d9e4ccc8-37e9-4aed-b13d-cfd9c9ad1c72', 'winter_champion', 'Winter Champion', 'Won the winter season championship', '❄️', 600, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('dbf8f7ad-0cfe-4e67-a618-a7943111510a', 'king_of_the_hill', 'King of the Hill', 'Held #1 rank for 30+ days', '👑', 500, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('e3fd75c3-5ca6-4e8e-a35e-f595035a5ec9', 'hole_in_one', 'Hole in One', 'Achieved a hole-in-one in tournament play', '⛳', 1000, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('e6c65b8c-a17b-4892-82e2-3765c82a3f08', 'eagle_club', 'Eagle Club', 'Scored an eagle in tournament play', '🦅', 300, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
INSERT INTO achievements (id, code, name, description, icon, points, is_active, auto_award, display_order, metadata, created_at, updated_at, category, rarity) VALUES ('fa4f3b89-207e-4e2b-9370-bb430a8a3df9', 'high_roller', 'High Roller', 'Won 1000+ CC from challenges', '💰', 400, true, false, 0, '{}'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, '"2025-08-24T02:06:11.926Z"'::jsonb, 'custom', 'special') ON CONFLICT (id) DO NOTHING;
