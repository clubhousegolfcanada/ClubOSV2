# Core Functions Audit — ClubAI, Messages, Commands, TrackMan
**Date:** 2026-07-06 · **Auditor:** Senior-engineer pass (10 parallel domain auditors + direct code re-verification)
**Scope:** Read-only. No files changed. Focus weighted to ClubAI (highest priority), then Messages, Commands, TrackMan.
**Baseline:** `tsc --noEmit` clean on both backend and frontend. Risks are runtime, not type-level.

> Verification note: an automated multi-agent verification pass was interrupted by a monthly spend limit. All **critical** and **high** findings below were then re-verified by hand against the live source (file:line quoted). Medium findings are auditor-reported; a representative sample was hand-verified.

> **Remediation status (updated 2026-07-07):**
> - ✅ **Shipped in v1.35.11:** C1, C2, C3 (all three criticals).
> - ✅ **Shipped in v1.35.12:** H1, H2, H4, H10, H11, H14.
> - ⬜ **Still open:** H3, H5, H6, H7, H8, H9, H12, H13, H15, H16, H17 + the medium batch.

---

## Health scorecard

| Area | Grade | One-line |
|------|-------|----------|
| ClubAI core service | B− | Well-defended happy path; control-plane edges (approval-mode, escalation-tag, OpenAI-failure) leak |
| ClubAI webhook path | C | Careful dedup/lockouts, but ordering/durability holes + unauthenticated PII endpoints on the same router |
| ClubAI admin + UI | C+ | Well-guarded after 88bdff9a; draft approve/send flow is deterministically broken |
| ClubAI knowledge / RAG | C+ | Solid retrieval; the autonomous "auto-correction" learning loop can silently corrupt the KB |
| Messages backend | C+ | Core send works; approve-and-send broken, unread counts systematically wrong |
| Messages frontend | C | Functional; open thread never live-updates (mobile regression), switch race can mis-send |
| Commands page | B− | Rewired onto agent queue cleanly; optimistic "success" toasts hide dead bays |
| TrackMan tab / queue | C+ | Good queue design; nightly cron fires in wrong TZ, restarts offline bays with no escalation |

---

## CRITICAL (fix first)

### C1. Unauthenticated endpoints dump all customer SMS + PII to the public internet
**`ClubOSV1-backend/src/routes/openphone.ts:2273`** (`/debug/all`), **:2554** (`/debug/recent`), **:2160** (`/conversations/unprocessed`), **:2187** (`PUT /conversations/:id/processed`), **:2473** (`/stats`).
The router is mounted plainly at `index.ts:281` (`app.use('/api/openphone', openphoneRoutes)`) with no router-level `authenticate`. These specific routes have no `authenticate`/`roleGuard` — the code even carries the comment `// Debug endpoint ... (no auth for debugging)`. They `SELECT phone_number, customer_name, employee_name, messages` (full SMS bodies).
**Failure:** `curl https://<backend>/api/openphone/debug/all` with **no token** returns the 100 most recent customer conversations — names, phone numbers, full message text — across ~5,000 customers. `/debug/recent?limit=1000` lets the caller page further. A PII breach reachable by anyone.
**Fix:** add `authenticate, roleGuard(['admin'])` to each, or delete the debug routes. There are already correctly-guarded twins (`/recent-conversations` at :2513 requires admin) — mirror them.

### C2. ClubAI draft approve/edit/reject always throws *after* the SMS is sent → retries double-text the customer
**`ClubOSV1-backend/src/routes/enhanced-patterns.ts:3103`** + schema **`database/migrations/361_clubai_draft_responses.sql:19`** (`reviewed_by INTEGER`).
The approve handler sends the SMS first (`openPhoneService.sendMessage`, ~:3085) then runs `UPDATE ... SET reviewed_by = $2` with `userId = req.user?.id`. User ids are **UUID** strings (`users.id` UUID; `auth.ts` sets `id: decoded.userId`), but the column is **INTEGER** → Postgres throws `invalid input syntax for type integer`. Route returns 500, draft stays `pending`.
**Failure:** In approval mode, operator clicks *Approve & Send* → customer receives the SMS → UPDATE throws → UI still shows the draft pending → operator clicks again → **customer gets the same SMS twice.**
**Fix:** change `reviewed_by` to `UUID` (or `TEXT`), and — critically — reorder to mark the row claimed *before* sending (see H-race below).

