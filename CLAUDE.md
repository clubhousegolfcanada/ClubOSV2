## PROJECT CONTEXT
- **What**: Facility management system for Clubhouse 24/7 (golf simulators, pickleball courts, gyms)
- **Scale**: ~5,000 customers across 6 locations, 6-7 employees on operations/testing
- **Critical**: PRODUCTION system — all commits auto-deploy to live users immediately
- **Stack**: Next.js 15 + TypeScript + Tailwind (Vercel) | Express + PostgreSQL + Redis (Railway)
- **AI**: **ClubAI** — GPT-4o via OpenAI Chat Completions with function-calling (tool_use). Answers inbound SMS via RAG + three-tier escalation. A secondary set of OpenAI Assistants (Emergency/Booking/TechSupport/BrandTone) exists but is NOT in the primary SMS path.
- **Real-time**: Messages poll 10s/60s, tickets poll 30s. ClubAI processes inbound SMS live via OpenPhone webhook.

## ARCHITECTURE

### Backend (ClubOSV1-backend/)
- **Entry**: `src/index.ts` (~1150 lines — 60+ route imports at top, require() calls at bottom ~line 377)
- **Routes**: ~87 top-level files in `src/routes/` + subdirectories (admin/, ai/, booking/, knowledge/, messaging/, operations/, system/, webhooks/) — logic-heavy legacy pattern
- **Services**: ~57 top-level files in `src/services/` + subdirectories (booking/, llm/, ocr/, gmail/, gpt/, etc.)
- **Middleware**: 17 files in `src/middleware/` (auth, rate limiting, validation, security)
- **Controllers**: 3 files in `src/controllers/` (AuthController, HealthController, UserController)
- **Repositories**: 2 files in `src/repositories/` (BaseRepository, UserRepository)
- **Migrations**: 179 SQL files in `src/database/migrations/`
- **Architecture transition**: Legacy = all logic in routes (~95%). New = Controller → Service → Repository (~5% migrated — auth, health, users only)

### Frontend (ClubOSV1-frontend/)
- **Entry**: `src/pages/_app.tsx` — app wrapper, auth init, service worker, PWA
- **API client**: `src/api/http.ts` — Axios with auth interceptors, auto token refresh via `x-new-token` header, CSRF protection, 120s timeout
- **State**: Zustand (`src/state/useStore.ts`) persisted + React Context (messages, theme)
- **Auth**: JWT in localStorage, managed by `src/utils/tokenManager.ts`, protected by `src/components/auth/AuthGuard.tsx`
- **Styling**: Tailwind + CSS custom properties, dark mode via `src/contexts/ThemeContext.tsx`
- **PWA**: Capacitor bridge, swipe gestures, bottom sheets, keyboard detection
- **Components**: Feature-based organization under `src/components/` (operations/, booking/, customer/, dashboard/, ui/, messages/, tickets/, shared/)

## NAMING CONVENTIONS
- **Routes**: camelCase dominant (65% — `bookingConfig.ts`, `doorAccess.ts`). Newer files use kebab-case (35% — `ai-automations.ts`, `enhanced-patterns.ts`). Use camelCase for consistency with existing files.
- **Services**: camelCase dominant (96% — `assistantService.ts`). Only `AuthService.ts` and `UserService.ts` use PascalCase (refactored pattern).
- **Controllers**: PascalCase (`AuthController.ts`, `UserController.ts`, `HealthController.ts`)
- **Repositories**: PascalCase (`BaseRepository.ts`, `UserRepository.ts`)
- **Frontend components**: PascalCase (`TicketCenterOptimizedV3.tsx`, `BookingCalendar.tsx`)

## ARCHITECTURE PATTERNS

### Legacy Pattern (~95% of routes)
Route file handles everything: request parsing, validation, business logic, DB queries, response formatting.
```
routes/tickets.ts → direct SQL queries + response
```
**When to use**: Bug fixes, small features in existing route files. Do NOT refactor existing routes unless explicitly asked.

