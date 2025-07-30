# ClubOS Deployment Failure - Systematic Audit Plan

## Phase 1: Immediate Diagnosis (5 mins)

### 1.1 Check Deployment Logs
- [ ] Railway deployment logs - full error stack trace
- [ ] Build logs - any missing dependencies
- [ ] Health check failure details
- [ ] Environment variable warnings

### 1.2 Identify Error Pattern
- [ ] Module not found errors
- [ ] Type errors (like requireRole)
- [ ] Database connection failures
- [ ] Missing environment variables

## Phase 2: Dependency Audit (10 mins)

### 2.1 Backend Dependencies
```bash
# Check all imports in routes
grep -r "import.*from" src/routes/ | grep -v "node_modules"

# Check all imports in services
grep -r "import.*from" src/services/ | grep -v "node_modules"

# Compare with package.json
cat package.json | jq '.dependencies'
```

### 2.2 Missing Packages
- [ ] axios (for NinjaOne)
- [ ] @slack/webhook (for Slack)
- [ ] Any other missing imports

### 2.3 Import Path Issues
- [ ] ../db vs ../utils/db
- [ ] Missing exports
- [ ] Circular dependencies

## Phase 3: Code Structure Audit (15 mins)

### 3.1 Auth Middleware
```typescript
// Check what's actually exported
grep -n "export" src/middleware/auth.ts
```
- [ ] requireAuth exists?
- [ ] requireRole exists?
- [ ] hasMinimumRole exists?
- [ ] Consistent auth pattern?

### 3.2 Route Registration
```typescript
// Check index.ts route mounting
grep -n "app.use" src/index.ts
```
- [ ] All routes properly imported?
- [ ] Correct path prefixes?
- [ ] Middleware order correct?

### 3.3 Service Initialization
- [ ] Database connection
- [ ] Slack service
- [ ] LLM service
- [ ] NinjaOne service

## Phase 4: Environment Configuration (10 mins)

### 4.1 Required Variables
```bash
# Production requirements
DATABASE_URL
OPENAI_API_KEY
SLACK_WEBHOOK_URL
SLACK_BOT_TOKEN
JWT_SECRET
NODE_ENV=production
```

### 4.2 Optional Variables
```bash
# NinjaOne (not critical)
NINJAONE_CLIENT_ID
NINJAONE_CLIENT_SECRET
NINJAONE_BASE_URL
```

### 4.3 Railway Settings
- [ ] Health check path: /health
- [ ] Port: 3001 or $PORT
- [ ] Start command: npm start
- [ ] Build command: npm run build

## Phase 5: Systematic Fixes (20 mins)

### 5.1 Create Minimal Working Version
1. Disable all non-critical features
2. Remove problem imports
3. Stub out missing services
4. Test locally first

### 5.2 File-by-File Fixes
```bash
# Order of fixing:
1. src/middleware/auth.ts - fix exports
2. src/services/* - stub missing services  
3. src/routes/* - remove problem routes
4. src/index.ts - clean route registration
```

### 5.3 Incremental Deployment
1. Deploy minimal version
2. Add features one by one
3. Test each addition

## Phase 6: Emergency Fallback Plan

### 6.1 Ultra-Safe Version
```typescript
// Create emergency-index.ts
import express from 'express';
const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.json({ 
    name: 'ClubOS API',
    status: 'emergency-mode'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Emergency server on port ${PORT}`);
});
```

### 6.2 Gradual Feature Addition
1. Add database connection
2. Add auth routes only
3. Add assistant routes
4. Add other features

## Phase 7: Testing Strategy

### 7.1 Local Testing
```bash
# Build locally
npm run build

# Run built version
node dist/index.js

# Test health endpoint
curl http://localhost:3001/health
```

### 7.2 Docker Testing
```bash
# Build container
docker build -t clubos-backend .

# Run container
docker run -p 3001:3001 clubos-backend
```

## Phase 8: Long-term Solutions

### 8.1 CI/CD Pipeline
- [ ] Add build tests
- [ ] Add import validation
- [ ] Add health check tests
- [ ] Staging environment

### 8.2 Monitoring
- [ ] Better error logging
- [ ] Deployment notifications
- [ ] Health check alerts
- [ ] Performance monitoring

### 8.3 Code Standards
- [ ] Consistent import patterns
- [ ] Standardized auth middleware
- [ ] Error handling patterns
- [ ] Type safety improvements

## Quick Reference Commands

```bash
# Check all TypeScript errors
npm run typecheck

# Find all imports
find src -name "*.ts" -exec grep -l "import.*from" {} \;

# Check for circular dependencies
madge --circular src/

# List all exported functions
grep -r "export" src/ | grep -E "(function|const|class)"

# Test build locally
npm run build && node dist/index.js
```

## Decision Tree

1. **Module not found?** → Check package.json, run npm install
2. **Type error?** → Check exports/imports match
3. **Auth error?** → Standardize auth middleware
4. **Database error?** → Check DATABASE_URL, connection string
5. **Unknown error?** → Use emergency fallback, add features incrementally

## Success Criteria

- [ ] Health check passes
- [ ] No crash on startup
- [ ] Basic routes accessible
- [ ] Logs show successful initialization
- [ ] Frontend can connect

---

**If deployment fails, execute this plan systematically from Phase 1.**