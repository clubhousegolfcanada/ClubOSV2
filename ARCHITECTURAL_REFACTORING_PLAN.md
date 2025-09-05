# ClubOS V1 Architectural Refactoring Plan
*Created: September 5, 2025*

## 🎯 Objective
Transform the current "routes-do-everything" architecture into a properly layered, maintainable system without breaking existing functionality.

## 📊 Current State Assessment

### Problems to Solve
1. **No Controllers** - 90+ route files mixing HTTP handling with business logic
2. **No Repository Layer** - 372 direct SQL queries scattered across routes
3. **Inconsistent Services** - 60+ services exist but inconsistently used
4. **No Response Standards** - 496+ manual `res.json()` calls
5. **Poor Error Handling** - Mix of patterns across 85 files
6. **Code Duplication** - Business logic repeated across routes

### Current Architecture
```
Request → Route (Everything) → Database
            ↓
         Response
```

### Target Architecture
```
Request → Middleware → Controller → Service → Repository → Database
             ↓            ↓           ↓          ↓
          Validation   HTTP Logic  Business   Data Access
                                    Logic
```

---

## 🚀 Phase 1: Foundation Layer (Week 1)
**Goal:** Create base utilities and wrappers without changing routes

### 1.1 Create Core Wrappers

#### File: `/ClubOSV1-backend/src/utils/asyncHandler.ts`
```typescript
/**
 * Wraps async route handlers to automatically catch errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Usage example:
// router.get('/users', asyncHandler(async (req, res) => { ... }));
```

#### File: `/ClubOSV1-backend/src/utils/ApiResponse.ts`
```typescript
export class ApiResponse {
  static success(res: Response, data: any, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  static error(res: Response, message: string, statusCode = 500, error?: any) {
    return res.status(statusCode).json({
      success: false,
      message,
      error: error?.message || error,
      timestamp: new Date().toISOString()
    });
  }

  static paginated(res: Response, data: any[], page: number, limit: number, total: number) {
    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      },
      timestamp: new Date().toISOString()
    });
  }
}
```

#### File: `/ClubOSV1-backend/src/utils/BaseController.ts`
```typescript
import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from './ApiResponse';
import { asyncHandler } from './asyncHandler';

export abstract class BaseController {
  /**
   * Wraps controller methods with async handler
   */
  protected handle = asyncHandler;

  /**
   * Standard response helpers
   */
  protected ok(res: Response, data: any, message?: string) {
    return ApiResponse.success(res, data, message);
  }

  protected created(res: Response, data: any, message = 'Created successfully') {
    return ApiResponse.success(res, data, message, 201);
  }

  protected badRequest(res: Response, message: string) {
    return ApiResponse.error(res, message, 400);
  }

  protected unauthorized(res: Response, message = 'Unauthorized') {
    return ApiResponse.error(res, message, 401);
  }

  protected forbidden(res: Response, message = 'Forbidden') {
    return ApiResponse.error(res, message, 403);
  }

  protected notFound(res: Response, message = 'Resource not found') {
    return ApiResponse.error(res, message, 404);
  }

  protected conflict(res: Response, message: string) {
    return ApiResponse.error(res, message, 409);
  }

  protected serverError(res: Response, error: any) {
    return ApiResponse.error(res, 'Internal server error', 500, error);
  }
}
```

### 1.2 Create Base Repository

#### File: `/ClubOSV1-backend/src/repositories/BaseRepository.ts`
```typescript
import { db } from '../config/database';
import { logger } from '../utils/logger';

export abstract class BaseRepository {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Find a single record by ID
   */
  async findById(id: string | number): Promise<any> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Find all records
   */
  async findAll(limit = 100, offset = 0): Promise<any[]> {
    const query = `SELECT * FROM ${this.tableName} ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
    const result = await db.query(query, [limit, offset]);
    return result.rows;
  }

  /**
   * Find records by condition
   */
  async findWhere(conditions: Record<string, any>): Promise<any[]> {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
    
    const query = `SELECT * FROM ${this.tableName} WHERE ${whereClause}`;
    const result = await db.query(query, values);
    return result.rows;
  }

  /**
   * Create a new record
   */
  async create(data: Record<string, any>): Promise<any> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const columns = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${this.tableName} (${columns})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Update a record
   */
  async update(id: string | number, data: Record<string, any>): Promise<any> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    
    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${keys.length + 1}
      RETURNING *
    `;
    
    const result = await db.query(query, [...values, id]);
    return result.rows[0];
  }

  /**
   * Delete a record
   */
  async delete(id: string | number): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
    const result = await db.query(query, [id]);
    return result.rowCount > 0;
  }

  /**
   * Execute raw query
   */
  async raw(query: string, params: any[] = []): Promise<any> {
    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Count records
   */
  async count(conditions?: Record<string, any>): Promise<number> {
    let query = `SELECT COUNT(*) FROM ${this.tableName}`;
    let params = [];
    
    if (conditions) {
      const keys = Object.keys(conditions);
      const values = Object.values(conditions);
      const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
      query += ` WHERE ${whereClause}`;
      params = values;
    }
    
    const result = await db.query(query, params);
    return parseInt(result.rows[0].count);
  }
}
```

