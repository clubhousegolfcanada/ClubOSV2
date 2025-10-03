# ClubOS Security Fix Implementation Plan

## ⚠️ CRITICAL CONTEXT
- **This is PRODUCTION** - All commits auto-deploy immediately
- **Users**: 10,000+ customers, 6-7 operators, 6 locations
- **Testing Required**: Every fix MUST be tested locally before commit
- **Version**: Current v1.21.27 → Target v1.22.0 (major security update)

---

## 🔴 PHASE 1: CRITICAL FIXES (Day 1 - Immediate)
*These vulnerabilities allow complete system compromise*

### 1. JWT Secret Management Fix
**File**: `ClubOSV1-backend/src/services/AuthService.ts`
```typescript
// TODO: Line 37 - Replace:
this.jwtSecret = process.env.JWT_SECRET || 'default-secret';
// With:
this.jwtSecret = process.env.JWT_SECRET;
if (!this.jwtSecret || this.jwtSecret.length < 32) {
  logger.error('SECURITY: JWT_SECRET missing or too weak');
  process.exit(1);
}
```

**File**: `ClubOSV1-backend/src/middleware/auth.ts`
```typescript
// TODO: Line 78 - Add validation before signing
if (!config.JWT_SECRET || config.JWT_SECRET === 'clubosv1_jwt_secret_dev_2024') {
  throw new Error('Production JWT secret not configured');
}
```

### 2. Encryption Key Enforcement
**File**: `ClubOSV1-backend/src/utils/encryption.ts`
```typescript
// TODO: Lines 34-35 - Replace:
logger.warn('Encryption skipped - no encryption key configured');
return text;
// With:
if (process.env.NODE_ENV === 'production') {
  logger.error('SECURITY: Encryption key required in production');
  throw new Error('System cannot start without encryption key');
}
return text; // Only allow unencrypted in development
```

### 3. Create Security Validator
**New File**: `ClubOSV1-backend/src/security/SecurityValidator.ts`
```typescript
// TODO: Create this file with startup security checks
export class SecurityValidator {
  static validateEnvironment(): void {
    // Check JWT_SECRET strength
    // Verify ENCRYPTION_KEY exists
    // Validate SESSION_SECRET
    // Check database SSL
    // Verify CORS settings
  }
}
```

**File**: `ClubOSV1-backend/src/index.ts`
```typescript
// TODO: Add at line ~50 before server starts
import { SecurityValidator } from './security/SecurityValidator';
SecurityValidator.validateEnvironment();
```

---

## 🟠 PHASE 2: HIGH PRIORITY (Day 2)
*These allow authentication bypass and data theft*

### 4. CSRF Token Persistence
**File**: `ClubOSV1-backend/src/utils/csrf.ts`
```typescript
// TODO: Replace in-memory Map with database storage
// Create migration for csrf_tokens table
// Or use existing blacklisted_tokens pattern
```

**New Migration**: `ClubOSV1-backend/src/database/migrations/234_add_csrf_tokens.sql`
```sql
CREATE TABLE IF NOT EXISTS csrf_tokens (
  session_id VARCHAR(255) PRIMARY KEY,
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_csrf_expires ON csrf_tokens(expires_at);
```

### 5. Strengthen Password Requirements
**File**: `ClubOSV1-backend/src/routes/auth.ts`
```typescript
// TODO: Line 28 - Update validation
body('password')
  .isLength({ min: 12 }) // Changed from 6
  .withMessage('Password must be at least 12 characters')
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
  .withMessage('Password must contain uppercase, lowercase, number, and special character')
```

**File**: `ClubOSV1-backend/src/services/AuthService.ts`
```typescript
// TODO: Line 469 - Update validatePassword()
if (password.length < 12) { // Changed from 6
  return { isValid: false, message: 'Password must be at least 12 characters' };
}
// Add special character check
if (!/[@$!%*?&]/.test(password)) {
  return { isValid: false, message: 'Password must contain a special character' };
}
```

### 6. Fix Rate Limiting
**File**: `ClubOSV1-backend/src/middleware/authLimiter.ts`
```typescript
// TODO: Line 19-20 - Tighten limits
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Reduced from 20
  skipSuccessfulRequests: true, // Don't count successful logins
```

---

## 🟡 PHASE 3: SQL INJECTION FIXES (Day 3)
*Parameterize all queries*

### 7. Audit All Database Queries
**Files to Check**:
- `ClubOSV1-backend/src/utils/database.ts`
- `ClubOSV1-backend/src/services/*.ts`
- `ClubOSV1-backend/src/routes/*.ts`

```typescript
// TODO: Find and replace patterns like:
db.query(`SELECT * FROM ${table}`) // DANGEROUS
// With:
db.query('SELECT * FROM users WHERE id = $1', [userId]) // SAFE
```

### 8. Create Query Builder Wrapper
**New File**: `ClubOSV1-backend/src/security/SafeQuery.ts`
```typescript
// TODO: Create safe query wrapper
export class SafeQuery {
  static select(table: string, conditions: object) {
    // Validate table name against whitelist
    // Build parameterized query
    // Return safe query string and params
  }
}
```

