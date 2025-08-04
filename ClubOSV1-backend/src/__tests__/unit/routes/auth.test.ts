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

      mockedDb.findUserByEmail = jest.fn().mockResolvedValue(mockUser);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(true);
      (generateToken as jest.Mock).mockReturnValue('test-token');
      mockedDb.createAuthLog = jest.fn().mockResolvedValue({});

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        token: 'test-token',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'operator'
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

      mockedDb.findUserByEmail = jest.fn().mockResolvedValue(mockUser);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(false);
      mockedDb.createAuthLog = jest.fn().mockResolvedValue({});

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid credentials'
      });
    });

    it('should fail with non-existent user', async () => {
      mockedDb.findUserByEmail = jest.fn().mockResolvedValue(null);
      mockedDb.createAuthLog = jest.fn().mockResolvedValue({});

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid credentials'
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
      mockedDb.findUserByEmail = jest.fn().mockResolvedValue(null);
      (bcryptjs.hash as jest.Mock).mockResolvedValue('hashedPassword');
      mockedDb.createUser = jest.fn().mockResolvedValue({
        id: 'new-user-123',
        email: 'new@example.com',
        name: 'New User',
        role: 'operator'
      });
      (generateToken as jest.Mock).mockReturnValue('new-token');
      mockedDb.createAuthLog = jest.fn().mockResolvedValue({});

      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'new@example.com',
          password: 'StrongPass123!',
          name: 'New User'
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        token: 'new-token',
        user: {
          id: 'new-user-123',
          email: 'new@example.com',
          name: 'New User'
        }
      });
      expect(bcryptjs.hash).toHaveBeenCalledWith('StrongPass123!', 10);
    });

    it('should fail if email already exists', async () => {
      mockedDb.findUserByEmail = jest.fn().mockResolvedValue({
        id: 'existing-user',
        email: 'existing@example.com'
      });

      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'StrongPass123!',
          name: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Email already registered'
      });
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak',
          name: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should handle password reset request', async () => {
      mockedDb.findUserByEmail = jest.fn().mockResolvedValue({
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
      mockedDb.findUserByEmail = jest.fn().mockResolvedValue(null);

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

  describe('POST /auth/logout', () => {
    it('should logout authenticated user', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      (authenticate as jest.Mock).mockImplementation((req, res, next) => {
        req.user = mockUser;
        next();
      });
      mockedDb.createAuthLog = jest.fn().mockResolvedValue({});

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Logged out successfully'
      });
      expect(mockedDb.createAuthLog).toHaveBeenCalledWith({
        action: 'logout',
        user_id: 'user-123',
        ip_address: expect.any(String),
        user_agent: expect.any(String),
        success: true
      });
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user info', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'operator'
      };
      (authenticate as jest.Mock).mockImplementation((req, res, next) => {
        req.user = mockUser;
        next();
      });

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        user: mockUser
      });
    });
  });

  describe('PUT /auth/change-password', () => {
    it('should change password for authenticated user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'oldHashedPassword'
      };
      (authenticate as jest.Mock).mockImplementation((req, res, next) => {
        req.user = { id: 'user-123' };
        next();
      });
      mockedDb.findUserById = jest.fn().mockResolvedValue(mockUser);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(true);
      (bcryptjs.hash as jest.Mock).mockResolvedValue('newHashedPassword');
      mockedDb.updateUserPassword = jest.fn().mockResolvedValue({});
      mockedDb.createAuthLog = jest.fn().mockResolvedValue({});

      const response = await request(app)
        .put('/auth/change-password')
        .set('Authorization', 'Bearer test-token')
        .send({
          currentPassword: 'oldPassword',
          newPassword: 'NewStrongPass123!'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Password changed successfully'
      });
      expect(bcryptjs.compare).toHaveBeenCalledWith('oldPassword', 'oldHashedPassword');
      expect(bcryptjs.hash).toHaveBeenCalledWith('NewStrongPass123!', 10);
      expect(mockedDb.updateUserPassword).toHaveBeenCalledWith('user-123', 'newHashedPassword');
    });

    it('should fail with incorrect current password', async () => {
      const mockUser = {
        id: 'user-123',
        password: 'oldHashedPassword'
      };
      (authenticate as jest.Mock).mockImplementation((req, res, next) => {
        req.user = { id: 'user-123' };
        next();
      });
      mockedDb.findUserById = jest.fn().mockResolvedValue(mockUser);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .put('/auth/change-password')
        .set('Authorization', 'Bearer test-token')
        .send({
          currentPassword: 'wrongPassword',
          newPassword: 'NewStrongPass123!'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Current password is incorrect'
      });
    });
  });
});