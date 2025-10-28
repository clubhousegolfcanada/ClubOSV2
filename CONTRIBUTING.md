# Contributing to ClubOS

Welcome to ClubOS! This guide will help you contribute effectively to our production facility management system.

## 🚨 Important: Production System

**This is a LIVE PRODUCTION SYSTEM** - Every commit to `main` auto-deploys to production immediately.
- 6-7 employees actively using the system
- 10,000+ customers across 6 locations
- Real-time operations critical to business

## 📋 Before You Start

1. **Read the README.md** - Understand the system overview
2. **Read CLAUDE.md** - Review critical rules and common tasks
3. **Set up your environment** - Copy `.env.example` files and configure
4. **Test locally** - Always test on ports 3000 (backend) and 3001 (frontend)

## 🔧 Development Workflow

### 1. Plan Before Coding
```bash
# Create a plan document BEFORE implementing
docs/plans/YOUR-FEATURE-PLAN.md
```

### 2. Use TodoWrite Tool
Track your tasks using the TodoWrite tool to give visibility into progress.

### 3. Test Thoroughly
```bash
# Check TypeScript compilation
npx tsc --noEmit

# Test on mobile viewport
# Use Chrome DevTools device emulation

# Verify database migrations
npm run db:migrate
```

### 4. Update Documentation
- Update CHANGELOG.md with version bump (e.g., 1.24.31 → 1.24.32)
- Update README.md version number to match
- Document any new environment variables in .env.example

### 5. Commit & Deploy
```bash
git add -A
git commit -m "fix/feat/chore: description (v1.24.32)"
git push  # Auto-deploys to production
```

## 📝 Code Standards

### Naming Conventions

#### Files
| Type | Convention | Example |
|------|------------|---------|
| **Services** | camelCase + "Service" | `bookingService.ts` |
| **Routes** | Plural resources | `bookings.ts`, `tickets.ts` |
| **Components** | PascalCase | `BookingModal.tsx` |
| **Utils** | camelCase | `tokenManager.ts` |
| **Migrations** | Sequential numbers | `203_add_user_preferences.sql` |

#### Variables & Functions
```typescript
// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const API_BASE_URL = 'https://api.example.com';

// Functions: camelCase
function calculateBookingPrice() { }
const getUserProfile = async () => { };

// Classes: PascalCase
class BookingValidator { }

// Interfaces/Types: PascalCase with 'I' or 'T' prefix (optional but helpful)
interface IBooking { }
type TUserRole = 'admin' | 'operator' | 'customer';
```

### File Organization

#### Backend Routes
```
src/routes/
  auth/         # Authentication & tokens
  booking/      # Booking system
  operations/   # Tickets, tasks, checklists
  messaging/    # OpenPhone, Slack, notifications
  customer/     # Customer-facing features
  integrations/ # Third-party services
  admin/        # Admin-only endpoints
```

#### Frontend Components
```
src/components/
  auth/         # Login, registration
  booking/      # Booking calendar, modals
  operations/   # Operator dashboards
  customer/     # Customer portal
  common/       # Shared components
  layout/       # Navigation, footer
```

### TypeScript Requirements
- **NO `any` types** - Use `unknown` or specific types
- **Explicit return types** for functions
- **Interfaces for all API responses**
- **Enums for fixed sets of values**

```typescript
// Good
interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

async function fetchUser(id: string): Promise<ApiResponse<User>> {
  // ...
}

// Bad
async function fetchUser(id: any) {
  // ...
}
```

### Error Handling
```typescript
// Always handle errors explicitly
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  logger.error('Operation failed', { error, context });
  return {
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error'
  };
}
```

### Logging Standards
```typescript
// Use the logger, not console.log
import { logger } from './utils/logger';

// Good
logger.info('Booking created', { bookingId, userId });
logger.error('Payment failed', { error, orderId });

// Bad
console.log('Booking created');
console.error(error);
```

## 🏗️ Database Guidelines

### Migrations
1. **Sequential numbering** - No duplicates!
2. **Descriptive names** - `203_add_booking_notifications.sql`
3. **Include rollback** - Comment with rollback SQL
4. **Test locally first** - Run migration before pushing

