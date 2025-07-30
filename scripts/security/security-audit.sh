#!/bin/bash
# Security audit script for ClubOS

echo "🔒 ClubOS Security Audit"
echo "========================"

# Check for common security issues

echo "1. Checking environment variables..."
# Check if sensitive vars are exposed
if [ -f ".env" ]; then
    echo "⚠️  .env file found in project root - ensure it's in .gitignore"
    grep -E "(PASSWORD|SECRET|KEY|TOKEN)" .env | wc -l | xargs echo "   Found sensitive variables:"
fi

echo ""
echo "2. Checking dependencies for vulnerabilities..."
npm audit --production

echo ""
echo "3. Checking for hardcoded secrets..."
# Search for potential secrets in code
grep -r -E "(api_key|apikey|password|secret|token)" --include="*.ts" --include="*.js" src/ | grep -v -E "(process\.env|config\.|\/\/|import|interface|type)" | head -10

echo ""
echo "4. Checking authentication middleware usage..."
# Find routes without auth middleware
echo "Routes potentially missing authentication:"
grep -r "router\." src/routes/ | grep -v -E "(authenticate|authorize)" | grep -E "(get|post|put|delete|patch)" | head -10

echo ""
echo "5. Checking rate limiting..."
echo "Rate limiters found:"
grep -r "rateLimiter" src/ | wc -l

echo ""
echo "6. Checking input validation..."
echo "Routes potentially missing validation:"
grep -r -E "router\.(post|put|patch)" src/routes/ | grep -v -E "(validate|sanitize|check)" | head -10

echo ""
echo "7. Checking error handling..."
echo "Potential error info leaks:"
grep -r -E "res\.status\(500\)\.json\({.*error.*:.*error" src/ | head -5

echo ""
echo "8. Creating security checklist..."

cat > SECURITY_CHECKLIST.md << 'EOF'
# ClubOS Security Checklist

## Authentication & Authorization
- [ ] All routes have appropriate authentication middleware
- [ ] Role-based access control is properly implemented
- [ ] JWT tokens have reasonable expiration times
- [ ] Refresh token rotation is implemented
- [ ] Password reset tokens expire after single use

## Input Validation & Sanitization
- [ ] All user inputs are validated
- [ ] SQL injection protection (parameterized queries)
- [ ] XSS protection (input sanitization)
- [ ] File upload restrictions implemented
- [ ] Request size limits configured

## Rate Limiting & DDoS Protection
- [ ] Rate limiting on all public endpoints
- [ ] Stricter limits on auth endpoints
- [ ] IP-based blocking for repeated failures
- [ ] Request throttling for expensive operations

## Data Protection
- [ ] Passwords hashed with bcrypt (min 12 rounds)
- [ ] Sensitive data encrypted at rest
- [ ] HTTPS enforced in production
- [ ] Secure session management
- [ ] PII data access logged

## Error Handling
- [ ] Generic error messages for users
- [ ] Detailed errors only in logs
- [ ] Stack traces never exposed
- [ ] 404s for unauthorized resources (not 403)

## Dependencies & Infrastructure
- [ ] Regular dependency updates
- [ ] Vulnerability scanning in CI/CD
- [ ] Security headers configured (Helmet.js)
- [ ] CORS properly configured
- [ ] Environment variables secured

## Monitoring & Incident Response
- [ ] Security event logging
- [ ] Anomaly detection alerts
- [ ] Failed auth attempt monitoring
- [ ] Regular security audits
- [ ] Incident response plan

## API Security
- [ ] API versioning implemented
- [ ] API key rotation capability
- [ ] Request signing for sensitive ops
- [ ] Webhook signature verification
- [ ] GraphQL query depth limiting

## Database Security
- [ ] Principle of least privilege
- [ ] Regular backups encrypted
- [ ] Connection pooling limits
- [ ] Query timeout configuration
- [ ] Audit logging enabled

## Recommendations
1. Implement OWASP Top 10 protections
2. Regular penetration testing
3. Security training for developers
4. Automated security scanning
5. Bug bounty program consideration
EOF

echo ""
echo "✅ Security audit complete!"
echo "📋 Review SECURITY_CHECKLIST.md for detailed recommendations"
echo ""
echo "🚨 Critical issues to address:"
echo "1. Remove any hardcoded secrets"
echo "2. Add authentication to all sensitive routes"
echo "3. Implement proper input validation"
echo "4. Fix any high/critical npm vulnerabilities"
