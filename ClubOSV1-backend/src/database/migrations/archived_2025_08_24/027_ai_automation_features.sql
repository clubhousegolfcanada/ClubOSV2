-- AI Automation Features and Toggles
-- Stores configuration for automated AI responses and actions

-- Main automation features table
CREATE TABLE IF NOT EXISTS ai_automation_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'gift_cards', 'trackman_reset'
  feature_name VARCHAR(255) NOT NULL, -- Display name
  description TEXT,
  category VARCHAR(50) NOT NULL, -- 'customer_service', 'technical', 'booking', 'emergency'
  enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}', -- Feature-specific configuration
  required_permissions VARCHAR(50)[], -- Array of required roles
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Track automation usage for analytics
CREATE TABLE IF NOT EXISTS ai_automation_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID REFERENCES ai_automation_features(id),
  conversation_id UUID, -- Reference to openphone_conversations if applicable
  trigger_type VARCHAR(50), -- 'automatic', 'manual', 'scheduled'
  input_data JSONB,
  output_data JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  execution_time_ms INTEGER,
  user_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Automation rules and patterns
CREATE TABLE IF NOT EXISTS ai_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID REFERENCES ai_automation_features(id),
  rule_type VARCHAR(50), -- 'keyword', 'pattern', 'intent'
  rule_data JSONB NOT NULL, -- Contains patterns, keywords, or intent configurations
  priority INTEGER DEFAULT 100,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_ai_features_enabled ON ai_automation_features(enabled);
CREATE INDEX idx_ai_features_category ON ai_automation_features(category);
CREATE INDEX idx_ai_usage_feature ON ai_automation_usage(feature_id);
CREATE INDEX idx_ai_usage_created ON ai_automation_usage(created_at DESC);
CREATE INDEX idx_ai_rules_feature ON ai_automation_rules(feature_id);

-- Insert initial automation features
INSERT INTO ai_automation_features (feature_key, feature_name, description, category, enabled, config, required_permissions) VALUES
-- Customer Service Automations
('gift_cards', 'Gift Card Inquiries', 'Automatically respond to gift card purchase questions with link to purchase page', 'customer_service', false, 
  '{"response_template": "You can purchase gift cards at www.clubhouse247golf.com/giftcard/purchase. Gift cards are available in various denominations and can be used for bay time, food, and beverages.", "minConfidence": 0.7}',
  ARRAY['admin', 'operator']),

-- Technical Automations  
('trackman_reset', 'Trackman Reset', 'Automatically reset frozen or unresponsive Trackman units via NinjaOne', 'technical', false,
  '{"requires_confirmation": true, "confirmation_message": "If you signed in to your Trackman account before starting, I can reset the system quickly and you can pick back up through the ''My Activities'' button. Let me know and I''ll reset it.", "ninjaone_script": "Restart-TrackMan"}',
  ARRAY['admin', 'operator']),

('simulator_reboot', 'Simulator PC Reboot', 'Remotely reboot simulator PCs when experiencing issues', 'technical', false,
  '{"requires_confirmation": true, "confirmation_message": "I can reboot the simulator PC. This will take 5-7 minutes and the bay will be unavailable during this time. Reply YES to proceed.", "ninjaone_script": "Reboot-SimulatorPC"}',
  ARRAY['admin']),

('tv_restart', 'TV System Restart', 'Restart TV systems when experiencing display issues', 'technical', false,
  '{"requires_confirmation": true, "confirmation_message": "I can restart the TV system. This will briefly interrupt the display. Reply YES to proceed.", "ninjaone_script": "Restart-TVSystem"}',
  ARRAY['admin', 'operator']),

-- Booking Automations
('booking_availability', 'Check Booking Availability', 'Automatically check and respond with available time slots', 'booking', false,
  '{"max_days_ahead": 14, "response_format": "simple"}',
  ARRAY['admin', 'operator', 'support']),

('booking_modification', 'Modify Bookings', 'Allow customers to modify their existing bookings via SMS', 'booking', false,
  '{"requires_confirmation": true, "allowed_modifications": ["time", "duration"], "advance_notice_hours": 2}',
  ARRAY['admin', 'operator']),

-- Information Automations
('hours_of_operation', 'Hours of Operation', 'Automatically respond with current hours', 'customer_service', false,
  '{"response_template": "We are open Monday-Thursday 11am-10pm, Friday 11am-11pm, Saturday 10am-11pm, and Sunday 10am-9pm.", "keywords": ["hours", "open", "close", "when are you"]}',
  ARRAY['admin', 'operator', 'support']),

('membership_info', 'Membership Information', 'Provide membership options and benefits', 'customer_service', false,
  '{"response_template": "We offer monthly memberships starting at $X. Benefits include priority booking, discounts on bay time, and exclusive member events. Visit our website or stop by to learn more!", "keywords": ["membership", "member", "monthly", "benefits"]}',
  ARRAY['admin', 'operator', 'support']),

-- Learning System
('learning_tracker', 'Learning Tracker', 'System feature that tracks unanswered queries and learns from staff responses', 'system', true,
  '{"description": "Automatically tracks customer messages that were not automated and learns when staff provides responses that could be automated in the future"}',
  ARRAY['admin']);

-- Add trigger for updating the updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_features_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_features_timestamp
  BEFORE UPDATE ON ai_automation_features
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_features_updated_at();

CREATE TRIGGER update_ai_rules_timestamp
  BEFORE UPDATE ON ai_automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_features_updated_at();