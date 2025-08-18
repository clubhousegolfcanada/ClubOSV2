-- Migration: 002_customer_features.sql
-- Description: Customer app features - profiles, social, teams, events, bookings
-- Created: 2025-08-17
-- Author: ClubOS Development Team

-- ============================================
-- CUSTOMER PROFILES
-- ============================================

-- Extended customer profile information
CREATE TABLE IF NOT EXISTS customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  
  -- Profile Info
  display_name VARCHAR(100),
  bio TEXT,
  avatar_url TEXT,
  handicap DECIMAL(3,1),
  home_location VARCHAR(100), -- Bedford, Dartmouth, etc.
  
  -- Privacy Settings (friends-only by default)
  profile_visibility VARCHAR(20) DEFAULT 'friends', -- public, friends, private
  show_bookings BOOLEAN DEFAULT true,
  show_stats BOOLEAN DEFAULT true,
  show_friends BOOLEAN DEFAULT false,
  
  -- Social Limits
  max_friends INTEGER DEFAULT 250,
  max_teams INTEGER DEFAULT 5,
  
  -- Preferences
  preferred_tee_time VARCHAR(20), -- morning, afternoon, evening
  preferred_bay_type VARCHAR(20), -- trackman, regular
  notification_preferences JSONB DEFAULT '{}',
  
  -- Stats (will be populated from TrackMan API later)
  total_rounds INTEGER DEFAULT 0,
  average_score DECIMAL(5,2),
  best_score INTEGER,
  favorite_course VARCHAR(100),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id)
);

-- ============================================
-- SOCIAL FEATURES
-- ============================================

-- Friend relationships
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, accepted, blocked
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP WITH TIME ZONE,
  blocked_at TIMESTAMP WITH TIME ZONE,
  blocked_by UUID REFERENCES "Users"(id),
  
  -- Ensure no duplicate friendships
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- Teams/Groups (max 16 members)
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  team_type VARCHAR(50) NOT NULL, -- league, social, tournament
  
  -- Team settings
  is_public BOOLEAN DEFAULT false,
  max_members INTEGER DEFAULT 16 CHECK (max_members <= 16),
  join_code VARCHAR(20) UNIQUE, -- For private team invites
  
  -- Team owner
  created_by UUID NOT NULL REFERENCES "Users"(id),
  captain_id UUID REFERENCES "Users"(id),
  
  -- Team stats
  total_rounds INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  
  -- Metadata
  logo_url TEXT,
  primary_color VARCHAR(7), -- Hex color
  secondary_color VARCHAR(7),
  home_location VARCHAR(100),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_team_size CHECK (max_members >= 2 AND max_members <= 16)
);

-- Team membership
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member', -- captain, co-captain, member
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  invited_by UUID REFERENCES "Users"(id),
  
  -- Member stats within team
  rounds_played INTEGER DEFAULT 0,
  average_score DECIMAL(5,2),
  
  UNIQUE(team_id, user_id)
);

-- ============================================
-- EVENTS & TOURNAMENTS
-- ============================================

-- Events (tournaments, leagues, casual games)
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  event_type VARCHAR(50) NOT NULL, -- tournament, league, casual, lesson
  
  -- Event details
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location VARCHAR(100) NOT NULL,
  bay_assignments TEXT[], -- Array of bay numbers
  
  -- Participants
  max_participants INTEGER DEFAULT 16 CHECK (max_participants <= 16),
  min_participants INTEGER DEFAULT 2,
  registration_deadline TIMESTAMP WITH TIME ZONE,
  
  -- Event settings
  is_public BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  entry_fee DECIMAL(10,2),
  prize_pool DECIMAL(10,2),
  
  -- Scoring/Format
  scoring_format VARCHAR(50), -- stroke_play, match_play, scramble, best_ball
  rounds INTEGER DEFAULT 1,
  holes_per_round INTEGER DEFAULT 18,
  handicap_enabled BOOLEAN DEFAULT true,
  
  -- Organizer
  created_by UUID NOT NULL REFERENCES "Users"(id),
  is_official BOOLEAN DEFAULT false, -- Created by Clubhouse vs user
  team_id UUID REFERENCES teams(id), -- If team event
  
  -- TrackMan Integration (future)
  trackman_event_id VARCHAR(100),
  auto_scoring BOOLEAN DEFAULT false,
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft', -- draft, open, in_progress, completed, cancelled
  
  -- Results
  winner_user_id UUID REFERENCES "Users"(id),
  winner_team_id UUID REFERENCES teams(id),
  final_scores JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Event participants