### 1.3 Implementation Checklist - Phase 1
- [ ] Create `/utils/asyncHandler.ts`
- [ ] Create `/utils/ApiResponse.ts`
- [ ] Create `/utils/BaseController.ts`
- [ ] Create `/repositories/BaseRepository.ts`
- [ ] Test utilities with a single route
- [ ] Document usage patterns

---

## 🔧 Phase 2: Pilot Module Refactor (Week 2)
**Goal:** Refactor ONE module completely as a template

### 2.1 Choose Pilot Module: Authentication

**Why Auth?**
- Self-contained functionality
- Critical but well-understood
- Currently 800+ lines in one file
- Good test case for patterns

### 2.2 Create Auth Module Structure

```
/ClubOSV1-backend/src/
├── controllers/
│   └── AuthController.ts
├── services/
│   └── AuthService.ts (enhance existing)
├── repositories/
│   └── UserRepository.ts
├── routes/
│   └── auth.ts (simplified)
└── validators/
    └── authValidators.ts
```

#### File: `/ClubOSV1-backend/src/controllers/AuthController.ts`
```typescript
import { Request, Response } from 'express';
import { BaseController } from '../utils/BaseController';
import { AuthService } from '../services/AuthService';
import { logger } from '../utils/logger';

export class AuthController extends BaseController {
  private authService: AuthService;

  constructor() {
    super();
    this.authService = new AuthService();
  }

  /**
   * POST /api/auth/login
   */
  login = this.handle(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    
    const result = await this.authService.login(email, password);
    
    if (!result.success) {
      return this.unauthorized(res, result.message);
    }
    
    return this.ok(res, result.data, 'Login successful');
  });

  /**
   * POST /api/auth/signup
   */
  signup = this.handle(async (req: Request, res: Response) => {
    const result = await this.authService.signup(req.body);
    
    if (!result.success) {
      return this.badRequest(res, result.message);
    }
    
    return this.created(res, result.data, 'Account created successfully');
  });

  /**
   * POST /api/auth/logout
   */
  logout = this.handle(async (req: Request, res: Response) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    await this.authService.logout(token, req.user?.id);
    
    return this.ok(res, null, 'Logged out successfully');
  });

  /**
   * GET /api/auth/me
   */
  getCurrentUser = this.handle(async (req: Request, res: Response) => {
    const user = await this.authService.getUserById(req.user.id);
    
    if (!user) {
      return this.notFound(res, 'User not found');
    }
    
    return this.ok(res, user);
  });
}
```

#### File: `/ClubOSV1-backend/src/repositories/UserRepository.ts`
```typescript
import { BaseRepository } from './BaseRepository';
import { User } from '../types/models';

export class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT id, email, username, role, first_name, last_name, 
             phone_number, created_at, updated_at, last_login
      FROM users 
      WHERE email = $1
    `;
    const result = await this.raw(query, [email]);
    return result[0] || null;
  }

  /**
   * Find user with password (for auth only)
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    const query = `SELECT * FROM users WHERE email = $1`;
    const result = await this.raw(query, [email]);
    return result[0] || null;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    const query = `UPDATE users SET last_login = NOW() WHERE id = $1`;
    await this.raw(query, [userId]);
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const count = await this.count({ email });
    return count > 0;
  }

  /**
   * Create new user
   */
  async createUser(userData: Partial<User>): Promise<User> {
    return this.create({
      ...userData,
      created_at: new Date(),
      updated_at: new Date()
    });
  }
}
```

#### File: `/ClubOSV1-backend/src/services/AuthService.ts` (enhanced)
```typescript
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/UserRepository';
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';