### C3. `markSuggestionAsSent` references `$2` with one bound param → approve-and-send always fails after sending
**`ClubOSV1-backend/src/services/messageAssistantService.ts:383`**
```sql
UPDATE message_suggestions SET sent = TRUE, sent_at = NOW() WHERE id = $2   -- params: [suggestionId]  (only $1 supplied)
```
Postgres rejects every call (`bind message supplies 1 parameters, but prepared statement requires 2`). Called from `POST /api/messages/suggestions/:id/approve-and-send` (`messages.ts:1106`) **after** the SMS is delivered.
**Failure:** Operator taps *Approve & Send* on an AI suggestion → SMS delivered → this throws → operator sees "Failed to send", `suggestion.sent` never flips → taps again → **duplicate SMS.**
**Fix:** `WHERE id = $1`. (One-character fix.)

---

## HIGH

### ClubAI

**H1. Approval mode is bypassed for tool calls** — `openphone.ts:1173`. The `restart_trackman`/`reboot_radar` block checks only `clubaiShadow`; `clubaiApprovalMode` is checked later (:1287), after this block has already `return`ed. In approval mode (used during rollout to vet all output), a confirmed restart intent **executes the hardware restart and texts the customer autonomously.** Fix: check `clubaiApprovalMode` at the top of the tool block and route to the draft path.

**H2. GPT-authored confirmation prompt sent without the `- ClubAI` signature** — `openphone.ts:1184`. `const confirmMsg = clubaiResult.response || (…fallback ending ' - ClubAI')`. When GPT emits text alongside the tool call, that text is sent **unsigned**. The outbound webhook (`openphone.ts:642`) treats any unsigned outbound as **operator activity** → sets operator-lockout → disables ClubAI. Customer's "yes" then hits a locked-out ClubAI → restart flow orphaned. Fix: always append the signature to tool confirmation messages.

**H3. Restart follow-up is an in-memory `setTimeout(…,120000)`** — `openphone.ts:1221`. Railway restarts the process on **every git push**. Any restart triggered in the ~2 min before a deploy loses its timer: no success/failure follow-up SMS, and the **failure-escalation** (`clubai_escalated=true, conversation_locked=true`) never runs. The timer also only handles `completed`/`failed` — a **`pending`** command (offline bay) never triggers any follow-up at all. Fix: move the follow-up to a durable job (a row the existing cron polls), covering non-terminal statuses.

**H4. OpenAI API failure → total customer silence, no escalation** — `clubaiService.ts:598`. The catch returns `{ response: null, escalate: false }`. On timeout/429/5xx the customer gets **nothing** and **no operator is flagged** — at an unstaffed facility that's a silent dropped conversation. Fix: on OpenAI failure, escalate (lock + flag) so a human is alerted.

**H5. `[ESCALATE TO HUMAN]` is a case-sensitive exact-bracket match** — `clubaiService.ts:446`. `rawResponse.match(/\[ESCALATE TO HUMAN\]…/)`. A variant (`[Escalate to human]`, `**[ESCALATE TO HUMAN]**`, `[ESCALATE TO A HUMAN]`) **fails to match**, so the tag both (a) leaks verbatim into the customer SMS and (b) silently drops the escalation. Fix: case-insensitive/looser detection, or make GPT emit a structured signal.

**H6. Draft approval has no atomic claim (check-then-send race)** — `enhanced-patterns.ts:3070`. `SELECT … WHERE status='pending'` → slow network send → `UPDATE status='approved'`. No `UPDATE … WHERE status='pending' RETURNING` claim and no FE in-flight guard (`OperationsClubAI.tsx`). Two operators (or one double-tap on the 10s-poll PWA) both send → **customer gets the reply twice.** Same pattern in `/edit`. Fix: atomic claim before send.