```sql
-- Migration: 203_add_booking_notifications.sql
-- Description: Add notification preferences to bookings

ALTER TABLE bookings
ADD COLUMN notify_email BOOLEAN DEFAULT true,
ADD COLUMN notify_sms BOOLEAN DEFAULT false;

-- Rollback:
-- ALTER TABLE bookings
-- DROP COLUMN notify_email,
-- DROP COLUMN notify_sms;
```

## 🧪 Testing Requirements

### Before Every Commit
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] No console.log statements (use logger)
- [ ] Mobile responsive (test at 375px width)
- [ ] Error handling for all API calls
- [ ] Loading states for async operations

### API Testing
- Test with missing auth tokens (401 handling)
- Test with invalid data (validation)
- Test with network errors (offline handling)

## 📱 Mobile-First Development

All features MUST work on mobile:
- Minimum touch target: 44x44px
- Test on iOS Safari and Android Chrome
- Responsive breakpoints: 640px, 768px, 1024px
- Consider thumb reach zones

## 🔒 Security Guidelines

### Never Commit
- Real `.env` files
- API keys or secrets
- Customer data
- Database dumps
- Debug logs with sensitive info

### Always Do
- Validate all user input
- Use parameterized queries
- Implement rate limiting
- Check permissions before operations
- Sanitize data before display

## 🐛 Debugging Tips

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check token in localStorage, may need fresh login |
| TypeScript errors | Run `npx tsc --noEmit` to see all errors |
| Database connection | Verify DATABASE_URL in .env |
| Port already in use | `lsof -i:3000` then `kill -9 <PID>` |
| Module not found | Run `npm install` in affected directory |
| Migration needed | Check recent changes, run `npm run db:migrate` |

## 🚀 Performance Guidelines

### Frontend
- Lazy load components with `dynamic(() => import(...))`
- Optimize images (WebP format, appropriate sizes)
- Use React.memo for expensive components
- Implement virtual scrolling for long lists

### Backend
- Use database indexes for frequent queries
- Implement caching with Redis
- Paginate large result sets
- Use connection pooling

## 📦 Dependencies

### Adding New Packages
1. Justify the need (can existing packages solve it?)
2. Check bundle size impact
3. Review security advisories
4. Update both frontend and backend if needed
5. Document in README if configuration required

## 🔄 Git Commit Messages

### Format
```
type(scope): description (version)

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `chore`: Maintenance, no production code change
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code change that neither fixes nor adds feature
- `perf`: Performance improvement
- `test`: Adding missing tests

### Examples
```bash
feat(booking): add recurring booking support (v1.24.32)
fix(auth): resolve token refresh race condition (v1.24.33)
chore(deps): update Next.js to v15.0.2 (v1.24.34)
```

## 🤝 Code Review Process

### What We Look For
1. **Functionality** - Does it solve the problem?
2. **Security** - Any vulnerabilities?
3. **Performance** - Will it scale?
4. **Maintainability** - Can others understand it?
5. **Testing** - Is it tested appropriately?
6. **Documentation** - Are changes documented?

### Responding to Feedback
- Address all comments before merging
- Ask for clarification if needed
- Explain your reasoning for decisions
- Be open to suggestions

## 📞 Getting Help

- **Issues**: Check existing GitHub issues
- **Documentation**: Review `/docs` folder
- **Team**: Reach out on Slack
- **AI Assistant**: Use Claude with CLAUDE.md context

## 🎯 Quick Checklist

Before pushing to main:
- [ ] Tested locally on both backend and frontend
- [ ] TypeScript compiles without errors
- [ ] Updated CHANGELOG.md with new version
- [ ] Updated README.md version to match
- [ ] No console.log statements
- [ ] Works on mobile viewport
- [ ] Handled error cases
- [ ] Added/updated .env.example if needed
- [ ] Committed with descriptive message

## 🙏 Thank You!

Your contributions help manage facilities for thousands of customers. Every improvement matters!

Remember: **Move fast but don't break things** - this is production!