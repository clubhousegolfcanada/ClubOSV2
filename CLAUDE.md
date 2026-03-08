## PROJECT CONTEXT
- **What**: Facility management system for Clubhouse 24/7 (golf simulators, pickleball courts, gyms)
- **Scale**: ~5,000 customers across 6 locations, 6-7 employees on operations/testing
- **Critical**: PRODUCTION system — all commits auto-deploy to live users immediately
- **Stack**: Next.js 15 + TypeScript + Tailwind (Vercel) | Express + PostgreSQL + Redis (Railway)
- **AI**: OpenAI GPT-4 assistants (Emergency, Booking, Tech Support, Brand Tone) + V3-PLS pattern learning
- **Real-time**: Messages poll 10s/60s, tickets poll 30s, patterns learn from operator responses

## ARCHITECTURE

### Backend (ClubOSV1-backend/)
- **Entry**: `src/index.ts` — server init, middleware setup, route registration
- **Routes**: 50+ files in `src/routes/` (logic-heavy, legacy pattern)
- **Services**: 50+ files in `src/services/` (business logic)
- **Middleware**: 17 files in `src/middleware/` (auth, rate limiting, validation, security)
- **Migrations**: 355+ SQL files in `src/database/migrations/`
- **Architecture transition**: Legacy = all logic in routes. New = Controller → Service → Repository (~20% migrated, auth/health/users first)

### Frontend (ClubOSV1-frontend/)
- **Entry**: `src/pages/_app.tsx` — app wrapper, auth init, service worker, PWA
- **API client**: `src/api/http.ts` — Axios with auth interceptors, auto token refresh via `x-new-token` header
- **State**: Zustand (`src/state/useStore.ts`) persisted + React Context (messages, theme)
- **Auth**: JWT in localStorage, managed by `src/utils/tokenManager.ts`, protected by `src/components/auth/AuthGuard.tsx`
- **Styling**: Tailwind + CSS custom properties, dark mode via `src/contexts/ThemeContext.tsx`
- **PWA**: Capacitor bridge, swipe gestures, bottom sheets, keyboard detection

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
| **Receipts** | `services/ocr/receiptOCR.ts`, `routes/receipts.ts` | `components/receipts/` |
| **Dashboard** | — | `components/dashboard/MessagesCardV3.tsx`, `components/dashboard/TaskList.tsx` |

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
5. Test locally (frontend + backend if needed)
6. Update CHANGELOG.md with version bump
7. Update README.md version number to match
8. Commit with descriptive message and push

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
