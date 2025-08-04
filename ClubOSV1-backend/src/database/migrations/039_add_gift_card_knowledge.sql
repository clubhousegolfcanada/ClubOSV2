-- Add gift card information to assistant knowledge
-- This ensures the Booking & Access assistant can properly respond to gift card inquiries

-- First, ensure the assistant_knowledge table exists
CREATE TABLE IF NOT EXISTS assistant_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_type VARCHAR(100) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  source VARCHAR(50) DEFAULT 'manual',
  confidence DECIMAL(3,2) DEFAULT 0.95,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  created_by VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  automation_key VARCHAR(100),
  metadata JSONB DEFAULT '{}'
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_type ON assistant_knowledge(assistant_type);
CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_active ON assistant_knowledge(is_active);
CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_automation ON assistant_knowledge(automation_key);

-- Add gift card knowledge entries
INSERT INTO assistant_knowledge (assistant_type, question, answer, source, confidence, created_by, automation_key) VALUES
-- General gift card inquiry
('booking & access', 'How can I purchase a gift card?', 'You can purchase gift cards online at www.clubhouse247golf.com/giftcard/purchase. Gift cards are available in various denominations and can be used for bay time, food, and beverages at any Clubhouse 24/7 Golf location.', 'system', 0.99, 'system', 'gift_cards'),

('booking & access', 'Do you sell gift cards?', 'Yes! We offer gift cards that make perfect gifts for golf enthusiasts. You can purchase them online at www.clubhouse247golf.com/giftcard/purchase. They''re available in various amounts and can be used for bay time, food, and beverages.', 'system', 0.99, 'system', 'gift_cards'),

('booking & access', 'Can I buy a gift certificate?', 'Absolutely! We have gift cards available for purchase at www.clubhouse247golf.com/giftcard/purchase. They come in various denominations and are perfect for birthdays, holidays, or any special occasion. The recipient can use them for bay time, food, and beverages.', 'system', 0.99, 'system', 'gift_cards'),

('booking & access', 'Looking for a gift for someone', 'Gift cards are a great option! You can purchase Clubhouse 24/7 Golf gift cards at www.clubhouse247golf.com/giftcard/purchase. They''re available in various amounts and can be used for golf simulator time, food, and beverages at any of our locations.', 'system', 0.95, 'system', 'gift_cards'),

-- Gift card usage
('booking & access', 'How do I use a gift card?', 'To use your gift card, simply present it at the time of payment. Gift cards can be used for bay time, food, and beverages at any Clubhouse 24/7 Golf location. If you have any issues, our staff will be happy to help!', 'system', 0.95, 'system', NULL),

('booking & access', 'Can I check my gift card balance?', 'To check your gift card balance, please visit us in person or call your local Clubhouse 24/7 Golf location. Our staff will be happy to look up your current balance.', 'system', 0.95, 'system', NULL),

-- Prevent duplicate entries
ON CONFLICT (assistant_type, question) DO UPDATE 
SET answer = EXCLUDED.answer,
    updated_at = NOW(),
    confidence = EXCLUDED.confidence;

-- Update any existing gift_cards automation to use AI assistant by default
UPDATE ai_automation_features 
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{responseSource}',
  '"database"'::jsonb
)
WHERE feature_key = 'gift_cards';

-- Ensure the feature has proper response limits
UPDATE ai_automation_features 
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{maxResponses}',
  '2'::jsonb
)
WHERE feature_key = 'gift_cards' 
AND NOT (config ? 'maxResponses');