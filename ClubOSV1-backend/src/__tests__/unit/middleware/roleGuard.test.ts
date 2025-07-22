import { Request, Response, NextFunction } from 'express';
import { roleGuard, adminOnly, adminOrOperator, anyAuthenticated, hasRole, hasAnyRole, hasMinimumRole } from '../../../middleware/roleGuard';
import { UserRole } from '../../../types';
import { createMockRequest, createMockResponse, createMockNext } from '../../helpers/testUtils';

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Role Guard Middleware', () => {
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    jest.clearAllMocks();
  });

  describe('roleGuard', () => {
    it('should return 401 if user is not authenticated', async () => {
      const middleware = roleGuard(['admin']);
      
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if user role is not defined', async () => {
      mockReq.user = { id: '123', email: 'test@test.com', role: undefined as any, sessionId: 'session123' };
      const middleware = roleGuard(['admin']);
      
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'User role not defined'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if user does not have required role', async () => {
      mockReq.user = { id: '123', email: 'test@test.com', role: 'support', sessionId: 'session123' };
      const middleware = roleGuard(['admin', 'operator']);
      
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Access restricted to: admin, operator',
        requiredRoles: ['admin', 'operator'],
        userRole: 'support'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow access if user has required role', async () => {
      mockReq.user = { id: '123', email: 'test@test.com', role: 'admin', sessionId: 'session123' };
      const middleware = roleGuard(['admin', 'operator']);
      
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should handle multiple allowed roles correctly', async () => {
      const middleware = roleGuard(['admin', 'operator', 'support']);
      
      // Test with operator
      mockReq.user = { id: '123', email: 'test@test.com', role: 'operator', sessionId: 'session123' };
      await middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      
      // Reset mocks
      jest.clearAllMocks();
      
      // Test with support
      mockReq.user = { id: '123', email: 'test@test.com', role: 'support', sessionId: 'session123' };
      await middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Shorthand middleware', () => {
    it('adminOnly should only allow admin role', async () => {
      // Test with admin
      mockReq.user = { id: '123', email: 'test@test.com', role: 'admin', sessionId: 'session123' };
      await adminOnly(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      
      // Reset and test with operator
      jest.clearAllMocks();
      mockReq.user = { id: '123', email: 'test@test.com', role: 'operator', sessionId: 'session123' };
      await adminOnly(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('adminOrOperator should allow admin and operator roles', async () => {
      // Test with admin
      mockReq.user = { id: '123', email: 'test@test.com', role: 'admin', sessionId: 'session123' };
      await adminOrOperator(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      
      // Reset and test with operator
      jest.clearAllMocks();
      mockReq.user = { id: '123', email: 'test@test.com', role: 'operator', sessionId: 'session123' };
      await adminOrOperator(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      
      // Reset and test with support
      jest.clearAllMocks();
      mockReq.user = { id: '123', email: 'test@test.com', role: 'support', sessionId: 'session123' };
      await adminOrOperator(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('anyAuthenticated should allow all roles', async () => {
      const roles: UserRole[] = ['admin', 'operator', 'support'];
      
      for (const role of roles) {
        jest.clearAllMocks();
        mockReq.user = { id: '123', email: 'test@test.com', role, sessionId: 'session123' };
        await anyAuthenticated(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
      }
    });
  });

  describe('Helper functions', () => {
    describe('hasRole', () => {
      it('should return true if user has the specific role', () => {
        const user = { id: '123', email: 'test@test.com', role: 'admin' as UserRole, sessionId: 'session123' };
        expect(hasRole(user, 'admin')).toBe(true);
        expect(hasRole(user, 'operator')).toBe(false);
      });

      it('should return false if user is undefined', () => {
        expect(hasRole(undefined, 'admin')).toBe(false);
      });
    });

    describe('hasAnyRole', () => {
      it('should return true if user has any of the specified roles', () => {
        const user = { id: '123', email: 'test@test.com', role: 'operator' as UserRole, sessionId: 'session123' };
        expect(hasAnyRole(user, ['admin', 'operator'])).toBe(true);
        expect(hasAnyRole(user, ['admin', 'support'])).toBe(false);
      });

      it('should return false if user is undefined', () => {
        expect(hasAnyRole(undefined, ['admin', 'operator'])).toBe(false);
      });
    });

    describe('hasMinimumRole', () => {
      it('should check role hierarchy correctly', () => {
        const adminUser = { id: '123', email: 'test@test.com', role: 'admin' as UserRole, sessionId: 'session123' };
        const operatorUser = { id: '123', email: 'test@test.com', role: 'operator' as UserRole, sessionId: 'session123' };
        const supportUser = { id: '123', email: 'test@test.com', role: 'support' as UserRole, sessionId: 'session123' };

        // Admin can access everything
        expect(hasMinimumRole(adminUser, 'admin')).toBe(true);
        expect(hasMinimumRole(adminUser, 'operator')).toBe(true);
        expect(hasMinimumRole(adminUser, 'support')).toBe(true);

        // Operator can access operator and below
        expect(hasMinimumRole(operatorUser, 'admin')).toBe(false);
        expect(hasMinimumRole(operatorUser, 'operator')).toBe(true);
        expect(hasMinimumRole(operatorUser, 'support')).toBe(true);

        // Support can only access support level
        expect(hasMinimumRole(supportUser, 'admin')).toBe(false);
        expect(hasMinimumRole(supportUser, 'operator')).toBe(false);
        expect(hasMinimumRole(supportUser, 'support')).toBe(true);
      });

      it('should return false if user is undefined', () => {
        expect(hasMinimumRole(undefined, 'support')).toBe(false);
      });
    });
  });
});
