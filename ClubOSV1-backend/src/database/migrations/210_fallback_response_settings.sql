-- Migration: Add Fallback Response Settings
-- Description: Adds configurable fallback responses and enable/disable setting
-- Author: Claude
-- Date: 2025-09-06

-- UP
-- Add fallback response settings to pattern_learning_config
INSERT INTO pattern_learning_config (config_key, config_value, description, created_at, updated_at)
VALUES 
  -- Enable/disable all fallback responses
  ('enable_fallback_responses', 'false', 
   'Enable or disable all fallback responses when AI cannot process a message', NOW(), NOW()),
  
  -- Individual fallback messages (all disabled by default)
  ('fallback_booking_&_access', '', 
   'Fallback message for booking and access related queries', NOW(), NOW()),
  
  ('fallback_emergency', '', 
   'Fallback message for emergency situations', NOW(), NOW()),
  
  ('fallback_techsupport', '', 
   'Fallback message for technical support issues', NOW(), NOW()),
  
  ('fallback_brandtone', '', 
   'Fallback message for brand and marketing queries', NOW(), NOW()),
  
  ('fallback_general', '', 
   'General fallback message when no specific route matches', NOW(), NOW())
ON CONFLICT (config_key) DO UPDATE 
SET config_value = EXCLUDED.config_value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- DOWN
DELETE FROM pattern_learning_config 
WHERE config_key IN (
  'enable_fallback_responses',
  'fallback_booking_&_access',
  'fallback_emergency',
  'fallback_techsupport',
  'fallback_brandtone',
  'fallback_general'
);