CREATE TABLE IF NOT EXISTS event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id),
  
  -- Registration
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  registration_status VARCHAR(20) DEFAULT 'registered', -- registered, waitlist, cancelled
  check_in_time TIMESTAMP WITH TIME ZONE,
  
  -- Scoring
  total_score INTEGER,
  handicap_applied DECIMAL(3,1),
  final_position INTEGER,
  prize_amount DECIMAL(10,2),
  
  -- Round scores (stored as JSON for flexibility)
  round_scores JSONB DEFAULT '[]',
  
  UNIQUE(event_id, user_id)
);

-- ============================================
-- BOOKING FEATURES
-- ============================================

-- Booking shares (link bookings to events/social)
CREATE TABLE IF NOT EXISTS booking_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id VARCHAR(200) NOT NULL, -- External booking ID from Skedda
  shared_by UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  
  -- Booking details (cached from Skedda)
  booking_date TIMESTAMP WITH TIME ZONE NOT NULL,
  bay_number VARCHAR(20),
  duration_minutes INTEGER,
  location VARCHAR(100),
  
  -- Sharing settings
  visibility VARCHAR(20) DEFAULT 'friends', -- public, friends, private, team
  team_id UUID REFERENCES teams(id),
  event_id UUID REFERENCES events(id),
  
  -- Participants
  max_participants INTEGER DEFAULT 4,
  allow_join_requests BOOLEAN DEFAULT true,
  
  -- Tags
  tags TEXT[],
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE -- Auto-hide after booking time
);

-- Booking participants (who's joining shared bookings)
CREATE TABLE IF NOT EXISTS booking_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_share_id UUID NOT NULL REFERENCES booking_shares(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'confirmed', -- confirmed, maybe, declined
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(booking_share_id, user_id)
);

-- Booking history (cached from Skedda for quick access)
CREATE TABLE IF NOT EXISTS booking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  booking_id VARCHAR(200) NOT NULL,
  
  -- Booking details
  booking_date TIMESTAMP WITH TIME ZONE NOT NULL,
  bay_number VARCHAR(20),
  duration_minutes INTEGER,
  location VARCHAR(100),
  total_cost DECIMAL(10,2),
  
  -- Link to events/social
  event_id UUID REFERENCES events(id),
  team_id UUID REFERENCES teams(id),
  
  -- TrackMan data (if available)
  trackman_session_id VARCHAR(100),
  stats_summary JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index separately
CREATE INDEX idx_booking_history_user_date ON booking_history(user_id, booking_date DESC);

-- ============================================
-- SCOREBOARDS & LEADERBOARDS
-- ============================================

-- League/Tournament scoreboards
CREATE TABLE IF NOT EXISTS scoreboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id),
  season VARCHAR(50), -- "Winter 2025", "Spring 2025"
  
  -- Leaderboard data (stored as JSON for flexibility)
  standings JSONB NOT NULL DEFAULT '[]',
  /*
    Example structure:
    [
      {
        "position": 1,
        "user_id": "uuid",
        "team_id": "uuid",
        "name": "John Doe",
        "rounds_played": 10,
        "total_score": 720,
        "average_score": 72.0,
        "handicap": 5.2,
        "points": 100
      }
    ]
  */
  
  -- Settings
  scoring_system VARCHAR(50), -- points, stroke_average, wins
  include_handicap BOOLEAN DEFAULT true,
  min_rounds_required INTEGER DEFAULT 1,
  
  -- Metadata
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  locked BOOLEAN DEFAULT false, -- Prevent updates after season ends
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CLUBHOUSE LOCATIONS & AVAILABILITY
-- ============================================

-- Clubhouse locations with details
CREATE TABLE IF NOT EXISTS clubhouse_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL, -- "Bedford", "Dartmouth", etc.
  display_name VARCHAR(200) NOT NULL, -- "Clubhouse 24/7 Bedford"
  
  -- Address
  address_line1 VARCHAR(200) NOT NULL,
  address_line2 VARCHAR(200),
  city VARCHAR(100) NOT NULL,
  province VARCHAR(50) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(2) DEFAULT 'CA',
  
  -- Contact
  phone VARCHAR(20),
  email VARCHAR(100),
  
  -- Location details
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  timezone VARCHAR(50) DEFAULT 'America/Halifax',
  
  -- Facility info
  total_bays INTEGER NOT NULL,
  trackman_bays INTEGER DEFAULT 0,
  regular_bays INTEGER DEFAULT 0,
  
  -- Hours (stored as JSON for flexibility)
  operating_hours JSONB DEFAULT '{}',
  /* Example:
    {
      "monday": {"open": "06:00", "close": "23:00"},
      "tuesday": {"open": "06:00", "close": "23:00"},
      ...
      "sunday": {"open": "08:00", "close": "22:00"}
    }
  */
  
  -- Features
  has_bar BOOLEAN DEFAULT false,
  has_food BOOLEAN DEFAULT false,
  has_lessons BOOLEAN DEFAULT false,
  has_leagues BOOLEAN DEFAULT false,
  has_events BOOLEAN DEFAULT false,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false, -- Show prominently in app
  
  -- Images
  hero_image_url TEXT,
  logo_url TEXT,
  gallery_urls TEXT[],
  
  -- Skedda Integration
  skedda_venue_id VARCHAR(100),
  skedda_space_ids JSONB DEFAULT '{}', -- Maps bay numbers to Skedda space IDs
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User's favorite/home clubhouse
CREATE TABLE IF NOT EXISTS user_clubhouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  clubhouse_id UUID NOT NULL REFERENCES clubhouse_locations(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false, -- User's main clubhouse
  is_favorite BOOLEAN DEFAULT false,
  
  -- User's history at this location
  first_visit_date DATE,
  last_visit_date DATE,
  total_visits INTEGER DEFAULT 0,
  total_hours_played DECIMAL(10,2) DEFAULT 0,
  
  -- Preferences for this location
  preferred_bay_numbers INTEGER[],
  preferred_time_slots JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, clubhouse_id)
);

