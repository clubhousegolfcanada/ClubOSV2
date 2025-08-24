-- Migration: 066_friends_system_enhancements.sql
-- Description: Enhance existing friends system for ClubCoin wagering
-- Created: 2025-08-18
-- Author: ClubOS Development Team

-- ============================================
-- ENHANCE EXISTING FRIENDSHIPS TABLE
-- ============================================

-- Add columns to existing friendships table (don't recreate)
ALTER TABLE friendships 
  ADD COLUMN IF NOT EXISTS invitation_method VARCHAR(20) DEFAULT 'in_app',
  ADD COLUMN IF NOT EXISTS invitation_message TEXT,
  ADD COLUMN IF NOT EXISTS mutual_friends_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS friendship_source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS clubcoin_wagers_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clubcoin_wagers_total DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_wager_date TIMESTAMP;

-- ============================================
-- FRIEND INVITATIONS FOR NON-USERS
-- ============================================

CREATE TABLE IF NOT EXISTS friend_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_email VARCHAR(255),
  invitee_phone VARCHAR(50),
  invitee_name VARCHAR(255),
  invitation_code VARCHAR(20) UNIQUE DEFAULT substring(md5(random()::text), 1, 8),
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, expired, cancelled
  message TEXT,
  sent_via VARCHAR(20), -- email, sms, link
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reminder_sent_at TIMESTAMP,
  accepted_at TIMESTAMP,
  accepted_user_id UUID REFERENCES users(id),
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
  metadata JSONB DEFAULT '{}',
  
  CHECK (invitee_email IS NOT NULL OR invitee_phone IS NOT NULL)
);

-- ============================================
-- FRIEND SUGGESTIONS ENGINE
-- ============================================

CREATE TABLE IF NOT EXISTS friend_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  suggested_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Suggestion reasons and scoring
  reason VARCHAR(50), -- mutual_friends, same_location, similar_handicap, frequent_bookings
  mutual_friends_count INTEGER DEFAULT 0,
  mutual_friends_list UUID[], -- Array of mutual friend IDs
  shared_events_count INTEGER DEFAULT 0,
  shared_bookings_count INTEGER DEFAULT 0,
  relevance_score FLOAT DEFAULT 0, -- 0-1 score for ranking
  
  -- User interaction
  dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMP,
  sent_request BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, suggested_user_id)
);

-- ============================================
-- CONTACT SYNC FOR FRIEND DISCOVERY
-- ============================================

CREATE TABLE IF NOT EXISTS contact_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Hashed contact info for privacy
  contact_hash VARCHAR(64) NOT NULL, -- SHA256 of normalized email/phone
  contact_type VARCHAR(10) NOT NULL, -- email, phone
  contact_name VARCHAR(255), -- Name from user's contacts
  
  -- Matching
  matched_user_id UUID REFERENCES users(id),
  match_confidence FLOAT DEFAULT 1.0, -- Confidence in the match
  friendship_status VARCHAR(20), -- pending, accepted, blocked, none
  
  -- Sync metadata
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(50), -- ios_contacts, android_contacts, manual, import
  
  UNIQUE(user_id, contact_hash)
);

-- Create indexes separately
CREATE INDEX idx_contact_hash ON contact_sync(contact_hash);
CREATE INDEX idx_matched_user ON contact_sync(matched_user_id);

-- ============================================
-- FRIEND GROUPS FOR WAGERING
-- ============================================

CREATE TABLE IF NOT EXISTS friend_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Group settings
  is_public BOOLEAN DEFAULT false,
  max_members INTEGER DEFAULT 10,
  allow_wagers BOOLEAN DEFAULT true,
  default_wager_amount DECIMAL(10,2) DEFAULT 10,
  
  -- Group stats
  total_wagers INTEGER DEFAULT 0,
  total_wagered DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS friend_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES friend_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  role VARCHAR(20) DEFAULT 'member', -- owner, admin, member
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  invited_by UUID REFERENCES users(id),
  
  -- Member stats in group
  wagers_participated INTEGER DEFAULT 0,
  total_wagered DECIMAL(10,2) DEFAULT 0,
  total_won DECIMAL(10,2) DEFAULT 0,
  
  UNIQUE(group_id, user_id)
);

