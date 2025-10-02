# ClubOS Directory Cleanup & Organization Plan

## Current State Analysis
- **85 total items** in root directory (way too cluttered!)
- **57 markdown files** scattered in root (documentation chaos)
- **Mixed concerns:** Scripts, docs, configs, and project code all at root level
- **No clear organization** for documentation, audits, or plans

## Proposed New Structure

```
CLUBOSV1/
├── src/                          # Main source code (rename from ClubOSV1-*)
│   ├── backend/                  # Backend application
│   └── frontend/                 # Frontend application
│
├── docs/                         # All documentation
│   ├── audits/                   # System audits and reports
│   ├── plans/                    # Implementation plans
│   ├── technical/                # Technical documentation
│   ├── operations/               # Operational guides
│   └── archive/                  # Old/outdated docs
│
├── scripts/                      # All scripts
│   ├── deployment/               # Deployment scripts
│   ├── maintenance/              # Maintenance scripts
│   ├── migration/                # Database migrations
│   └── development/              # Dev helper scripts
│
├── config/                       # Configuration files
│   ├── environments/             # Environment configs
│   └── services/                 # Service-specific configs
│
├── data/                         # Data-related files
│   ├── backups/                  # Database backups
│   ├── logs/                     # Application logs
│   └── temp/                     # Temporary files
│
├── .github/                      # GitHub workflows (keep as-is)
├── .claude/                      # Claude config (keep as-is)
│
├── README.md                     # Main project README
├── CHANGELOG.md                  # Keep at root for visibility
├── CLAUDE.md                     # Claude instructions (must stay at root)
├── package.json                  # Root package.json (if monorepo)
├── .gitignore
└── .env.example                  # Example environment variables
```

## Step-by-Step Cleanup Actions

### Phase 1: Create New Directory Structure
```bash
# Create main directories
mkdir -p docs/{audits,plans,technical,operations,archive}
mkdir -p scripts/{deployment,maintenance,migration,development}
mkdir -p config/{environments,services}
mkdir -p data/{backups,logs,temp}
```

### Phase 2: Move Documentation Files
```bash
# Move audit files
mv *AUDIT*.md docs/audits/
mv *CORRECTIONS*.md docs/audits/
mv CODE-AUDIT-*.md docs/audits/

# Move plan files
mv *PLAN*.md docs/plans/
mv *IMPLEMENTATION*.md docs/plans/

# Move technical docs
mv *TECHNICAL*.md docs/technical/
mv *SAFEGUARDS*.md docs/technical/
mv V3-*.md docs/technical/

# Move operational docs
mv *QUICKSTART*.md docs/operations/
mv *README*.md docs/operations/  # except main README
mv *GUIDE*.md docs/operations/

# Archive old versions
mv *OLD*.md docs/archive/
mv *DEPRECATED*.md docs/archive/
```

### Phase 3: Organize Scripts
```bash
# Move deployment scripts
mv deploy*.sh scripts/deployment/
mv *railway*.sh scripts/deployment/
mv *vercel*.sh scripts/deployment/

# Move maintenance scripts
mv fix-*.sh scripts/maintenance/
mv repair-*.sh scripts/maintenance/
mv cleanup-*.sh scripts/maintenance/

# Move migration scripts
mv migrate-*.sh scripts/migration/
mv *migration*.sql scripts/migration/

# Move dev scripts
mv test-*.sh scripts/development/
mv run-*.sh scripts/development/
```

### Phase 4: Clean Up Data Files
```bash
# Move existing backups
mv database-backups/* data/backups/
rmdir database-backups

# Move logs
mv logs/* data/logs/
rmdir logs

# Move temporary files
mv *.tmp data/temp/
mv *.log data/temp/
```

### Phase 5: Rename Main Directories
```bash
# Rename to cleaner names
mv ClubOSV1-backend src/backend
mv ClubOSV1-frontend src/frontend
```

### Phase 6: Create Index Files
Create `docs/INDEX.md`:
```markdown
# Documentation Index

## Audits
- [Third-Party Integrations](audits/THIRD_PARTY_INTEGRATIONS_AUDIT.md)
- [2025 Technical Audit](audits/CLUBOS-TECHNICAL-AUDIT-2025.md)
- [Security Audit](audits/SECURITY_AUDIT.md)

## Implementation Plans
- [Current Sprint](plans/CURRENT_SPRINT.md)
- [Roadmap](plans/ROADMAP.md)

## Technical Docs
- [Architecture](technical/ARCHITECTURE.md)
- [API Documentation](technical/API_DOCS.md)
```

