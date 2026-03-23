## PROJECT CONTEXT
- **What**: Facility management system for Clubhouse 24/7 (golf simulators, pickleball courts, gyms)
- **Scale**: ~5,000 customers across 6 locations, 6-7 employees on operations/testing
- **Critical**: PRODUCTION system — all commits auto-deploy to live users immediately
- **Stack**: Next.js 15 + TypeScript + Tailwind (Vercel) | Express + PostgreSQL + Redis (Railway)
- **AI**: OpenAI GPT-4 assistants (Emergency, Booking, Tech Support, Brand Tone) + V3-PLS pattern learning
- **Real-time**: Messages poll 10s/60s, tickets poll 30s, patterns learn from operator responses

## ARCHITECTURE

### Backend (ClubOSV1-backend/)
- **Entry**: `src/index.ts` (1157 lines — 60+ route imports at top, require() calls at bottom ~line 377)
- **Routes**: 88 top-level files in `src/routes/` + subdirectories (admin/, ai/, booking/, knowledge/, messaging/, operations/, system/, webhooks/) — logic-heavy legacy pattern
- **Services**: 67 top-level files in `src/services/` + subdirectories (booking/, llm/, ocr/, unifi/, gmail/, gpt/, etc.)
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
| `utils/db-pool.ts` | DEPRECATED — re-exports from db.ts | **DO NOT IMPORT** |
| `utils/database-migrations.ts` | LEGACY — all migration code skipped at startup | **DO NOT USE** |

**Active migrations** run via numbered SQL files in `src/database/migrations/`, NOT via the migration runner files.

## KEY FILE MAP

| Domain | Backend | Frontend |
|--------|---------|----------|
| **Auth** | `routes/auth.ts`, `middleware/auth.ts`, `services/AuthService.ts` | `utils/tokenManager.ts`, `components/auth/AuthGuard.tsx`, `state/useStore.ts` |
| **Messages** | `routes/messages.ts`, `routes/openphone.ts`, `services/openphoneService.ts` | `contexts/MessagesContext.tsx`, `components/messages/` |
| **V3-PLS** | `services/patternLearningService.ts`, `services/patternSystemService.ts`, `services/patternSafetyService.ts`, `routes/enhanced-patterns.ts` | `components/operations/patterns/` |
| **Bookings** | `routes/bookings.ts`, `services/booking/bookingService.ts`, `services/booking/availabilityService.ts` | `components/booking/`, `pages/bookings.tsx` |
| **Tickets** | `routes/tickets.ts` | `components/tickets/TicketCenterOptimizedV3.tsx` |
| **Checklists** | `routes/checklists-v2-enhanced.ts`, `routes/checklists-people.ts` | `components/operations/checklists/` |
| **AI/LLM** | `services/llm/`, `services/assistantService.ts`, `routes/ai-automations.ts` | `components/operations/ai/` |
| **Knowledge** | `services/unifiedKnowledgeService.ts`, `routes/knowledge.ts`, `routes/knowledge-store.ts` | — |
| **Doors** | `services/unifi*.ts`, `routes/unifi-doors.ts` | — |
| **Remote** | `services/ninjaone.ts`, `routes/ninjaone-*.ts`, `routes/remoteActions.ts` | `components/RemoteActionsBar.tsx` |
| **Receipts** | `services/ocr/receiptOCR.ts`, `routes/receipts-simple.ts` | `components/operations/receipts/` |
| **Dashboard** | — | `components/dashboard/MessagesCardV3.tsx`, `components/dashboard/TaskList.tsx` |

## DEAD CODE / DO NOT TOUCH

- `ClubOSV1-backend/archive/` — Old scripts, docs, tests from prior refactors. Never imported by active code. Ignore entirely.
- `utils/db-pool.ts` — Deprecated wrapper, do not import (use `db.ts` instead)
- `utils/database-migrations.ts` — Legacy migration runner, all code skipped. Active migrations use SQL files in `src/database/migrations/`
- `index.ts` lines ~255-265 — Commented-out v2 route mounts. Leave commented until full migration is ready.
- `index.ts` lines ~377+ — `require()` style imports (mixed with ES imports at top). Do not "fix" without a plan.

## COMMON PITFALLS

