-- Migration: Add Boxes Reward System
-- Creates tables for mystery box rewards system

-- Create boxes table
CREATE TABLE IF NOT EXISTS boxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'available', -- available, opened, expired
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    opened_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    reward_type VARCHAR(50), -- club_coins, free_hour, merch, voucher
    reward_value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create box_rewards table for tracking what was earned
CREATE TABLE IF NOT EXISTS box_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    box_id UUID NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
    reward_type VARCHAR(50) NOT NULL,
    reward_name VARCHAR(255) NOT NULL,
    reward_value JSONB NOT NULL,
    voucher_code VARCHAR(50),
    expires_at TIMESTAMP WITH TIME ZONE,
    claimed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create box_progress table for tracking progress towards next box
CREATE TABLE IF NOT EXISTS box_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    current_progress INTEGER DEFAULT 0,
    required_progress INTEGER DEFAULT 5, -- 5 bookings for next box
    last_booking_date TIMESTAMP WITH TIME ZONE,
    total_boxes_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_boxes_user_status ON boxes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_boxes_expires ON boxes(expires_at);
CREATE INDEX IF NOT EXISTS idx_box_rewards_box ON box_rewards(box_id);
CREATE INDEX IF NOT EXISTS idx_box_progress_user ON box_progress(user_id);

-- Add trigger to update timestamps
CREATE OR REPLACE FUNCTION update_boxes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_boxes_timestamp
    BEFORE UPDATE ON boxes
    FOR EACH ROW
    EXECUTE FUNCTION update_boxes_updated_at();

CREATE TRIGGER update_box_progress_timestamp
    BEFORE UPDATE ON box_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_boxes_updated_at();

-- Initialize box progress for existing users
INSERT INTO box_progress (user_id, current_progress, required_progress)
SELECT id, 0, 5 FROM users WHERE role = 'customer'
ON CONFLICT (user_id) DO NOTHING;