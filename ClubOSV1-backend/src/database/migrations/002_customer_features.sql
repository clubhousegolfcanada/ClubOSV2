-- =====================================================
-- CUSTOMER FEATURES MIGRATION
-- Date: 2025-08-17
-- Purpose: Add tables for Clubhouse customer app
-- =====================================================

-- UP

-- =====================================================
-- CUSTOMER PROFILES
-- =====================================================
CREATE TABLE IF NOT EXISTS customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(255),
  avatar_url TEXT,
  bio TEXT,
  handicap DECIMAL(3,1),
  home_location VARCHAR(100), -- Bedford, Dartmouth, etc.
  favorite_bay VARCHAR(20),
  privacy_settings JSONB DEFAULT '{
    "profile_visibility": "public",
    "friends_visibility": "friends",
    "activity_visibility": "friends",
    "bookings_visibility": "friends"
  }',
  stats JSONB DEFAULT '{
    "rounds_played": 0,
    "average_score": null,
    "longest_drive": null,
    "best_round": null
  }',
  social_links JSONB DEFAULT '{}',
  notification_preferences JSONB DEFAULT '{
    "push_enabled": true,
    "email_enabled": true,
    "friend_requests": true,
    "event_invites": true,
    "booking_shares": true,
    "marketing": false
  }',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- FRIENDSHIPS
-- =====================================================
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, blocked
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  blocked_at TIMESTAMP,
  blocked_by UUID REFERENCES users(id),
  CONSTRAINT unique_friendship UNIQUE(user_id, friend_id),
  CONSTRAINT no_self_friend CHECK (user_id != friend_id)
);

-- =====================================================
-- TEAMS/GROUPS
-- =====================================================
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  avatar_url TEXT,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) DEFAULT 'casual', -- casual, league, tournament
  max_members INTEGER DEFAULT 20,
  is_public BOOLEAN DEFAULT false,
  join_code VARCHAR(20) UNIQUE,
  settings JSONB DEFAULT '{
    "allow_invites": true,
    "require_approval": false,
    "auto_share_bookings": false
  }',
  stats JSONB DEFAULT '{
    "total_rounds": 0,
    "average_handicap": null,
    "wins": 0
  }',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member', -- owner, admin, member
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  invited_by UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT unique_team_member UNIQUE(team_id, user_id)
);

-- =====================================================
-- EVENTS & TOURNAMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL, -- tournament, league, casual, lesson
  location VARCHAR(100),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  registration_deadline TIMESTAMP,
  max_participants INTEGER,
  min_participants INTEGER DEFAULT 2,
  entry_fee DECIMAL(10,2),
  prize_pool DECIMAL(10,2),
  format JSONB DEFAULT '{}', -- stroke play, match play, scramble, etc.
  rules JSONB DEFAULT '{}',
  scoring_system VARCHAR(50),
  status VARCHAR(20) DEFAULT 'draft', -- draft, open, in_progress, completed, cancelled
  is_public BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  team_event BOOLEAN DEFAULT false,
  recurring_pattern JSONB, -- for recurring events
  skedda_booking_ids JSONB DEFAULT '[]', -- Link to Skedda bookings
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'registered', -- registered, waitlist, confirmed, cancelled
  registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  check_in_time TIMESTAMP,
  placement INTEGER,
  score JSONB DEFAULT '{}',
  notes TEXT,
  paid BOOLEAN DEFAULT false,
  payment_date TIMESTAMP,
  CONSTRAINT unique_participant UNIQUE(event_id, user_id)
);

-- =====================================================
-- BOOKING SHARES (Skedda Integration)
-- =====================================================
CREATE TABLE IF NOT EXISTS booking_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skedda_booking_id VARCHAR(255) NOT NULL, -- External Skedda booking ID
  shared_by UUID REFERENCES users(id) ON DELETE CASCADE,
  shared_with_user UUID REFERENCES users(id) ON DELETE CASCADE,
  shared_with_team UUID REFERENCES teams(id) ON DELETE CASCADE,
  booking_date TIMESTAMP NOT NULL,
  bay_number VARCHAR(20),
  location VARCHAR(100),
  duration_minutes INTEGER,
  message TEXT,
  visibility VARCHAR(20) DEFAULT 'friends', -- public, friends, team, private
  allow_join_requests BOOLEAN DEFAULT true,
  max_additional_players INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP, -- When the share expires
  metadata JSONB DEFAULT '{}' -- Store Skedda booking details
);

