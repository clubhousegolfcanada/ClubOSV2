-- ClubAI remote restart state tracking on conversations
ALTER TABLE openphone_conversations
  ADD COLUMN IF NOT EXISTS clubai_restart_state VARCHAR(30),
  ADD COLUMN IF NOT EXISTS clubai_restart_location VARCHAR(50),
  ADD COLUMN IF NOT EXISTS clubai_restart_bay INTEGER,
  ADD COLUMN IF NOT EXISTS clubai_restart_command_id UUID;

-- Feature toggle: ClubAI remote restart (off by default)
INSERT INTO system_settings (key, value, description, updated_at)
VALUES (
  'clubai_remote_restart_enabled',
  'false',
  'When enabled, ClubAI can trigger TrackMan restarts via SMS conversation',
  CURRENT_TIMESTAMP
)
ON CONFLICT (key) DO NOTHING;
