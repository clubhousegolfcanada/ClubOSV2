# Claude Quick Start - Read This First!

## 🎯 You Are Working On
**ClubOS** - Production facility management system for Clubhouse 24/7
- **LIVE SYSTEM**: All commits auto-deploy to production immediately
- **Current Scale**: 6-7 Clubhouse employees (all staff can access), 10K+ customers, 6 locations
- **Use Cases**: Golf simulators, pickleball courts, gyms - any facility management
- **Tech Stack**: Next.js (Vercel) + Express (Railway) + PostgreSQL

## ⚡ Your Rules - ALWAYS
1. ✅ **Mobile-first** - Test everything on mobile viewport
2. ✅ **Plan first** - Create .md file with plan BEFORE coding
3. ✅ **Search first** - Look for existing similar code
4. ✅ **Update docs** - CHANGELOG.md + README.md version
5. ✅ **Commit & push** - When done: `git add -A && git commit && git push`
6. ❌ **Never guess** - Verify with actual code
7. ❌ **Never create unnecessary files** - Edit existing when possible

## 🚀 Start Every Session With
```bash
# 1. Check current status
git status
git log --oneline -5

# 2. If needed, start dev servers
cd ClubOSV1-frontend && npm run dev  # Port 3001
cd ClubOSV1-backend && npm run dev   # Port 3000

# 3. Read the task requirements carefully
```

## 📁 Where Things Live
```
ClubOSV1/
├── ClubOSV1-frontend/src/
│   ├── components/       # React components
│   ├── pages/            # Next.js pages
│   └── utils/            # Helpers (tokenManager, etc)
├── ClubOSV1-backend/src/
│   ├── routes/           # API endpoints
│   ├── services/         # Business logic
│   │   └── patterns/     # V3-PLS learning system
│   └── database/
│       └── migrations/   # Schema changes
```

## 🔥 Common Tasks Quick Reference

### Adding a Feature
1. Search for similar existing code
2. Create FEATURE_PLAN.md with approach
3. Implement mobile-first
4. Test locally
5. Update CHANGELOG.md (bump version)
6. Update README.md version
7. Commit: `git add -A && git commit -m "feat: description" && git push`

### Fixing a Bug
1. Reproduce the issue locally
2. Find the root cause (not symptoms)
3. Fix with minimal changes
4. Test the fix thoroughly
5. Update CHANGELOG.md
6. Commit: `git add -A && git commit -m "fix: description" && git push`

### Database Changes
1. Create migration file in `ClubOSV1-backend/src/database/migrations/`
2. Name format: `XXX_description.sql` (XXX = next number)
3. Test locally: `npm run db:migrate`
4. Include rollback if complex
5. Commit and push (auto-runs in production)

## ⚠️ Testing Checklist
Before EVERY commit:
- [ ] Works on mobile viewport (375px wide)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No console errors in browser
- [ ] Handles errors gracefully (no crashes)
- [ ] Data persists on page refresh
- [ ] Works with slow network (loading states)

## 🐛 Quick Fixes for Common Issues

| Problem | Solution |
|---------|----------|
| 401 Unauthorized | Clear localStorage, fresh login |
| Port in use | `lsof -i:3000` → `kill -9 <PID>` |
| TypeScript error | `npx tsc --noEmit` to see all |
| Module not found | `npm install` in that directory |
| Database error | Probably needs migration |
| Styles not updating | Hard refresh: Cmd+Shift+R |

## 💡 Current System State
- **Performance**: 50+ DB indexes, Redis caching, lazy loading
- **Real-time**: Messages poll 10s, tickets 30s
- **Learning**: V3-PLS patterns learn from operator responses
- **Mobile**: PWA-ready, works offline partially
- **Scale**: Built for 10x current load

## 🎯 Current Focus Areas
- Mobile UX improvements
- Pattern learning accuracy
- Performance optimization
- Operator efficiency tools

---

**Remember**: This is PRODUCTION. Real users. Real business. Test everything.