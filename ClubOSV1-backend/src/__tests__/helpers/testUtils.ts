import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a mock Express Request object
 */
export function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    method: 'GET',
    url: '/',
    get: jest.fn(),
    ...overrides
  } as any as Request;
}

/**
 * Create a mock Express Response object
 */
export function createMockResponse(): Response {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis()
  };
  return res as Response;
}

/**
 * Create a mock Next function
 */
export function createMockNext(): jest.Mock {
  return jest.fn();
}

/**
 * Generate test data for bookings
 */
export function generateTestBooking(overrides: any = {}) {
  return {
    id: uuidv4(),
    userId: 'test-user-' + Math.random().toString(36).substr(2, 9),
    bayNumber: Math.floor(Math.random() * 10) + 1,
    date: new Date().toISOString().split('T')[0],
    time: '14:00',
    duration: 60,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Generate test data for access logs
 */
export function generateTestAccessLog(overrides: any = {}) {
  return {
    id: uuidv4(),
    userId: 'test-user-' + Math.random().toString(36).substr(2, 9),
    action: 'grant',
    resource: 'main-door',
    timestamp: new Date().toISOString(),
    success: true,
    ...overrides
  };
}

/**
 * Generate test request for LLM
 */
export function generateTestLLMRequest(overrides: any = {}) {
  return {
    description: 'Test request description',
    userId: 'test-user-123',
    location: 'bay-1',
    ...overrides
  };
}

/**
 * Sleep helper for async tests
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a test file system structure
 */
export function createTestFileSystem() {
  const fs = require('fs');
  const path = require('path');
  
  const testDataDir = path.join(__dirname, '../../data-test');
  
  return {
    setup() {
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }
      
      // Create test files
      fs.writeFileSync(path.join(testDataDir, 'bookings.json'), '[]');
      fs.writeFileSync(path.join(testDataDir, 'access_logs.json'), '[]');
      fs.writeFileSync(path.join(testDataDir, 'request_history.json'), '[]');
    },
    
    cleanup() {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true });
      }
    },
    
    getPath(filename: string) {
      return path.join(testDataDir, filename);
    }
  };
}

/**
 * Mock environment variables for testing
 */
export function mockEnvironment(overrides: Record<string, string> = {}) {
  const originalEnv = process.env;
  
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PORT: '3002',
      JWT_SECRET: 'test-jwt-secret-32-characters-long',
      SESSION_SECRET: 'test-session-secret-32-chars-long',
      ...overrides
    };
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });
}

/**
 * Create a mock logger
 */
export function createMockLogger() {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };
}

/**
 * Assert that an async function throws
 */
export async function expectAsync(promise: Promise<any>) {
  return {
    async toThrow(expectedError?: string | RegExp | typeof Error) {
      try {
        await promise;
        throw new Error('Expected promise to throw but it resolved');
      } catch (error: any) {
        if (!expectedError) {
          return;
        }
        
        if (typeof expectedError === 'string') {
          expect(error.message).toContain(expectedError);
        } else if (expectedError instanceof RegExp) {
          expect(error.message).toMatch(expectedError);
        } else {
          expect(error).toBeInstanceOf(expectedError);
        }
      }
    }
  };
}
