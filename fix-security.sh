#!/bin/bash

# Security Fix Script - Remove secrets from Git history

echo "🔒 ClubOS Security Fix - Removing Exposed Secrets"
echo "================================================"
echo "⚠️  IMPORTANT: This will rewrite Git history!"
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Not in a git repository!"
    exit 1
fi

echo "📋 Step 1: Identifying files with secrets..."

# Common files that might contain secrets
SECRET_FILES=(
    ".env"
    ".env.local"
    ".env.production"
    "*.env"
    "src/config/config.js"
    "src/config/config.ts"
    "config.json"
    "secrets.json"
)

echo -e "\n🔍 Searching for sensitive files in Git history..."

# List all files that might contain secrets
for pattern in "${SECRET_FILES[@]}"; do
    git log --all --full-history -- "$pattern" 2>/dev/null | grep -q commit && echo "Found: $pattern"
done

echo -e "\n📝 Files to be removed from history:"
echo "  - All .env files"
echo "  - Any hardcoded JWT secrets"
echo "  - Configuration files with secrets"

echo -e "\n⚠️  This script will:"
echo "1. Remove sensitive files from Git history"
echo "2. Create new secure environment templates"
echo "3. Update .gitignore to prevent future leaks"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Create backup branch
echo -e "\n🔄 Creating backup branch..."
git branch backup-before-secret-removal

# Remove files from history using filter-branch
echo -e "\n🧹 Removing sensitive files from Git history..."
git filter-branch --force --index-filter \
    'git rm -rf --cached --ignore-unmatch .env .env.* *.env config.json secrets.json' \
    --prune-empty --tag-name-filter cat -- --all

echo -e "\n✅ Sensitive files removed from history!"

echo -e "\n📋 Next steps:"
echo "1. Force push to update remote repository:"
echo "   git push origin --force --all"
echo "   git push origin --force --tags"
echo ""
echo "2. All team members must re-clone the repository"
echo ""
echo "3. Rotate all exposed secrets:"
echo "   - Generate new JWT secrets"
echo "   - Update API keys"
echo "   - Change any passwords"
echo ""
echo "4. Update production environment variables"

# Create a post-cleanup checklist
cat > security-cleanup-checklist.md << 'EOF'
# Security Cleanup Checklist

## Immediate Actions Required

### 1. Rotate All Secrets
- [ ] Generate new JWT_SECRET (use: `openssl rand -base64 32`)
- [ ] Generate new SESSION_SECRET (use: `openssl rand -base64 32`)
- [ ] Rotate any API keys that were exposed
- [ ] Update Railway environment variables
- [ ] Update any other deployment environments

### 2. Repository Cleanup
- [ ] Force push the cleaned history
- [ ] Delete and re-protection branch rules
- [ ] Have all team members re-clone

### 3. Audit Trail
- [ ] Document what was exposed
- [ ] Check if secrets were used anywhere
- [ ] Enable secret scanning on GitHub

### 4. Prevention
- [ ] Ensure .gitignore includes all .env files
- [ ] Use environment variable templates (.env.template)
- [ ] Enable pre-commit hooks to check for secrets
- [ ] Consider using a secret management service

## New Secure Secrets

Generate new secrets with these commands:

```bash
# JWT Secret
openssl rand -base64 32

# Session Secret
openssl rand -base64 32

# Random API Key
openssl rand -hex 32
```

## Update These Locations
1. Railway environment variables
2. Local .env files (not committed)
3. Any CI/CD pipelines
4. Documentation (use placeholders only)
EOF

echo -e "\n📄 Created security-cleanup-checklist.md"
echo "⚠️  IMPORTANT: Review and complete all items in the checklist!"
