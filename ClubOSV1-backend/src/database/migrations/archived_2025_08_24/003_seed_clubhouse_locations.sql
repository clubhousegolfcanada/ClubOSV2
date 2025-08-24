-- Migration: 003_seed_clubhouse_locations.sql
-- Description: Seed initial clubhouse locations data
-- Created: 2025-08-17
-- Author: ClubOS Development Team

-- Insert initial clubhouse locations
INSERT INTO clubhouse_locations (
  name,
  display_name,
  address_line1,
  city,
  province,
  postal_code,
  country,
  phone,
  email,
  latitude,
  longitude,
  timezone,
  total_bays,
  trackman_bays,
  regular_bays,
  operating_hours,
  has_bar,
  has_food,
  has_lessons,
  has_leagues,
  has_events,
  is_active,
  is_featured
) VALUES
(
  'Bedford',
  'Clubhouse 24/7 Golf - Bedford',
  '1595 Bedford Highway',
  'Bedford',
  'NS',
  'B4A 3Y4',
  'CA',
  '(902) 555-0001',
  'bedford@clubhouse247golf.com',
  44.7167,
  -63.6683,
  'America/Halifax',
  6,
  4,
  2,
  '{
    "monday": {"open": "06:00", "close": "23:00"},
    "tuesday": {"open": "06:00", "close": "23:00"},
    "wednesday": {"open": "06:00", "close": "23:00"},
    "thursday": {"open": "06:00", "close": "23:00"},
    "friday": {"open": "06:00", "close": "24:00"},
    "saturday": {"open": "07:00", "close": "24:00"},
    "sunday": {"open": "08:00", "close": "22:00"}
  }',
  true,
  true,
  true,
  true,
  true,
  true,
  true
),
(
  'Dartmouth',
  'Clubhouse 24/7 Golf - Dartmouth',
  '35 Irishtown Road',
  'Dartmouth',
  'NS',
  'B3A 3Y7',
  'CA',
  '(902) 555-0002',
  'dartmouth@clubhouse247golf.com',
  44.6820,
  -63.5714,
  'America/Halifax',
  8,
  6,
  2,
  '{
    "monday": {"open": "06:00", "close": "23:00"},
    "tuesday": {"open": "06:00", "close": "23:00"},
    "wednesday": {"open": "06:00", "close": "23:00"},
    "thursday": {"open": "06:00", "close": "23:00"},
    "friday": {"open": "06:00", "close": "24:00"},
    "saturday": {"open": "07:00", "close": "24:00"},
    "sunday": {"open": "08:00", "close": "22:00"}
  }',
  true,
  true,
  true,
  true,
  true,
  true,
  false
),
(
  'Stratford',
  'Clubhouse 24/7 Golf - Stratford',
  '123 Main Street',
  'Stratford',
  'PE',
  'C1B 1A1',
  'CA',
  '(902) 555-0003',
  'stratford@clubhouse247golf.com',
  46.2171,
  -63.0888,
  'America/Halifax',
  4,
  2,
  2,
  '{
    "monday": {"open": "07:00", "close": "22:00"},
    "tuesday": {"open": "07:00", "close": "22:00"},
    "wednesday": {"open": "07:00", "close": "22:00"},
    "thursday": {"open": "07:00", "close": "22:00"},
    "friday": {"open": "07:00", "close": "23:00"},
    "saturday": {"open": "08:00", "close": "23:00"},
    "sunday": {"open": "09:00", "close": "21:00"}
  }',
  false,
  true,
  true,
  true,
  true,
  true,
  false
),
(
  'Bayers Lake',
  'Clubhouse 24/7 Golf - Bayers Lake',
  '190 Chain Lake Drive',
  'Halifax',
  'NS',
  'B3S 1C5',
  'CA',
  '(902) 555-0004',
  'bayerslake@clubhouse247golf.com',
  44.6476,
  -63.6906,
  'America/Halifax',
  5,
  3,
  2,
  '{
    "monday": {"open": "06:00", "close": "23:00"},
    "tuesday": {"open": "06:00", "close": "23:00"},
    "wednesday": {"open": "06:00", "close": "23:00"},
    "thursday": {"open": "06:00", "close": "23:00"},
    "friday": {"open": "06:00", "close": "24:00"},
    "saturday": {"open": "07:00", "close": "24:00"},
    "sunday": {"open": "08:00", "close": "22:00"}
  }',
  true,
  true,
  false,
  true,
  true,
  true,
  false
),
(
  'Truro',
  'Clubhouse 24/7 Golf - Truro',
  '45 Robie Street',
  'Truro',
  'NS',
  'B2N 1K8',
  'CA',
  '(902) 555-0005',
  'truro@clubhouse247golf.com',
  45.3650,
  -63.2654,
  'America/Halifax',
  4,
  2,
  2,
  '{
    "monday": {"open": "07:00", "close": "22:00"},
    "tuesday": {"open": "07:00", "close": "22:00"},
    "wednesday": {"open": "07:00", "close": "22:00"},
    "thursday": {"open": "07:00", "close": "22:00"},
    "friday": {"open": "07:00", "close": "23:00"},
    "saturday": {"open": "08:00", "close": "23:00"},
    "sunday": {"open": "09:00", "close": "21:00"}
  }',
  false,
  false,
  true,
  true,
  false,
  true,
  false
)
ON CONFLICT DO NOTHING;

