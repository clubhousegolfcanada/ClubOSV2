# ClubOS V1 Security Quick Reference

## 🚀 Quick Commands

### Check Security Status
```bash
# Check for vulnerabilities
cd ClubOSV1-frontend && npm audit
cd ../ClubOSV1-backend && npm audit

# Run security tests
cd ClubOSV1-backend && npm test -- security.test.ts

# Check environment security
node -e "require('./dist/utils/env-security').validateEnvironmentSecurity()"
```

### Fix Common Issues
```bash
# Fix npm vulnerabilities
npm audit fix

# Update all dependencies
npm update

# Force fix vulnerabilities
npm audit fix --force
```

### Deploy Security Updates
```bash
# Always run before deploying
./verify-security.sh

# Deploy sequence
git pull
npm install
npm run build
npm test
# If all pass, then deploy
```

## 🔐 Security Checklist

### Daily
- [ ] Check error logs for security events
- [ ] Monitor failed login attempts
- [ ] Review rate limit breaches

### Weekly
- [ ] Run `npm audit` on both frontend/backend
- [ ] Review security event logs
- [ ] Check for unusual API usage patterns
- [ ] Update dependencies if needed

### Monthly
- [ ] Full security audit (`./verify-security.sh`)
- [ ] Review and rotate API keys
- [ ] Update security documentation
- [ ] Penetration testing on staging

### Quarterly
- [ ] Rotate all secrets (JWT_SECRET, ENCRYPTION_KEY)
- [ ] Review user permissions
- [ ] Update security policies
- [ ] Third-party security audit

## 🚨 Emergency Procedures

### If Breach Detected
1. **Immediately block suspicious IPs**
   ```sql
   INSERT INTO blocked_ips (ip_address, reason, blocked_at)
   VALUES ('suspicious.ip.here', 'Security breach', NOW());
   ```

2. **Rotate all secrets**
   ```bash
   # Generate new JWT secret
   openssl rand -base64 32
   
   # Update in Railway/production
   railway variables set JWT_SECRET="new-secret-here"
   ```

3. **Force logout all users**
   ```sql
   UPDATE users SET token_version = token_version + 1;
   ```

4. **Enable emergency mode**
   ```bash
   railway variables set EMERGENCY_MODE="true"
   ```

### Common Security Fixes

#### Fix: "Invalid CSRF token"
```javascript
// Ensure CSRF token is included in requests
headers: {
  'X-CSRF-Token': csrfToken,
  'Content-Type': 'application/json'
}
```

#### Fix: "Rate limit exceeded"
```javascript
// Implement exponential backoff
let delay = 1000;
for (let i = 0; i < maxRetries; i++) {
  try {
    return await makeRequest();
  } catch (error) {
    if (error.status === 429) {
      await sleep(delay);
      delay *= 2;
    }
  }
}
```

#### Fix: "Unauthorized - Invalid token"
```javascript
// Refresh token before expiry
if (tokenExpiresIn < 300) { // 5 minutes
  await refreshToken();
}
```

## 📊 Security Metrics

### Target Metrics
- **Failed login rate**: < 5%
- **API error rate**: < 1%
- **Response time with security**: < 200ms
- **Security test coverage**: > 80%
- **Vulnerability count**: 0 critical, 0 high

### Monitoring Commands
```bash
# Check current metrics
curl https://api.clubos.com/metrics/security

# View recent security events
psql $DATABASE_URL -c "
  SELECT type, COUNT(*) as count 
  FROM security_events 
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY type;
"

# Check blocked IPs
psql $DATABASE_URL -c "
  SELECT ip_address, blocked_at, reason 
  FROM blocked_ips 
  WHERE active = true;
"
```

## 🛠️ Development Security

### Before Committing
```bash
# Never commit secrets
git diff --staged | grep -E "(secret|key|token|password)"

# Add to .gitignore if needed
echo ".env" >> .gitignore
echo "*.key" >> .gitignore
```

### Security-First Coding
```typescript
// Always validate input
const email = validator.isEmail(req.body.email) ? req.body.email : null;

// Always parameterize queries
db.query('SELECT * FROM users WHERE id = $1', [userId]);

// Always hash passwords
const hashedPassword = await bcrypt.hash(password, 12);

// Always sanitize output
const safe = DOMPurify.sanitize(userInput);
```

## 📞 Security Contacts

### Internal
- **Security Lead**: security@clubos.com
- **DevOps**: devops@clubos.com
- **Emergency**: +1-xxx-xxx-xxxx

### External
- **Railway Support**: support@railway.app
- **Sentry**: support@sentry.io
- **Security Audit**: security-audit@company.com

## 🔍 Useful Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)