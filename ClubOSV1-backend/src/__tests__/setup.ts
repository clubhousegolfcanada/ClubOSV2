import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.test') });

// Set up test environment variables (override with test values)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/clubos_test';
process.env.PORT = '3001';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-ok!';
process.env.DISABLE_EXTERNAL_APIS = 'true';
process.env.DISABLE_SLACK = 'true';
process.env.DISABLE_PUSH_NOTIFICATIONS = 'true';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock logger to prevent actual logging during tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }
}));

// Mock database to prevent actual database connections
jest.mock('../utils/database', () => ({
  db: {
    query: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    end: jest.fn(),
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    createUser: jest.fn(),
    updateUserPassword: jest.fn(),
    deleteUser: jest.fn(),
    createAuthLog: jest.fn(),
    createRequest: jest.fn(),
    transaction: jest.fn((callback) => callback({
      query: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
    })),
  }
}));

// Mock envValidator to prevent process.exit in tests
jest.mock('../utils/envValidator', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 3001,
    DATABASE_URL: 'postgresql://test:test@localhost:5432/clubos_test',
    JWT_SECRET: 'test-jwt-secret',
    SESSION_SECRET: 'test-session-secret',
    CORS_ORIGIN: 'http://localhost:3000',
    OPENAI_API_KEY: 'sk-test-key-not-real',
    ENCRYPTION_KEY: 'test-encryption-key-32-chars-ok!'
  }
}));

// Mock OpenAI client
jest.mock('../utils/openaiClient', () => ({
  getOpenAIClient: jest.fn(() => null),
  hasOpenAI: jest.fn(() => false)
}));

// Mock external services
jest.mock('../services/slackFallback', () => ({
  slackFallbackService: {
    sendMessage: jest.fn(),
    sendRequest: jest.fn(),
    sendFormattedRequest: jest.fn(),
  }
}));

jest.mock('../services/openphoneService', () => ({
  openPhoneService: {
    sendMessage: jest.fn(),
    getConversations: jest.fn(),
  }
}));

jest.mock('../services/hubspotService', () => ({
  hubspotService: {
    searchByPhone: jest.fn(),
    createContact: jest.fn(),
    updateContact: jest.fn(),
  }
}));

jest.mock('../services/notificationService', () => ({
  notificationService: {
    sendToUsers: jest.fn(),
    sendToUser: jest.fn(),
  }
}));

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Clean up after all tests
afterAll(async () => {
  // Clear all timers
  jest.clearAllTimers();
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Increase timeout for tests
jest.setTimeout(30000);