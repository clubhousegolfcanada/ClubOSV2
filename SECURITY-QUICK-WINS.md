# ClubOS V1 Security Quick Wins Implementation Guide

## 🚨 Critical Fix #1: Next.js Vulnerability (30 minutes)

### Current Issue
Next.js 14.0.4 has multiple critical vulnerabilities including:
- Server-Side Request Forgery (SSRF)
- Cache poisoning
- Denial of Service (DoS)

### Fix Implementation
```bash
cd ClubOSV1-frontend
npm update next@latest react@latest react-dom@latest
npm audit fix
npm run build
```

## 🛡️ Quick Win #2: Enable CSRF Protection (1 hour)

### Current Issue
CSRF protection is disabled in `/ClubOSV1-backend/src/middleware/security.ts`

### Fix Implementation
```typescript
// In security.ts, replace the commented section with:
import csrf from 'csurf';

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600 // 1 hour
  }
});

// Add after other middleware
app.use(csrfProtection);

// Add CSRF token to responses
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});
```

## 🔒 Quick Win #3: Fix X-Frame-Options (15 minutes)

### Current Issue
Frontend allows all iframes with `ALLOWALL`

### Fix Implementation
```typescript
// In /ClubOSV1-frontend/src/middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Change from ALLOWALL to SAMEORIGIN
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  
  return response;
}
```

## 🧪 Quick Win #4: Basic Security Test Suite (2 hours)

### Create `/ClubOSV1-backend/src/__tests__/security/security.test.ts`
```typescript
import request from 'supertest';
import { app } from '../../app';

describe('Security Tests', () => {
  // Test 1: SQL Injection Prevention
  describe('SQL Injection Prevention', () => {
    test('should prevent SQL injection in login', async () => {
      const maliciousPayloads = [
        "admin'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM users--"
      ];

      for (const payload of maliciousPayloads) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: payload, password: payload });
        
        expect(response.status).not.toBe(500);
        expect(response.body.error).toBeDefined();
      }
    });
  });

  // Test 2: XSS Prevention
  describe('XSS Prevention', () => {
    test('should sanitize XSS attempts', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/history')
          .set('Authorization', 'Bearer valid-token')
          .send({ request: payload });
        
        expect(response.text).not.toContain('<script>');
        expect(response.text).not.toContain('javascript:');
      }
    });
  });

  // Test 3: Authentication Security
  describe('Authentication Security', () => {
    test('should not leak user existence', async () => {
      const response1 = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'wrong' });
      
      const response2 = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'wrong' });
      
      // Both should return same error message
      expect(response1.body.error).toBe(response2.body.error);
    });

    test('should enforce rate limiting', async () => {
      const attempts = Array(6).fill(null);
      const responses = await Promise.all(
        attempts.map(() => 
          request(app)
            .post('/api/auth/login')
            .send({ email: 'test@test.com', password: 'wrong' })
        )
      );
      
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.status).toBe(429);
    });
  });

  // Test 4: Authorization Boundaries
  describe('Authorization Boundaries', () => {
    test('should prevent unauthorized access', async () => {
      const userToken = 'user-jwt-token';
      
      // Try to access admin endpoint
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(403);
    });
  });
});
```

## 🔐 Quick Win #5: Environment Security (1 hour)

### Create `/ClubOSV1-backend/src/utils/secrets.ts`
```typescript
export class SecretsManager {
  private static instance: SecretsManager;
  private secrets: Map<string, string> = new Map();

  static getInstance(): SecretsManager {
    if (!SecretsManager.instance) {
      SecretsManager.instance = new SecretsManager();
    }
    return SecretsManager.instance;
  }

  // Validate all secrets on startup
  validateSecrets(): void {
    const required = [
      'JWT_SECRET',
      'ENCRYPTION_KEY',
      'DATABASE_URL',
      'OPENAI_API_KEY'
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required secrets: ${missing.join(', ')}`);
    }

    // Check for default values in production
    if (process.env.NODE_ENV === 'production') {
      if (process.env.JWT_SECRET === 'your-secret-jwt-key') {
        throw new Error('Default JWT_SECRET detected in production!');
      }
      if (process.env.ENCRYPTION_KEY === 'your-32-character-encryption-key') {
        throw new Error('Default ENCRYPTION_KEY detected in production!');
      }
    }
  }

  // Rotate secrets
  async rotateSecret(key: string): Promise<void> {
    // Implementation for secret rotation
    console.log(`Rotating secret: ${key}`);
  }
}
```

## 📝 Quick Win #6: Security Headers Audit (30 minutes)

### Update `/ClubOSV1-backend/src/middleware/security.ts`
```typescript
export const securityHeaders = (app: Express) => {
  // Enhanced security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.sentry.io"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", process.env.NEXT_PUBLIC_API_URL || ''],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: "no-referrer" },
    xssFilter: true,
  }));
};
```

## 🚀 Implementation Checklist

### Immediate (Today)
- [ ] Update Next.js to latest version
- [ ] Fix X-Frame-Options header
- [ ] Run `npm audit` and fix vulnerabilities

### This Week
- [ ] Enable CSRF protection
- [ ] Add basic security tests
- [ ] Audit environment variables
- [ ] Review security headers

### Next Week
- [ ] Implement secret rotation
- [ ] Add more comprehensive tests
- [ ] Set up automated security scanning
- [ ] Document security procedures

## 📊 Verification Steps

After implementing each fix:

1. **Next.js Update**
   ```bash
   npm list next
   npm audit
   ```

2. **CSRF Protection**
   - Test POST requests require CSRF token
   - Verify cookie settings in browser

3. **X-Frame-Options**
   - Check response headers in browser
   - Try embedding in iframe (should fail)

4. **Security Tests**
   ```bash
   npm test -- security.test.ts
   ```

5. **Environment Security**
   - Restart app and check for warnings
   - Verify no defaults in production

## 🎯 Expected Results

After implementing these quick wins:
- **0 critical vulnerabilities** in npm audit
- **CSRF protection** on all state-changing requests
- **No iframe embedding** from external sites
- **Basic security test coverage** established
- **Validated secrets** in production

## 📞 Need Help?

If you encounter issues:
1. Check the detailed roadmap for more context
2. Review error logs for specific issues
3. Test in development before production
4. Consider professional security audit for validation