export class AuthService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * Authenticate user login
   */
  async login(email: string, password: string) {
    try {
      // Get user with password
      const user = await this.userRepository.findByEmailWithPassword(email);
      
      if (!user) {
        return {
          success: false,
          message: 'Invalid credentials'
        };
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return {
          success: false,
          message: 'Invalid credentials'
        };
      }

      // Update last login
      await this.userRepository.updateLastLogin(user.id);

      // Generate token
      const token = this.generateToken(user);

      // Remove password from response
      delete user.password;

      return {
        success: true,
        data: {
          user,
          token
        }
      };
    } catch (error) {
      logger.error('Login error', error);
      throw error;
    }
  }

  /**
   * Register new user
   */
  async signup(userData: any) {
    try {
      // Check if email exists
      const emailExists = await this.userRepository.emailExists(userData.email);
      
      if (emailExists) {
        return {
          success: false,
          message: 'Email already registered'
        };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 12);

      // Create user
      const user = await this.userRepository.createUser({
        ...userData,
        password: hashedPassword
      });

      // Generate token
      const token = this.generateToken(user);

      // Remove password from response
      delete user.password;

      return {
        success: true,
        data: {
          user,
          token
        }
      };
    } catch (error) {
      logger.error('Signup error', error);
      throw error;
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(user: any): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: '7d'
      }
    );
  }

  /**
   * Logout user (blacklist token)
   */
  async logout(token: string, userId: string): Promise<void> {
    // Add token to blacklist
    await this.blacklistToken(token, userId);
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string) {
    const user = await this.userRepository.findById(id);
    if (user) {
      delete user.password;
    }
    return user;
  }

  /**
   * Blacklist a token
   */
  private async blacklistToken(token: string, userId: string): Promise<void> {
    const query = `
      INSERT INTO blacklisted_tokens (token, user_id, blacklisted_at)
      VALUES ($1, $2, NOW())
    `;
    await this.userRepository.raw(query, [token, userId]);
  }
}
```

#### File: `/ClubOSV1-backend/src/routes/auth.ts` (simplified)
```typescript
import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authenticate } from '../middleware/auth';
import { validateLogin, validateSignup } from '../validators/authValidators';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/login', authRateLimiter, validateLogin, authController.login);
router.post('/signup', authRateLimiter, validateSignup, authController.signup);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getCurrentUser);

export default router;
```

### 2.3 Testing the Refactored Module

#### File: `/ClubOSV1-backend/src/__tests__/auth.test.ts`
```typescript
import request from 'supertest';
import app from '../app';
import { AuthService } from '../services/AuthService';
import { UserRepository } from '../repositories/UserRepository';

