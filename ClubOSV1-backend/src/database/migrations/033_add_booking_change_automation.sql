-- Add booking change automation feature
INSERT INTO ai_automation_features (
  feature_key, 
  feature_name, 
  description, 
  category, 
  enabled, 
  config, 
  required_permissions
) VALUES (
  'booking_change',
  'Booking Change Requests',
  'Automatically respond to booking change/modification requests',
  'booking',
  false,
  jsonb_build_object(
    'minConfidence', 0.7,
    'maxResponses', 1,
    'responseSource', 'database',
    'hardcodedResponse', 'No problem! Just let us know what change you need and we''ll have it updated within an hour.',
    'allowFollowUp', false
  ),
  ARRAY['admin', 'operator']
);

-- Add the booking change knowledge to assistant_knowledge table
-- This ensures the Booking & Access assistant knows the proper response
INSERT INTO assistant_knowledge (assistant_id, route, knowledge, version)
VALUES (
  'booking_access_assistant', -- This will be replaced with actual assistant ID
  'Booking & Access',
  jsonb_build_object(
    'booking_changes', jsonb_build_object(
      'response', 'No problem! Just let us know what change you need and we''ll have it updated within an hour.',
      'policy', 'We accommodate all booking changes when possible. Changes are processed within 1 hour during business hours.',
      'follow_up', 'After initial response, staff will handle the specific change request.'
    )
  ),
  '1.0'
) ON CONFLICT (assistant_id) 
DO UPDATE SET 
  knowledge = assistant_knowledge.knowledge || EXCLUDED.knowledge,
  updated_at = CURRENT_TIMESTAMP;

-- Add feature to all users' settings to show allowFollowUp toggle
ALTER TABLE ai_automation_features 
ADD COLUMN IF NOT EXISTS allow_follow_up BOOLEAN DEFAULT true;

-- Update existing features to have allow_follow_up = true by default
UPDATE ai_automation_features 
SET allow_follow_up = true 
WHERE feature_key IN ('gift_cards', 'trackman_reset');

-- Set booking_change to not allow follow-up by default
UPDATE ai_automation_features 
SET allow_follow_up = false 
WHERE feature_key = 'booking_change';