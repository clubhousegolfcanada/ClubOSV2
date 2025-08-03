import request from 'supertest';
import { app } from '../../index';
import { generateTestToken, maliciousPayloads, createMockRequest, createMockResponse } from './test-utils';
import { csrfProtection } from '../../middleware/security';
import { sanitizeMiddleware } from '../../middleware/requestValidation';

describe('Security Test Suite', () => {
  let authToken: string;

  beforeAll(() => {
    authToken = generateTestToken();
  });

  describe('SQL Injection Prevention', () => {
    test('should prevent SQL injection in login', async () => {
      for (const payload of maliciousPayloads.sql) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: payload, password: payload });
        
        expect(response.status).not.toBe(500);
        expect(response.body).not.toContain('syntax error');
        expect(response.body).not.toContain('SQL');
        expect(response.body).not.toContain('DROP TABLE');
      }
    });

    test('should prevent SQL injection in user search', async () => {
      for (const payload of maliciousPayloads.sql) {
        const response = await request(app)
          .get(`/api/users/search?query=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${authToken}`);
        
        expect(response.status).not.toBe(500);
        if (response.body.error) {
          expect(response.body.error).not.toContain('syntax error');
        }
      }
    });
  });

  describe('XSS Prevention', () => {
    test('should sanitize user input in request body', async () => {
      const req = createMockRequest({
        body: { 
          request: maliciousPayloads.xss[0],
          description: '<img src=x onerror=alert("XSS")>',
          location: 'javascript:alert("XSS")'
        }
      });
      const res = createMockResponse();
      const next = jest.fn();

      await sanitizeMiddleware(req, res, next);

      expect(req.body.request).not.toContain('<script>');
      expect(req.body.description).not.toContain('onerror=');
      expect(req.body.location).not.toContain('javascript:');
      expect(next).toHaveBeenCalled();
    });

    test('should sanitize query parameters', async () => {
      for (const payload of maliciousPayloads.xss) {
        const response = await request(app)
          .get(`/api/history?search=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${authToken}`);
        
        if (response.status === 200 && response.text) {
          expect(response.text).not.toContain('<script>');
          expect(response.text).not.toContain('javascript:');
          expect(response.text).not.toContain('onerror=');
        }
      }
    });
  });

  describe('Authentication Security', () => {
    test('should not leak user existence on login failure', async () => {
      const nonExistent = await request(app)
        .post('/api/auth/login')
        .send({ email: 'doesnotexist@test.com', password: 'wrong' });
      
      const existing = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@clubhouse.com', password: 'wrongpassword' });
      
      // Both should return generic error message
      expect(nonExistent.body.error).toBe(existing.body.error);
      expect(nonExistent.body.error).toMatch(/Invalid credentials|Authentication failed/i);
    });

    test('should enforce rate limiting on auth endpoints', async () => {
      const attempts = Array(10).fill(null);
      const responses = [];
      
      for (const _ of attempts) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@test.com', password: 'wrong' });
        responses.push(response);
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // At least one should be rate limited
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    }, 15000); // 15 second timeout

    test('should require authentication for protected endpoints', async () => {
      const protectedEndpoints = [
        '/api/users/profile',
        '/api/bookings',
        '/api/tickets',
        '/api/analytics'
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app)
          .get(endpoint);
        
        expect(response.status).toBe(401);
        expect(response.body.error).toMatch(/Unauthorized|Authentication required/i);
      }
    });
  });

  describe('CSRF Protection', () => {
    test('should reject POST requests without CSRF token', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ data: 'test' });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/CSRF token missing/i);
    });

    test('should accept requests with valid CSRF token', async () => {
      // First get a CSRF token
      const tokenResponse = await request(app)
        .get('/api/csrf-token')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(tokenResponse.status).toBe(200);
      const csrfToken = tokenResponse.body.csrfToken;
      
      // Then use it in a POST request
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ data: 'test' });
      
      // Should not be 403 (CSRF error)
      expect(response.status).not.toBe(403);
    });

    test('should skip CSRF for GET requests', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${authToken}`);
      
      // Should not be 403 (CSRF error)
      expect(response.status).not.toBe(403);
    });
  });

  describe('Authorization Boundaries', () => {
    test('should enforce role-based access control', async () => {
      const userToken = generateTestToken('support');
      
      const adminOnlyEndpoints = [
        { method: 'GET', path: '/api/admin/users' },
        { method: 'POST', path: '/api/admin/settings' },
        { method: 'DELETE', path: '/api/admin/logs' }
      ];
      
      for (const endpoint of adminOnlyEndpoints) {
        const req = request(app)[endpoint.method.toLowerCase()](endpoint.path)
          .set('Authorization', `Bearer ${userToken}`);
          
        if (endpoint.method !== 'GET') {
          const csrfResponse = await request(app)
            .get('/api/csrf-token')
            .set('Authorization', `Bearer ${userToken}`);
          
          if (csrfResponse.body.csrfToken) {
            req.set('X-CSRF-Token', csrfResponse.body.csrfToken);
          }
        }
        
        const response = await req;
        expect(response.status).toBe(403);
        expect(response.body.error).toMatch(/Forbidden|Access denied|Insufficient permissions/i);
      }
    });
  });

  describe('Input Validation', () => {
    test('should validate email format', async () => {
      const invalidEmails = [
        'notanemail',
        '@invalid.com',
        'test@',
        'test..test@test.com',
        'test@test',
        'test @test.com',
        'test@test .com'
      ];
      
      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({ email, password: 'ValidPass123!', name: 'Test User' });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/email|validation/i);
      }
    });

    test('should enforce password complexity', async () => {
      const weakPasswords = [
        '123456',        // Too simple
        'password',      // Common password
        'short',         // Too short
        'NoNumbers!',    // No numbers
        'nospecialchars123', // No special characters
        'ALLUPPERCASE123!',  // No lowercase
        'alllowercase123!'   // No uppercase
      ];
      
      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({ email: 'test@test.com', password, name: 'Test User' });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/password|weak|complexity/i);
      }
    });

    test('should limit request body size', async () => {
      const largePayload = 'x'.repeat(11 * 1024 * 1024); // 11MB
      
      const response = await request(app)
        .post('/api/history')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ data: largePayload });
      
      expect(response.status).toBe(413); // Payload too large
    });
  });

  describe('Security Headers', () => {
    test('should set security headers on all responses', async () => {
      const response = await request(app).get('/health');
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    test('should set secure cookie attributes', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'password' });
      
      const setCookieHeader = response.headers['set-cookie'];
      if (setCookieHeader) {
        const cookieString = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
        
        if (process.env.NODE_ENV === 'production') {
          expect(cookieString).toMatch(/Secure/i);
          expect(cookieString).toMatch(/SameSite=Strict/i);
        }
        expect(cookieString).toMatch(/HttpOnly/i);
      }
    });
  });

  describe('Path Traversal Prevention', () => {
    test('should prevent path traversal attacks', async () => {
      for (const payload of maliciousPayloads.pathTraversal) {
        const response = await request(app)
          .get(`/api/files/${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${authToken}`);
        
        expect(response.status).not.toBe(200);
        if (response.body.data) {
          expect(response.body.data).not.toContain('root:');
          expect(response.body.data).not.toContain('Administrator');
        }
      }
    });
  });

  describe('Command Injection Prevention', () => {
    test('should prevent command injection', async () => {
      for (const payload of maliciousPayloads.commandInjection) {
        const response = await request(app)
          .post('/api/system/execute')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ command: payload });
        
        expect(response.status).not.toBe(200);
        if (response.body.output) {
          expect(response.body.output).not.toContain('/etc/passwd');
          expect(response.body.output).not.toContain('root:');
        }
      }
    });
  });
});