### Refactored Pattern (~5% — auth, health, users only)
Controller → Service → Repository separation.
```
routes/auth-refactored.ts → AuthController.ts → AuthService.ts → UserRepository.ts
```
**When to use**: New major features if scope justifies it.

**IMPORTANT**: The refactored routes (`auth-refactored.ts`, `users-refactored.ts`, `health-refactored.ts`) exist but are COMMENTED OUT in `index.ts` (~line 255). Legacy routes still serve ALL production traffic.

## DATABASE LAYER

These files handle database access. Know which does what:

| File | Purpose | Status |
|------|---------|--------|
| `utils/database.ts` | DB initializer, table creation, exports interfaces (DbUser, DbTicket, etc.) | **ACTIVE** (30+ imports) |
| `utils/db.ts` | Facade — re-exports everything from `db-consolidated.ts` | **ACTIVE** (35+ imports) |
| `utils/db-consolidated.ts` | THE actual connection pool. All queries flow through here. | **ACTIVE** (core) |
| `utils/database-tables.ts` | SQL CREATE TABLE definitions | **ACTIVE** |
| `utils/database-helpers.ts` | Column existence checks, OpenPhone-specific helpers | **ACTIVE** (4 imports) |
| `utils/ticketDb.ts` | Ticket-specific query interfaces and wrapper | **ACTIVE** |
| `utils/openphone-db-helpers.ts` | OpenPhone insert/update conversation helpers | **ACTIVE** (4 imports) |
| `utils/db-pool.ts` | DEPRECATED — re-exports from db.ts. One legacy consumer remains: `scripts/update-ai-prompt-email.js` (9-month-old one-off). | **DO NOT IMPORT in new code** |
| `utils/database-migrations.ts` | LEGACY runner, still called at startup from `utils/database.ts:140`. All 5 embedded migrations are idempotent no-ops against the current prod schema (column renames already applied; `CREATE TABLE IF NOT EXISTS`). Still wired in; do not add new migrations here. | **ACTIVE but historical** |

**Active migrations** run via numbered SQL files in `src/database/migrations/`. Add new migrations there — NOT to `database-migrations.ts`. The legacy runner still fires on boot but exists only as a historical safety net (column renames from the Users → users consolidation and early table creates).

## KEY FILE MAP

| Domain | Backend | Frontend |
|--------|---------|----------|
| **Auth** | `routes/auth.ts`, `middleware/auth.ts`, `services/AuthService.ts` | `utils/tokenManager.ts`, `components/auth/AuthGuard.tsx`, `state/useStore.ts` |
| **Messages / ClubAI** | `routes/openphone.ts` (webhook + ClubAI action handlers inline), `services/clubaiService.ts`, `services/openphoneService.ts`, `src/knowledge-base/clubai-system-prompt.md` | `contexts/MessagesContext.tsx`, `components/messages/`, `components/operations/clubai/OperationsClubAI.tsx` |
| **ClubAI Admin** | `routes/enhanced-patterns.ts` — **mixed file**: serves live ClubAI admin `/clubai-*` endpoints AND legacy V3-PLS admin routes. See pitfall #9. | `components/operations/clubai/` |
| **Bookings** | `routes/bookings.ts`, `services/booking/bookingService.ts`, `services/booking/availabilityService.ts` | `components/booking/`, `pages/bookings.tsx` |
| **Tickets** | `routes/tickets.ts` | `components/tickets/TicketCenterOptimizedV3.tsx` |
| **Checklists** | `routes/checklists-v2-enhanced.ts`, `routes/checklists-people.ts` | `components/operations/checklists/` |
| **Knowledge / RAG** | `services/unifiedKnowledgeService.ts`, `services/clubaiKnowledgeService.ts`, `routes/knowledge.ts`, `routes/knowledge-store.ts` | — |
| **Doors** | `routes/doorAccess.ts` → `services/unifiCloudService.ts`, **AND** `routes/unifi-doors.ts` (inline fetch, no service layer) — **two parallel stacks, both mounted**. See pitfall #6. | `api/doorAccess.ts`, `api/unifiDoors.ts`, `components/RemoteActionsBar.tsx`, `pages/commands.tsx` |
| **TrackMan Restart** | `services/trackmanRestartService.ts` (`triggerRestart()` single entry, called by ClubAI function-tool + REST routes), `routes/trackman-remote.ts`, `routes/remoteActions.ts`, `jobs/trackmanRestart.ts` | `components/RemoteActionsBar.tsx`, `components/operations/trackman/TrackManPanel.tsx` |
| **Receipts** | `services/ocr/receiptOCR.ts`, `routes/receipts-simple.ts` | `components/operations/receipts/` |
| **Dashboard** | — | `components/dashboard/MessagesCardV3.tsx`, `components/dashboard/TaskList.tsx` |

