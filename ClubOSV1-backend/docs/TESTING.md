# Testing Documentation for ClubOSV1 Backend

## Overview
The ClubOSV1 backend uses Jest for unit and integration testing. Tests are organized into unit tests (testing individual components) and integration tests (testing API endpoints and service interactions).

## Test Structure

```
src/__tests__/
├── setup.ts                    # Global test setup
├── helpers/
│   └── testUtils.ts           # Common test utilities
├── unit/                      # Unit tests
│   ├── middleware/           # Middleware tests
│   │   └── slackSignature.test.ts
│   └── services/             # Service tests
│       └── llmService.test.ts
└── integration/              # Integration tests
    ├── bookings.test.ts      # Booking API tests
    └── llm.test.ts           # LLM API tests
```

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

## Test Environment

Tests use a separate `.env.test` file with test-specific configuration:
- Different port (3002)
- Test database/file paths
- Mock API keys
- Reduced logging

## Writing Tests

### Unit Test Example

```typescript
import { myFunction } from '../../../services/myService';

describe('MyService', () => {
  describe('myFunction', () => {
    it('should return expected result', () => {
      const result = myFunction('input');
      expect(result).toBe('expected output');
    });

    it('should handle errors', () => {
      expect(() => myFunction(null)).toThrow('Invalid input');
    });
  });
});
```

### Integration Test Example

```typescript
import request from 'supertest';
import app from '../../../index';

describe('API Endpoint', () => {
  it('should return 200 OK', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true
    });
  });
});
```

## Test Utilities

The `testUtils.ts` file provides helpful utilities:

- `createMockRequest()` - Create mock Express Request
- `createMockResponse()` - Create mock Express Response
- `generateTestBooking()` - Generate test booking data
- `createTestFileSystem()` - Set up test file system
- `mockEnvironment()` - Mock environment variables
- `expectAsync()` - Assert async functions throw

## Mocking

### Mocking Services

```typescript
jest.mock('../../../services/llmService');

const mockLLMService = new LLMService() as jest.Mocked<LLMService>;
mockLLMService.processRequest.mockResolvedValue({ ... });
```

### Mocking File System

```typescript
const testFS = createTestFileSystem();

beforeAll(() => testFS.setup());
afterAll(() => testFS.cleanup());
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data after tests
3. **Mocking**: Mock external dependencies (APIs, file system)
4. **Descriptive Names**: Use clear test descriptions
5. **Coverage**: Aim for >80% code coverage
6. **Edge Cases**: Test error scenarios and edge cases

## Coverage Goals

- Middleware: 100% coverage
- Services: >90% coverage
- Routes: >80% coverage
- Utilities: >95% coverage

## Debugging Tests

### Run Single Test File
```bash
npm test -- slackSignature.test.ts
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="should validate"
```

### Debug in VS Code
Add breakpoints and use the Jest runner extension or debug configuration.

## CI/CD Integration

Tests are automatically run in CI/CD pipeline:
1. On every pull request
2. Before deployment
3. Coverage reports are generated

## Common Issues

### Test Timeouts
Increase timeout for slow tests:
```typescript
jest.setTimeout(60000); // 60 seconds
```

### Port Conflicts
Ensure test port (3002) is not in use.

### File System Errors
Check permissions for test data directory.

## Future Improvements

- [ ] Add E2E tests with Cypress/Playwright
- [ ] Implement contract testing
- [ ] Add performance benchmarks
- [ ] Create test data factories
- [ ] Add mutation testing