**H7. Auto-correction learning corrupts the live knowledge base unsupervised** — `clubaiService.ts:777` & `:793`. On every operator SMS within 30 min of an AI reply, if gpt-4o-mini classifies it a "correction": (a) the raw customer+operator text is saved as `source_type='manual'` at 0.95 confidence and injected into *other* customers' prompts under "VERIFIED CORRECTIONS FROM THE TEAM (USE THESE OVER ANY OTHER)"; (b) up to 5 existing entries matching at a **loose 0.6** similarity are set `is_active=FALSE`. One misclassification silently deactivates correct canonical knowledge and promotes conversation-specific text globally — **no human review, and deactivated entries vanish from the admin list.** Fix: route auto-corrections to a review queue instead of writing live; raise the deactivation threshold and scope it.

**H8. Knowledge-store read/tamper endpoints have no role guard** — `routes/knowledge-store.ts:133` (and `/get/:key` :98, `/keys` :197, `/test` :29 which *writes*, `/confidence` :332). Router applies `authenticate` only; these five lack `roleGuard` while their siblings (`/set`,`/all`,`/bulk`) have it. `authenticate` accepts `customer`/`kiosk`/`contractor` JWTs. **Any of ~5,000 customers can enumerate and read internal SOPs and POST confidence changes.** Fix: add `roleGuard(['admin','operator'])`.

### Messages

**H9. Blocking GPT-4 call on every operator `/send`** — `messages.ts:684` (handler starts :563, response :852). `await analyzer.extractConversationContext(messages)` — a GPT-4 completion (default ~10min SDK timeout) for **disabled** V3-PLS pattern-learning — runs before `res.json`. Operator sees a 5–15s spinner after the SMS already left → may resend (duplicate). Fix: remove the dead block or make it fire-and-forget.

**H10. Unread counts are systematically wrong** — `openphone.ts:812`. The `existingConv` SELECT (:749) never selects `unread_count`, so `currentUnreadCount` is always 0 → inbound always sets it to 1 (3 unread texts still show 1), and **any outbound — including ClubAI's own auto-reply — resets it to 0.** Overnight exchanges show zero unread; operators never review them. Fix: add `unread_count` to the SELECT.

**H11. Open conversation thread never live-updates** — `ClubOSV1-frontend/src/pages/messages.tsx:362`. SSE `new_message` and the 30s poll only call `loadConversations()`, which refreshes the sidebar and **explicitly preserves old messages** (`{ ...updated, messages: prevConversation?.messages }`, :621). The thread's `messages` only load on click. On mobile (sidebar hidden while viewing a thread), an operator watching a thread **never sees the customer's reply.** Fix: refresh the open thread's messages on SSE/poll.

**H12. Conversation-switch stale-response race** — `messages.tsx:751`. The in-flight `/full-history` fetch is aborted only on the cache-miss branch. Click A (slow) → click B (cache hit, no abort) → A's late response unconditionally overwrites header/thread/`selectedConversation` back to A. Operator, now typing to "B", **hits send and the reply goes to A.** Fix: abort/guard the stale response regardless of cache path.

**H13. Operator JWT leaked into production logs** — `messages.tsx:354` + `middleware/requestLogger.ts:32`. SSE auth passes the raw JWT as `?token=…`; the global request logger logs `query: req.query` at info level → **every operator's bearer token lands in Railway logs.** Fix: don't log `req.query` (or redact `token`); consider a short-lived SSE ticket instead of the full JWT.

### TrackMan

**H14. Nightly auto-restart cron fires in the wrong timezone** — `jobs/trackmanRestart.ts:35`. `cron.schedule(cronExpr, …)` with **no `{ timezone }`** (the radar job at `radarReboot.ts:63` correctly pins `America/Halifax`). Migration 368 seeds `trackman_auto_restart` **enabled by default**, cron `0 3 * * *`; the job is started at boot (`index.ts:816`). Railway runs UTC → 3am UTC ≈ **11pm–midnight Atlantic → every bay gets a TrackMan restart mid-round, nightly.** Fix: pass `{ timezone: 'America/Halifax' }`.

