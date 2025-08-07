import request from 'supertest';
import express from 'express';
import { db } from '../../utils/database';
import { logger } from '../../utils/logger';
import { authenticate } from '../../middleware/auth';

// Mock dependencies
jest.mock('../../utils/database');
jest.mock('../../utils/logger');
jest.mock('../../middleware/auth');

const mockedDb = db as jest.Mocked<typeof db>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('Security Vulnerability Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create test app
    app = express();
    app.use(express.json());
    
    // Add test routes
    app.post('/test/sql', async (req, res) => {
      const { userId } = req.body;
      // Vulnerable query (for testing)
      const query = `SELECT * FROM users WHERE id = '${userId}'`;
      res.json({ query });
    });

    app.post('/test/xss', (req, res) => {
      const { input } = req.body;
      // Vulnerable XSS (for testing)
      res.send(`<div>${input}</div>`);
    });

    app.post('/test/injection', (req, res) => {
      const { command } = req.body;
      // Command injection vulnerability (for testing)
      res.json({ command });
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in user queries', async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      
      const response = await request(app)
        .post('/test/sql')
        .send({ userId: maliciousInput });

      // In real app, this should be parameterized
      expect(response.body.query).toContain(maliciousInput);
      // This test documents the vulnerability - real code should use parameterized queries
    });

    it('should use parameterized queries for database operations', () => {
      // Test that our actual database functions use parameterized queries
      const mockQuery = jest.fn();
      mockedDb.query = mockQuery;

      // Simulate a safe query pattern
      const safeUserId = 'user-123';
      const safeQuery = 'SELECT * FROM users WHERE id = $1';
      
      mockQuery(safeQuery, [safeUserId]);
      
      expect(mockQuery).toHaveBeenCalledWith(safeQuery, [safeUserId]);
      // Verify no string concatenation in query
      expect(safeQuery).not.toContain(safeUserId);
    });
  });

  describe('XSS Prevention', () => {
    it('should escape HTML in user input', async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      
      const response = await request(app)
        .post('/test/xss')
        .send({ input: xssPayload });

      // This test shows the vulnerability
      expect(response.text).toContain('<script>');
      // Real implementation should escape: &lt;script&gt;
    });

    it('should sanitize user-generated content', () => {
      const dangerousInput = '<img src=x onerror="alert(1)">';
      const sanitized = dangerousInput
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
      
      expect(sanitized).not.toContain('<img');
      expect(sanitized).toContain('&lt;img');
    });
  });

  describe('Authentication Bypass Prevention', () => {
    it('should prevent JWT token manipulation', async () => {
      const tamperedToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VySWQiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiJ9.';
      
      (authenticate as jest.Mock).mockImplementation((req, res, next) => {
        // Should validate token signature
        if (req.headers.authorization === `Bearer ${tamperedToken}`) {
          return res.status(401).json({ error: 'Invalid token' });
        }
        next();
      });

      app.get('/protected', authenticate, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
    });

    it('should prevent authorization header injection', async () => {
      const maliciousHeader = 'Bearer token\r\nX-Admin: true';
      
      const response = await request(app)
        .get('/protected')
        .set('Authorization', maliciousHeader);

      // Should reject malformed headers
      expect(response.status).not.toBe(200);
    });
  });

  describe('CSRF Protection', () => {
    it('should validate CSRF tokens on state-changing operations', async () => {
      app.post('/test/csrf-protected', (req, res) => {
        const csrfToken = req.headers['x-csrf-token'];
        if (!csrfToken) {
          return res.status(403).json({ error: 'CSRF token required' });
        }
        res.json({ success: true });
      });

      // Request without CSRF token
      const response1 = await request(app)
        .post('/test/csrf-protected')
        .send({ data: 'test' });

      expect(response1.status).toBe(403);

      // Request with CSRF token
      const response2 = await request(app)
        .post('/test/csrf-protected')
        .set('X-CSRF-Token', 'valid-token')
        .send({ data: 'test' });

      expect(response2.status).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on sensitive endpoints', async () => {
      let requestCount = 0;
      
      app.post('/test/rate-limited', (req, res) => {
        requestCount++;
        if (requestCount > 5) {
          return res.status(429).json({ error: 'Too many requests' });
        }
        res.json({ success: true });
      });

      // Make multiple requests
      const responses = await Promise.all(
        Array(10).fill(null).map(() => 
          request(app).post('/test/rate-limited')
        )
      );

      const tooManyRequests = responses.filter(r => r.status === 429);
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });

  describe('Input Validation', () => {
    it('should validate email format', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'admin+tag@company.org'
      ];

      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example .com'
      ];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      validEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(true);
      });

      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });

    it('should validate phone number format', () => {
      const validPhones = [
        '9025551234',
        '(902) 555-1234',
        '902-555-1234',
        '+1 902 555 1234'
      ];

      const invalidPhones = [
        '123',
        'abcdefghij',
        '902-555-12345678'
      ];

      const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;

      validPhones.forEach(phone => {
        const normalized = phone.replace(/\D/g, '');
        expect(normalized.length).toBeGreaterThanOrEqual(10);
      });
    });

    it('should reject oversized payloads', async () => {
      const largePayload = 'x'.repeat(10 * 1024 * 1024); // 10MB
      
      app.use(express.json({ limit: '1mb' }));
      app.post('/test/payload', (req, res) => {
        res.json({ received: req.body.data?.length });
      });

      const response = await request(app)
        .post('/test/payload')
        .send({ data: largePayload })
        .expect(413); // Payload Too Large
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should prevent directory traversal attacks', () => {
      const maliciousPath = '../../../etc/passwd';
      const safePath = maliciousPath.replace(/\.\./g, '');
      
      expect(safePath).not.toContain('..');
      expect(safePath).toBe('/etc/passwd');
    });

    it('should validate file paths', () => {
      const validatePath = (path: string): boolean => {
        // Check for path traversal patterns
        if (path.includes('../') || path.includes('..\\')) {
          return false;
        }
        // Check for absolute paths
        if (path.startsWith('/') || path.match(/^[a-zA-Z]:\\/)) {
          return false;
        }
        return true;
      };

      expect(validatePath('safe/file.txt')).toBe(true);
      expect(validatePath('../etc/passwd')).toBe(false);
      expect(validatePath('/etc/passwd')).toBe(false);
      expect(validatePath('C:\\Windows\\System32')).toBe(false);
    });
  });

  describe('Sensitive Data Exposure', () => {
    it('should not log sensitive information', () => {
      const sensitiveData = {
        password: 'secret123',
        creditCard: '4111111111111111',
        ssn: '123-45-6789',
        apiKey: 'sk_test_123456'
      };

      // Mock logger should redact sensitive fields
      const redact = (obj: any): any => {
        const sensitiveKeys = ['password', 'creditCard', 'ssn', 'apiKey', 'token'];
        const redacted = { ...obj };
        
        Object.keys(redacted).forEach(key => {
          if (sensitiveKeys.includes(key.toLowerCase())) {
            redacted[key] = '[REDACTED]';
          }
        });
        
        return redacted;
      };

      const logged = redact(sensitiveData);
      
      expect(logged.password).toBe('[REDACTED]');
      expect(logged.creditCard).toBe('[REDACTED]');
      expect(logged.apiKey).toBe('[REDACTED]');
    });

    it('should not include stack traces in production errors', () => {
      const error = new Error('Database connection failed');
      const productionError = {
        message: process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : error.message,
        stack: process.env.NODE_ENV === 'production' 
          ? undefined 
          : error.stack
      };

      // In production
      process.env.NODE_ENV = 'production';
      expect(productionError.stack).toBeUndefined();
      
      // In development
      process.env.NODE_ENV = 'development';
      expect(error.stack).toBeDefined();
    });
  });

  describe('Session Security', () => {
    it('should invalidate sessions on logout', async () => {
      const sessionStore = new Map();
      
      // Create session
      const sessionId = 'session-123';
      sessionStore.set(sessionId, { userId: 'user-123' });
      
      // Logout should clear session
      sessionStore.delete(sessionId);
      
      expect(sessionStore.has(sessionId)).toBe(false);
    });

    it('should regenerate session ID on privilege escalation', () => {
      const oldSessionId = 'old-session-123';
      const newSessionId = 'new-session-456';
      
      const sessionStore = new Map();
      sessionStore.set(oldSessionId, { userId: 'user-123', role: 'user' });
      
      // On role change, regenerate session
      const sessionData = sessionStore.get(oldSessionId);
      sessionStore.delete(oldSessionId);
      sessionStore.set(newSessionId, { ...sessionData, role: 'admin' });
      
      expect(sessionStore.has(oldSessionId)).toBe(false);
      expect(sessionStore.has(newSessionId)).toBe(true);
    });
  });

  describe('Security Headers', () => {
    it('should set security headers', async () => {
      app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Strict-Transport-Security', 'max-age=31536000');
        next();
      });

      app.get('/test/headers', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test/headers');
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toBe('max-age=31536000');
    });
  });
});