-- Add command_type to support restart vs reboot
ALTER TABLE trackman_restart_commands
  ADD COLUMN IF NOT EXISTS command_type VARCHAR(20) DEFAULT 'restart';