1. **database-helpers.ts looks dead but ISN'T** — It's imported by 4 production files (openphone.ts, openphone-v3.ts, webhooks, openphone-db-helpers.ts). Do not delete.
2. **index.ts has mixed import styles** — ES `import` at top (lines 1-100), `require()` at bottom (~line 377). Both are active. Do not consolidate without testing.
3. **V2 refactored routes are NOT serving traffic** — `auth-refactored.ts`, `users-refactored.ts`, `health-refactored.ts` exist but are commented out in index.ts. Legacy routes handle everything.
4. **Multiple route versions coexist** — `openphone.ts` + `openphone-v3.ts` + `openphone-processing.ts` all serve different endpoints. Check mount paths in index.ts before modifying.
5. **Knowledge domain is sprawled** — 8 route files + 10 service files handle knowledge. `unifiedKnowledgeService.ts` is the primary entry point.
6. **UniFi domain is sprawled** — 9 service files for door access. Multiple API approaches were tried. `unifi-doors.ts` route is the active entry point.

## DATABASE (54 tables — key ones)

**Core**: `users`, `sessions`, `blacklisted_tokens`, `system_settings`
**Messaging**: `openphone_conversations`, `openphone_messages`, `conversation_categorization`, `response_tracking`
**AI/Patterns**: `knowledge_patterns`, `pattern_learning_system`, `pattern_learning_config`, `pattern_embeddings`, `pattern_outcomes_tracking`, `knowledge_store`
**Safety**: `ai_automation_features`, `ai_automation_actions`, `safety_trigger_analytics`, `topic_aware_lockouts`
**Bookings**: `bookings`, `booking_locations`, `booking_tiers`, `booking_slots`
**Operations**: `tickets`, `ticket_comments`, `ticket_photos`, `checklists`, `checklist_submissions`, `door_access_logs`, `operator_tasks`
**Contractors**: `contractor_permissions`, `contractor_checklist_submissions`
**Customer** (low priority): `club_coins`, `cc_transactions`, `achievements`, `challenges`, `badges`, `leaderboards`, `friends`, `profiles`

## V3-PLS PATTERN LEARNING SYSTEM

**How it works**: Message received → pattern matching (regex + semantic + GPT) → confidence score → action
- **65%+ confidence**: Auto-execute response
- **60%+**: Suggest to operator
- **40%+**: Queue for training
- **Learning rates**: Success +15%, modified-but-approved +10%, failure -20%, daily decay -1%
- **Safety**: patternSafetyService validates before any automation (financial safeguards, escalation triggers, personal data rules)
- **Config**: `PATTERN_LEARNING_ENABLED`, `PATTERN_LEARNING_SHADOW_MODE`, threshold env vars
- **Topic detection**: Booking, tech support, access, gift cards, hours, pricing
- **Operator lockouts**: AI defers to operator per-topic, 1hr global cooldown after operator responds

## INTEGRATIONS

| Service | Purpose | Key Files |
|---------|---------|-----------|
| **OpenPhone** | SMS/calls, webhook-driven messaging | `routes/openphone.ts`, `services/openphoneService.ts` |
| **OpenAI** | 4 GPT-4 assistants + embeddings | `services/assistantService.ts`, `services/llm/` |
| **UniFi** | Door access control (6 locations) | `services/unifi*.ts`, `routes/unifi-doors.ts` |
| **NinjaOne** | Remote device management/scripts | `services/ninjaone.ts`, `routes/ninjaone-*.ts` |
| **HubSpot** | CRM contact sync | `services/hubspotService.ts`, `routes/hubspot.ts` |
| **Slack** | Notifications, two-way webhooks | `routes/slack.ts` |
| **Sentry** | Error monitoring (both FE + BE) | `utils/sentry.ts` |
| **Redis** | Caching, rate limiting, confirmations | `utils/cache.ts` |
| **Skedda** | Booking iframe (default, fallback) | Frontend iframe embed |

## USER ROLES

| Role | Access | Primary Use |
|------|--------|-------------|
| Admin | Full | System config, analytics, all operations |
| Operator | Operations | Tickets, messages, patterns, checklists |
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
8. **Commit and push immediately** — do NOT wait for the user to ask. Once implementation is complete, TypeScript passes, and CHANGELOG/README are updated, commit with a descriptive message and `git push` right away. Every completed fix or feature must be deployed. Auto-deploys to production on push.

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
