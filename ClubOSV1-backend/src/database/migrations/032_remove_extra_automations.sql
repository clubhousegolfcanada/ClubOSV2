-- Remove the extra automations that weren't requested
-- Keep only gift_cards and trackman_reset as originally requested

DELETE FROM ai_automation_usage 
WHERE feature_id IN (
  SELECT id FROM ai_automation_features 
  WHERE feature_key IN ('hours_of_operation', 'membership_info', 'booking_availability', 'booking_modification', 'simulator_reboot', 'tv_restart')
);

DELETE FROM ai_automation_rules 
WHERE feature_id IN (
  SELECT id FROM ai_automation_features 
  WHERE feature_key IN ('hours_of_operation', 'membership_info', 'booking_availability', 'booking_modification', 'simulator_reboot', 'tv_restart')
);

DELETE FROM ai_automation_features 
WHERE feature_key IN ('hours_of_operation', 'membership_info', 'booking_availability', 'booking_modification', 'simulator_reboot', 'tv_restart');

-- Update the learning tracker description
UPDATE ai_automation_features 
SET description = 'System feature that tracks unanswered queries and learns from staff responses for gift cards and technical issues'
WHERE feature_key = 'learning_tracker';