-- Real-time bay availability (cached from Skedda)
CREATE TABLE IF NOT EXISTS bay_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clubhouse_id UUID NOT NULL REFERENCES clubhouse_locations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  bay_number VARCHAR(20) NOT NULL,
  
  -- Availability slots (stored as JSON array)
  available_slots JSONB DEFAULT '[]',
  /* Example:
    [
      {"start": "09:00", "end": "10:00", "price": 45.00},
      {"start": "14:00", "end": "15:00", "price": 55.00},
      {"start": "20:00", "end": "21:00", "price": 35.00}
    ]
  */
  
  -- Bay details
  bay_type VARCHAR(20), -- trackman, regular
  is_available BOOLEAN DEFAULT true,
  
  -- Pricing (can vary by time)
  base_price DECIMAL(10,2),
  peak_price DECIMAL(10,2),
  
  -- Cache control
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(clubhouse_id, date, bay_number)
);

-- Create index separately
CREATE INDEX idx_bay_availability_lookup ON bay_availability(clubhouse_id, date, is_available);

-- Clubhouse announcements/news
CREATE TABLE IF NOT EXISTS clubhouse_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clubhouse_id UUID REFERENCES clubhouse_locations(id) ON DELETE CASCADE,
  
  -- Announcement details
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  announcement_type VARCHAR(50), -- news, event, maintenance, promotion
  priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
  
  -- Display settings
  is_active BOOLEAN DEFAULT true,
  show_in_app BOOLEAN DEFAULT true,
  show_on_website BOOLEAN DEFAULT false,
  
  -- Targeting (null means all locations)
  target_locations UUID[], -- Specific clubhouse IDs
  
  -- Schedule
  start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP WITH TIME ZONE,
  
  created_by UUID REFERENCES "Users"(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ACTIVITY FEED
-- ============================================

-- Social activity feed
CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- booking_shared, event_created, score_posted, friend_joined, achievement, team_joined
  
  -- Polymorphic references
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  booking_share_id UUID REFERENCES booking_shares(id) ON DELETE CASCADE,
  
  -- Activity details
  title VARCHAR(200) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Visibility
  visibility VARCHAR(20) DEFAULT 'friends', -- public, friends, team, private
  
  -- Engagement
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index separately
CREATE INDEX idx_activity_feed_user_created ON activity_feed(user_id, created_at DESC);

-- Activity interactions (likes, comments)
CREATE TABLE IF NOT EXISTS activity_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activity_feed(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  interaction_type VARCHAR(20) NOT NULL, -- like, comment
  comment_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(activity_id, user_id, interaction_type)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Customer profiles
CREATE INDEX idx_customer_profiles_user_id ON customer_profiles(user_id);
CREATE INDEX idx_customer_profiles_visibility ON customer_profiles(profile_visibility);

-- Friendships
CREATE INDEX idx_friendships_user_id ON friendships(user_id, status);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id, status);

-- Teams
CREATE INDEX idx_teams_created_by ON teams(created_by);
CREATE INDEX idx_teams_type ON teams(team_type);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);

-- Events
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_event_participants_user_id ON event_participants(user_id);
CREATE INDEX idx_event_participants_event_id ON event_participants(event_id);

-- Bookings
CREATE INDEX idx_booking_shares_shared_by ON booking_shares(shared_by);
CREATE INDEX idx_booking_shares_date ON booking_shares(booking_date);
CREATE INDEX idx_booking_shares_event ON booking_shares(event_id);
CREATE INDEX idx_booking_participants_user ON booking_participants(user_id);

-- Scoreboards
CREATE INDEX idx_scoreboards_event ON scoreboards(event_id);
CREATE INDEX idx_scoreboards_team ON scoreboards(team_id);
CREATE INDEX idx_scoreboards_season ON scoreboards(season);

