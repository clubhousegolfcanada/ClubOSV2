# ClubOS Testing Guide

## Quick Start Testing

### 1. Basic Request Flow
```bash
# Start the system
cd ClubOSV1-backend && npm run dev
cd ClubOSV1-frontend && npm run dev

# Visit http://localhost:3000
```

Test these scenarios:
1. **Booking**: "I need to book bay 3 for tomorrow at 2pm"
2. **Emergency**: "There's water leaking in bay 2"
3. **Tech Support**: "TrackMan screen is frozen"
4. **General Info**: "What are your membership options?"

## Feature Testing Checklist

### Core Functionality
- [x] Smart AI routing to specialized assistants
- [x] Manual route override option
- [x] Slack fallback when AI disabled
- [x] Request history tracking
- [x] User authentication & RBAC
- [x] PostgreSQL data persistence
- [x] System configuration management

### UI Components
- [x] Request form with validation
- [x] Route selector (Auto/Manual)
- [x] Smart Assist toggle
- [x] Response display with structured data
- [x] Feedback system (helpful/not helpful)
- [x] Dark/light theme toggle
- [x] Mobile responsive design
- [x] Operations dashboard (admin)

### Integration Tests

#### 1. LLM Routing Test
```bash
curl -X POST http://localhost:3001/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "I need help booking a bay",
    "location": "Main entrance",
    "smartAssistEnabled": true,
    "routePreference": "Auto"
  }'
```

Expected response:
- Route: "Booking & Access"
- Confidence: > 0.8
- Structured response with actions

#### 2. Slack Integration Test
```bash
# With Smart Assist OFF
curl -X POST http://localhost:3001/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "Test slack message",
    "smartAssistEnabled": false
  }'
```

Expected: Message appears in Slack channel

#### 3. Emergency Escalation Test
```bash
curl -X POST http://localhost:3001/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "Someone is injured in bay 5",
    "smartAssistEnabled": true
  }'
```

Expected:
- Route: "Emergency"
- Priority: "urgent"
- Escalation required

### Database Tests

```bash
# Test database connection
cd ClubOSV1-backend
npx ts-node -e "
const { db } = require('./dist/utils/database');
db.query('SELECT NOW()').then(r => console.log('✅ DB Connected'));
"

# Check tables exist
npx ts-node -e "
const { db } = require('./dist/utils/database');
db.query(\"SELECT tablename FROM pg_tables WHERE schemaname = 'public'\")
  .then(r => console.log('Tables:', r.rows.map(r => r.tablename)));
"
```

### Authentication Tests

1. **Login Test**
   - Visit /login
   - Use admin credentials
   - Verify redirect to home

2. **Role-Based Access**
   - Admin: Full access to operations
   - Operator: Limited operations access
   - Support: Ticket management only
   - Kiosk: Redirect to /clubosboy

3. **Token Validation**
   ```bash
   # Get token via login
   TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@clubos.com","password":"your-password"}' \
     | jq -r '.data.token')
   
   # Use token for protected routes
   curl http://localhost:3001/api/auth/users \
     -H "Authorization: Bearer $TOKEN"
   ```

## Performance Testing

### Load Testing
```bash
# Install artillery
npm install -g artillery

# Create test script (load-test.yml)
config:
  target: "http://localhost:3001"
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "LLM Request"
    flow:
      - post:
          url: "/api/llm/request"
          json:
            requestDescription: "Book bay 3"
            smartAssistEnabled: true

# Run test
artillery run load-test.yml
```

### Response Time Targets
- LLM routing: < 3 seconds
- Database queries: < 100ms
- Static pages: < 500ms
- API endpoints: < 1 second

## Security Testing

### 1. Input Validation
```bash
# Test XSS prevention
curl -X POST http://localhost:3001/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "<script>alert(\"XSS\")</script>",
    "location": "<img src=x onerror=alert(1)>"
  }'
```

