# Route Consolidation Map

## Current State
- **Total route files**: 45 files
- **Lines of code**: ~15,000+ (estimated)
- **Duplicate functionality**: High
- **Inconsistent patterns**: Yes

## Consolidation Plan

### 1. Messaging Module (7 files → 1 module)
**Current files:**
- `openphone.ts` - OpenPhone API v2 endpoints
- `openphone-v3.ts` - OpenPhone API v3 endpoints (duplicate!)
- `debug-openphone.ts` - Debug endpoints for OpenPhone
- `messages.ts` - Message management
- `contacts.ts` - Contact management
- `notifications.ts` - Push notifications
- `tone.ts` - Message tone analysis

**New structure:** `/routes/messaging/`
```
messaging/
├── index.ts          # Main router
├── handlers/
│   ├── conversations.ts
│   ├── messages.ts
│   ├── contacts.ts
│   └── notifications.ts
└── utils/
    ├── validators.ts
    └── transformers.ts
```

### 2. Knowledge Module (9 files → 1 module)
**Current files:**
- `knowledge.ts` - Basic knowledge endpoints
- `admin-knowledge.ts` - Admin knowledge management
- `knowledge-debug.ts` - Debug endpoints
- `knowledge-enhance.ts` - Enhancement features
- `knowledge-router.ts` - Routing logic
- `assistant.ts` - Assistant management
- `sop-check.ts` - SOP verification (legacy)
- `sop-data-check.ts` - SOP data check (legacy)
- `promptTemplates.ts` - AI prompt templates

**New structure:** `/routes/knowledge/`
```
knowledge/
├── index.ts
├── handlers/
│   ├── documents.ts
│   ├── assistants.ts
│   ├── search.ts
│   └── templates.ts
└── middleware/
    └── validation.ts
```

### 3. Operations Module (4 files → 1 module)
**Current files:**
- `tickets.ts` - Ticket management
- `checklists.ts` - Checklist system
- `remoteActions.ts` - Remote control actions
- `remoteActions.backup.ts` - Backup file (remove!)

**New structure:** `/routes/operations/`
```
operations/
├── index.ts
├── handlers/
│   ├── tickets.ts
│   ├── checklists.ts
│   └── remote-control.ts
└── services/
    └── ninjaone.ts
```

### 4. Customer Module (5 files → 1 module)
**Current files:**
- `customer.ts` - Customer endpoints
- `customer-interactions.ts` - Interaction tracking
- `feedback.ts` - Feedback collection
- `bookings.ts` - Booking management
- `call-transcripts.ts` - Call transcript processing

**New structure:** `/routes/customer/`
```
customer/
├── index.ts
├── handlers/
│   ├── profiles.ts
│   ├── interactions.ts
│   ├── feedback.ts
│   ├── bookings.ts
│   └── transcripts.ts
```

### 5. AI/LLM Module (4 files → 1 module)
**Current files:**
- `llm.ts` - LLM endpoints
- `llmProviders.ts` - Provider management
- `gptWebhook.ts` - GPT webhooks
- `slack.ts` - Slack AI integration

**New structure:** `/routes/ai/`
```
ai/
├── index.ts
├── handlers/
│   ├── chat.ts
│   ├── providers.ts
│   ├── webhooks.ts
│   └── integrations.ts
```

### 6. Admin Module (6 files → 1 module)
**Current files:**
- `admin.ts` - Admin endpoints
- `analytics.ts` - Analytics dashboard
- `system-config.ts` - System configuration
- `system-check.ts` - System health checks
- `usage.ts` - Usage tracking
- `privacy.ts` - Privacy controls

**New structure:** `/routes/admin/`
```
admin/
├── index.ts
├── handlers/
│   ├── dashboard.ts
│   ├── analytics.ts
│   ├── config.ts
│   ├── privacy.ts
│   └── monitoring.ts
```

### 7. Auth Module (4 files → 1 module)
**Current files:**
- `auth.ts` - Authentication
- `csrf.ts` - CSRF protection
- `access.ts` - Access control
- `userSettings.ts` - User preferences

**New structure:** `/routes/auth/`
```
auth/
├── index.ts
├── handlers/
│   ├── login.ts
│   ├── session.ts
│   ├── users.ts
│   └── settings.ts
├── middleware/
│   ├── csrf.ts
│   └── rbac.ts
```

### 8. System Module (5 files → 1 module)
**Current files:**
- `health.ts` - Health checks
- `backup.ts` - Backup management
- `history.ts` - Audit history
- `setup.ts` - Initial setup
- `debug.ts` - Debug endpoints

**New structure:** `/routes/system/`
```
system/
├── index.ts
├── handlers/
│   ├── health.ts
│   ├── backup.ts
│   ├── audit.ts
│   └── debug.ts
```

### 9. Public Module (Keep as-is)
**Current files:**
- `public.ts` - Public endpoints (no auth)

**Keep structure:** Single file is appropriate

## Migration Strategy

### Phase 1: Create new structure
```bash
mkdir -p routes/{messaging,knowledge,operations,customer,ai,admin,auth,system}
mkdir -p routes/{messaging,knowledge,operations,customer,ai,admin,auth,system}/handlers
```

### Phase 2: Create route factory
- Implement `createRouteModule()` factory
- Standardize middleware application
- Consistent error handling

### Phase 3: Migrate module by module
1. Start with smallest module (System)
2. Test each module thoroughly
3. Update imports in index.ts
4. Remove old files

### Phase 4: Update main router
- Mount consolidated routes
- Add versioning prefix `/api/v2/`
- Maintain backward compatibility

## Expected Benefits

### Before:
- 45 route files
- ~15,000 lines of code
- Inconsistent patterns
- Duplicate code everywhere

### After:
- 9 route modules
- ~8,000 lines of code (45% reduction)
- Consistent patterns
- DRY principle applied

## Success Metrics
- [ ] All endpoints still accessible
- [ ] No breaking changes
- [ ] 40%+ code reduction
- [ ] Consistent error handling
- [ ] Middleware properly applied
- [ ] Tests passing

## Rollback Plan
If issues arise:
1. Routes are modular - can rollback individual modules
2. Old routes kept in `archived_routes/` during transition
3. Feature flags for gradual rollout