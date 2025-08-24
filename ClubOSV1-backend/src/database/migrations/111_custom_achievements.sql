-- UP
-- Modify achievements table to support fully custom achievements

-- Drop the enum constraints to allow any values
ALTER TABLE achievements 
DROP COLUMN IF EXISTS category,
DROP COLUMN IF EXISTS rarity;

-- Add new flexible columns for custom achievements
ALTER TABLE achievements
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'custom',
ADD COLUMN IF NOT EXISTS rarity VARCHAR(50) DEFAULT 'special',
ADD COLUMN IF NOT EXISTS color VARCHAR(7), -- Hex color code
ADD COLUMN IF NOT EXISTS background_color VARCHAR(7), -- Background hex color
ADD COLUMN IF NOT EXISTS glow_color VARCHAR(50), -- CSS glow effect
ADD COLUMN IF NOT EXISTS custom_css TEXT, -- Allow full CSS customization
ADD COLUMN IF NOT EXISTS size VARCHAR(20) DEFAULT 'medium', -- xs, sm, md, lg, xl
ADD COLUMN IF NOT EXISTS animation_type VARCHAR(50), -- pulse, spin, bounce, glow, etc.
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT true;

-- Remove all pre-seeded achievements since we want only custom ones
DELETE FROM user_achievements WHERE achievement_id IN (
  SELECT id FROM achievements WHERE is_custom IS NULL OR is_custom = false
);
DELETE FROM achievements WHERE is_custom IS NULL OR is_custom = false;

-- Add index for custom achievements
CREATE INDEX IF NOT EXISTS idx_achievements_custom ON achievements(is_custom) WHERE is_custom = true;
CREATE INDEX IF NOT EXISTS idx_achievements_created_by ON achievements(created_by);

-- Function to create custom achievement and immediately award it
CREATE OR REPLACE FUNCTION create_and_award_achievement(
  p_user_id UUID,
  p_name VARCHAR(100),
  p_description TEXT,
  p_icon VARCHAR(10),
  p_color VARCHAR(7),
  p_background_color VARCHAR(7),
  p_category VARCHAR(50),
  p_rarity VARCHAR(50),
  p_points INTEGER,
  p_reason TEXT,
  p_awarded_by UUID,
  p_tournament_id VARCHAR(100) DEFAULT NULL,
  p_glow_color VARCHAR(50) DEFAULT NULL,
  p_animation_type VARCHAR(50) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_achievement_id UUID;
BEGIN
  -- Create the custom achievement
  INSERT INTO achievements (
    name, description, icon, color, background_color, 
    category, rarity, points, glow_color, animation_type,
    created_by, is_custom, is_active
  ) VALUES (
    p_name, p_description, p_icon, p_color, p_background_color,
    p_category, p_rarity, p_points, p_glow_color, p_animation_type,
    p_awarded_by, true, true
  ) RETURNING id INTO v_achievement_id;
  
  -- Award it to the user
  INSERT INTO user_achievements (
    user_id, achievement_id, awarded_by, reason, tournament_id, is_featured
  ) VALUES (
    p_user_id, v_achievement_id, p_awarded_by, p_reason, p_tournament_id, true
  );
  
  -- Update user's latest achievement
  UPDATE customer_profiles 
  SET latest_achievement_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN v_achievement_id;
END;
$$ LANGUAGE plpgsql;

-- DOWN
DROP FUNCTION IF EXISTS create_and_award_achievement;
DROP INDEX IF EXISTS idx_achievements_custom;
DROP INDEX IF EXISTS idx_achievements_created_by;

ALTER TABLE achievements
DROP COLUMN IF EXISTS color,
DROP COLUMN IF EXISTS background_color,
DROP COLUMN IF EXISTS glow_color,
DROP COLUMN IF EXISTS custom_css,
DROP COLUMN IF EXISTS size,
DROP COLUMN IF EXISTS animation_type,
DROP COLUMN IF EXISTS created_by,
DROP COLUMN IF EXISTS is_custom;