# ClubOS File Structure Cleanup Plan

## Executive Summary
This plan outlines a comprehensive cleanup strategy for the ClubOS codebase to remove redundancies, organize files, and improve maintainability.

## Current Issues Identified

### 1. Duplicate Files and Directories
- Multiple copies of SOPs files in different locations:
  - `/ClubOSV1-backend/src/ClubOS Agents/`
  - `/ClubOSV1-backend/src/sops/`
  - `/sops/`
  - `/ClubOS Agents/`
  - `/assistant-instructions/`
- Duplicate knowledge base files
- Multiple test and script directories

### 2. Obsolete/Archive Files
- `/archive/` directory with old deployment packages
- `/legacy/` directory with old implementations
- Old documentation in `/old-docs/`
- Old scripts in `/old-scripts/`
- Old components in `/old-components/`
- Multiple `.bak` and `.save` files

### 3. Temporary/Development Files
- Multiple test scripts scattered throughout
- Various `.sh` scripts in root directory
- Temporary fix scripts
- Debug scripts

### 4. Unorganized Structure
- Scripts scattered across multiple directories
- Documentation spread across various locations
- No clear separation of concerns

## Cleanup Actions

### Phase 1: Remove Duplicates (High Priority)
1. **Consolidate SOPs**
   - Keep only one canonical location: `/ClubOSV1-backend/src/sops/`
   - Remove duplicates from other locations
   - Update all references

2. **Consolidate Assistant Instructions**
   - Keep in `/ClubOSV1-backend/src/assistant-instructions/`
   - Remove root level duplicate

3. **Merge Knowledge Base Files**
   - Consolidate into `/ClubOSV1-backend/src/knowledge-base/`
   - Remove duplicates

### Phase 2: Archive Old Files (High Priority)
1. **Move to Archive**
   - All `/old-*` directories
   - `/legacy/` directory
   - Old deployment packages
   - Obsolete documentation

2. **Clean Backup Files**
   - Remove all `.bak` files
   - Remove all `.save` files
   - Remove `.old` files

### Phase 3: Organize Scripts (Medium Priority)
1. **Consolidate Scripts**
   - Move all utility scripts to `/scripts/utilities/`
   - Move deployment scripts to `/scripts/deployment/`
   - Move test scripts to `/scripts/tests/`
   - Remove duplicate scripts

2. **Clean Root Directory**
   - Move all `.sh` files to appropriate script directories
   - Keep only essential config files in root

### Phase 4: Clean Dependencies (Medium Priority)
1. **Frontend Dependencies**
   - Review and remove unused packages
   - Update outdated packages
   - Consolidate similar packages

2. **Backend Dependencies**
   - Review and remove unused packages
   - Update security vulnerabilities
   - Optimize bundle size

### Phase 5: Documentation Organization (Low Priority)
1. **Consolidate Documentation**
   - Create clear `/docs` structure:
     - `/docs/setup/`
     - `/docs/deployment/`
     - `/docs/api/`
     - `/docs/development/`
   - Remove outdated docs
   - Update README files

2. **Update Documentation**
   - Ensure all docs are current
   - Remove references to deleted files
   - Create comprehensive index

## Files to Delete

### Immediate Deletion
```
/CLUBOSV1/test-jsx.js
/CLUBOSV1/test-knowledge-api.js
/CLUBOSV1/test-knowledge-direct.js
/CLUBOSV1/test-sop-query.js
/CLUBOSV1/test-sop-search.js
/CLUBOSV1/analyze-jsx-complete.js
/CLUBOSV1/analyze-jsx-detailed.js
/CLUBOSV1/fix-jsx-structure.js
/CLUBOSV1/search-variations.js
/CLUBOSV1/trigger-deployment.sh
/CLUBOSV1/quick-demo.sh
/CLUBOSV1/quick-revert.sh
/CLUBOSV1/cleanup.sh
/CLUBOSV1/fix-security.sh
/CLUBOSV1/optimize-database.sh
/CLUBOSV1/run-performance-indexes.sh
/CLUBOSV1/analyze-size.sh
/CLUBOSV1/check-knowledge.sql
/CLUBOSV1/commit-frontend-env.sh
/CLUBOSV1/deploy-ticket-center.sh
```

### Archive (Move to /archive/cleanup-2025/)
```
/CLUBOSV1/old-components/
/CLUBOSV1/old-docs/
/CLUBOSV1/old-scripts/
/CLUBOSV1/legacy/
/CLUBOSV1/archive/ninjaone-docs/
```

### Duplicate Removals
```
/CLUBOSV1/ClubOS Agents/ (duplicate of backend/src/sops)
/CLUBOSV1/assistant-instructions/ (duplicate of backend/src/assistant-instructions)
/CLUBOSV1/sops/ (duplicate of backend/src/sops)
/CLUBOSV1/ClubOSV1-backend/src/ClubOS Agents/ (duplicate of backend/src/sops)
```

## Expected Benefits
1. **Reduced Complexity**: Easier to navigate and understand
2. **Better Performance**: Smaller repository size
3. **Improved Maintainability**: Clear structure and organization
4. **Reduced Confusion**: Single source of truth for each component
5. **Cleaner Deployments**: Less unnecessary files

## Implementation Timeline
- Phase 1: Immediate (1-2 hours)
- Phase 2: Within 24 hours
- Phase 3: Within 48 hours
- Phase 4: Within 1 week
- Phase 5: Within 2 weeks

## Backup Strategy
1. Create full backup before starting
2. Tag current state in git: `pre-cleanup-2025`
3. Document all moves and deletions
4. Test after each phase

## Success Metrics
- Repository size reduction > 30%
- No duplicate files
- All scripts organized
- Clear documentation structure
- All tests passing
- No broken references