## Files to Keep at Root
These files MUST stay at root level:
- `README.md` - Main project documentation
- `CHANGELOG.md` - Version history
- `CLAUDE.md` - Claude AI instructions (required by Claude)
- `.gitignore` - Git configuration
- `.env.example` - Environment template
- `package.json` - If using monorepo structure
- `.github/` - GitHub Actions workflows

## Files to Delete/Archive
Consider removing these outdated or redundant files:
- Old test files that aren't referenced
- Duplicate documentation
- Temporary scripts no longer needed
- Generated files that shouldn't be in git

## Benefits of This Organization

### 1. **Clear Separation of Concerns**
- Source code separate from documentation
- Scripts organized by purpose
- Data files in dedicated location

### 2. **Easier Navigation**
- Find files quickly by category
- Logical grouping reduces cognitive load
- New developers can understand structure immediately

### 3. **Better Git Management**
- Can gitignore entire directories (logs, backups)
- Cleaner commit history
- Easier code reviews

### 4. **Improved Development Workflow**
- Scripts organized by when you need them
- Documentation easy to find and update
- Less scrolling through irrelevant files

### 5. **Professional Appearance**
- Clean root directory
- Well-organized structure
- Shows attention to detail

## Implementation Script

Save this as `reorganize.sh`:

```bash
#!/bin/bash

echo "🧹 Starting ClubOS directory reorganization..."

# Create new structure
echo "📁 Creating new directory structure..."
mkdir -p docs/{audits,plans,technical,operations,archive}
mkdir -p scripts/{deployment,maintenance,migration,development}
mkdir -p config/{environments,services}
mkdir -p data/{backups,logs,temp}

# Move documentation
echo "📚 Organizing documentation..."
mv *AUDIT*.md docs/audits/ 2>/dev/null
mv *PLAN*.md docs/plans/ 2>/dev/null
mv *TECHNICAL*.md docs/technical/ 2>/dev/null

# Move scripts
echo "📜 Organizing scripts..."
mv *.sh scripts/development/ 2>/dev/null
mv *.sql scripts/migration/ 2>/dev/null

# Create index
echo "📝 Creating documentation index..."
cat > docs/INDEX.md << 'EOF'
# Documentation Index
See individual folders for categorized documentation.
EOF

echo "✅ Reorganization complete!"
echo "⚠️  Remember to:"
echo "  1. Update any hardcoded paths in your code"
echo "  2. Update CI/CD scripts"
echo "  3. Commit changes with descriptive message"
echo "  4. Update team documentation"
```

## Post-Cleanup Tasks

1. **Update Import Paths**
   - Check frontend/backend for hardcoded paths
   - Update build scripts
   - Fix deployment configurations

2. **Update CI/CD**
   - GitHub Actions workflows
   - Railway deployment settings
   - Vercel configuration

3. **Update Documentation**
   - README with new structure
   - Developer onboarding docs
   - Contribution guidelines

4. **Team Communication**
   - Notify team of changes
   - Update wiki/confluence
   - Create migration guide

## Maintenance Tips

1. **Regular Cleanup Schedule**
   - Weekly: Clear temp files
   - Monthly: Archive old logs
   - Quarterly: Review and reorganize docs

2. **Naming Conventions**
   - Use consistent prefixes for related files
   - Date format: YYYY-MM-DD for time-sensitive docs
   - Semantic versioning for releases

3. **Documentation Standards**
   - Every new feature needs docs
   - Keep README files in each major directory
   - Archive don't delete (for history)

## Expected Outcome

### Before (85 files in root):
```
CLUBOSV1/
├── (57 .md files scattered)
├── (various .sh scripts)
├── (mixed project directories)
└── (no clear organization)
```

### After (10 items in root):
```
CLUBOSV1/
├── src/
├── docs/
├── scripts/
├── config/
├── data/
├── .github/
├── .claude/
├── README.md
├── CHANGELOG.md
└── CLAUDE.md
```

This reduces root clutter by **88%** and makes the project instantly understandable!