-- Clubhouse locations
CREATE INDEX idx_clubhouse_locations_active ON clubhouse_locations(is_active);
CREATE INDEX idx_clubhouse_locations_city ON clubhouse_locations(city);
CREATE INDEX idx_user_clubhouses_user ON user_clubhouses(user_id);
CREATE INDEX idx_user_clubhouses_primary ON user_clubhouses(user_id, is_primary);
CREATE INDEX idx_announcements_active ON clubhouse_announcements(is_active, start_date, end_date);

-- Activity feed
CREATE INDEX idx_activity_type ON activity_feed(activity_type);
CREATE INDEX idx_activity_visibility ON activity_feed(visibility);

-- ============================================
-- UPDATE TRIGGERS
-- ============================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_customer_profiles_updated_at BEFORE UPDATE ON customer_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scoreboards_updated_at BEFORE UPDATE ON scoreboards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA & CONSTRAINTS
-- ============================================

-- Ensure users with 'customer' role have a profile
CREATE OR REPLACE FUNCTION create_customer_profile()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'customer' THEN
        INSERT INTO customer_profiles (user_id, display_name)
        VALUES (NEW.id, NEW.name)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER auto_create_customer_profile
AFTER INSERT ON "Users"
FOR EACH ROW EXECUTE FUNCTION create_customer_profile();

-- Prevent teams from exceeding member limit
CREATE OR REPLACE FUNCTION check_team_member_limit()
RETURNS TRIGGER AS $$
DECLARE
    current_members INTEGER;
    max_allowed INTEGER;
BEGIN
    SELECT COUNT(*), MAX(t.max_members)
    INTO current_members, max_allowed
    FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    WHERE tm.team_id = NEW.team_id
    GROUP BY tm.team_id;
    
    IF current_members >= max_allowed THEN
        RAISE EXCEPTION 'Team has reached maximum member limit of %', max_allowed;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER enforce_team_member_limit
BEFORE INSERT ON team_members
FOR EACH ROW EXECUTE FUNCTION check_team_member_limit();

-- Prevent users from exceeding friend limit
CREATE OR REPLACE FUNCTION check_friend_limit()
RETURNS TRIGGER AS $$
DECLARE
    current_friends INTEGER;
    max_allowed INTEGER;
BEGIN
    SELECT COUNT(*), 250  -- Default max friends
    INTO current_friends, max_allowed
    FROM friendships
    WHERE (user_id = NEW.user_id OR friend_id = NEW.user_id)
    AND status = 'accepted';
    
    -- Check custom limit from profile
    SELECT COALESCE(cp.max_friends, 250)
    INTO max_allowed
    FROM customer_profiles cp
    JOIN users u ON u.id = cp.user_id
    WHERE u.id = NEW.user_id;
    
    IF current_friends >= max_allowed THEN
        RAISE EXCEPTION 'Friend limit of % reached', max_allowed;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER enforce_friend_limit
BEFORE INSERT ON friendships
FOR EACH ROW EXECUTE FUNCTION check_friend_limit();

-- ============================================
-- ROLLBACK SUPPORT
-- ============================================

-- DOWN migration (for rollback)
/*
DROP TRIGGER IF EXISTS enforce_friend_limit ON friendships;
DROP TRIGGER IF EXISTS enforce_team_member_limit ON team_members;
DROP TRIGGER IF EXISTS auto_create_customer_profile ON users;
DROP TRIGGER IF EXISTS update_scoreboards_updated_at ON scoreboards;
DROP TRIGGER IF EXISTS update_events_updated_at ON events;
DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
DROP TRIGGER IF EXISTS update_customer_profiles_updated_at ON customer_profiles;

DROP FUNCTION IF EXISTS check_friend_limit();
DROP FUNCTION IF EXISTS check_team_member_limit();
DROP FUNCTION IF EXISTS create_customer_profile();
DROP FUNCTION IF EXISTS update_updated_at_column();

DROP TABLE IF EXISTS activity_interactions CASCADE;
DROP TABLE IF EXISTS activity_feed CASCADE;
DROP TABLE IF EXISTS clubhouse_announcements CASCADE;
DROP TABLE IF EXISTS bay_availability CASCADE;
DROP TABLE IF EXISTS user_clubhouses CASCADE;
DROP TABLE IF EXISTS clubhouse_locations CASCADE;
DROP TABLE IF EXISTS scoreboards CASCADE;
DROP TABLE IF EXISTS booking_history CASCADE;
DROP TABLE IF EXISTS booking_participants CASCADE;
DROP TABLE IF EXISTS booking_shares CASCADE;
DROP TABLE IF EXISTS event_participants CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;
DROP TABLE IF EXISTS customer_profiles CASCADE;
*/