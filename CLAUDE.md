## PROJECT CONTEXT
- **Purpose**: Flexible facility management system for Clubhouse 24/7 (golf simulators, pickleball, gyms, etc.)
- **Users**: 6-7 Clubhouse employees using it for operations/testing, managing 10,000+ customers across 6 locations
- **Critical**: This is PRODUCTION - all commits auto-deploy to live users immediately
- **Architecture**: Monorepo with frontend (Next.js/Vercel) and backend (Express/PostgreSQL/Railway)
- **Real-time**: Messages poll every 10s, tickets every 30s, patterns learn from responses

## CRITICAL RULES

### 1. Always Commit When Done
- git add -A && git commit && git push
- This auto-deploys to production
- Always update README and CHANGELOG

### 2. Mobile-First & Simple
- Mobile-first responsive design
- Test on actual devices
- All features MUST work on mobile Safari/Chrome

### 3. Test Before Deploy
- Test locally first (frontend port 3001, backend port 3000)
- Verify database migrations work
- Check error handling
- Run `npx tsc --noEmit` for TypeScript check

### 4. Be Direct
- Create .md plans BEFORE implementing
- Use TodoWrite for task tracking
- Keep responses concise
- Never guess - always verify with actual code/data

## COMMON TASKS & LOCATIONS
- **Bug fixes**: Usually in `ClubOSV1-frontend/src/components` or `ClubOSV1-backend/src/routes`
- **Database changes**: Create migrations in `ClubOSV1-backend/src/database/migrations/`
- **Pattern Learning (V3-PLS)**: `ClubOSV1-backend/src/services/patterns/`
- **API endpoints**: `ClubOSV1-backend/src/routes/`
- **React components**: `ClubOSV1-frontend/src/components/`
- **Always search for existing similar code before creating new files**

## TESTING COMMANDS
```bash
# Development servers
cd ClubOSV1-frontend && npm run dev  # Frontend on port 3001
cd ClubOSV1-backend && npm run dev   # Backend on port 3000

# Type checking & builds
npx tsc --noEmit                     # Check TypeScript errors
npm run build                         # Build for production

# Database operations
npm run db:migrate                   # Run pending migrations
npm run db:rollback                  # Rollback last migration
```

## WORKFLOW FOR EVERY TASK
1. Read requirements carefully - understand what's needed
2. Search for existing similar implementations first
3. Create .md plan file BEFORE writing any code
4. Implement with mobile-first approach
5. Test locally (both frontend and backend if needed)
6. Update CHANGELOG.md with version bump (e.g., 1.21.1 -> 1.21.2)
7. Update README.md version number to match
8. Commit with descriptive message and push

## FREQUENT ISSUES & SOLUTIONS
- **401 errors**: Token/auth issue - check tokenManager and localStorage
- **TypeScript errors**: Run `npx tsc --noEmit` to see all errors before committing
- **Database errors**: Often needs a migration - check recent schema changes
- **Mobile issues**: Test with Chrome DevTools device emulation
- **Port in use**: `lsof -i:3000` then `kill -9 <PID>`
- **Module not found**: Run `npm install` in the affected directory
