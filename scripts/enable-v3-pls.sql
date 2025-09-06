-- V3-PLS Activation Script
-- Run this to enable pattern learning system
-- Date: September 6, 2025

-- ============================================
-- STEP 1: Enable Pattern Learning System
-- ============================================
UPDATE pattern_learning_config SET config_value = 'true' WHERE config_key = 'enabled';
UPDATE pattern_learning_config SET config_value = 'false' WHERE config_key = 'shadow_mode';

-- Set reasonable thresholds for automation
UPDATE pattern_learning_config SET config_value = '0.70' WHERE config_key = 'min_confidence_to_suggest';
UPDATE pattern_learning_config SET config_value = '0.85' WHERE config_key = 'min_confidence_to_act';
UPDATE pattern_learning_config SET config_value = '1' WHERE config_key = 'min_occurrences_to_learn';

-- Confidence evolution settings
UPDATE pattern_learning_config SET config_value = '0.05' WHERE config_key = 'confidence_increase_success';
UPDATE pattern_learning_config SET config_value = '0.02' WHERE config_key = 'confidence_increase_modified';
UPDATE pattern_learning_config SET config_value = '0.10' WHERE config_key = 'confidence_decrease_failure';

-- ============================================
-- STEP 2: Add Automation Card Fields to Patterns
-- ============================================
ALTER TABLE decision_patterns 
ADD COLUMN IF NOT EXISTS automation_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS automation_description TEXT,
ADD COLUMN IF NOT EXISTS automation_icon VARCHAR(50) DEFAULT '💬',
ADD COLUMN IF NOT EXISTS automation_category VARCHAR(50) DEFAULT 'customer_service';

-- ============================================
-- STEP 3: Create Initial Seed Patterns (Examples)
-- ============================================

-- Gift Card Pattern
INSERT INTO decision_patterns (
  pattern_type,
  trigger_text,
  response_template,
  trigger_keywords,
  confidence_score,
  auto_executable,
  is_active,
  automation_name,
  automation_description,
  automation_icon,
  automation_category
) VALUES (
  'gift_cards',
  'Do you sell gift cards?',
  'Yes! We offer gift cards that make perfect gifts for the golf lovers in your life. You can purchase them online at www.clubhouse247golf.com/giftcard/purchase or stop by either of our locations. They never expire and can be used for simulator time, events, or lessons.',
  ARRAY['gift', 'card', 'certificate', 'present', 'giftcard'],
  0.85,
  true,
  true,
  'Gift Card Inquiries',
  'Automatically respond to gift card purchase questions with link to purchase page',
  '🎁',
  'customer_service'
) ON CONFLICT (pattern_signature) DO UPDATE
SET 
  automation_name = EXCLUDED.automation_name,
  automation_description = EXCLUDED.automation_description,
  automation_icon = EXCLUDED.automation_icon,
  automation_category = EXCLUDED.automation_category;

-- Hours Pattern
INSERT INTO decision_patterns (
  pattern_type,
  trigger_text,
  response_template,
  trigger_keywords,
  confidence_score,
  auto_executable,
  is_active,
  automation_name,
  automation_description,
  automation_icon,
  automation_category
) VALUES (
  'hours',
  'What are your hours?',
  'Our Bedford location is open 9am-11pm daily, and our Dartmouth location is open 8am-10pm daily. You can book a bay anytime at www.skedda.com/clubhouse247. We recommend booking in advance, especially for weekends!',
  ARRAY['hours', 'open', 'close', 'time', 'when'],
  0.85,
  true,
  true,
  'Hours & Location Info',
  'Automatically provide hours and location information',
  '🕐',
  'customer_service'
) ON CONFLICT (pattern_signature) DO UPDATE
SET 
  automation_name = EXCLUDED.automation_name,
  automation_description = EXCLUDED.automation_description,
  automation_icon = EXCLUDED.automation_icon,
  automation_category = EXCLUDED.automation_category;