CREATE TABLE IF NOT EXISTS booking_share_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_share_id UUID REFERENCES booking_shares(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, declined
  responded_at TIMESTAMP,
  CONSTRAINT unique_booking_participant UNIQUE(booking_share_id, user_id)
);

-- =====================================================
-- ACTIVITY FEED
-- =====================================================
CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- friend_joined, booking_shared, event_created, achievement, score_posted
  title VARCHAR(255),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  visibility VARCHAR(20) DEFAULT 'friends', -- public, friends, private
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TRACKMAN INTEGRATION (Prep for Week 4)
-- =====================================================
CREATE TABLE IF NOT EXISTS trackman_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  external_session_id VARCHAR(255), -- TrackMan's session ID
  booking_id VARCHAR(255), -- Skedda booking ID
  location VARCHAR(100),
  bay_number VARCHAR(20),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  stats JSONB DEFAULT '{}', -- All TrackMan data
  highlights JSONB DEFAULT '[]', -- Best shots, achievements
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CUSTOMER AUTH TOKENS (for mobile app)
-- =====================================================
CREATE TABLE IF NOT EXISTS customer_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  refresh_token VARCHAR(500) UNIQUE NOT NULL,
  device_id VARCHAR(255),
  device_type VARCHAR(50), -- ios, android, web
  device_name VARCHAR(255),
  push_token TEXT, -- For push notifications
  last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_customer_profiles_user_id ON customer_profiles(user_id);
CREATE INDEX idx_friendships_user_id ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX idx_friendships_status ON friendships(status);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_event_participants_user_id ON event_participants(user_id);
CREATE INDEX idx_event_participants_event_id ON event_participants(event_id);
CREATE INDEX idx_booking_shares_shared_by ON booking_shares(shared_by);
CREATE INDEX idx_booking_shares_booking_date ON booking_shares(booking_date);
CREATE INDEX idx_activity_feed_user_id ON activity_feed(user_id);
CREATE INDEX idx_activity_feed_created_at ON activity_feed(created_at DESC);
CREATE INDEX idx_trackman_sessions_user_id ON trackman_sessions(user_id);
CREATE INDEX idx_customer_auth_tokens_user_id ON customer_auth_tokens(user_id);
CREATE INDEX idx_customer_auth_tokens_refresh_token ON customer_auth_tokens(refresh_token);

-- =====================================================
-- UPDATE TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customer_profiles_updated_at BEFORE UPDATE ON customer_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- EXTEND USERS TABLE FOR CUSTOMER FEATURES
-- =====================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_customer BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_since TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_type VARCHAR(50); -- basic, premium, vip
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMP;

-- DOWN
-- Drop in reverse order of dependencies
DROP TABLE IF EXISTS customer_auth_tokens CASCADE;
DROP TABLE IF EXISTS trackman_sessions CASCADE;
DROP TABLE IF EXISTS activity_feed CASCADE;
DROP TABLE IF EXISTS booking_share_participants CASCADE;
DROP TABLE IF EXISTS booking_shares CASCADE;
DROP TABLE IF EXISTS event_participants CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;
DROP TABLE IF EXISTS customer_profiles CASCADE;

-- Remove columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS is_customer;
ALTER TABLE users DROP COLUMN IF EXISTS customer_since;
ALTER TABLE users DROP COLUMN IF EXISTS membership_type;
ALTER TABLE users DROP COLUMN IF EXISTS membership_expires_at;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS update_customer_profiles_updated_at ON customer_profiles;
DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
DROP TRIGGER IF EXISTS update_events_updated_at ON events;