-- ============================================
-- FRIEND ACTIVITY TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS friend_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  activity_type VARCHAR(50) NOT NULL, -- wager_sent, wager_accepted, booking_shared, message_sent
  activity_data JSONB DEFAULT '{}',
  
  -- Reference to related entities
  wager_id UUID, -- Future reference to wagers table
  booking_id VARCHAR(200),
  event_id UUID REFERENCES events(id),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index separately
CREATE INDEX idx_friend_activity_users ON friend_activities(user_id, friend_id, created_at DESC);

-- ============================================
-- FRIEND NOTIFICATIONS PREFERENCES
-- ============================================

CREATE TABLE IF NOT EXISTS friend_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification toggles
  friend_requests BOOLEAN DEFAULT true,
  friend_accepts BOOLEAN DEFAULT true,
  friend_suggestions BOOLEAN DEFAULT false,
  wager_invites BOOLEAN DEFAULT true,
  friend_bookings BOOLEAN DEFAULT true,
  friend_achievements BOOLEAN DEFAULT false,
  
  -- Delivery methods
  push_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  
  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id)
);

-- ============================================
-- PRIVACY & BLOCKING ENHANCEMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  reason VARCHAR(100),
  notes TEXT,
  blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Prevent seeing each other
  hide_from_suggestions BOOLEAN DEFAULT true,
  block_messages BOOLEAN DEFAULT true,
  block_wagers BOOLEAN DEFAULT true,
  
  UNIQUE(user_id, blocked_user_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Friend invitations
CREATE INDEX idx_friend_invitations_inviter ON friend_invitations(inviter_id);
CREATE INDEX idx_friend_invitations_status ON friend_invitations(status);
CREATE INDEX idx_friend_invitations_email ON friend_invitations(invitee_email) WHERE invitee_email IS NOT NULL;
CREATE INDEX idx_friend_invitations_phone ON friend_invitations(invitee_phone) WHERE invitee_phone IS NOT NULL;
CREATE INDEX idx_friend_invitations_code ON friend_invitations(invitation_code);

-- Friend suggestions
CREATE INDEX idx_friend_suggestions_user ON friend_suggestions(user_id, dismissed, relevance_score DESC);
CREATE INDEX idx_friend_suggestions_mutual ON friend_suggestions(user_id, mutual_friends_count DESC);

-- Friend groups
CREATE INDEX idx_friend_groups_owner ON friend_groups(owner_id);
CREATE INDEX idx_friend_group_members_user ON friend_group_members(user_id);
CREATE INDEX idx_friend_group_members_group ON friend_group_members(group_id);

-- Blocks
CREATE INDEX idx_user_blocks_user ON user_blocks(user_id);
CREATE INDEX idx_user_blocks_blocked ON user_blocks(blocked_user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-match invited users when they sign up
CREATE OR REPLACE FUNCTION auto_match_friend_invitations()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if new user matches any pending invitations
  UPDATE friend_invitations
  SET 
    status = 'accepted',
    accepted_at = CURRENT_TIMESTAMP,
    accepted_user_id = NEW.id
  WHERE 
    status = 'pending'
    AND (
      (invitee_email = NEW.email) OR 
      (invitee_phone = NEW.phone AND invitee_phone IS NOT NULL)
    );
    
  -- Auto-create friendships for accepted invitations
  INSERT INTO friendships (user_id, friend_id, status, accepted_at, friendship_source)
  SELECT 
    inviter_id,
    NEW.id,
    'accepted',
    CURRENT_TIMESTAMP,
    'invitation'
  FROM friend_invitations
  WHERE 
    accepted_user_id = NEW.id
    AND NOT EXISTS (
      SELECT 1 FROM friendships 
      WHERE (user_id = friend_invitations.inviter_id AND friend_id = NEW.id)
         OR (user_id = NEW.id AND friend_id = friend_invitations.inviter_id)
    );
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER match_friend_invitations_on_signup
AFTER INSERT ON users
FOR EACH ROW
WHEN (NEW.role = 'customer')
EXECUTE FUNCTION auto_match_friend_invitations();

-- Calculate mutual friends count
CREATE OR REPLACE FUNCTION calculate_mutual_friends(user1_id UUID, user2_id UUID)
RETURNS INTEGER AS $$
DECLARE
  mutual_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT friend_id) INTO mutual_count
  FROM (
    -- Friends of user1
    SELECT friend_id FROM friendships 
    WHERE user_id = user1_id AND status = 'accepted'
    UNION
    SELECT user_id FROM friendships 
    WHERE friend_id = user1_id AND status = 'accepted'
  ) AS user1_friends
  WHERE friend_id IN (
    -- Friends of user2
    SELECT friend_id FROM friendships 
    WHERE user_id = user2_id AND status = 'accepted'
    UNION
    SELECT user_id FROM friendships 
    WHERE friend_id = user2_id AND status = 'accepted'
  );
  
  RETURN COALESCE(mutual_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Update mutual friends count on friendship changes
CREATE OR REPLACE FUNCTION update_mutual_friends_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update mutual friends count for all friendships involving these users
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE friendships
    SET mutual_friends_count = calculate_mutual_friends(user_id, friend_id)
    WHERE (user_id = NEW.user_id OR friend_id = NEW.user_id 
           OR user_id = NEW.friend_id OR friend_id = NEW.friend_id)
      AND status = 'accepted';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mutual_friends_on_friendship_change
AFTER INSERT OR UPDATE OF status ON friendships
FOR EACH ROW
WHEN (NEW.status = 'accepted')
EXECUTE FUNCTION update_mutual_friends_count();

-- ============================================
-- SEED DATA FOR FRIEND NOTIFICATION PREFERENCES
-- ============================================

-- Create default notification preferences for existing customers
INSERT INTO friend_notification_preferences (user_id)
SELECT id FROM users WHERE role = 'customer'
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- ROLLBACK SUPPORT
-- ============================================

-- DOWN migration (for rollback)
/*
DROP TRIGGER IF EXISTS update_mutual_friends_on_friendship_change ON friendships;
DROP TRIGGER IF EXISTS match_friend_invitations_on_signup ON users;

DROP FUNCTION IF EXISTS update_mutual_friends_count();
DROP FUNCTION IF EXISTS calculate_mutual_friends(UUID, UUID);
DROP FUNCTION IF EXISTS auto_match_friend_invitations();

DROP TABLE IF EXISTS user_blocks CASCADE;
DROP TABLE IF EXISTS friend_notification_preferences CASCADE;
DROP TABLE IF EXISTS friend_activities CASCADE;
DROP TABLE IF EXISTS friend_group_members CASCADE;
DROP TABLE IF EXISTS friend_groups CASCADE;
DROP TABLE IF EXISTS contact_sync CASCADE;
DROP TABLE IF EXISTS friend_suggestions CASCADE;
DROP TABLE IF EXISTS friend_invitations CASCADE;

-- Remove added columns from friendships
ALTER TABLE friendships 
  DROP COLUMN IF EXISTS invitation_method,
  DROP COLUMN IF EXISTS invitation_message,
  DROP COLUMN IF EXISTS mutual_friends_count,
  DROP COLUMN IF EXISTS friendship_source,
  DROP COLUMN IF EXISTS clubcoin_wagers_count,
  DROP COLUMN IF EXISTS clubcoin_wagers_total,
  DROP COLUMN IF EXISTS last_wager_date;
*/