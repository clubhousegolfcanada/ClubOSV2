# ClubOS Testing Guide

## Overview

This guide covers the testing infrastructure and procedures for both backend and frontend components of ClubOS.

## Current Test Coverage

### Backend
- **Coverage**: Limited (TypeScript configuration issues partially resolved)
- **Test Files**: 
  - Security tests (comprehensive)
  - Unit tests (role guard, LLM service)
  - Integration tests (bookings, LLM)
- **Status**: Tests exist but some fail due to module imports and API changes

### Frontend
- **Coverage**: 0.32% (just started)
- **Test Files**:
  - Component tests (Button, Input)
  - State management tests (useStore)
- **Status**: Basic infrastructure set up, component tests passing

## Running Tests

### Backend Tests
```bash
cd ClubOSV1-backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit
npm run test:integration

# Run security tests
npm test -- security.test.ts
```

### Frontend Tests
```bash
cd ClubOSV1-frontend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

## Testing Infrastructure

### Backend Setup
- **Framework**: Jest with ts-jest
- **Config**: `jest.config.json` and `tsconfig.test.json`
- **Test Environment**: `.env.test` for isolated testing
- **Key Features**:
  - Separate TypeScript config for tests
  - Mock implementations for external services
  - Security test utilities for vulnerability testing

### Frontend Setup
- **Framework**: Jest with Next.js configuration
- **Testing Library**: React Testing Library
- **Config**: `jest.config.js` and `jest.setup.js`
- **Key Features**:
  - Next.js router mocking
  - Component testing utilities
  - State management testing

## Writing Tests

### Backend Test Example
```typescript
import { describe, it, expect } from '@jest/globals';
import { authenticate } from '../middleware/auth';

describe('Authentication Middleware', () => {
  it('should reject requests without token', async () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
```

### Frontend Test Example
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '@/components/Button';

describe('Button Component', () => {
  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## Security Testing

The backend includes comprehensive security tests covering:
- SQL Injection prevention
- XSS (Cross-Site Scripting) prevention
- CSRF (Cross-Site Request Forgery) protection
- Authentication security (no user enumeration)
- Rate limiting verification
- Input validation
- Path traversal prevention
- Command injection prevention

Run security tests specifically:
```bash
cd ClubOSV1-backend
npm test -- security.test.ts
```

## Known Issues & Solutions

### Backend Issues
1. **Module Import Errors**: Some tests fail due to changed file paths
   - Solution: Update import paths in test files
   
2. **API Changes**: Route names have changed (e.g., 'booking' → 'Booking & Access')
   - Solution: Update test expectations to match current API

3. **TypeScript Errors**: Jest globals not recognized
   - Solution: Import from `@jest/globals`

### Frontend Issues
1. **Router Mock**: Dynamic imports of next/router cause issues
   - Solution: Mock added to `jest.setup.js`

2. **Store Tests**: Zustand store initialization conflicts
   - Solution: Clear store state between tests

## Improving Test Coverage

### Priority Areas for Testing

#### Backend (Target: 80%)
1. **Controllers**: Test all API endpoints
2. **Services**: Test business logic thoroughly
3. **Middleware**: Test auth, rate limiting, validation
4. **Database**: Test migrations and queries
5. **Utils**: Test encryption, validation helpers

#### Frontend (Target: 80%)
1. **Pages**: Test page components and routing
2. **Components**: Test all UI components
3. **Hooks**: Test custom React hooks
4. **State**: Test Zustand stores completely
5. **Utils**: Test helper functions

### Testing Best Practices
1. **Write tests alongside new features**
2. **Test edge cases and error scenarios**
3. **Mock external dependencies**
4. **Keep tests isolated and fast**
5. **Use descriptive test names**
6. **Test user interactions, not implementation**

## CI/CD Integration

To add tests to your deployment pipeline:

```yaml
# Example GitHub Actions workflow
name: Test and Deploy
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Backend Tests
        run: |
          cd ClubOSV1-backend
          npm ci
          npm test
          
      - name: Frontend Tests
        run: |
          cd ClubOSV1-frontend
          npm ci
          npm test
```

## Next Steps

1. **Fix failing backend tests** - Update imports and expectations
2. **Increase frontend coverage** - Add tests for pages and complex components
3. **Add E2E tests** - Consider Cypress or Playwright
4. **Set up CI/CD** - Automate testing on commits
5. **Coverage requirements** - Enforce minimum coverage thresholds

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Next.js Applications](https://nextjs.org/docs/testing)
- [Security Testing Best Practices](https://owasp.org/www-project-web-security-testing-guide/)