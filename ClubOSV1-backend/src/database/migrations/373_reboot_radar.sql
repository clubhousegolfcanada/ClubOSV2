-- Radar reboot support (TrackMan agent v1.2.0+)
-- The agent self-discovers its radar's IP and reports it via /heartbeat.
-- ClubOS only displays and enqueues — no radar IPs are configured server-side.
ALTER TABLE trackman_devices
  ADD COLUMN IF NOT EXISTS radar_ip VARCHAR(45),
  ADD COLUMN IF NOT EXISTS radar_reachable BOOLEAN;

-- No change needed for the command queue: trackman_restart_commands.command_type
-- is VARCHAR(20) with no CHECK constraint, so 'reboot_radar' is already storable.
