-- Track when a missed-call auto-text was sent to prevent duplicates
-- 1-hour cooldown per customer phone number

ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS missed_call_text_sent_at TIMESTAMPTZ;
