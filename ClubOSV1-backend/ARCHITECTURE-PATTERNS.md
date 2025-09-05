# ClubOS Architecture Patterns Documentation

## Overview
This document describes the new architectural patterns introduced in v1.16.0 for transforming ClubOS from a routes-based architecture to a properly layered system.

## Architecture Layers

```
Request → Middleware → Controller → Service → Repository → Database
             ↓            ↓           ↓          ↓
          Validation   HTTP Logic  Business   Data Access
                                    Logic
```

## Core Utilities

### 1. AsyncHandler
**Location:** `/src/utils/asyncHandler.ts`

Wraps async route handlers to automatically catch errors without try-catch blocks.

```typescript
// Without asyncHandler (old way)
router.get('/users', async (req, res, next) => {
  try {
    const users = await getUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// With asyncHandler (new way)
router.get('/users', asyncHandler(async (req, res) => {
  const users = await getUsers();
  res.json(users);
}));
```

### 2. ApiResponse
**Location:** `/src/utils/ApiResponse.ts`

Standardizes all API responses across the application.

```typescript
// Old way (inconsistent)
res.status(200).json({ users, count: users.length });
res.status(400).json({ error: 'Bad request' });
res.status(500).send('Server error');

// New way (consistent)
ApiResponse.success(res, users, 'Users retrieved');
ApiResponse.badRequest(res, 'Invalid parameters');
ApiResponse.serverError(res, error);

// Paginated responses
ApiResponse.paginated(res, users, page, limit, totalCount);
```

### 3. BaseController
**Location:** `/src/utils/BaseController.ts`

Base class providing common functionality for all controllers.

```typescript
export class UserController extends BaseController {
  // Automatic async error handling
  getUsers = this.handle(async (req: Request, res: Response) => {
    const { page, limit } = this.getPagination(req);
    const users = await this.userService.getUsers(limit, page);
    
    // Standardized responses
    return this.ok(res, users);
  });

  createUser = this.handle(async (req: Request, res: Response) => {
    // Built-in validation helper
    const missing = this.validateRequired(req.body, ['email', 'name']);
    if (missing.length > 0) {
      return this.badRequest(res, `Missing fields: ${missing.join(', ')}`);
    }
    
    const user = await this.userService.create(req.body);
    return this.created(res, user);
  });
}
```

#### Available Methods:
- Response helpers: `ok()`, `created()`, `noContent()`, `badRequest()`, `unauthorized()`, `forbidden()`, `notFound()`, `conflict()`, `validationError()`, `serverError()`, `paginated()`
- Request helpers: `getPagination()`, `getSorting()`, `getFilters()`, `validateRequired()`, `getUser()`, `hasRole()`
- Audit: `logActivity()`

### 4. BaseRepository
**Location:** `/src/repositories/BaseRepository.ts`

Base class providing common database operations for all repositories.

```typescript
export class UserRepository extends BaseRepository {
  constructor() {
    super('users'); // table name
  }

  // Inherited methods available:
  // findById(id)
  // findAll(limit, offset)
  // findWhere(conditions)
  // findOneWhere(conditions)
  // create(data)
  // update(id, data)
  // updateWhere(conditions, data)
  // delete(id)
  // deleteWhere(conditions)
  // count(conditions)
  // exists(conditions)
  // bulkCreate(records)
  // raw(query, params)

  // Custom methods for specific needs
  async findByEmail(email: string) {
    return this.findOneWhere({ email });
  }

  async findActiveUsers() {
    return this.raw(
      'SELECT * FROM users WHERE is_active = true ORDER BY created_at DESC',
      []
    );
  }
}
```

#### Transaction Support:
```typescript
const client = await repository.beginTransaction();
try {
  await repository.queryInTransaction(client, 'INSERT INTO ...', [params]);
  await repository.queryInTransaction(client, 'UPDATE ...', [params]);
  await repository.commitTransaction(client);
} catch (error) {
  await repository.rollbackTransaction(client);
  throw error;
}
```

## Implementation Pattern

### Step 1: Create Repository
```typescript
// src/repositories/UserRepository.ts
import { BaseRepository } from './BaseRepository';

export class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  // Add custom methods as needed
  async findActiveUsers(limit = 100) {
    return this.findWhere({ is_active: true });
  }
}
```

### Step 2: Create/Update Service
```typescript
// src/services/UserService.ts
import { UserRepository } from '../repositories/UserRepository';

export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async getUsers(limit: number, offset: number) {
    return this.userRepository.findAll(limit, offset);
  }

  async createUser(data: any) {
    // Business logic here
    data.created_at = new Date();
    return this.userRepository.create(data);
  }
}
```