## CLUBAI ARCHITECTURE

**How it works**: Inbound SMS → OpenPhone webhook → `routes/openphone.ts` → `clubaiService.generateResponse()` → GPT-4o with tools → result is either a reply, an escalation, or a tool call.

- **Model**: GPT-4o via OpenAI **Chat Completions API** with function-calling. NOT the Assistants API — raw completions with `tools` + `tool_choice: 'auto'`.
- **System prompt**: `src/knowledge-base/clubai-system-prompt.md` — defines the three-tier escalation model (Tier 1 handle, Tier 2 soft hold, Tier 3 hard stop). Prompt is cached and DB-loaded; the file is the fallback. See `docs/plans/CLUB_AI_AUTONOMY_PLAN.md`.
- **RAG**: `services/clubaiKnowledgeService.ts` pulls knowledge context from the `knowledge_store` table (vector search) before each GPT call.
- **Escalation signal**: GPT appends `[ESCALATE TO HUMAN]` to its response when unsure. Backend regex at `clubaiService.ts:426` strips the tag, locks the conversation, logs the search context.
- **Function-calling (tool_use)**: Conditionally registered. Currently **one live tool**: `restart_trackman` (registered at `clubaiService.ts:355`, handled at `openphone.ts:1172`).
- **Restart flow**: GPT detects restart intent → first call without `customer_confirmed` → ClubAI sends confirmation prompt → customer says yes → second call with `customer_confirmed=true` → `triggerRestart()` executes → follow-up SMS 120s later reporting success/fail → auto-escalate on failure.
- **Three runtime modes**:
  - Normal: ClubAI's response is auto-sent to the customer.
  - Shadow (`CLUBAI_SHADOW`): log only, don't send.
  - Approval (`CLUBAI_APPROVAL_MODE`): store as draft in `clubai_draft_responses` for operator review.

**Adding a new ClubAI action (door unlock, ticket create, etc.)**: Copy the `restart_trackman` pattern exactly.
1. Register a tool schema in `clubaiService.ts:355` alongside `restart_trackman` with a clear description + parameters (always include `customer_confirmed: boolean`).
2. Add a branch to the tool-call return path at `clubaiService.ts:393`.
3. Add an action handler block in `openphone.ts` after the restart block (~line 1259). Include the two-step confirmation (first call without confirmation → send prompt → second call with confirmed=true → execute).
4. Add failure escalation and (optionally) a 120s follow-up check.
5. Gate the tool registration behind a feature flag (`isClubAI<Action>Enabled()` helper) for safe rollout.

## DEAD CODE / DO NOT TOUCH