-- Add initial announcement for all locations
INSERT INTO clubhouse_announcements (
  title,
  content,
  announcement_type,
  priority,
  is_active,
  show_in_app,
  start_date,
  end_date
) VALUES (
  'Welcome to the New ClubOS Mobile App!',
  'We''re excited to launch our new mobile app with social features, booking management, tournaments, and more. Download today and connect with fellow golfers!',
  'news',
  'high',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '30 days'
) ON CONFLICT DO NOTHING;

-- Sample bay availability for today (Bedford location)
-- This would normally be synced from Skedda
DO $$
DECLARE
  bedford_id UUID;
  today DATE := CURRENT_DATE;
BEGIN
  SELECT id INTO bedford_id FROM clubhouse_locations WHERE name = 'Bedford' LIMIT 1;
  
  IF bedford_id IS NOT NULL THEN
    -- Bay 1 (TrackMan)
    INSERT INTO bay_availability (
      clubhouse_id, date, bay_number, bay_type, is_available,
      available_slots, base_price, peak_price
    ) VALUES (
      bedford_id, today, '1', 'trackman', true,
      '[
        {"start": "09:00", "end": "10:00", "price": 55.00},
        {"start": "11:00", "end": "12:00", "price": 55.00},
        {"start": "14:00", "end": "15:00", "price": 65.00},
        {"start": "20:00", "end": "21:00", "price": 45.00}
      ]',
      55.00, 65.00
    ) ON CONFLICT DO NOTHING;
    
    -- Bay 2 (TrackMan)
    INSERT INTO bay_availability (
      clubhouse_id, date, bay_number, bay_type, is_available,
      available_slots, base_price, peak_price
    ) VALUES (
      bedford_id, today, '2', 'trackman', true,
      '[
        {"start": "10:00", "end": "11:00", "price": 55.00},
        {"start": "13:00", "end": "14:00", "price": 55.00},
        {"start": "16:00", "end": "17:00", "price": 65.00},
        {"start": "21:00", "end": "22:00", "price": 45.00}
      ]',
      55.00, 65.00
    ) ON CONFLICT DO NOTHING;
    
    -- Bay 3 (Regular)
    INSERT INTO bay_availability (
      clubhouse_id, date, bay_number, bay_type, is_available,
      available_slots, base_price, peak_price  
    ) VALUES (
      bedford_id, today, '3', 'regular', true,
      '[
        {"start": "08:00", "end": "09:00", "price": 35.00},
        {"start": "12:00", "end": "13:00", "price": 35.00},
        {"start": "15:00", "end": "16:00", "price": 45.00},
        {"start": "19:00", "end": "20:00", "price": 45.00},
        {"start": "22:00", "end": "23:00", "price": 35.00}
      ]',
      35.00, 45.00
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ROLLBACK support
-- To undo this seed data:
/*
DELETE FROM bay_availability WHERE clubhouse_id IN (SELECT id FROM clubhouse_locations WHERE name IN ('Bedford', 'Dartmouth', 'Stratford', 'Bayers Lake', 'Truro'));
DELETE FROM clubhouse_announcements WHERE title = 'Welcome to the New ClubOS Mobile App!';
DELETE FROM clubhouse_locations WHERE name IN ('Bedford', 'Dartmouth', 'Stratford', 'Bayers Lake', 'Truro');
*/