---

## 🟢 PHASE 4: SESSION MANAGEMENT (Day 4)

### 9. Implement Session Service
**New File**: `ClubOSV1-backend/src/services/SessionManager.ts`
```typescript
// TODO: Create comprehensive session management
export class SessionManager {
  // Track active sessions
  // Revoke on password change
  // Implement device fingerprinting
  // Add concurrent session limits
}
```

### 10. Add Session Revocation
**File**: `ClubOSV1-backend/src/routes/auth.ts`
```typescript
// TODO: Line 825 (change-password endpoint)
// After password change:
await SessionManager.revokeAllSessions(user.id);
// Force re-login by blacklisting all existing tokens
```

---

## 🔵 PHASE 5: MONITORING & AUDIT (Day 5)

### 11. Security Audit Logger
**New File**: `ClubOSV1-backend/src/security/AuditLogger.ts`
```typescript
// TODO: Create security event logger
export class AuditLogger {
  static logSecurityEvent(event: {
    type: 'AUTH_FAIL' | 'PERMISSION_DENIED' | 'SUSPICIOUS_ACTIVITY',
    userId?: string,
    ip: string,
    details: any
  }) {
    // Log to database
    // Alert on patterns
    // Track metrics
  }
}
```

### 12. Add Security Headers
**File**: `ClubOSV1-backend/src/middleware/security.ts`
```typescript
// TODO: Line 134-136 - Remove unsafe-inline
scriptSrc: [
  "'self'",
  // "'unsafe-inline'", // REMOVE THIS
  // "'unsafe-eval'",   // REMOVE THIS
  "https://cdn.jsdelivr.net",
  "https://vercel.live"
]
```

---

## 📋 TESTING CHECKLIST
*Test each item locally before commit*

### Authentication Tests
- [ ] Cannot login with 'default-secret' JWT
- [ ] System won't start without JWT_SECRET
- [ ] Passwords require 12+ characters with special chars
- [ ] Rate limiting blocks after 5 attempts
- [ ] Token refresh works properly
- [ ] Session revoked on password change

### Security Tests
- [ ] SQL injection attempts blocked
- [ ] XSS attempts sanitized
- [ ] CSRF tokens validated
- [ ] Encryption enforced for sensitive data
- [ ] Security headers present
- [ ] Audit logs created for failures

### Database Tests
- [ ] Migrations run successfully
- [ ] Queries are parameterized
- [ ] Indexes improve performance
- [ ] Cleanup jobs run properly

---

## 🚀 DEPLOYMENT PLAN

### Pre-Deployment
1. Create backup of production database
2. Test all changes locally
3. Run `npx tsc --noEmit` - no errors
4. Test on mobile devices
5. Document all changes in CHANGELOG.md

### Deployment Steps
```bash
# 1. Create security branch
git checkout -b security-critical-fixes

# 2. Implement Phase 1 fixes
# ... make changes ...

# 3. Test locally
cd ClubOSV1-backend && npm run dev
cd ClubOSV1-frontend && npm run dev

# 4. Run TypeScript check
npx tsc --noEmit

# 5. Update version
# CHANGELOG.md: Add v1.22.0 entry
# README.md: Update to v1.22.0

# 6. Commit and deploy
git add -A
git commit -m "security: critical vulnerability fixes - JWT, encryption, CSRF, passwords

- Enforce JWT_SECRET validation on startup
- Require ENCRYPTION_KEY in production
- Implement database-backed CSRF tokens
- Increase password minimum to 12 characters
- Add SQL injection prevention
- Implement session revocation
- Tighten rate limiting to 5 attempts
- Add security audit logging

BREAKING CHANGES:
- Passwords now require 12+ characters
- System won't start without proper secrets
- Rate limiting reduced to 5 attempts"

git push origin security-critical-fixes

# 7. Create PR and merge (or push directly if urgent)
```

### Post-Deployment
1. Monitor Railway logs for errors
2. Test authentication flow in production
3. Verify all operators can still login
4. Check that patterns still work
5. Monitor for any 500 errors

---

## ⚠️ BREAKING CHANGES
1. **Password Policy**: Users with <12 char passwords must reset
2. **Environment Variables**: Must set strong JWT_SECRET and ENCRYPTION_KEY
3. **Rate Limiting**: Reduced from 20 to 5 attempts
4. **Session Management**: All users logged out on deployment

---

## 📊 SUCCESS METRICS
- Security score improves from 4/10 to 8/10
- No default secrets in production
- All sensitive data encrypted
- SQL injection vulnerabilities eliminated
- Comprehensive audit logging active
- GDPR compliance features added

---

## 🔄 ROLLBACK PLAN
If issues occur after deployment:
```bash
# Revert to previous version
git revert HEAD
git push

# Or checkout previous commit
git checkout [previous-commit-hash]
git push --force  # Use with caution
```

---

## 📝 NOTES FOR OPERATORS
- You may need to login again after deployment
- Passwords now require 12+ characters and special characters
- If you see more login failures, it's the stricter rate limiting
- Contact support if you cannot access the system

---

*Remember: This is PRODUCTION - test everything locally first!*