- `ClubOSV1-backend/archive/` — Old scripts, docs, tests from prior refactors. Never imported by active code. Ignore entirely.
- `utils/db-pool.ts` — Deprecated wrapper (re-exports from `db.ts`). One legacy consumer remains: `scripts/update-ai-prompt-email.js`. Do not import in new code; use `db.ts` instead.
- `utils/database-migrations.ts` — **STILL WIRED IN** (imported at `utils/database.ts:5`, called at line 140). Runs on every startup but all migrations are idempotent no-ops against the current schema. Do not add new migrations here — use SQL files in `src/database/migrations/`.
- `index.ts` lines ~255-265 — Commented-out v2 route mounts. Leave commented until full migration is ready.
- `index.ts` lines ~377+ — `require()` style imports (mixed with ES imports at top). Do not "fix" without a plan.
- **NinjaOne is DEPRECATED and no longer in use.** We replaced it with our own TrackMan agent .exe. Any remaining NinjaOne files (`services/ninjaone.ts`, `routes/ninjaone-*.ts`, `config/ninjaDevices.ts`, `frontend/src/api/ninjaoneRemote.ts`, `scripts/deployment/*ninjaone*`, `docs/archive/ninjaone-scripts/`) are dead. The `DEMO-*` device IDs in `routes/remoteActions.ts` are placeholders that were never populated. Restart/reboot actions already route through `trackmanRestartService.triggerRestart()`. Music/TV/other-action branches in `remoteActions.ts` still reference NinjaOne but are non-functional. Do not reintroduce NinjaOne; rewire remaining actions through the TrackMan agent command queue or remove them.
- **V3-PLS pattern learning is DISABLED for auto-response** — see pitfall #7. Code remnants still exist and still run on the operator-outbound path, but the learned data is never used.

## COMMON PITFALLS

1. **database-helpers.ts looks dead but ISN'T** — It's imported by 4 production files (openphone.ts, openphone-v3.ts, webhooks, openphone-db-helpers.ts). Do not delete.
2. **index.ts has mixed import styles** — ES `import` at top (lines 1-100), `require()` at bottom (~line 377). Both are active. Do not consolidate without testing.
3. **V2 refactored routes are NOT serving traffic** — `auth-refactored.ts`, `users-refactored.ts`, `health-refactored.ts` exist but are commented out in index.ts. Legacy routes handle everything.
4. **Multiple message route versions coexist** — `openphone.ts` + `openphone-v3.ts` + `openphone-processing.ts` all serve different endpoints. Check mount paths in index.ts before modifying.
5. **Knowledge domain is sprawled** — 8 route files + 10 service files handle knowledge. `unifiedKnowledgeService.ts` is the primary entry point.
6. **Door access has TWO parallel stacks, both mounted** — `/api/door-access` (`routes/doorAccess.ts` → `services/unifiCloudService.ts`) AND `/api/unifi-doors` (`routes/unifi-doors.ts` with inline fetch, no service layer). Both are mounted in `index.ts` (lines 280, 324). The frontend imports BOTH (`api/doorAccess.ts` + `api/unifiDoors.ts`) and calls both from `commands.tsx` and `RemoteActionsBar.tsx`. Pick/consolidate one before adding more door features. Do NOT reintroduce the deleted `services/unifi/UniFiAccessService.ts` or the orphan `unifi*.ts` services — they were cleaned up April 2026.
7. **V3-PLS is DISABLED for auto-response but code remnants still run** — `routes/openphone.ts:1349` comment confirms "V3-PLS and AI Automation Service are DISABLED. ClubAI RAG is the only automated response system." BUT `routes/messages.ts` still calls `patternLearningService.learnFromHumanResponse()` (lines 721, 1339), `aiAutomationService.learnFromStaffResponse()` (lines 838, 1099), `aiAutomationService.getAssistantType()` (line 1402) on the operator outbound path. `openphone.ts` lines 648, 934, 938, 1022, 1402 also reference these services (may be in dead branches — needs inspection). Pattern data still accumulates in `knowledge_patterns`, `pattern_learning_system`, etc. but is never read. Full disentanglement is pending a dedicated refactor.
8. **`patternSafetyService` is MISNAMED — it's actually ClubAI operator lockout** — Despite the V3-PLS-ish name, this service stores `operatorLockoutHours` (default 4) and `globalCooldownMinutes` (default 60). `routes/messages.ts:617` reads these when an operator sends a message, to keep ClubAI out of the conversation afterwards. DO NOT delete this service without first extracting the lockout threshold logic into a dedicated `conversationLockoutService` or similar.
9. **`enhanced-patterns.ts` is half V3-PLS, half ClubAI admin** — ~3000-line file mounted at `/api/patterns`. Routes starting with `/clubai-*` (drafts, escalations, knowledge, config, system-prompt, feedback, conversations — ~30 live routes) back the ClubAI admin UI. V3-PLS routes (`/`, `/stats`, `/config`, `/test`, `/safety-*`, `/queue`, `/import/*`, pattern CRUD) are mostly dead but still wired. Do not delete the file; splitting it (into `clubai-admin.ts` + removing V3-PLS routes) is pending a dedicated refactor.
10. **Frontend patterns/ directory is mostly legacy V3-PLS UI** — `components/operations/patterns/` has 11 components (LivePatternDashboard, PatternAutomationCards, PatternsStatsAndSettings, etc.) that target `/api/patterns/*` V3-PLS endpoints. Before modifying or deleting, check `utils/lazyComponents.tsx` and app navigation to see which are still linked.

