# ClubOS Quick Fix Guide

## 🚨 Critical Security Fixes (Do First!)

### 1. Fix SQL Injection (15 minutes)
```typescript
// ❌ UNSAFE - Current code
const sql = `SELECT * FROM ${table} WHERE ${column} = '${value}'`;

// ✅ SAFE - Use parameterized queries
const sql = 'SELECT * FROM knowledge_audit_log WHERE category = $1';
const result = await db.query(sql, [value]);
```

### 2. Add JWT Expiration (30 minutes)
```typescript
// In src/utils/auth.ts
export const generateToken = (user: User) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email,
      role: user.role 
    },
    config.JWT_SECRET,
    { expiresIn: '24h' } // Add this line
  );
};
```

### 3. Fix Memory Leak (10 minutes)
```typescript
// In ClubOSV1-frontend/src/components/RecentMessages.tsx
useEffect(() => {
  if (autoRefresh) {
    fetchMessages();
    const interval = setInterval(fetchMessages, 8000);
    return () => clearInterval(interval); // Add this cleanup
  }
}, [autoRefresh]);
```

## 🔧 Quick Performance Wins

### 1. Add Database Indexes (5 minutes)
```sql
-- Run these in your PostgreSQL database
CREATE INDEX idx_knowledge_audit_target ON knowledge_audit_log(assistant_target);
CREATE INDEX idx_knowledge_audit_category ON knowledge_audit_log(category);
CREATE INDEX idx_knowledge_audit_timestamp ON knowledge_audit_log(timestamp DESC);
```

### 2. Add Response Caching (20 minutes)
```typescript
// In src/services/knowledgeSearchService.ts
private cache = new Map<string, { data: any; timestamp: number }>();
private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async searchKnowledge(query: string, category?: string) {
  const cacheKey = `${query}-${category}`;
  const cached = this.cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
    return cached.data;
  }
  
  // ... existing search logic ...
  
  this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}
```

### 3. Optimize Bundle Size (10 minutes)
```typescript
// In ClubOSV1-frontend/src/pages/operations.tsx
// Replace static imports with dynamic
const KnowledgeRouterPanel = dynamic(
  () => import('@/components/admin/KnowledgeRouterPanel'),
  { loading: () => <div>Loading...</div> }
);
```

## 🛡️ Error Handling Template

### Global Error Handler (Copy & Paste)
```typescript
// Create src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message
    });
  }

  logger.error('Unexpected error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
};

// In src/index.ts - Add at the end
app.use(errorHandler);
```

## 📝 TypeScript Quick Fixes

### Replace Common 'any' Types
```typescript
// ❌ Bad
const processData = (data: any) => { ... }

// ✅ Good - Create interfaces
interface KnowledgeData {
  id: string;
  category: string;
  content: string;
  confidence: number;
}

const processData = (data: KnowledgeData) => { ... }
```

### Common Type Definitions to Add
```typescript
// Create src/types/api.ts
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface User {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'operator' | 'support' | 'kiosk';
  isActive: boolean;
  lastLogin?: Date;
}
```

## 🚀 Testing Commands

### Before Deploying
```bash
# Backend
cd ClubOSV1-backend
npm run typecheck        # Check TypeScript
npm run lint            # Check code style
npm run test            # Run tests (if any)
npm run build           # Ensure it builds

# Frontend  
cd ClubOSV1-frontend
npm run typecheck       # Check TypeScript
npm run lint           # Check code style
npm run build          # Ensure it builds
```

### Database Health Check
```sql
-- Check slow queries
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
AND n_distinct > 100
AND correlation < 0.1
ORDER BY n_distinct DESC;
```

## 🔍 Monitoring Checklist

### Daily Checks
- [ ] Check error logs for patterns
- [ ] Monitor API response times
- [ ] Review failed login attempts
- [ ] Check database connection pool

### Weekly Checks
- [ ] Run `npm audit` for vulnerabilities
- [ ] Review user feedback
- [ ] Check disk space usage
- [ ] Analyze slow queries

### Before Each Deploy
- [ ] Run TypeScript check
- [ ] Test critical user paths
- [ ] Check environment variables
- [ ] Have rollback plan ready

## 📞 Emergency Contacts

### If Something Breaks
1. **Check logs first**: `pm2 logs` or Railway logs
2. **Common fixes**:
   - Restart service: `pm2 restart clubos-backend`
   - Clear cache: `redis-cli FLUSHALL` (if using Redis)
   - Check database: `psql $DATABASE_URL`
3. **Rollback if needed**: `git revert HEAD && git push`

Remember: Always test locally first!