describe('Auth Module', () => {
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
```

### 2.4 Implementation Checklist - Phase 2
- [ ] Create AuthController
- [ ] Create UserRepository
- [ ] Enhance AuthService
- [ ] Simplify auth.ts route file
- [ ] Create auth validators
- [ ] Write tests for auth module
- [ ] Document the new pattern

---

## 📦 Phase 3: Module-by-Module Migration (Weeks 3-4)
**Goal:** Apply the pattern to all modules systematically

### 3.1 Priority Order

Based on complexity and dependencies:

1. **Week 3 - Simple Modules**
   - [ ] Users module (5 routes)
   - [ ] Profile module (3 routes)
   - [ ] Health/Status module (2 routes)
   - [ ] Feedback module (4 routes)

2. **Week 4 - Medium Complexity**
   - [ ] Messages module (8 routes)
   - [ ] Tickets module (6 routes)
   - [ ] Checklists module (7 routes)
   - [ ] Analytics module (5 routes)

3. **Week 5 - Complex Modules**
   - [ ] Operations module (12 routes)
   - [ ] Knowledge module (10 routes)
   - [ ] Challenges module (15 routes)
   - [ ] OpenPhone module (9 routes)

4. **Week 6 - Most Complex**
   - [ ] Patterns module (20+ routes)
   - [ ] LLM module (8 routes)
   - [ ] Admin module (15 routes)

### 3.2 Migration Template for Each Module

```bash
# For each module:
1. Create Controller extending BaseController
2. Create Repository extending BaseRepository
3. Create/Update Service with business logic
4. Move validation to validators/
5. Simplify route file to just routing
6. Write tests
7. Update documentation
```

### 3.3 Tracking Progress

#### Create Migration Tracker
```typescript
// File: /ClubOSV1-backend/MIGRATION_STATUS.md
| Module | Routes | Controller | Repository | Service | Tests | Status |
|--------|--------|------------|------------|---------|-------|--------|
| Auth   | 4      | ✅         | ✅         | ✅      | ✅    | Complete |
| Users  | 5      | ⏳         | ⏳         | ⏳      | ⏳    | In Progress |
| Profile| 3      | ❌         | ❌         | ❌      | ❌    | Pending |
```

---

## 🧪 Phase 4: Testing & Documentation (Week 5)
**Goal:** Ensure quality and maintainability

### 4.1 Testing Strategy

#### Unit Tests for Each Layer
```typescript
// repositories/__tests__/UserRepository.test.ts
describe('UserRepository', () => {
  it('should find user by email', async () => {
    const user = await userRepository.findByEmail('test@example.com');
    expect(user).toBeDefined();
  });
});

// services/__tests__/AuthService.test.ts
describe('AuthService', () => {
  it('should hash password on signup', async () => {
    const result = await authService.signup(userData);
    expect(bcrypt.hash).toHaveBeenCalled();
  });
});

// controllers/__tests__/AuthController.test.ts
describe('AuthController', () => {
  it('should return 401 for invalid login', async () => {
    const response = await authController.login(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
```

### 4.2 Documentation Updates

#### API Documentation Template
```typescript
/**
 * @api {post} /api/auth/login User Login
 * @apiVersion 2.0.0
 * @apiName LoginUser
 * @apiGroup Authentication
 * 
 * @apiBody {String} email User's email address
 * @apiBody {String} password User's password
 * 
 * @apiSuccess {Boolean} success Request status
 * @apiSuccess {Object} data Response data
 * @apiSuccess {String} data.token JWT token
 * @apiSuccess {Object} data.user User information
 * 
 * @apiError {Boolean} success Always false
 * @apiError {String} message Error message
 */
```

---

## 🚦 Phase 5: Optimization & Cleanup (Week 6)
**Goal:** Remove old code and optimize

### 5.1 Cleanup Checklist
- [ ] Remove old route logic (now in controllers)
- [ ] Remove duplicate SQL queries (now in repositories)
- [ ] Consolidate error handling
- [ ] Remove manual response formatting
- [ ] Update all imports
- [ ] Remove unused dependencies

### 5.2 Performance Optimization
- [ ] Implement query caching in repositories
- [ ] Add database connection pooling
- [ ] Optimize frequently used queries
- [ ] Add indexes where needed

---

## 📈 Success Metrics

### Before Refactoring
- Route files: 100-800 lines
- SQL queries: Scattered (372 instances)
- Response formats: Inconsistent
- Test coverage: ~20%
- Code duplication: High

### After Refactoring
- Route files: <50 lines (routing only)
- SQL queries: Centralized in repositories
- Response formats: Standardized
- Test coverage: >70%
- Code duplication: Minimal

---

## ⚠️ Risk Mitigation

### Risks and Mitigations
1. **Breaking existing functionality**
   - Mitigation: Test each module thoroughly before moving on
   - Keep old code until new code is verified

2. **API contract changes**
   - Mitigation: Keep response format identical
   - Use ApiResponse wrapper to match existing format

3. **Performance degradation**
   - Mitigation: Profile before and after
   - Optimize queries in repository layer

4. **Team confusion**
   - Mitigation: Document patterns clearly
   - Provide examples and templates

---

## 🎯 Final Checklist

### Phase Completion Criteria
- [ ] Phase 1: All base classes created and tested
- [ ] Phase 2: Auth module fully refactored and tested
- [ ] Phase 3: All modules migrated to new architecture
- [ ] Phase 4: >70% test coverage achieved
- [ ] Phase 5: Old code removed, performance verified

### Definition of Done
- All routes < 50 lines
- All business logic in services
- All data access in repositories
- All responses use ApiResponse
- All async handlers use asyncHandler
- Test coverage > 70%
- Documentation updated
- Team trained on new patterns

---

## 🚀 Quick Start Commands

```bash
# Create new module structure
npm run generate:module [module-name]

# Run migration status check
npm run migration:status

# Test specific module
npm test -- --testPathPattern=auth

# Validate architecture
npm run architecture:validate
```

---

## 📚 Resources

- [Repository Pattern](https://docs.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/infrastructure-persistence-layer-design)
- [Controller Pattern](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93controller)
- [Service Layer Pattern](https://martinfowler.com/eaaCatalog/serviceLayer.html)
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)

---

*This plan transforms ClubOS from a monolithic route-based architecture to a properly layered, testable, and maintainable system. The incremental approach ensures the application remains functional throughout the refactoring process.*