## DATABASE (54 tables — key ones)

**Core**: `users`, `sessions`, `blacklisted_tokens`, `system_settings`
**Messaging**: `openphone_conversations` (includes `clubai_*` columns — restart state, escalation reason, lockout timing), `openphone_messages`, `conversation_categorization`, `response_tracking`
**ClubAI (active)**: `clubai_knowledge`, `clubai_conversations`, `clubai_corrections`, `clubai_draft_responses`
**Knowledge / RAG**: `knowledge_store` (vector embeddings, semantic search backing ClubAI)
**Legacy V3-PLS (accumulating but unread)**: `knowledge_patterns`, `pattern_learning_system`, `pattern_learning_config`, `pattern_embeddings`, `pattern_outcomes_tracking`, `decision_patterns`, `safety_trigger_analytics`, `topic_aware_lockouts`, `ai_automation_features`, `ai_automation_actions`
**Bookings**: `bookings`, `booking_locations`, `booking_tiers`, `booking_slots`
**Operations**: `tickets`, `ticket_comments`, `ticket_photos`, `checklists`, `checklist_submissions`, `door_access_logs`, `operator_tasks`
**TrackMan Agent**: `trackman_devices` (registered bay PCs — hostname, api_key, location, bay_number, last_seen_at heartbeat), `trackman_restart_commands` (command queue — pending → acknowledged → completed/failed/expired, 10-min cooldown per device)
**Contractors**: `contractor_permissions`, `contractor_checklist_submissions`
**Customer** (low priority): `club_coins`, `cc_transactions`, `achievements`, `challenges`, `badges`, `leaderboards`, `friends`, `profiles`

## INTEGRATIONS

| Service | Purpose | Key Files |
|---------|---------|-----------|
| **OpenPhone** | SMS/calls, webhook-driven messaging — main inbound path for ClubAI | `routes/openphone.ts`, `services/openphoneService.ts` |
| **OpenAI** | ClubAI (Chat Completions + tool-use) + secondary GPT-4 Assistants (not in primary SMS path) + embeddings for RAG | `services/clubaiService.ts`, `services/assistantService.ts`, `services/llm/` |
| **UniFi** | Door access control (6 locations). TWO parallel route stacks active — see pitfall #6. | `services/unifiCloudService.ts`, `routes/doorAccess.ts`, `routes/unifi-doors.ts` |
| **TrackMan Agent** | Custom .exe on each bay PC. Polls `/api/trackman-remote` every 30s with `X-Device-Key` header for queued restart/reboot commands. Registers + heartbeats into `trackman_devices`. Triggered by ClubAI function-calling AND operator Commands page. | `services/trackmanRestartService.ts` (`triggerRestart()` is the single entry), `routes/trackman-remote.ts`, `jobs/trackmanRestart.ts` |
| **HubSpot** | CRM — customer/contact records. Receives bookings from Skedda via Zapier. | `services/hubspotService.ts`, `routes/hubspot.ts` |
| **Slack** | Notifications, two-way webhooks | `routes/slack.ts` |
| **Sentry** | Error monitoring (both FE + BE) | `utils/sentry.ts` |
| **Redis** | Caching, rate limiting, confirmations | `utils/cache.ts` |
| **Skedda** | **Primary booking authority.** Customers book via Skedda → HubSpot → Zapier → Access Controller (which emails unlock links to customers). ClubOS is NOT in the booking/unlock chain today. | Frontend iframe embed |
| **Access Controller** (external, not ClubOS-owned) | Separate custom app at `access.clubhouse247golf.com/admin`. Owns per-location UniFi tokens + booking → door mapping + access-link email generation. ClubOS integration pending. | — (external; no ClubOS code yet) |

