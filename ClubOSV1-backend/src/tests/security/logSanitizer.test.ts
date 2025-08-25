/**
 * Security Tests for Log Sanitization
 * Ensures sensitive data is never exposed in logs
 */

import { describe, test, expect } from '@jest/globals';
import { 
  sanitizeData, 
  sanitizeError, 
  sanitizeRequest,
  mightContainSensitiveData 
} from '../../utils/logSanitizer';

describe('Log Sanitizer Security Tests', () => {
  
  describe('sanitizeData', () => {
    test('should redact password fields', () => {
      const data = {
        email: 'user@example.com',
        password: 'SuperSecret123!',
        name: 'Test User'
      };
      
      const sanitized = sanitizeData(data);
      
      expect(sanitized.email).toBe('user@example.com');
      expect(sanitized.name).toBe('Test User');
      expect(sanitized.password).toBe('[REDACTED]');
    });

    test('should redact multiple password variations', () => {
      const data = {
        password: 'secret1',
        newPassword: 'secret2',
        oldPassword: 'secret3',
        currentPassword: 'secret4',
        confirmPassword: 'secret5',
        user_password: 'secret6',
        passwordHash: 'secret7'
      };
      
      const sanitized = sanitizeData(data);
      
      Object.keys(data).forEach(key => {
        expect(sanitized[key]).toBe('[REDACTED]');
      });
    });

    test('should redact nested password fields', () => {
      const data = {
        user: {
          email: 'user@example.com',
          password: 'SecretPassword',
          profile: {
            name: 'Test User',
            settings: {
              apiKey: 'secret-api-key'
            }
          }
        }
      };
      
      const sanitized = sanitizeData(data);
      
      expect(sanitized.user.email).toBe('user@example.com');
      expect(sanitized.user.password).toBe('[REDACTED]');
      expect(sanitized.user.profile.name).toBe('Test User');
      expect(sanitized.user.profile.settings.apiKey).toBe('[REDACTED]');
    });

    test('should redact tokens and secrets', () => {
      const data = {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        refreshToken: 'refresh-token-123',
        accessToken: 'access-token-456',
        apiKey: 'api-key-789',
        secret: 'secret-value',
        clientSecret: 'client-secret-abc',
        webhook_secret: 'webhook-secret-def'
      };
      
      const sanitized = sanitizeData(data);
      
      Object.keys(data).forEach(key => {
        expect(sanitized[key]).toBe('[REDACTED]');
      });
    });

    test('should redact authorization headers', () => {
      const data = {
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
          'x-api-key': 'secret-api-key',
          'cookie': 'session=secret-session-id'
        }
      };
      
      const sanitized = sanitizeData(data);
      
      expect(sanitized.headers['content-type']).toBe('application/json');
      expect(sanitized.headers['authorization']).toBe('[REDACTED]');
      expect(sanitized.headers['x-api-key']).toBe('[REDACTED]');
      expect(sanitized.headers['cookie']).toBe('[REDACTED]');
    });

    test('should handle arrays with sensitive data', () => {
      const data = {
        users: [
          { email: 'user1@example.com', password: 'pass1' },
          { email: 'user2@example.com', password: 'pass2' }
        ]
      };
      
      const sanitized = sanitizeData(data);
      
      sanitized.users.forEach((user: any, index: number) => {
        expect(user.email).toBe(data.users[index].email);
        expect(user.password).toBe('[REDACTED]');
      });
    });

    test('should detect JWT tokens in strings', () => {
      const data = {
        message: 'User logged in with token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature'
      };
      
      const sanitized = sanitizeData(data);
      
      expect(sanitized.message).toContain('[REDACTED_TOKEN]');
      expect(sanitized.message).not.toContain('eyJ');
    });
  });

  describe('sanitizeRequest', () => {
    test('should sanitize request body with passwords', () => {
      const req = {
        method: 'POST',
        url: '/api/auth/login',
        path: '/api/auth/login',
        body: {
          email: 'user@example.com',
          password: 'MySecretPassword123!'
        },
        headers: {
          'content-type': 'application/json'
        },
        ip: '127.0.0.1'
      };
      
      const sanitized = sanitizeRequest(req);
      
      expect(sanitized.method).toBe('POST');
      expect(sanitized.path).toBe('/api/auth/login');
      expect(sanitized.body.email).toBe('user@example.com');
      expect(sanitized.body.password).toBe('[REDACTED]');
    });

    test('should sanitize query parameters with tokens', () => {
      const req = {
        method: 'GET',
        url: '/api/data',
        path: '/api/data',
        query: {
          userId: '123',
          token: 'secret-token',
          apiKey: 'secret-api-key'
        }
      };
      
      const sanitized = sanitizeRequest(req);
      
      expect(sanitized.query.userId).toBe('123');
      expect(sanitized.query.token).toBe('[REDACTED]');
      expect(sanitized.query.apiKey).toBe('[REDACTED]');
    });

    test('should include safe user info', () => {
      const req = {
        method: 'GET',
        path: '/api/profile',
        user: {
          id: '123',
          email: 'user@example.com',
          role: 'customer',
          password: 'should-not-be-here',
          token: 'should-not-be-here'
        }
      };
      
      const sanitized = sanitizeRequest(req);
      
      expect(sanitized.user).toEqual({
        id: '123',
        email: 'user@example.com',
        role: 'customer'
      });
      expect(sanitized.user).not.toHaveProperty('password');
      expect(sanitized.user).not.toHaveProperty('token');
    });
  });

  describe('sanitizeError', () => {
    test('should sanitize error config with auth headers', () => {
      const error: any = {
        message: 'Request failed',
        code: 'ERR_BAD_REQUEST',
        config: {
          headers: {
            'Authorization': 'Bearer secret-token'
          },
          data: {
            password: 'secret'
          }
        }
      };
      
      const sanitized = sanitizeError(error);
      
      expect(sanitized.message).toBe('Request failed');
      expect(sanitized.code).toBe('ERR_BAD_REQUEST');
      expect(sanitized.config.headers.Authorization).toBe('[REDACTED]');
      expect(sanitized.config.data.password).toBe('[REDACTED]');
    });

    test('should redact stack traces in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Test error');
      const sanitized = sanitizeError(error);
      
      expect(sanitized.stack).toBe('[REDACTED]');
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('mightContainSensitiveData', () => {
    test('should detect strings with password keywords', () => {
      expect(mightContainSensitiveData('password=123')).toBe(true);
      expect(mightContainSensitiveData('user_password')).toBe(true);
      expect(mightContainSensitiveData('apiKey=secret')).toBe(true);
      expect(mightContainSensitiveData('token: abc')).toBe(true);
    });

    test('should detect JWT patterns', () => {
      expect(mightContainSensitiveData('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toBe(true);
    });

    test('should not flag safe strings', () => {
      expect(mightContainSensitiveData('hello world')).toBe(false);
      expect(mightContainSensitiveData('user@example.com')).toBe(false);
      expect(mightContainSensitiveData('This is a normal message')).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    test('should never expose password in error logs', () => {
      const errorRequest = {
        method: 'POST',
        path: '/api/auth/users',
        body: {
          email: 'daskew@gmail.com',
          name: 'Dylan',
          password: 'C0zm3dd9u..',
          role: 'customer',
          phone: ''
        }
      };
      
      const sanitized = sanitizeRequest(errorRequest);
      const logOutput = JSON.stringify(sanitized);
      
      // Ensure the actual password never appears in the output
      expect(logOutput).not.toContain('C0zm3dd9u');
      expect(logOutput).toContain('[REDACTED]');
      expect(logOutput).toContain('daskew@gmail.com'); // Email should still be visible
    });

    test('should handle complex nested structures', () => {
      const complexData = {
        request: {
          body: {
            user: {
              credentials: {
                password: 'secret',
                confirmPassword: 'secret'
              }
            }
          }
        },
        response: {
          data: {
            token: 'jwt-token',
            refreshToken: 'refresh-token'
          }
        },
        error: {
          config: {
            headers: {
              Authorization: 'Bearer token'
            }
          }
        }
      };
      
      const sanitized = sanitizeData(complexData);
      const stringified = JSON.stringify(sanitized);
      
      // No sensitive data should appear
      expect(stringified).not.toContain('secret');
      expect(stringified).not.toContain('jwt-token');
      expect(stringified).not.toContain('refresh-token');
      expect(stringified).not.toContain('Bearer token');
      
      // Should have redacted markers
      expect(stringified.match(/\[REDACTED\]/g)?.length).toBeGreaterThan(4);
    });
  });
});