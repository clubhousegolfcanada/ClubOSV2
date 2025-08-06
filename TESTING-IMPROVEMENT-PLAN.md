# Testing Improvement Plan for ClubOS

## Current State (August 2025)

### Test Coverage Status
- **Test Files**: 13 test files exist
- **Test Results**: 49 failing, 33 passing (40% pass rate)
- **Test Suites**: 11 failing, 2 passing
- **Major Issues**:
  - Tests are outdated after recent refactoring
  - No coverage reporting working
  - Tests leak resources (open handles)
  - Many tests fail due to API changes

### Critical Areas Lacking Tests
1. **OpenPhone Integration** - Zero tests for webhook processing
2. **Messages/Conversations API** - No tests for the critical endpoints
3. **AI Automation Service** - No tests for automation logic
4. **HubSpot Integration** - No tests for contact sync
5. **Push Notifications** - No tests for notification service

## Phase 1: Fix Existing Tests (Week 1)

### Priority 1: Fix Test Infrastructure
- [ ] Fix test database setup and teardown
- [ ] Resolve open handle issues (add proper cleanup)
- [ ] Update jest configuration for coverage reporting
- [ ] Add test environment variables (.env.test)

### Priority 2: Update Broken Tests
- [ ] Fix auth route tests (update for new API structure)
- [ ] Update user management tests
- [ ] Fix request handling tests
- [ ] Update database helper tests

## Phase 2: Add Critical Tests (Week 2)

### OpenPhone Integration Tests
```typescript
// Tests needed:
- Webhook signature verification
- Data extraction from v2 and v3 formats
- Phone number extraction logic
- Message grouping by time
- Conversation creation and updates
- HubSpot contact enrichment
```

### Messages API Tests
```typescript
// Tests needed:
- GET /conversations (list with pagination)
- GET /conversations/:phoneNumber
- GET /conversations/:phoneNumber/full-history
- Message suggestion generation
- Unread count tracking
```

### AI Automation Tests
```typescript
// Tests needed:
- Assistant type detection
- Message processing logic
- Automation response generation
- Knowledge base queries
- Missed automation tracking
```

## Phase 3: Integration Tests (Week 3)

### End-to-End Scenarios
1. **Complete Message Flow**
   - Receive webhook from OpenPhone
   - Process and store conversation
   - Enrich with HubSpot data
   - Generate AI response
   - Send notification
   - Update UI

2. **User Journey Tests**
   - User registration and login
   - Submit support request
   - View and respond to messages
   - Manage bookings
   - Admin functions

### Performance Tests
- Load testing for webhook endpoint
- Database query performance
- API response time benchmarks
- Concurrent user handling

## Phase 4: Continuous Testing (Ongoing)

### Test-Driven Development
1. **New Feature Policy**
   - Write tests before implementation
   - Minimum 80% coverage for new code
   - All PRs must include tests

2. **Regression Prevention**
   - Add test for every bug fix
   - Document edge cases in tests
   - Regular test review and updates

### Automated Testing Pipeline
```yaml
# GitHub Actions workflow
- Run tests on every PR
- Block merge if tests fail
- Generate coverage reports
- Performance regression checks
- Security vulnerability scanning
```

## Implementation Checklist

### Immediate Actions (This Week)
- [ ] Fix jest configuration
- [ ] Create test database setup script
- [ ] Fix resource cleanup in existing tests
- [ ] Add OpenPhone webhook tests
- [ ] Add Messages API tests

### Short Term (Next 2 Weeks)
- [ ] Achieve 60% code coverage
- [ ] Add integration tests for critical paths
- [ ] Set up GitHub Actions for CI/CD
- [ ] Create test data factories
- [ ] Document testing guidelines

### Long Term (Next Month)
- [ ] Achieve 80% code coverage
- [ ] Add performance benchmarks
- [ ] Implement visual regression testing
- [ ] Add security testing suite
- [ ] Create testing dashboard

## Testing Stack Recommendations

### Backend Testing
- **Jest**: Continue using for unit/integration tests
- **Supertest**: For API endpoint testing
- **Jest-Extended**: For better assertions
- **Faker**: For test data generation
- **Nock**: For external API mocking

### Frontend Testing
- **Jest + React Testing Library**: Component tests
- **Cypress**: E2E testing
- **MSW**: Mock service worker for API mocking
- **Storybook**: Component documentation and testing

### Database Testing
- **Test containers**: Isolated PostgreSQL for tests
- **Database cleaner**: Transaction-based test isolation
- **Factory libraries**: Consistent test data creation

## Success Metrics

### Coverage Goals
- **Overall**: 80% coverage minimum
- **Critical paths**: 95% coverage
- **New code**: 90% coverage required

### Quality Metrics
- Zero failing tests in main branch
- All PRs have tests
- Test execution under 5 minutes
- No flaky tests

### Documentation
- Every test has clear description
- Complex logic has inline comments
- Test data requirements documented
- Testing guide for contributors

## Next Steps

1. **Fix current test suite** (Priority 1)
2. **Add OpenPhone webhook tests** (Priority 2)
3. **Add Messages API tests** (Priority 3)
4. **Set up CI/CD pipeline** (Priority 4)
5. **Document testing standards** (Priority 5)

## Resources Needed

- [ ] Developer time: 2-3 weeks for initial setup
- [ ] CI/CD credits for GitHub Actions
- [ ] Test database instance
- [ ] Monitoring tools for test metrics
- [ ] Team training on TDD practices

---

*Last Updated: August 6, 2025*
*Version: 1.0*