### Step 3: Create Controller
```typescript
// src/controllers/UserController.ts
import { Request, Response } from 'express';
import { BaseController } from '../utils/BaseController';
import { UserService } from '../services/UserService';

export class UserController extends BaseController {
  private userService: UserService;

  constructor() {
    super();
    this.userService = new UserService();
  }

  listUsers = this.handle(async (req: Request, res: Response) => {
    const { page, limit, offset } = this.getPagination(req);
    const users = await this.userService.getUsers(limit, offset);
    const total = await this.userService.countUsers();
    
    return this.paginated(res, users, page, limit, total);
  });

  createUser = this.handle(async (req: Request, res: Response) => {
    const user = await this.userService.createUser(req.body);
    return this.created(res, user, 'User created successfully');
  });
}
```

### Step 4: Simplify Route File
```typescript
// src/routes/users.ts
import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate } from '../middleware/auth';

const router = Router();
const userController = new UserController();

// Clean routing - no business logic
router.get('/users', authenticate, userController.listUsers);
router.post('/users', authenticate, userController.createUser);

export default router;
```

## Migration Strategy

### For Existing Routes
1. **Identify business logic** in route handler
2. **Move data access** to Repository
3. **Move business logic** to Service
4. **Create Controller** with HTTP handling
5. **Update route file** to just routing
6. **Test thoroughly** before removing old code

### Example Migration
```typescript
// BEFORE (routes/users.ts) - 200+ lines
router.get('/users', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const result = await pool.query(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    
    res.json({
      users: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AFTER (routes/users.ts) - 5 lines
router.get('/users', authenticate, userController.listUsers);
```

## Best Practices

### 1. Keep Controllers Thin
Controllers should only handle HTTP concerns:
- Parse request parameters
- Call service methods
- Format responses

### 2. Business Logic in Services
Services contain all business logic:
- Validation rules
- Data transformation
- Complex operations
- External API calls

### 3. Repositories for Data Only
Repositories only handle data access:
- Database queries
- No business logic
- Return raw data

### 4. Consistent Error Handling
- Use `asyncHandler` for all async routes
- Let errors bubble up to error middleware
- Use appropriate HTTP status codes

### 5. Standardized Responses
Always use ApiResponse methods:
- Consistent structure
- Proper status codes
- Include timestamps
- Clear success/error states

## Testing Pattern

```typescript
// __tests__/controllers/UserController.test.ts
describe('UserController', () => {
  let controller: UserController;
  let mockService: jest.Mocked<UserService>;

  beforeEach(() => {
    mockService = createMockService();
    controller = new UserController(mockService);
  });

  test('listUsers returns paginated results', async () => {
    const req = mockRequest({ query: { page: 1, limit: 10 }});
    const res = mockResponse();
    
    mockService.getUsers.mockResolvedValue(users);
    mockService.countUsers.mockResolvedValue(100);
    
    await controller.listUsers(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: users,
        pagination: expect.any(Object)
      })
    );
  });
});
```

## Common Patterns

### Pagination
```typescript
const { page, limit, offset } = this.getPagination(req);
const items = await repository.findAll(limit, offset);
const total = await repository.count();
return this.paginated(res, items, page, limit, total);
```

### Filtering
```typescript
const filters = this.getFilters(req, ['status', 'category', 'location']);
const items = await repository.findWhere(filters);
```

### Sorting
```typescript
const { sortBy, sortOrder } = this.getSorting(req, ['name', 'created_at']);
const items = await repository.raw(
  `SELECT * FROM items ORDER BY ${sortBy} ${sortOrder}`,
  []
);
```

### Validation
```typescript
const missing = this.validateRequired(req.body, ['email', 'name', 'role']);
if (missing.length > 0) {
  return this.validationError(res, 'Missing required fields', { missing });
}
```

## Migration Checklist

For each module being migrated:

- [ ] Create Repository extending BaseRepository
- [ ] Move SQL queries to Repository methods
- [ ] Create/Update Service with business logic
- [ ] Create Controller extending BaseController
- [ ] Update route file to routing only
- [ ] Add input validation
- [ ] Implement proper error handling
- [ ] Write unit tests
- [ ] Test API endpoints
- [ ] Update API documentation
- [ ] Remove old code

## Benefits

1. **Separation of Concerns**: Each layer has a single responsibility
2. **Testability**: Easy to unit test each layer independently
3. **Reusability**: Services and repositories can be reused
4. **Maintainability**: Changes isolated to specific layers
5. **Consistency**: Standardized patterns across codebase
6. **Error Handling**: Centralized and consistent
7. **Code Reduction**: ~70% less code duplication

## Next Steps

1. Complete Phase 2: Migrate Auth module as pilot
2. Phase 3: Migrate simple modules (Users, Profile, Health, Feedback)
3. Phase 4: Migrate medium complexity modules
4. Phase 5: Migrate complex modules
5. Phase 6: Testing, documentation, and cleanup

---

*This document will be updated as patterns evolve and new best practices are discovered.*