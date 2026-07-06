# Commands / ClubAI / TPS Restart — Audit Fix Plan

**Source:** Full audit of the Commands page, ClubAI, and the TrackMan (TPS) restart chain (July 6, 2026).
**Scope note:** Door-access findings are intentionally excluded — door control runs through the external Access Controller, not ClubOS.

## Phase 1 — Ship now (this commit)

### Fix 1: Role guards on ClubAI admin routes 🔴 SECURITY
- **Problem:** All ~25 `/api/patterns/clubai-*` routes in `src/routes/enhanced-patterns.ts` use `authenticate` only. `authenticate` accepts every role (admin, operator, support, kiosk, customer, contractor), so any logged-in customer could rewrite the ClubAI system prompt, toggle ClubAI config, approve/send SMS drafts, and read customer SMS conversations.
- **Fix:** Add `roleGuard(['admin', 'operator'])` to every `/clubai-*` route — same guard the V3-PLS routes in the same file already use. `roleGuard` is already imported.
- **Blast radius:** ClubAI admin UI lives under operator+ pages (`components/operations/clubai/`), so no legitimate caller loses access.

### Fix 2: "Reset All Bays" button is broken 🔴 BUG
- **Problem:** `commands.tsx` sends the `reset-all-trackman` trigger (which has no `location`/`bayNumber`) to `POST /api/remote-actions/execute`, which requires both → always 400. Also shows a second garbled confirm ("Reset undefined system at undefined?").
- **Fix:** Call the working endpoint `POST /api/trackman-remote/restart` with `{ all: true }` via the existing `trackmanRemoteAPI.restartAll()` client (already used by TrackManPanel). Single confirm dialog. Remove the dead `reset-all-trackman` trigger object.

### Fix 3: ClubAI cooldown misdetection 🔴 BUG
- **Problem:** `openphone.ts:1237` detects the restart cooldown by string-matching `error.includes('minutes ago') || error.includes('restarted')`, but since the per-command-cooldown refactor the service returns "Last restart was N **min ago**…" — no match. Customers who ask again within the 5-min cooldown are told the restart *failed* and the conversation is escalated + locked, when a restart is actually in flight.
- **Fix:** Add a typed `reason` field to `RestartResult` in `trackmanRestartService.ts` (`'cooldown' | 'invalid_location' | 'invalid_bay' | 'no_device' | 'invalid_command' | 'internal_error'`), set it on every failure path, and check `restartResult.reason === 'cooldown'` in `openphone.ts` instead of string-matching.

## Phase 2 — Follow-ups (separate commits, some need a product decision)

### Fix 4: `TRACKMAN_SETUP_SECRET` hardcoded fallback 🟠 SECURITY
`trackman-remote.ts:303` falls back to `'clubhouse247-trackman-setup'`. Anyone with that string can hit unauthenticated `/self-register` and overwrite a real bay's device row (rotates its API key → bricks the real agent's polling). **Recommended:** fail closed — if the env var is unset, disable `/self-register` with a clear 503 and log loudly at boot. ⚠️ Requires confirming `TRACKMAN_SETUP_SECRET` is set in Railway first, or new installer self-registrations break.

### Fix 5: Shadow/approval modes bypassed by restart tool 🟠
The `restart_trackman` handler (`openphone.ts:1167`) runs and returns before the shadow/approval checks — shadow mode still sends real SMS and triggers real restarts. **Recommended:** in shadow mode, log the would-be action and return. Approval mode needs a product decision (drafts can't represent tool calls): either execute normally (document it) or suppress the tool registration while approval mode is on.

### Fix 6: New-conversation path drops restart tool calls 🟠
The >1-hour-gap path (`openphone.ts:1563`) has no `functionCall` branch — a customer confirming a restart after a conversation-window split gets silence. **Recommended:** extract the restart handler into a shared function and call it from both paths.

### Fix 7: In-memory 120s follow-up 🟠
`setTimeout` follow-up is wiped by every Railway deploy and stays silent if the command is still pending at the 120s check. **Recommended:** DB-backed poller over `trackman_restart_commands` rows with `source='clubai'` (join back to the conversation via `clubai_restart_command_id`), sending the follow-up/escalation when the command reaches a terminal state or expires.

## Phase 3 — Cleanup / decisions (no urgency)
- Music/TV triggers are grouped but never rendered on the Commands page; queued `restart-music`/`restart-tv` commands expire unhandled. Decide: render buttons or remove the code path.
- `RemoteActionsBar` is imported in `_app.tsx` but never rendered — remove import + component (CLAUDE.md still lists it as active).
- Dead imports in `commands.tsx`: `doorAccessAPI`, `unifiDoorsAPI`, `actionWarnings`.
- `clubai_restart_state` columns are write-only (migration 369) — surface in operator UI or drop the writes.
- System prompt: Critical Rule 6 ("never ask for location/box") contradicts the TrackMan restart flow step 2 (must ask). Scope Rule 6 to escalations.
- Dual AI response limits (`CLUBAI_MAX_MESSAGES` env = 5 vs `aiResponseLimit` DB = 6) — consolidate.
- Missed-call after-hours check hardcodes UTC-4; Nova Scotia is UTC-3 during DST.
- No booking/identity check on SMS-triggered restarts — product decision (5-min cooldown + confirmation currently limit abuse).