**H15. Restarts queued for offline bays with no liveness check → customer told "restarting now", then ghosted** — `services/trackmanRestartService.ts:110`. `triggerRestart()` validates location/bay/device/radar-capability/cooldown but never checks `last_seen_at` (zero references). If the agent is offline the INSERT still returns `{success:true}` → ClubAI texts "Restarting now" → command sits `pending` forever → the 120s follow-up (which only handles `completed`/`failed`) never fires. **Silent dead end.** Fix: check heartbeat freshness before returning success; treat stale agents as failure and escalate.

**H16. Hardcoded fallback setup secret allows bay-device hijack** — `routes/trackman-remote.ts:397`. `const SETUP_SECRET = process.env.TRACKMAN_SETUP_SECRET || 'clubhouse247-trackman-setup'` — committed to source and "baked into the exe". `/self-register` is otherwise unauthenticated and **regenerates the api_key** for an existing location+bay. Anyone with the string re-registers a bay, rotating its key → the real agent is locked out and the attacker's key can report false completions. Fix: require the env var (no fallback); don't rotate an existing device's key on re-register without stronger proof.

### Commands

**H17. Optimistic success reporting hides dead bays** — `RemoteActionsBar.tsx:155`, `commands.tsx:848`. Backend returns success when a command is merely **queued** (never checks agent online), and two of three UI entry points never poll the outcome. A powered-off bay PC still produces a confident "success"/"back online in 3–5 minutes" toast. Fix: poll command status (the `/execute` path already can) and reflect the real terminal state.

---

## MEDIUM (grouped — auditor-reported, sample-verified)