-- Booking Pattern
INSERT INTO decision_patterns (
  pattern_type,
  trigger_text,
  response_template,
  trigger_keywords,
  confidence_score,
  auto_executable,
  is_active,
  automation_name,
  automation_description,
  automation_icon,
  automation_category
) VALUES (
  'booking',
  'How do I book a bay?',
  'You can book a simulator bay online at www.skedda.com/clubhouse247. Select your preferred location (Bedford or Dartmouth), choose your date and time, and complete the booking. We recommend booking in advance, especially for weekends and evenings!',
  ARRAY['book', 'reserve', 'reservation', 'simulator', 'bay'],
  0.85,
  true,
  true,
  'Booking Assistance',
  'Help customers with booking simulator bays',
  '📅',
  'customer_service'
) ON CONFLICT (pattern_signature) DO UPDATE
SET 
  automation_name = EXCLUDED.automation_name,
  automation_description = EXCLUDED.automation_description,
  automation_icon = EXCLUDED.automation_icon,
  automation_category = EXCLUDED.automation_category;

-- Pricing Pattern
INSERT INTO decision_patterns (
  pattern_type,
  trigger_text,
  response_template,
  trigger_keywords,
  confidence_score,
  auto_executable,
  is_active,
  automation_name,
  automation_description,
  automation_icon,
  automation_category
) VALUES (
  'pricing',
  'How much does it cost?',
  'Our simulator bay rates are $65/hour. We also offer memberships starting at $199/month which include discounted rates and other perks. You can view all pricing and membership options at www.clubhouse247golf.com or ask our staff for details!',
  ARRAY['price', 'cost', 'rate', 'much', 'expensive', 'charge'],
  0.80,
  true,
  false, -- Start disabled for review
  'Pricing Information',
  'Provide pricing and membership information',
  '💰',
  'customer_service'
) ON CONFLICT (pattern_signature) DO UPDATE
SET 
  automation_name = EXCLUDED.automation_name,
  automation_description = EXCLUDED.automation_description,
  automation_icon = EXCLUDED.automation_icon,
  automation_category = EXCLUDED.automation_category;

-- ============================================
-- STEP 4: Update Existing Patterns with Card Info
-- ============================================

-- Update any existing patterns without automation info
UPDATE decision_patterns
SET 
  automation_name = CASE 
    WHEN pattern_type = 'gift_cards' THEN 'Gift Card Inquiries'
    WHEN pattern_type = 'hours' THEN 'Hours & Location Info'
    WHEN pattern_type = 'booking' THEN 'Booking Assistance'
    WHEN pattern_type = 'tech_issue' THEN 'Technical Support'
    WHEN pattern_type = 'membership' THEN 'Membership Questions'
    WHEN pattern_type = 'pricing' THEN 'Pricing Information'
    ELSE CONCAT('Auto Response: ', LEFT(trigger_text, 30))
  END,
  automation_description = CONCAT('Automatically respond to: "', LEFT(trigger_text, 60), '..."'),
  automation_icon = CASE 
    WHEN pattern_type = 'gift_cards' THEN '🎁'
    WHEN pattern_type = 'hours' THEN '🕐'
    WHEN pattern_type = 'booking' THEN '📅'
    WHEN pattern_type = 'tech_issue' THEN '🔧'
    WHEN pattern_type = 'membership' THEN '💳'
    WHEN pattern_type = 'pricing' THEN '💰'
    ELSE '💬'
  END,
  automation_category = CASE 
    WHEN pattern_type IN ('tech_issue') THEN 'technical'
    ELSE 'customer_service'
  END
WHERE automation_name IS NULL;

-- ============================================
-- STEP 5: Verify Configuration
-- ============================================
SELECT 
  config_key,
  config_value,
  description
FROM pattern_learning_config
WHERE config_key IN ('enabled', 'shadow_mode', 'min_confidence_to_suggest', 'min_confidence_to_act')
ORDER BY config_key;

-- Show pattern count and status
SELECT 
  COUNT(*) as total_patterns,
  SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_patterns,
  AVG(confidence_score) as avg_confidence
FROM decision_patterns;

-- Show sample patterns
SELECT 
  automation_name,
  automation_icon,
  confidence_score,
  is_active,
  execution_count
FROM decision_patterns
ORDER BY confidence_score DESC
LIMIT 10;

-- ============================================
-- Success! V3-PLS is now enabled
-- Patterns will be learned from operator responses
-- View and manage them in the V3-PLS page
-- ============================================