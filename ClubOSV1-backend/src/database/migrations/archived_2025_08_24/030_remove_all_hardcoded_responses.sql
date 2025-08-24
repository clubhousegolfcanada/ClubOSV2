-- Remove all hardcoded response templates - automations should use assistant knowledge
-- This ensures responses come from the database or OpenAI assistants, not hardcoded strings

-- Gift cards - already updated in previous migration
-- Just ensure it doesn't have response_template
UPDATE ai_automation_features 
SET config = config - 'response_template'
WHERE feature_key = 'gift_cards';

-- Hours of operation
UPDATE ai_automation_features 
SET config = config - 'response_template',
    description = 'Automatically respond to hours questions using assistant knowledge'
WHERE feature_key = 'hours_of_operation';

-- Membership info
UPDATE ai_automation_features 
SET config = config - 'response_template',
    description = 'Automatically respond to membership questions using assistant knowledge'  
WHERE feature_key = 'membership_info';

-- Update any other features that might have response_template
UPDATE ai_automation_features
SET config = config - 'response_template'
WHERE config ? 'response_template';