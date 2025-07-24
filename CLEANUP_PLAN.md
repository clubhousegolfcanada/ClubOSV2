# 🧹 ClubOS Cleanup Plan

## Current State
The root directory has accumulated 100+ temporary scripts and files during development.

## What Can Be Cleaned Up

### 1. **Deployment Scripts** (40+ files)
- `deploy-*.sh` - Various deployment scripts
- `commit-*.sh` - Git commit scripts
- Most are one-time use and no longer needed

### 2. **Test Scripts** (30+ files)
- `test-*.sh` / `test-*.js` - Various test scripts
- `check-*.sh` / `check-*.js` - Status check scripts
- `debug-*.js` - Debug utilities

### 3. **Fix Scripts** (20+ files)
- `fix-*.sh` / `fix-*.js` - Various fixes
- `emergency-*.sh` - Emergency patches
- `temp-*.sh` - Temporary patches

### 4. **Setup Scripts** (10+ files)
- `setup-*.sh` - Initial setup scripts
- `install-*.sh` - Installation scripts
- Most only needed during initial setup

### 5. **Documentation** (15+ files)
- `*_GUIDE.md` - Various guides
- `*_SETUP.md` - Setup documentation
- Could be moved to a docs folder

### 6. **HTML Test Files** (5+ files)
- `hubspot-*.html` - HubSpot test files
- `test-*.html` - Test pages
- `slack-sender.html` - Test utilities

## What Should Stay

### Essential Files:
- `README.md` - Main documentation
- `.gitignore` / `.gitattributes` - Git config
- `start-*.sh` - Active startup scripts
- `quick-start.sh` - Main startup script

### Core Directories:
- `ClubOSV1-frontend/` - Frontend code
- `ClubOSV1-backend/` - Backend code
- `ClubOS Agents/` - Agent configurations
- `Notes/` - Development notes
- `.git/` - Git repository

## Recommended Actions

1. **Run the cleanup script**:
   ```bash
   chmod +x cleanup-root.sh
   ./cleanup-root.sh
   ```

2. **Archive structure**:
   ```
   archive/
   ├── deployment-scripts/  (all deploy-*.sh files)
   ├── test-scripts/       (all test files)
   ├── fix-scripts/        (all fix/patch files)
   └── docs/              (guides and setup docs)
   ```

3. **After cleanup, commit**:
   ```bash
   git add .
   git commit -m "chore: organize root directory - archive old scripts"
   git push
   ```

## Benefits
- Cleaner root directory
- Easier to find active files
- All old scripts preserved in archive
- Can delete archive later when confident

## Final Root Structure
After cleanup, root will only contain:
- README.md
- Essential startup scripts (3-4 files)
- Core directories (frontend, backend, etc.)
- Git files
- Archive folder (can be deleted later)