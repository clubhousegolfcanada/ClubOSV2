# Testing Phase 2: Critical Test Coverage

## Current Status After Phase 1
✅ **Completed:**
- Test infrastructure fixed (Jest, mocks, cleanup)
- .env.test configuration
- OpenPhone webhook test suite (template for other tests)
- Auth route tests partially fixed

❌ **Issues Remaining:**
- 11 of 13 test suites still failing
- No coverage for Messages API
- No coverage for AI Automation
- Coverage reporting not showing percentages

## Phase 2 Tasks (Priority Order)

### 1. Messages API Tests (`src/__tests__/unit/routes/messages.test.ts`)

Create or update tests for:

```typescript
// GET /conversations - List conversations
describe('GET /conversations', () => {
  // Test pagination (limit, offset)
  // Test search functionality
  // Test snake_case response format (critical!)
  // Test HubSpot enrichment
  // Test filtering of invalid phone numbers
});

// GET /conversations/:phoneNumber - Single conversation
describe('GET /conversations/:phoneNumber', () => {
  // Test fetching existing conversation
  // Test 404 for non-existent
  // Test marking as read
  // Test snake_case format preservation
});

// GET /conversations/:phoneNumber/full-history
describe('GET /conversations/:phoneNumber/full-history', () => {
  // Test merging multiple conversations
  // Test conversation separators
  // Test time-based grouping
});

// POST /conversations/:phoneNumber/suggest-response
describe('POST /conversations/:phoneNumber/suggest-response', () => {
  // Test AI response generation
  // Test with/without OpenAI key
  // Test confidence scoring
});
```

### 2. AI Automation Service Tests (`src/__tests__/unit/services/aiAutomation.test.ts`)

Create comprehensive tests for:

```typescript
// Assistant type detection
describe('getAssistantType', () => {
  // Test booking-related keywords
  // Test emergency keywords
  // Test tech support keywords
  // Test default to general
});

// Message processing
describe('processMessage', () => {
  // Test initial vs follow-up messages
  // Test automation triggers
  // Test response generation
  // Test fallback when AI unavailable
});

// Pattern matching
describe('aiAutomationPatterns', () => {
  // Test each pattern category
  // Test confidence thresholds
  // Test pattern priorities
});
```

### 3. Fix Existing Failing Tests

#### a. Fix imports and mocks in all test files
```bash
# Files to fix:
- src/__tests__/unit/services/llmService.test.ts
- src/__tests__/unit/services/assistantService.test.ts
- src/__tests__/unit/middleware/roleGuard.test.ts
- src/__tests__/security/security.test.ts
```

#### b. Update test expectations to match current API
- Response format changes (successResponse/errorResponse helpers)
- Database method signatures
- Service method returns

### 4. Integration Tests (`src/__tests__/integration/`)

Create end-to-end tests:

```typescript
// Complete message flow test
describe('Message Flow Integration', () => {
  // Receive webhook → Store → Enrich → AI Process → Notify
  // Test with real database (test database)
  // Test with mocked external services
});

// User journey test
describe('User Journey', () => {
  // Register → Login → View Messages → Send Response
  // Test authentication flow
  // Test authorization (roles)
});
```

### 5. Database Helper Tests

Create tests for critical helpers:

```typescript
// src/__tests__/unit/utils/database-helpers.test.ts
describe('Database Helpers', () => {
  // Test ensureOpenPhoneColumns
  // Test migration functions
  // Test transaction handling
});

// src/__tests__/unit/utils/openphone-db-helpers.test.ts  
describe('OpenPhone DB Helpers', () => {
  // Test insertOpenPhoneConversation
  // Test updateOpenPhoneConversation
  // Test column existence checks
});
```

## Implementation Steps for Next Session

### Step 1: Setup (5 minutes)
```bash
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Verify test setup works
npm test -- src/__tests__/unit/routes/openphone.test.ts

# Should pass - this is our working template
```

### Step 2: Create Messages API Tests (30 minutes)
```bash
# Copy template structure from openphone.test.ts
# Focus on the critical /conversations endpoint first
# Ensure snake_case format is tested (was broken before)
```

### Step 3: Fix Import Issues (20 minutes)
```bash
# Run each failing test individually
npm test -- src/__tests__/unit/services/llmService.test.ts 2>&1 | head -50

# Fix imports based on errors
# Update mocks to match actual service exports
```

### Step 4: Run Coverage Report (5 minutes)
```bash
# Generate coverage report
npm test -- --coverage

# Check coverage percentages
# Should see improvement from ~40% to ~60%
```

### Step 5: Create AI Automation Tests (30 minutes)
```bash
# Use OpenPhone tests as template
# Focus on pattern matching and assistant type detection
# These are critical for customer experience
```

## Success Criteria for Phase 2

- [ ] Messages API has >80% test coverage
- [ ] AI Automation service has >70% coverage  
- [ ] Overall test pass rate >70% (up from 40%)
- [ ] Coverage report shows at least 60% overall
- [ ] No resource leaks (open handles)
- [ ] All critical user paths have integration tests

## Key Files to Reference

1. **Working Test Template**: `src/__tests__/unit/routes/openphone.test.ts`
2. **Test Setup**: `src/__tests__/setup.ts`
3. **Mock Patterns**: Look at how OpenPhone tests mock services
4. **Database Mocks**: Use transaction mock pattern from setup.ts

## Common Issues and Solutions

### Issue: "Cannot find module"
**Solution**: Check actual file paths, update imports in setup.ts

### Issue: "TypeError: Cannot read property 'mockResolvedValue'"
**Solution**: Ensure mock is properly typed: `as jest.Mocked<typeof service>`

### Issue: Test hangs/timeout
**Solution**: Check for missing await, add forceExit to jest config

### Issue: "Expected 401, Received 404"  
**Solution**: Route might not be registered, check HTTP method (GET/POST/PUT)

## Environment Variables for Testing

Already configured in `.env.test`:
- `NODE_ENV=test`
- `DISABLE_EXTERNAL_APIS=true`
- `DATABASE_URL` points to test database
- Mock API keys for services

## Next Session Checklist

- [ ] Pull latest changes
- [ ] Run `npm install` in case dependencies changed
- [ ] Start with Messages API tests (highest priority)
- [ ] Use `--detectOpenHandles` if tests hang
- [ ] Commit after each major test suite works

---

*Created: August 6, 2025*
*Phase 1 Completed By: Claude & Mike*
*Ready for Phase 2 Implementation*