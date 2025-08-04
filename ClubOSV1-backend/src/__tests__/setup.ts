// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.PORT = '3001';
process.env.CORS_ORIGIN = 'http://localhost:3000';

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
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    createUser: jest.fn(),
    updateUserPassword: jest.fn(),
    deleteUser: jest.fn(),
    createAuthLog: jest.fn(),
  }
}));

// Mock envValidator to prevent process.exit in tests
jest.mock('../utils/envValidator', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 3001,
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-jwt-secret',
    CORS_ORIGIN: 'http://localhost:3000',
    OPENAI_API_KEY: 'test-api-key'
  }
}));

// Increase timeout for tests
jest.setTimeout(30000);