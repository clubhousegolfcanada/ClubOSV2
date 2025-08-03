# ClubOS Environment Variables Setup Guide

## Critical Environment Variables

These environment variables MUST be set in production (Railway) for the backend to start:

### 1. ENCRYPTION_KEY (Required)
- **Purpose**: Encrypts sensitive data in the database
- **Format**: Exactly 32 characters
- **Generate**: Run `node scripts/generate-encryption-key.js`
- **Example**: `tW51RCGPGbKt49yOByo5+zQFGhZoGNcY`

⚠️ **IMPORTANT**: 
- Must be exactly 32 characters
- Cannot be the default value
- Save this key securely - data encrypted with it cannot be decrypted without it

### 2. JWT_SECRET (Required)
- **Purpose**: Signs authentication tokens
- **Format**: At least 32 characters
- **Generate**: Run `openssl rand -base64 32`
- **Example**: `xK9mP2nQ8rS3tU5vW6yZ1aC4dE7fG0hJ3kL6mN9pQ2rS4tU6v=`

### 3. DATABASE_URL (Required)
- **Purpose**: PostgreSQL connection string
- **Format**: `postgresql://user:password@host:port/database?sslmode=require`
- **Note**: Must include `?sslmode=require` in production

### 4. OPENAI_API_KEY (Required)
- **Purpose**: OpenAI API access for AI features
- **Format**: Starts with `sk-` or `sk-proj-`
- **Get from**: https://platform.openai.com/api-keys

### 5. NODE_ENV (Required)
- **Purpose**: Application environment
- **Values**: `production`, `development`, or `test`
- **Production**: Must be set to `production`

## Recommended Environment Variables

### 6. SENTRY_DSN (Recommended)
- **Purpose**: Error monitoring and reporting
- **Format**: `https://xxxx@xxx.ingest.sentry.io/xxx`
- **Get from**: https://sentry.io/

### 7. SLACK_WEBHOOK_URL (Optional)
- **Purpose**: Send notifications to Slack
- **Format**: `https://hooks.slack.com/services/xxx/xxx/xxx`

### 8. OPENPHONE_API_KEY (Optional)
- **Purpose**: SMS messaging integration
- **Format**: At least 20 characters

### 9. VAPID Keys (Optional - for push notifications)
- **VAPID_PUBLIC_KEY**: Public key for push notifications
- **VAPID_PRIVATE_KEY**: Private key for push notifications
- **Generate**: Run `node scripts/generate-vapid-keys.js`

## Setting Environment Variables in Railway

1. Go to your Railway dashboard
2. Select your backend service
3. Go to "Variables" tab
4. Click "Add Variable"
5. Add each variable with its value
6. Railway will automatically redeploy

## Verification

After setting all variables, the backend should start without errors. Check logs for:
```
🔐 Validating environment security...
✅ JWT_SECRET validated
✅ ENCRYPTION_KEY validated
✅ DATABASE_URL validated
✅ OPENAI_API_KEY validated
✅ NODE_ENV validated
✅ Environment security validation passed!
```

## Security Notes

1. **Never commit** environment variables to git
2. **Rotate secrets** quarterly
3. **Use strong passwords** in database URLs
4. **Enable SSL** for database connections (`sslmode=require`)
5. **Monitor logs** for security validation errors

## Troubleshooting

### "ENCRYPTION_KEY must be exactly 32 characters"
- Run `node scripts/generate-encryption-key.js`
- Copy the generated key exactly
- Ensure no extra spaces or characters

### "JWT_SECRET must be at least 32 characters"
- Run `openssl rand -base64 32`
- Use the full output including special characters

### "DATABASE_URL must be valid PostgreSQL URL"
- Format: `postgresql://user:password@host:port/database`
- Add `?sslmode=require` at the end for production
- Ensure password doesn't contain `password123` or `postgres`