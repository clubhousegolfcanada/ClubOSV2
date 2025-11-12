-- Migration: Create Golf Scoring System for NS Senior Golf Tour
-- Created: 2024-11-12
-- Description: Simplified scoring system for outdoor golf tournaments

-- 1. Create golf events table (pre-configured tournaments)
CREATE TABLE IF NOT EXISTS golf_events (
  id SERIAL PRIMARY KEY,
  event_code VARCHAR(50) UNIQUE NOT NULL,
  event_name VARCHAR(200) NOT NULL,
  course_name VARCHAR(200) NOT NULL,
  event_date DATE NOT NULL,
  hole_pars JSONB NOT NULL, -- Array of par values for each hole
  course_par INTEGER NOT NULL DEFAULT 72, -- Store par directly instead of computing
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create golf scorecards table (combined player info + scores)
CREATE TABLE IF NOT EXISTS golf_scorecards (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES golf_events(id) ON DELETE CASCADE,

  -- Player information (entered inline on scorecard)
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  division VARCHAR(50) NOT NULL,
  home_club VARCHAR(200),
  email VARCHAR(200),
  phone VARCHAR(20),

  -- Scoring data
  hole_scores JSONB DEFAULT '{}',
  holes_completed INTEGER DEFAULT 0,
  front_nine INTEGER,
  back_nine INTEGER,
  total_score INTEGER,
  to_par INTEGER,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'withdrawn')),
  session_token VARCHAR(100) UNIQUE,
  started_at TIMESTAMP DEFAULT NOW(),
  last_saved TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_division CHECK (division IN ('mens_champ', 'mens_senior', 'mens_super', 'ladies')),
  CONSTRAINT valid_holes_completed CHECK (holes_completed >= 0 AND holes_completed <= 18)
);