### 2. Rate Limiting
```bash
# Send multiple requests rapidly
for i in {1..150}; do
  curl -X POST http://localhost:3001/api/llm/request \
    -H "Content-Type: application/json" \
    -d '{"requestDescription": "Test"}'
done
```

Expected: 429 errors after rate limit

### 3. SQL Injection
```bash
# Test malicious input
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@clubos.com'; DROP TABLE users; --",
    "password": "test"
  }'
```

Expected: Safe error handling

## End-to-End Tests

### Customer Journey 1: Booking Issue
1. Customer: "I can't access my booked bay"
2. System routes to Booking & Access
3. Assistant provides:
   - Verification steps
   - Access code reset
   - Alternative solutions
4. Customer marks as helpful
5. Interaction logged in database

### Customer Journey 2: Equipment Failure
1. Customer: "TrackMan showing error E04"
2. System routes to Tech Support
3. Assistant provides:
   - Specific error resolution
   - Reset instructions
   - Escalation if needed
4. If unresolved → Create ticket
5. Ticket appears in queue

### Customer Journey 3: Kiosk Mode
1. Access /clubosboy
2. Submit request without login
3. Request tagged as [CUSTOMER KIOSK]
4. Routed to Slack immediately
5. Staff responds via Slack

## Debugging Tools

### Backend Logs
```bash
# View real-time logs
cd ClubOSV1-backend
tail -f logs/combined.log

# View error logs only
tail -f logs/error.log
```

### Frontend Debugging
1. Open browser DevTools
2. Check Network tab for API calls
3. Console for JavaScript errors
4. React Developer Tools for state

### Database Queries
```bash
# Recent requests
psql $DATABASE_URL -c "
SELECT created_at, request_text, route, confidence 
FROM customer_interactions 
ORDER BY created_at DESC 
LIMIT 10;"

# Check feedback
psql $DATABASE_URL -c "
SELECT * FROM feedback 
WHERE is_useful = false 
ORDER BY created_at DESC;"
```

## Test Data

### Sample Requests by Category
```javascript
const testRequests = {
  booking: [
    "I need to book bay 3 for tomorrow",
    "Cancel my 2pm reservation",
    "Change booking from 3pm to 5pm"
  ],
  emergency: [
    "Someone fell and hurt themselves",
    "Fire alarm is going off",
    "Water leak in the ceiling"
  ],
  tech: [
    "TrackMan won't turn on",
    "Screen is frozen",
    "Can't connect to wifi"
  ],
  general: [
    "What are your hours?",
    "How much is a membership?",
    "Do you have group rates?"
  ]
};
```

## Automated Testing

### Unit Tests
```bash
cd ClubOSV1-backend
npm test

# Run specific test
npm test -- llmService.test.ts
```

### Integration Tests
```bash
# Run all integration tests
npm run test:integration

# Test specific endpoint
npm run test:integration -- bookings
```

### All Available Test Commands
```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration
```

### Other Useful Commands
```bash
# Type check without building
npm run typecheck

# Lint code
npm run lint

# Check environment configuration
npm run check:env
```

## Production Verification

After deployment:
1. Check health endpoints
2. Verify all environment variables
3. Test each route type
4. Confirm database connectivity
5. Check Slack notifications
6. Verify GPT assistants respond
7. Test authentication flow
8. Monitor error logs

## Known Issues & Workarounds

1. **GPT Assistant IDs not configured**
   - System falls back to generic responses
   - Add IDs to Railway environment variables

2. **Slack notifications not sending**
   - Check webhook URL is valid
   - Verify system config settings

3. **Database connection drops**
   - Railway PostgreSQL may sleep
   - Implement connection pooling

## Testing Checklist Summary

- [ ] All routes return correct bot type
- [ ] Structured responses display properly
- [ ] Slack fallback works when AI disabled
- [ ] Authentication prevents unauthorized access
- [ ] Rate limiting prevents abuse
- [ ] Database persists all data
- [ ] System recovers from errors gracefully
- [ ] Mobile UI is fully functional
- [ ] Kiosk mode works without login

Last updated: November 2024