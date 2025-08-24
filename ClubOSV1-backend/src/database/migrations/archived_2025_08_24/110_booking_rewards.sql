-- UP
CREATE TABLE IF NOT EXISTS booking_rewards (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  hubspot_deal_id VARCHAR(255) UNIQUE NOT NULL,
  booking_date TIMESTAMP NOT NULL,
  reward_date TIMESTAMP NOT NULL,
  location VARCHAR(100),
  box_number VARCHAR(50),
  cc_awarded INTEGER DEFAULT 25,
  status VARCHAR(20) DEFAULT 'pending', -- pending, awarded, failed, cancelled
  awarded_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_booking_rewards_status_date ON booking_rewards(status, reward_date);
CREATE INDEX idx_booking_rewards_user ON booking_rewards(user_id);
CREATE INDEX idx_booking_rewards_hubspot ON booking_rewards(hubspot_deal_id);

-- Add booking_reward to transaction types if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type 
    WHERE typname = 'transaction_type' 
    AND typtype = 'e'
  ) THEN
    -- Type doesn't exist, skip
    NULL;
  ELSE
    -- Add booking_reward to existing enum if not already there
    ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'booking_reward';
  END IF;
END $$;

-- DOWN
DROP TABLE IF EXISTS booking_rewards;