**ClubAI / webhook**
- `openphone.ts:240` — webhook signature verification **fails open** when `OPENPHONE_WEBHOOK_SECRET` is unset (verify it's set in prod; prefer fail-closed).
- `openphone.ts:1191` — hardware restart trusts GPT-asserted `customer_confirmed` with no server-side confirmation state/expiry.
- `openphone.ts:1145` — two inbound texts 3–10s apart can start parallel GPT calls before the first reply is stored (double-reply).
- `openphone.ts:1034` — safety auto-responses (negative sentiment / rapid / AI-limit) send SMS **before** the ClubAI config is read → fire even when ClubAI is disabled or in shadow mode.
- `openphone.ts:1513` — operator lockout silently capped at 2h for new-conversation windows regardless of configured `operatorLockoutHours`.
- `openphone.ts:368` — dedup key written to Redis **before** the message is persisted; a crash/deploy mid-handler + the outer catch returning 200 = permanent silent message loss.
- `openphone.ts:72` — content-based dedup (phone + first 100 chars, 300s) drops legitimate repeats: a customer's second "yes"/"hello?" within 5 min, or the same outbound text to two customers.
- `clubaiService.ts:37` — one transient DB failure at prompt load pins the file-fallback prompt, discarding admin edits until next deploy.
- `clubaiService.ts:169` — the admin **"Max Messages" slider is a no-op**: runtime reads only `process.env.CLUBAI_MAX_MESSAGES`, never the `clubai_max_messages` DB key the UI writes.
- `clubaiService.ts:417` — tool-call arg JSON parse failure yields `args={}` → customer texted "Got it — undefined Box undefined".
- `services/openphoneService.ts:363` — `storeOutboundMessage` selects the conversation with **no ORDER BY/LIMIT** and writes `rows[0]`; repeat customers with gapped threads get outbound stored on an arbitrary/old row (webhook reads newest via `ORDER BY updated_at DESC` → mismatch).
- `services/openphoneService.ts:284` — DB failure *after* a successful send is misreported as a send failure (and logged as a "failed" message).

**ClubAI admin views**
- `enhanced-patterns.ts:2692` — `clubai-conversations` filters broken by SQL OR/AND precedence: "today/escalated/active" all return the unfiltered set.
- `enhanced-patterns.ts:2719` — conversation/escalation views return the **oldest** 30/20 messages (`ORDER BY ASC LIMIT`) — newest dropped on long threads.
- `enhanced-patterns.ts:3220` — operator replies never written to `conversation_messages`, so `operator_responded` stays false → **escalation queue never auto-resolves.**
- `enhanced-patterns.ts:3082` — approve reports "Draft approved and sent" even when `OPENPHONE_DEFAULT_NUMBER` is unset and nothing was sent.
- `enhanced-patterns.ts:3341` — editing a knowledge entry keeps the stale embedding when regeneration fails, yet returns success.

**RAG**
- `clubaiKnowledgeService.ts:324` — knowledge inserted with NULL embedding on OpenAI failure is reported success but is invisible to RAG forever.
- `migrations/360_clubai_knowledge.sql:112` — vector search is an O(N) full-table plpgsql cosine scan, computed twice per row, run 3× per inbound SMS.

**Messages**
- `messages.ts:898` — `PUT /conversations/:phone/read` has no roleGuard (any role can zero unread counts).
- `messages.ts:1030` — approve-and-send "already sent" guard is non-atomic → concurrent clicks duplicate SMS.
- `MessagesCardV3.tsx:157` — Enter key can double-send from the dashboard card.
- `messages.tsx:780` — deliberately aborted history fetch shows a spurious error toast and re-selects the old conversation.

**TrackMan / Commands**
- `trackmanRestartService.ts:145` — per-device cooldown is a check-then-insert TOCTOU (no txn/unique constraint) → simultaneous ClubAI+operator triggers double-restart a bay.
- `jobs/trackmanRestart.ts:98` — `acknowledged` commands are never expired; expiry runs ~once/day → stuck commands, misleading history.
- `commands.tsx:456` — River Oaks Box 2 missing from the Commands page (no PC/radar reboot possible for that bay).
- `commands.tsx:628` — backend failure reasons (cooldown, no device) dropped; operator sees generic axios error text.

**Cross-cutting**
- `middleware/rateLimiter.ts:12` — IP rate limiting (incl. auth brute-force limiter) bypassable via spoofed `X-Forwarded-For`.
- `utils/openphone-rate-limiter.ts:123` — globally serialized OpenPhone queue with no HTTP timeout → one hung request stalls all SMS.

---

## What's solid (don't "fix")
- ClubAI happy path is genuinely well-defended: zero-context escalation guard, hallucinated-number blocking, closer suppression, debounce, Redis dedup, operator lockouts.
- ClubAI admin routes are consistently `authenticate + roleGuard` after commit 88bdff9a; SQL is parameterized throughout (no injection found).
- TrackMan queue claim is atomic (`UPDATE … WHERE id=(SELECT … FOR UPDATE SKIP LOCKED)`-style), per-device API keys, machine-readable failure reasons, 42703 fallbacks for the in-flight radar migration, and the **radar** job is correctly TZ-pinned.
- NinjaOne dead branches were removed from the Commands UI (not left as fake-success paths).
- `unifiedKnowledgeService.ts` has **zero imports** — it's dead code despite CLAUDE.md naming it the "primary entry point" (doc drift, not a bug).

---

## Recommended remediation order
1. **C1** — lock down/delete the unauthenticated `/api/openphone/debug/*` + `/conversations/*` endpoints (live PII breach).
2. **C3** — one-char fix `messageAssistantService.ts:383` `$2`→`$1`.
3. **C2** — `reviewed_by` UUID + reorder claim-before-send.
4. **H10, H1, H4, H14, H15** — unread-count SELECT; approval-mode gate on tool calls; escalate on OpenAI failure; cron timezone; bay liveness check.
5. **H11, H2, H6, H7, H8, H13** — thread live-update; sign tool confirmations; atomic draft claim; auto-correction review queue; knowledge-store role guards; stop logging JWTs.
6. **H3, H9, H16, H17, H5, H12** — durable follow-up job; drop the blocking analyzer; setup-secret hardening; real command-status polling; robust escalation-tag detection; switch-race guard.
7. Medium batch as capacity allows.