-- 3. Create golf configuration table
CREATE TABLE IF NOT EXISTS golf_config (
  key VARCHAR(50) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create indexes for performance
CREATE INDEX idx_scorecard_lookup ON golf_scorecards(event_id, lower(first_name), lower(last_name));
CREATE INDEX idx_scorecard_session ON golf_scorecards(session_token) WHERE session_token IS NOT NULL;
CREATE INDEX idx_scorecard_leaderboard ON golf_scorecards(event_id, division, status, total_score);
CREATE INDEX idx_scorecard_status ON golf_scorecards(event_id, status);
CREATE INDEX idx_events_active ON golf_events(is_active, event_date);

-- 5. Insert division configuration
INSERT INTO golf_config (key, value) VALUES
('divisions', '[
  {"id": "mens_champ", "name": "Men''s Championship (50-64)", "minAge": 50, "maxAge": 64, "gender": "M", "sortOrder": 1},
  {"id": "mens_senior", "name": "Men''s Senior (65-74)", "minAge": 65, "maxAge": 74, "gender": "M", "sortOrder": 2},
  {"id": "mens_super", "name": "Men''s Super Senior (75+)", "minAge": 75, "maxAge": null, "gender": "M", "sortOrder": 3},
  {"id": "ladies", "name": "Ladies Division (50+)", "minAge": 50, "maxAge": null, "gender": "F", "sortOrder": 4}
]'::jsonb),
('ui_settings', '{
  "refreshInterval": 30000,
  "enableOffline": true,
  "seniorMode": true,
  "fontSize": "xl",
  "buttonSize": "lg",
  "maxScorePerHole": 10,
  "autoSaveInterval": 2000
}'::jsonb),
('sponsor', '{
  "name": "Clubhouse 24/7",
  "logo": "/images/clubhouse-logo.png",
  "website": "https://clubhouse247.ca",
  "message": "Proud sponsor of the NS Senior Golf Tour"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- 6. Insert the 4 golf events for the tour
INSERT INTO golf_events (event_code, event_name, course_name, event_date, hole_pars, course_par, is_active) VALUES
('glen-arbour-2024', 'NS Senior Tour - Event 1', 'Glen Arbour Golf Club', '2024-06-15',
 '[4,3,5,4,4,3,5,4,4,4,3,5,4,4,3,5,4,4]'::jsonb, 72, true),
('ashburn-2024', 'NS Senior Tour - Event 2', 'Ashburn Golf Club', '2024-07-20',
 '[4,4,5,3,4,4,3,5,4,4,4,5,3,4,4,3,5,4]'::jsonb, 72, true),
('penn-hills-2024', 'NS Senior Tour - Event 3', 'Links at Penn Hills', '2024-08-17',
 '[4,3,4,5,4,3,4,5,4,4,3,4,5,4,3,4,5,4]'::jsonb, 72, true),
('avon-valley-2024', 'NS Senior Tour - Event 4', 'Avon Valley Golf & Country Club', '2024-09-21',
 '[5,4,3,4,4,5,3,4,4,4,4,3,5,4,4,3,4,5]'::jsonb, 72, true)
ON CONFLICT (event_code) DO UPDATE SET
  event_name = EXCLUDED.event_name,
  course_name = EXCLUDED.course_name,
  event_date = EXCLUDED.event_date,
  hole_pars = EXCLUDED.hole_pars,
  course_par = EXCLUDED.course_par,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 7. Create function to calculate scores automatically
CREATE OR REPLACE FUNCTION update_golf_scores() RETURNS TRIGGER AS $$
BEGIN
  -- Calculate holes completed
  NEW.holes_completed := (SELECT COUNT(*) FROM jsonb_object_keys(NEW.hole_scores));

  -- Calculate front nine (holes 1-9)
  NEW.front_nine := (
    SELECT COALESCE(SUM((NEW.hole_scores->>key)::int), 0)
    FROM jsonb_object_keys(NEW.hole_scores) AS key
    WHERE key::int BETWEEN 1 AND 9
  );

  -- Calculate back nine (holes 10-18)
  NEW.back_nine := (
    SELECT COALESCE(SUM((NEW.hole_scores->>key)::int), 0)
    FROM jsonb_object_keys(NEW.hole_scores) AS key
    WHERE key::int BETWEEN 10 AND 18
  );

  -- Calculate total score
  NEW.total_score := (
    SELECT COALESCE(SUM(value::int), 0)
    FROM jsonb_each_text(NEW.hole_scores)
  );

  -- Calculate to par (using course par from related event)
  NEW.to_par := NEW.total_score - COALESCE(
    (SELECT course_par FROM golf_events WHERE id = NEW.event_id), 72
  );

  -- Update status if all holes completed
  IF NEW.holes_completed = 18 AND NEW.status = 'in_progress' THEN
    NEW.status := 'completed';
    NEW.completed_at := NOW();
  END IF;

  -- Update last saved timestamp
  NEW.last_saved := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger to auto-update scores
CREATE TRIGGER trg_update_golf_scores
  BEFORE INSERT OR UPDATE OF hole_scores ON golf_scorecards
  FOR EACH ROW
  EXECUTE FUNCTION update_golf_scores();

-- 9. Create view for easy leaderboard queries
CREATE OR REPLACE VIEW golf_leaderboard AS
SELECT
  s.id,
  s.event_id,
  e.event_code,
  e.event_name,
  e.course_name,
  s.first_name || ' ' || s.last_name as player_name,
  s.first_name,
  s.last_name,
  s.division,
  s.home_club,
  s.holes_completed,
  s.front_nine,
  s.back_nine,
  s.total_score,
  s.to_par,
  CASE
    WHEN s.holes_completed = 18 THEN 'F'
    WHEN s.holes_completed = 0 THEN '-'
    ELSE s.holes_completed::text
  END as thru,
  s.status,
  s.started_at,
  s.completed_at,
  ROW_NUMBER() OVER (
    PARTITION BY s.event_id, s.division
    ORDER BY
      CASE WHEN s.status = 'completed' THEN 0 ELSE 1 END,
      s.total_score ASC NULLS LAST,
      s.holes_completed DESC
  ) as position_in_division,
  ROW_NUMBER() OVER (
    PARTITION BY s.event_id
    ORDER BY
      CASE WHEN s.status = 'completed' THEN 0 ELSE 1 END,
      s.total_score ASC NULLS LAST,
      s.holes_completed DESC
  ) as position_overall
FROM golf_scorecards s
JOIN golf_events e ON s.event_id = e.id
WHERE s.status != 'withdrawn';

-- 10. Grant permissions (adjust based on your user setup)
-- GRANT SELECT ON golf_events, golf_config TO authenticated;
-- GRANT ALL ON golf_scorecards TO authenticated;
-- GRANT SELECT ON golf_leaderboard TO anon;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Golf scoring system tables created successfully';
  RAISE NOTICE '4 events configured: Glen Arbour, Ashburn, Penn Hills, Avon Valley';
  RAISE NOTICE '4 divisions configured: Men''s Championship, Senior, Super Senior, Ladies';
END $$;