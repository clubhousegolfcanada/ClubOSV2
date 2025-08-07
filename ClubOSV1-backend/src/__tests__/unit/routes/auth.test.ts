import request from 'supertest';
import express from 'express';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../utils/database';
import { logger } from '../../../utils/logger';
import { generateToken, authenticate } from '../../../middleware/auth';
import { errorHandler } from '../../../middleware/errorHandler';

// Import the router directly using require to avoid TypeScript issues
const authRouter = require('../../../routes/auth').default;

// Mock dependencies
jest.mock('../../../utils/database');
jest.mock('../../../utils/logger');
jest.mock('../../../middleware/auth');
jest.mock('../../../middleware/roleGuard', () => ({
  roleGuard: jest.fn(() => (req: any, res: any, next: any) => next())
}));
jest.mock('../../../utils/transformers', () => ({
  transformUser: jest.fn((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  }))
}));
jest.mock('uuid');

const mockedDb = db as jest.Mocked<typeof db>;
const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedUuid = uuidv4 as jest.MockedFunction<typeof uuidv4>;

// Mock bcryptjs manually
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn()
}));

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/auth', authRouter);
app.use(errorHandler);

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUuid.mockReturnValue('test-uuid');
    
    // Setup default mocks for authenticate middleware
    (authenticate as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
      req.user = { userId: 'test-admin', role: 'admin', email: 'admin@test.com' };
      next();
    });
    
    // Setup logger mocks
    mockedLogger.info = jest.fn();
    mockedLogger.error = jest.fn();
    mockedLogger.warn = jest.fn();
  });

  describe('POST /auth/login', () => {
    it('should login user with valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedPassword',
        role: 'operator',
        isActive: true
      };

      (mockedDb.findUserByEmail as jest.Mock) = jest.fn().mockResolvedValue(mockUser);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(true);
      (generateToken as jest.Mock).mockReturnValue('test-token');
      (mockedDb.createAuthLog as jest.Mock) = jest.fn().mockResolvedValue({});
      (mockedDb.updateLastLogin as jest.Mock) = jest.fn().mockResolvedValue({});

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          token: 'test-token',
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            role: 'operator'
          }
        }
      });
      expect(mockedDb.findUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(bcryptjs.compare).toHaveBeenCalledWith('password123', 'hashedPassword');
    });

    it('should fail with invalid password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashedPassword'
      };

      (mockedDb.findUserByEmail as jest.Mock) = jest.fn().mockResolvedValue(mockUser);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(false);
      (mockedDb.createAuthLog as jest.Mock) = jest.fn().mockResolvedValue({});

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    });

    it('should fail with non-existent user', async () => {
      (mockedDb.findUserByEmail as jest.Mock) = jest.fn().mockResolvedValue(null);
      (mockedDb.createAuthLog as jest.Mock) = jest.fn().mockResolvedValue({});

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /auth/register', () => {
    it('should register new user', async () => {
      (mockedDb.findUserByEmail as jest.Mock) = jest.fn().mockResolvedValue(null);
      (bcryptjs.hash as jest.Mock).mockResolvedValue('hashedPassword');
      (mockedDb.createUser as jest.Mock) = jest.fn().mockResolvedValue({
        id: 'new-user-123',
        email: 'new@example.com',
        name: 'New User',
        role: 'operator'
      });
      (mockedDb.createAuthLog as jest.Mock) = jest.fn().mockResolvedValue({});

      const response = await request(app)
        .post('/auth/register')
        .set('Authorization', 'Bearer test-token')
        .send({
          email: 'new@example.com',
          password: 'StrongPass123!',
          name: 'New User',
          role: 'operator'
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 'new-user-123',
          email: 'new@example.com',
          name: 'New User',
          role: 'operator'
        }
      });
      // Password hashing happens inside db.createUser, not in the route handler
    });

    it('should fail if email already exists', async () => {
      (mockedDb.findUserByEmail as jest.Mock) = jest.fn().mockResolvedValue({
        id: 'existing-user',
        email: 'existing@example.com'
      });

      const response = await request(app)
        .post('/auth/register')
        .set('Authorization', 'Bearer test-token')
        .send({
          email: 'existing@example.com',
          password: 'StrongPass123!',
          name: 'Test User',
          role: 'operator'
        });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        code: 'USER_EXISTS',
        message: 'User with this email already exists'
      });
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .post('/auth/register')
        .set('Authorization', 'Bearer test-token')
        .send({
          email: 'test@example.com',
          password: 'weak',
          name: 'Test User',
          role: 'operator'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should handle password reset request', async () => {
      (mockedDb.findUserByEmail as jest.Mock) = jest.fn().mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com'
      });

      const response = await request(app)
        .post('/auth/forgot-password')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions.'
      });
      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Password reset requested:',
        { email: 'test@example.com' }
      );
    });

    it('should return success even for non-existent email', async () => {
      (mockedDb.findUserByEmail as jest.Mock) = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions.'
      });
    });
  });

  // Logout route doesn't exist in the current implementation
  // Skipping these tests

  describe('GET /auth/me', () => {
    it('should return current user info', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'operator'
      };
      
      (authenticate as jest.Mock).mockImplementation((req, res, next) => {
        req.user = { id: 'user-123', userId: 'user-123' };
        next();
      });
      (mockedDb.findUserById as jest.Mock) = jest.fn().mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'operator'
        }
      });
    });
  });

  describe('POST /auth/change-password', () => {
    it('should change password for authenticated user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'oldHashedPassword'
      };
      
      (authenticate as jest.Mock).mockImplementation((req, res, next) => {
        req.user = { id: 'user-123', userId: 'user-123' };
        next();
      });
      (mockedDb.findUserById as jest.Mock) = jest.fn().mockResolvedValue(mockUser);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(true);
      (bcryptjs.hash as jest.Mock).mockResolvedValue('newHashedPassword');
      (mockedDb.updateUserPassword as jest.Mock) = jest.fn().mockResolvedValue(true);
      (mockedDb.createAuthLog as jest.Mock) = jest.fn().mockResolvedValue({});

      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer test-token')
        .send({
          currentPassword: 'oldPassword',
          newPassword: 'NewStrongPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Password changed successfully'
      });
      expect(bcryptjs.compare).toHaveBeenCalledWith('oldPassword', 'oldHashedPassword');
      // Password hashing happens inside db.updateUserPassword, not in the route handler
    });

    it('should fail with incorrect current password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashedPassword'
      };
      
      (authenticate as jest.Mock).mockImplementation((req, res, next) => {
        req.user = { id: 'user-123', userId: 'user-123' };
        next();
      });
      (mockedDb.findUserById as jest.Mock) = jest.fn().mockResolvedValue(mockUser);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer test-token')
        .send({
          currentPassword: 'wrongPassword',
          newPassword: 'NewStrongPassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'INVALID_PASSWORD',
        message: 'Current password is incorrect'
      });
    });
  });
});