# Reboot Radar — ClubOS side

**Source:** Handoff from the TrackMan-Tools agent session (agent v1.2.0 ships radar support). Initially reconstructed from the handoff summary; **subsequently verified line-by-line against the authoritative spec** at `github.com/clubhousegolfcanada/trackman-tools` → `docs/clubosv2-reboot-radar-plan.md` once that repo was pushed. One deviation found and fixed (v1.35.8): device view now shows "Not detected" when a v1.2.0 agent reports a null `radar_ip`, instead of hiding the row. Core instruction from the handoff: **`reboot_radar` is just another command exactly like restart/reboot — mirror those paths.**

## Contract (from the shipped agent, per handoff)

- **`POST /api/trackman-remote/heartbeat`** — agent adds two fields: `radar_ip` (self-discovered) and `radar_reachable` (boolean). **Older agents (pre-v1.2.0) omit them — the handler must tolerate absence** (keep last-known values; do not clear).
- **`GET /api/trackman-remote/poll`** — must be able to return `action: "reboot_radar"`. (Poll already passes `command_type` through verbatim — storing the command type as `reboot_radar` is sufficient.)
- **`POST /api/trackman-remote/report`** — unchanged shape.
- **No radar IPs configured server-side** — ClubOS only displays what the agent reports and enqueues commands.

## Changes

1. **Migration `373_reboot_radar.sql`** — `ALTER TABLE trackman_devices ADD COLUMN IF NOT EXISTS radar_ip VARCHAR(45), radar_reachable BOOLEAN`. `trackman_restart_commands.command_type` is VARCHAR(20) with no CHECK constraint, so `reboot_radar` (12 chars) needs no DDL.
2. **`trackmanRestartService.ts`** — add `'reboot_radar'` to `TrackmanCommandType` (bay-targeted, NOT location-level) and give it a 5-minute cooldown.
3. **`trackman-remote.ts` `/heartbeat`** — persist `radar_ip`/`radar_reachable` via `COALESCE` (absent → keep existing). Wrap in a 42703 fallback to the legacy UPDATE so heartbeats keep working between deploy and migration.
4. **`trackman-remote.ts` `GET /devices`** — return `radar_ip`/`radar_reachable` (same 42703 fallback pre-migration).
5. **`remoteActions.ts`** — map dashboard action `'reboot-radar'` → command type `'reboot_radar'`, label "Radar reboot", est. ~1 minute. Bay number required (not in LOCATION_ACTIONS).
6. **Frontend** — `api/remoteActions.ts`: add `'reboot-radar'` to the action union. `commands.tsx`: 4th per-bay button "Radar" with a destructive confirm ("disconnects everyone using this radar for ~1 minute") + the existing job-status polling. `TrackManPanel.tsx`: display radar IP + reachability per device (read-only).

## Judgment calls (not pinned by the handoff)

- **Cooldown: 5 min** (mirrors `restart`; the outage is ~1 min, shorter than a PC reboot's 10-min cooldown). Trivial to change in `COOLDOWN_MS`.
- **Button placement: Commands page per-bay grid** (where Sim/PC/Remote already live), radar info display in TrackManPanel. TrackManPanel's own `/restart` endpoint doesn't carry command types, so the button routes through `/api/remote-actions/execute` like the other bay actions.
- Older agents that receive a `reboot_radar` command no-op it and the command expires after 10 min — the documented queue behavior for unknown types.

## Acceptance checklist

- [ ] Migration applied (`railway run npm run db:migrate`)
- [ ] v1.2.0 agent heartbeat populates `radar_ip`/`radar_reachable`; pre-v1.2.0 heartbeats still 200 and don't clear values
- [ ] TrackManPanel shows radar IP + reachability
- [ ] "Radar" button on Commands page queues a command; `/poll` returns `action: "reboot_radar"`; agent reports completion; status polling shows completed
- [ ] Second click within 5 min is blocked by cooldown
- [ ] **End-to-end validation (real radar reboot on an idle bay) is a bay-PC test — belongs to the TrackMan-Tools repo, per the handoff.**
