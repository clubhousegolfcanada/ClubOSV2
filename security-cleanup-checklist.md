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
