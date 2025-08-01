# ClubOS Housecleaning Checklist
Generated: August 1, 2025

## 🧹 Quick Wins (Immediate Cleanup - 776KB savings)

### 1. Archive Directory Removal
```bash
# Remove entire archive directory (contains old scripts, docs, and legacy code)
rm -rf archive/
```
**Impact**: Removes 776KB of legacy files, old documentation, and disabled code

### 2. Legacy Script Cleanup
```bash
# Remove old/duplicate shell scripts
rm -f fix-openphone-secure.sh
rm -f test-openphone-messages.sh
rm -f check-messages-api.sh
rm -f archive/deploy-learning-sop.sh.old
```

### 3. Old Markdown Files
```bash
# Remove outdated documentation
rm -f CLAUDE_OPENPHONE_FIX.md
rm -f MESSAGES_TROUBLESHOOTING.md
rm -f URGENT-FIX-OPENPHONE.sql
rm -f fix-openphone-columns.sql
```

## 📦 Dependencies Audit

### Backend Dependencies to Review
- [ ] Check if Sequelize is still needed (using raw SQL now)
- [ ] Review if all middleware packages are in use
- [ ] Audit test dependencies vs devDependencies

### Frontend Dependencies to Review
- [ ] Verify all component libraries are in use
- [ ] Check for duplicate functionality packages
- [ ] Review build tool dependencies

## 🗄️ Database Cleanup

### 1. Migration Files
- [ ] Verify all migrations have been applied
- [ ] Archive successfully applied migration scripts
- [ ] Remove duplicate migration files

### 2. Obsolete Tables/Columns
- [ ] Review SOP-related tables (system disabled)
- [ ] Check for unused columns in existing tables
- [ ] Remove test data from production

## 🔧 Configuration Cleanup

### 1. Environment Variables
**Remove from .env.example:**
- `USE_INTELLIGENT_SOP` (system disabled)
- `SOP_SHADOW_MODE` (system disabled)
- `SOP_CONFIDENCE_THRESHOLD` (system disabled)

### 2. Feature Flags
- [ ] Remove SOP module flags from code
- [ ] Clean up disabled feature conditionals
- [ ] Update documentation to remove SOP references

## 📁 File Organization

### 1. Scripts Directory Consolidation
**Current duplicate locations:**
- `/scripts/`
- `/ClubOSV1-backend/scripts/`
- `/archive/old-scripts/`

**Action**: Consolidate active scripts to one location

### 2. Documentation Structure
**Consolidate similar docs:**
- Multiple Slack integration docs
- Duplicate deployment guides
- Redundant setup instructions

### 3. Test File Organization
- [ ] Move all test files to `__tests__` directories
- [ ] Remove duplicate test scripts
- [ ] Organize by unit/integration/e2e

## 🚨 Code Cleanup

### 1. Remove Disabled Features
- [ ] SOP module code (already disabled)
- [ ] Legacy authentication methods
- [ ] Unused API endpoints

### 2. Dead Code Removal
- [ ] Commented out code blocks
- [ ] Unused utility functions
- [ ] Orphaned component files

### 3. Type Definitions
- [ ] Remove unused TypeScript interfaces
- [ ] Consolidate duplicate type definitions
- [ ] Update outdated type files

## 📊 Logs and Temporary Files

### 1. Log Files
```bash
# Clear old logs (keep structure)
echo "" > ClubOSV1-backend/logs/combined.log
echo "" > ClubOSV1-backend/logs/error.log
```

### 2. Build Artifacts
```bash
# Clean build directories
rm -rf ClubOSV1-frontend/.next/
rm -rf ClubOSV1-backend/dist/
```

### 3. Cache Files
```bash
# Remove TypeScript build info
rm -f tsconfig.tsbuildinfo
rm -f ClubOSV1-frontend/tsconfig.tsbuildinfo
```

## 🔐 Security Cleanup

### 1. Secrets Audit
- [ ] Rotate any exposed keys
- [ ] Update JWT secrets
- [ ] Review API key usage

### 2. Remove Security Scripts
- [ ] Archive security audit scripts
- [ ] Remove one-time migration scripts
- [ ] Clean up test authentication files

## 📋 Cleanup Priority Order

1. **High Priority** (Do First)
   - Remove `/archive/` directory
   - Clean up legacy .old files
   - Remove duplicate scripts
   - Update .env.example

2. **Medium Priority** (Next Sprint)
   - Consolidate documentation
   - Organize test files
   - Review dependencies
   - Clean up feature flags

3. **Low Priority** (As Time Permits)
   - Optimize imports
   - Format code consistently
   - Update outdated comments
   - Reorganize component structure

## 🚀 Post-Cleanup Tasks

1. **Update Documentation**
   - Remove references to deleted files
   - Update setup guides
   - Refresh README

2. **Test Everything**
   ```bash
   npm run test
   npm run build
   npm run lint
   ```

3. **Commit Changes**
   ```bash
   git add -A
   git commit -m "chore: Major housecleaning - remove legacy code and organize structure"
   git push origin main
   ```

## 📏 Estimated Impact

- **Disk Space**: ~1MB immediate savings
- **Build Time**: 10-15% faster builds
- **Code Clarity**: Significant improvement
- **Maintenance**: Much easier navigation

## ⚠️ Before Starting

1. **Create a backup branch**
   ```bash
   git checkout -b pre-cleanup-backup
   git push origin pre-cleanup-backup
   ```

2. **Verify production is stable**
3. **Inform team of cleanup activity**
4. **Have rollback plan ready**

---

Remember: When in doubt, archive don't delete. You can always remove archives later.