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
-- STEP 3: No Seed Patterns - System Learns from Real Operator Responses
-- ============================================
-- The system will learn patterns automatically when operators respond to customers.
-- No fake/example patterns are created.
-- 
-- When an operator responds to a customer message:
-- 1. System analyzes the Q&A pair
-- 2. Creates a pattern from the real response
-- 3. Pattern appears in V3-PLS page for review
-- 4. Operator can enable/disable as needed
--
-- Example: When operator responds about gift cards with the URL,
-- that exact response becomes the pattern.

-- ============================================
-- STEP 3: Update Existing Patterns with Card Info (if any exist)
-- ============================================

-- Update any existing patterns (learned from real responses) without automation info
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
-- STEP 4: Verify Configuration
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

-- Show existing patterns (if any were already learned)
SELECT 
  automation_name,
  automation_icon,
  confidence_score,
  is_active,
  execution_count,
  trigger_text
FROM decision_patterns
ORDER BY execution_count DESC, confidence_score DESC
LIMIT 10;

-- ============================================
-- Success! V3-PLS is now enabled
-- 
-- The system will now:
-- 1. Learn from every operator response to customers
-- 2. Create patterns based on REAL conversations
-- 3. Show learned patterns in V3-PLS page as automation cards
-- 4. No fake data - only real operator responses
-- ============================================