## USER ROLES

| Role | Access | Primary Use |
|------|--------|-------------|
| Admin | Full | System config, analytics, all operations |
| Operator | Operations | Tickets, messages, ClubAI admin, checklists |
| Support | Limited | Customer support, ClubOS Boy |
| Customer | Portal | Profile, bookings (low priority for dev) |
| Contractor | Checklists | Cleaning tasks, door access |
| Kiosk | Public | ClubOS Boy interface |

## CRITICAL RULES

1. **PRODUCTION** — test locally first (frontend :3001, backend :3000), then commit to deploy
2. **Mobile-first** — all features MUST work on mobile Safari/Chrome
3. **TypeScript** — run `npx tsc --noEmit` before committing
4. **Versioning** — update CHANGELOG.md + README.md version number on every change
5. **Plan first** — create .md plan file before implementing features
6. **Reuse** — search for existing similar code before creating new files
7. **Verify** — never guess, always check actual code/data

## WORKFLOW

1. Read requirements — understand what's needed
2. Search for existing similar implementations
3. Create .md plan file before writing code
4. Implement with mobile-first approach
5. Run `npx tsc --noEmit` to verify no TypeScript errors
6. Update CHANGELOG.md with version bump
7. Update README.md version number to match
8. **Commit and push immediately** — do NOT wait for the user to ask. Once implementation is complete, TypeScript passes, and CHANGELOG/README are updated, commit with a descriptive message and `git push` right away. Every completed fix or feature must be deployed.

## DEPLOYMENT

- **`git push` triggers auto-deploy to both platforms:**
  - **Frontend** → Vercel (https://club-osv-2-owqx.vercel.app)
  - **Backend** → Railway (`npm run start:prod` via Procfile)
- Every commit to `main` goes live immediately. There is no staging environment.
- After pushing, monitor Railway logs (`railway logs`) and Vercel dashboard for deploy errors.
- Database migrations must be run separately: `railway run npm run db:migrate`

## COMMANDS

```bash
cd ClubOSV1-frontend && npm run dev  # Frontend on :3001
cd ClubOSV1-backend && npm run dev   # Backend on :3000
npx tsc --noEmit                     # TypeScript check
npm run build                        # Production build
npm run db:migrate                   # Run pending migrations
npm run db:rollback                  # Rollback last migration
railway run npm run db:migrate       # Production migration
railway logs                         # Production backend logs
```

## TESTING

```bash
cd ClubOSV1-backend && npm test              # All backend tests
cd ClubOSV1-backend && npm run test:unit     # Unit tests only
cd ClubOSV1-backend && npm run test:watch    # Watch mode
cd ClubOSV1-frontend && npm test             # Frontend tests
```

- **Backend tests**: `src/__tests__/unit/` (routes, services, middleware)
- **Backend config**: `jest.config.json`
- **Frontend config**: `jest.config.js`, `jest.setup.js`

## TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| 401 errors | Check `tokenManager.ts`, localStorage `clubos_token` |
| TypeScript errors | `npx tsc --noEmit` to see all errors |
| Database errors | Likely needs a migration — check recent schema changes |
| Mobile issues | Chrome DevTools device emulation |
| Port in use | `lsof -i:3000` then `kill -9 <PID>` |
| Module not found | `npm install` in the affected directory |
| Webhook issues | Check OpenPhone signature verification in `routes/openphone.ts` |
